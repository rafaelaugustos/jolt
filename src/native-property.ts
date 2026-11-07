import {
  adapterEvent,
  adapterMeasure,
  registerAdapterInspection,
  type AdapterEventKind,
} from './core/adapter-inspection.js'
import { isAndroid, Trace } from '@nativescript/core'
import {
  propertyLimits,
  checkPropertySamples,
  checkPropertyGroupSamples,
} from './core/property-limits.js'
import { onReducedMotion, reducedMotion } from './config.js'
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
  handle?: PlaybackAnimation
  binding?: boolean
  stop(): void
  velocity(): readonly number[]
}
interface PreparedProperty {
  write(value: readonly number[]): void
  event(kind: AdapterEventKind, owner?: object): void
  spatial: boolean
  sink: NativeSink
  track: Track
  samples: readonly (readonly number[])[]
  final: readonly number[]
  velocity(time: number): readonly number[]
  claim(owner: Owner): void
  release(owner: Owner): void
  alive(): void
}
const internals = new WeakMap<
  object,
  {
    target: object
    name: string
    prepare(value: unknown, options: Transition | SpringName): PreparedProperty
    prepareSet(value: unknown): { commit(): void; rollback(): void }
  }
>()
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
    definition.units.length > propertyLimits.components ||
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
    registerAdapterInspection(this, {
      name: this.name,
      units: [...definition.units],
      target,
      platform,
      read: () => {
        const owner = this.owner()
        return {
          alive: !this.disposed && nativePropertyDriver().alive(this.sink),
          values: this.disposed ? null : nativePropertyDriver().read(this.sink),
          owner: owner?.handle ?? owner,
          binding: !!owner?.binding,
          paused: owner?.handle?.paused,
        }
      },
    })
    internals.set(this, {
      target,
      name: this.name,
      prepare: (value, options) => this.prepare(value as T, options),
      prepareSet: (value) => {
        this.alive()
        const next = this.vector(value as T),
          previous = nativePropertyDriver().read(this.sink)
        return {
          commit: () => {
            this.alive()
            this.owner()?.stop()
            this.write(next)
          },
          rollback: () => {
            if (nativePropertyDriver().alive(this.sink)) this.write(previous)
          },
        }
      },
    })
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
    this.write(vector)
  }
  private write(value: readonly number[]) {
    const measured = adapterMeasure(this, 'write')
    try {
      nativePropertyDriver().write(this.sink, value)
    } finally {
      measured?.()
    }
  }
  private owner() {
    return this.target ? owners.get(this.target)?.get(this.name) : undefined
  }
  private claim(owner: Owner) {
    const previous = this.owner()
    previous?.stop()
    adapterEvent(
      this,
      previous ? 'replace' : owner.binding ? 'bind' : 'start',
      owner.handle ?? owner,
      previous?.handle ?? previous,
    )
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
    return playProperties([this.prepare(to, options)])
  }
  private prepare(to: T, options: Transition | SpringName): PreparedProperty {
    const measured = adapterMeasure(this, 'prepare')
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
    checkPropertySamples(track.values.length, first.length)
    const samples = track.values.map(at)
    const final = at(track.to)
    measured?.(samples.length * first.length)
    return {
      write: (value) => this.write(value),
      event: (kind, owner) => adapterEvent(this, kind, owner),
      sink: this.sink,
      track,
      samples,
      final,
      spatial: !!this.definition.spatial,
      velocity: (time) =>
        at(track.valueAt(time + 0.5)).map(
          (v, i) => (v - at(track.valueAt(time - 0.5))[i]!) * 1000,
        ),
      claim: (owner) => this.claim(owner),
      release: (owner) => this.release(owner),
      alive: () => this.alive(),
    }
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
      checkPropertySamples(state.track.values.length, this.definition.units.length)
      const spatial = this.definition.spatial && reducedMotion()
      const samples = state.track.values.map((v) => this.vector(map(v)))
      const current = this.vector(map(spatial ? state.track.to : state.value))
      const final = this.vector(map(state.track.to))
      return { ...state, samples, current, final, running: state.running && !spatial }
    }
    const initial = prepare() // Validate all samples before interrupting another owner.
    const owner: Owner = {
      binding: true,
      stop: () => {
        if (stopped) return
        stopped = true
        off()
        player?.cancel()
        player = undefined
        adapterEvent(this, 'cancel', owner)
        this.release(owner)
      },
      velocity: () => this.definition.units.map(() => 0),
    }
    const apply = (state: ReturnType<typeof prepare>) => {
      player?.cancel()
      player = undefined
      if (!state.running) this.write(state.current)
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
    adapterEvent(this, 'dispose')
    internals.delete(this)
    nativePropertyDriver().dispose(this.sink)
    this.target = undefined
  }
}

