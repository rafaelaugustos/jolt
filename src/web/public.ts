export type { WebRig, RigDefinition, RigPart, RigSocket, RigTransform } from './rig.js'
export type { WebGradientText, WebGradientTextOptions } from './gradient-text.js'
import type {
  WebMotionBehavior,
  MotionBehaviorsOptions,
  MotionBehaviors,
} from './behaviors.js'
export { cubicBezier } from '../core/easing.js'
export { origamiSpring, springs } from '../core/transition.js'
export { presets } from '../core/presets.js'
export type {
  WebBehaviorContext,
  WebMotionBehavior,
  BehaviorRun,
  BehaviorResult,
  BehaviorStatus,
  MotionBehaviorsOptions,
  MotionBehaviors,
} from './behaviors.js'
import type {
  TimelineCue,
  TimelineCueOptions,
  CuedTimeline,
} from '../core/timeline-cues.js'
export type {
  TimelineCue,
  TimelineCueOptions,
  CuedTimeline,
} from '../core/timeline-cues.js'
export { resolveListTarget } from './return-target.js'
export type {
  WebDropZoneOptions,
  DropZones,
  DropTarget,
  DropEvent,
  DropEffect,
} from './drop-zones.js'
export type {
  WebReturnContext,
  WebReturnTarget,
  WebListTargetOptions,
} from './return-target.js'
export type { WebNavigationEntry, WebNavigationEntryOptions } from './navigation-entry.js'
export type {
  WebInteractiveNavigation,
  WebInteractiveNavigationOptions,
  WebNavigationState,
} from './interactive-navigation.js'
export type { WebGlass, WebGlassOptions } from './glass.js'
export type {
  WebSensorKind,
  WebSensorStatus,
  WebSensorOptions,
  WebSensor,
  WebRotationSensor,
  WebGravitySensor,
  WebVectorSensor,
} from './sensors.js'
export type { Haptic, HapticStyle, HapticOptions, WebHapticResult } from './haptics.js'
export type {
  WebKeyboardState,
  WebKeyboardOptions,
  WebKeyboardSubscription,
} from './keyboard.js'
export type {
  WebSheetSnap,
  WebBottomSheetOptions,
  WebBottomSheet,
} from './bottom-sheet.js'
export type {
  WebModalState,
  WebInteractiveModalOptions,
  WebInteractiveModal,
} from './interactive-modal.js'
export type {
  WebSharedNavigationOptions,
  WebSharedNavigationRequest,
  WebSharedNavigationResult,
  WebSharedNavigationOperation,
  WebSharedNavigation,
} from './shared-navigation.js'
export type {
  WebPhysicsVector,
  WebPhysicsLine,
  WebPhysicsAttachment,
  WebPhysicsSnap,
  WebPhysicsDrag,
  WebCircleBody,
  WebPhysicsSpring,
  WebPhysicsOptions,
  WebPhysicsSnapshot,
  WebPhysicsWorld,
} from './physics.js'
export type {
  WebSymbolEffectName,
  WebSymbolEffectOptions,
  WebSymbolEffect,
} from './symbol-effect.js'
import type { WebParticles, WebParticleOptions, WebConfettiOptions } from './particles.js'
import type { WebBlur, WebBlurOptions } from './blur.js'
import type { WebShape, WebShapeOptions } from './shape.js'
import type { Drawing, DrawingOptions } from '../core/drawing.js'
export type {
  Drawing,
  DrawingOptions,
  DrawingValues,
  DrawingItem,
  DrawingStyle,
  DrawingSnapshot,
} from '../core/drawing.js'
export { drawingLimits } from '../core/drawing.js'
import type { WebLiquid, WebLiquidOptions } from './liquid.js'
import type {
  WebImageEffect,
  WebImageEffectName,
  WebImageEffectOptions,
} from './image-effect.js'
export type { WebParticles, WebParticleOptions, WebConfettiOptions } from './particles.js'
export type { WebBlur, WebBlurOptions } from './blur.js'
export type { WebShape, WebShapeOptions, WebShapeValues } from './shape.js'
export type { WebLiquid, WebLiquidOptions } from './liquid.js'
export type {
  WebImageEffect,
  WebImageEffectName,
  WebImageEffectOptions,
} from './image-effect.js'
import type { ReorderKey } from '../core/reorder.js'
import type { WebGradient, WebGradientOptions } from './gradient.js'
import type { WebShimmerOptions, WebLoaderOptions, WebLoadingEffect } from './loading.js'
export type {
  WebGradient,
  WebGradientOptions,
  WebGradientValues,
  WebGradientBindings,
  WebGradientType,
} from './gradient.js'
export type { WebShimmerOptions, WebLoaderOptions, WebLoadingEffect } from './loading.js'
import type { WebRevealOptions, WebConcealOptions } from './reveal.js'
import type { WebTextOptions, WebRollOptions } from './text-effect.js'
export type { WebRevealOptions, WebConcealOptions } from './reveal.js'
export type { WebTextOptions, WebRollOptions } from './text-effect.js'
import type { WebZoomable, WebZoomableOptions } from './zoomable.js'
import type { WebScrollHeader, WebScrollHeaderOptions } from './scroll-header.js'
import type { WebReorder, WebReorderOptions } from './reorder.js'
export type {
  WebZoomable,
  WebZoomableOptions,
  WebZoomState,
  WebPhotoDismissal,
} from './zoomable.js'
export type {
  WebScrollHeader,
  WebScrollHeaderOptions,
  WebRefreshContext,
  WebHeaderItem,
} from './scroll-header.js'
export type {
  WebReorder,
  WebReorderOptions,
  WebReorderItem,
  WebReorderCancelReason,
} from './reorder.js'
export type { ReorderKey, ReorderMove } from '../core/reorder.js'
import type { WebGestures, WebGesturesOptions } from './gestures.js'
export type {
  WebGestures,
  WebGesturesOptions,
  WebGestureBounds,
  WebGesturePosition,
  WebGestureEvent,
} from './gestures.js'
export type { WebGestureScrollOptions } from './gesture-scroll.js'
export type { WebPathDrawing, WebPathOptions, WebPathTransition } from './stroke.js'
export type {
  WebMotionStates,
  WebMotionState,
  WebMotionDefinitions,
  WebMotionStatesOptions,
  WebStateTransition,
} from './motion-states.js'
export type {
  WebStep,
  WebTimelineStep,
  WebSequenceOptions,
  SequencePosition,
  PlayableAnimation,
  TimelineAnimation,
} from './sequence.js'
export type { WebDecayOptions, WebDecayVelocity } from './decay.js'
export type { WebValueAnimationOptions } from './value-playback.js'
import type { WebDrag, WebDragOptions } from './drag.js'
import type { WebMotionScope } from './scope.js'
import type { WebSharedLayout, WebSharedLayoutOptions } from './shared-layout.js'
export type {
  WebSharedLayout,
  WebSharedLayoutOptions,
  WebSharedLayoutAnimation,
  WebSharedLayoutResult,
} from './shared-layout.js'
import type { WebDiagnostics, WebDiagnosticsOptions } from './diagnostics.js'
export type {
  WebDiagnostics,
  WebDiagnosticsOptions,
  WebDiagnosticEvent,
  WebDiagnosticReason,
  WebDiagnosticSnapshot,
  WebDiagnosticTarget,
} from './diagnostics.js'
import type { WebPointerFollow, WebPointerOptions } from './pointer.js'
import type { RenderActivity, RenderActivityAdapter } from '../core/render-activity.js'
import type { WebProperty, WebPropertyDefinition, WebPropertyGroup } from './property.js'
export type {
  WebProperty,
  WebPropertyDefinition,
  WebPropertyGroup,
  WebGroupValues,
} from './property.js'
export type { RenderActivity, RenderActivityAdapter } from '../core/render-activity.js'
import type { WebViewportEntrance, WebViewportOptions } from './viewport.js'
import type { WebItem, WebItemsOptions, WebItemsAnimation } from './items.js'
export type { WebItem, WebItemKey, WebItemsOptions, WebItemsAnimation } from './items.js'
export type { WebMotionScope, WebMotionResource } from './scope.js'
export type { WebPointerFollow, WebPointerOptions } from './pointer.js'
export type { WebViewportEntrance, WebViewportOptions } from './viewport.js'
export type { WebDrag, WebDragOptions, WebDragEvent, WebDragRelease } from './drag.js'
import type { WebSpringOptions, WebSpringValue } from './spring-value.js'
export type { WebSpringOptions, WebSpringValue } from './spring-value.js'
import type {
  WebMotionValue,
  WebReadableValue,
  WebBindings,
  WebBinding,
} from './value.js'
export type {
  WebMotionValue,
  WebReadableValue,
  WebBindings,
  WebBinding,
  WebMapOptions,
} from './value.js'
import type {
  WebScrollValueOptions,
  WebScrollSource,
  WebScrollValue,
  WebScrollKeyframes,
  WebScrollOptions,
  WebScrollLink,
} from './scroll.js'
export type {
  WebElementScrollRange,
  WebScrollAlignment,
  WebScrollEdge,
} from './scroll-range.js'
export type {
  WebScrollValueOptions,
  WebScrollSource,
  WebScrollValue,
  WebScrollKeyframes,
  WebScrollOptions,
  WebScrollLink,
} from './scroll.js'
import { createWebRuntime as createInternalRuntime } from './runtime.js'
import type { WebSizeAnimation, WebSizeOptions, WebSizeValues } from './size.js'
export type { WebSizeAnimation, WebSizeOptions, WebSizeValues } from './size.js'
export type { WebColorValue } from './value.js'
import type { WebLayoutOptions } from './layout.js'
export type { WebLayoutOptions } from './layout.js'
import type { WebSeekableStep, WebSceneOptions } from './scene.js'
export type { WebSeekableStep, WebSceneOptions } from './scene.js'
import type { WebPress, WebPressOptions } from './press.js'
export type { WebPress, WebPressOptions, WebPressState } from './press.js'
import type {
  AnimateOptions,
  Keyframes,
  PlaybackAnimation,
  Preset,
  Property,
  RuntimeOptions,
  SpringName,
  Values,
  WebConfig,
} from './types.js'

