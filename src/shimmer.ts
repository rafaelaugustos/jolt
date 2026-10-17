import { Application, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import type { Target } from './types.js'
import { reducedMotion } from './config.js'

export interface ShimmerOptions {
  /** Milliseconds per sweep. Defaults to 1500. */
  duration?: number
}

const running = new WeakMap<View, () => void>()
const key = 'jolt:shimmer'

// NativeScript saves a mask here while applying clip-path or non-uniform borders.
type MaskedView = UIView & { originalMask?: CALayer | null }

/**
 * Sweeps a native gradient mask across an iOS placeholder until stopped.
 * Waits for layout, respects Reduce Motion and pauses while the view is unloaded.
 * Android is a no-op. Returns an idempotent cleanup function.
 */
export function shimmer(target: Target, options: ShimmerOptions = {}): () => void {
  const view = toView(target)
  const duration = options.duration ?? 1500
  if (!Number.isFinite(duration) || duration <= 0)
    throw new RangeError('Shimmer duration must be a positive finite number.')
  running.get(view)?.()
  if (!isIOS) return () => {}
  return new Shimmer(view, duration).stop
}

class Shimmer {
  private stopped = false
  private queued = false
  private waitingForLoad: boolean
  private native: MaskedView | undefined
  private owner: CALayer | undefined
  private gradient: CAGradientLayer | undefined
  private observer: ReturnType<typeof Application.ios.addNotificationObserver> | undefined

  constructor(
    private readonly view: View,
    private readonly duration: number,
  ) {
    this.waitingForLoad = !view.isLoaded
    running.set(view, this.stop)
    view.on('loaded', this.loaded)
    view.on('layoutChanged', this.schedule)
    view.on('unloaded', this.unloaded)
    view.style.on('backgroundInternalChange', this.schedule)
    this.update()
  }

  stop = () => {
    if (this.stopped) return
    this.stopped = true
    const { view } = this
    view.off('loaded', this.loaded)
    view.off('layoutChanged', this.schedule)
    view.off('unloaded', this.unloaded)
    view.style.off('backgroundInternalChange', this.schedule)
    if (running.get(view) === this.stop) running.delete(view)
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
    // Core raises layoutChanged before redrawing the background and its mask.
    // Attach after that pass, coalescing events from the same layout.
    void Promise.resolve().then(() => {
      this.queued = false
      this.update()
    })
  }

  private update = () => {
    if (this.stopped || this.waitingForLoad || !this.view.isLoaded) return
    const native = this.view.nativeViewProtected as MaskedView | undefined
    if (!native) return
    this.observer ??= Application.ios.addNotificationObserver(
      UIAccessibilityReduceMotionStatusDidChangeNotification,
      this.update,
    )
    if (reducedMotion()) return this.remove()
    const bounds = native.layer.bounds
    if (bounds.size.width <= 0 || bounds.size.height <= 0) return this.remove()
    if (this.native && this.native !== native) this.remove()

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      this.native = native
      const gradient = (this.gradient ??= this.createGradient())
      // Leave Core's mask at the root so it can keep updating its path on resize.
      let owner = native.layer
      while (owner.mask && owner.mask !== gradient) owner = owner.mask
      if (this.owner && this.owner !== owner && this.owner.mask === gradient)
        this.owner.mask = null
      this.owner = owner
      owner.mask = gradient
      // Don't let a later background redraw resurrect our mask after cleanup.
      if (native.originalMask === gradient) native.originalMask = null

      // Core's CAShapeLayer masks draw a path with zero bounds. In that case the
      // path uses the view's coordinates; other masks have their own bounds.
      const area =
        owner.bounds.size.width > 0 && owner.bounds.size.height > 0
          ? owner.bounds
          : bounds
      gradient.frame = CGRectMake(
        area.origin.x - area.size.width,
        area.origin.y,
        area.size.width * 3,
        area.size.height,
      )
    } finally {
      CATransaction.commit()
    }
  }

  private createGradient(): CAGradientLayer {
    const gradient = CAGradientLayer.new()
    const dim = UIColor.colorWithWhiteAlpha(1, 0.35).CGColor
    gradient.colors = NSArray.arrayWithArray([dim, UIColor.whiteColor.CGColor, dim])
    gradient.startPoint = CGPointMake(0, 0.5)
    gradient.endPoint = CGPointMake(1, 0.5)

    // A three-width mask lets the band enter and leave while every stop stays
    // within the documented 0...1 range for CAGradientLayer.locations.
    const from = NSArray.arrayWithArray([0, 0.125, 0.25])
    const to = NSArray.arrayWithArray([0.75, 0.875, 1])
    gradient.locations = from
    const animation = CABasicAnimation.animationWithKeyPath('locations')
    animation.fromValue = from
    animation.toValue = to
    animation.duration = this.duration / 1000
    animation.repeatCount = Infinity
    animation.removedOnCompletion = false
    animation.timingFunction = CAMediaTimingFunction.functionWithName(
      kCAMediaTimingFunctionLinear,
    )
    gradient.addAnimationForKey(animation, key)
    return gradient
  }

  private remove() {
    const { gradient, owner, native } = this
    if (!gradient) return
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      gradient.removeAnimationForKey(key)
      if (owner?.mask === gradient) owner.mask = null
      if (native?.originalMask === gradient) native.originalMask = null
    } finally {
      CATransaction.commit()
    }
    this.owner = undefined
    this.gradient = undefined
    this.native = undefined
  }
}
