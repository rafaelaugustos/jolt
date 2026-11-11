import { graphemes, diffFromEnd } from '../core/roll-diff.js'
import {
  MAX_TEXT_GRAPHEMES,
  isVisiblePiece,
  staggeredStart,
  textPieces as pieces,
  type TextPiece as Piece,
} from '../core/text-pieces.js'
import { createTrack, type Track } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'
import { flatten } from './curve.js'
import { renderedAncestors } from './geometry.js'
import {
  EffectAnimation,
  EffectStyles,
  decorativeLayer,
  effectOptions,
  effectTarget,
  finiteOption,
  positioned,
  type EffectHost,
  type EffectFrames,
} from './effect.js'

export interface WebTextOptions {
  by?: 'letter' | 'word'
  duration?: number
  stagger?: number
  delay?: number
  y?: number
}
export interface WebRollOptions {
  format?: (value: number) => string
  duration?: number
  bounce?: number
  stagger?: number
  delay?: number
  direction?: 'auto' | 'up' | 'down'
  tabular?: boolean
}
type Fragment = { element: HTMLElement; start: number; text: string; group: number }
type Copy = { layer: HTMLElement; fragments: Fragment[]; width: number; height: number }
type Active = { host: EffectHost; animation: EffectAnimation; snapshot(): HTMLElement }
type Pose = {
  element: HTMLElement
  track: Track
  y: (p: number) => number
  opacity: (p: number) => number
}
const active = new WeakMap<HTMLElement, Active>()
const lastValues = new WeakMap<HTMLElement, number>()
const typography = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-kerning',
  'font-feature-settings',
  'font-variation-settings',
  'font-optical-sizing',
  'font-variant',
  'font-variant-numeric',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-align-last',
  'text-indent',
  'text-transform',
  'text-rendering',
  'white-space',
  'word-break',
  'overflow-wrap',
  'direction',
  'tab-size',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
]

function source(target: HTMLElement, host: EffectHost) {
  const view = effectTarget(target, host)
  const nodes = [...target.childNodes].filter(
    (node) => !(node instanceof view.HTMLElement && node.dataset.joltEffect),
  )
  if (
    nodes.some((node) => node.nodeType !== 3) ||
    nodes.length > 1 ||
    target.isContentEditable ||
    target.matches('input,textarea,select,script,style')
  )
    throw new TypeError(
      'Text effects require a plain-text leaf with at most one Text node; inline markup and editable fields are not supported.',
    )
  const css = view.getComputedStyle(target)
  if (
    css.writingMode !== 'horizontal-tb' ||
    css.display === 'inline' ||
    !target.getClientRects().length
  )
    throw new TypeError(
      'Text effects require a visible horizontal block or inline-block text surface.',
    )
  for (const node of renderedAncestors(target)) {
    const style = view.getComputedStyle(node)
    if (style.transform !== 'none') {
      const matrix = new view.DOMMatrixReadOnly(style.transform)
      if (
        !matrix.is2D ||
        Math.abs(matrix.b) > 1e-6 ||
        Math.abs(matrix.c) > 1e-6 ||
        matrix.a <= 0 ||
        matrix.d <= 0
      )
        throw new TypeError('Text effects support positive axis-aligned transforms.')
    }
  }
  const old = active.get(target)
  if (old && old.host.identity !== host.identity)
    throw new Error('Text belongs to another motion context.')
  const text = (nodes[0] as Text | undefined)?.data ?? ''
  if (graphemes(text).length > MAX_TEXT_GRAPHEMES)
    throw new RangeError('Text effects support at most 256 graphemes.')
  return { view, css, node: nodes[0] as Text | undefined, text, old }
}

/** Each piece clips a complete shaped copy, preserving ligatures, bidi and line wrapping. */
function copy(
  target: HTMLElement,
  text: string,
  node: Text | undefined,
  parts: Piece[],
  host: EffectHost,
): Copy {
  const view = host.document.defaultView!,
    css = view.getComputedStyle(target)
  const width = target.clientWidth,
    height = target.clientHeight
  const bounds = target.getBoundingClientRect()
  const sx = bounds.width / target.offsetWidth || 1,
    sy = bounds.height / target.offsetHeight || 1
  const left = bounds.left + target.clientLeft * sx,
    top = bounds.top + target.clientTop * sy
  const layer = decorativeLayer(target, 'text')
  layer.style.overflow = 'visible'
  layer.style.width = `${width}px`
  layer.style.height = `${height}px`
  const fragments: Fragment[] = []
  if (!node) return { layer, fragments, width, height }
  const range = host.document.createRange()
  for (const piece of parts) {
    if (!isVisiblePiece(piece)) continue
    range.setStart(node, piece.start)
    range.setEnd(node, piece.end)
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue
      const x = (rect.left - left) / sx + target.scrollLeft,
        y = (rect.top - top) / sy + target.scrollTop
      const element = host.document.createElement('span')
      element.textContent = text
      element.style.cssText = `display:block;position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;user-select:none;width:${width}px;height:${height}px;margin:0;border:0;`
      for (const property of typography)
        element.style.setProperty(property, css.getPropertyValue(property))
      element.style.color = css.color
      element.style.webkitTextFillColor = css.webkitTextFillColor
      element.style.textShadow = css.textShadow
      element.style.textDecoration = css.textDecoration
      element.style.clipPath = `inset(${y}px ${width - x - rect.width / sx}px ${height - y - rect.height / sy}px ${x}px)`
      layer.append(element)
      fragments.push({
        element,
        start: piece.start,
        text: piece.text,
        group: piece.group,
      })
    }
  }
  return { layer, fragments, width, height }
}