export type {
  AnimateOptions,
  KeyframeProperty,
  KeyframeValue,
  Keyframes,
  Preset,
  Property,
  RuntimeOptions,
  SpringName,
  Stagger,
  Transition,
  Values,
  WebConfig,
} from './types.js'

/** Experimental finite playback handle. Activation/disposal resolves ready. */
export interface WebAnimation extends PlaybackAnimation {
  readonly ready: Promise<void>
  /** Cancel only selected channels still owned by this handle. */
  stop(
    properties?: readonly import('./types.js').KeyframeProperty[],
    options?: { layer?: string },
  ): void
}

/** Experimental DOM context; platform/framework adapters are not public APIs. */
export interface WebRuntime {
  rig2d(
    definition: import('./rig.js').RigDefinition,
    targets?: Record<string, HTMLElement | null>,
  ): import('./rig.js').WebRig
  gradientText(
    target: HTMLElement,
    options: import('./gradient-text.js').WebGradientTextOptions,
  ): import('./gradient-text.js').WebGradientText
  /** Effective preference for this document/runtime, including configure overrides. */
  reducedMotion(): boolean
  /** Observe effective changes; read reducedMotion() for the initial value. */
  onReducedMotion(listener: (reduced: boolean) => void): () => void
  motionBehaviors<const D extends Record<string, WebMotionBehavior>>(
    definitions: D,
    options?: MotionBehaviorsOptions<Extract<keyof D, string>>,
  ): MotionBehaviors<Extract<keyof D, string>>
  interactiveNavigation(
    target: HTMLElement,
    options: import('./interactive-navigation.js').WebInteractiveNavigationOptions,
  ): import('./interactive-navigation.js').WebInteractiveNavigation
  sharedNavigationEntry(
    container: HTMLElement,
    options: import('./navigation-entry.js').WebNavigationEntryOptions,
  ): import('./navigation-entry.js').WebNavigationEntry
  glass(
    target: HTMLElement,
    options?: import('./glass.js').WebGlassOptions,
  ): import('./glass.js').WebGlass
  sensor(
    kind: 'rotation',
    options?: import('./sensors.js').WebSensorOptions,
  ): import('./sensors.js').WebRotationSensor
  sensor<K extends import('../core/sensor-kinds.js').VectorSensorKind>(
    kind: K,
    options?: import('./sensors.js').WebSensorOptions,
  ): import('./sensors.js').WebVectorSensor<K>
  sensor(
    kind: import('./sensors.js').WebSensorKind,
    options?: import('./sensors.js').WebSensorOptions,
  ): import('./sensors.js').WebRotationSensor | import('./sensors.js').WebVectorSensor

