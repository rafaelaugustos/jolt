import {
  Application,
  Image,
  ImageSource,
  ScrollView,
  isIOS,
  type EventData,
} from '@nativescript/core'
import { toView } from './animate.js'
import { reducedMotion, timeScale } from './config.js'
import type { Animation } from './engine.js'
import { ownImage } from './image-owner.js'
import { createImageRenderer, type ImageRenderer } from './image-effect-native.js'
import { springValue, liveValueInput, type DerivedValue } from './motion-value.js'
import { nativeLiveNode } from './live-spring-driver.js'
import type { Target } from './types.js'

export type ImageEffectName = 'ripple' | 'distortion' | 'dissolve' | 'liquid-mask'
export type ImageEffectParameter =
  'progress' | 'amplitude' | 'radius' | 'originX' | 'originY'
/** Centers/sizes are normalized to the target; radii use its shorter side. */
export interface LiquidCirclePose {
  x: number
  y: number
  radius: number
}
export interface LiquidMaskPose extends LiquidCirclePose {
  width: number
  height: number
}
export type LiquidMaskShape =
  | { kind: 'circle'; from: LiquidCirclePose; to: LiquidCirclePose }
  | { kind: 'rectangle'; from: LiquidMaskPose; to: LiquidMaskPose }
export interface LiquidMaskOptions {
  shapes: readonly LiquidMaskShape[]
  /** Smooth-union distance in DIPs. */ blend?: number
}
/** Local, unprotected video. iOS only. The Image remains the poster/fallback. */
export interface ImageEffectVideo {
  src: string
  loop?: boolean
  paused?: boolean
}
export interface ImageEffectScroll {
  range: readonly [number, number]
  output?: readonly [number, number]
  axis?: 'x' | 'y'
}
export interface ImageEffectOptions {
  mask?: LiquidMaskOptions
  video?: ImageEffectVideo
  /** Origin in target-local DIPs; defaults to the center. */
  origin?: { x: number; y: number }
  /** Maximum displacement in DIPs, 0..64. Defaults to 8. */
  amplitude?: number
  /** Influence radius in DIPs, greater than zero. Defaults to 96. */
  radius?: number
  /** Milliseconds for a finite effect (or drag release). Defaults to 650. */
  duration?: number
  /** Deterministic dissolve noise seed, 0..65535. Defaults to 1. */
  seed?: number
  /** Loaded destination raster for dissolve. */
  to?: ImageSource
  /** Prepare at progress zero without starting. */
  paused?: boolean
}
export interface ImageEffectDiagnostics {
  backend: 'waiting' | 'metal' | 'agsl' | 'fallback'
  reason?: 'reduced-motion' | 'unsupported' | 'not-visible'
  /** Native setup error, when available. Intended for developer diagnostics. */
  detail?: string
  frames: number
  nativeParameterWrites: number
  renderCpuMs: number
  renderGpuMs: number
  videoFrames: number
  videoTime: number
  videoStatus: string
  resizeCount: number
  textureBytes: number
  peakTextureBytes: number
  preparationMs: number
  longestFrameMs: number
  /** Last 512 active native draw-callback intervals, in milliseconds. Not GPU/presentation time. */
  frameIntervalsMs: readonly number[]
}
export interface ImageEffect extends Animation {
  readonly effect: ImageEffectName
  readonly paused: boolean
  readonly duration: number
  /** Finite progress; distortion rejects seeking because it follows native touch input. */
  progress: number
  readonly diagnostics: Readonly<ImageEffectDiagnostics>
  /** Attach a numeric Jolt value; mapping and spring writes stay native. */
  bind(parameter: ImageEffectParameter, value: DerivedValue): () => void
  /** Observe native scroll offsets directly (no ScrollView JS scroll callback). */
  bindScroll(
    parameter: ImageEffectParameter,
    scroll: Target,
    options: ImageEffectScroll,
  ): () => void
  set(parameter: ImageEffectParameter, value: number): void
  /** Replace/remove the iOS local video without replacing the effect. */
  setVideo(source: ImageEffectVideo | null): void
  pauseVideo(): void
  playVideo(): void
  pause(): void
  play(): void
  /** Reverse a finite effect from its current pixels. Terminal handles remain terminal. */
  reverse(): void
  /** Complete immediately at the current direction's endpoint. */
  finish(): void
}

