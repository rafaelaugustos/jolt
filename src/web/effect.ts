import { registerPlayback, validateProgress, createClock } from '../core/playback.js'
import type { CompilationSettings } from '../core/track.js'
import type { WebAnimation } from './public.js'
import type { InteractionHost, WebInteraction } from './interaction.js'
import type { FrameTask } from './scheduler.js'

export interface EffectHost extends Pick<
  InteractionHost,
  'scheduler' | 'after' | 'reduced' | 'onReduced' | 'register' | 'error'
> {
  identity: object
  document: Document
  settings(): CompilationSettings
  maxKeyframes: number
  remember(animation: WebAnimation): void
  value(source: object, color: boolean): import('./value.js').NumericValue
  visibility(callback: () => void): () => void
}
export type EffectTransition =
  import('./types.js').Transition | import('./types.js').SpringName
export type Realm = Window & typeof globalThis

export function effectTarget(target: HTMLElement, host: EffectHost) {
  const view = host.document.defaultView as Realm
  if (
    !(target instanceof view.HTMLElement) ||
    target.ownerDocument !== host.document ||
    !target.isConnected
  )
    throw new TypeError(
      'Effects require a mounted HTMLElement in their runtime document.',
    )
  return view
}
export function effectOptions(value: object, allowed: readonly string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new TypeError('Unknown effect option.')
}
export function finiteOption(value: number, name: string, min = 0, inclusive = true) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (inclusive ? value < min : value <= min)
  )
    throw new RangeError(
      `${name} must be finite and ${inclusive ? 'at least' : 'greater than'} ${min}.`,
    )
  return value
}

/** Restore only styles still owned by the effect; external writes always survive. */
export class EffectStyles {
  private held = new Map<string, { before: string; priority: string; written: string }>()
  constructor(readonly target: HTMLElement) {}
  set(name: string, value: string) {
    const style = this.target.style
    let entry = this.held.get(name)
    if (!entry) {
      entry = {
        before: style.getPropertyValue(name),
        priority: style.getPropertyPriority(name),
        written: '',
      }
      this.held.set(name, entry)
    } else if (
      style.getPropertyValue(name) !== entry.written ||
      style.getPropertyPriority(name)
    ) {
      throw new Error(`Application changed the effect-owned ${name}.`)
    }
    style.setProperty(name, value)
    entry.written = style.getPropertyValue(name)
  }
  owns() {
    return [...this.held].every(
      ([name, entry]) =>
        this.target.style.getPropertyValue(name) === entry.written &&
        !this.target.style.getPropertyPriority(name),
    )
  }
  restore() {
    const style = this.target.style
    for (const [name, entry] of this.held) {
      if (
        style.getPropertyValue(name) !== entry.written ||
        style.getPropertyPriority(name)
      )
        continue
      if (entry.before) style.setProperty(name, entry.before, entry.priority)
      else style.removeProperty(name)
    }
    this.held.clear()
  }
}

const owners = new WeakMap<
  HTMLElement,
  Map<string, { host: EffectHost; dispose(): void }>
>()
/** One rendering owner per kind, including across otherwise independent runtimes. */
export function effectOwnership(
  target: HTMLElement,
  kind: string,
  host: EffectHost,
  dispose: () => void,
) {
  const slots = owners.get(target) ?? new Map()
  const previous = slots.get(kind)
  if (previous && previous.host.identity !== host.identity)
    throw new Error('Effect target belongs to another motion context.')
  previous?.dispose()
  const entry = { host, dispose }
  slots.set(kind, entry)
  owners.set(target, slots)
  return () => {
    if (slots.get(kind) === entry) slots.delete(kind)
    if (!slots.size) owners.delete(target)
  }
}

