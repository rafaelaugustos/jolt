import type { FrameScheduler, FrameTask } from './scheduler.js'
import { DerivedValueNode, NumericValue, type WebReadableValue } from './value.js'
import { numericMap } from '../core/numeric-map.js'
import type { TransformProperty } from './properties.js'
import type { Point } from './curve.js'
import type { WebElementScrollRange } from './scroll-range.js'

export type WebScrollSource = Document | HTMLElement
export interface WebScrollValueOptions {
  /** x grows from inline start (right in RTL); y grows from the top. */
  axis?: 'x' | 'y'
}
export interface WebScrollValue extends WebReadableValue {
  refresh(): void
}
export type WebScrollKeyframes = Partial<
  Record<TransformProperty | 'scale', readonly number[]>
>
export interface WebScrollOptions extends WebScrollValueOptions {
  /** Numeric CSS-pixel offsets, or layout edges updated when the anchor/viewport changes. */
  range: readonly [number, number] | WebElementScrollRange
  /** Force the shared scheduler to validate or select fallback explicitly. */
  execution?: 'auto' | 'scheduler'
  /** Optional strictly increasing normalized offsets, from 0 to 1. */
  times?: readonly number[]
}
export interface WebScrollLink {
  readonly execution: 'scroll-timeline' | 'scheduler' | 'released'
  refresh(): void
  dispose(): void
}

export function scrollAxis(options: WebScrollValueOptions = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== 'axis')
  )
    throw new TypeError('Scroll value options support axis.')
  const axis = options.axis ?? 'y'
  if (axis !== 'x' && axis !== 'y') throw new TypeError('Scroll axis must be x or y.')
  return axis
}
function flow(view: Window & typeof globalThis, element: HTMLElement, axis: 'x' | 'y') {
  const css = view.getComputedStyle(element)
  if (
    css.writingMode !== 'horizontal-tb' ||
    css.flexDirection === (axis === 'x' ? 'row-reverse' : 'column-reverse')
  )
    throw new TypeError(
      'Scroll motion supports ordinary horizontal/vertical flow, not reversed flex or vertical writing modes.',
    )
  return axis === 'x' && css.direction === 'rtl'
}
/** Normalized CSS pixels. A fixed source/axis; replacement uses a new handle. */
export class ScrollValueNode extends NumericValue {
  readonly element: HTMLElement
  private readonly view: Window & typeof globalThis
  private readonly resize: ResizeObserver
  private readonly mutations: MutationObserver
  private readonly flowChanges: MutationObserver
  private rtl = false
  private readonly observed = new Set<Element>()
  private listening = false
  private maximum = 0
  private geometryDirty = true
  private next = 0
  private lastChange = 0
  private readonly task: FrameTask = {
    read: () => {
      this.next = this.readOffset()
    },
    update: (at) => {
      this.updateOffset(this.next, at)
    },
  }
  private readonly enqueue = () => {
    if (!this.ended) this.scheduler.add(this.task)
  }
  private readonly invalidate = () => {
    this.geometryDirty = true
    this.enqueue()
  }
  constructor(
    readonly document: Document,
    readonly source: WebScrollSource,
    readonly axis: 'x' | 'y',
    scheduler: FrameScheduler,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    const view = document.defaultView as Window & typeof globalThis
    const element = source === document ? document.scrollingElement : source
    if (
      !(element instanceof view.HTMLElement) ||
      !element.isConnected ||
      element.ownerDocument !== document
    )
      throw new TypeError(
        'Scroll sources must be the runtime document or a mounted HTMLElement in it.',
      )
    flow(view, element, axis)
    super(scheduler, 0, report, forget)
    this.view = view
    this.element = element
    this.position = this.next = this.readOffset()
    this.resize = new view.ResizeObserver(this.invalidate)
    this.mutations = new view.MutationObserver(() => {
      this.observeContent()
      this.invalidate()
    })
    this.mutations.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    this.flowChanges = new view.MutationObserver(this.invalidate)
    for (
      let ancestor: Element | null = element;
      ancestor;
      ancestor = ancestor.parentElement
    )
      this.flowChanges.observe(ancestor, {
        attributes: true,
        attributeFilter: ['dir', 'class', 'style'],
      })
    this.observeContent()
    view.addEventListener('resize', this.invalidate)
    document.fonts?.addEventListener('loadingdone', this.invalidate)
  }
  private observeContent() {
    const wanted = new Set<Element>([this.element, ...this.element.children])
    for (const node of this.observed)
      if (!wanted.has(node)) {
        this.resize.unobserve(node)
        this.observed.delete(node)
      }
    for (const node of wanted)
      if (!this.observed.has(node)) {
        this.resize.observe(node)
        this.observed.add(node)
      }
  }
  private readOffset() {
    if (!this.element.isConnected || this.element.ownerDocument !== this.document) {
      this.dispose()
      return this.position
    }
    if (this.geometryDirty) {
      this.rtl = flow(this.view, this.element, this.axis)
      this.maximum = Math.max(
        0,
        this.axis === 'x'
          ? this.element.scrollWidth - this.element.clientWidth
          : this.element.scrollHeight - this.element.clientHeight,
      )
      this.geometryDirty = false
    }
    const offset =
      this.axis === 'x'
        ? this.element.scrollLeft * (this.rtl ? -1 : 1)
        : this.element.scrollTop
    return Math.min(this.maximum, Math.max(0, offset))
  }
  private updateOffset(value: number, at: number) {
    if (this.ended) return
    const elapsed = at - this.time
    const speed =
      value === this.position || elapsed <= 0
        ? 0
        : ((value - this.position) * 1000) / elapsed
    this.time = at
    if (value !== this.position) this.lastChange = at
    this.publish(value, speed)
  }
  override get() {
    return this.ended ? this.position : this.readOffset()
  }
  override getVelocity() {
    // Scroll velocity is sampled input, not an analytic browser trajectory.
    return this.ended || this.scheduler.now() - this.lastChange > 100 ? 0 : this.speed
  }
  protected override demandChanged() {
    const needed = this.demanded && !this.ended
    if (needed === this.listening) return
    this.listening = needed
    if (needed) this.source.addEventListener('scroll', this.enqueue, { passive: true })
    else this.source.removeEventListener('scroll', this.enqueue)
  }
  refresh() {
    if (this.ended) return
    this.geometryDirty = true
    this.observeContent()
    this.updateOffset(this.readOffset(), this.scheduler.now())
  }
  override dispose() {
    if (this.ended) return
    this.source.removeEventListener('scroll', this.enqueue)
    this.resize?.disconnect()
    this.mutations?.disconnect()
    this.flowChanges?.disconnect()
    this.observed.clear()
    this.view?.removeEventListener('resize', this.invalidate)
    this.document.fonts?.removeEventListener('loadingdone', this.invalidate)
    this.scheduler.remove(this.task)
    super.dispose()
  }
}

