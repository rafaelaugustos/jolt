import {
  Application,
  Image,
  ImageSource,
  isIOS,
  type EventData,
} from '@nativescript/core'
import { toView } from './animate.js'
import { reducedMotion, timeScale } from './config.js'
import type { Animation } from './engine.js'
import { ownImage } from './image-owner.js'
import { createImageRenderer, type ImageRenderer } from './image-effect-native.js'
import type { Target } from './types.js'

export type ImageEffectName = 'ripple' | 'distortion' | 'dissolve'
export interface ImageEffectOptions {
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
  textureBytes: number
  peakTextureBytes: number
  preparationMs: number
  longestFrameMs: number
}
export interface ImageEffect extends Animation {
  readonly effect: ImageEffectName
  readonly paused: boolean
  /** Finite progress; distortion rejects seeking because it follows native touch input. */
  progress: number
  readonly diagnostics: Readonly<ImageEffectDiagnostics>
  pause(): void
  play(): void
  /** Reverse a finite effect from its current pixels. Terminal handles remain terminal. */
  reverse(): void
  /** Complete immediately at the current direction's endpoint. */
  finish(): void
}

const names: readonly ImageEffectName[] = ['ripple', 'distortion', 'dissolve']
const surfaceChanges = [
  'tintColorChange',
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
  return new Effect(image, effect, {
    ...options,
    amplitude,
    radius,
    duration: duration / timeScale(),
    seed,
  })
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
  private stats: ImageEffectDiagnostics = {
    backend: 'waiting',
    frames: 0,
    textureBytes: 0,
    peakTextureBytes: 0,
    preparationMs: 0,
    longestFrameMs: 0,
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
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.releaseOwnership = ownImage(image, this.stop)
    for (const event of ['loaded', 'layoutChanged']) image.on(event, this.schedule)
    for (const event of ['imageSourceChange', 'stretchChange'])
      image.on(event, this.changed)
    image.on('unloaded', this.stop)
    image.style.on('visibilityChange', this.visible)
    for (const event of surfaceChanges) image.style.on(event, this.changed)
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
  get progress() {
    return this.renderer?.progress ?? this.position
  }
  set progress(value: number) {
    if (this.effect === 'distortion')
      throw new TypeError('Distortion follows touch input and cannot be scrubbed.')
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError('Image progress must be between 0 and 1.')
    if (this.terminal) return
    this.position = value
    this.renderer?.seek(value)
  }
  get diagnostics(): Readonly<ImageEffectDiagnostics> {
    return {
      ...this.stats,
      ...(this.renderer
        ? {
            frames: this.renderer.frames,
            textureBytes: this.renderer.textureBytes,
            longestFrameMs: this.renderer.longestFrameMs,
          }
        : {}),
    }
  }
  pause = () => {
    if (this.terminal) return
    this.userPaused = true
    this.renderer?.pause()
  }
  play = () => {
    if (this.terminal) return
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
    this.complete(true, this.direction)
  }
  stop = () => this.complete(false, this.progress)
  private complete = (completed: boolean, position: number, preserveImage = false) => {
    if (this.terminal) return
    this.terminal = true
    this.position = position
    this.stats = { ...this.diagnostics, textureBytes: 0 }
    this.renderer?.stop(preserveImage)
    this.renderer = undefined
    this.releaseOwnership()
    for (const event of ['loaded', 'layoutChanged']) this.image.off(event, this.schedule)
    for (const event of ['imageSourceChange', 'stretchChange'])
      this.image.off(event, this.changed)
    this.image.off('unloaded', this.stop)
    this.image.style.off('visibilityChange', this.visible)
    for (const event of surfaceChanges) this.image.style.off(event, this.changed)
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
  private suspend = () => {
    this.suspended = true
    this.renderer?.pause()
  }
  private resume = () => {
    this.suspended = false
    this.schedule()
    if (!this.userPaused) this.play()
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
        if (this.dimensions !== dimensions) this.stop()
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
      this.renderer.pause()
      if (this.position) this.renderer.seek(this.position)
      if (!this.userPaused && !this.suspended) this.play()
    })
  }
}
