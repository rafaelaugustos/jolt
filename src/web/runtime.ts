import { createTrack, type Track } from '../core/track.js'
import { createOwnership } from '../core/ownership.js'
import { validateProgress } from '../core/playback.js'
import { presets as builtins } from '../core/presets.js'
import { compose, poseAt, type Contribution, type Rest } from './compose.js'
import { flatten, sampled, type Point } from './curve.js'
import { prepare, type Plan } from './plan.js'
import { createPress, validatePressState, type WebPressOptions } from './press.js'
import {
  identity,
  keyOf,
  multiplicative,
  properties,
  type AnimateOptions,
  type Keyframes,
  type PlaybackAnimation,
  type Preset,
  type Property,
  type RuntimeOptions,
  type SpringName,
  type Values,
  type WebConfig,
} from './types.js'

type Realm = Window & typeof globalThis
type Control = { time: number; paused: boolean; pending?: boolean }
interface Entry {
  property: Property
  layer?: string
  owner: Owner
  track: Track
  points: Point[]
  token?: symbol
}
interface State {
  entries: Map<string, Entry>
  rest: Map<string, Rest>
}
const clone = (state: State): State => ({
  entries: new Map(state.entries),
  rest: new Map(state.rest),
})
// Only a co-ownership guard is shared. Configuration, presets, clocks and tokens
// belong to each runtime; this weak registry cannot retain a document or target.
const owners = new WeakMap<HTMLElement, Surface>()

class Surface {
  state: State
  effect?: globalThis.Animation
  disposed = false
  rebuilds = 0
  frameCount = 0
  private original: { transform: string; opacity: string }
  private written: { transform: string; opacity: string }
  private className: string
  private origin: string
  private baseline: string

  constructor(
    readonly runtime: WebRuntime,
    readonly target: HTMLElement,
  ) {
    if (owners.has(target))
      throw new Error('The target is already owned by another Web runtime.')
    const css = runtime.view.getComputedStyle(target)
    const baseline = new runtime.view.DOMMatrix(
      css.transform === 'none' ? undefined : css.transform,
    )
    if (!baseline.is2D)
      throw new TypeError('Web motion requires a static 2D CSS transform baseline.')
    if (['inline', 'none', 'contents'].includes(css.display))
      throw new TypeError('The motion surface must have a transformable box.')
    if ([css.translate, css.rotate, css.scale].some((v) => v !== 'none'))
      throw new TypeError('Individual CSS transforms must be none on a motion surface.')
    if (
      target.getAnimations().length ||
      css.transitionDuration.split(',').some((v) => parseFloat(v) > 0)
    )
      throw new TypeError(
        'Existing animations and transitions must be removed from the motion surface.',
      )
    if (['transform', 'opacity'].some((p) => target.style.getPropertyPriority(p)))
      throw new TypeError('Important inline motion styles are unsupported.')
    this.baseline = baseline.toString()
    this.origin = css.transformOrigin
    this.className = target.className
    this.original = { transform: target.style.transform, opacity: target.style.opacity }
    this.written = { ...this.original }
    this.state = {
      entries: new Map(),
      rest: new Map(
        properties.map((property) => [
          keyOf(property),
          {
            property,
            value: property === 'opacity' ? Number(css.opacity) : identity(property),
          },
        ]),
      ),
    }
  }

  assert() {
    const { target, runtime } = this
    if (this.disposed || !target.isConnected || target.ownerDocument !== runtime.document)
      throw new Error('The motion surface is unavailable.')
    const css = runtime.view.getComputedStyle(target)
    if (
      target.className !== this.className ||
      css.transformOrigin !== this.origin ||
      [css.translate, css.rotate, css.scale].some((v) => v !== 'none') ||
      target.getAnimations().some((a) => a !== this.effect) ||
      (['transform', 'opacity'] as const).some(
        (p) => target.style[p] !== this.written[p] || target.style.getPropertyPriority(p),
      )
    )
      throw new Error(
        'External style changes require releasing and recreating the motion surface.',
      )
  }

