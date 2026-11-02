import { createTrack, type Track } from '../core/track.js'
import type { Animation } from '../core/playback.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'
import { prepare } from './plan.js'
import type { AnimateOptions, DistributiveOmit, SpringName } from './types.js'
import type { WebBinding } from './value.js'

export type WebSizeValues = Partial<Record<'width' | 'height', number | 'auto'>>
export type WebSizeOptions = DistributiveOmit<
  AnimateOptions,
  | 'relative'
  | 'layer'
  | 'stagger'
  | 'repeat'
  | 'repeatType'
  | 'repeatDelay'
  | 'times'
  | 'easeTrack'
>
export interface WebSizeAnimation extends Animation {
  readonly paused: boolean
  pause(): void
  play(): void
  stop(options?: { restore?: boolean }): void
}
export interface SizeHost {
  scheduler: FrameScheduler
  settings(): { timeScale: number; reducedMotion: boolean }
  geometry(target: HTMLElement): WebBinding
  forget(): void
}
type Axis = 'width' | 'height'
interface Dimension {
  original: string
  priority: string
  written: string
  track?: Track
  start: number
  velocity: number
  value: number
  to?: number
}
const axes = ['width', 'height'] as const
const read = (target: HTMLElement, axis: Axis) => {
  const view = target.ownerDocument.defaultView!
  const parent = target.parentElement && view.getComputedStyle(target.parentElement)
  const main = parent?.flexDirection.startsWith('column') ? 'height' : 'width'
  const flex = parent?.display.includes('flex') && axis === main
  const original = target.style.cssText
  let value: number
  try {
    // Interpolate the preferred CSS size. Reading an already flexed allocation
    // and assigning it as a new basis would apply grow/shrink a second time.
    if (flex) {
      target.style.setProperty('flex-grow', '0', 'important')
      target.style.setProperty('flex-shrink', '0', 'important')
      target.style.setProperty('flex-basis', 'auto', 'important')
    }
    value = parseFloat(view.getComputedStyle(target)[axis])
  } finally {
    if (flex) target.style.cssText = original
  }
  if (!Number.isFinite(value))
    throw new Error(`The ${axis} does not have a measurable layout allocation.`)
  return Math.max(0, value)
}
export function validateSize(
  values: WebSizeValues,
  change: unknown,
  options?: WebSizeOptions | SpringName,
) {
  if (
    !values ||
    typeof values !== 'object' ||
    !Object.keys(values).length ||
    Object.entries(values).some(
      ([key, value]) =>
        !axes.includes(key as Axis) ||
        (value !== 'auto' &&
          (typeof value !== 'number' || !Number.isFinite(value) || value < 0)),
    )
  )
    throw new TypeError('animateSize requires finite nonnegative width/height or auto.')
  if (
    change !== undefined &&
    (typeof change !== 'function' || change.constructor.name === 'AsyncFunction')
  )
    throw new TypeError('The size mutation must be synchronous.')
  if (
    typeof options === 'object' &&
    [
      'relative',
      'layer',
      'stagger',
      'repeat',
      'repeatType',
      'repeatDelay',
      'times',
      'easeTrack',
    ].some((k) => k in options)
  )
    throw new TypeError(
      'Intrinsic size motion uses an interruptible trajectory, not a repeating or seekable timeline.',
    )
  return prepare({ x: [0, 1] }, options, new Map(), 1)[0]![0]!.transition
}

