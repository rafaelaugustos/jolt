import type { FrameScheduler, FrameTask } from './scheduler.js'
import { DerivedValueNode, NumericValue, type WebReadableValue } from './value.js'
import { numericMap } from '../core/numeric-map.js'
import type { TransformProperty } from './properties.js'
import type { Point } from './curve.js'

export type WebScrollSource = Document | HTMLElement
export interface WebScrollValue extends WebReadableValue {
  refresh(): void
}
export type WebScrollKeyframes = Partial<
  Record<TransformProperty | 'scale', readonly number[]>
>
export interface WebScrollOptions {
  /** An increasing range of vertical CSS-pixel offsets. */
  range: readonly [number, number]
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

/** Vertical CSS pixels. A fixed source; replacement uses a new value/handle. */
export class ScrollValueNode extends NumericValue {
  readonly element: HTMLElement
  private readonly view: Window & typeof globalThis
  private readonly resize: ResizeObserver
  private readonly mutations: MutationObserver
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
    const css = view.getComputedStyle(element)
    if (css.writingMode !== 'horizontal-tb' || css.flexDirection === 'column-reverse')
      throw new TypeError(
        'Scroll motion supports ordinary vertical flow, not reversed or vertical writing modes.',
      )
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
      this.maximum = Math.max(0, this.element.scrollHeight - this.element.clientHeight)
      this.geometryDirty = false
    }
    return Math.min(this.maximum, Math.max(0, this.element.scrollTop))
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
    this.observed.clear()
    this.view?.removeEventListener('resize', this.invalidate)
    this.document.fonts?.removeEventListener('loadingdone', this.invalidate)
    this.scheduler.remove(this.task)
    super.dispose()
  }
}

export function scrollPlan(frames: WebScrollKeyframes, options: WebScrollOptions) {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((k) => !['range', 'execution', 'times'].includes(k))
  )
    throw new TypeError('Scroll options support range, execution and times.')
  const range = options.range
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    range.some((n) => !Number.isFinite(n)) ||
    range[0]! < 0 ||
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
    if (!['x', 'y', 'rotate', 'scale', 'scaleX', 'scaleY', 'opacity'].includes(name))
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
  }
}

export class ScrollLinkedNode extends DerivedValueNode {
  constructor(
    readonly scroll: ScrollValueNode,
    readonly property: TransformProperty,
    readonly range: readonly [number, number],
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
  override get() {
    return !this.disposed && this.spatiallyReduced
      ? this.points.at(-1)!.value
      : super.get()
  }
  override getVelocity() {
    return this.spatiallyReduced ? 0 : super.getVelocity()
  }
}