  snapshot(
    state: State,
    at: number,
    controls = new Map<Owner, Control>(),
  ): Contribution[] {
    return [...state.entries.values()].map((entry) => {
      const control = controls.get(entry.owner)
      return {
        property: entry.property,
        points: entry.points,
        time: control?.time ?? entry.owner.time(at),
        paused: control
          ? control.paused || !!control.pending
          : entry.owner.paused || entry.owner.pending,
      }
    })
  }

  prepare(state: State, at: number, controls: Map<Owner, Control>) {
    this.assert()
    const result = compose(
      this.snapshot(state, at, controls),
      [...state.rest.values()],
      this.baseline,
      this.runtime.maxKeyframes,
    )
    const animation =
      result.duration > 0
        ? new this.runtime.view.Animation(
            new this.runtime.view.KeyframeEffect(this.target, result.frames, {
              duration: result.duration,
              fill: 'both',
              easing: 'linear',
            }),
            this.runtime.document.timeline,
          )
        : undefined
    if (animation) void animation.finished.catch(() => {})
    return { ...result, animation }
  }

  commit(state: State, prepared: ReturnType<Surface['prepare']>) {
    const previous = this.effect
    this.target.style.transform = prepared.transform
    this.target.style.opacity = prepared.opacity
    this.written = {
      transform: this.target.style.transform,
      opacity: this.target.style.opacity,
    }
    this.state = state
    this.effect = prepared.animation
    this.frameCount = prepared.frames.length
    this.rebuilds++
    owners.set(this.target, this)
    previous?.cancel()
    if (this.effect) {
      const animation = this.effect
      void animation.finished.then(
        () => {
          if (this.effect !== animation || this.disposed) return
          this.effect = undefined
          animation.cancel()
        },
        () => {},
      )
    }
  }

  restore() {
    this.disposed = true
    this.effect?.cancel()
    this.effect = undefined
    for (const property of ['transform', 'opacity'] as const)
      if (
        this.target.style[property] === this.written[property] &&
        !this.target.style.getPropertyPriority(property)
      )
        this.target.style[property] = this.original[property]
    this.state.entries.clear()
    this.state.rest.clear()
    if (owners.get(this.target) === this) owners.delete(this.target)
  }
}

class Owner implements PlaybackAnimation {
  readonly finished: Promise<boolean>
  readonly ready: Promise<void>
  readonly entries = new Set<Entry>()
  clock?: globalThis.Animation
  pending: boolean
  paused = false
  settled = false
  complete = true
  private held = 0
  private anchor: number
  private end: number
  private resolve!: (value: boolean) => void
  private resolveReady!: () => void