export class SizeOperation implements WebSizeAnimation {
  readonly finished: Promise<boolean>
  private resolve!: (value: boolean) => void
  private reject!: (error: unknown) => void
  private dimensions = new Map<Axis, Dimension>()
  private ended = false
  paused = false
  private at: number
  private held = 0
  private lease?: WebBinding
  private complete = false
  private measured: Partial<Record<Axis, number>> = {}
  private transition: ReturnType<typeof validateSize>
  private task: FrameTask = {
    read: () => {
      try {
        this.measure()
      } catch (error) {
        this.fail(error)
      }
    },
    update: (time) => {
      if (this.ended || this.paused) return false
      this.update(time)
      return !this.complete
    },
    write: () => {
      if (this.ended || this.paused) return
      this.write()
      if (this.complete) this.finish(true)
    },
  }
  constructor(
    private target: HTMLElement,
    private values: WebSizeValues,
    change: (() => void) | undefined,
    options: WebSizeOptions | SpringName | undefined,
    private host: SizeHost,
    previous?: SizeOperation,
  ) {
    this.transition = validateSize(values, change, options)
    this.finished = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    // Mark rejection handled for imperative consumers while keeping await semantics.
    void this.finished.catch(() => {})
    this.at = host.scheduler.now()
    const carried = previous?.handoff()
    for (const axis of axes)
      if (values[axis] !== undefined) {
        const inherited = carried?.get(axis)
        const value = inherited?.value ?? read(target, axis)
        this.dimensions.set(axis, {
          original: inherited?.original ?? target.style.getPropertyValue(axis),
          priority: inherited?.priority ?? target.style.getPropertyPriority(axis),
          written: target.style.getPropertyValue(axis),
          value,
          velocity: inherited?.velocity ?? 0,
          start: this.at,
        })
      }
    try {
      this.lease = host.geometry(target)
      const result = change?.() as unknown
      if (result && typeof (result as PromiseLike<unknown>).then === 'function')
        throw new TypeError('The size mutation must not return a promise.')
      this.write()
      host.scheduler.add(this.task)
    } catch (error) {
      this.fail(error)
      throw error
    }
  }
  private valid() {
    if (!this.target.isConnected) {
      this.finish(false, true)
      return false
    }
    for (const [axis, state] of this.dimensions)
      if (
        this.target.style.getPropertyValue(axis) !== state.written ||
        this.target.style.getPropertyPriority(axis) !== state.priority
      ) {
        this.finish(false, true)
        return false
      }
    return !this.ended
  }
  private measure() {
    if (this.ended || this.paused || !this.valid()) return
    // Probe both destinations together so intrinsic height sees the destination width.
    // Preserve scroll positions if temporary shrinkage clamps an ancestor's offset.
    const scroll: [Element, number, number][] = []
    for (let e: Element | null = this.target.parentElement; e; e = e.parentElement)
      scroll.push([e, e.scrollLeft, e.scrollTop])
    const scrolling = this.target.ownerDocument.scrollingElement
    if (scrolling && !scroll.some(([e]) => e === scrolling))
      scroll.push([scrolling, scrolling.scrollLeft, scrolling.scrollTop])
    try {
      for (const [axis, state] of this.dimensions)
        this.target.style.setProperty(
          axis,
          this.values[axis] === 'auto' ? 'auto' : `${this.values[axis]}px`,
          state.priority,
        )
      for (const axis of this.dimensions.keys())
        this.measured[axis] = read(this.target, axis)
    } finally {
      for (const [axis, state] of this.dimensions)
        this.target.style.setProperty(axis, state.written, state.priority)
      for (const [element, x, y] of scroll) {
        if (element.scrollLeft !== x) element.scrollLeft = x
        if (element.scrollTop !== y) element.scrollTop = y
      }
    }
  }
  private update(time: number) {
    const settings = this.host.settings()
    this.complete = true
    for (const [axis, state] of this.dimensions) {
      const to = this.measured[axis] ?? state.value
      if (!state.track || Math.abs(to - state.to!) > 0.02) {
        if (state.track) {
          state.value = state.track.valueAt(time - state.start)
          state.velocity = state.track.velocityAt(time - state.start)
        }
        const transition = state.track
          ? { ...this.transition, delay: 0 }
          : this.transition
        state.track = createTrack(
          'x',
          [state.value, to],
          transition,
          state.velocity,
          settings,
        )
        state.start = time
        state.to = to
      }
      const elapsed = time - state.start
      state.value = Math.max(0, state.track.valueAt(elapsed))
      state.velocity = state.track.velocityAt(elapsed)
      if (!settings.reducedMotion && elapsed < state.track.end) this.complete = false
      else {
        state.value = to
        state.velocity = 0
      }
    }
  }
  private write() {
    for (const [axis, state] of this.dimensions) {
      this.target.style.setProperty(axis, `${state.value}px`, state.priority)
      state.written = this.target.style.getPropertyValue(axis)
    }
  }
  private finish(completed: boolean, restore = false) {
    if (this.ended) return
    this.ended = true
    this.host.scheduler.remove(this.task)
    for (const [axis, state] of this.dimensions) {
      if (
        this.target.style.getPropertyValue(axis) !== state.written ||
        this.target.style.getPropertyPriority(axis) !== state.priority
      )
        continue
      if (restore) {
        if (state.original)
          this.target.style.setProperty(axis, state.original, state.priority)
        else this.target.style.removeProperty(axis)
      } else if (completed)
        this.target.style.setProperty(
          axis,
          this.values[axis] === 'auto' ? 'auto' : `${this.values[axis]}px`,
          state.priority,
        )
    }
    this.lease?.dispose()
    this.lease = undefined
    this.host.forget()
    this.dimensions.clear()
    this.host = undefined!
    this.target = undefined!
    this.resolve(completed)
  }
  private fail(error: unknown) {
    if (this.ended) return
    // Cleanup first; preserve rejection for errors instead of a false completion.
    const resolve = this.resolve
    this.resolve = () => {}
    this.finish(false, true)
    this.resolve = resolve
    this.reject(error)
  }
  private handoff() {
    const result = new Map<Axis, Dimension>()
    const time = this.host.scheduler.now()
    for (const [axis, state] of this.dimensions)
      result.set(axis, {
        ...state,
        value: this.paused
          ? state.value
          : state.track
            ? Math.max(0, state.track.valueAt(time - state.start))
            : state.value,
        velocity: this.paused
          ? 0
          : (state.track?.velocityAt(time - state.start) ?? state.velocity),
      })
    this.finish(false, true)
    return result
  }
  pause() {
    if (this.ended || this.paused) return
    this.measure()
    if (this.ended) return
    this.update(this.host.scheduler.now())
    this.write()
    this.held = this.host.scheduler.now()
    this.paused = true
    this.host.scheduler.remove(this.task)
  }
  play() {
    if (this.ended || !this.paused) return
    const delta = this.host.scheduler.now() - this.held
    for (const state of this.dimensions.values()) state.start += delta
    this.paused = false
    this.host.scheduler.add(this.task)
  }
  stop(options?: { restore?: boolean }) {
    if (!this.ended && !this.paused && this.valid()) {
      this.measure()
      if (!this.ended) {
        this.update(this.host.scheduler.now())
        this.write()
      }
    }
    this.finish(false, options?.restore ?? false)
  }
  reduced() {
    if (this.ended || !this.host.settings().reducedMotion) return
    const paused = this.paused
    this.paused = false
    this.measure()
    if (!this.ended) {
      this.update(this.host.scheduler.now())
      this.write()
      this.finish(true)
    }
    this.paused = paused
  }
  detach() {
    this.finish(false, true)
  }
  then<A = boolean, B = never>(
    yes?: ((value: boolean) => A | PromiseLike<A>) | null,
    no?: ((error: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(yes, no)
  }
}
