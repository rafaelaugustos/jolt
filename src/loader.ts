import { Application, Color, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import type { Target } from './types.js'
import { reducedMotion } from './config.js'
import { loaderDefinition, type LoaderStyle } from './core/loading.js'

export type { LoaderStyle }

export interface LoaderOptions {
  /** Defaults to 'dots'. */
  style?: LoaderStyle
  /** A NativeScript color string. Defaults to '#71717a'. */
  color?: string
  /** Maximum width and height in DIPs, fitted inside the target. Defaults to 48. */
  size?: number
  /** Milliseconds per cycle. Defaults to 1200. */
  duration?: number
}

const running = new WeakMap<View, () => void>()
const key = 'jolt:loader'

/**
 * Adds a centered native iOS loading indicator. Returns an idempotent cleanup.
 * Unloading releases native resources; loading resumes until explicitly stopped.
 * Reduce Motion keeps the indicator static. Android is a no-op.
 */
export function loader(target: Target, options: LoaderOptions = {}): () => void {
  const settings: Required<LoaderOptions> = {
    style: options.style ?? loaderDefinition.style,
    color: options.color ?? loaderDefinition.color,
    size: options.size ?? loaderDefinition.size,
    duration: options.duration ?? loaderDefinition.duration,
  }
  if (!['dots', 'bars', 'ring'].includes(settings.style))
    throw new TypeError('Unknown loader style.')
  if (typeof settings.color !== 'string' || !Color.isValid(settings.color))
    throw new TypeError('Loader color must be a valid color string.')
  for (const name of ['size', 'duration'] as const)
    if (!Number.isFinite(settings[name]) || settings[name] <= 0)
      throw new RangeError(`Loader ${name} must be a positive finite number.`)
  const view = toView(target)
  running.get(view)?.()
  if (!isIOS) return () => {}
  return new Loader(view, settings).stop
}

class Loader {
  private stopped = false
  private queued = false
  private waitingForLoad: boolean
  private native: UIView | undefined
  private layer: CAReplicatorLayer | undefined
  private item: CALayer | undefined
  private animating = false
  private observer: ReturnType<typeof Application.ios.addNotificationObserver> | undefined

  constructor(
    private readonly view: View,
    private readonly settings: Required<LoaderOptions>,
  ) {
    this.waitingForLoad = !view.isLoaded
    running.set(view, this.stop)
    view.on('loaded', this.loaded)
    view.on('layoutChanged', this.schedule)
    view.on('unloaded', this.unloaded)
    this.schedule()
  }

  stop = () => {
    if (this.stopped) return
    this.stopped = true
    this.view.off('loaded', this.loaded)
    this.view.off('layoutChanged', this.schedule)
    this.view.off('unloaded', this.unloaded)
    if (running.get(this.view) === this.stop) running.delete(this.view)
    this.unloaded()
  }

  private loaded = () => {
    this.waitingForLoad = false
    this.schedule()
  }

  private unloaded = () => {
    this.waitingForLoad = true
    if (this.observer) {
      Application.ios.removeNotificationObserver(
        this.observer,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
      this.observer = undefined
    }
    this.remove()
  }

  private schedule = () => {
    if (this.stopped || this.queued) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.stopped) return
      try {
        this.update()
      } catch (error) {
        this.stop()
        throw error
      }
    })
  }

  private update() {
    if (this.waitingForLoad || !this.view.isLoaded) return
    const native = this.view.nativeViewProtected as UIView | undefined
    if (!native?.window) return this.remove()
    const bounds = native.layer.bounds
    const size = Math.min(this.settings.size, bounds.size.width, bounds.size.height)
    if (size <= 0) return this.remove()
    if (this.native && this.native !== native) this.remove()
    this.observer ??= Application.ios.addNotificationObserver(
      UIAccessibilityReduceMotionStatusDidChangeNotification,
      this.schedule,
    )

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      if (!this.layer) {
        this.native = native
        this.layer = CAReplicatorLayer.new()
        this.layer.name = key
        this.item = CALayer.new()
        this.item.backgroundColor = new Color(this.settings.color).ios.CGColor
        this.layer.addSublayer(this.item)
        native.layer.addSublayer(this.layer)
      }
      const layer = this.layer
      const item = this.item!
      const { style, duration } = this.settings
      const kind = loaderDefinition.kinds[style]
      layer.bounds = CGRectMake(0, 0, size, size)
      layer.position = CGPointMake(
        bounds.origin.x + bounds.size.width / 2,
        bounds.origin.y + bounds.size.height / 2,
      )
      layer.instanceCount = kind.count
      layer.instanceDelay = duration / 1000 / kind.stagger
      if (style === 'ring') {
        const diameter = size * kind.width
        item.bounds = CGRectMake(0, 0, diameter, diameter)
        item.position = CGPointMake(size / 2, diameter / 2)
        item.cornerRadius = diameter / 2
        layer.instanceTransform = CATransform3DMakeRotation(
          (2 * Math.PI) / kind.count,
          0,
          0,
          1,
        )
      } else {
        const width = size * kind.width
        const height = size * kind.height
        item.bounds = CGRectMake(0, 0, width, height)
        item.position = CGPointMake(width / 2, size / 2)
        item.cornerRadius = width / 2
        layer.instanceTransform = CATransform3DMakeTranslation(
          (size - width) / (layer.instanceCount - 1),
          0,
          0,
        )
      }
      const reduced = reducedMotion()
      item.opacity = kind.rest
      if (reduced && this.animating) {
        item.removeAnimationForKey(key)
        this.animating = false
      } else if (!reduced && !this.animating) {
        const animation = CAKeyframeAnimation.animationWithKeyPath(
          kind.property === 'opacity'
            ? 'opacity'
            : kind.property === 'scaleY'
              ? 'transform.scale.y'
              : 'transform.scale',
        )
        animation.values = NSArray.arrayWithArray([...kind.values])
        animation.keyTimes = NSArray.arrayWithArray([...kind.times])
        animation.duration = duration / 1000
        animation.repeatCount = Infinity
        // Start one cycle in so every delayed copy is already participating.
        animation.beginTime =
          item.convertTimeFromLayer(CACurrentMediaTime(), null) - animation.duration
        item.addAnimationForKey(animation, key)
        this.animating = true
      }
    } finally {
      CATransaction.commit()
    }
  }

  private remove() {
    this.item?.removeAnimationForKey(key)
    this.layer?.removeFromSuperlayer()
    this.item = this.layer = this.native = undefined
    this.animating = false
  }
}