/** All members have been validated/sampled before the first ownership change.
 * One Jolt clock controls all native players. Cross-renderer GPU atomicity is not implied. */
function playProperties(plans: PreparedProperty[]): PlaybackAnimation {
  plans.forEach((plan) => plan.alive())
  const players: (NativePlayer | undefined)[] = []
  const claimed = new Set<number>()
  let offReduced = () => {}
  const duration = Math.max(...plans.map((plan) => plan.track.end))
  const animation = new TimedAnimation(
    duration,
    Math.max(...plans.map((plan) => plan.track.arrival)),
    (time, paused, command) => {
      try {
        plans.forEach((plan) => plan.event(command, animation))
        players.forEach((player) => player?.control(time, paused))
      } catch (error) {
        animation.stop()
        throw error
      }
    },
    (completed) => {
      offReduced()
      const errors: unknown[] = []
      plans.forEach((plan, i) => {
        try {
          if (completed) {
            plan.alive()
            plan.write(plan.final)
          }
        } catch (error) {
          errors.push(error)
        } finally {
          try {
            players[i]?.cancel()
          } catch (error) {
            errors.push(error)
          }
          if (claimed.has(i)) {
            plan.event(completed ? 'complete' : 'cancel', animation)
            plan.release(owners[i]!)
          }
        }
      })
      players.length = 0
      plans = []
      owners.length = 0
      claimed.clear()
      if (errors.length)
        throw new AggregateError(errors, 'Property group cleanup failed.')
    },
  )
  const owners = plans.map((plan): Owner => ({
    handle: animation,
    stop: () => animation.stop(),
    velocity: () =>
      animation.paused ? plan.final.map(() => 0) : plan.velocity(animation.time),
  }))
  try {
    plans.forEach((plan, i) => {
      plan.claim(owners[i]!)
      claimed.add(i)
    })
    for (let i = 0; i < plans.length && !animation.done; i++) {
      const plan = plans[i]!
      if (plan.track.end > 0) {
        const player = nativePropertyDriver().play(
          plan.sink,
          plan.track,
          plan.samples,
          plan.final,
          (completed) => {
            if (!completed) animation.stop()
          },
        )
        if (animation.done) player.cancel()
        else players[i] = player
      } else plan.write(plan.final)
    }
    // Each native control receives the elapsed position of the same clock,
    // compensating for setup time rather than starting unrelated animations.
    players.forEach((player) => player?.control(animation.time, false))
    animation.start()
    if (!animation.done && plans.some((plan) => plan.spatial))
      offReduced = onReducedMotion((reduced) => {
        if (!reduced || animation.done) return
        // A group is one playback unit. Stop spatial motion together, including endless loops.
        if (Number.isFinite(duration)) animation.progress = 1
        else {
          try {
            plans.forEach((plan) => plan.write(plan.final))
          } finally {
            animation.stop()
          }
        }
      })
  } catch (error) {
    animation.stop()
    throw error
  }
  return animation
}

