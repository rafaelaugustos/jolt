import { shapePath, type ShapePath } from './shape-path.js'

export type DrawingItem = { id: string; style: string } & (
  | { kind: 'circle'; cx: number; cy: number; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'path'; d: string }
)
export interface DrawingStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
  fillRule?: 'nonzero' | 'evenodd'
}
export interface DrawingValues {
  items?: readonly DrawingItem[]
  styles?: Readonly<Record<string, DrawingStyle>>
}
export interface DrawingOptions extends DrawingValues {
  viewBox: readonly [number, number, number, number]
  items: readonly DrawingItem[]
  styles: Readonly<Record<string, DrawingStyle>>
}
export interface DrawingSnapshot {
  items: number
  styles: number
  commands: number
  components: number
  /** Numeric geometry payload only; excludes runtime objects and renderer storage. */
  geometryBytes: number
  attached: boolean
}
export interface Drawing {
  readonly disposed: boolean
  readonly suspended: boolean
  /** Validate the whole next drawing before replacing items and/or shared styles. */
  set(values: DrawingValues): void
  /** Replace existing items by stable id, preserving their order. */
  update(items: readonly DrawingItem[]): void
  snapshot(): DrawingSnapshot
  /** Retain the drawing; defer writes until resume. Whole-host motion is owned separately. */
  suspend(): void
  resume(): void
  dispose(): void
}
export const drawingLimits = Object.freeze({
  items: 1024,
  styles: 64,
  commands: 8192,
  components: 65536,
  payloadBytes: 2097152,
})
export interface PreparedItem {
  id: string
  style: string
  path: ShapePath
  source: DrawingItem
  signature: string
}
export interface PreparedStyle {
  id: string
  fill: number
  stroke: number
  width: number
  cap: string
  join: string
  rule: string
}
export interface DrawingState {
  viewBox: readonly number[]
  items: PreparedItem[]
  styles: PreparedStyle[]
  sourceStyles: Record<string, DrawingStyle>
  commands: number
  components: number
}
function bounded(value: number, name: string, min = -1000000, max = 1000000) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be within ${min}..${max}.`)
  return value
}
const key = (value: string) => {
  if (typeof value !== 'string' || !/^[\w.-]{1,128}$/.test(value))
    throw new TypeError(
      'Drawing ids are 1..128 letters, digits, dots, underscores or hyphens.',
    )
  return value
}
function geometry(item: DrawingItem) {
  if (item.kind === 'path') return shapePath(item.d)
  if (item.kind === 'circle') {
    const x = bounded(item.cx, 'cx'),
      y = bounded(item.cy, 'cy'),
      r = bounded(item.radius, 'radius', 0.001)
    return shapePath(
      `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`,
    )
  }
  if (item.kind === 'rect') {
    const x = bounded(item.x, 'x'),
      y = bounded(item.y, 'y'),
      w = bounded(item.width, 'width', 0.001),
      h = bounded(item.height, 'height', 0.001)
    return shapePath(`M${x} ${y}h${w}v${h}h${-w}Z`)
  }
  throw new TypeError('Drawing items support circle, rect and path.')
}
export function prepareDrawing(
  input: DrawingOptions,
  color: (value: string) => number,
  previous?: DrawingState,
): DrawingState {
  if (
    !input ||
    !Array.isArray(input.viewBox) ||
    input.viewBox.length !== 4 ||
    !Array.isArray(input.items) ||
    !input.styles ||
    typeof input.styles !== 'object' ||
    Array.isArray(input.styles)
  )
    throw new TypeError('Drawing needs viewBox, items and named styles.')
  if (
    input.items.length > drawingLimits.items ||
    Object.keys(input.styles).length > drawingLimits.styles
  )
    throw new RangeError('Drawing exceeds its item/style budget.')
  const viewBox = input.viewBox.map((n, i) =>
    bounded(n, 'viewBox', i < 2 ? -1000000 : 0.001),
  )
  const sourceStyles: Record<string, DrawingStyle> = Object.create(null)
  const styles = Object.entries(input.styles).map(([id, style]) => {
    key(id)
    if (
      !style ||
      typeof style !== 'object' ||
      Object.keys(style).some(
        (key) =>
          !['fill', 'stroke', 'strokeWidth', 'lineCap', 'lineJoin', 'fillRule'].includes(
            key,
          ),
      )
    )
      throw new TypeError('Expected drawing style with supported fill/stroke fields.')
    const cap = style.lineCap ?? 'round',
      join = style.lineJoin ?? 'round',
      rule = style.fillRule ?? 'nonzero'
    if (
      !['butt', 'round', 'square'].includes(cap) ||
      !['miter', 'round', 'bevel'].includes(join) ||
      !['nonzero', 'evenodd'].includes(rule)
    )
      throw new TypeError('Invalid drawing stroke/fill style.')
    sourceStyles[id] = { ...style }
    return {
      id,
      fill: color(style.fill ?? '#00000000'),
      stroke: color(style.stroke ?? '#202630'),
      width: bounded(style.strokeWidth ?? 2, 'strokeWidth', 0, 1000),
      cap,
      join,
      rule,
    }
  })
  const old = new Map(previous?.items.map((item) => [item.id, item]))
  const ids = new Set<string>()
  let commands = 0,
    components = 0,
    sourceBytes = JSON.stringify(sourceStyles).length
  const items = input.items.map((item) => {
    if (!item || typeof item !== 'object') throw new TypeError('Expected drawing item.')
    const fields =
      item.kind === 'circle'
        ? ['cx', 'cy', 'radius']
        : item.kind === 'rect'
          ? ['x', 'y', 'width', 'height']
          : ['d']
    if (
      Object.keys(item).some((key) => !['id', 'style', 'kind', ...fields].includes(key))
    )
      throw new TypeError('Unknown drawing item field.')
    key(item.id)
    key(item.style)
    if (ids.has(item.id) || !Object.hasOwn(sourceStyles, item.style))
      throw new Error('Drawing item ids must be unique and reference a declared style.')
    ids.add(item.id)
    const signature = JSON.stringify(item),
      prior = old.get(item.id)
    sourceBytes += signature.length
    if (sourceBytes > drawingLimits.payloadBytes)
      throw new RangeError('Drawing source exceeds its retained payload budget.')
    const prepared =
      prior?.signature === signature
        ? prior
        : {
            id: item.id,
            style: item.style,
            source: { ...item },
            signature,
            path: geometry(item),
          }
    commands += prepared.path.commands.length
    components += prepared.path.points.length
    if (commands > drawingLimits.commands || components > drawingLimits.components)
      throw new RangeError('Drawing exceeds its total geometry budget.')
    return prepared
  })
  return { viewBox, styles, sourceStyles, items, commands, components }
}
export function drawingUpdate(
  state: DrawingState,
  values: DrawingValues,
  color: (value: string) => number,
) {
  if (
    !values ||
    typeof values !== 'object' ||
    Object.keys(values).some((key) => key !== 'items' && key !== 'styles')
  )
    throw new TypeError('Drawing set accepts items and styles.')
  return prepareDrawing(
    {
      viewBox: state.viewBox as DrawingOptions['viewBox'],
      items: values.items ?? state.items.map((item) => item.source),
      styles: values.styles ?? state.sourceStyles,
    },
    color,
    state,
  )
}
export function drawingPatch(
  state: DrawingState,
  items: readonly DrawingItem[],
  color: (value: string) => number,
) {
  if (!Array.isArray(items)) throw new TypeError('Drawing update needs existing items.')
  const patches = new Map(items.map((item) => [item.id, item]))
  const ids = new Set(state.items.map((item) => item.id))
  if (patches.size !== items.length || [...patches.keys()].some((id) => !ids.has(id)))
    throw new Error(
      'Drawing update requires unique existing ids; use set for insertion/removal.',
    )
  return drawingUpdate(
    state,
    { items: state.items.map((item) => patches.get(item.id) ?? item.source) },
    color,
  )
}
export function drawingProgram(
  state: DrawingState,
  previous?: DrawingState,
  points?: number[],
) {
  const old = new Map(previous?.items.map((item) => [item.id, item]))
  const items = state.items
    .filter((item) => old.get(item.id) !== item)
    .map((item) => {
      if (!points)
        return {
          id: item.id,
          style: item.style,
          commands: item.path.commands,
          points: item.path.points,
        }
      const offset = points.length
      points.push(...item.path.points)
      const source = item.source
      const primitive =
        source.kind === 'circle'
          ? [source.cx, source.cy, source.radius]
          : source.kind === 'rect'
            ? [source.x, source.y, source.width, source.height]
            : undefined
      return {
        id: item.id,
        style: item.style,
        commands: item.path.commands,
        offset,
        count: item.path.points.length,
        primitive,
      }
    })
  const sameOrder =
    !!previous &&
    previous.items.length === state.items.length &&
    previous.items.every((item, i) => item.id === state.items[i]!.id)
  const sameStyles =
    !!previous && JSON.stringify(previous.styles) === JSON.stringify(state.styles)
  const payload = JSON.stringify({
    viewBox: state.viewBox,
    styles: points && sameStyles ? undefined : state.styles,
    order: points && sameOrder ? undefined : state.items.map((item) => item.id),
    items,
  })
  if (payload.length + (points?.length ?? 0) * 4 > drawingLimits.payloadBytes)
    throw new RangeError('Drawing update exceeds its serialized payload budget.')
  return payload
}
export function drawingSnapshot(state: DrawingState, attached: boolean): DrawingSnapshot {
  return {
    items: state.items.length,
    styles: state.styles.length,
    commands: state.commands,
    components: state.components,
    geometryBytes: state.components * 8,
    attached,
  }
}