const names: readonly ImageEffectName[] = [
  'ripple',
  'distortion',
  'dissolve',
  'liquid-mask',
]
const surfaceChanges = [
  ...['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(
    (corner) => `border${corner}RadiusChange`,
  ),
  ...['Top', 'Right', 'Bottom', 'Left'].flatMap((edge) => [
    `padding${edge}Change`,
    `border${edge}WidthChange`,
  ]),
]

/** Optional native image effects. Stop restores the source; dissolve completion commits its destination. */
export function imageEffect(
  target: Target,
  effect: ImageEffectName,
  options: ImageEffectOptions = {},
): ImageEffect {
  const image = toView(target)
  if (!(image instanceof Image))
    throw new TypeError('imageEffect() expects a NativeScript Image.')
  if (!names.includes(effect))
    throw new TypeError(`Unknown image effect: ${String(effect)}.`)
  if (!options || typeof options !== 'object')
    throw new TypeError('Image effect options must be an object.')
  const amplitude = options.amplitude ?? 8,
    radius = options.radius ?? 96
  const duration = options.duration ?? 650,
    seed = options.seed ?? 1
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 64)
    throw new RangeError('Image displacement must be between 0 and 64 DIPs.')
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    throw new RangeError('Image radius and duration must be positive finite numbers.')
  if (!Number.isInteger(seed) || seed < 0 || seed > 65535)
    throw new RangeError('Image seed must be an integer between 0 and 65535.')
  if (
    options.origin &&
    (!Number.isFinite(options.origin.x) || !Number.isFinite(options.origin.y))
  )
    throw new RangeError('Image origin must contain finite local coordinates.')
  if (options.paused !== undefined && typeof options.paused !== 'boolean')
    throw new TypeError('paused must be a boolean.')
  if (
    effect === 'dissolve' &&
    (!(options.to instanceof ImageSource) ||
      !Number.isFinite(options.to.width) ||
      !Number.isFinite(options.to.height) ||
      options.to.width <= 0 ||
      options.to.height <= 0)
  )
    throw new TypeError('Dissolve requires a loaded destination ImageSource.')
  validateMask(effect, options.mask)
  validateVideo(effect, options.video)
  return new Effect(image, effect, {
    ...options,
    mask: options.mask
      ? {
          blend: options.mask.blend,
          shapes: options.mask.shapes.map(
            (shape) =>
              ({
                ...shape,
                from: { ...shape.from },
                to: { ...shape.to },
              }) as LiquidMaskShape,
          ),
        }
      : undefined,
    amplitude,
    radius,
    duration: duration / timeScale(),
    seed,
  })
}

