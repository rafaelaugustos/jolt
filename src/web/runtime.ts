import { createWebListChanges, type WebListChangesOptions } from './list-changes.js'
import type { ListChanges } from '../core/list-changes.js'
import { scalarOperations } from '../core/scalar.js'
import { createGradientText, type WebGradientTextOptions } from './gradient-text.js'
import { limitRigTrack, type RigChannel, type RigDefinition } from '../core/rig.js'
import { createRig, type WebRig } from './rig.js'
import {
  createMotionBehaviors,
  type MotionBehaviors,
  type MotionBehaviorsOptions,
} from '../core/motion-behaviors.js'
import type { WebMotionBehavior } from './behaviors.js'
import {
  createTimelineCues,
  type TimelineCue,
  type TimelineCueOptions,
} from '../core/timeline-cues.js'
import { compilePath, type PathProperty } from '../core/path-track.js'
import type { MotionPath } from '../core/svg-path.js'
import {
  createInteractiveNavigation,
  type WebInteractiveNavigationOptions,
} from './interactive-navigation.js'
import { createDropZones, type WebDropZoneOptions } from './drop-zones.js'
import {
  PropertyTarget,
  createPropertyGroup,
  type WebProperty,
  type WebPropertyDefinition,
  type WebPropertyGroup,
} from './property.js'
import {
  createNavigationEntry,
  type WebNavigationEntryOptions,
} from './navigation-entry.js'
import { createGlass, type WebGlassOptions } from './glass.js'
import {
  createSensor,
  SensorValueNode,
  type WebSensorKind,
  type WebSensorOptions,
} from './sensors.js'
import { animationHaptics, requestHaptic } from './haptics.js'
import { resolveHaptic, type HapticStyle } from '../core/haptic.js'
import {
  createKeyboardSubscription,
  createKeyboardFollower,
  type WebKeyboardState,
  type WebKeyboardOptions,
} from './keyboard.js'
import { createBottomSheet, type WebBottomSheetOptions } from './bottom-sheet.js'
import {
  createInteractiveModal,
  type WebInteractiveModalOptions,
} from './interactive-modal.js'
import {
  createSharedNavigation,
  type WebSharedNavigationOptions,
} from './shared-navigation.js'
import {
  createPhysicsWorld,
  type WebCircleBody,
  type WebPhysicsOptions,
} from './physics.js'
import {
  createSymbolEffect,
  type WebSymbolEffectName,
  type WebSymbolEffectOptions,
} from './symbol-effect.js'
import type { PlatformHost } from './platform-host.js'
import {
  createParticles,
  createConfetti,
  type WebParticleOptions,
  type WebConfettiOptions,
} from './particles.js'
import { createBlur, type WebBlurOptions } from './blur.js'
import { createShape, type WebShapeOptions } from './shape.js'
import { createDrawing } from './drawing.js'
import type { DrawingOptions } from '../core/drawing.js'
import { createLiquid, type WebLiquidOptions } from './liquid.js'
import {
  createImageEffect,
  type WebImageEffectName,
  type WebImageEffectOptions,
} from './image-effect.js'
import { createZoomable, type WebZoomableOptions } from './zoomable.js'
import { createGradient, type WebGradientOptions } from './gradient.js'
import {
  createShimmer,
  createLoader,
  type WebShimmerOptions,
  type WebLoaderOptions,
} from './loading.js'
import type { EffectHost } from './effect.js'
import { createReveal, type WebRevealOptions, type WebConcealOptions } from './reveal.js'
import {
  createTextAnimation,
  createRoll,
  type WebTextOptions,
  type WebRollOptions,
} from './text-effect.js'
import { createScrollHeader, type WebScrollHeaderOptions } from './scroll-header.js'
import { createReorder, type WebReorderOptions } from './reorder.js'
import type { ReorderKey } from '../core/reorder.js'
import { createGestures, type WebGesturesOptions } from './gestures.js'
import type { InteractionHost, WebInteraction, OwnedBinding } from './interaction.js'
import { StrokeSurface, type WebPathOptions } from './stroke.js'
import {
  createItemsAnimation,
  type WebItem,
  type WebItemsOptions,
  type WebItemsAnimation,
} from './items.js'
import {
  createMotionStates,
  type WebMotionStates,
  type WebMotionState,
  type WebMotionDefinitions,
  type WebMotionStatesOptions,
} from './motion-states.js'
import { ContextTimers } from './timers.js'
import { composePrepared, type TimelineAnimation } from '../core/sequence.js'
import { sequenceSteps, type WebStep, type WebTimelineStep } from './sequence.js'
import { decayPlans, type WebDecayOptions, type WebDecayVelocity } from './decay.js'
import { ProgressNode } from './progress.js'
import {
  registerPlayback,
  playbackSource,
  type Animation as MotionAnimation,
} from '../core/playback.js'
import { setArrival, setArrivalTiming } from '../core/arrival.js'
import { valuePlan, valueTrack, type WebValueAnimationOptions } from './value-playback.js'
import {
  createDrag,
  dragOptions,
  dragPlans,
  dragCurve,
  assertDragSpace,
  type WebDragOptions,
} from './drag.js'
import { createWebScope, type WebMotionScope, type WebMotionResource } from './scope.js'
import {
  createPointerFollow,
  type WebPointerFollow,
  type WebPointerOptions,
} from './pointer.js'
import {
  createViewportEntrance,
  type WebViewportEntrance,
  type WebViewportOptions,
} from './viewport.js'
import { renderedAncestors } from './geometry.js'
import {
  DiagnosticCollector,
  type WebDiagnosticReason,
  type WebDiagnosticSnapshot,
  type WebDiagnostics,
  type WebDiagnosticsOptions,
} from './diagnostics.js'
import {
  createSharedLayout,
  type WebSharedLayout,
  type WebSharedLayoutOptions,
} from './shared-layout.js'
import { createTrack, type Track } from '../core/track.js'
import { springs as springDefinitions, resolveTransition } from '../core/transition.js'
import { createOwnership } from '../core/ownership.js'
import { validateProgress } from '../core/playback.js'
import { presets as builtins } from '../core/presets.js'
import { compose, poseAt, formatPose, type Contribution, type Rest } from './compose.js'
import { SpringValueNode, type WebSpringOptions } from './spring-value.js'
import { FrameScheduler, type FrameTask } from './scheduler.js'
import { numericMap, type NumericMapOptions } from '../core/numeric-map.js'
import { ElementScrollRange, type WebElementScrollRange } from './scroll-range.js'
import { surfaceConflict, type StyleConflict } from './surface-conflict.js'
import {
  scrollAxis,
  type WebScrollValueOptions,
  ScrollValueNode,
  ScrollLinkedNode,
  nativeScrollBinding,
  type NativeScrollBinding,
  scrollPlan,
  type WebScrollSource,
  type WebScrollValue,
  type WebScrollKeyframes,
  type WebScrollOptions,
  type WebScrollLink,
} from './scroll.js'
import {
  NumericValue,
  MotionInputNode,
  DerivedValueNode,
  ColorMappedNode,
  ArithmeticValueNode,
  type WebValueHandle,
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
  isShadow,
  shadowProperties,
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
  layer?: string
  property: Property
  source: NumericValue
  cleanup?: () => void
}
interface ValueEntry extends Entry {
  source: MotionInputNode
}
interface ValueState {
  source: MotionInputNode
  entries: Map<string, ValueEntry>
  rests: Map<string, number>
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
  private geometrySize: { width: string; height: string }
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
    this.geometrySize = { width: css.width, height: css.height }
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
    if (!new view.DOMMatrix(view.getComputedStyle(this.target).transform).is2D)
      throw new Error('A surface with 3D rotation does not have a 2D FLIP inverse.')
    let matrix = new view.DOMMatrix()
    for (const parent of renderedAncestors(this.target)) {
      if (parent === this.target) continue
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
    const changes: StyleConflict[] = []
    const changed = (property: string, previous: string, current: string) => {
      if (previous !== current) changes.push({ property, previous, current })
    }
    changed('class', this.className, target.className)
    if (!allowGeometry && !ownsGeometry && css.transformOrigin !== this.origin) {
      changed('transform-origin', this.origin, css.transformOrigin)
      changed('width', this.geometrySize.width, css.width)
      changed('height', this.geometrySize.height, css.height)
    }
    for (const property of ['translate', 'rotate', 'scale'] as const)
      changed(property, 'none', css[property])
    const foreign = target
      .getAnimations()
      .filter((animation) => animation !== this.effect)
    if (foreign.length)
      changed(
        'animations',
        'none',
        foreign.map((animation) => animation.id || animation.constructor.name).join(', '),
      )
    for (const property of ['transform', 'opacity'] as const) {
      changed(property, this.written[property], target.style[property])
      changed(`${property} priority`, '', target.style.getPropertyPriority(property))
    }
    for (const [property, held] of this.paint) {
      changed(property, held.written, target.style.getPropertyValue(property))
      changed(`${property} priority`, '', target.style.getPropertyPriority(property))
    }
    if (changes.length) throw surfaceConflict(target, changes)
    if (ownsGeometry) {
      this.validateGeometry(css)
      // A live frame can run before ResizeObserver delivery. Accept only the
      // declared geometry change here; the other ownership guards still apply.
      this.origin = css.transformOrigin
      this.geometrySize = { width: css.width, height: css.height }
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
    this.geometrySize = { width: css.width, height: css.height }
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
      const nodes = [...state.bindings.values()].map((e) =>
        nativeScrollBinding(e.source, e.property),
      )
      const first = nodes[0]
      const Timeline = (
        this.runtime.view as unknown as {
          ScrollTimeline?: new (options: {
            source: Element
            axis: 'x' | 'y'
          }) => AnimationTimeline
        }
      ).ScrollTimeline
      if (
        Timeline &&
        this.runtime.view.CSS.supports('animation-range-start', '1px') &&
        first?.native &&
        nodes.every(
          (n) =>
            n?.native &&
            // Singular scale endpoints fail to interpolate on WebKit's scroll timeline.
            // Keep these mappings on the existing scheduler, including signed scales.
            !(
              n.property.startsWith('scale') && n.points.some((point) => point.value <= 0)
            ) &&
            n.scroll === first.scroll &&
            n.range[0] === first.range[0] &&
            n.range[1] === first.range[1],
        ) &&
        [...state.entries.values()].every((e) => {
          const c = controls.get(e.owner)
          return c ? c.paused || c.pending : e.owner.paused || e.owner.pending
        })
      ) {
        const values = nodes as NativeScrollBinding[]
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
              new Timeline({ source: first.scroll.element, axis: first.scroll.axis }),
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
  diagnosticReason?: WebDiagnosticReason
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
  private notify!: () => void
  private arrive!: () => void
  private arrived = false
  private cancelArrival?: () => void
  feedback?: ReturnType<typeof animationHaptics>

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
    this.notify = registerPlayback(this, () => ({
      time: this.time(),
      duration: this.duration,
      paused: this.paused,
      ready: !this.pending,
      settled: this.settled,
      completed: this.complete && this.settled,
    }))
    setArrival(
      this,
      new Promise<void>((resolve) => {
        this.arrive = resolve
      }),
    )
    setArrivalTiming(this, {
      read: () => ({
        remaining: this.pending
          ? undefined
          : Math.max(0, this.arrivalTime() - this.time()),
        paused: this.paused,
        arrived: this.arrived,
      }),
      subscribe: (callback) => playbackSource(this).subscribe(callback),
    })
    runtime.rememberPlayback(this)
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
    if (!Number.isFinite(this.duration))
      throw new RangeError('Progress requires a finite animation.')
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
    this.feedback?.seek(this.duration * value)
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
  stop(properties?: readonly KeyframeProperty[], options?: { layer?: string }) {
    if (!this.settled) this.runtime.stopOwner(this, properties, options)
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
    this.notify()
  }
  private arrivalTime() {
    return Math.max(0, ...[...this.entries].map((e) => e.track.arrival))
  }
  private scheduleArrival() {
    this.cancelArrival?.()
    this.cancelArrival = undefined
    if (this.arrived || this.settled || this.paused || this.pending) return
    const remaining = this.arrivalTime() - this.time()
    if (remaining <= 0) {
      this.arrived = true
      this.arrive()
      this.notify()
    } else if (Number.isFinite(remaining)) {
      const id = this.runtime.view.setTimeout(
        () => this.scheduleArrival(),
        Math.min(remaining, 2_147_483_647),
      )
      this.cancelArrival = () => this.runtime.view.clearTimeout(id)
    }
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
    this.notify()
    this.scheduleArrival()
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
    this.cancelArrival?.()
    this.cancelArrival = undefined
    this.arrived = true
    this.arrive()
    this.notify()
    this.feedback = undefined
    this.resolveReady()
    this.resolve(completed)
    this.runtime.forget(this)
    // A retained terminal handle must not keep the document/context alive.
    this.runtime = undefined!
  }
}

/** Internal implementation. Package exports and framework adapters are separate work. */
export class WebRuntime {
  private readonly sharedLayouts = new Map<HTMLElement, WebSharedLayout>()
  private nextShared = 0
  private diagnostic?: DiagnosticCollector
  private readonly scopes = new Set<WebMotionScope>()
  private readonly resourceOwners = new WeakMap<WebMotionResource, object>()
  private readonly pointerFollowers = new Set<WebPointerFollow>()
  private readonly renderActivities = new Set<RenderActivity>()
  private readonly propertyResources = new Set<{ dispose(): void }>()
  private readonly viewportEntrances = new Set<WebViewportEntrance>()
  private readonly preferenceListeners = new Set<() => void>()
  readonly view: Realm
  readonly maxKeyframes: number
  private settings: Required<WebConfig>
  private readonly presets = new Map<string, Preset>()
  private readonly surfaces = new Map<HTMLElement, Surface>()
  private readonly animations = new Set<Owner>()
  private readonly ownership = createOwnership<HTMLElement, string>()
  private readonly observers = new Map<Node, MutationObserver>()
  private readonly presses = new Map<HTMLElement, ReturnType<typeof createPress>>()
  private readonly interactions = new Map<HTMLElement, Map<WebInteraction, () => void>>()
  private readonly gestureInputs = new WeakMap<HTMLElement, WebInteraction>()
  private readonly zoomInputs = new WeakMap<HTMLElement, WebInteraction>()
  private readonly headerInputs = new WeakMap<HTMLElement, WebInteraction>()
  private readonly reorderInputs = new WeakMap<HTMLElement, WebInteraction>()
  private readonly drags = new Map<HTMLElement, ReturnType<typeof createDrag>>()
  private readonly sizes = new Map<HTMLElement, SizeOperation>()
  private readonly layouts = new Map<HTMLElement, LayoutOperation>()
  private nextLayout = 0
  private nextPress = 0
  private nextInteraction = 0
  private readonly preference: MediaQueryList
  private reported: boolean
  private disposed = false
  private pendingFrame?: FrameTask
  readonly scheduler: FrameScheduler
  private readonly values = new Set<NumericValue>()
  private readonly playbacks = new WeakSet<MotionAnimation>()
  private readonly paths = new Map<SVGGeometryElement, StrokeSurface>()
  private readonly listControllers = new Map<HTMLElement, ListChanges<unknown>>()
  private readonly itemAnimations = new Set<WebItemsAnimation>()
  private readonly behaviorControllers = new Set<MotionBehaviors>()
  private readonly rigControllers = new Set<WebRig>()
  private readonly stateControllers = new Set<WebMotionStates>()
  private readonly groups = new Set<MotionAnimation>()
  private readonly groupVisibility = new Set<() => void>()
  private readonly timers: ContextTimers
  private readonly valueTracks = new Set<ValueEntry>()
  private readonly valueStates = new Map<MotionInputNode, ValueState>()
  private readonly valueTask: FrameTask = {
    update: () => {
      this.sampleValues()
      return [...this.valueTracks.values()].some(
        (e) =>
          e.source.observed && !e.owner.paused && !e.owner.pending && !e.owner.settled,
      )
    },
  }
  private readonly scrollSources = new Set<ScrollValueNode>()
  private readonly scrollLinks = new Map<
    HTMLElement,
    Set<WebScrollLink & { owns(): boolean }>
  >()
  private readonly nodes = new WeakMap<object, NumericValue>()
  private readonly visibility = () => {
    this.scheduler.hidden(this.document.hidden)
    this.timers.visibilityChanged()
    for (const change of this.groupVisibility) change()
  }
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
    this.timers = new ContextTimers(
      this.view,
      () => this.scheduler.now(),
      () => this.document.hidden,
    )
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
  reducedMotion() {
    this.assert()
    return this.reduced()
  }
  onReducedMotion(listener: (reduced: boolean) => void) {
    this.assert()
    if (typeof listener !== 'function')
      throw new TypeError('Expected a reduced-motion listener.')
    let previous = this.reduced()
    const changed = () => {
      const next = this.reduced()
      if (next === previous) return
      previous = next
      try {
        listener(next)
      } catch (error) {
        this.report(error)
      }
    }
    return this.watchPreference(changed)
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
  motionBehaviors<const D extends Record<string, WebMotionBehavior>>(
    definitions: D,
    options: MotionBehaviorsOptions<Extract<keyof D, string>> = {},
  ): MotionBehaviors<Extract<keyof D, string>> {
    this.assert()
    const controller: MotionBehaviors<Extract<keyof D, string>> = createMotionBehaviors(
      definitions,
      options,
      {
        scope: () => this.scope(),
        hidden: () => this.document.hidden,
        visibility: (callback) => {
          this.groupVisibility.add(callback)
          return () => this.groupVisibility.delete(callback)
        },
        disposed: () => this.behaviorControllers.delete(controller),
      },
    )
    this.behaviorControllers.add(controller)
    return controller
  }
  scope(setup?: (scope: WebMotionScope) => void): WebMotionScope {
    this.assert()
    if (setup !== undefined && typeof setup !== 'function')
      throw new TypeError('Expected scope setup.')
    const scope = createWebScope(
      this,
      this.resourceOwners,
      () => this.scopes.delete(scope),
      (reason, resource) => {
        this.diagnostic?.record({
          reason,
          time: this.now(),
          scope: this.diagnostic.id(scope),
          owner: resource && this.diagnostic.id(resource),
        })
      },
    )
    this.scopes.add(scope)
    try {
      const result: unknown = setup?.(scope)
      if (result && typeof (result as { then?: unknown }).then === 'function')
        throw new TypeError('Web motion setup must be synchronous.')
    } catch (error) {
      try {
        scope.dispose()
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Web scope setup and cleanup failed.')
      }
      throw error
    }
    return scope
  }
  diagnostics(options: WebDiagnosticsOptions): WebDiagnostics {
    this.assert()
    if (this.diagnostic) throw new Error('This runtime already has a diagnostics owner.')
    const collector: DiagnosticCollector = new DiagnosticCollector(
      options,
      () => this.diagnosticSnapshot(collector),
      () => {
        if (this.diagnostic === collector) this.diagnostic = undefined
      },
    )
    this.diagnostic = collector
    return collector.handle()
  }
  sharedLayout(
    container: HTMLElement,
    options: WebSharedLayoutOptions = {},
  ): WebSharedLayout {
    this.assert()
    this.targets(container)
    if (this.sharedLayouts.has(container))
      throw new Error('The container already has a shared layout owner.')
    const layer = `jolt:shared:${++this.nextShared}`
    const control = createSharedLayout(container, options, {
      scheduler: this.scheduler,
      reduced: () => this.reduced(),
      preference: this.watchPreference,
      animate: (target, frames, transition) => this.animate(target, frames, transition),
      hide: (target) => {
        this.play(target, { opacity: 0 }, { duration: 0 }, layer)
      },
      reveal: (target) => {
        const surface = this.surfaces.get(target)
        if (!surface || surface.disposed || !target.isConnected) return
        const state = clone(surface.state)
        state.rest.delete(keyOf('opacity', layer))
        state.entries.delete(keyOf('opacity', layer))
        try {
          this.transaction(new Map([[surface, state]]), this.now())
        } catch {
          this.release(target)
        }
      },
      release: (target) => this.release(target),
      forget: () => {
        this.sharedLayouts.delete(container)
        this.observe()
      },
    })
    this.sharedLayouts.set(container, control)
    this.observe()
    return control
  }
  private diagnosticSnapshot(
    collector: DiagnosticCollector,
  ): Omit<WebDiagnosticSnapshot, 'events'> {
    return {
      disposed: this.disposed,
      resources: {
        surfaces: this.surfaces.size,
        animations: this.animations.size,
        values: this.values.size,
        paths: this.paths.size,
        itemAnimations: this.itemAnimations.size,
        stateControllers: this.stateControllers.size,
        groups: this.groups.size,
        timers: this.timers.size,
        scopes: this.scopes.size,
        pointerFollowers: this.pointerFollowers.size,
        propertyResources: this.propertyResources.size,
        renderActivities: this.renderActivities.size,
        viewportEntrances: this.viewportEntrances.size,
        presses: this.presses.size,
        drags: this.drags.size,
        interactions: [...this.interactions.values()].reduce(
          (sum, entries) => sum + entries.size,
          0,
        ),
        sizes: this.sizes.size,
        layouts: this.layouts.size,
        sharedLayouts: this.sharedLayouts.size,
        scrollSources: this.scrollSources.size,
        observers: this.observers.size,
        geometryObservers: [...this.surfaces.values()].reduce(
          (sum, surface) => sum + surface.geometryObservers,
          0,
        ),
        frameTasks: this.scheduler.size,
        framePending: this.scheduler.pending,
        preferenceListeners: this.preferenceListeners.size,
      },
      targets: [...this.surfaces.values()].map((surface) => ({
        id: collector.id(surface.target),
        execution: surface.path,
        channels: [
          ...[...surface.state.entries.values()].map((entry) => ({
            property: entry.property,
            layer: entry.layer,
            kind: 'animation' as const,
            owner: collector.id(entry.owner),
            paused: entry.owner.paused,
          })),
          ...[...surface.state.bindings.values()].map((entry) => ({
            property: entry.property,
            kind: 'value' as const,
            owner: collector.id(entry.source),
          })),
          ...[...surface.state.rest].map(([key, rest]) => ({
            property: rest.property,
            layer: (JSON.parse(key) as [string, string | null])[1] ?? undefined,
            kind: 'rest' as const,
          })),
        ],
      })),
    }
  }
  private diagnosticEvent(
    reason: WebDiagnosticReason,
    owner?: object,
    target?: HTMLElement,
    property?: Property,
    layer?: string,
  ) {
    const diagnostic = this.diagnostic
    if (diagnostic)
      diagnostic.record({
        reason,
        time: this.now(),
        owner: owner && diagnostic.id(owner),
        target: target && diagnostic.id(target),
        property,
        layer,
      })
  }
  private watchPreference = (listener: () => void) => {
    this.preferenceListeners.add(listener)
    return () => {
      this.preferenceListeners.delete(listener)
    }
  }
  pointerFollow(region: HTMLElement, options: WebPointerOptions = {}): WebPointerFollow {
    this.assert()
    this.targets(region)
    let controller: WebPointerFollow | undefined
    controller = createPointerFollow(region, options, {
      runtime: this,
      scheduler: this.scheduler,
      reduced: () => this.reduced(),
      preference: this.watchPreference,
      forget: () => {
        if (controller) this.pointerFollowers.delete(controller)
      },
    })
    this.pointerFollowers.add(controller)
    return controller
  }
  viewportEnter(
    target: HTMLElement | readonly HTMLElement[],
    options: WebViewportOptions = {},
  ): WebViewportEntrance {
    this.assert()
    if (!options || typeof options !== 'object')
      throw new TypeError('Expected viewport options.')
    const targets = this.targets(target)
    const frames = options.keyframes ?? 'fadeInUp'
    const plans = prepare(frames, options.transition, this.presets, targets.length)
    let controller: WebViewportEntrance | undefined
    controller = createViewportEntrance(targets, options, {
      document: this.document,
      alive: () => !this.disposed,
      reduced: () => this.reduced(),
      preference: this.watchPreference,
      play: (index) =>
        this.play(targets[index]!, frames, undefined, undefined, [plans[index]!]),
      forget: () => {
        if (controller) this.viewportEntrances.delete(controller)
      },
    })
    this.viewportEntrances.add(controller)
    return controller
  }
  animateItems(
    items: readonly WebItem[],
    animation: Keyframes | string = 'fadeInUp',
    options: WebItemsOptions | SpringName = {},
  ): WebItemsAnimation {
    this.assert()
    let controller: WebItemsAnimation | undefined
    controller = createItemsAnimation(items, animation, options, {
      document: this.document,
      assert: () => this.assert(),
      alive: () => !this.disposed,
      reduced: () => this.reduced(),
      preference: this.watchPreference,
      prepare: (input, frames, transition) => {
        const targets = this.targets(input)
        const plans = prepare(frames, transition, this.presets, targets.length)
        const compiled = this.compileElements(targets, plans, this.now())
        if (
          compiled.some((surface) =>
            surface.plans.some(({ track }) => !Number.isFinite(track.end)),
          )
        )
          throw new RangeError('Item entrances must have finite duration.')
        return (index, settle) => {
          const tracks = plans[index]!
          const instant = settle
            ? tracks.map((plan) => ({
                ...plan,
                transition: {
                  ...plan.transition,
                  curve: {
                    type: 'tween' as const,
                    duration: 0,
                    ease: [(t: number) => t],
                    times: undefined,
                  },
                  delay: 0,
                },
              }))
            : tracks
          return this.play(targets[index]!, frames, undefined, undefined, [instant])
        }
      },
      forget: () => {
        if (controller) this.itemAnimations.delete(controller)
      },
    })
    this.itemAnimations.add(controller)
    return controller
  }
  listChanges<T, K extends ReorderKey = ReorderKey>(
    container: HTMLElement,
    options: WebListChangesOptions<T, K>,
  ): ListChanges<T> {
    this.assert()
    this.targets(container)
    if (this.listControllers.has(container))
      throw new Error('This container already has a listChanges controller.')
    const transition = options.move ?? 'snappy'
    validateLayout(undefined, transition)
    const layer = `jolt:list:${++this.nextLayout}`
    const clear = (target: HTMLElement) => {
      const surface = this.surfaces.get(target)
      if (!surface || surface.disposed) return
      const state = clone(surface.state)
      for (const property of properties) {
        state.entries.delete(keyOf(property, layer))
        state.rest.delete(keyOf(property, layer))
      }
      this.transaction(new Map([[surface, state]]), this.now())
    }
    const controller = createWebListChanges(container, options, {
      scheduler: this.scheduler,
      reduced: () => this.reduced(),
      preference: this.watchPreference,
      animate: (target, x, y, enter) => {
        const lease = this.geometryLease(target),
          basis = this.surfaces.get(target)!.layoutBasis().inverse()
        const animation = this.play(
          target,
          {
            x: [basis.a * x + basis.c * y, 0],
            y: [basis.b * x + basis.d * y, 0],
            ...(enter ? { opacity: [0, 1] } : {}),
          },
          transition,
          layer,
        )
        let ended = false
        return {
          animation,
          dispose: () => {
            if (ended) return
            ended = true
            animation.stop()
            clear(target)
            lease.dispose()
          },
        }
      },
      exit: (target, pose) =>
        this.play(
          target,
          {
            x: pose.x,
            y: pose.y,
            scaleX: pose.scale,
            scaleY: pose.scale,
            opacity: pose.opacity,
          },
          transition,
        ),
      release: (target) => this.release(target),
      forget: () => this.listControllers.delete(container),
    })
    this.listControllers.set(container, controller)
    return controller
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
        reduced: () => this.reduced(),
        preference: this.watchPreference,
        release: (target) => this.release(target),
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

  withTimelineCues(
    animation: import('../core/sequence.js').PlayableAnimation,
    cues: readonly TimelineCue[],
    options: TimelineCueOptions = {},
  ) {
    this.assert()
    if (!this.playbacks.has(animation))
      throw new TypeError('Expected a playback handle from this runtime.')
    const controller = createTimelineCues(animation, cues, options, {
      timeScale: this.settings.timeScale,
      reduced: () => this.reduced(),
      after: (ms, callback) => this.timers.after(ms, callback),
      scope: () => this.scope(),
    })
    this.groups.add(controller)
    let held = false
    const visibility = () => {
      if (this.document.hidden && !controller.paused) {
        held = true
        controller.pause()
      } else if (!this.document.hidden && held) {
        held = false
        controller.play()
      }
    }
    this.groupVisibility.add(visibility)
    visibility()
    const done = () => {
      this.groups.delete(controller)
      this.groupVisibility.delete(visibility)
    }
    void controller.finished.then(done, done)
    return controller
  }

  rememberPlayback(animation: MotionAnimation) {
    this.playbacks.add(animation)
  }
  playbackProgress(animation: MotionAnimation): WebReadableValue {
    this.assert()
    if (!this.playbacks.has(animation))
      throw new TypeError('Expected a playback handle from this runtime.')
    const node = new ProgressNode(animation, this.scheduler, this.report, () =>
      this.values.delete(node),
    )
    return this.valueHandle(node, node.readableHandle())
  }

  motionValue(initial: number) {
    this.assert()
    const node = new MotionInputNode(this.scheduler, initial, this.report, () =>
      this.values.delete(node),
    )
    return this.valueHandle(node, node.handle())
  }

  private valueHandle<T extends WebValueHandle>(
    node: NumericValue,
    handle: T,
  ): T & WebReadableValue {
    const operations = scalarOperations<WebReadableValue>((op, operand, maximum) => {
      this.assert()
      const right =
        typeof operand === 'object' && operand !== null
          ? this.nodes.get(operand)
          : operand
      if (
        operand !== undefined &&
        !(right instanceof NumericValue) &&
        (typeof operand !== 'number' || !Number.isFinite(operand))
      )
        throw new TypeError('Scalar operands must belong to this runtime.')
      const derived = new ArithmeticValueNode(
        node,
        op,
        right as NumericValue | number | undefined,
        maximum,
        this.report,
        () => this.values.delete(derived),
      )
      return this.valueHandle(derived, derived.readableHandle())
    })
    const result = Object.assign(handle, operations, {
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

  private scrollNode(source: WebScrollSource, axis: 'x' | 'y' = 'y') {
    const node = new ScrollValueNode(
      this.document,
      source,
      axis,
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
  scrollValue(
    source: WebScrollSource = this.document,
    options?: WebScrollValueOptions,
  ): WebScrollValue {
    this.assert()
    const node = this.scrollNode(source, scrollAxis(options))
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
    const elementRange =
      options?.range && !Array.isArray(options.range)
        ? new ElementScrollRange(
            this.document,
            source,
            scrollAxis({ axis: options.axis }),
            options.range as WebElementScrollRange,
            this.scheduler,
          )
        : undefined
    if (elementRange && target.contains((options.range as WebElementScrollRange).element))
      throw new TypeError(
        'Use a separate layout anchor for element scroll ranges; animate its child or a sibling.',
      )
    const plan = scrollPlan(frames, options, elementRange?.measure())
    const scroll = this.scrollNode(source, plan.axis)
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
      elementRange?.dispose()
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
        const range = elementRange?.measure()
        if (range) for (const node of nodes) node.setRange(range)
        surface.refreshGeometry()
        this.transaction(new Map([[surface, clone(surface.state)]]), this.now())
      },
      dispose: () => {
        if (ended) return
        ended = true
        elementRange?.dispose()
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
    try {
      elementRange?.observe(
        (range) => {
          if (ended) return
          if (!link.owns()) {
            link.dispose()
            return
          }
          if (
            [...nodes].every(
              (node) => node.range[0] === range[0] && node.range[1] === range[1],
            )
          )
            return
          scroll.refresh()
          for (const node of nodes) node.setRange(range)
          surface.refreshGeometry()
          this.transaction(new Map([[surface, clone(surface.state)]]), this.now())
        },
        (error) => {
          link.dispose()
          this.report(error)
        },
      )
    } catch (error) {
      link.dispose()
      throw error
    }
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
    const binding = this.bindInLayer(target, values)
    return { dispose: binding.dispose }
  }

  private bindInLayer(
    target: HTMLElement,
    values: WebBindings,
    layer?: string,
  ): OwnedBinding {
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
        if (layer && !isTransform(property))
          throw new TypeError('Interaction layers require transform or opacity channels.')
        const key = keyOf(property, layer),
          entry = { property, source, layer }
        state.entries.delete(key)
        state.rest.delete(key)
        state.bindings.set(key, entry)
        added.set(key, entry)
      }
    }
    this.transaction(new Map([[surface, state]]), this.now())
    // Interaction consumers explicitly track changing image, row and header geometry.
    // Keep that lease active until their private contribution has been removed.
    const geometry = layer ? surface.observeGeometry() : undefined
    return {
      dispose: () => {
        try {
          this.unbind(surface, added)
        } finally {
          geometry?.dispose()
        }
      },
      owns: () =>
        !surface.disposed &&
        [...added].every(([key, entry]) => surface.state.bindings.get(key) === entry),
    }
  }

  private unbind(surface: Surface, selected: ReadonlyMap<string, LiveEntry>) {
    if (surface.disposed) return
    if (
      !surface.target.isConnected ||
      surface.target.ownerDocument !== this.document ||
      !surface.target.getClientRects().length
    ) {
      this.release(surface.target)
      return
    }
    const state = clone(surface.state)
    for (const [key, entry] of selected)
      if (state.bindings.get(key) === entry) {
        state.bindings.delete(key)
        if (entry.layer) state.rest.delete(key)
        else this.rest(state, key, entry.property, entry.source.get())
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
    target: HTMLElement | readonly HTMLElement[] | import('./value.js').WebMotionValue,
    animation: Keyframes | string | number | readonly (number | null)[],
    options?: AnimateOptions | WebValueAnimationOptions | SpringName,
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    if (
      typeof animation === 'number' ||
      Array.isArray(animation) ||
      this.nodes.has(target)
    )
      return this.animateValue(
        target,
        animation as number | readonly (number | null)[],
        options,
      )
    return this.play(
      target as HTMLElement | readonly HTMLElement[],
      animation as Keyframes | string,
      options as AnimateOptions | SpringName,
    )
  }

  drawPath(target: SVGGeometryElement, options: WebPathOptions = {}) {
    this.assert()
    let drawing: StrokeSurface | undefined
    drawing = new StrokeSurface(
      target,
      options,
      {
        document: this.document,
        now: () => this.now(),
        settings: () => ({
          timeScale: this.settings.timeScale,
          reducedMotion: this.reduced(),
        }),
        maxKeyframes: this.maxKeyframes,
        after: (ms, callback) => this.timers.after(ms, callback),
        remember: (animation) => this.rememberPlayback(animation),
        preference: (callback) => {
          this.preferenceListeners.add(callback)
          return () => this.preferenceListeners.delete(callback)
        },
        assert: () => this.assert(),
        forget: () => {
          if (this.paths.get(target) === drawing) {
            this.paths.delete(target)
            this.observe()
          }
        },
      },
      this.paths.get(target),
    )
    this.paths.set(target, drawing)
    this.observe()
    return drawing
  }

  motionStates<
    T extends Record<string, HTMLElement | null>,
    const S extends Record<string, WebMotionState<keyof T>>,
  >(
    targets: T,
    definitions: WebMotionDefinitions<T, S>,
    options: WebMotionStatesOptions<Extract<keyof T, string>> = {},
  ): WebMotionStates<Extract<keyof S, string>, Extract<keyof T, string>> {
    this.assert()
    let controller: WebMotionStates | undefined
    const result = createMotionStates(targets, definitions, options, {
      assert: () => this.assert(),
      validateTarget: (target) => {
        this.targets(target)
      },
      prepare: (target, frames, transition) => {
        const plans = prepare(frames, transition, this.presets, 1)
        if (target) this.compileElements([target], plans, this.now())
        else
          for (const plan of plans[0]!)
            for (const value of plan.frames) {
              if (value === null || typeof value === 'number') continue
              const property =
                plan.source.endsWith('RadiusX') || plan.source.endsWith('RadiusY')
                  ? plan.source.slice(0, -1)
                  : plan.source
              if (
                !this.view.CSS.supports(
                  property === 'shadowColor' ? 'color' : cssName(property),
                  value,
                )
              )
                throw new TypeError(`Invalid ${property}: ${value}`)
            }
        return () => {
          if (!target) throw new Error('Attach a target before playing.')
          return this.play(target, {}, undefined, undefined, plans)
        }
      },
      set: (target, frames) => {
        this.set(target, frames)
      },
      forget: () => {
        if (controller) this.stateControllers.delete(controller)
      },
    })
    controller = result
    this.stateControllers.add(result)
    return result
  }

  sequence(steps: readonly WebStep[]): MotionAnimation {
    return this.group(steps, false)
  }
  timeline(steps: readonly WebTimelineStep[]): TimelineAnimation {
    return this.group(steps, true) as TimelineAnimation
  }
  private group(
    steps: readonly WebStep[] | readonly WebTimelineStep[],
    controlled: boolean,
  ): MotionAnimation {
    this.assert()
    const seeds = new Map<HTMLElement, Plan[]>(),
      claimed = new Map<HTMLElement, Set<Property>>()
    const prepared = sequenceSteps(steps, controlled, (input, animation, options) => {
      if (
        typeof animation === 'number' ||
        Array.isArray(animation) ||
        this.nodes.has(input as object)
      ) {
        if (!controlled)
          throw new TypeError(
            'Numeric tuple steps belong to timeline(); sequence can use a value factory.',
          )
        const value = this.mutable(input as object),
          plan = valuePlan(options as WebValueAnimationOptions | SpringName)
        valueTrack(
          animation as number | readonly (number | null)[],
          plan,
          value.get(),
          0,
          { timeScale: this.settings.timeScale, reducedMotion: this.reduced() },
        )
        return () =>
          this.animateValue(
            input as object,
            animation as number | readonly (number | null)[],
            plan,
          )
      }
      const targets = this.targets(input as HTMLElement | readonly HTMLElement[]),
        plans = prepare(
          animation as Keyframes | string,
          options as AnimateOptions | SpringName,
          this.presets,
          targets.length,
        )
      this.compileElements(targets, plans, this.now())
      for (let index = 0; index < targets.length; index++) {
        const target = targets[index]!,
          used = claimed.get(target) ?? new Set<Property>(),
          initial = seeds.get(target) ?? []
        for (const plan of plans[index]!) {
          const first = plan.frames[0]
          if (
            !used.has(plan.property) &&
            first !== null &&
            first !== undefined &&
            !plan.relative &&
            plan.layer === undefined
          )
            initial.push({
              ...plan,
              frames: [first, first],
              path: undefined,
              transition: {
                curve: {
                  type: 'tween',
                  duration: 0,
                  ease: [(t: number) => t],
                  times: undefined,
                },
                delay: 0,
                repeat: 0,
                reverse: false,
              },
            })
          used.add(plan.property)
        }
        claimed.set(target, used)
        seeds.set(target, initial)
      }
      return () => this.play(targets, {}, undefined, undefined, plans)
    })
    // Every descriptor is checked before applying any hidden starting state.
    for (const [target, plans] of seeds)
      if (plans.length) this.play(target, {}, undefined, undefined, [plans])
    const animation = composePrepared(prepared, controlled, {
      driver: {
        now: () => this.scheduler.now(),
        after: (ms, callback) => this.timers.after(ms, callback),
      },
      slowdown: 1 / this.settings.timeScale,
      active: () => !this.document.hidden,
      cancelled: () => this.disposed,
    })
    if (this.disposed) {
      animation.stop()
      return animation
    }
    this.groups.add(animation)
    this.rememberPlayback(animation)
    let held = false
    const visibility = () => {
      if (!controlled) return
      const handle = animation as TimelineAnimation
      if (this.document.hidden && !handle.paused) {
        held = true
        handle.pause()
      } else if (!this.document.hidden && held) {
        held = false
        handle.play()
      }
    }
    this.groupVisibility.add(visibility)
    visibility()
    const done = () => {
      this.groups.delete(animation)
      this.groupVisibility.delete(visibility)
    }
    void animation.finished.then(done, done)
    return animation
  }

  decay(
    target: HTMLElement | readonly HTMLElement[],
    velocity: WebDecayVelocity,
    options?: WebDecayOptions,
  ) {
    this.assert()
    const targets = this.targets(target),
      plans = decayPlans(velocity, options)
    return this.play(
      targets,
      {},
      undefined,
      undefined,
      targets.map(() => plans),
    )
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
        if (!source || source.disposed || !(source instanceof MotionInputNode))
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
      const paths = new Map<MotionPath, ReturnType<typeof compilePath>>()
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
        if (plan.path && !paths.has(plan.path))
          paths.set(
            plan.path,
            compilePath(plan.path, plan.transition, {
              timeScale: this.settings.timeScale,
              reducedMotion: this.reduced(),
            }),
          )
        const track = plan.path
          ? paths.get(plan.path)!(plan.property as PathProperty, 0, plan.transition.delay)
          : createTrack(coreProperty(plan.property), values, plan.transition, 0, {
              timeScale: this.settings.timeScale,
              reducedMotion: this.reduced(),
            })
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
          source: source! as MotionInputNode,
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
      this.claimValue(entry)
    }
    this.sampleValues()
    this.scheduleValues()
    owner.refresh(at)
    return owner
  }

  private readValue(state: ValueState, at = this.now()) {
    let value = 0,
      velocity = 0,
      moving = false
    for (const [key, rest] of state.rests) if (!state.entries.has(key)) value += rest
    for (const entry of state.entries.values()) {
      const time = entry.owner.time(at)
      value += entry.track.valueAt(time)
      const running = !entry.owner.paused && !entry.owner.pending && !entry.owner.settled
      if (running) velocity += entry.track.velocityAt(time)
      moving ||= running
    }
    return { value, velocity, moving }
  }
  private valueState(source: MotionInputNode) {
    let state = this.valueStates.get(source)
    if (!state) {
      state = {
        source,
        entries: new Map(),
        rests: new Map([['', source.get()]]),
        cancel: () => this.resetValue(source),
      }
      this.valueStates.set(source, state)
      source.claimWriter(state.cancel)
      source.playback(
        () => this.readValue(state!),
        () => this.scheduleValues(),
      )
    }
    return state
  }
  private claimValue(entry: ValueEntry) {
    const state = this.valueState(entry.source),
      key = entry.layer ?? ''
    const old = state.entries.get(key)
    if (old) this.removeValue(old, false)
    state.rests.delete(key)
    state.entries.set(key, entry)
    entry.owner.entries.add(entry)
    this.valueTracks.add(entry)
  }
  private scheduleValues() {
    if (
      [...this.valueTracks].some(
        (e) =>
          e.source.observed && !e.owner.paused && !e.owner.pending && !e.owner.settled,
      )
    )
      this.scheduler.add(this.valueTask)
    else this.scheduler.remove(this.valueTask)
  }
  private sampleValues() {
    const at = this.now()
    for (const state of this.valueStates.values()) {
      const sample = this.readValue(state, at)
      state.source.writeSample(sample.value, sample.velocity)
    }
  }
  private removeValue(entry: ValueEntry, completed: boolean) {
    if (!this.valueTracks.has(entry)) return
    const state = this.valueStates.get(entry.source)!,
      key = entry.layer ?? ''
    const value = completed ? entry.track.to : entry.track.valueAt(entry.owner.time())
    this.valueTracks.delete(entry)
    state.entries.delete(key)
    if (completed || !key) state.rests.set(key, value)
    else state.rests.delete(key)
    entry.owner.entries.delete(entry)
    entry.owner.complete &&= completed
    const sample = this.readValue(state)
    entry.source.writeSample(sample.value, sample.velocity)
    entry.owner.refresh(this.now())
    this.scheduleValues()
  }
  private resetValue(source: MotionInputNode, layer?: string) {
    const state = this.valueStates.get(source)
    if (!state) return
    const sample = this.readValue(state)
    if (layer !== undefined) {
      if (!layer) throw new TypeError('A layer needs a nonempty name.')
      const entry = state.entries.get(layer)
      if (entry) this.removeValue(entry, false)
      state.rests.delete(layer)
      const next = this.readValue(state)
      source.writeSample(next.value, next.velocity)
    } else {
      for (const entry of [...state.entries.values()]) this.removeValue(entry, false)
      this.valueStates.delete(source)
      source.releaseWriter(state.cancel)
      source.playback()
      source.writeSample(sample.value, 0)
    }
    this.scheduleValues()
  }

  private mutable(target: object): MotionInputNode {
    const node = this.nodes.get(target)
    if (!(node instanceof MotionInputNode) || node.disposed)
      throw new TypeError('Expected a live mutable motion value owned by this runtime.')
    return node
  }
  private animateValue(
    target: object,
    frames: number | readonly (number | null)[],
    options?: WebValueAnimationOptions | SpringName,
  ) {
    this.assert()
    const source = this.mutable(target),
      plan = valuePlan(options)
    const at = this.now(),
      state = this.valueStates.get(source),
      key = plan.layer ?? '',
      old = state?.entries.get(key)
    const from = old
      ? old.track.valueAt(old.owner.time(at))
      : (state?.rests.get(key) ?? (key ? 0 : source.get()))
    const velocity =
      old && !old.owner.paused && !old.owner.pending
        ? old.track.velocityAt(old.owner.time(at))
        : 0
    const track = valueTrack(frames, plan, from, velocity, {
      timeScale: this.settings.timeScale,
      reducedMotion: this.reduced(),
    })
    return this.playValueTrack(source, track, plan.layer)
  }

  private playValueTrack(source: MotionInputNode, track: Track, layer?: string) {
    const at = this.now()
    const points: Point[] = [] // Numeric readers use the analytical curve, not WAAPI keyframe expansion.
    const owner = new Owner(this, track.end, at)
    const entry: ValueEntry = {
      source,
      property: 'opacity',
      layer,
      track,
      points,
      owner,
    }
    // Keep the owner alive while preparing its clock, before replacing the old writer.
    owner.entries.add(entry)
    this.transaction(
      new Map(),
      at,
      new Map([
        [
          owner,
          {
            time: 0,
            paused: false,
            pending: this.document.timeline.currentTime === null,
          },
        ],
      ]),
    )
    this.claimValue(entry)
    this.sampleValues()
    this.scheduleValues()
    owner.refresh(at)
    return owner
  }

  private compileElements(targets: readonly HTMLElement[], plans: Plan[][], at: number) {
    const compiled: {
      surface: Surface
      plans: { plan: Plan; track: Track; points: Point[] }[]
    }[] = []
    for (let i = 0; i < targets.length; i++) {
      const element = targets[i]!
      const surface = this.surfaces.get(element) ?? new Surface(this, element)
      surface.assert()
      const paths = new Map<MotionPath, ReturnType<typeof compilePath>>()
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
        if (plan.path && !paths.has(plan.path))
          paths.set(
            plan.path,
            compilePath(plan.path, plan.transition, {
              timeScale: this.settings.timeScale,
              reducedMotion: this.reduced(),
            }),
          )
        const track = plan.path
          ? paths.get(plan.path)!(plan.property as PathProperty, plan.relative ? from : 0)
          : createTrack(coreProperty(plan.property), values, plan.transition, velocity, {
              timeScale: this.settings.timeScale,
              reducedMotion: this.reduced(),
            })
        const bounded = limitRigTrack(track, plan.range)
        return { plan, track: bounded, points: flatten(bounded, this.maxKeyframes) }
      })
      compiled.push({ surface, plans: tracks })
    }
    return compiled
  }

  private play(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
    privateLayer?: string,
    prepared?: Plan[][],
  ): PlaybackAnimation & { readonly ready: Promise<void> } {
    this.assert()
    const targets = this.targets(target)
    const plans = prepared ?? prepare(animation, options, this.presets, targets.length)
    if (privateLayer !== undefined)
      for (const tracks of plans) for (const plan of tracks) plan.layer = privateLayer
    const feedback = resolveHaptic(
      typeof options === 'object' && options.haptic !== undefined
        ? options.haptic
        : typeof animation === 'string'
          ? this.presets.get(animation)?.transition?.haptic
          : undefined,
    )
    const at = this.now(),
      pending = this.document.timeline.currentTime === null
    const compiled = this.compileElements(targets, plans, at)
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
    if (feedback && !privateLayer)
      owner.feedback = animationHaptics(
        owner,
        compiled.flatMap((c) => c.plans.map((p) => p.track)),
        feedback,
        this.effectHost(),
        () =>
          owner.complete &&
          targets.every(
            (t) =>
              t.isConnected &&
              t.ownerDocument === this.document &&
              t.getClientRects().length > 0 &&
              !t.closest('[inert],[hidden]') &&
              this.view.getComputedStyle(t).visibility === 'visible',
          ),
      )
    return owner
  }

  set(
    target: HTMLElement | readonly HTMLElement[],
    values: Values,
  ): PlaybackAnimation & { readonly ready: Promise<void> }
  set(target: import('./value.js').WebMotionValue, value: number): void
  set(
    target: HTMLElement | readonly HTMLElement[] | import('./value.js').WebMotionValue,
    values: Values | number,
  ) {
    if (typeof values === 'number' || this.nodes.has(target)) {
      const source = this.mutable(target)
      if (typeof values !== 'number')
        throw new TypeError('Expected a finite numeric value.')
      source.set(values)
      return
    }
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
    resolveHaptic(options.haptic)
    if (options.haptic && typeof options.haptic !== 'string')
      throw new TypeError('Press haptic must be light, medium, heavy or false.')
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
      () => {
        const h = resolveHaptic(options.haptic)
        if (h) this.haptic(h.style)
      },
    )
    this.presses.set(target, binding)
    return binding.handle
  }

  private interactionHost(): InteractionHost {
    return {
      motionValue: this.motionValue.bind(this),
      animate: this.animate.bind(this),
      bindLayer: this.bindInLayer.bind(this),
      geometry: this.geometryLease.bind(this),
      layer: (name) => `jolt:interaction:${name}:${++this.nextInteraction}`,
      gestures: this.gestures.bind(this),
      bind: this.bind.bind(this),
      set: this.set.bind(this),
      stop: this.stop.bind(this),
      refresh: this.refresh.bind(this),
      scrollValue: this.scrollValue.bind(this),
      animateLayout: this.animateLayout.bind(this),
      scope: this.scope.bind(this),
      scheduler: this.scheduler,
      error: this.report,
      after: (ms, action) => this.timers.after(ms, action),
      reduced: () => this.reduced(),
      onReduced: (callback) => {
        this.preferenceListeners.add(callback)
        return () => this.preferenceListeners.delete(callback)
      },
      register: (target, resource, refresh) => {
        const entries =
          this.interactions.get(target) ?? new Map<WebInteraction, () => void>()
        entries.set(resource, refresh)
        this.interactions.set(target, entries)
        this.observe()
        return () => {
          entries.delete(resource)
          if (!entries.size) this.interactions.delete(target)
          this.observe()
        }
      },
    }
  }

  private effectHost(): EffectHost {
    return {
      ...this.interactionHost(),
      identity: this,
      document: this.document,
      settings: () => ({
        timeScale: this.settings.timeScale,
        reducedMotion: this.reduced(),
      }),
      maxKeyframes: this.maxKeyframes,
      remember: (animation) => this.rememberPlayback(animation),
      value: (source, color) => {
        const node = this.nodes.get(source)
        if (!node || node.disposed || node.kind !== (color ? 'color' : 'number'))
          throw new TypeError(
            'Gradient bindings need live values of the correct kind from this runtime.',
          )
        return node
      },
      visibility: (callback) => {
        this.groupVisibility.add(callback)
        return () => this.groupVisibility.delete(callback)
      },
    }
  }

  renderActivity(adapter: RenderActivityAdapter): RenderActivity {
    if (this.disposed) throw new Error('Web runtime is disposed.')
    const activity = createRenderActivity(adapter, {
      hidden: () => this.document.hidden,
      visibility: (callback) => {
        this.groupVisibility.add(callback)
        return () => {
          this.groupVisibility.delete(callback)
        }
      },
      error: (error) => this.interactionHost().error(error),
      disposed: () => {
        this.renderActivities.delete(activity)
      },
    })
    this.renderActivities.add(activity)
    return activity
  }

  property<T>(target: object, definition: WebPropertyDefinition<T>): WebProperty<T> {
    this.assert()
    const property = new PropertyTarget(target, definition, this.effectHost(), () => {
      this.propertyResources.delete(property)
    })
    this.propertyResources.add(property)
    return property
  }

  propertyGroup<const P extends Record<string, WebProperty<any>>>(
    properties: P,
  ): WebPropertyGroup<P> {
    this.assert()
    const group = createPropertyGroup(properties, this.effectHost(), () => {
      this.propertyResources.delete(group)
    })
    this.propertyResources.add(group)
    return group
  }

  private platformHost(): PlatformHost {
    return {
      ...this.interactionHost(),
      ...this.effectHost(),
      sharedLayout: this.sharedLayout.bind(this),
    }
  }
  glass(target: HTMLElement, options: WebGlassOptions = {}) {
    this.assert()
    return createGlass(target, options, this.effectHost())
  }
  sensor(
    kind: 'rotation',
    options?: WebSensorOptions,
  ): import('./sensors.js').WebRotationSensor
  sensor<K extends import('../core/sensor-kinds.js').VectorSensorKind>(
    kind: K,
    options?: WebSensorOptions,
  ): import('./sensors.js').WebVectorSensor<K>
  sensor(
    kind: WebSensorKind,
    options?: WebSensorOptions,
  ): import('./sensors.js').WebRotationSensor | import('./sensors.js').WebVectorSensor
  sensor(kind: WebSensorKind, options: WebSensorOptions = {}) {
    this.assert()
    return createSensor(kind, options, this.platformHost(), (initial) => {
      const node = new SensorValueNode(this.scheduler, initial, this.report, () =>
        this.values.delete(node),
      )
      return { node, value: this.valueHandle(node, node.readableHandle()) }
    })
  }
  interactiveNavigation(target: HTMLElement, options: WebInteractiveNavigationOptions) {
    this.assert()
    return createInteractiveNavigation(target, options, this.platformHost())
  }
  sharedNavigationEntry(container: HTMLElement, options: WebNavigationEntryOptions) {
    this.assert()
    return createNavigationEntry(container, options, this.platformHost())
  }
  haptic(style: HapticStyle) {
    this.assert()
    return requestHaptic(style, this.effectHost())
  }
  onKeyboard(callback: (state: WebKeyboardState) => void) {
    this.assert()
    return createKeyboardSubscription(callback, this.platformHost())
  }
  followKeyboard(target: HTMLElement, options: WebKeyboardOptions = {}) {
    this.assert()
    return createKeyboardFollower(target, options, this.platformHost())
  }
  bottomSheet(target: HTMLElement, options: WebBottomSheetOptions) {
    this.assert()
    return createBottomSheet(target, options, this.platformHost())
  }
  interactiveModal(target: HTMLDialogElement, options: WebInteractiveModalOptions = {}) {
    this.assert()
    return createInteractiveModal(target, options, this.platformHost())
  }
  sharedNavigation(container: HTMLElement, options: WebSharedNavigationOptions = {}) {
    this.assert()
    return createSharedNavigation(container, options, this.platformHost())
  }
  physicsWorld(
    container: HTMLElement,
    bodies: readonly WebCircleBody[],
    options: WebPhysicsOptions = {},
  ) {
    this.assert()
    return createPhysicsWorld(container, bodies, options, this.platformHost())
  }
  symbolEffect(
    target: HTMLElement,
    effect: WebSymbolEffectName,
    options: WebSymbolEffectOptions = {},
  ) {
    this.assert()
    return createSymbolEffect(target, effect, options, this.platformHost())
  }
  particles(target: HTMLElement, options: WebParticleOptions = {}) {
    this.assert()
    return createParticles(target, options, this.effectHost())
  }
  confetti(target: HTMLElement, options: WebConfettiOptions = {}) {
    this.assert()
    return createConfetti(target, options, this.effectHost())
  }
  blur(target: HTMLElement, options: WebBlurOptions = {}) {
    this.assert()
    return createBlur(target, options, this.effectHost())
  }
  shape(target: HTMLElement, options: WebShapeOptions) {
    this.assert()
    return createShape(target, options, this.effectHost())
  }
  drawBatch(target: HTMLElement, options: DrawingOptions) {
    this.assert()
    return createDrawing(target, options, this.effectHost())
  }
  liquid(target: HTMLImageElement, options: WebLiquidOptions = {}) {
    this.assert()
    return createLiquid(target, options, this.effectHost())
  }
  imageEffect(
    target: HTMLImageElement,
    effect: WebImageEffectName,
    options: WebImageEffectOptions = {},
  ) {
    this.assert()
    return createImageEffect(target, effect, options, this.effectHost())
  }

  gradientText(target: HTMLElement, options: WebGradientTextOptions) {
    this.assert()
    return createGradientText(target, options, this.effectHost())
  }
  rig2d(
    definition: RigDefinition,
    targets: Record<string, HTMLElement | null> = {},
  ): WebRig {
    this.assert()
    const read = (target: HTMLElement, property: RigChannel, model = false): number => {
      const surface = this.surfaces.get(target),
        key = keyOf(property),
        entry = surface?.state.entries.get(key)
      return entry
        ? model
          ? entry.track.to
          : sampled(entry.points, entry.owner.time(this.now()))
        : (surface?.state.bindings.get(key)?.source.get() ??
            surface?.state.rest.get(key)?.value ??
            readProperty(target, property))
    }
    let rig: WebRig | undefined
    rig = createRig(definition, targets, {
      document: this.document,
      scope: () => this.scope(),
      validate: (target) => {
        this.targets(target)
        ;(this.surfaces.get(target) ?? new Surface(this, target)).assert()
      },
      read,
      revision: (target, property) => this.ownership.get(target, keyOf(property)),
      set: (target, values) => {
        this.set(target, values)
      },
      refresh: (target) => {
        if (this.surfaces.has(target)) this.refresh(target)
      },
      animate: (batch, transition) => {
        const elements = batch.map((item) => item.target)
        const plans = batch.map((item) =>
          prepare(item.values, transition, this.presets, 1)[0]!.map((plan) => ({
            ...plan,
            range: plan.property === 'rotate' ? item.rotation : undefined,
          })),
        )
        return this.play(elements, {}, undefined, undefined, plans)
      },
      forget: () => {
        if (rig) this.rigControllers.delete(rig)
      },
    })
    this.rigControllers.add(rig)
    return rig
  }
  gradient(target: HTMLElement, options: WebGradientOptions) {
    this.assert()
    return createGradient(target, options, this.effectHost())
  }
  reveal(target: HTMLElement, options: WebRevealOptions = {}) {
    this.assert()
    return createReveal(target, true, options, this.effectHost())
  }
  conceal(target: HTMLElement, options: WebConcealOptions = {}) {
    this.assert()
    return createReveal(target, false, options, this.effectHost())
  }
  animateText(target: HTMLElement, options: WebTextOptions = {}) {
    this.assert()
    return createTextAnimation(target, options, this.effectHost())
  }
  rollTo(target: HTMLElement, value: number | string, options: WebRollOptions = {}) {
    this.assert()
    return createRoll(target, value, options, this.effectHost())
  }
  shimmer(target: HTMLElement, options: WebShimmerOptions = {}) {
    this.assert()
    return createShimmer(target, options, this.effectHost())
  }
  loader(target: HTMLElement, options: WebLoaderOptions = {}) {
    this.assert()
    return createLoader(target, options, this.effectHost())
  }

  zoomable(image: HTMLImageElement, options: WebZoomableOptions = {}) {
    this.assert()
    this.targets(image)
    if (this.zoomInputs.has(image) && !this.zoomInputs.get(image)!.disposed)
      throw new Error('The image already has zoom input.')
    const handle = createZoomable(image, options, this.interactionHost())
    this.zoomInputs.set(image, handle)
    return handle
  }

  scrollHeader(source: HTMLElement, options: WebScrollHeaderOptions) {
    this.assert()
    this.targets(source)
    if (this.headerInputs.has(source) && !this.headerInputs.get(source)!.disposed)
      throw new Error('The scroll source already has a header controller.')
    const handle = createScrollHeader(source, options, this.interactionHost())
    this.headerInputs.set(source, handle)
    return handle
  }

  reorder<K extends ReorderKey>(container: HTMLElement, options: WebReorderOptions<K>) {
    this.assert()
    this.targets(container)
    if (this.reorderInputs.has(container) && !this.reorderInputs.get(container)!.disposed)
      throw new Error('The list already has reorder input.')
    const handle = createReorder(container, options, this.interactionHost())
    this.reorderInputs.set(container, handle)
    return handle
  }

  gestures(target: HTMLElement, options: WebGesturesOptions = {}) {
    this.assert()
    this.targets(target)
    if (
      this.drags.has(target) ||
      (!this.gestureInputs.get(target)?.disposed && this.gestureInputs.has(target))
    )
      throw new Error('The surface already has gesture input.')
    const handle = createGestures(target, options, this.interactionHost())
    this.gestureInputs.set(target, handle)
    return handle
  }

  drag(target: HTMLElement, options: WebDragOptions = {}) {
    this.assert()
    this.targets(target)
    if (
      this.drags.has(target) ||
      (this.gestureInputs.has(target) && !this.gestureInputs.get(target)!.disposed)
    )
      throw new Error('The surface already has drag input.')
    const config = dragOptions(options)
    if (config.value) return this.dragValue(target, config)
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
      error: this.report,
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
          if (config.release === 'decay')
            return this.play(target, {}, undefined, undefined, [
              dragPlans(config, velocity),
            ])
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

  dropZones(source: HTMLElement, options: WebDropZoneOptions) {
    this.assert()
    this.targets(source)
    for (const entry of options?.targets ?? []) this.targets(entry.target)
    return createDropZones(
      source,
      options,
      this.interactionHost(),
      this.drag.bind(this),
      () => {
        // Drop hit testing includes the final pointer-up sample, before the next RAF.
        const surface = this.surfaces.get(source)
        if (surface?.state.bindings.size) surface.render(this.now())
      },
    )
  }

  private dragValue(target: HTMLElement, config: ReturnType<typeof dragOptions>) {
    const source = this.mutable(config.value!)
    const axis = config.axis as 'x' | 'y'
    assertDragSpace(target, true)
    let owns = false
    const cancelled = () => {
      owns = false
      drag.handle.cancel()
    }
    const cleanup = () => {
      owns = false
      source.releaseWriter(cancelled)
    }
    const read = () => ({
      x: axis === 'x' ? source.get() : 0,
      y: axis === 'y' ? source.get() : 0,
    })
    const drag = createDrag(target, config, {
      scheduler: this.scheduler,
      error: this.report,
      read,
      validate: () => {
        assertDragSpace(target, true)
        this.mutable(config.value!)
      },
      begin: () => {
        source.claimWriter(cancelled)
        owns = true
      },
      owns: () => owns && !source.disposed,
      write: (point, speed) => source.writeSample(point[axis], speed[axis]),
      cancel: cleanup,
      release: (point, velocity) => {
        cleanup()
        if (config.release !== 'decay')
          return this.playValueTrack(
            source,
            createTrack(
              axis,
              [source.get(), point[axis]],
              resolveTransition(
                { type: 'spring', ...config.spring, velocity: velocity[axis] },
                axis,
                2,
              ),
              velocity[axis],
              { timeScale: this.settings.timeScale, reducedMotion: this.reduced() },
            ),
          )
        const track = createTrack(
          axis,
          [source.get(), source.get()],
          {
            curve: dragCurve(config, axis, velocity[axis]),
            delay: 0,
            repeat: 0,
            reverse: false,
          },
          velocity[axis],
          { timeScale: this.settings.timeScale, reducedMotion: this.reduced() },
        )
        return this.playValueTrack(source, track)
      },
      dispose: () => {
        cleanup()
        unlisten()
        this.drags.delete(target)
        this.observe()
      },
    })
    const unlisten = source.onDispose(() => drag.handle.dispose())
    this.drags.set(target, drag)
    this.observe()
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
    if (isShadow(property)) {
      for (const sibling of shadowProperties) {
        const key = keyOf(sibling)
        if (!state.rest.has(key) && !state.entries.has(key) && !state.bindings.has(key))
          state.rest.set(key, {
            property: sibling,
            value: readProperty(surface.target, sibling),
          })
      }
      return
    }
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
          if (removed !== 'finish')
            previous.owner.diagnosticReason =
              state.entries.has(key) || state.bindings.has(key)
                ? 'interrupted'
                : 'stopped'
          this.diagnosticEvent(
            state.entries.has(key) || state.bindings.has(key)
              ? 'interrupted'
              : removed === 'finish'
                ? 'completed'
                : 'stopped',
            previous.owner,
            surface.target,
            previous.property,
            previous.layer,
          )
          previous.owner.entries.delete(previous)
          previous.owner.complete &&= removed === 'finish'
          affected.add(previous.owner)
          this.ownership.invalidate(surface.target, [key])
        }
      for (const [key, entry] of state.entries)
        if (surface.state.entries.get(key) !== entry) {
          this.diagnosticEvent(
            'claimed',
            entry.owner,
            surface.target,
            entry.property,
            entry.layer,
          )
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
          if (state.bindings.get(key) !== previous)
            this.diagnosticEvent(
              state.entries.has(key) || state.bindings.has(key)
                ? 'interrupted'
                : 'released',
              previous.source,
              surface.target,
              previous.property,
            )
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
          if (surface.state.bindings.get(key) !== entry)
            this.diagnosticEvent('claimed', entry.source, surface.target, entry.property)
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
    this.scheduleValues()
  }

  stopOwner(
    owner: Owner,
    selected?: readonly KeyframeProperty[],
    options?: { layer?: string },
  ) {
    owner.diagnosticReason = 'stopped'
    if (selected?.some((name) => !keyframeProperties.includes(name)))
      throw new TypeError('Unsupported property to stop.')
    const names = selected?.flatMap(expand)
    const matches = (entry: Entry) =>
      entry.owner === owner &&
      (!names || names.includes(entry.property)) &&
      (options?.layer === undefined || entry.layer === options.layer)
    for (const [target, surface] of this.surfaces)
      if (
        [...surface.state.entries.values()].some(matches) &&
        (!target.isConnected || !target.getClientRects().length)
      )
        this.release(target)
    for (const entry of [...this.valueTracks.values()])
      if (matches(entry)) this.removeValue(entry, false)
    this.remove(matches, false)
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
    target: HTMLElement | readonly HTMLElement[] | import('./value.js').WebMotionValue,
    selected?: readonly KeyframeProperty[] | { layer?: string },
    options?: { layer?: string },
  ) {
    this.assert()
    if (
      this.nodes.has(target) ||
      (!Array.isArray(target) && !(target instanceof this.view.HTMLElement))
    ) {
      const source = this.mutable(target)
      if (Array.isArray(selected))
        throw new TypeError('Numeric values have named layers, not property keys.')
      this.resetValue(source, (selected as { layer?: string } | undefined)?.layer)
      return
    }
    if (selected !== undefined && !Array.isArray(selected))
      throw new TypeError('Expected property keys.')
    const targets = new Set(this.targets(target as HTMLElement | readonly HTMLElement[]))
    const names = (selected as readonly KeyframeProperty[] | undefined)?.flatMap(expand)
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
    const changed = reduced !== this.reported
    this.reported = reduced
    // A resource can attach after MediaQueryList.matches changes but before its
    // queued change event. Reconcile it even when rapid changes end at the last
    // reported preference; otherwise a newly paused sensor can remain paused.
    for (const listener of [...this.preferenceListeners]) listener()
    if (!changed) return
    if (reduced) this.diagnosticEvent('reduced-motion')
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
    if (
      this.paths.size ||
      this.drags.size ||
      this.interactions.size ||
      this.surfaces.size ||
      this.scrollSources.size ||
      this.layouts.size ||
      this.sharedLayouts.size
    )
      roots.add(this.document)
    for (const target of this.interactions.keys()) roots.add(target.getRootNode())
    for (const target of this.drags.keys()) roots.add(target.getRootNode())
    for (const target of this.paths.keys()) roots.add(target.getRootNode())
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
          for (const [target, drawing] of this.paths)
            if (!target.isConnected || target.ownerDocument !== this.document)
              drawing.dispose()
          for (const [container, shared] of this.sharedLayouts)
            if (!container.isConnected || container.ownerDocument !== this.document)
              shared.dispose()
          for (const [target, layout] of this.layouts)
            if (
              !target.isConnected ||
              target.ownerDocument !== this.document ||
              !target.getClientRects().length
            )
              layout.stop()
          for (const source of [...this.scrollSources])
            if (
              !source.element.isConnected ||
              source.element.ownerDocument !== this.document
            )
              source.dispose()
          for (const target of [...this.surfaces.keys()])
            if (
              !target.isConnected ||
              target.ownerDocument !== this.document ||
              !target.getClientRects().length
            )
              this.release(target, true)
          for (const entries of [...this.interactions.values()])
            for (const refresh of [...entries.values()]) refresh()
          for (const press of this.presses.values()) press.refresh()
          for (const drag of this.drags.values()) drag.refresh()
          this.observe()
        })
        observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'disabled',
            'aria-disabled',
            'aria-busy',
            'inert',
            'open',
            'hidden',
          ],
        })
        this.observers.set(root, observer)
      }
  }