export type NativeGroupValues<P extends Record<string, NativeProperty<any>>> = {
  [K in keyof P]: ReturnType<P[K]['get']>
}
export interface NativePropertyGroup<P extends Record<string, NativeProperty<any>>> {
  readonly disposed: boolean
  readonly suspended: boolean
  get(): NativeGroupValues<P>
  set(values: NativeGroupValues<P>): void
  animate(
    values: NativeGroupValues<P>,
    options?: Transition | SpringName,
  ): PlaybackAnimation
  stop(): void
  suspend(): void
  resume(): void
  /** Stops this group's work; borrowed member adapters remain owned by the caller. */
  dispose(): void
}

/** Replacing any member cancels the whole running group, leaving unrelated channels alone. */
export function propertyGroup<const P extends Record<string, NativeProperty<any>>>(
  properties: P,
): NativePropertyGroup<P> {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties))
    throw new TypeError('Expected named property adapters.')
  let entries = Object.entries(properties)
  if (!entries.length || entries.length > 64)
    throw new RangeError('Property groups contain 1..64 members.')
  const identities = new Map<object, Set<string>>()
  for (const [, property] of entries) {
    const internal = internals.get(property)
    if (!internal)
      throw new TypeError(
        'Groups require live native property adapters; mixed backends are unsupported.',
      )
    const keys = identities.get(internal.target) ?? new Set<string>()
    if (keys.has(internal.name))
      throw new Error('A property channel cannot appear twice in one group.')
    keys.add(internal.name)
    identities.set(internal.target, keys)
  }
  let disposed = false,
    suspended = false
  const active = new Set<PlaybackAnimation>(),
    resume = new Set<PlaybackAnimation>()
  const alive = () => {
    if (disposed) throw new Error('Property group is disposed.')
  }
  const validate = (values: NativeGroupValues<P>) => {
    alive()
    if (
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values) ||
      Object.keys(values).length !== entries.length ||
      entries.some(([key]) => !Object.hasOwn(values, key))
    )
      throw new TypeError('Supply exactly one value for every property group member.')
    return entries.map(([key, property]) => {
      const internal = internals.get(property)
      if (!internal) throw new Error('A property group member was disposed.')
      return { internal, value: values[key] }
    })
  }
  const group: NativePropertyGroup<P> = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    get() {
      alive()
      return Object.fromEntries(
        entries.map(([key, property]) => [key, property.get()]),
      ) as NativeGroupValues<P>
    },
    set(values) {
      const plans = validate(values).map(({ internal, value }) =>
        internal.prepareSet(value),
      )
      let committed = 0
      try {
        for (const plan of plans) {
          committed++
          plan.commit()
        }
      } catch (error) {
        const errors = [error]
        for (let i = committed - 1; i >= 0; i--)
          try {
            plans[i]!.rollback()
          } catch (error) {
            errors.push(error)
          }
        throw new AggregateError(
          errors,
          'Property group set failed; started owners remain cancelled.',
        )
      }
    },
    animate(values, options = {}) {
      if (suspended)
        throw new Error('Resume the property group before starting playback.')
      const plans = validate(values).map(({ internal, value }) =>
        internal.prepare(value, options),
      )
      checkPropertyGroupSamples(
        plans.reduce((sum, plan) => sum + plan.samples.length * plan.final.length, 0),
      )
      const animation = playProperties(plans)
      active.add(animation)
      void animation.finished.then(() => {
        active.delete(animation)
        resume.delete(animation)
      })
      return animation
    },
    stop() {
      for (const animation of [...active]) animation.stop()
      active.clear()
      resume.clear()
    },
    suspend() {
      if (disposed || suspended) return
      suspended = true
      for (const animation of active)
        if (!animation.paused) {
          resume.add(animation)
          animation.pause()
        }
    },
    resume() {
      if (disposed || !suspended) return
      suspended = false
      for (const animation of resume) animation.play()
      resume.clear()
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.stop()
      entries = []
    },
  }
  return group
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