  haptic(
    style: import('./haptics.js').HapticStyle,
  ): import('./haptics.js').WebHapticResult
  onKeyboard(
    callback: (state: import('./keyboard.js').WebKeyboardState) => void,
  ): import('./keyboard.js').WebKeyboardSubscription
  followKeyboard(
    target: HTMLElement,
    options?: import('./keyboard.js').WebKeyboardOptions,
  ): import('./keyboard.js').WebKeyboardSubscription
  bottomSheet(
    target: HTMLElement,
    options: import('./bottom-sheet.js').WebBottomSheetOptions,
  ): import('./bottom-sheet.js').WebBottomSheet
  interactiveModal(
    target: HTMLDialogElement,
    options?: import('./interactive-modal.js').WebInteractiveModalOptions,
  ): import('./interactive-modal.js').WebInteractiveModal
  sharedNavigation(
    container: HTMLElement,
    options?: import('./shared-navigation.js').WebSharedNavigationOptions,
  ): import('./shared-navigation.js').WebSharedNavigation
  physicsWorld(
    container: HTMLElement,
    bodies: readonly import('./physics.js').WebCircleBody[],
    options?: import('./physics.js').WebPhysicsOptions,
  ): import('./physics.js').WebPhysicsWorld
  symbolEffect(
    target: HTMLElement,
    effect: import('./symbol-effect.js').WebSymbolEffectName,
    options?: import('./symbol-effect.js').WebSymbolEffectOptions,
  ): import('./symbol-effect.js').WebSymbolEffect

