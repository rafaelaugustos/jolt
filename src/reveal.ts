import { Application, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import { resolveEasing } from './easing.js'
import type { Animation } from './engine.js'
import type { Target } from './types.js'

export interface RevealOptions {
  /** Circle origin in DIPs from the target's top-left corner. Defaults to its center. */
  from?: { x: number; y: number }
  /** Milliseconds. Defaults to 400; zero changes visibility immediately. */
  duration?: number
}

export interface ConcealOptions {
  /** Circle destination in DIPs from the target's top-left corner. Defaults to its center. */
  to?: { x: number; y: number }
  /** Milliseconds. Defaults to 400; zero changes visibility immediately. */
  duration?: number
}

type Circle = { x: number; y: number; radius: number }
type MaskedView = UIView & { originalMask?: CALayer | null; maskType?: unknown }
type Snapshot = { circle: Circle; native: UIView; bounds: CGRect }
const running = new WeakMap<View, CircularAnimation>()
const callbacks = new WeakMap<NSObject, (finished: boolean) => void>()
const ease = resolveEasing('easeInOut')
const key = 'jolt:reveal'
let Delegate: typeof NSObject | undefined

/** Reveals an iOS view through an expanding circle, then removes the temporary mask. */
export function reveal(target: Target, options: RevealOptions = {}): Animation {
  return start(target, true, options.from, options.duration ?? 400)
}

/** Contracts an iOS view to a point, then sets visibility to 'hidden' without collapsing layout. */
export function conceal(target: Target, options: ConcealOptions = {}): Animation {
  return start(target, false, options.to, options.duration ?? 400)
}

function start(
  target: Target,
  opening: boolean,
  point: { x: number; y: number } | undefined,
  duration: number,
): Animation {
  if (!Number.isFinite(duration) || duration < 0)
    throw new RangeError('Reveal duration must be a nonnegative finite number.')
  if (
    point !== undefined &&
    (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
  )
    throw new TypeError('Reveal origin must have finite x and y coordinates.')
  const view = toView(target)
  const previous = running.get(view)
  const snapshot = previous?.snapshot()
  const original = previous?.originalVisibility ?? view.visibility
  previous?.stop()
  return new CircularAnimation(
    view,
    opening,
    point && { ...point },
    duration,
    original,
    snapshot,
  )
}

function sameBounds(a: CGRect, b: CGRect) {
  return (
    a.origin.x === b.origin.x &&
    a.origin.y === b.origin.y &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height
  )
}

function path(circle: Circle): CAShapeLayer['path'] {
  // Keep the same oval topology even at the closed endpoint.
  const radius = Math.max(0.01, circle.radius)
  return UIBezierPath.bezierPathWithOvalInRect(
    CGRectMake(circle.x - radius, circle.y - radius, radius * 2, radius * 2),
  ).CGPath
}

function completion(
  callback: (finished: boolean) => void,
): NSObject & CAAnimationDelegate {
  if (!Delegate) {
    // Use the runtime subclass API so published JS needs no NativeClass transform.
    const base = NSObject as typeof NSObject & {
      extend(
        methods: object,
        options: { protocols: unknown[]; name: string },
      ): typeof NSObject
    }
    Delegate = base.extend(
      {
        animationDidStopFinished(
          this: NSObject,
          _animation: CAAnimation,
          finished: boolean,
        ) {
          callbacks.get(this)?.(finished)
        },
      },
      { protocols: [CAAnimationDelegate], name: 'JoltCircularRevealDelegate' },
    )
  }
  const delegate = Delegate.new()
  callbacks.set(delegate, callback)
  return delegate
}

class CircularAnimation implements Animation {
  readonly finished: Promise<boolean>
  private resolve!: (finished: boolean) => void
  private settled = false
  private queued = false
  private changingVisibility = false
  private waitingForLoad: boolean
  private native: MaskedView | undefined
  private bounds: CGRect | undefined
  private wrapper: CALayer | undefined
  private shape: CAShapeLayer | undefined
  private originalMask: CALayer | null = null
  private savedMask: CALayer | null = null
  private delegate: NSObject | undefined
  private observer: ReturnType<typeof Application.ios.addNotificationObserver> | undefined
  private from: Circle | undefined
  private to: Circle | undefined
  private startedAt = 0

  constructor(
    private readonly view: View,
    private readonly opening: boolean,
    private readonly point: { x: number; y: number } | undefined,
    private readonly duration: number,
    readonly originalVisibility: View['visibility'],
    private readonly inherited?: Snapshot,
  ) {
    this.finished = new Promise((resolve) => {
      this.resolve = resolve
    })
    this.waitingForLoad = !view.isLoaded
    running.set(view, this)
    if (!isIOS) {
      this.end(false)
      return
    }
    view.on('loaded', this.loaded)
    view.on('layoutChanged', this.layoutChanged)
    view.on('unloaded', this.stop)
    view.style.on('backgroundInternalChange', this.stop)
    view.style.on('visibilityChange', this.visibilityChanged)
    if (opening && view.visibility === 'collapse') this.visibility('hidden')
    this.schedule()
  }

  then<A = boolean, B = never>(
    onfulfilled?: ((finished: boolean) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(onfulfilled, onrejected)
  }

  /** Cancels and restores visibility from before the interrupted reveal/conceal chain. */
  stop = () => this.end(false)

  snapshot(): Snapshot | undefined {
    if (!this.shape || !this.native || !this.bounds || !this.from || !this.to) return
    const presented = this.shape.presentationLayer() as CAShapeLayer | null
    let circle: Circle
    if (presented?.path) {
      const box = CGPathGetBoundingBox(presented.path)
      circle = {
        x: box.origin.x + box.size.width / 2,
        y: box.origin.y + box.size.height / 2,
        radius: box.size.width / 2,
      }
    } else {
      const progress = ease(
        Math.max(
          0,
          Math.min(1, ((CACurrentMediaTime() - this.startedAt) * 1000) / this.duration),
        ),
      )
      const lerp = (a: number, b: number) => a + (b - a) * progress
      circle = {
        x: lerp(this.from.x, this.to.x),
        y: lerp(this.from.y, this.to.y),
        radius: lerp(this.from.radius, this.to.radius),
      }
    }
    return { circle, native: this.native, bounds: this.bounds }
  }

  private visibility(value: View['visibility']) {
    this.changingVisibility = true
    try {
      this.view.visibility = value
    } finally {
      this.changingVisibility = false
    }
  }

  private visibilityChanged = () => {
    if (!this.changingVisibility) this.end(false, true)
  }

  private loaded = () => {
    this.waitingForLoad = false
    this.schedule()
  }

  private layoutChanged = () => {
    if (this.shape) {
      const native = this.view.nativeViewProtected as UIView | undefined
      if (
        native !== this.native ||
        !native?.window ||
        !sameBounds(native.layer.bounds, this.bounds!)
      ) {
        this.stop()
        return
      }
    }
    this.schedule()
  }

  private schedule = () => {
    if (this.settled || this.queued) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.settled) return
      try {
        this.update()
      } catch (error) {
        this.stop()
        throw error
      }
    })
  }

  private motionChanged = () => {
    if (UIAccessibilityIsReduceMotionEnabled()) this.end(true)
  }

  private update() {
    if (!this.opening && !this.inherited && this.view.visibility !== 'visible')
      return this.end(true, true)
    if (this.duration === 0 || UIAccessibilityIsReduceMotionEnabled())
      return this.end(true)
    if (this.waitingForLoad || !this.view.isLoaded) return
    const native = this.view.nativeViewProtected as MaskedView | undefined
    if (this.shape) {
      if (native !== this.native || native?.layer.mask !== this.wrapper) this.stop()
      return
    }
    if (!native?.window) return
    const bounds = native.layer.bounds
    if (bounds.size.width <= 0 || bounds.size.height <= 0) return
    const inherited =
      this.inherited?.native === native && sameBounds(this.inherited.bounds, bounds)
        ? this.inherited.circle
        : undefined
    const x = this.point
      ? bounds.origin.x + this.point.x
      : (inherited?.x ?? bounds.origin.x + bounds.size.width / 2)
    const y = this.point
      ? bounds.origin.y + this.point.y
      : (inherited?.y ?? bounds.origin.y + bounds.size.height / 2)
    const radius =
      Math.hypot(
        Math.max(
          Math.abs(x - bounds.origin.x),
          Math.abs(x - bounds.origin.x - bounds.size.width),
        ),
        Math.max(
          Math.abs(y - bounds.origin.y),
          Math.abs(y - bounds.origin.y - bounds.size.height),
        ),
      ) + 1
    this.from = inherited ?? { x, y, radius: this.opening ? 0 : radius }
    this.to = { x, y, radius: this.opening ? radius : 0 }
    this.native = native
    this.bounds = bounds
    this.originalMask = native.layer.mask
    this.savedMask =
      native.maskType != null ? (native.originalMask ?? null) : this.originalMask

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      // A plain container prevents Core from mistaking our circle for its own clip path.
      const wrapper = (this.wrapper = CALayer.new())
      const shape = (this.shape = CAShapeLayer.new())
      wrapper.name = key
      for (const layer of [wrapper, shape]) {
        layer.bounds = bounds
        layer.position = CGPointMake(
          bounds.origin.x + bounds.size.width / 2,
          bounds.origin.y + bounds.size.height / 2,
        )
      }
      shape.fillColor = UIColor.blackColor.CGColor
      shape.path = path(this.to)
      wrapper.addSublayer(shape)
      // Same coordinate space as the original host, including bounds origins.
      native.layer.mask = null
      wrapper.mask = this.originalMask
      native.layer.mask = wrapper
      const animation = CABasicAnimation.animationWithKeyPath('path')
      animation.fromValue = path(this.from)
      animation.toValue = shape.path
      animation.duration = this.duration / 1000
      animation.timingFunction = CAMediaTimingFunction.functionWithName(
        kCAMediaTimingFunctionEaseInEaseOut,
      )
      this.delegate = animation.delegate = completion((finished) => this.end(finished))
      this.startedAt = CACurrentMediaTime()
      shape.addAnimationForKey(animation, key)
      this.observer = Application.ios.addNotificationObserver(
        UIAccessibilityReduceMotionStatusDidChangeNotification,
        this.motionChanged,
      )
      this.visibility('visible')
    } finally {
      CATransaction.commit()
    }
  }

  private end(finished: boolean, keepVisibility = false) {
    if (this.settled) return
    this.settled = true
    const { view, native, wrapper, shape } = this
    view.off('loaded', this.loaded)
    view.off('layoutChanged', this.layoutChanged)
    view.off('unloaded', this.stop)
    view.style.off('backgroundInternalChange', this.stop)
    view.style.off('visibilityChange', this.visibilityChanged)
    if (running.get(view) === this) running.delete(view)
    if (this.observer)
      Application.ios.removeNotificationObserver(
        this.observer,
        UIAccessibilityReduceMotionStatusDidChangeNotification,
      )
    if (this.delegate) callbacks.delete(this.delegate)
    if (native && wrapper) {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      try {
        // Hide before removing a closed mask so conceal never flashes its content.
        if (!keepVisibility)
          this.visibility(
            finished ? (this.opening ? 'visible' : 'hidden') : this.originalVisibility,
          )
        shape?.removeAnimationForKey(key)
        wrapper.mask = null
        if (native.layer.mask === wrapper) native.layer.mask = this.originalMask
        // Core can save the temporary mask while installing a new clip/border mask.
        if (native.originalMask === wrapper) native.originalMask = this.savedMask
      } finally {
        CATransaction.commit()
      }
    } else if (isIOS && !keepVisibility) {
      this.visibility(
        finished ? (this.opening ? 'visible' : 'hidden') : this.originalVisibility,
      )
    }
    this.native = this.wrapper = this.shape = this.delegate = this.observer = undefined
    this.resolve(finished)
  }
}