  constructor(
    private runtime: WebRuntime,
    readonly duration: number,
    at: number,
  ) {
    this.anchor = at
    this.end = duration
    this.pending = runtime.document.timeline.currentTime === null
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve
    })
  }

  time(at?: number) {
    if (this.settled || this.pending || this.paused) return this.held
    at ??= this.runtime.now()
    // The default DocumentTimeline and performance clock share the document's
    // origin. Project its resolved start time to this command, rather than using
    // the previous rendering tick during a long input task (notably WebKit).
    const start =
      typeof this.clock?.startTime === 'number'
        ? this.clock.startTime
        : this.anchor - this.held
    return Math.max(0, Math.min(this.duration, at - start))
  }
  get progress() {
    return this.settled && this.complete
      ? 1
      : this.duration
        ? this.time() / this.duration
        : this.settled
          ? 1
          : 0
  }
  set progress(value: number) {
    validateProgress(value, this.duration)
    if (!this.settled)
      this.runtime.control(this, {
        time: this.duration * value,
        paused: this.paused,
        pending: this.pending,
      })
  }
  pause() {
    if (!this.settled && !this.paused)
      this.runtime.control(this, {
        time: this.time(),
        paused: true,
        pending: this.pending,
      })
  }
  play() {
    if (!this.settled && this.paused)
      this.runtime.control(this, {
        time: this.held,
        paused: false,
        pending: this.pending,
      })
  }
  stop() {
    if (!this.settled) this.runtime.stopOwner(this)
  }
  then<A = boolean, B = never>(
    onfulfilled?: ((value: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }

  prepare(control: Control, at: number) {
    if (!this.duration) return undefined
    const clock = new this.runtime.view.Animation(
      new this.runtime.view.KeyframeEffect(null, [], {
        duration: this.end,
        fill: 'both',
      }),
      this.runtime.document.timeline,
    )
    void clock.finished.catch(() => {})
    try {
      if (control.paused || control.pending) {
        clock.pause()
        clock.currentTime = control.time
      } else {
        clock.play()
        clock.startTime = at - control.time
      }
    } catch (error) {
      clock.cancel()
      throw error
    }
    return clock
  }
  apply(control: Control, at: number, clock?: globalThis.Animation) {
    const previous = this.clock
    this.held = control.time
    this.anchor = at
    this.paused = control.paused
    this.pending = !!control.pending
    this.clock = clock
    previous?.cancel()
    this.watch()
    if (!this.pending) this.resolveReady()
  }
  private watch() {
    if (this.clock)
      void this.clock.finished.then(
        () => {
          if (
            !this.settled &&
            !this.paused &&
            !this.pending &&
            this.clock?.playState === 'finished'
          )
            this.runtime.completeOwner(this)
        },
        () => {},
      )
  }
  refresh(at: number) {
    if (this.settled) return
    this.end = Math.max(0, ...[...this.entries].map((e) => e.track.end))
    if (!this.entries.size) this.settle(this.complete, at)
    else {
      this.clock?.effect?.updateTiming({ duration: this.end })
      this.watch()
      if (!this.paused && !this.pending && this.time(at) >= this.end)
        queueMicrotask(() => {
          if (!this.settled && !this.paused && !this.pending && this.time() >= this.end)
            this.runtime.completeOwner(this)
        })
    }
  }
  settle(completed: boolean, at: number) {
    if (this.settled) return
    this.held = this.time(at)
    this.settled = true
    this.complete = completed
    this.clock?.cancel()
    this.clock = undefined
    this.entries.clear()
    this.resolveReady()
    this.resolve(completed)
    this.runtime.forget(this)
    // A retained terminal handle must not keep the document/context alive.
    this.runtime = undefined!
  }
}

/** Internal implementation. Package exports and framework adapters are separate work. */
export class WebRuntime {
  readonly view: Realm
  readonly maxKeyframes: number
  private settings: Required<WebConfig>
  private readonly presets = new Map<string, Preset>()
  private readonly surfaces = new Map<HTMLElement, Surface>()
  private readonly animations = new Set<Owner>()
  private readonly ownership = createOwnership<HTMLElement, string>()
  private readonly observers = new Map<Node, MutationObserver>()
  private readonly presses = new Map<HTMLElement, ReturnType<typeof createPress>>()
  private nextPress = 0
  private readonly preference: MediaQueryList
  private reported: boolean
  private disposed = false
  private pendingFrame?: number

  constructor(
    readonly document: Document,
    options: RuntimeOptions = {},
  ) {
    const view = document?.defaultView
    if (!view)
      throw new TypeError('A live document is required to create the Web runtime.')
    this.view = view as Realm
    if (!this.view.Animation || !this.view.KeyframeEffect || !document.timeline)
      throw new Error('Web Animations API is required.')
    this.settings = this.validate(options, { timeScale: 1, reducedMotion: 'user' })
    this.maxKeyframes = options.maxKeyframes ?? 6001
    if (
      !Number.isSafeInteger(this.maxKeyframes) ||
      this.maxKeyframes < 2 ||
      this.maxKeyframes > 60001
    )
      throw new RangeError('maxKeyframes must be an integer from 2 to 60001.')
    this.preference = this.view.matchMedia('(prefers-reduced-motion: reduce)')
    this.reported = this.reduced()
    this.preference.addEventListener('change', this.preferenceChanged)
    for (const [name, preset] of Object.entries(builtins)) {
      if (
        Object.keys(preset.keyframes).every(
          (p) => p === 'scale' || properties.includes(p as Property),
        )
      )
        this.presets.set(name, this.copyPreset(preset as Preset))
    }
  }

  now() {
    return this.view.performance.now()
  }
  private assert() {
    if (this.disposed) throw new Error('The Web runtime is disposed.')
  }
  private reduced() {
    return (
      this.settings.reducedMotion === 'always' ||
      (this.settings.reducedMotion === 'user' && this.preference.matches)
    )
  }
  private validate(
    options: WebConfig,
    current: Required<WebConfig>,
  ): Required<WebConfig> {
    if (!options || typeof options !== 'object')
      throw new TypeError('Expected runtime options.')
    const timeScale = options.timeScale ?? current.timeScale,
      reducedMotion = options.reducedMotion ?? current.reducedMotion
    if (!Number.isFinite(timeScale) || timeScale <= 0)
      throw new RangeError('timeScale must be positive and finite.')
    if (!['user', 'always', 'never'].includes(reducedMotion))
      throw new TypeError('Invalid reduced-motion policy.')
    return { timeScale, reducedMotion }
  }
  configure(options: WebConfig) {
    this.assert()
    this.settings = this.validate(options, this.settings)
    this.preferenceChanged()
  }
  private copyPreset(preset: Preset): Preset {
    const copy = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(copy)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)]))
          : v
    return copy(preset) as Preset
  }
  definePreset(name: string, preset: Preset) {
    this.assert()
    if (!name || Object.hasOwn(builtins, name))
      throw new TypeError('A custom preset needs a new nonempty name.')
    const copied = this.copyPreset(preset)
    prepare(copied.keyframes, copied.transition, this.presets, 1)
    this.presets.set(name, copied)
  }

  private targets(target: HTMLElement | readonly HTMLElement[]): HTMLElement[] {
    const result = Array.isArray(target) ? [...target] : [target as HTMLElement]
    if (new Set(result).size !== result.length)
      throw new TypeError('Duplicate animation targets are unsupported.')
    for (const element of result)
      if (
        !(element instanceof this.view.HTMLElement) ||
        element.ownerDocument !== this.document ||
        !element.isConnected
      )
        throw new TypeError(
          'Targets must be mounted HTML elements in this runtime document.',
        )
    return result
  }

  animate(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    return this.play(target, animation, options)
  }

  private play(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
    privateLayer?: string,
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    this.assert()
    const targets = this.targets(target)
    const plans = prepare(animation, options, this.presets, targets.length)
    if (privateLayer !== undefined)
      for (const tracks of plans) for (const plan of tracks) plan.layer = privateLayer
    const at = this.now(),
      pending = this.document.timeline.currentTime === null
    const compiled: {
      surface: Surface
      plans: { plan: Plan; track: Track; points: Point[] }[]
    }[] = []
    for (let i = 0; i < targets.length; i++) {
      const element = targets[i]!
      const surface = this.surfaces.get(element) ?? new Surface(this, element)
      surface.assert()
      const tracks = plans[i]!.map((plan) => {
        const key = keyOf(plan.property, plan.layer),
          old = surface.state.entries.get(key)
        const time = old?.owner.time(at) ?? 0
        const from = old
          ? old.track.valueAt(time)
          : (surface.state.rest.get(key)?.value ?? identity(plan.property))
        const velocity =
          old && !old.owner.paused && !old.owner.pending ? old.track.velocityAt(time) : 0
        const values = plan.frames.map((value) =>
          value === null
            ? from
            : plan.relative
              ? multiplicative(plan.property)
                ? from * value
                : from + value
              : value,
        )
        const track = createTrack(plan.property, values, plan.transition, velocity, {
          timeScale: this.settings.timeScale,
          reducedMotion: this.reduced(),
        })
        return { plan, track, points: flatten(track, this.maxKeyframes) }
      })
      compiled.push({ surface, plans: tracks })
    }
    const owner = new Owner(
      this,
      Math.max(0, ...compiled.flatMap((c) => c.plans.map((p) => p.track.end))),
      at,
    )
    const proposals = new Map<Surface, State>()
    for (const { surface, plans: tracks } of compiled) {
      if (!tracks.length) continue
      const state = clone(surface.state)
      for (const { plan, track, points } of tracks) {
        const key = keyOf(plan.property, plan.layer)
        state.entries.delete(key)
        if (track.end === 0) this.rest(state, key, plan.property, track.to, plan.layer)
        else {
          state.rest.delete(key)
          state.entries.set(key, {
            owner,
            property: plan.property,
            layer: plan.layer,
            track,
            points,
          })
        }
      }
      proposals.set(surface, state)
    }
    this.transaction(
      proposals,
      at,
      new Map([[owner, { time: 0, paused: false, pending }]]),
    )
    owner.refresh(at)
    return owner
  }

  set(target: HTMLElement | readonly HTMLElement[], values: Values) {
    if (
      !values ||
      typeof values !== 'object' ||
      Object.values(values).some((v) => typeof v !== 'number')
    )
      throw new TypeError('set() requires one numeric value per property.')
    return this.animate(target, values, { duration: 0 })
  }

  press(
    target: HTMLElement,
    values: Values = { scale: 0.96 },
    options: WebPressOptions = {},
  ) {
    this.assert()
    this.targets(target)
    if (this.presses.has(target))
      throw new Error('The surface already has press feedback.')
    validatePressState(options)
    if (
      !values ||
      !Object.keys(values).length ||
      Object.values(values).some((v) => typeof v !== 'number')
    )
      throw new TypeError('Press requires numeric contributions.')
    const copied = { ...values }
    const transition =
      typeof options.transition === 'object'
        ? { ...options.transition }
        : (options.transition ?? 'snappy')
    prepare(copied, transition, this.presets, 1)
    const layer = `jolt:press:${++this.nextPress}`
    const neutral = Object.fromEntries(
      Object.keys(copied).map((p) => [
        p,
        p === 'opacity' || p.startsWith('scale') ? 1 : 0,
      ]),
    )
    this.play(target, neutral, { duration: 0 }, layer)
    const binding = createPress(
      target,
      copied,
      options,
      (next) => this.play(target, next, transition, layer),
      () => {
        if (!target.isConnected || target.ownerDocument !== this.document) {
          this.release(target)
          return
        }
        const surface = this.surfaces.get(target)
        if (surface) {
          const state = clone(surface.state)
          for (const property of properties) {
            state.entries.delete(keyOf(property, layer))
            state.rest.delete(keyOf(property, layer))
          }
          this.transaction(new Map([[surface, state]]), this.now())
        }
        this.presses.delete(target)
      },
    )
    this.presses.set(target, binding)
    return binding.handle
  }

  private rest(
    state: State,
    key: string,
    property: Property,
    value: number,
    layer?: string,
  ) {
    if (layer !== undefined && value === identity(property)) state.rest.delete(key)
    else state.rest.set(key, { property, value })
  }

  private transaction(
    proposals: Map<Surface, State>,
    at: number,
    controls = new Map<Owner, Control>(),
    removed = 'cancel' as 'cancel' | 'finish',
  ) {
    const prepared = new Map<Surface, ReturnType<Surface['prepare']>>()
    const clocks = new Map<Owner, globalThis.Animation | undefined>()
    try {
      for (const [surface, state] of proposals)
        prepared.set(surface, surface.prepare(state, at, controls))
      // Construct and validate every effect before changing ownership or old playback.
      for (const data of prepared.values())
        if (data.animation) {
          data.animation.play()
          data.animation.startTime = at
        }
      for (const [owner, control] of controls)
        clocks.set(owner, owner.prepare(control, at))
    } catch (error) {
      for (const data of prepared.values()) data.animation?.cancel()
      for (const clock of clocks.values()) clock?.cancel()
      for (const owner of controls.keys())
        if (!this.animations.has(owner)) owner.settle(false, at)
      throw error
    }
    for (const [owner, control] of controls) owner.apply(control, at, clocks.get(owner))
    const affected = new Set<Owner>(controls.keys())
    for (const [surface, state] of proposals) {
      for (const [key, previous] of surface.state.entries)
        if (state.entries.get(key) !== previous) {
          previous.owner.entries.delete(previous)
          previous.owner.complete &&= removed === 'finish'
          affected.add(previous.owner)
          this.ownership.invalidate(surface.target, [key])
        }
      for (const [key, entry] of state.entries)
        if (surface.state.entries.get(key) !== entry) {
          entry.token = this.ownership.claim(surface.target, key)
          entry.owner.entries.add(entry)
          affected.add(entry.owner)
        }
      surface.commit(state, prepared.get(surface)!)
      this.surfaces.set(surface.target, surface)
    }
    for (const owner of affected) {
      if (!owner.settled) this.animations.add(owner)
      owner.refresh(at)
    }
    this.observe()
    this.schedulePending()
  }

  control(owner: Owner, control: Control) {
    this.assert()
    const proposals = new Map<Surface, State>()
    for (const surface of this.surfaces.values())
      if ([...surface.state.entries.values()].some((e) => e.owner === owner))
        proposals.set(surface, clone(surface.state))
    this.transaction(proposals, this.now(), new Map([[owner, control]]))
  }

  stopOwner(owner: Owner) {
    this.remove((entry) => entry.owner === owner, false)
  }
  completeOwner(owner: Owner) {
    if (owner.settled || owner.paused || owner.pending) return
    try {
      this.remove((entry) => entry.owner === owner, true)
    } catch {
      for (const [target, surface] of this.surfaces)
        if ([...surface.state.entries.values()].some((e) => e.owner === owner))
          this.release(target)
    }
  }

  stop(
    target: HTMLElement | readonly HTMLElement[],
    selected?: readonly (Property | 'scale')[],
    options?: { layer?: string },
  ) {
    this.assert()
    const targets = new Set(this.targets(target))
    const names = selected?.flatMap((p) => (p === 'scale' ? ['scaleX', 'scaleY'] : [p]))
    if (names?.some((p) => !properties.includes(p as Property)))
      throw new TypeError('Unsupported property to stop.')
    this.remove(
      (entry) =>
        (!names || names.includes(entry.property)) &&
        (options?.layer === undefined || entry.layer === options.layer),
      false,
      (surface) => targets.has(surface.target),
    )
  }

  private remove(
    matches: (entry: Entry) => boolean,
    completed: boolean,
    includes = (_surface: Surface) => true,
  ) {
    const at = this.now(),
      proposals = new Map<Surface, State>()
    for (const surface of this.surfaces.values()) {
      if (!includes(surface)) continue
      const state = clone(surface.state)
      for (const [key, entry] of state.entries)
        if (matches(entry) && this.ownership.get(surface.target, key) === entry.token) {
          state.entries.delete(key)
          this.rest(
            state,
            key,
            entry.property,
            completed ? entry.track.to : sampled(entry.points, entry.owner.time(at)),
            entry.layer,
          )
          proposals.set(surface, state)
        }
    }
    this.transaction(proposals, at, new Map(), completed ? 'finish' : 'cancel')
  }

  private preferenceChanged = () => {
    if (this.disposed) return
    const reduced = this.reduced()
    if (reduced === this.reported) return
    this.reported = reduced
    if (reduced) {
      try {
        this.remove((entry) => entry.property !== 'opacity', true)
      } catch {
        for (const target of [...this.surfaces.keys()]) this.release(target)
      }
    }
  }

  private schedulePending() {
    if (this.pendingFrame !== undefined || ![...this.animations].some((a) => a.pending))
      return
    this.pendingFrame = this.view.requestAnimationFrame(() => {
      this.pendingFrame = undefined
      if (this.disposed) return
      if (this.document.timeline.currentTime === null) {
        this.schedulePending()
        return
      }
      const at = this.now(),
        controls = new Map<Owner, Control>()
      for (const owner of this.animations)
        if (owner.pending)
          controls.set(owner, {
            time: owner.time(at),
            paused: owner.paused,
            pending: false,
          })
      const proposals = new Map<Surface, State>()
      for (const surface of this.surfaces.values())
        if ([...surface.state.entries.values()].some((e) => controls.has(e.owner)))
          proposals.set(surface, clone(surface.state))
      try {
        this.transaction(proposals, at, controls)
      } catch {
        for (const surface of proposals.keys()) this.release(surface.target)
      }
    })
  }

  private observe() {
    const roots = new Set<Node>()
    if (this.surfaces.size) roots.add(this.document)
    for (const surface of this.surfaces.values()) roots.add(surface.target.getRootNode())
    for (const [root, observer] of this.observers)
      if (!roots.has(root)) {
        observer.disconnect()
        this.observers.delete(root)
      }
    for (const root of roots)
      if (!this.observers.has(root)) {
        const observer = new this.view.MutationObserver(() => {
          for (const target of [...this.surfaces.keys()])
            if (!target.isConnected || target.ownerDocument !== this.document)
              this.release(target)
          for (const press of this.presses.values()) press.refresh()
          this.observe()
        })
        observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['disabled', 'aria-disabled', 'aria-busy', 'inert'],
        })
        this.observers.set(root, observer)
      }
  }

  release(target: HTMLElement) {
    this.presses.get(target)?.detach()
    this.presses.delete(target)
    const surface = this.surfaces.get(target)
    if (!surface) return
    const at = this.now(),
      affected = new Set<Owner>()
    for (const entry of surface.state.entries.values()) {
      entry.owner.entries.delete(entry)
      entry.owner.complete = false
      affected.add(entry.owner)
    }
    this.ownership.invalidate(target)
    surface.restore()
    this.surfaces.delete(target)
    for (const owner of affected) owner.refresh(at)
    this.observe()
  }

  forget(owner: Owner) {
    this.animations.delete(owner)
    if (this.pendingFrame !== undefined && ![...this.animations].some((a) => a.pending)) {
      this.view.cancelAnimationFrame(this.pendingFrame)
      this.pendingFrame = undefined
    }
  }

  /** Internal diagnostics for conformance fixtures, not a frame subscription. */
  inspect(target: HTMLElement) {
    const surface = this.surfaces.get(target),
      at = this.now()
    return {
      targets: this.surfaces.size,
      animations: this.animations.size,
      observers: this.observers.size,
      pendingFrame: this.pendingFrame !== undefined,
      ...(surface && {
        pose: poseAt(surface.snapshot(surface.state, at), [
          ...surface.state.rest.values(),
        ]),
        effects: surface.target.getAnimations().length,
        keyframes: surface.frameCount,
        rebuilds: surface.rebuilds,
        tracks: [...surface.state.entries.values()].map((e) => ({
          property: e.property,
          layer: e.layer,
          time: e.owner.time(at),
          clockTime: e.owner.clock?.currentTime,
          startTime: e.owner.clock?.startTime,
          initialVelocity: e.track.velocityAt(0),
          from: e.track.values[0],
          position: e.track.valueAt(e.owner.time(at)),
          velocity:
            e.owner.paused || e.owner.pending ? 0 : e.track.velocityAt(e.owner.time(at)),
          duration: e.track.end,
          paused: e.owner.paused,
          pending: e.owner.pending,
        })),
      }),
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.preference.removeEventListener('change', this.preferenceChanged)
    for (const target of [...this.surfaces.keys()]) this.release(target)
    for (const observer of this.observers.values()) observer.disconnect()
    this.observers.clear()
    if (this.pendingFrame !== undefined) this.view.cancelAnimationFrame(this.pendingFrame)
    this.pendingFrame = undefined
    this.presets.clear()
  }
}

export const createWebRuntime = (document: Document, options?: RuntimeOptions) =>
  new WebRuntime(document, options)
