import {
  adapterEvent,
  adapterMeasure,
  registerAdapterInspection,
  type AdapterEventKind,
} from '../core/adapter-inspection.js'
import { createClock, registerPlayback, validateProgress } from '../core/playback.js'
import {
  propertyLimits,
  checkPropertySamples,
  checkPropertyGroupSamples,
} from '../core/property-limits.js'
import { createTrack, instantTrack, type Track } from '../core/track.js'
import {
  resolveTransition,
  type Transition,
  type SpringName,
} from '../core/transition.js'
import { valuePlan } from './value-playback.js'
import type { EffectHost } from './effect.js'
import type { FrameTask } from './scheduler.js'
import type { WebAnimation } from './public.js'

/** An explicitly integrated JS renderer property. Writes run on the browser main thread. */
export interface WebPropertyDefinition<T> {
  name: string
  units: readonly string[]
  spatial?: boolean
  read(target: object): T
  write(target: object, value: T): void
  alive?(target: object): boolean
  encode(value: T): readonly number[]
  decode(value: readonly number[]): T
  validate?(value: T): void
  interpolate?(from: T, to: T, fraction: number): T
}
export interface WebProperty<T> {
  readonly name: string
  readonly disposed: boolean
  get(): T
  set(value: T): void
  animate(value: T, options?: Transition | SpringName): WebAnimation
  stop(): void
  dispose(): void
}
export type WebGroupValues<P extends Record<string, WebProperty<any>>> = {
  [K in keyof P]: ReturnType<P[K]['get']>
}
export interface WebPropertyGroup<P extends Record<string, WebProperty<any>>> {
  readonly disposed: boolean
  readonly suspended: boolean
  get(): WebGroupValues<P>
  set(values: WebGroupValues<P>): void
  animate(values: WebGroupValues<P>, options?: Transition | SpringName): WebAnimation
  stop(): void
  suspend(): void
  resume(): void
  dispose(): void
}
interface Owner {
  handle?: WebAnimation
  stop(): void
  velocity(): readonly number[]
}
interface Plan {
  components: number
  member: PropertyTarget<any>
  track: Track
  value(elapsed: number): readonly number[]
  final: readonly number[]
}
const ownership = new WeakMap<object, Map<string, Owner>>()
const members = new WeakMap<object, PropertyTarget<any>>()