function playback(
  target: HTMLElement,
  expected: string,
  layers: HTMLElement[],
  poses: Pose[],
  duration: number,
  host: EffectHost,
  extraStyles?: EffectStyles,
) {
  const view = effectTarget(target, host),
    styles = new EffectStyles(target)
  const off: (() => void)[] = []
  let animation: EffectAnimation | undefined
  let entry: Active | undefined
  const finish = () => {
    for (const cleanup of off.splice(0).reverse()) cleanup()
    for (const layer of layers) layer.remove()
    styles.restore()
    extraStyles?.restore()
    if (active.get(target) === entry) active.delete(target)
  }
  try {
    off.push(positioned(target))
    const width = target.clientWidth,
      height = target.clientHeight
    const font = view.getComputedStyle(target).font
    for (const layer of layers) target.append(layer)
    styles.set('color', 'transparent')
    styles.set('-webkit-text-fill-color', 'transparent')
    styles.set('text-shadow', 'none')
    const frames: EffectFrames[] = poses.map((pose) => {
      const points = flatten(pose.track, host.maxKeyframes)
      const samples = points.map((point) => ({
        offset: duration ? point.time / duration : 1,
        transform: `translateY(${pose.y(point.value)}px)`,
        opacity: pose.opacity(point.value),
      }))
      if (duration && pose.track.end < duration)
        samples.push({ ...samples.at(-1)!, offset: 1 })
      return { target: pose.element, frames: samples }
    })
    animation = new EffectAnimation(host, duration, frames, undefined, finish)
    entry = {
      host,
      animation,
      snapshot() {
        const container = decorativeLayer(target, 'text-snapshot')
        container.style.overflow = 'visible'
        // Flatten the current compositor pose. Repeated retargets must not nest
        // whole snapshots or grow without a bound while the clock is paused.
        let count = 0
        const visit = (element: HTMLElement, offset: number, alpha: number) => {
          const css = view.getComputedStyle(element)
          const matrix =
            css.transform === 'none'
              ? undefined
              : new view.DOMMatrixReadOnly(css.transform)
          const y = offset + (matrix?.m42 ?? 0),
            opacity = alpha * Number(css.opacity)
          if (opacity < 0.001) return
          if (element.children.length) {
            for (const child of element.children) visit(child as HTMLElement, y, opacity)
          } else if (element.textContent) {
            if (++count > 2048)
              throw new RangeError(
                'Rolling presentation exceeds the 2048 fragment retarget budget; finish the current animation first.',
              )
            const clone = element.cloneNode(true) as HTMLElement
            clone.style.transform = `translateY(${y}px)`
            clone.style.opacity = String(opacity)
            container.append(clone)
          }
        }
        for (const layer of layers) {
          visit(layer, 0, 1)
        }
        return container
      },
    }
    active.set(target, entry)
    const refresh = () => {
      const text = [...target.childNodes]
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent)
        .join('')
      if (
        !target.isConnected ||
        target.ownerDocument !== host.document ||
        text !== expected ||
        !styles.owns() ||
        target.clientWidth !== width ||
        target.clientHeight !== height ||
        view.getComputedStyle(target).font !== font
      )
        animation?.stop()
    }
    off.push(host.register(target, animation, refresh))
    const mutation = new view.MutationObserver(refresh)
    mutation.observe(target, { characterData: true, childList: true, subtree: true })
    const resize = new view.ResizeObserver(refresh)
    resize.observe(target)
    off.push(
      () => mutation.disconnect(),
      () => resize.disconnect(),
    )
    return animation
  } catch (error) {
    animation?.stop()
    finish()
    throw error
  }
}

export function createTextAnimation(
  target: HTMLElement,
  options: WebTextOptions,
  host: EffectHost,
) {
  effectOptions(options, ['by', 'duration', 'stagger', 'delay', 'y'])
  const by = options.by ?? 'letter'
  if (by !== 'letter' && by !== 'word')
    throw new TypeError('Text grouping must be letter or word.')
  const duration = finiteOption(options.duration ?? 400, 'Text duration')
  const stagger = finiteOption(options.stagger ?? 35, 'Text stagger')
  const delay = finiteOption(options.delay ?? 0, 'Text delay')
  const y = options.y ?? 12
  if (!Number.isFinite(y)) throw new TypeError('Text offset must be finite.')
  const initial = source(target, host)
  initial.old?.animation.stop()
  const content = copy(target, initial.text, initial.node, pieces(initial.text, by), host)
  const poses: Pose[] = content.fragments.map((fragment) => ({
    element: fragment.element,
    track: createTrack(
      'x',
      [0, 1],
      resolveTransition(
        {
          duration,
          delay: staggeredStart(fragment.group, stagger, delay),
          ease: 'easeOut',
        },
        'x',
        2,
      ),
      0,
      host.settings(),
    ),
    y: (p) => y * (1 - p),
    opacity: (p) => Math.min(1, Math.max(0, p)),
  }))
  return playback(
    target,
    initial.text,
    [content.layer],
    poses,
    Math.max(0, ...poses.map((p) => p.track.end)),
    host,
  )
}