  release(target: HTMLElement, detached = false) {
    const surface = this.surfaces.get(target)
    // Mark first: controller cleanup can dispose bound values and re-enter unbind.
    if (surface) surface.disposed = true
    for (const resource of [...(this.interactions.get(target)?.keys() ?? [])])
      if (!detached || !resource.retainDetached?.()) resource.dispose()
    if (this.surfaces.has(target)) this.diagnosticEvent('released', undefined, target)
    this.layouts.get(target)?.stop()
    this.layouts.delete(target)
    this.sizes.get(target)?.detach()
    this.sizes.delete(target)
    for (const link of [...(this.scrollLinks.get(target) ?? [])]) link.dispose()
    this.drags.get(target)?.detach()
    this.drags.delete(target)
    this.presses.get(target)?.detach()
    this.presses.delete(target)
    if (!surface) return
    const at = this.now(),
      affected = new Set<Owner>()
    for (const entry of surface.state.entries.values()) {
      entry.owner.diagnosticReason = 'released'
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
    this.diagnosticEvent(
      owner.complete ? 'completed' : (owner.diagnosticReason ?? 'interrupted'),
      owner,
    )
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
      scopes: this.scopes.size,
      paths: this.paths.size,
      itemAnimations: this.itemAnimations.size,
      groups: this.groups.size,
      timers: this.timers.size,
      sharedLayouts: this.sharedLayouts.size,
      pointerFollowers: this.pointerFollowers.size,
      viewportEntrances: this.viewportEntrances.size,
      preferenceListeners: this.preferenceListeners.size,
      drags: this.drags.size,
      targets: this.surfaces.size,
      values: this.values.size,
      interactions: [...this.interactions.values()].reduce(
        (sum, entries) => sum + entries.size,
        0,
      ),
      valueAnimations: this.valueTracks.size,
      valueTracks: [...this.valueTracks].map((e) => ({
        layer: e.layer,
        from: e.track.valueAt(0),
        initialVelocity: e.track.velocityAt(0),
        time: e.owner.time(at),
        duration: e.track.end,
      })),
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
    for (const controller of [...this.listControllers.values()]) controller.dispose()
    if (this.disposed) return
    this.disposed = true
    const errors: unknown[] = []
    for (const resource of [
      ...this.behaviorControllers,
      ...this.rigControllers,
      ...this.scopes,
      ...[...this.interactions.values()].flatMap((entries) => [...entries.keys()]),
      ...[...this.drags.values()].map((drag) => drag.handle),
      ...this.stateControllers,
      ...this.itemAnimations,
      ...this.paths.values(),
      ...this.pointerFollowers,
      ...this.renderActivities,
      ...this.propertyResources,
      ...this.viewportEntrances,
      ...this.sharedLayouts.values(),
    ]) {
      try {
        resource.dispose()
      } catch (error) {
        errors.push(error)
      }
    }
    this.paths.clear()
    this.behaviorControllers.clear()
    this.rigControllers.clear()
    this.stateControllers.clear()
    this.itemAnimations.clear()
    this.scopes.clear()
    this.pointerFollowers.clear()
    this.renderActivities.clear()
    this.propertyResources.clear()
    this.viewportEntrances.clear()
    this.preferenceListeners.clear()
    this.preference.removeEventListener('change', this.preferenceChanged)
    this.document.removeEventListener('visibilitychange', this.visibility)
    for (const group of [...this.groups]) group.stop()
    this.groups.clear()
    this.groupVisibility.clear()
    this.timers.dispose()
    for (const layout of this.layouts.values()) layout.stop()
    for (const target of [...this.surfaces.keys()]) this.release(target)
    for (const observer of this.observers.values()) observer.disconnect()
    this.observers.clear()
    for (const value of [...this.values]) value.dispose()
    this.scheduler.dispose()
    this.pendingFrame = undefined
    this.presets.clear()
    this.diagnosticEvent('disposed')
    this.diagnostic?.end()
    if (errors.length) throw new AggregateError(errors, 'Web runtime cleanup failed.')
  }
}

export const createWebRuntime = (document: Document, options?: RuntimeOptions) =>
  new WebRuntime(document, options)
import {
  createRenderActivity,
  type RenderActivity,
  type RenderActivityAdapter,
} from '../core/render-activity.js'