export class PropertyTarget<T> implements WebProperty<T> {
  readonly name: string
  private ended = false
  private own = new Set<Owner>()
  private schema: WebPropertyDefinition<T> | undefined
  constructor(
    private target: object | undefined,
    definition: WebPropertyDefinition<T>,
    public host: EffectHost | undefined,
    private forget: () => void,
  ) {
    if (
      !target ||
      (typeof target !== 'object' && typeof target !== 'function') ||
      !definition ||
      !/^[\w.-]+\/[\w.-]+$/.test(definition.name) ||
      !Array.isArray(definition.units) ||
      !definition.units.length ||
      definition.units.some((unit) => typeof unit !== 'string' || !unit) ||
      ['read', 'write', 'encode', 'decode'].some(
        (key) => typeof definition[key as keyof typeof definition] !== 'function',
      )
    )
      throw new TypeError(
        'Web properties need a target, namespaced name, units and read/write/encode/decode functions.',
      )
    this.schema = { ...definition, units: [...definition.units] }
    if (definition.units.length > propertyLimits.components)
      throw new RangeError('Properties support at most 64 components.')
    this.name = definition.name
    this.alive()
    this.vector(this.get())
    members.set(this, this)
    registerAdapterInspection(this, {
      name: this.name,
      units: [...definition.units],
      platform: 'web',
      target,
      read: () => {
        this.alive()
        const owner = this.owner()
        return {
          alive: !this.ended,
          values: this.vector(this.get()),
          owner: owner?.handle ?? owner,
          binding: false,
          paused: owner?.handle?.paused,
        }
      },
    })
  }
  get disposed() {
    return this.ended
  }
  get spatial() {
    return !!this.schema?.spatial
  }
  identity() {
    this.alive()
    return this.target!
  }
  alive() {
    if (this.ended || !this.target) throw new Error(`${this.name} is disposed.`)
    if (this.schema!.alive && !this.schema!.alive(this.target))
      throw new Error(`${this.name} lost its target.`)
    const element = this.target as Partial<Element>
    if (
      element.ownerDocument &&
      (element.ownerDocument !== this.host!.document || !element.isConnected)
    )
      throw new Error(`${this.name} requires a connected target in its runtime document.`)
  }
  vector(value: T): readonly number[] {
    this.schema!.validate?.(value)
    const result = [...this.schema!.encode(value)]
    if (
      result.length !== this.schema!.units.length ||
      result.some((v) => !Number.isFinite(v))
    )
      throw new TypeError(
        `${this.name} expects ${this.schema!.units.length} finite components.`,
      )
    return result
  }
  get() {
    this.alive()
    return this.schema!.read(this.target!)
  }
  write(value: readonly number[]) {
    this.alive()
    const measured = adapterMeasure(this, 'write')
    try {
      this.schema!.write(this.target!, this.schema!.decode(value))
    } finally {
      measured?.()
    }
  }
  owner() {
    return this.target ? ownership.get(this.target)?.get(this.name) : undefined
  }
  claim(owner: Owner) {
    this.alive()
    const previous = this.owner()
    previous?.stop()
    adapterEvent(
      this,
      previous ? 'replace' : 'start',
      owner.handle ?? owner,
      previous?.handle ?? previous,
    )
    let channels = ownership.get(this.target!)
    if (!channels) ownership.set(this.target!, (channels = new Map()))
    channels.set(this.name, owner)
    this.own.add(owner)
  }
  release(owner: Owner) {
    if (this.target && this.owner() === owner)
      ownership.get(this.target)?.delete(this.name)
    this.own.delete(owner)
  }
  set(value: T) {
    this.alive()
    const vector = this.vector(value)
    this.owner()?.stop()
    this.write(vector)
  }
  prepare(to: T, options: Transition | SpringName): Plan {
    const measured = adapterMeasure(this, 'prepare')
    this.alive()
    const from = this.get(),
      first = this.vector(from),
      last = this.vector(to)
    const timing = valuePlan(options)
    if (timing.layer !== undefined)
      throw new TypeError('Property adapters do not support layers.')
    const transition = resolveTransition(timing, 'opacity', 2)
    const delta = last.map((v, i) => v - first[i]!)
    const length = delta.reduce((sum, v) => sum + v * v, 0),
      velocity = this.owner()?.velocity()
    const speed =
      length && velocity
        ? delta.reduce((sum, v, i) => sum + v * (velocity[i] ?? 0), 0) / length
        : 0
    const track =
      this.schema!.spatial && this.host!.reduced()
        ? instantTrack('opacity', 1)
        : createTrack('opacity', [0, 1], transition, speed, {
            ...this.host!.settings(),
            reducedMotion: false,
          })
    const at = (fraction: number) =>
      this.vector(
        this.schema!.interpolate
          ? this.schema!.interpolate(from, to, fraction)
          : this.schema!.decode(first.map((v, i) => v + delta[i]! * fraction)),
      )
    // Validate the same bounded setup samples as native. Playback interpolates
    // those vectors; user encoders/interpolators are not called every frame.
    const count = track.duration
      ? Math.max(1, Math.min(6000, Math.ceil((track.duration * 60) / 1000)))
      : 1
    const times = [
      ...new Set([
        ...track.times,
        ...Array.from({ length: count + 1 }, (_, i) => i / count),
      ]),
    ].sort((a, b) => a - b)
    checkPropertySamples(times.length, first.length)
    const samples = times.map((time) =>
      at(
        time === 1
          ? track.values.at(-1)!
          : track.valueAt(track.delay + track.duration * time),
      ),
    )
    const final = at(track.to)
    const value = (elapsed: number) => {
      if (elapsed >= track.end) return final
      const local = Math.max(0, elapsed - track.delay)
      const iteration = track.duration ? Math.floor(local / track.duration) : 0
      let phase = track.duration ? (local % track.duration) / track.duration : 0
      if (track.reverse && iteration % 2) phase = 1 - phase
      let low = 0,
        high = times.length - 1
      while (low + 1 < high) {
        const mid = (low + high) >> 1
        if (times[mid]! <= phase) low = mid
        else high = mid
      }
      const span = times[high]! - times[low]!
      const fraction = span ? Math.max(0, Math.min(1, (phase - times[low]!) / span)) : 1
      return samples[low]!.map((v, i) => v + (samples[high]![i]! - v) * fraction)
    }
    measured?.(times.length * first.length)
    return { member: this, track, final, value, components: times.length * first.length }
  }
  animate(value: T, options: Transition | SpringName = {}) {
    return new PropertyAnimation([this.prepare(value, options)], this.host!)
  }
  stop() {
    for (const owner of [...this.own]) owner.stop()
  }
  dispose() {
    if (this.ended) return
    this.stop()
    this.ended = true
    adapterEvent(this, 'dispose')
    members.delete(this)
    this.target = undefined
    this.schema = undefined
    this.host = undefined
    this.forget()
    this.forget = () => {}
  }
}

