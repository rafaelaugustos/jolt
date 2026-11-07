import {
  cloneFrame,
  put,
  take,
  projectGradient,
  type GradientFrame,
  type GradientComponent,
} from '../core/gradient.js'
import { createTrack, type Track } from '../core/track.js'
import { resolveTransition } from '../core/transition.js'
import {
  EffectAnimation,
  EffectStyles,
  effectOptions,
  effectOwnership,
  effectTarget,
  type EffectHost,
  type EffectTransition,
} from './effect.js'
import { valuePlan, valueTrack } from './value-playback.js'
import { colorCSS } from './properties.js'
import { linearGradientCSS } from './gradient-css.js'
import { parseColor } from './style.js'
import type { NumericValue, WebReadableValue, WebColorValue } from './value.js'
import type { WebAnimation } from './public.js'
import type { FrameTask } from './scheduler.js'

export type WebGradientType = 'linear' | 'radial' | 'conic'
export interface WebGradientValues {
  colors?: readonly string[]
  stops?: readonly number[]
  angle?: number
  center?: { x?: number; y?: number }
  radius?: number
}
export interface WebGradientBindings {
  colors?: readonly (string | WebColorValue)[]
  stops?: readonly (number | WebReadableValue)[]
  angle?: number | WebReadableValue
  center?: { x?: number | WebReadableValue; y?: number | WebReadableValue }
  radius?: number | WebReadableValue
}
export interface WebGradientOptions extends WebGradientBindings {
  type: WebGradientType
  colors: NonNullable<WebGradientBindings['colors']>
}
export interface WebGradient {
  readonly type: WebGradientType
  readonly disposed: boolean
  readonly suspended: boolean
  animate(values: WebGradientValues, transition?: EffectTransition): WebAnimation
  set(values: WebGradientValues): void
  bind(values: WebGradientBindings): () => void
  stop(): void
  suspend(): void
  resume(): void
  remove(): void
  dispose(): void
}
type Patch = Map<GradientComponent, number | NumericValue>
type Binding = { source: NumericValue; off?: () => void }
type Run = { animation: EffectAnimation; tracks: Map<GradientComponent, Track> }