  particles(target: HTMLElement, options?: WebParticleOptions): WebParticles
  confetti(target: HTMLElement, options?: WebConfettiOptions): WebParticles
  blur(target: HTMLElement, options?: WebBlurOptions): WebBlur
  shape(target: HTMLElement, options: WebShapeOptions): WebShape
  drawBatch(target: HTMLElement, options: DrawingOptions): Drawing
  liquid(target: HTMLImageElement, options?: WebLiquidOptions): WebLiquid
  imageEffect(
    target: HTMLImageElement,
    effect: WebImageEffectName,
    options?: WebImageEffectOptions,
  ): WebImageEffect
  gradient(target: HTMLElement, options: WebGradientOptions): WebGradient
  reveal(target: HTMLElement, options?: WebRevealOptions): WebAnimation
  conceal(target: HTMLElement, options?: WebConcealOptions): WebAnimation
  animateText(target: HTMLElement, options?: WebTextOptions): WebAnimation
  rollTo(
    target: HTMLElement,
    value: number | string,
    options?: WebRollOptions,
  ): WebAnimation
  shimmer(target: HTMLElement, options?: WebShimmerOptions): WebLoadingEffect
  loader(target: HTMLElement, options?: WebLoaderOptions): WebLoadingEffect
  animateItems(
    items: readonly WebItem[],
    animation?: Keyframes | string,
    options?: WebItemsOptions | SpringName,
  ): WebItemsAnimation
  drawPath(
    target: SVGGeometryElement,
    options?: import('./stroke.js').WebPathOptions,
  ): import('./stroke.js').WebPathDrawing
  motionStates<
    T extends Record<string, HTMLElement | null>,
    const S extends Record<string, import('./motion-states.js').WebMotionState<keyof T>>,
  >(
    targets: T,
    definitions: import('./motion-states.js').WebMotionDefinitions<T, S>,
    options?: import('./motion-states.js').WebMotionStatesOptions<
      Extract<keyof T, string>
    >,
  ): import('./motion-states.js').WebMotionStates<
    Extract<keyof S, string>,
    Extract<keyof T, string>
  >
  sequence(
    steps: readonly import('./sequence.js').WebStep[],
  ): import('../core/playback.js').Animation
  timeline(
    steps: readonly import('./sequence.js').WebTimelineStep[],
  ): import('../core/sequence.js').TimelineAnimation
  decay(
    target: HTMLElement | readonly HTMLElement[],
    velocity: import('./decay.js').WebDecayVelocity,
    options?: import('./decay.js').WebDecayOptions,
  ): WebAnimation
  playbackProgress(animation: import('../core/playback.js').Animation): WebReadableValue
  sharedLayout(container: HTMLElement, options?: WebSharedLayoutOptions): WebSharedLayout
  withTimelineCues(
    animation: import('../core/sequence.js').PlayableAnimation,
    cues: readonly TimelineCue[],
    options?: TimelineCueOptions,
  ): CuedTimeline
  diagnostics(options: WebDiagnosticsOptions): WebDiagnostics
  scope(setup?: (scope: WebMotionScope) => void): WebMotionScope
  renderActivity(adapter: RenderActivityAdapter): RenderActivity
  property<T>(target: object, definition: WebPropertyDefinition<T>): WebProperty<T>
  propertyGroup<const P extends Record<string, WebProperty<any>>>(
    properties: P,
  ): WebPropertyGroup<P>
  pointerFollow(region: HTMLElement, options?: WebPointerOptions): WebPointerFollow
  dropZones(
    source: HTMLElement,
    options: import('./drop-zones.js').WebDropZoneOptions,
  ): import('./drop-zones.js').DropZones
  viewportEnter(
    target: HTMLElement | readonly HTMLElement[],
    options?: WebViewportOptions,
  ): WebViewportEntrance
  seekableTimeline(
    steps: readonly WebSeekableStep[],
    options?: WebSceneOptions,
  ): WebAnimation
  animateLayout(
    container: HTMLElement,
    changeOrOptions?: (() => void) | WebLayoutOptions | SpringName,
    options?: WebLayoutOptions | SpringName,
  ): import('../core/playback.js').Animation
  animateSize(
    target: HTMLElement,
    values: WebSizeValues,
    changeOrOptions?: (() => void) | WebSizeOptions | SpringName,
    options?: WebSizeOptions | SpringName,
  ): WebSizeAnimation
  scrollValue(source?: WebScrollSource, options?: WebScrollValueOptions): WebScrollValue
  scrollLinked(
    source: WebScrollSource,
    target: HTMLElement,
    frames: WebScrollKeyframes,
    options: WebScrollOptions,
  ): WebScrollLink
  /** Accept a supported size/pivot change without replacing animation ownership. */
  refresh(target: HTMLElement): void
  /** Observe size changes on an already claimed surface. Dispose with its owner. */
  observeGeometry(target: HTMLElement): WebBinding
  zoomable(image: HTMLImageElement, options?: WebZoomableOptions): WebZoomable
  scrollHeader(source: HTMLElement, options: WebScrollHeaderOptions): WebScrollHeader
  reorder<K extends ReorderKey>(
    container: HTMLElement,
    options: WebReorderOptions<K>,
  ): WebReorder<K>
  gestures(target: HTMLElement, options?: WebGesturesOptions): WebGestures
  drag(target: HTMLElement, options?: WebDragOptions): WebDrag
  motionValue(initial: number): WebMotionValue
  springValue(source: WebReadableValue, options?: WebSpringOptions): WebSpringValue
  bind(target: HTMLElement, values: WebBindings): WebBinding
  animate(
    target: WebMotionValue,
    animation: number | readonly (number | null)[],
    options?: import('./value-playback.js').WebValueAnimationOptions | SpringName,
  ): WebAnimation
  animate(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
  ): WebAnimation
  set(target: WebMotionValue, value: number): void
  set(target: HTMLElement | readonly HTMLElement[], values: Values): WebAnimation
  press(target: HTMLElement, values?: Values, options?: WebPressOptions): WebPress
  stop(target: WebMotionValue, options?: { layer?: string }): void
  stop(
    target: HTMLElement | readonly HTMLElement[],
    properties?: readonly import('./types.js').KeyframeProperty[],
    options?: { layer?: string },
  ): void
  configure(options: WebConfig): void
  definePreset(name: string, preset: Preset): void
  release(target: HTMLElement): void
  dispose(): void
}