const parameters: readonly ImageEffectParameter[] = [
  'progress',
  'amplitude',
  'radius',
  'originX',
  'originY',
]
function parameterValue(parameter: ImageEffectParameter, value: number) {
  if (!parameters.includes(parameter))
    throw new TypeError('Unknown image shader parameter.')
  if (
    !Number.isFinite(value) ||
    (parameter === 'progress' && (value < 0 || value > 1)) ||
    (parameter === 'amplitude' && (value < 0 || value > 64)) ||
    (parameter === 'radius' && value <= 0)
  )
    throw new RangeError('Invalid image shader parameter value.')
}
function validateVideo(effect: ImageEffectName, video?: ImageEffectVideo | null) {
  if (video == null) return
  if (!isIOS) throw new TypeError('Video image textures currently require iOS.')
  if (effect === 'dissolve')
    throw new TypeError('Video textures do not support dissolve destinations.')
  if (
    typeof video !== 'object' ||
    typeof video.src !== 'string' ||
    !video.src.startsWith('/') ||
    (video.loop !== undefined && typeof video.loop !== 'boolean') ||
    (video.paused !== undefined && typeof video.paused !== 'boolean')
  )
    throw new TypeError(
      'Video requires an absolute local file path and boolean playback options.',
    )
}
function validateMask(effect: ImageEffectName, mask?: LiquidMaskOptions) {
  if (effect !== 'liquid-mask' && mask !== undefined)
    throw new TypeError('Mask shapes require liquid-mask.')
  if (effect !== 'liquid-mask') return
  if (
    !mask ||
    !Array.isArray(mask.shapes) ||
    mask.shapes.length < 1 ||
    mask.shapes.length > 8
  )
    throw new RangeError('A liquid mask needs 1..8 shapes.')
  if (
    !Number.isFinite(mask.blend ?? 16) ||
    (mask.blend ?? 16) < 0 ||
    (mask.blend ?? 16) > 128
  )
    throw new RangeError('Mask blend must be 0..128 DIPs.')
  for (const shape of mask.shapes) {
    if (!shape || !['circle', 'rectangle'].includes(shape.kind))
      throw new TypeError('Unknown liquid mask shape.')
    for (const pose of [shape.from, shape.to]) {
      if (
        !pose ||
        !['x', 'y', 'radius'].every((key) =>
          Number.isFinite(pose[key as keyof LiquidCirclePose]),
        ) ||
        Math.abs(pose.x) > 4 ||
        Math.abs(pose.y) > 4 ||
        (shape.kind === 'rectangle' &&
          (!Number.isFinite((pose as LiquidMaskPose).width) ||
            !Number.isFinite((pose as LiquidMaskPose).height) ||
            (pose as LiquidMaskPose).width <= 0 ||
            (pose as LiquidMaskPose).width > 4 ||
            (pose as LiquidMaskPose).height <= 0 ||
            (pose as LiquidMaskPose).height > 4)) ||
        pose.radius < 0 ||
        pose.radius > 2 ||
        (shape.kind === 'circle' && pose.radius === 0)
      )
        throw new RangeError(
          'Mask poses need finite normalized centers, positive sizes and valid radii.',
        )
    }
  }
}

class Effect implements ImageEffect {
  readonly finished: Promise<boolean>
  private resolve!: (completed: boolean) => void
  private renderer: ImageRenderer | undefined
  private releaseOwnership: () => void = () => {}
  private terminal = false
  private queued = false
  private committing = false
  private userPaused: boolean
  private suspended = false
  private position = 0
  private direction: 0 | 1 = 1
  private dimensions = ''
  private surfaceDirty = false
  private bindings = new Map<
    ImageEffectParameter,
    { attach: (renderer: ImageRenderer) => () => void; detach: () => void }
  >()
  private pendingParameters = new Map<ImageEffectParameter, number>()
  private video: ImageEffectVideo | null = null
  private stats: ImageEffectDiagnostics = {
    backend: 'waiting',
    frames: 0,
    nativeParameterWrites: 0,
    renderCpuMs: 0,
    renderGpuMs: 0,
    videoFrames: 0,
    videoTime: 0,
    videoStatus: 'none',
    resizeCount: 0,
    textureBytes: 0,
    peakTextureBytes: 0,
    preparationMs: 0,
    longestFrameMs: 0,
    frameIntervalsMs: [],
  }
  private reduceObserver:
    ReturnType<typeof Application.ios.addNotificationObserver> | undefined