function patch(
  input: WebGradientBindings,
  count: number,
  host: EffectHost,
  live: boolean,
): Patch {
  const initializing = count === 0
  effectOptions(input, ['colors', 'stops', 'angle', 'center', 'radius'])
  const result: Patch = new Map()
  const add = (key: GradientComponent, value: unknown, color = false) => {
    if (value === undefined) return
    if (value && typeof value === 'object') {
      if (!live) throw new TypeError('Use bind() for gradient motion values.')
      result.set(key, host.value(value, color))
      return
    }
    if (color) {
      if (typeof value !== 'string')
        throw new TypeError('Gradient colors must be CSS colors.')
      result.set(key, parseColor(host.document, value))
      return
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new RangeError('Gradient components must be finite.')
    if (key === 'radius' && value < 0)
      throw new RangeError('Gradient radius must be nonnegative.')
    if (key.startsWith('stop:') && (value < 0 || value > 1))
      throw new RangeError('Gradient stops must be between zero and one.')
    result.set(key, value)
  }
  if (input.colors !== undefined) {
    if (
      !Array.isArray(input.colors) ||
      input.colors.length < 2 ||
      input.colors.length > 8 ||
      (count && input.colors.length !== count)
    )
      throw new RangeError(
        'A gradient requires two to eight colors and keeps its color count.',
      )
    count = input.colors.length
    Array.from(input.colors).forEach((value, i) => {
      if (value === undefined) throw new TypeError('Gradient colors cannot be empty.')
      add(`color:${i}`, value, true)
    })
  }
  if (input.stops !== undefined) {
    if (!Array.isArray(input.stops) || input.stops.length !== count)
      throw new RangeError('Provide one gradient stop per color.')
    Array.from(input.stops).forEach((value, i) => {
      if (value === undefined) throw new TypeError('Gradient stops cannot be empty.')
      add(`stop:${i}`, value)
    })
    if (
      input.stops.every((v) => typeof v === 'number') &&
      input.stops.some((v, i) => i > 0 && v < (input.stops![i - 1] as number))
    )
      throw new RangeError('Gradient stops must be ordered.')
  } else if (initializing && input.colors !== undefined)
    input.colors.forEach((_, i) => result.set(`stop:${i}`, i / (count - 1)))
  add('angle', input.angle)
  if (input.center !== undefined) effectOptions(input.center, ['x', 'y'])
  add('x', input.center?.x)
  add('y', input.center?.y)
  add('radius', input.radius)
  return result
}

export function createGradient(
  target: HTMLElement,
  options: WebGradientOptions,
  host: EffectHost,
): WebGradient {
  effectTarget(target, host)
  effectOptions(options, ['type', 'colors', 'stops', 'angle', 'center', 'radius'])
  if (!['linear', 'radial', 'conic'].includes(options.type))
    throw new TypeError('Unknown gradient type.')
  if (!options.colors) throw new TypeError('Gradient colors are required.')
  const { type, ...values } = options
  const initial = patch(values, 0, host, true)
  return new Gradient(target, type, initial, host)
}

class Gradient implements WebGradient {
  private frame: GradientFrame = {
    colors: [],
    stops: [],
    angle: 180,
    x: 0.5,
    y: 0.5,
    radius: 0.5,
  }
  private bindings = new Map<GradientComponent, Binding>()
  private runs = new Set<Run>()
  private styles: EffectStyles
  private ended = false
  private held = false
  private off: (() => void)[] = []
  private background = ''
  private paintTask: FrameTask = {
    write: () => {
      if (!this.ended) this.paint()
    },
  }
  constructor(
    readonly target: HTMLElement,
    readonly type: WebGradientType,
    initial: Patch,
    readonly host: EffectHost,
  ) {
    const view = effectTarget(target, host)
    this.styles = new EffectStyles(target)
    try {
      this.off.push(effectOwnership(target, 'gradient', host, () => this.dispose()))
      const css = view.getComputedStyle(target)
      this.background = css.backgroundImage
      for (const [name, value] of [
        ['background-size', 'auto'],
        ['background-repeat', 'no-repeat'],
        ['background-position', '0% 0%'],
        ['background-origin', 'padding-box'],
      ] as const)
        this.styles.set(name, `${value}, ${css.getPropertyValue(name)}`)
      this.install(initial)
      this.paint()
      const handle = {
        get disposed() {
          return owner.disposed
        },
        get paused() {
          return owner.suspended
        },
        pause: () => this.suspend(),
        play: () => this.resume(),
        cancel: () => this.stop(),
        dispose: () => this.dispose(),
      }
      const owner = this
      this.off.push(host.register(target, handle, () => this.refresh()))
      this.off.push(
        host.onReduced(() => {
          if (host.reduced()) for (const run of [...this.runs]) run.animation.finish(true)
          this.listen()
        }),
        host.visibility(() => this.listen()),
      )
      const resize = new view.ResizeObserver(() => this.refresh())
      resize.observe(target)
      this.off.push(() => resize.disconnect())
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  get disposed() {
    return this.ended
  }
  get suspended() {
    return this.held
  }
  private assert() {
    if (this.ended) throw new Error('Gradient is disposed.')
    if (!this.target.isConnected || this.target.ownerDocument !== this.host.document) {
      this.dispose()
      throw new Error('Gradient target is detached.')
    }
    if (!this.styles.owns()) {
      this.dispose()
      throw new Error('Application replaced gradient styles.')
    }
  }
  private snapshot() {
    const result = cloneFrame(this.frame)
    for (const run of this.runs)
      for (const [key, track] of run.tracks)
        put(result, key, track.valueAt(run.animation.time()))
    if (!this.held && !this.host.document.hidden)
      for (const [key, binding] of this.bindings)
        if (!this.host.reduced() || key.startsWith('color:'))
          put(result, key, binding.source.get())
    return result
  }
  private paint() {
    if (this.ended) return
    const frame = projectGradient(this.snapshot())
    this.frame = frame
    const stops = frame.colors
      .map((color, i) => `${colorCSS(color)} ${frame.stops[i]! * 100}%`)
      .join(',')
    const center = `${frame.x * 100}% ${frame.y * 100}%`
    const image =
      this.type === 'linear'
        ? linearGradientCSS(frame.angle, frame.colors, frame.stops)
        : this.type === 'conic'
          ? `conic-gradient(from ${frame.angle}deg at ${center},${stops})`
          : `radial-gradient(circle ${Math.max(0.001, Math.min(this.target.clientWidth, this.target.clientHeight) * frame.radius)}px at ${center},${stops})`
    this.styles.set(
      'background-image',
      this.background === 'none' ? image : `${image},${this.background}`,
    )
  }
  private refresh() {
    if (this.ended) return
    if (
      !this.target.isConnected ||
      this.target.ownerDocument !== this.host.document ||
      !this.styles.owns()
    ) {
      this.dispose()
      return
    }
    this.paint()
  }
  private clear(keys: Iterable<GradientComponent>) {
    this.frame = this.snapshot()
    for (const key of keys) {
      this.bindings.get(key)?.off?.()
      this.bindings.delete(key)
      for (const run of [...this.runs]) {
        run.tracks.delete(key)
        if (!run.tracks.size) run.animation.stop()
      }
    }
  }
  private listen() {
    for (const [key, binding] of this.bindings) {
      binding.off?.()
      binding.off = undefined
      if (
        !this.held &&
        !this.host.document.hidden &&
        !binding.source.disposed &&
        (!this.host.reduced() || key.startsWith('color:'))
      )
        binding.off = binding.source.listen(
          () => this.host.scheduler.add(this.paintTask),
          () => {
            put(this.frame, key, binding.source.get())
            binding.off?.()
            if (this.bindings.get(key) === binding) this.bindings.delete(key)
            this.host.scheduler.add(this.paintTask)
          },
        )
    }
    this.host.scheduler.add(this.paintTask)
  }
  private install(values: Patch) {
    this.clear(values.keys())
    const owned = new Map<GradientComponent, Binding>()
    for (const [key, value] of values) {
      put(this.frame, key, typeof value === 'number' ? value : value.get())
      if (typeof value !== 'number') {
        const binding = { source: value }
        this.bindings.set(key, binding)
        owned.set(key, binding)
      }
    }
    this.listen()
    return () => {
      if (this.ended) return
      this.frame = this.snapshot()
      for (const [key, binding] of owned)
        if (this.bindings.get(key) === binding) {
          binding.off?.()
          this.bindings.delete(key)
        }
      this.paint()
    }
  }
  bind(values: WebGradientBindings) {
    this.assert()
    const input = patch(values, this.frame.colors.length, this.host, true)
    const off = this.install(input)
    this.paint()
    return off
  }
  set(values: WebGradientValues) {
    this.assert()
    const input = patch(values, this.frame.colors.length, this.host, false)
    this.install(input)
    this.paint()
  }
  animate(values: WebGradientValues, transition: EffectTransition = {}) {
    this.assert()
    const input = patch(values, this.frame.colors.length, this.host, false)
    const config = valuePlan(transition)
    if (config.layer !== undefined)
      throw new TypeError('Gradients own their own channels.')
    const current = this.snapshot(),
      tracks = new Map<GradientComponent, Track>()
    let duration = 0
    for (const [key, value] of input) {
      const from = take(current, key)
      let velocity = 0
      for (const run of this.runs) {
        const track = run.tracks.get(key)
        if (track) velocity = track.velocityAt(run.animation.time())
      }
      const track = key.startsWith('color:')
        ? createTrack(
            'color',
            [from, value as number],
            resolveTransition(config, 'color', 2),
            0,
            this.host.settings(),
          )
        : valueTrack(value as number, config, from, velocity, this.host.settings())
      if (!Number.isFinite(track.end))
        throw new RangeError('Gradient playback must be finite.')
      tracks.set(key, track)
      duration = Math.max(duration, track.end)
    }
    this.clear(input.keys())
    let run: Run | undefined
    const animation = new EffectAnimation(
      this.host,
      duration,
      [],
      () => this.paint(),
      (completed, time) => {
        if (run) {
          for (const [key, track] of run.tracks)
            put(this.frame, key, completed ? track.to : track.valueAt(time))
          this.runs.delete(run)
        }
        if (!this.ended) this.paint()
      },
    )
    run = { animation, tracks }
    this.runs.add(run)
    if (this.held) animation.pause()
    return animation
  }
  stop() {
    if (this.ended) return
    this.frame = this.snapshot()
    for (const run of [...this.runs]) run.animation.stop()
    for (const binding of this.bindings.values()) binding.off?.()
    this.bindings.clear()
    this.host.scheduler.remove(this.paintTask)
    this.paint()
  }
  suspend() {
    if (this.ended || this.held) return
    this.frame = this.snapshot()
    this.held = true
    for (const run of this.runs) run.animation.pause()
    this.listen()
    this.host.scheduler.remove(this.paintTask)
  }
  resume() {
    if (this.ended || !this.held) return
    this.held = false
    for (const run of this.runs) run.animation.play()
    this.listen()
  }
  remove() {
    this.dispose()
  }
  dispose() {
    if (this.ended) return
    this.ended = true
    for (const run of [...this.runs]) run.animation.stop()
    for (const binding of this.bindings.values()) binding.off?.()
    this.bindings.clear()
    this.host.scheduler.remove(this.paintTask)
    for (const off of this.off.splice(0).reverse()) off()
    this.styles.restore()
  }
}