/** Call after mounting in a browser; importing this module is safe during SSR. */
export function createWebRuntime(
  document: Document,
  options?: RuntimeOptions,
): WebRuntime {
  const runtime = createInternalRuntime(document, options)
  // Keep diagnostics, ownership internals and driver implementation off the
  // package API, including at runtime rather than only in the declarations.
  return {
    reducedMotion: runtime.reducedMotion.bind(runtime),
    onReducedMotion: runtime.onReducedMotion.bind(runtime),
    interactiveNavigation: runtime.interactiveNavigation.bind(runtime),
    sharedNavigationEntry: runtime.sharedNavigationEntry.bind(runtime),
    glass: runtime.glass.bind(runtime),
    motionBehaviors: runtime.motionBehaviors.bind(runtime),
    sensor: runtime.sensor.bind(runtime) as WebRuntime['sensor'],
    haptic: runtime.haptic.bind(runtime),
    onKeyboard: runtime.onKeyboard.bind(runtime),
    followKeyboard: runtime.followKeyboard.bind(runtime),
    bottomSheet: runtime.bottomSheet.bind(runtime),
    interactiveModal: runtime.interactiveModal.bind(runtime),
    sharedNavigation: runtime.sharedNavigation.bind(runtime),
    physicsWorld: runtime.physicsWorld.bind(runtime),
    symbolEffect: runtime.symbolEffect.bind(runtime),
    particles: runtime.particles.bind(runtime),
    confetti: runtime.confetti.bind(runtime),
    blur: runtime.blur.bind(runtime),
    shape: runtime.shape.bind(runtime),
    drawBatch: runtime.drawBatch.bind(runtime),
    liquid: runtime.liquid.bind(runtime),
    imageEffect: runtime.imageEffect.bind(runtime),
    gradient: runtime.gradient.bind(runtime),
    gradientText: runtime.gradientText.bind(runtime),
    rig2d: runtime.rig2d.bind(runtime),
    reveal: runtime.reveal.bind(runtime),
    conceal: runtime.conceal.bind(runtime),
    animateText: runtime.animateText.bind(runtime),
    rollTo: runtime.rollTo.bind(runtime),
    shimmer: runtime.shimmer.bind(runtime),
    loader: runtime.loader.bind(runtime),
    animateItems: runtime.animateItems.bind(runtime),
    drawPath: runtime.drawPath.bind(runtime),
    motionStates: runtime.motionStates.bind(runtime),
    sequence: runtime.sequence.bind(runtime),
    timeline: runtime.timeline.bind(runtime),
    decay: runtime.decay.bind(runtime),
    playbackProgress: runtime.playbackProgress.bind(runtime),
    sharedLayout: runtime.sharedLayout.bind(runtime),
    withTimelineCues: runtime.withTimelineCues.bind(runtime),
    diagnostics: runtime.diagnostics.bind(runtime),
    scope: runtime.scope.bind(runtime),
    pointerFollow: runtime.pointerFollow.bind(runtime),
    renderActivity: runtime.renderActivity.bind(runtime),
    property: runtime.property.bind(runtime),
    propertyGroup: runtime.propertyGroup.bind(runtime),
    viewportEnter: runtime.viewportEnter.bind(runtime),
    animateSize: runtime.animateSize.bind(runtime),
    animateLayout: runtime.animateLayout.bind(runtime),
    seekableTimeline: runtime.seekableTimeline.bind(runtime),
    scrollValue: runtime.scrollValue.bind(runtime),
    scrollLinked: runtime.scrollLinked.bind(runtime),
    refresh: runtime.refresh.bind(runtime),
    observeGeometry: runtime.observeGeometry.bind(runtime),
    zoomable: runtime.zoomable.bind(runtime),
    scrollHeader: runtime.scrollHeader.bind(runtime),
    reorder: runtime.reorder.bind(runtime),
    gestures: runtime.gestures.bind(runtime),
    drag: runtime.drag.bind(runtime),
    dropZones: runtime.dropZones.bind(runtime),
    motionValue: runtime.motionValue.bind(runtime),
    springValue: runtime.springValue.bind(runtime),
    bind: runtime.bind.bind(runtime),
    animate: runtime.animate.bind(runtime),
    set: runtime.set.bind(runtime),
    press: runtime.press.bind(runtime),
    stop: runtime.stop.bind(runtime),
    configure: runtime.configure.bind(runtime),
    definePreset: runtime.definePreset.bind(runtime),
    release: runtime.release.bind(runtime),
    dispose: runtime.dispose.bind(runtime),
  }
}