/** One browser scheduler task and one clock for a fully prepared group. */
class PropertyAnimation implements WebAnimation {
  readonly ready = Promise.resolve()
  readonly finished: Promise<boolean>
  readonly duration: number
  private resolve!: (value: boolean) => void
  private clock
  private notify: () => void
  private ended = false
  private held = false
  private completed = false
  private cancelTimer?: () => void
  private off: (() => void)[] = []
  private owners: Owner[] = []
  private task: FrameTask = {
    update: () => !this.ended && !this.held,
    write: () => this.paint(),
  }
  constructor(
    private plans: Plan[],
    private host: EffectHost | undefined,
  ) {
    if (!host) throw new Error('Property runtime is disposed.')
    checkPropertyGroupSamples(plans.reduce((sum, plan) => sum + plan.components, 0))
    this.duration = Math.max(...plans.map((plan) => plan.track.end))
    this.clock = createClock(() => this.host!.scheduler.now())
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.notify = registerPlayback(this, () => ({
      time: this.time(),
      duration: this.duration,
      paused: this.held,
      ready: true,
      settled: this.ended,
      completed: this.completed,
    }))
    this.owners = plans.map((plan) => ({
      handle: this,
      stop: () => this.stop(),
      velocity: () =>
        this.held
          ? plan.final.map(() => 0)
          : plan
              .value(this.time() + 0.5)
              .map((v, i) => (v - plan.value(this.time() - 0.5)[i]!) * 1000),
    }))
    try {
      plans.forEach((plan) => plan.member.alive())
      plans.forEach((plan, i) => plan.member.claim(this.owners[i]!))
      this.off.push(host.visibility(() => this.sync()))
      if (plans.some((plan) => plan.member.spatial))
        this.off.push(
          host.onReduced(() => {
            if (this.host?.reduced()) this.finish(true)
          }),
        )
      host.remember(this)
      this.paint(true)
      this.sync()
      if (!this.duration) this.finish(true)
    } catch (error) {
      this.finish(false)
      throw error
    }
  }
  private time() {
    return Math.min(this.duration, Math.max(0, this.clock.time()))
  }
  get paused() {
    return this.held
  }
  get progress() {
    validateProgress(0, this.duration)
    return this.duration ? this.time() / this.duration : 1
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    if (this.ended) return
    this.plans.forEach((plan) => adapterEvent(plan.member, 'seek', this))
    this.clock.seek(value * this.duration)
    this.paint()
    this.sync()
    this.notify()
    if (value === 1) this.finish(true)
  }
  private paint(rethrow = false) {
    if (this.ended) return
    try {
      // Read/validate every target before the first write of this frame.
      this.plans.forEach((plan) => plan.member.alive())
      const time = this.time()
      const values = this.plans.map((plan) => plan.value(time))
      this.plans.forEach((plan, i) => plan.member.write(values[i]!))
    } catch (error) {
      const host = this.host
      this.finish(false)
      if (rethrow) throw error
      host?.error(error)
    }
  }
  private sync() {
    if (this.ended) return
    this.cancelTimer?.()
    this.cancelTimer = undefined
    this.host!.scheduler.remove(this.task)
    if (this.ended || this.held || this.host!.document.hidden) return
    this.host!.scheduler.add(this.task)
    if (Number.isFinite(this.duration))
      this.cancelTimer = this.host!.after(Math.max(0, this.duration - this.time()), () =>
        this.finish(true),
      )
  }
  private finish(completed: boolean) {
    if (this.ended) return
    const host = this.host!
    this.ended = true
    this.completed = completed
    this.cancelTimer?.()
    this.host!.scheduler.remove(this.task)
    this.off.splice(0).forEach((off) => off())
    if (completed && Number.isFinite(this.duration)) this.clock.seek(this.duration)
    this.clock.cancel()
    const errors: unknown[] = []
    this.plans.forEach((plan, i) => {
      try {
        if (completed) plan.member.write(plan.final)
      } catch (error) {
        errors.push(error)
        this.completed = false
      } finally {
        adapterEvent(plan.member, completed ? 'complete' : 'cancel', this)
        plan.member.release(this.owners[i]!)
      }
    })
    const time = this.clock.time()
    this.clock = createClock(() => 0, time)
    this.clock.cancel()
    this.cancelTimer = undefined
    this.plans = []
    this.owners = []
    this.host = undefined
    this.notify()
    this.resolve(this.completed)
    errors.forEach((error) => host.error(error))
  }
  stop() {
    this.finish(false)
  }
  pause() {
    if (this.ended || this.held) return
    this.plans.forEach((plan) => adapterEvent(plan.member, 'pause', this))
    this.clock.pause()
    this.held = true
    this.paint()
    this.sync()
    this.notify()
  }
  play() {
    if (this.ended || !this.held) return
    this.plans.forEach((plan) => adapterEvent(plan.member, 'play', this))
    this.clock.play()
    this.held = false
    this.sync()
    this.notify()
  }
  then<A = boolean, B = never>(
    fulfilled?: ((value: boolean) => A | PromiseLike<A>) | null,
    rejected?: ((error: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(fulfilled, rejected)
  }
}

export function createPropertyGroup<const P extends Record<string, WebProperty<any>>>(
  properties: P,
  host: EffectHost | undefined,
  forget: () => void,
): WebPropertyGroup<P> {
  if (!host) throw new Error('Property runtime is disposed.')
  if (!properties || typeof properties !== 'object' || Array.isArray(properties))
    throw new TypeError('Expected named property adapters.')
  let entries = Object.entries(properties).map(([key, value]) => {
    const member = members.get(value)
    if (!member || member.host?.identity !== host!.identity)
      throw new TypeError('Groups require live property adapters from this Web runtime.')
    return { key, member }
  })
  if (!entries.length || entries.length > 64)
    throw new RangeError('Property groups contain 1..64 members.')
  const identities = new Map<object, Set<string>>()
  for (const { member } of entries) {
    const identity = member.identity(),
      keys = identities.get(identity) ?? new Set<string>()
    if (keys.has(member.name))
      throw new Error('A property channel cannot appear twice in one group.')
    keys.add(member.name)
    identities.set(identity, keys)
  }
  let disposed = false,
    suspended = false
  const active = new Set<WebAnimation>(),
    resume = new Set<WebAnimation>()
  const alive = () => {
    if (disposed) throw new Error('Property group is disposed.')
  }
  const validate = (values: WebGroupValues<P>) => {
    alive()
    if (
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values) ||
      Object.keys(values).length !== entries.length ||
      entries.some(({ key }) => !Object.hasOwn(values, key))
    )
      throw new TypeError('Supply exactly one value for every property group member.')
    entries.forEach(({ member }) => member.alive())
  }
  const group: WebPropertyGroup<P> = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    get() {
      alive()
      return Object.fromEntries(
        entries.map(({ key, member }) => [key, member.get()]),
      ) as WebGroupValues<P>
    },
    set(values) {
      validate(values)
      const next = entries.map(({ key, member }) => member.vector(values[key])),
        previous = entries.map(({ member }) => member.vector(member.get()))
      let written = 0
      try {
        entries.forEach(({ member }, i) => {
          member.owner()?.stop()
          written++
          member.write(next[i]!)
        })
      } catch (error) {
        const errors = [error]
        for (let i = written - 1; i >= 0; i--)
          try {
            entries[i]!.member.write(previous[i]!)
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
      validate(values)
      const plans = entries.map(({ key, member }) => member.prepare(values[key], options))
      const animation = new PropertyAnimation(plans, host)
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
      host = undefined
      forget()
      forget = () => {}
    },
  }
  return group
}
