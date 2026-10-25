import { Application, Image, isIOS, type View } from '@nativescript/core'
import { stop, toView } from './animate.js'
import { reducedMotion } from './config.js'
import { ownImage } from './image-owner.js'
import { createZoomDriver, type ZoomDriver, type ZoomSnapshot } from './zoom-native.js'
import type { Target } from './types.js'

export type ZoomState = Readonly<ZoomSnapshot>
export interface PhotoDismissal {
  readonly state: ZoomState
  /** Release velocity in viewport-local DIPs per second. */
  readonly velocity: number
  /** Return to the viewer. False means this intent is obsolete. */
  cancel(): boolean
  /** Release explicitly when the image outlives its route. Unloading also disposes it. */
  complete(): boolean
}
export interface ZoomableOptions {
  /** Direct parent of the Image. Its bounds are the clipping/pointer viewport. */
  viewport?: Target
  /** Relative zoom range. Defaults to [1, 5]; minimum must be >= 1. */
  scale?: readonly [number, number]
  /** Double-tap zoom, clamped into the configured range. Defaults to 2.5. */
  doubleTap?: number
  dismiss?: 'vertical' | false
  /** These views follow dismissal natively; no JS progress callback is needed. */
  backdrop?: Target
  chrome?: Target
  /** One terminal intent per drag/programmatic close. App/router owns navigation. */
  onDismiss?: (dismissal: PhotoDismissal) => void
  /** Called at rest, never on each pointer/frame update. */
  onSettled?: (state: ZoomState) => void
  /** Setup failed after loading; resources are disposed before this callback. */
  onError?: (error: Error) => void
}
export interface Zoomable {
  readonly ready: boolean
  readonly error: Error | undefined
  readonly state: ZoomState
  /** Native adapter entry point for native navigation integrations. */
  readonly nativeController: object | undefined
  zoomTo(scale: number, focus?: { x: number; y: number }, animated?: boolean): void
  reset(animated?: boolean): void
  requestDismiss(): void
  cancelDismiss(): void
  dispose(): void
}

/** Makes an Image interactive without per-frame JS. Owns its transforms until disposed. */
export function zoomable(target: Target, options: ZoomableOptions = {}): Zoomable {
  const image = toView(target)
  if (!(image instanceof Image))
    throw new TypeError('zoomable() expects a NativeScript Image.')
  if (!options || typeof options !== 'object')
    throw new TypeError('Zoom options must be an object.')
  const viewport = options.viewport
    ? toView(options.viewport)
    : (image.parent as View | undefined)
  if (!viewport)
    throw new TypeError('A zoom viewport is required before the image has a parent.')
  const scale = options.scale ?? [1, 5]
  if (
    !Array.isArray(scale) ||
    scale.length !== 2 ||
    !scale.every(Number.isFinite) ||
    scale[0]! < 1 ||
    scale[1]! < scale[0]!
  )
    throw new RangeError(
      'Zoom scale must be [minimum, maximum], with 1 <= minimum <= maximum.',
    )
  const doubleTap = options.doubleTap ?? 2.5
  if (!Number.isFinite(doubleTap) || doubleTap < 1)
    throw new RangeError('Double-tap zoom must be a finite number >= 1.')
  if (
    options.dismiss !== undefined &&
    options.dismiss !== false &&
    options.dismiss !== 'vertical'
  )
    throw new TypeError("Dismiss must be 'vertical' or false.")
  for (const callback of [options.onDismiss, options.onSettled, options.onError])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Zoom callbacks must be functions.')
  const backdrop = options.backdrop ? toView(options.backdrop) : undefined
  const chrome = options.chrome ? toView(options.chrome) : undefined
  if (
    backdrop === image ||
    chrome === image ||
    backdrop === viewport ||
    chrome === viewport
  )
    throw new TypeError(
      'Dismissal backdrop/chrome must be separate from the image and viewport.',
    )
  if (image.parent && image.parent !== viewport)
    throw new TypeError('The zoom viewport must be the image’s direct parent.')
  if (
    image.rotate ||
    image.rotateX ||
    image.rotateY ||
    image.scaleX <= 0 ||
    image.scaleY <= 0
  )
    throw new TypeError(
      'Zoom supports positive axis-aligned image transforms; rotate an ancestor instead.',
    )
  return new Photo(image, viewport, { ...options, doubleTap, scale, backdrop, chrome })
}

