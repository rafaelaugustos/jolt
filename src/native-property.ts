import { isAndroid, Trace } from '@nativescript/core'
import { reducedMotion } from './config.js'
import type { DerivedValue } from './motion-value.js'
import { valuePlayback } from './motion-value.js'
import type { PlaybackAnimation } from './playback.js'
import { TimedAnimation } from './timed-animation.js'
import { createTrack, instantTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from './transition.js'
import {
  nativePropertyDriver,
  type NativeSink,
  type NativePlayer,
} from './native-property-driver.js'

export interface NativePropertyDefinition<T> {
  /** Namespaced identity, e.g. 'acme.chart/reveal'. One registration per name. */
  readonly name: string
  readonly units: readonly string[]
  readonly platforms: readonly ('ios' | 'android')[]
  /** Spatial properties jump to their destination under reduced motion. */
  readonly spatial?: boolean
  encode(value: T): readonly number[]
  decode(value: readonly number[]): T
  /** Called once per sampled keyframe in JS, never per native frame. */
  interpolate?(from: T, to: T, fraction: number): T
  validate?(value: T): void
  /** Must return a compiled native sink, not a JavaScript implementation of its methods. */
  create(target: object): NativeSink
}

export interface NativeProperty<T> {
  readonly name: string
  get(): T
  set(value: T): void
  animate(to: T, options?: Transition | SpringName): PlaybackAnimation
  /** Sample a pure mapping at setup/boundaries, then write the property entirely in native code. */
  bind(value: DerivedValue, map: (value: number) => T): () => void
  stop(): void
  /** Release this owner's native resources. Call before destroying the SDK target. */
  dispose(): void
}

interface Owner {
  stop(): void
  velocity(): readonly number[]
}
const definitions = new Set<string>()
const owners = new WeakMap<object, Map<string, Owner>>()

/** Optional plugin registry. No SDK is loaded until its adapter creates a target. */
export function registerNativeProperty<T>(
  definition: NativePropertyDefinition<T>,
): (target: object) => NativeProperty<T> {
  validateDefinition(definition)
  if (definitions.has(definition.name))
    throw new Error(`Native property "${definition.name}" is already registered.`)
  definitions.add(definition.name)
  return (target) => new PropertyTarget(target, definition)
}

function validateDefinition<T>(definition: NativePropertyDefinition<T>) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(definition.name))
    throw new TypeError('Native property names must be namespaced: plugin/property.')
  if (
    !definition.units.length ||
    definition.units.some((unit) => typeof unit !== 'string' || !unit)
  )
    throw new TypeError('Describe the units of every native property component.')
  if (
    !definition.platforms.length ||
    definition.platforms.some((p) => p !== 'ios' && p !== 'android')
  )
    throw new TypeError('Declare supported native platforms.')
  if (
    typeof definition.create !== 'function' ||
    typeof definition.encode !== 'function' ||
    typeof definition.decode !== 'function'
  )
    throw new TypeError('A native property needs create(), encode() and decode().')
}

/** Internal factory for per-target schemas; identity still shares the registry ownership map. */
export function nativePropertyTarget<T>(
  target: object,
  definition: NativePropertyDefinition<T>,
): NativeProperty<T> {
  validateDefinition(definition)
  return new PropertyTarget(target, definition)
}