export function createRoll(
  target: HTMLElement,
  value: number | string,
  options: WebRollOptions,
  host: EffectHost,
) {
  effectOptions(options, [
    'format',
    'duration',
    'bounce',
    'stagger',
    'delay',
    'direction',
    'tabular',
  ])
  const duration = finiteOption(options.duration ?? 600, 'Roll duration', 0, false)
  const stagger = finiteOption(options.stagger ?? 0, 'Roll stagger'),
    delay = finiteOption(options.delay ?? 0, 'Roll delay')
  const bounce = options.bounce ?? 0.2,
    direction = options.direction ?? 'auto'
  if (!Number.isFinite(bounce) || bounce < -1 || bounce > 1)
    throw new RangeError('Roll bounce must be between -1 and 1.')
  if (!['auto', 'up', 'down'].includes(direction))
    throw new TypeError('Unknown roll direction.')
  if (options.format !== undefined && typeof options.format !== 'function')
    throw new TypeError('Roll format must be a function.')
  if (options.tabular !== undefined && typeof options.tabular !== 'boolean')
    throw new TypeError('Roll tabular must be boolean.')
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'number' && !Number.isFinite(value))
  )
    throw new TypeError('Roll value must be finite or a string.')
  const text = typeof value === 'string' ? value : (options.format ?? String)(value)
  if (typeof text !== 'string' || graphemes(text).length > MAX_TEXT_GRAPHEMES)
    throw new RangeError('Roll formatting must produce at most 256 graphemes.')
  const initial = source(target, host)
  const previous = lastValues.get(target) ?? Number(initial.text)
  const sign =
    direction === 'down' ||
    (direction === 'auto' &&
      typeof value === 'number' &&
      Number.isFinite(previous) &&
      value < previous)
      ? -1
      : 1
  const snapshot = initial.old?.snapshot()
  initial.old?.animation.stop()
  const old = copy(
    target,
    initial.text,
    initial.node,
    pieces(initial.text, 'letter'),
    host,
  )
  const tabular = new EffectStyles(target)
  if (options.tabular ?? true) tabular.set('font-variant-numeric', 'tabular-nums')
  // Keep the framework's Text node. Only an initially empty leaf needs a new node.
  const node = initial.node ?? host.document.createTextNode('')
  if (!initial.node) target.append(node)
  node.data = text
  if (typeof value === 'number') lastValues.set(target, value)
  else lastValues.delete(target)
  const next = copy(target, text, node, pieces(text, 'letter'), host)
  const diff = diffFromEnd(initial.text, text)
  const changed = new Map(diff.changes.map((change, i) => [change.next.start, i]))
  const outgoing = new Map<number, number>()
  diff.changes.forEach((change, i) => {
    if (change.previous) outgoing.set(change.previous.start, i)
  })
  diff.removed.forEach((piece, i) => outgoing.set(piece.start, diff.changes.length + i))
  const height =
    parseFloat(initial.css.lineHeight) || parseFloat(initial.css.fontSize) * 1.2
  const poses: Pose[] = []
  const track = (index: number) =>
    createTrack(
      'x',
      [0, 1],
      resolveTransition(
        { duration, bounce, delay: staggeredStart(index, stagger, delay) },
        'x',
        2,
      ),
      0,
      host.settings(),
    )
  for (const fragment of next.fragments) {
    const index = snapshot ? fragment.group : changed.get(fragment.start)
    if (index !== undefined)
      poses.push({
        element: fragment.element,
        track: track(index),
        y: (p) => sign * height * (1 - p),
        opacity: (p) => Math.max(0, Math.min(1, p)),
      })
  }
  if (snapshot) {
    poses.push({
      element: snapshot,
      track: track(0),
      y: (p) => -sign * height * p,
      opacity: (p) => Math.max(0, Math.min(1, 1 - p)),
    })
  } else
    for (const fragment of old.fragments) {
      const index = outgoing.get(fragment.start)
      if (index === undefined) fragment.element.remove()
      else
        poses.push({
          element: fragment.element,
          track: track(index),
          y: (p) => -sign * height * p,
          opacity: (p) => Math.max(0, Math.min(1, 1 - p)),
        })
    }
  return playback(
    target,
    text,
    [next.layer, snapshot ?? old.layer],
    poses,
    Math.max(0, ...poses.map((p) => p.track.end)),
    host,
    tabular,
  )
}