class Photo implements Zoomable {
  private failure: Error | undefined
  private suspended = false
  private driver: ZoomDriver | undefined
  private stopped = false
  private queued = false
  private releaseOwnership: () => void = () => {}
  private generation = 0
  private reduceObserver:
    ReturnType<typeof Application.ios.addNotificationObserver> | undefined
  private latest: ZoomSnapshot
  constructor(
    private readonly image: Image,
    private readonly viewport: View,
    private readonly options: Omit<ZoomableOptions, 'backdrop' | 'chrome'> & {
      scale: readonly [number, number]
      doubleTap: number
      backdrop?: View
      chrome?: View
    },
  ) {
    this.latest = { x: 0, y: 0, scale: options.scale[0], progress: 0, pending: false }
    this.releaseOwnership = ownImage(image, this.dispose)
    stop(image, ['x', 'y', 'scaleX', 'scaleY'])
    for (const view of [image, viewport]) {
      view.on('loaded', this.schedule)
      view.on('layoutChanged', this.schedule)
      view.on('unloaded', this.dispose)
    }
    image.on('imageSourceChange', this.sourceChanged)
    image.on('stretchChange', this.sourceChanged)
    Application.on(Application.suspendEvent, this.suspend)
    Application.on(Application.resumeEvent, this.resume)
    if (isIOS)
      this.reduceObserver = Application.ios.addNotificationObserver(
        UIAccessibilityReduceMotionStatusDidChangeNotification,
        this.preferences,
      )
    this.schedule()
  }
  get ready() {
    return !!this.driver
  }
  get error() {
    return this.failure
  }
  get state(): ZoomState {
    return { ...(this.driver?.state ?? this.latest) }
  }
  get nativeController() {
    return this.driver?.native
  }
  zoomTo(value: number, focus?: { x: number; y: number }, animated = true) {
    if (
      !Number.isFinite(value) ||
      value < this.options.scale[0] ||
      value > this.options.scale[1]
    )
      throw new RangeError('Zoom must be within the configured scale range.')
    if (focus && (!Number.isFinite(focus.x) || !Number.isFinite(focus.y)))
      throw new RangeError('Zoom focus must be finite.')
    if (this.stopped) return
    const size = this.viewport.getActualSize()
    this.driver?.zoom(
      value,
      focus?.x ?? size.width / 2,
      focus?.y ?? size.height / 2,
      animated,
    )
  }
  reset(animated = true) {
    this.generation++
    this.driver?.reset(animated)
  }
  requestDismiss() {
    this.driver?.requestDismiss()
  }
  cancelDismiss() {
    this.reset(true)
  }
  dispose = () => {
    if (this.stopped) return
    this.stopped = true
    this.generation++
    this.latest = {
      x: 0,
      y: 0,
      scale: this.options.scale[0],
      progress: 0,
      pending: false,
    }
    this.driver?.stop()
    this.driver = undefined
    this.releaseOwnership()
    for (const view of [this.image, this.viewport]) {
      view.off('loaded', this.schedule)
      view.off('layoutChanged', this.schedule)
      view.off('unloaded', this.dispose)
    }
    this.image.off('imageSourceChange', this.sourceChanged)
    this.image.off('stretchChange', this.sourceChanged)
    Application.off(Application.suspendEvent, this.suspend)
    Application.off(Application.resumeEvent, this.resume)
    if (this.reduceObserver)
      Application.ios.removeNotificationObserver(
        this.reduceObserver,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
    this.reduceObserver = undefined
  }
  private dismissed = (
    x: number,
    y: number,
    scale: number,
    velocity: number,
    progress: number,
  ) => {
    if (this.stopped) return
    const generation = ++this.generation
    const valid = () => !this.stopped && generation === this.generation
    const dismissal: PhotoDismissal = {
      state: { x, y, scale, progress, pending: true },
      velocity,
      cancel: () => {
        if (!valid()) return false
        this.cancelDismiss()
        return true
      },
      complete: () => {
        if (!valid()) return false
        this.dispose()
        return true
      },
    }
    if (this.options.onDismiss) this.options.onDismiss(dismissal)
    else dismissal.cancel()
  }
  private settled = (x: number, y: number, scale: number) => {
    if (this.stopped) return
    this.generation++
    this.latest = { x, y, scale, progress: 0, pending: false }
    this.options.onSettled?.({ ...this.latest })
  }
  private sourceChanged = () => {
    this.generation++
    this.driver?.stop()
    this.driver = undefined
    this.schedule()
  }
  private suspend = () => {
    this.suspended = true
    this.generation++
    this.driver?.setActive(false)
  }
  private resume = () => {
    this.suspended = false
    this.preferences()
    this.driver?.setActive(true)
    this.schedule()
  }
  private preferences = () => this.driver?.setReduced(reducedMotion())
  private schedule = () => {
    if (this.stopped || this.queued) return
    this.queued = true
    void Promise.resolve()
      .then(() => {
        this.queued = false
        if (
          this.stopped ||
          this.suspended ||
          !this.image.isLoaded ||
          !this.viewport.isLoaded
        )
          return
        if (this.driver) {
          this.driver.layout()
          return
        }
        if (this.image.parent !== this.viewport)
          throw new TypeError('Zoom viewport must remain the direct image parent.')
        const size = this.viewport.getActualSize()
        const imageSize = this.image.getActualSize(),
          source = this.image.imageSource
        if (
          size.width <= 0 ||
          size.height <= 0 ||
          imageSize.width <= 0 ||
          imageSize.height <= 0 ||
          !source ||
          !Number.isFinite(source.width) ||
          !Number.isFinite(source.height) ||
          source.width <= 0 ||
          source.height <= 0
        )
          return
        if (isIOS && typeof JoltPhotoZoom === 'undefined')
          throw new Error('Rebuild the native app to install Jolt photo gestures.')
        this.driver = createZoomDriver(
          this.image,
          this.viewport,
          {
            minimum: this.options.scale[0],
            maximum: this.options.scale[1],
            doubleTap: this.options.doubleTap,
            dismiss: this.options.dismiss === 'vertical',
            reduced: reducedMotion(),
            backdrop: this.options.backdrop,
            chrome: this.options.chrome,
          },
          this.dismissed,
          this.settled,
        )
      })
      .catch((error: unknown) => {
        if (this.stopped) return
        this.failure = error instanceof Error ? error : new Error(String(error))
        this.dispose()
        this.options.onError?.(this.failure)
      })
  }
}