  constructor(
    private readonly image: Image,
    readonly effect: ImageEffectName,
    private readonly options: ImageEffectOptions &
      Required<Pick<ImageEffectOptions, 'amplitude' | 'radius' | 'duration' | 'seed'>>,
  ) {
    this.userPaused = options.paused ?? false
    this.video = options.video ? { ...options.video } : null
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.releaseOwnership = ownImage(image, this.stop)
    for (const event of ['loaded', 'layoutChanged']) image.on(event, this.schedule)
    for (const event of ['imageSourceChange', 'stretchChange'])
      image.on(event, this.changed)
    image.on('unloaded', this.unloaded)
    image.style.on('visibilityChange', this.visible)
    image.style.on('tintColorChange', this.changed)
    for (const event of surfaceChanges) image.style.on(event, this.surfaceChanged)
    Application.on(Application.suspendEvent, this.suspend)
    Application.on(Application.resumeEvent, this.resume)
    if (isIOS)
      this.reduceObserver = Application.ios.addNotificationObserver(
        UIAccessibilityReduceMotionStatusDidChangeNotification,
        this.preferences,
      )
    this.schedule()
  }
  then<TResult1 = boolean, TResult2 = never>(
    fulfilled?: ((value: boolean) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.finished.then(fulfilled, rejected)
  }
  get paused() {
    return this.userPaused
  }
  get duration() {
    return this.effect === 'distortion' ? Infinity : this.options.duration
  }
  get progress() {
    return this.renderer?.progress ?? this.position
  }
  set progress(value: number) {
    if (this.effect === 'distortion')
      throw new TypeError('Distortion follows touch input and cannot be scrubbed.')
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError('Image progress must be between 0 and 1.')
    if (this.terminal) return
    this.unbind('progress')
    this.position = value
    this.renderer?.seek(value)
  }
  get diagnostics(): Readonly<ImageEffectDiagnostics> {
    return {
      ...this.stats,
      ...(this.renderer
        ? {
            frames: this.renderer.frames,
            nativeParameterWrites: this.renderer.nativeParameterWrites,
            videoFrames: this.renderer.videoFrames,
            renderCpuMs: this.renderer.renderCpuMs,
            renderGpuMs: this.renderer.renderGpuMs,
            videoTime: this.renderer.videoTime,
            videoStatus: this.renderer.videoStatus,
            resizeCount: this.renderer.resizeCount,
            peakTextureBytes: Math.max(
              this.stats.peakTextureBytes,
              this.renderer.peakTextureBytes,
            ),
            textureBytes: this.renderer.textureBytes,
            longestFrameMs: this.renderer.longestFrameMs,
            frameIntervalsMs: this.renderer.frameIntervalsMs,
          }
        : {}),
    }
  }
  private unbind(parameter: ImageEffectParameter) {
    this.bindings.get(parameter)?.detach()
    this.bindings.delete(parameter)
  }
  private binding(
    parameter: ImageEffectParameter,
    attach: (renderer: ImageRenderer) => () => void,
    cleanup = () => {},
  ) {
    this.unbind(parameter)
    let stop = () => {}
    const entry = {
      attach: (renderer: ImageRenderer) => {
        stop = attach(renderer)
        return stop
      },
      detach: () => {
        stop()
        cleanup()
      },
    }
    this.bindings.set(parameter, entry)
    try {
      if (this.renderer) entry.attach(this.renderer)
    } catch (error) {
      this.unbind(parameter)
      throw error
    }
    return () => {
      if (this.bindings.get(parameter) === entry) this.unbind(parameter)
    }
  }
  bind = (parameter: ImageEffectParameter, value: DerivedValue) => {
    parameterValue(parameter, value.get())
    if (this.effect === 'distortion' && parameter === 'progress')
      throw new TypeError('Distortion follows touch input.')
    if (this.terminal) throw new Error('Image effect has stopped.')
    const follower = springValue(value, { duration: 0 })
    const input = liveValueInput(follower)
    const release = input.retain()
    return this.binding(
      parameter,
      (renderer) => renderer.bind(parameter, nativeLiveNode(input.node)),
      () => {
        release()
        follower.dispose()
      },
    )
  }
  bindScroll = (
    parameter: ImageEffectParameter,
    target: Target,
    options: ImageEffectScroll,
  ) => {
    const scroll = toView(target)
    if (!(scroll instanceof ScrollView))
      throw new TypeError('Image shader scroll binding requires a ScrollView.')
    const range = options?.range,
      output = options?.output ?? [0, 1]
    if (
      !range ||
      range.length !== 2 ||
      !range.every(Number.isFinite) ||
      range[0] === range[1] ||
      !Number.isFinite(range[1]! - range[0]!) ||
      output.length !== 2 ||
      !output.every(Number.isFinite) ||
      !['x', 'y'].includes(options.axis ?? 'y')
    )
      throw new RangeError('Scroll binding requires finite ranges and x/y axis.')
    output.forEach((value) => parameterValue(parameter, value))
    if (this.effect === 'distortion' && parameter === 'progress')
      throw new TypeError('Distortion follows touch input.')
    if (this.terminal) throw new Error('Image effect has stopped.')
    const config = {
      range: [...range] as [number, number],
      output: [...output] as [number, number],
      axis: options.axis ?? ('y' as const),
    }
    return this.binding(parameter, (renderer) => {
      let off = () => {}
      const attach = () => {
        off()
        off = renderer.bindScroll(parameter, scroll, config)
      }
      const detach = () => {
        off()
        off = () => {}
      }
      scroll.on('loaded', attach)
      scroll.on('unloaded', detach)
      if (scroll.isLoaded) attach()
      return () => {
        detach()
        scroll.off('loaded', attach)
        scroll.off('unloaded', detach)
      }
    })
  }
  set = (parameter: ImageEffectParameter, value: number) => {
    parameterValue(parameter, value)
    if (parameter === 'progress') {
      this.progress = value
      return
    }
    if (this.terminal) return
    this.unbind(parameter)
    this.pendingParameters.set(parameter, value)
    this.renderer?.set(parameter, value)
  }
  setVideo = (source: ImageEffectVideo | null) => {
    validateVideo(this.effect, source)
    if (this.terminal) return
    this.renderer?.setVideo(source)
    this.video = source ? { ...source } : null
  }
  pauseVideo = () => {
    if (this.video) this.video.paused = true
    this.renderer?.pauseVideo()
  }
  playVideo = () => {
    if (this.video) this.video.paused = false
    if (!this.suspended) this.renderer?.playVideo()
  }
  pause = () => {
    if (this.terminal) return
    this.userPaused = true
    this.renderer?.pause()
  }
  play = () => {
    if (this.terminal) return
    this.unbind('progress')
    this.userPaused = false
    if (this.suspended) return
    if (this.renderer) {
      if (this.effect === 'distortion') this.renderer.resume()
      else this.renderer.play(this.direction)
    } else this.schedule()
  }
  reverse = () => {
    if (this.effect === 'distortion')
      throw new TypeError('Distortion has no finite playback direction.')
    if (this.terminal) return
    this.direction = this.direction === 1 ? 0 : 1
    this.play()
  }
  finish = () => {
    if (this.terminal) return
    if (this.effect === 'distortion') return this.stop()
    if (this.effect === 'liquid-mask') {
      this.pause()
      this.progress = this.direction
      return
    }
    this.complete(true, this.direction)
  }
  stop = () => this.complete(false, this.progress)
  private complete = (completed: boolean, position: number, preserveImage = false) => {
    if (this.terminal) return
    this.terminal = true
    this.position = position
    this.stats = { ...this.diagnostics, textureBytes: 0 }
    for (const parameter of [...this.bindings.keys()]) this.unbind(parameter)
    this.renderer?.stop(preserveImage)
    this.renderer = undefined
    this.releaseOwnership()
    for (const event of ['loaded', 'layoutChanged']) this.image.off(event, this.schedule)
    for (const event of ['imageSourceChange', 'stretchChange'])
      this.image.off(event, this.changed)
    this.image.off('unloaded', this.unloaded)
    this.image.style.off('visibilityChange', this.visible)
    this.image.style.off('tintColorChange', this.changed)
    for (const event of surfaceChanges) this.image.style.off(event, this.surfaceChanged)
    Application.off(Application.suspendEvent, this.suspend)
    Application.off(Application.resumeEvent, this.resume)
    if (this.reduceObserver)
      Application.ios.removeNotificationObserver(
        this.reduceObserver,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
    this.reduceObserver = undefined
    if (completed && this.effect === 'dissolve' && position === 1) {
      this.committing = true
      // The view may clear its ImageSource on disposal. Keep the caller's
      // destination reusable by giving the view its own wrapper.
      const destination = new ImageSource(this.options.to!.getNativeSource())
      destination.rotationAngle = this.options.to!.rotationAngle
      this.image.imageSource = destination
      this.committing = false
    }
    this.resolve(completed)
  }
  private changed = (event?: EventData) => {
    if (this.committing) return
    if (this.renderer)
      this.complete(false, this.progress, event?.eventName === 'imageSourceChange')
    else this.schedule()
  }
  private surfaceChanged = () => {
    this.surfaceDirty = true
    this.schedule()
  }
  private suspend = () => {
    this.suspended = true
    this.renderer?.pause()
    this.renderer?.suspended(true)
  }
  private unloaded = () => {
    if (Application.suspended) return
    this.stop()
  }
  private resume = () => {
    this.suspended = false
    this.renderer?.suspended(false)
    this.schedule()
    if (!this.userPaused && !this.bindings.has('progress')) this.play()
  }
  private visible = () => {
    if (this.image.visibility !== 'visible') this.stop()
  }
  private preferences = () => {
    if (reducedMotion()) this.fallback('reduced-motion')
  }
  private fallback(reason: ImageEffectDiagnostics['reason']) {
    this.stats = { ...this.stats, backend: 'fallback', reason }
    // Reduced/unsupported rendering still performs a requested content change.
    if (this.effect === 'dissolve' && this.direction === 1) {
      this.complete(true, 1)
    } else this.complete(false, 0)
  }
  private schedule = () => {
    if (this.queued || this.terminal) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.terminal || this.suspended || !this.image.isLoaded) return
      if (reducedMotion()) return this.fallback('reduced-motion')
      if (this.image.visibility !== 'visible') return this.fallback('not-visible')
      const { width, height } = this.image.getActualSize()
      if (width <= 0 || height <= 0) return
      const dimensions = `${width}:${height}`
      if (this.renderer) {
        if (this.dimensions !== dimensions || this.surfaceDirty) {
          try {
            this.renderer.resize()
            this.dimensions = dimensions
            this.surfaceDirty = false
          } catch (error) {
            this.stats.detail = String(error)
            this.stop()
          }
        }
        return
      }
      if (!this.image.imageSource) return
      this.dimensions = dimensions
      const started = Date.now()
      try {
        this.renderer = createImageRenderer(
          this.image,
          {
            ...this.options,
            mode: names.indexOf(this.effect),
            video: this.video ?? undefined,
            x: this.options.origin?.x ?? width / 2,
            y: this.options.origin?.y ?? height / 2,
          },
          this.complete,
        )
      } catch (error) {
        this.stats.preparationMs = Date.now() - started
        this.stats.detail = String(error)
        return this.fallback('unsupported')
      }
      if (!this.renderer) return this.fallback('unsupported')
      this.stats.backend = this.renderer.backend
      this.stats.preparationMs = Date.now() - started
      this.stats.peakTextureBytes = this.renderer.textureBytes
      try {
        this.renderer.pause()
        if (this.position) this.renderer.seek(this.position)
        for (const [parameter, value] of this.pendingParameters)
          this.renderer.set(parameter, value)
        for (const entry of this.bindings.values()) entry.attach(this.renderer)
        if (!this.userPaused && !this.suspended && !this.bindings.has('progress'))
          this.play()
      } catch (error) {
        this.stats.detail = String(error)
        this.fallback('unsupported')
      }
    })
  }
}