export function scrollPlan(
  frames: WebScrollKeyframes,
  options: WebScrollOptions,
  measured?: readonly [number, number],
) {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((k) => !['range', 'execution', 'times', 'axis'].includes(k))
  )
    throw new TypeError('Scroll options support range, execution, times and axis.')
  const axis = scrollAxis({ axis: options.axis })
  const range = measured ?? options.range
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    range.some((n) => !Number.isFinite(n)) ||
    (!measured && range[0]! < 0) ||
    range[1]! <= range[0]! ||
    range[1]! > 1e9
  )
    throw new RangeError('Scroll range must increase between 0 and 1e9 CSS pixels.')
  if (
    options.execution !== undefined &&
    !['auto', 'scheduler'].includes(options.execution)
  )
    throw new TypeError('Scroll execution must be auto or scheduler.')
  if (!frames || typeof frames !== 'object' || !Object.keys(frames).length)
    throw new TypeError('Scroll playback requires explicit numeric keyframes.')
  const plans = new Map<
    TransformProperty,
    { input: number[]; output: number[]; points: Point[] }
  >()
  for (const [name, output] of Object.entries(frames)) {
    if (
      ![
        'x',
        'y',
        'rotate',
        'rotateX',
        'rotateY',
        'scale',
        'scaleX',
        'scaleY',
        'opacity',
      ].includes(name)
    )
      throw new TypeError('Scroll playback supports 2D transforms and opacity.')
    if (!Array.isArray(output))
      throw new TypeError('Scroll frames must be explicit numeric arrays.')
    const offsets = options.times ?? output.map((_, i) => i / (output.length - 1))
    if (offsets[0] !== 0 || offsets.at(-1) !== 1)
      throw new RangeError('Scroll times must start at 0 and end at 1.')
    numericMap(offsets, output)
    const input = offsets.map((t) => range[0]! + (range[1]! - range[0]!) * t)
    numericMap(input, output)
    for (const property of name === 'scale'
      ? (['scaleX', 'scaleY'] as const)
      : [name as TransformProperty]) {
      if (name === 'scale' && frames[property]) continue
      plans.set(property, {
        input,
        output: [...output],
        points: offsets.map((p, i) => ({ time: p * 1000, value: output[i]! })),
      })
    }
  }
  return {
    plans,
    range: [range[0]!, range[1]!] as const,
    native: options.execution !== 'scheduler',
    axis,
  }
}

export class ScrollLinkedNode extends DerivedValueNode {
  constructor(
    readonly scroll: ScrollValueNode,
    readonly property: TransformProperty,
    public range: readonly [number, number],
    readonly points: Point[],
    readonly native: boolean,
    input: readonly number[],
    output: readonly number[],
    private readonly reduced: () => boolean,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    super(scroll, numericMap(input, output), report, forget)
  }
  get spatiallyReduced() {
    return this.property !== 'opacity' && this.reduced()
  }
  setRange(range: readonly [number, number]) {
    this.range = range
    this.remap(
      numericMap(
        this.points.map(
          (point) => range[0] + ((range[1] - range[0]) * point.time) / 1000,
        ),
        this.points.map((point) => point.value),
      ),
    )
  }
  override get() {
    return !this.disposed && this.spatiallyReduced
      ? this.points.at(-1)!.value
      : super.get()
  }
  override getVelocity() {
    return this.spatiallyReduced ? 0 : super.getVelocity()
  }
}

/** Eligible one-source mappings share the existing ScrollTimeline backend. Algebra stays on the scheduler. */
export interface NativeScrollBinding {
  scroll: ScrollValueNode
  range: readonly [number, number]
  points: Point[]
  property: TransformProperty
  native: boolean
  spatiallyReduced: boolean
  get(): number
}
export function nativeScrollBinding(
  source: NumericValue,
  property: string,
): NativeScrollBinding | undefined {
  if (source instanceof ScrollLinkedNode) return source
  if (
    !(source instanceof DerivedValueNode) ||
    !['x', 'y', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'opacity'].includes(
      property,
    )
  )
    return undefined
  const { source: scroll, map } = source.mapping
  if (!(scroll instanceof ScrollValueNode) || !map.clamp) return undefined
  const start = map.input[0]!,
    end = map.input.at(-1)!
  if (start < 0) return undefined
  return {
    scroll,
    range: [start, end],
    native: true,
    spatiallyReduced: false,
    property: property as TransformProperty,
    points: map.input.map((value, i) => ({
      time: ((value - start) / (end - start)) * 1000,
      value: map.output[i]!,
    })),
    get: () => source.get(),
  }
}
