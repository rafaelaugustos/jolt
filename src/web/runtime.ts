import { createDrag, dragOptions, assertDragSpace, type WebDragOptions } from './drag.js'
import { createTrack, type Track } from '../core/track.js'
import { springs as springDefinitions } from '../core/transition.js'
import { createOwnership } from '../core/ownership.js'
import { validateProgress } from '../core/playback.js'
import { presets as builtins } from '../core/presets.js'
import { compose, poseAt, formatPose, type Contribution, type Rest } from './compose.js'
import { SpringValueNode, type WebSpringOptions } from './spring-value.js'
import { FrameScheduler, type FrameTask } from './scheduler.js'
import { numericMap, type NumericMapOptions } from '../core/numeric-map.js'
import {
  ScrollValueNode,
  ScrollLinkedNode,
  scrollPlan,
  type WebScrollSource,
  type WebScrollValue,
  type WebScrollKeyframes,
  type WebScrollOptions,
  type WebScrollLink,
} from './scroll.js'
import {
  NumericValue,
  DerivedValueNode,
  ColorMappedNode,
  type WebReadableValue,
  type WebBindings,
  type WebBinding,
} from './value.js'
import { flatten, sampled, type Point } from './curve.js'
import { prepare, type Plan } from './plan.js'
import { readProperty, resolveProperty, parseColor } from './style.js'
import {
  SizeOperation,
  validateSize,
  type WebSizeOptions,
  type WebSizeValues,
} from './size.js'
import { LayoutOperation, validateLayout, type WebLayoutOptions } from './layout.js'
import { sceneSteps, type WebSeekableStep, type WebSceneOptions } from './scene.js'
import {
  coreProperty,
  expand,
  isColor,
  isRadius,
  isTransform,
  keyframeProperties,
  transformProperties,
  cssName,
  type KeyframeProperty,
} from './properties.js'
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
interface LiveEntry {
  property: Property
  source: NumericValue
  cleanup?: () => void
}
interface ValueEntry extends Entry {
  source: NumericValue
  cancel(): void
}
interface State {
  bindings: Map<string, LiveEntry>
  entries: Map<string, Entry>
  rest: Map<string, Rest>
}
const clone = (state: State): State => ({
  bindings: new Map(state.bindings),
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
  path: 'finite' | 'scheduler' | 'scroll-timeline' = 'finite'
  private original: { transform: string; opacity: string }
  private written: { transform: string; opacity: string }
  private readonly paint = new Map<
    string,
    { original: string; priority: string; written: string }
  >()
  private className: string
  private origin: string
  private baseline: string
  private geometryObserver?: ResizeObserver
  private geometryLeases = new Set<object>()
  get geometryObservers() {
    return this.geometryObserver ? 1 : 0
  }
  readonly task: FrameTask = {
    read: () => {
      try {
        this.assert()
      } catch (error) {
        this.runtime.release(this.target)
        throw error
      }
    },
    update: () =>
      !this.disposed &&
      [...this.state.entries.values()].some((e) => !e.owner.paused && !e.owner.pending),
    write: () => {
      if (!this.disposed && this.state.bindings.size && this.path !== 'scroll-timeline')
        this.render(this.runtime.now())
    },
  }
  rest(state = this.state): Rest[] {
    return [
      ...state.rest.values(),
      ...[...state.bindings.values()].map((e) => ({
        property: e.property,
        value: e.source.get(),
      })),
    ]
  }
  render(at: number) {
    this.write(
      formatPose(poseAt(this.snapshot(this.state, at), this.rest()), this.baseline),
    )
  }
  private write(style: {
    transform: string
    opacity: string
    paint?: Record<string, string>
  }) {
    this.target.style.transform = style.transform
    this.target.style.opacity = style.opacity
    this.written = {
      transform: this.target.style.transform,
      opacity: this.target.style.opacity,
    }
    for (const [name, value] of Object.entries(style.paint ?? {})) {
      let held = this.paint.get(name)
      if (!held) {
        held = {
          original: this.target.style.getPropertyValue(name),
          priority: this.target.style.getPropertyPriority(name),
          written: '',
        }
        this.paint.set(name, held)
      }
      this.target.style.setProperty(name, value)
      held.written = this.target.style.getPropertyValue(name)
    }
  }

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
      bindings: new Map(),
      entries: new Map(),
      rest: new Map(
        transformProperties.map((property) => [
          keyOf(property),
          {
            property,
            value: property === 'opacity' ? Number(css.opacity) : identity(property),
          },
        ]),
      ),
    }
  }

  assertDrag() {
    this.assert()
    assertDragSpace(
      this.target,
      new this.runtime.view.DOMMatrix(this.baseline).isIdentity,
    )
  }
  layoutBasis() {
    const view = this.runtime.view
    let matrix = new view.DOMMatrix()
    for (let parent = this.target.parentElement; parent; parent = parent.parentElement) {
      const css = view.getComputedStyle(parent)
      const transform = new view.DOMMatrix(
        css.transform === 'none' ? undefined : css.transform,
      )
      if (!transform.is2D || css.perspective !== 'none')
        throw new Error('A projective ancestor does not have a 2D FLIP inverse.')
      const zoom = parseFloat(css.zoom) || 1
      const scale = css.scale === 'none' ? [1, 1] : css.scale.split(' ').map(Number)
      const rotation =
        css.rotate === 'none'
          ? 0
          : parseFloat(css.rotate.replace(/^z\s+/, '')) *
            (css.rotate.endsWith('rad')
              ? 180 / Math.PI
              : css.rotate.endsWith('turn')
                ? 360
                : 1)
      const individual = new view.DOMMatrix()
        .rotate(rotation)
        .scale(scale[0]!, scale[1] ?? scale[0]!)
      matrix = individual.multiply(transform).scale(zoom).multiply(matrix)
    }
    return matrix
      .scale(parseFloat(view.getComputedStyle(this.target).zoom) || 1)
      .multiply(new view.DOMMatrix(this.baseline))
  }
  assert(allowGeometry = false) {
    const { target, runtime } = this
    if (this.disposed || !target.isConnected || target.ownerDocument !== runtime.document)
      throw new Error('The motion surface is unavailable.')
    const css = runtime.view.getComputedStyle(target)
    // Border-width motion changes a content-box surface's used size and pivot.
    // That is our own geometry change, not an external transform mutation.
    const ownsGeometry =
      this.geometryLeases.size > 0 ||
      [...this.paint.keys()].some((name) => name.endsWith('-width'))
    if (
      target.className !== this.className ||
      (!allowGeometry && !ownsGeometry && css.transformOrigin !== this.origin) ||
      [css.translate, css.rotate, css.scale].some((v) => v !== 'none') ||
      target.getAnimations().some((a) => a !== this.effect) ||
      (['transform', 'opacity'] as const).some(
        (p) => target.style[p] !== this.written[p] || target.style.getPropertyPriority(p),
      ) ||
      [...this.paint].some(
        ([name, held]) =>
          target.style.getPropertyValue(name) !== held.written ||
          target.style.getPropertyPriority(name),
      )
    )
      throw new Error(
        'External style changes require releasing and recreating the motion surface.',
      )
    if (ownsGeometry) {
      this.validateGeometry(css)
      // A live frame can run before ResizeObserver delivery. Accept only the
      // declared geometry change here; the other ownership guards still apply.
      this.origin = css.transformOrigin
    }
    return css
  }

  private validateGeometry(css: CSSStyleDeclaration) {
    if (
      ['inline', 'none', 'contents'].includes(css.display) ||
      css.transitionDuration.split(',').some((v) => parseFloat(v) > 0) ||
      parseFloat(css.transformOrigin.split(' ')[2] ?? '0') !== 0
    )
      throw new TypeError(
        'Geometry refresh needs a transformable 2D box without CSS transitions.',
      )
  }
  refreshGeometry() {
    const css = this.assert(true)
    this.validateGeometry(css)
    // The browser applies the new pivot to the existing transform effect. Its
    // keyframes, logical values, velocity and animation clock need no rebuild.
    this.origin = css.transformOrigin
  }
  observeGeometry(): WebBinding {
    this.refreshGeometry()
    const token = {}
    this.geometryLeases.add(token)
    if (!this.geometryObserver) {
      this.geometryObserver = new this.runtime.view.ResizeObserver(() => {
        if (this.disposed) return
        try {
          this.refreshGeometry()
        } catch (error) {
          this.runtime.release(this.target)
          this.runtime.view.reportError(error)
        }
      })
      this.geometryObserver.observe(this.target, { box: 'border-box' })
    }
    return {
      dispose: () => {
        if (this.geometryLeases.has(token) && !this.disposed && this.target.isConnected)
          this.origin = this.runtime.view.getComputedStyle(this.target).transformOrigin
        if (!this.geometryLeases.delete(token)) return
        if (!this.geometryLeases.size) {
          this.geometryObserver?.disconnect()
          this.geometryObserver = undefined
        }
      },
    }
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
    if (state.bindings.size) {
      const current = formatPose(
        poseAt(this.snapshot(state, at, controls), this.rest(state)),
        this.baseline,
      )
      const nodes = [...state.bindings.values()].map((e) => e.source)
      const first = nodes[0]
      const Timeline = (
        this.runtime.view as unknown as {
          ScrollTimeline?: new (options: {
            source: Element
            axis: 'y'
          }) => AnimationTimeline
        }
      ).ScrollTimeline
      if (
        Timeline &&
        this.runtime.view.CSS.supports('animation-range-start', '1px') &&
        first instanceof ScrollLinkedNode &&
        first.native &&
        nodes.every(
          (n) =>
            n instanceof ScrollLinkedNode &&
            n.native &&
            n.scroll === first.scroll &&
            n.range[0] === first.range[0] &&
            n.range[1] === first.range[1],
        ) &&
        [...state.entries.values()].every((e) => {
          const c = controls.get(e.owner)
          return c ? c.paused || c.pending : e.owner.paused || e.owner.pending
        })
      ) {
        const values = nodes as ScrollLinkedNode[]
        const rests = [
          ...state.rest.values(),
          ...values
            .filter((n) => n.spatiallyReduced)
            .map((n) => ({ property: n.property, value: n.get() })),
        ]
        const entries = [
          ...this.snapshot(state, at, controls),
          ...values
            .filter((n) => !n.spatiallyReduced)
            .map((n) => ({
              property: n.property,
              points: n.points,
              time: 0,
              paused: false,
            })),
        ]
        const compiled = compose(entries, rests, this.baseline, this.runtime.maxKeyframes)
        let animation: globalThis.Animation | undefined
        try {
          if (compiled.frames.length) {
            animation = new this.runtime.view.Animation(
              new this.runtime.view.KeyframeEffect(this.target, compiled.frames, {
                duration: 'auto',
                fill: 'both',
                easing: 'linear',
              }),
              new Timeline({ source: first.scroll.element, axis: 'y' }),
            )
            const ranged = animation as globalThis.Animation & {
              rangeStart: string
              rangeEnd: string
            }
            if (!('rangeStart' in animation))
              throw new Error('Animation ranges are unsupported.')
            ranged.rangeStart = `${first.range[0]}px`
            ranged.rangeEnd = `${first.range[1]}px`
            void animation.finished.catch(() => {})
          }
          return { ...compiled, ...current, animation, path: 'scroll-timeline' as const }
        } catch {
          animation?.cancel()
        }
      }
      return {
        ...current,
        duration: 0,
        frames: [] as Keyframe[],
        animation: undefined as globalThis.Animation | undefined,
        path: 'scheduler' as const,
      }
    }
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
    return { ...result, animation, path: 'finite' as const }
  }

  commit(state: State, prepared: ReturnType<Surface['prepare']>) {
    const previous = this.effect
    this.write(prepared)
    this.state = state
    this.effect = prepared.animation
    this.path = prepared.path
    this.frameCount = prepared.frames.length
    this.rebuilds++
    owners.set(this.target, this)
    previous?.cancel()
    if (this.effect && this.path !== 'scroll-timeline') {
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
    this.geometryObserver?.disconnect()
    this.geometryObserver = undefined
    this.geometryLeases.clear()
    this.effect?.cancel()
    this.effect = undefined
    for (const property of ['transform', 'opacity'] as const)
      if (
        this.target.style[property] === this.written[property] &&
        !this.target.style.getPropertyPriority(property)
      )
        this.target.style[property] = this.original[property]
    for (const [name, held] of this.paint)
      if (
        this.target.style.getPropertyValue(name) === held.written &&
        !this.target.style.getPropertyPriority(name)
      ) {
        if (held.original)
          this.target.style.setProperty(name, held.original, held.priority)
        else this.target.style.removeProperty(name)
      }
    this.paint.clear()
    this.runtime.scheduler.remove(this.task)
    for (const entry of this.state.bindings.values()) entry.cleanup?.()
    this.state.bindings.clear()
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
  private readonly drags = new Map<HTMLElement, ReturnType<typeof createDrag>>()
  private readonly sizes = new Map<HTMLElement, SizeOperation>()
  private readonly layouts = new Map<HTMLElement, LayoutOperation>()
  private nextLayout = 0
  private nextPress = 0
  private readonly preference: MediaQueryList
  private reported: boolean
  private disposed = false
  private pendingFrame?: FrameTask
  readonly scheduler: FrameScheduler
  private readonly values = new Set<NumericValue>()
  private readonly valueTracks = new Map<NumericValue, ValueEntry>()
  private readonly valueTask: FrameTask = {
    update: () => {
      this.sampleValues()
      return [...this.valueTracks.values()].some(
        (e) => !e.owner.paused && !e.owner.pending && !e.owner.settled,
      )
    },
  }
  private readonly scrollSources = new Set<ScrollValueNode>()
  private readonly scrollLinks = new Map<
    HTMLElement,
    Set<WebScrollLink & { owns(): boolean }>
  >()
  private readonly nodes = new WeakMap<object, NumericValue>()
  private readonly visibility = () => this.scheduler.hidden(this.document.hidden)
  private readonly report = (error: unknown) => this.view.reportError(error)

  constructor(
    readonly document: Document,
    options: RuntimeOptions = {},
  ) {
    const view = document?.defaultView
    if (!view)
      throw new TypeError('A live document is required to create the Web runtime.')
    this.view = view as Realm
    this.scheduler = new FrameScheduler({
      now: () => this.now(),
      request: (callback) => this.view.requestAnimationFrame(callback),
      cancel: (id) => this.view.cancelAnimationFrame(id),
      error: this.report,
    })
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
    this.document.addEventListener('visibilitychange', this.visibility)
    this.visibility()
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

  refresh(target: HTMLElement) {
    this.assert()
    this.targets(target)
    const surface = this.surfaces.get(target)
    if (!surface)
      throw new Error('Claim the motion surface before refreshing its geometry.')
    surface.refreshGeometry()
  }
  observeGeometry(target: HTMLElement): WebBinding {
    this.assert()
    this.targets(target)
    const surface = this.surfaces.get(target)
    if (!surface)
      throw new Error('Claim the motion surface before observing its geometry.')
    return surface.observeGeometry()
  }

  animateSize(
    target: HTMLElement,
    values: WebSizeValues,
    changeOrOptions?: (() => void) | WebSizeOptions | SpringName,
    options?: WebSizeOptions | SpringName,
  ) {
    this.assert()
    this.targets(target)
    const change = typeof changeOrOptions === 'function' ? changeOrOptions : undefined
    const config = change
      ? options
      : (changeOrOptions as WebSizeOptions | SpringName | undefined)
    validateSize(values, change, config)
    let operation: SizeOperation | undefined
    operation = new SizeOperation(
      target,
      { ...values },
      change,
      config,
      {
        scheduler: this.scheduler,
        settings: () => ({
          timeScale: this.settings.timeScale,
          reducedMotion: this.reduced(),
        }),
        geometry: (target) => this.geometryLease(target),
        forget: () => {
          if (this.sizes.get(target) === operation) this.sizes.delete(target)
        },
      },
      this.sizes.get(target),
    )
    this.sizes.set(target, operation)
    return operation
  }

  private geometryLease(target: HTMLElement) {
    let surface = this.surfaces.get(target)
    if (!surface) {
      surface = new Surface(this, target)
      this.transaction(new Map([[surface, clone(surface.state)]]), this.now())
    }
    return surface.observeGeometry()
  }
  animateLayout(
    container: HTMLElement,
    changeOrOptions?: (() => void) | WebLayoutOptions | SpringName,
    options?: WebLayoutOptions | SpringName,
  ) {
    this.assert()
    this.targets(container)
    const change = typeof changeOrOptions === 'function' ? changeOrOptions : undefined
    const config = change
      ? options
      : (changeOrOptions as WebLayoutOptions | SpringName | undefined)
    validateLayout(change, config)
    const layer = `jolt:layout:${++this.nextLayout}`
    let operation: LayoutOperation | undefined
    operation = new LayoutOperation(
      container,
      change,
      config,
      {
        scheduler: this.scheduler,
        geometry: (target) => this.geometryLease(target),
        basis: (target) => this.surfaces.get(target)!.layoutBasis(),
        scale: (target) => {
          const surface = this.surfaces.get(target)
          const at = this.document.timeline.currentTime
          const value = (property: 'scaleX' | 'scaleY') => {
            const key = keyOf(property, layer),
              entry = surface?.state.entries.get(key)
            // Match the presented document tick used by getBoundingClientRect.
            return entry
              ? sampled(
                  entry.points,
                  entry.owner.time(typeof at === 'number' ? at : undefined),
                )
              : (surface?.state.rest.get(key)?.value ?? 1)
          }
          return { x: value('scaleX'), y: value('scaleY') }
        },
        set: (target, values) => {
          this.play(target, values, { duration: 0 }, layer)
        },
        animate: (target, values, options) => this.play(target, values, options, layer),
        clear: (target) => {
          const surface = this.surfaces.get(target)
          if (!surface || surface.disposed || !target.isConnected) return
          const state = clone(surface.state)
          for (const property of properties) {
            state.entries.delete(keyOf(property, layer))
            state.rest.delete(keyOf(property, layer))
          }
          try {
            this.transaction(new Map([[surface, state]]), this.now())
          } catch {
            this.release(target)
          }
        },
        forget: () => {
          if (this.layouts.get(container) === operation) {
            this.layouts.delete(container)
            this.observe()
          }
        },
      },
      this.layouts.get(container),
    )
    this.layouts.set(container, operation)
    this.observe()
    return operation
  }

  motionValue(initial: number) {
    this.assert()
    const node = new NumericValue(this.scheduler, initial, this.report, () =>
      this.values.delete(node),
    )
    return this.valueHandle(node, node.handle())
  }

  private valueHandle<T extends Omit<WebReadableValue, 'to'>>(
    node: NumericValue,
    handle: T,
  ) {
    const result = Object.assign(handle, {
      to: ((
        input: readonly number[],
        output: readonly number[] | readonly string[],
        options?: NumericMapOptions,
      ) => {
        this.assert()
        if (output.some((v) => typeof v === 'string')) {
          if (!output.every((v) => typeof v === 'string'))
            throw new TypeError('A color mapping requires color strings for every stop.')
          const colors = output.map((value) => parseColor(this.document, value))
          const mapped = new ColorMappedNode(
            node,
            input,
            colors,
            options,
            this.report,
            () => this.values.delete(mapped),
          )
          const result = mapped.colorHandle()
          this.values.add(mapped)
          this.nodes.set(result, mapped)
          return result
        }
        const mapped = new DerivedValueNode(
          node,
          numericMap(input, output as readonly number[], options),
          this.report,
          () => this.values.delete(mapped),
        )
        return this.valueHandle(mapped, mapped.readableHandle())
      }) as WebReadableValue['to'],
    })
    this.values.add(node)
    this.nodes.set(result, node)
    return result
  }

  private scrollNode(source: WebScrollSource) {
    const node = new ScrollValueNode(
      this.document,
      source,
      this.scheduler,
      this.report,
      () => {
        this.values.delete(node)
        this.scrollSources.delete(node)
        this.observe()
      },
    )
    this.scrollSources.add(node)
    this.values.add(node)
    this.observe()
    return node
  }
  scrollValue(source: WebScrollSource = this.document): WebScrollValue {
    this.assert()
    const node = this.scrollNode(source)
    return this.valueHandle(
      node,
      Object.assign(node.readableHandle(), { refresh: () => node.refresh() }),
    )
  }
  scrollLinked(
    source: WebScrollSource,
    target: HTMLElement,
    frames: WebScrollKeyframes,
    options: WebScrollOptions,
  ): WebScrollLink {
    this.assert()
    this.targets(target)
    const plan = scrollPlan(frames, options)
    const scroll = this.scrollNode(source)
    const nodes = new Set<ScrollLinkedNode>()
    let binding: WebBinding | undefined
    try {
      const values: WebBindings = {}
      for (const [property, entry] of plan.plans) {
        const node = new ScrollLinkedNode(
          scroll,
          property,
          plan.range,
          entry.points,
          plan.native,
          entry.input,
          entry.output,
          () => this.reduced(),
          this.report,
          () => this.values.delete(node),
        )
        nodes.add(node)
        values[property] = this.valueHandle(node, node.readableHandle())
      }
      binding = this.bind(target, values)
    } catch (error) {
      for (const node of nodes) node.dispose()
      scroll.dispose()
      throw error
    }
    const surface = this.surfaces.get(target)!
    let ended = false
    const link: WebScrollLink & { owns(): boolean } = {
      owns: () =>
        !ended &&
        !surface.disposed &&
        [...surface.state.bindings.values()].some((b) =>
          nodes.has(b.source as ScrollLinkedNode),
        ),
      get execution() {
        return link.owns()
          ? surface.path === 'scroll-timeline'
            ? 'scroll-timeline'
            : 'scheduler'
          : 'released'
      },
      refresh: () => {
        if (ended) return
        scroll.refresh()
        if (ended || scroll.disposed) return
        surface.refreshGeometry()
        this.transaction(new Map([[surface, clone(surface.state)]]), this.now())
      },
      dispose: () => {
        if (ended) return
        ended = true
        const links = this.scrollLinks.get(target)
        links?.delete(link)
        if (!links?.size) this.scrollLinks.delete(target)
        binding?.dispose()
        for (const node of nodes) node.dispose()
        scroll.dispose()
      },
    }
    const links = this.scrollLinks.get(target) ?? new Set()
    links.add(link)
    this.scrollLinks.set(target, links)
    scroll.onDispose(link.dispose)
    return link
  }

  springValue(source: WebReadableValue, options: WebSpringOptions = {}) {
    this.assert()
    const input = this.nodes.get(source)
    if (!input || input.disposed || input.kind !== 'number')
      throw new TypeError(
        'A continuous spring requires a live input motion value from this runtime.',
      )
    const node = new SpringValueNode(
      this.scheduler,
      input,
      options,
      () => ({ reduced: this.reduced(), timeScale: this.settings.timeScale }),
      this.report,
      () => this.values.delete(node),
    )
    return this.valueHandle(node, node.springHandle())
  }

  bind(target: HTMLElement, values: WebBindings): WebBinding {
    this.assert()
    this.targets(target)
    if (!values || typeof values !== 'object' || !Object.keys(values).length)
      throw new TypeError('bind() requires numeric motion values.')
    const surface = this.surfaces.get(target) ?? new Surface(this, target)
    const state = clone(surface.state)
    const added = new Map<string, LiveEntry>()
    for (const [name, value] of Object.entries(values)) {
      if (!keyframeProperties.includes(name as KeyframeProperty))
        throw new TypeError('Unsupported binding property.')
      const source = this.nodes.get(value)
      if (!source || source.disposed)
        throw new TypeError('Bindings require a live value from this runtime.')
      for (const property of expand(name as KeyframeProperty)) {
        if (name !== property && values[property]) continue
        if (name === 'borderRadius' && values[property.slice(0, -1) as KeyframeProperty])
          continue
        if (isColor(property) !== (source.kind === 'color'))
          throw new TypeError(
            'Color channels require a color mapping; numeric channels require numeric values.',
          )
        this.ensureRadius(state, surface, property)
        const key = keyOf(property),
          entry = { property, source }
        state.entries.delete(key)
        state.rest.delete(key)
        state.bindings.set(key, entry)
        added.set(key, entry)
      }
    }
    this.transaction(new Map([[surface, state]]), this.now())
    return { dispose: () => this.unbind(surface, added) }
  }

  private unbind(surface: Surface, selected: ReadonlyMap<string, LiveEntry>) {
    if (surface.disposed) return
    if (!surface.target.isConnected || surface.target.ownerDocument !== this.document) {
      this.release(surface.target)
      return
    }
    const state = clone(surface.state)
    for (const [key, entry] of selected)
      if (state.bindings.get(key) === entry) {
        state.bindings.delete(key)
        this.rest(state, key, entry.property, entry.source.get())
      }
    if (state.bindings.size !== surface.state.bindings.size) {
      try {
        this.transaction(new Map([[surface, state]]), this.now())
      } catch (error) {
        this.release(surface.target)
        throw error
      }
    }
  }

  animate(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    return this.play(target, animation, options)
  }

  seekableTimeline(
    steps: readonly WebSeekableStep[],
    options: WebSceneOptions = {},
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    this.assert()
    const leaves = sceneSteps(steps, options)
    const prepared: {
      surface?: Surface
      source?: NumericValue
      plan: Plan
      track: Track
      points: Point[]
    }[] = []
    const surfaces = new Map<HTMLElement, Surface>()
    const claimed = new Map<object, Set<string>>()
    for (const leaf of leaves) {
      const source = 'value' in leaf ? this.nodes.get(leaf.value) : undefined
      let surface: Surface | undefined
      if ('value' in leaf) {
        if (!source || source.disposed || source.constructor !== NumericValue)
          throw new TypeError(
            'Scene values must be mutable numeric inputs owned by this runtime.',
          )
      } else {
        this.targets(leaf.target)
        surface =
          surfaces.get(leaf.target) ??
          this.surfaces.get(leaf.target) ??
          new Surface(this, leaf.target)
        surface.assert()
        surfaces.set(leaf.target, surface)
      }
      const transition =
        typeof leaf.transition === 'string'
          ? { ...springDefinitions[leaf.transition], layer: leaf.layer }
          : { ...(leaf.transition ?? { duration: 300 }), layer: leaf.layer }
      if (
        typeof leaf.transition === 'string' &&
        !Object.hasOwn(springDefinitions, leaf.transition)
      )
        throw new TypeError('Unknown scene spring.')
      const frames: Keyframes =
        'value' in leaf ? { opacity: leaf.keyframes } : leaf.keyframes
      const plans = prepare(frames, transition, this.presets, 1)[0]!
      const target = surface?.target ?? source!
      let keys = claimed.get(target)
      if (!keys) claimed.set(target, (keys = new Set()))
      for (const plan of plans) {
        const key = keyOf(plan.property, plan.layer)
        if (keys.has(key))
          throw new TypeError(
            'Each scene channel has one descriptor; combine its movements into keyframes.',
          )
        keys.add(key)
        plan.transition = { ...plan.transition, delay: plan.transition.delay + leaf.at }
        const values = plan.frames.map((v) => {
          if (v === null) throw new TypeError('Scene keyframes must be explicit.')
          if (surface)
            return resolveProperty(surface.target, plan.property, plan.source, v)
          if (typeof v !== 'number' || !Number.isFinite(v))
            throw new TypeError('Scene value tracks require finite numbers.')
          return v
        })
        const track = createTrack(
          coreProperty(plan.property),
          values,
          plan.transition,
          0,
          { timeScale: this.settings.timeScale, reducedMotion: this.reduced() },
        )
        prepared.push({
          surface,
          source,
          plan,
          track,
          points: flatten(track, this.maxKeyframes),
        })
      }
    }
    const at = this.now(),
      owner = new Owner(this, Math.max(0, ...prepared.map((p) => p.track.end)), at)
    const proposals = new Map<Surface, State>(),
      valueEntries: ValueEntry[] = []
    for (const item of prepared) {
      const { surface, source, plan, track, points } = item
      const entry: Entry = {
        property: plan.property,
        layer: plan.layer,
        track,
        points,
        owner,
      }
      if (surface) {
        const state = proposals.get(surface) ?? clone(surface.state)
        this.ensureRadius(state, surface, plan.property)
        const key = keyOf(plan.property, plan.layer)
        state.rest.delete(key)
        state.bindings.delete(key)
        state.entries.set(key, entry)
        proposals.set(surface, state)
      } else {
        const value: ValueEntry = {
          ...entry,
          source: source!,
          cancel: () => this.removeValue(value, false),
        }
        valueEntries.push(value)
        owner.entries.add(value)
      }
    }
    this.transaction(
      proposals,
      at,
      new Map([
        [
          owner,
          {
            time: 0,
            paused: options.paused ?? false,
            pending: this.document.timeline.currentTime === null,
          },
        ],
      ]),
    )
    for (const entry of valueEntries) {
      entry.source.claimWriter(entry.cancel)
      this.valueTracks.set(entry.source, entry)
    }
    this.sampleValues()
    if (valueEntries.length && !owner.paused) this.scheduler.add(this.valueTask)
    owner.refresh(at)
    return owner
  }

  private sampleValues() {
    const at = this.now()
    for (const entry of this.valueTracks.values()) {
      const time = entry.owner.time(at)
      entry.source.writeSample(
        entry.track.valueAt(time),
        entry.owner.paused || entry.owner.pending ? 0 : entry.track.velocityAt(time),
      )
    }
  }
  private removeValue(entry: ValueEntry, completed: boolean) {
    if (this.valueTracks.get(entry.source) !== entry) return
    const time = entry.owner.time()
    this.valueTracks.delete(entry.source)
    entry.source.releaseWriter(entry.cancel)
    entry.source.writeSample(completed ? entry.track.to : entry.track.valueAt(time), 0)
    entry.owner.entries.delete(entry)
    entry.owner.complete &&= completed
    entry.owner.refresh(this.now())
    if (![...this.valueTracks.values()].some((e) => !e.owner.paused && !e.owner.pending))
      this.scheduler.remove(this.valueTask)
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
          : (surface.state.bindings.get(key)?.source.get() ??
            surface.state.rest.get(key)?.value ??
            (plan.layer === undefined
              ? readProperty(element, plan.property)
              : identity(plan.property)))
        const velocity = old
          ? !old.owner.paused && !old.owner.pending
            ? old.track.velocityAt(time)
            : 0
          : (surface.state.bindings.get(key)?.source.getVelocity() ?? 0)
        const values = plan.frames.map((input) => {
          const value =
            input === null
              ? null
              : resolveProperty(element, plan.property, plan.source, input)
          return value === null
            ? from
            : plan.relative && !isColor(plan.property)
              ? multiplicative(plan.property)
                ? from * value
                : from + value
              : value
        })
        const track = createTrack(
          coreProperty(plan.property),
          values,
          plan.transition,
          velocity,
          {
            timeScale: this.settings.timeScale,
            reducedMotion: this.reduced(),
          },
        )
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
        this.ensureRadius(state, surface, plan.property)
        const key = keyOf(plan.property, plan.layer)
        state.entries.delete(key)
        state.bindings.delete(key)
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
      Object.values(values).some((v) => typeof v !== 'number' && typeof v !== 'string')
    )
      throw new TypeError('set() requires one value per property.')
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

  drag(target: HTMLElement, options: WebDragOptions = {}) {
    this.assert()
    this.targets(target)
    if (this.drags.has(target)) throw new Error('The surface already has drag input.')
    const config = dragOptions(options)
    // Validate spring compilation before claiming a surface or changing input styles.
    prepare({ x: 1 }, { type: 'spring', ...config.spring }, this.presets, 1)
    const surface = this.surfaces.get(target) ?? new Surface(this, target)
    surface.assertDrag()
    if (!this.surfaces.has(target))
      this.transaction(new Map([[surface, clone(surface.state)]]), this.now())
    const axes = config.axis === 'both' ? (['x', 'y'] as const) : ([config.axis] as const)
    let binding: WebBinding | undefined
    const inputs = new Map<'x' | 'y', ReturnType<WebRuntime['motionValue']>>()
    const read = () => {
      const at = this.now()
      const channel = (property: 'x' | 'y') => {
        const key = keyOf(property),
          entry = surface.state.entries.get(key)
        return (
          surface.state.bindings.get(key)?.source.get() ??
          (entry
            ? sampled(entry.points, entry.owner.time(at))
            : (surface.state.rest.get(key)?.value ?? 0))
        )
      }
      return { x: channel('x'), y: channel('y') }
    }
    const cleanup = () => {
      const current = binding
      binding = undefined
      const values = [...inputs.values()]
      inputs.clear()
      try {
        current?.dispose()
      } finally {
        for (const value of values) value.dispose()
      }
    }
    const drag = createDrag(target, config, {
      scheduler: this.scheduler,
      read,
      validate: () => surface.assertDrag(),
      begin: () => {
        const current = read()
        try {
          for (const axis of axes) inputs.set(axis, this.motionValue(current[axis]))
          binding = this.bind(target, Object.fromEntries(inputs))
        } catch (error) {
          cleanup()
          throw error
        }
      },
      owns: () =>
        [...inputs].every(
          ([axis, value]) =>
            surface.state.bindings.get(keyOf(axis))?.source === this.nodes.get(value),
        ),
      write: (point) => {
        for (const [axis, value] of inputs) value.set(point[axis])
      },
      cancel: cleanup,
      release: (point, velocity) => {
        try {
          return this.animate(
            target,
            Object.fromEntries(axes.map((axis) => [axis, point[axis]])),
            {
              type: 'spring',
              ...config.spring,
              ...Object.fromEntries(
                axes.map((axis) => [
                  axis,
                  { type: 'spring', ...config.spring, velocity: velocity[axis] },
                ]),
              ),
            },
          )
        } finally {
          cleanup()
        }
      },
      dispose: () => {
        cleanup()
        this.drags.delete(target)
        if (!target.isConnected || target.ownerDocument !== this.document)
          this.release(target)
      },
    })
    this.drags.set(target, drag)
    return drag.handle
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

  private ensureRadius(state: State, surface: Surface, property: Property) {
    if (!isRadius(property)) return
    const sibling =
      `${property.slice(0, -1)}${property.endsWith('X') ? 'Y' : 'X'}` as Property
    const key = keyOf(sibling)
    if (!state.rest.has(key) && !state.entries.has(key) && !state.bindings.has(key))
      state.rest.set(key, {
        property: sibling,
        value: readProperty(surface.target, sibling),
      })
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
          if (data.path !== 'scroll-timeline') data.animation.startTime = at
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
      for (const [key, previous] of surface.state.bindings)
        if (
          state.bindings.get(key) !== previous ||
          surface.path !== prepared.get(surface)!.path
        ) {
          previous.cleanup?.()
          if (!state.entries.has(key) && !state.bindings.has(key))
            this.ownership.invalidate(surface.target, [key])
        }
      for (const [key, entry] of state.bindings)
        if (
          surface.state.bindings.get(key) !== entry ||
          surface.path !== prepared.get(surface)!.path
        ) {
          if (surface.state.bindings.get(key) !== entry)
            this.ownership.claim(surface.target, key)
          const ending = () => this.unbind(surface, new Map([[key, entry]]))
          entry.cleanup =
            prepared.get(surface)!.path === 'scroll-timeline'
              ? entry.source.onDispose(ending)
              : entry.source.listen(() => this.scheduler.add(surface.task), ending)
        }
      surface.commit(state, prepared.get(surface)!)
      if (state.bindings.size && surface.path !== 'scroll-timeline')
        this.scheduler.add(surface.task)
      else this.scheduler.remove(surface.task)
      this.surfaces.set(surface.target, surface)
    }
    for (const owner of affected) {
      if (!owner.settled) this.animations.add(owner)
      owner.refresh(at)
    }
    this.observe()
    this.schedulePending()
    for (const drag of this.drags.values()) drag.refresh()
    for (const links of [...this.scrollLinks.values()])
      for (const link of [...links]) if (!link.owns()) link.dispose()
  }

  control(owner: Owner, control: Control) {
    this.assert()
    const proposals = new Map<Surface, State>()
    for (const surface of this.surfaces.values())
      if ([...surface.state.entries.values()].some((e) => e.owner === owner))
        proposals.set(surface, clone(surface.state))
    this.transaction(proposals, this.now(), new Map([[owner, control]]))
    this.sampleValues()
    if ([...this.valueTracks.values()].some((e) => !e.owner.paused && !e.owner.pending))
      this.scheduler.add(this.valueTask)
    else this.scheduler.remove(this.valueTask)
  }

  stopOwner(owner: Owner) {
    for (const entry of [...this.valueTracks.values()])
      if (entry.owner === owner) this.removeValue(entry, false)
    this.remove((entry) => entry.owner === owner, false)
  }
  completeOwner(owner: Owner) {
    if (owner.settled || owner.paused || owner.pending) return
    try {
      for (const entry of [...this.valueTracks.values()])
        if (entry.owner === owner) this.removeValue(entry, true)
      this.remove((entry) => entry.owner === owner, true)
    } catch {
      for (const [target, surface] of this.surfaces)
        if ([...surface.state.entries.values()].some((e) => e.owner === owner))
          this.release(target)
    }
  }

  stop(
    target: HTMLElement | readonly HTMLElement[],
    selected?: readonly KeyframeProperty[],
    options?: { layer?: string },
  ) {
    this.assert()
    const targets = new Set(this.targets(target))
    const names = selected?.flatMap(expand)
    if (names?.some((p) => !properties.includes(p as Property)))
      throw new TypeError('Unsupported property to stop.')
    for (const surface of this.surfaces.values())
      if (targets.has(surface.target) && options?.layer === undefined)
        this.unbind(
          surface,
          new Map(
            [...surface.state.bindings].filter(
              ([, entry]) => !names || names.includes(entry.property),
            ),
          ),
        )
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
            completed
              ? entry.track.to
              : sampled(entry.points, entry.owner.time(at), 'right', entry.property),
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
    for (const value of this.values)
      if (value instanceof SpringValueNode) value.preferenceChanged()
    for (const size of this.sizes.values()) size.reduced()
    if (reduced) {
      try {
        this.remove(
          (entry) => entry.property !== 'opacity' && !isColor(entry.property),
          true,
        )
      } catch {
        for (const target of [...this.surfaces.keys()]) this.release(target)
      }
    }
    const scroll = new Map<Surface, State>()
    for (const surface of this.surfaces.values())
      if (
        [...surface.state.bindings.values()].some(
          (e) => e.source instanceof ScrollLinkedNode,
        )
      )
        scroll.set(surface, clone(surface.state))
    if (scroll.size) this.transaction(scroll, this.now())
  }

  private schedulePending() {
    if (this.pendingFrame !== undefined || ![...this.animations].some((a) => a.pending))
      return
    const task: FrameTask = {
      update: () => {
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
      },
    }
    this.pendingFrame = task
    this.scheduler.add(task)
  }

  private observe() {
    const roots = new Set<Node>()
    if (this.surfaces.size || this.scrollSources.size || this.layouts.size)
      roots.add(this.document)
    for (const source of this.scrollSources) roots.add(source.element.getRootNode())
    for (const surface of this.surfaces.values()) roots.add(surface.target.getRootNode())
    for (const [root, observer] of this.observers)
      if (!roots.has(root)) {
        observer.disconnect()
        this.observers.delete(root)
      }
    for (const root of roots)
      if (!this.observers.has(root)) {
        const observer = new this.view.MutationObserver(() => {
          for (const [target, layout] of this.layouts)
            if (!target.isConnected || target.ownerDocument !== this.document)
              layout.stop()
          for (const source of [...this.scrollSources])
            if (
              !source.element.isConnected ||
              source.element.ownerDocument !== this.document
            )
              source.dispose()
          for (const target of [...this.surfaces.keys()])
            if (!target.isConnected || target.ownerDocument !== this.document)
              this.release(target)
          for (const press of this.presses.values()) press.refresh()
          for (const drag of this.drags.values()) drag.refresh()
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
    this.layouts.get(target)?.stop()
    this.layouts.delete(target)
    this.sizes.get(target)?.detach()
    this.sizes.delete(target)
    const surface = this.surfaces.get(target)
    if (surface) surface.disposed = true
    for (const link of [...(this.scrollLinks.get(target) ?? [])]) link.dispose()
    this.drags.get(target)?.detach()
    this.drags.delete(target)
    this.presses.get(target)?.detach()
    this.presses.delete(target)
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
      this.scheduler.remove(this.pendingFrame)
      this.pendingFrame = undefined
    }
  }

  /** Internal diagnostics for conformance fixtures, not a frame subscription. */
  inspect(target: HTMLElement) {
    const surface = this.surfaces.get(target),
      at = this.now()
    return {
      targets: this.surfaces.size,
      values: this.values.size,
      valueAnimations: this.valueTracks.size,
      sizes: this.sizes.size,
      layouts: this.layouts.size,
      scrollSources: this.scrollSources.size,
      scheduler: {
        tasks: this.scheduler.size,
        pending: this.scheduler.pending,
        frames: this.scheduler.frames,
      },
      animations: this.animations.size,
      observers: this.observers.size,
      geometryObservers: [...this.surfaces.values()].reduce(
        (sum, s) => sum + s.geometryObservers,
        0,
      ),
      pendingFrame: this.pendingFrame !== undefined,
      ...(surface && {
        pose: poseAt(surface.snapshot(surface.state, at), surface.rest()),
        bindings: surface.state.bindings.size,
        execution: surface.path,
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
    this.document.removeEventListener('visibilitychange', this.visibility)
    for (const layout of this.layouts.values()) layout.stop()
    for (const target of [...this.surfaces.keys()]) this.release(target)
    for (const observer of this.observers.values()) observer.disconnect()
    this.observers.clear()
    for (const value of [...this.values]) value.dispose()
    this.scheduler.dispose()
    this.pendingFrame = undefined
    this.presets.clear()
  }
}

export const createWebRuntime = (document: Document, options?: RuntimeOptions) =>
  new WebRuntime(document, options)