class PropertyTarget<T> implements NativeProperty<T> {
  private readonly sink: NativeSink
  private readonly owned = new Set<Owner>()
  private disposed = false
  readonly name: string
  constructor(
    private target: object | undefined,
    private readonly definition: NativePropertyDefinition<T>,
  ) {
    this.name = definition.name
    if (!target || (typeof target !== 'object' && typeof target !== 'function'))
      throw new TypeError('A native property needs a native target.')
    const platform = isAndroid ? 'android' : 'ios'
    if (!definition.platforms.includes(platform))
      throw new Error(`${this.name} is unavailable on ${platform}.`)
    const driver = nativePropertyDriver()
    this.sink = definition.create(target)
    try {
      driver.validate(this.sink, definition.units.length)
    } catch (error) {
      try {
        driver.dispose(this.sink)
      } catch {}
      throw error
    }
  }
  private alive() {
    if (this.disposed) throw new Error(`${this.name} has been disposed.`)
    if (!nativePropertyDriver().alive(this.sink))
      throw new Error(`${this.name} has lost its native target.`)
  }
  private vector(value: T): readonly number[] {
    this.definition.validate?.(value)
    const numbers = [...this.definition.encode(value)]
    if (
      numbers.length !== this.definition.units.length ||
      numbers.some((n) => !Number.isFinite(n))
    )
      throw new TypeError(
        `${this.name} expects ${this.definition.units.length} finite components.`,
      )
    return numbers
  }
  get(): T {
    this.alive()
    return this.definition.decode(nativePropertyDriver().read(this.sink))
  }
  set(value: T) {
    this.alive()
    const vector = this.vector(value)
    this.owner()?.stop()
    nativePropertyDriver().write(this.sink, vector)
  }
  private owner() {
    return this.target ? owners.get(this.target)?.get(this.name) : undefined
  }
  private claim(owner: Owner) {
    this.owner()?.stop()
    let map = owners.get(this.target!)
    if (!map) owners.set(this.target!, (map = new Map()))
    map.set(this.name, owner)
    this.owned.add(owner)
  }
  private release(owner: Owner) {
    if (this.target && this.owner() === owner) owners.get(this.target)?.delete(this.name)
    this.owned.delete(owner)
  }
  animate(to: T, options: Transition | SpringName = {}): PlaybackAnimation {
    this.alive()
    const from = this.get(),
      first = this.vector(from),
      last = this.vector(to)
    if (typeof options === 'object' && 'layer' in options)
      throw new TypeError(
        'Native property adapters do not support layers; bind a layered scalar value instead.',
      )
    if (typeof options === 'string' && !Object.hasOwn(springs, options))
      throw new TypeError(`Unknown spring "${options}".`)
    const transition = resolveTransition(
      typeof options === 'string' ? springs[options] : options,
      'opacity',
      2,
    )
    const velocity = this.owner()?.velocity()
    const delta = last.map((v, i) => v - first[i]!)
    const length = delta.reduce((s, v) => s + v * v, 0)
    const speed =
      length && velocity
        ? delta.reduce((s, v, i) => s + v * (velocity[i] ?? 0), 0) / length
        : 0
    const track = dense(
      this.definition.spatial && reducedMotion()
        ? instantTrack('opacity', 1)
        : createTrack('opacity', [0, 1], transition, speed),
    )
    const at = (fraction: number) =>
      this.vector(
        this.definition.interpolate
          ? this.definition.interpolate(from, to, fraction)
          : this.definition.decode(first.map((v, i) => v + delta[i]! * fraction)),
      )
    const samples = track.values.map(at)
    const final = at(track.to)
    let player: NativePlayer | undefined
    const animation = new TimedAnimation(
      track.end,
      track.arrival,
      (time, paused) => {
        player?.control(time, paused)
      },
      (completed) => {
        try {
          if (completed && nativePropertyDriver().alive(this.sink))
            nativePropertyDriver().write(this.sink, final)
        } finally {
          player?.cancel()
          player = undefined
          this.release(owner)
        }
      },
    )
    const owner: Owner = {
      stop: () => animation.stop(),
      velocity: () =>
        animation.paused
          ? first.map(() => 0)
          : at(track.valueAt(animation.time + 0.5)).map(
              (v, i) => (v - at(track.valueAt(animation.time - 0.5))[i]!) * 1000,
            ),
    }
    this.claim(owner)
    try {
      if (track.end > 0) {
        player = nativePropertyDriver().play(
          this.sink,
          track,
          samples,
          final,
          (completed) => {
            if (!completed) animation.stop()
          },
        )
        if (animation.done) {
          player.cancel()
          player = undefined
        } else player.control(animation.time, false)
      }
      animation.start()
    } catch (error) {
      animation.stop()
      throw error
    }
    return animation
  }
  bind(value: DerivedValue, map: (value: number) => T): () => void {
    this.alive()
    if (typeof map !== 'function')
      throw new TypeError('A native binding needs a pure value mapping.')
    const source = valuePlayback(value)
    let player: NativePlayer | undefined
    let off = () => {}
    let stopped = false
    const prepare = () => {
      const state = source.snapshot()
      state.track = dense(state.track)
      const spatial = this.definition.spatial && reducedMotion()
      const samples = state.track.values.map((v) => this.vector(map(v)))
      const current = this.vector(map(spatial ? state.track.to : state.value))
      const final = this.vector(map(state.track.to))
      return { ...state, samples, current, final, running: state.running && !spatial }
    }
    const initial = prepare() // Validate all samples before interrupting another owner.
    const owner: Owner = {
      stop: () => {
        if (stopped) return
        stopped = true
        off()
        player?.cancel()
        player = undefined
        this.release(owner)
      },
      velocity: () => this.definition.units.map(() => 0),
    }
    const apply = (state: ReturnType<typeof prepare>) => {
      player?.cancel()
      player = undefined
      if (!state.running) nativePropertyDriver().write(this.sink, state.current)
      else {
        player = nativePropertyDriver().play(
          this.sink,
          state.track,
          state.samples,
          state.final,
          (completed) => {
            if (!completed) owner.stop()
          },
        )
        if (stopped) {
          player.cancel()
          player = undefined
        } else player.control(source.snapshot().elapsed, state.paused)
      }
    }
    this.claim(owner)
    try {
      off = source.subscribe(() => {
        if (stopped) return
        try {
          this.alive()
          apply(prepare())
        } catch (error) {
          owner.stop()
          Trace.write(
            `Jolt native binding failed: ${String(error)}`,
            Trace.categories.Error,
            Trace.messageType.error,
          )
        }
      })
      apply(initial)
    } catch (error) {
      owner.stop()
      throw error
    }
    return owner.stop
  }
  stop() {
    for (const owner of [...this.owned]) owner.stop()
  }
  dispose() {
    if (this.disposed) return
    this.stop()
    this.disposed = true
    nativePropertyDriver().dispose(this.sink)
    this.target = undefined
  }
}

/** Reusable conformance checks for setup/command behavior; frame/lifecycle checks require a native app. */
export function checkNativeProperty<T>(property: NativeProperty<T>, value: T) {
  const previous = property.get()
  try {
    property.set(value)
    return property.get()
  } finally {
    property.set(previous)
  }
}

/** Uniform samples also capture nonlinear compound interpolation and pure binding maps. */
function dense(track: Track): Track {
  if (track.duration === 0) return track
  const count = Math.max(1, Math.min(6000, Math.ceil((track.duration * 60) / 1000)))
  const times = [
    ...new Set([
      ...track.times,
      ...Array.from({ length: count + 1 }, (_, i) => i / count),
    ]),
  ].sort((a, b) => a - b)
  return {
    ...track,
    times,
    values: times.map((time) =>
      time === 1
        ? track.values.at(-1)!
        : time === 0
          ? track.values[0]!
          : track.valueAt(track.delay + time * track.duration),
    ),
  }
}