export interface EffectFrames {
  target: Element
  frames: Keyframe[]
}
/** WAAPI plays finite visual layers. A painter opts into the existing context clock. */
export class EffectAnimation implements WebAnimation, WebInteraction {
  readonly ready = Promise.resolve()
  readonly finished: Promise<boolean>
  private resolve!: (completed: boolean) => void
  private clock
  private effects: globalThis.Animation[] = []
  private ended = false
  private held = false
  private completed = false
  private notify: () => void
  private unlisten: (() => void)[] = []
  private cancelTimer?: () => void
  private task: FrameTask = {
    write: () => this.paint(),
    update: () => !this.ended && !this.held,
  }
  constructor(
    readonly host: EffectHost,
    readonly duration: number,
    frames: readonly EffectFrames[],
    private readonly render: ((elapsed: number) => void) | undefined,
    private readonly settle: (completed: boolean, elapsed: number) => void,
    private readonly terminalTime = duration,
  ) {
    if (duration !== Infinity) finiteOption(duration, 'Effect duration')
    finiteOption(terminalTime, 'Effect terminal time')
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.clock = createClock(() => host.scheduler.now())
    this.notify = registerPlayback(this, () => ({
      time: this.time(),
      duration,
      paused: this.held,
      ready: true,
      settled: this.ended,
      completed: this.completed,
    }))
    try {
      for (const item of frames) {
        const effect = item.target.animate(item.frames, {
          duration,
          fill: 'both',
          easing: 'linear',
        })
        effect.pause()
        effect.currentTime = 0
        this.effects.push(effect)
      }
      this.unlisten.push(host.visibility(() => this.sync()))
      this.unlisten.push(
        host.onReduced(() => {
          if (host.reduced()) this.finish(true)
        }),
      )
      host.remember(this)
      this.paint()
      this.sync()
      // Let the caller install its owner before an immediate completion releases it.
      queueMicrotask(() => {
        if (!this.ended && (!duration || host.reduced())) this.finish(true)
      })
    } catch (error) {
      this.finish(false)
      throw error
    }
  }
  get paused() {
    return this.held
  }
  get disposed() {
    return this.ended
  }
  time() {
    return Math.min(this.duration, Math.max(0, this.clock.time()))
  }
  get progress() {
    if (!Number.isFinite(this.duration))
      throw new RangeError('Progress requires a finite animation.')
    return this.duration ? this.time() / this.duration : 1
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    if (this.ended) return
    this.clock.seek(value * this.duration)
    this.paint()
    this.sync()
    this.notify()
    if (value === 1) this.finish(true)
  }
  pause() {
    if (this.ended || this.held) return
    this.clock.pause()
    this.held = true
    this.paint()
    this.sync()
    this.notify()
  }
  play() {
    if (this.ended || !this.held) return
    this.held = false
    this.clock.play()
    this.sync()
    this.notify()
  }
  private paint() {
    if (this.ended) return
    try {
      this.render?.(this.time())
    } catch (error) {
      this.finish(false)
      throw error
    }
  }
  private sync() {
    this.cancelTimer?.()
    this.cancelTimer = undefined
    this.host.scheduler.remove(this.task)
    if (this.ended) return
    for (const effect of this.effects) {
      effect.pause()
      effect.currentTime = this.time()
      if (!this.held && !this.host.document.hidden) effect.play()
    }
    if (!this.held) {
      if (this.render) this.host.scheduler.add(this.task)
      if (Number.isFinite(this.duration))
        this.cancelTimer = this.host.after(Math.max(0, this.duration - this.time()), () =>
          this.finish(true),
        )
    }
  }
  finish(completed: boolean) {
    if (this.ended) return
    const time = completed ? this.terminalTime : this.time()
    this.clock.seek(time)
    this.clock.cancel()
    this.ended = true
    this.completed = completed
    this.cancelTimer?.()
    this.host.scheduler.remove(this.task)
    for (const unlisten of this.unlisten) unlisten()
    for (const effect of this.effects) effect.cancel()
    this.effects = []
    try {
      this.settle(completed, time)
    } finally {
      this.resolve(completed)
      this.notify()
    }
  }
  stop() {
    this.finish(false)
  }
  cancel() {
    this.stop()
  }
  dispose() {
    this.stop()
  }
  then<TResult1 = boolean, TResult2 = never>(
    fulfilled?: ((value: boolean) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.finished.then(fulfilled, rejected)
  }
}

/** Overlay children never participate in layout, hit testing, or the accessibility tree. */
export function decorativeLayer(target: HTMLElement, name: string) {
  const element = target.ownerDocument.createElement('span')
  element.dataset.joltEffect = name
  element.setAttribute('aria-hidden', 'true')
  element.setAttribute('inert', '')
  element.style.cssText =
    'position:absolute;inset:0;pointer-events:none;user-select:none;border-radius:inherit;overflow:hidden;'
  return element
}

const positions = new WeakMap<HTMLElement, { count: number; styles: EffectStyles }>()
export function positioned(target: HTMLElement) {
  let entry = positions.get(target)
  if (!entry) {
    entry = { count: 0, styles: new EffectStyles(target) }
    if (target.ownerDocument.defaultView!.getComputedStyle(target).position === 'static')
      entry.styles.set('position', 'relative')
    positions.set(target, entry)
  }
  entry.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (!--entry.count) {
      entry.styles.restore()
      positions.delete(target)
    }
  }
}
