import { Application, Color, isAndroid, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import type { Target } from './types.js'
import { onReducedMotion, reducedMotion } from './config.js'
import { androidParticles } from './driver/android-particles.js'

export interface ConfettiOptions {
  /** Approximate number of particles in the burst. Defaults to 80. */
  count?: number
  colors?: readonly string[]
}

export interface ParticleOptions {
  colors?: readonly string[]
  shape?: 'circle' | 'rectangle' | 'ring'
  /** Center point, or a line across the top/bottom of the target. */
  source?: 'center' | 'top' | 'bottom'
  /** Total particles per second, shared across all colors. Defaults to 20. */
  rate?: number
  /** Particle lifetime in milliseconds. Defaults to 3000. */
  lifetime?: number
  /** Longest side in DIPs. Defaults to 6. */
  size?: number
  /** DIPs per second. Defaults to 60. */
  velocity?: number
  velocityRange?: number
  /** Degrees clockwise from right: -90 is up, 90 is down. Defaults to -90. */
  angle?: number
  /** Emission cone in degrees, from 0 to 360. Defaults to 30. */
  spread?: number
  /** Downward acceleration in DIPs per second squared. Defaults to 0. */
  gravity?: number
  /** Degrees per second. Defaults to 0. */
  spin?: number
  spinRange?: number
  /** Fade each particle over its lifetime. Defaults to true. */
  fadeOut?: boolean
  /** Emit for this many milliseconds, then let particles expire. Omit to keep emitting. */
  duration?: number
}

export type ParticleSettings = Required<Omit<ParticleOptions, 'duration'>> & {
  duration?: number
}
type Settings = ParticleSettings
const bursts = new WeakMap<View, () => void>()
const emitters = new WeakMap<View, () => void>()
const palette = ['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#a855f7']
const textures = new Map<Settings['shape'], UIImage>()
const radians = (degrees: number) => (degrees * Math.PI) / 180
const BURST_DURATION = 200

/** Bursts from the target's center into its window. Returns immediate cleanup. */
export function confetti(target: Target, options: ConfettiOptions = {}): () => void {
  const count = number('count', options.count ?? 80, 0, 10000)
  if (!Number.isInteger(count)) throw new RangeError('Particle count must be an integer.')
  const settings = resolve(
    {
      colors: options.colors ?? palette,
      shape: 'rectangle',
      rate: count / (BURST_DURATION / 1000),
      duration: BURST_DURATION,
      lifetime: 2200,
      size: 8,
      velocity: 260,
      velocityRange: 100,
      angle: -90,
      spread: 100,
      gravity: 420,
      spinRange: 360,
    },
    true,
  )
  return start(target, settings, true)
}

/** Adds a native particle emitter to the target. Returns immediate cleanup. */
export function particles(target: Target, options: ParticleOptions = {}): () => void {
  return start(target, resolve(options), false)
}

function start(target: Target, settings: Settings, overlay: boolean): () => void {
  const view = toView(target)
  const running = overlay ? bursts : emitters
  running.get(view)?.()
  if (settings.rate === 0 || reducedMotion()) return () => {}
  if (isAndroid) return androidParticles(view, settings, overlay, running)
  if (!isIOS) return () => {}
  return new Emitter(view, settings, overlay, running).stop
}

function resolve(options: ParticleOptions, burst = false): Settings {
  const colors = options.colors ?? ['#ffffff']
  if (
    !Array.isArray(colors) ||
    colors.length === 0 ||
    colors.length > 32 ||
    Array.from(colors).some((color) => typeof color !== 'string' || !Color.isValid(color))
  )
    throw new TypeError('Particles need 1 to 32 valid color strings.')
  const shape = options.shape ?? 'circle'
  const source = options.source ?? 'center'
  if (!['circle', 'rectangle', 'ring'].includes(shape))
    throw new TypeError('Unknown particle shape.')
  if (!['center', 'top', 'bottom'].includes(source))
    throw new TypeError('Unknown particle source.')
  const lifetime = number('lifetime', options.lifetime ?? 3000, 1, 60000)
  const rate = number('rate', options.rate ?? 20, 0, burst ? 50000 : 10000)
  if (!burst && (rate * lifetime) / 1000 > 10000)
    throw new RangeError('Particle rate × lifetime must not exceed 10000 live particles.')
  const duration =
    options.duration === undefined
      ? undefined
      : number('duration', options.duration, 1, 2147483647 - lifetime - 50)
  const fadeOut = options.fadeOut ?? true
  if (typeof fadeOut !== 'boolean')
    throw new TypeError('Particle fadeOut must be a boolean.')
  return {
    colors: [...colors],
    shape,
    source,
    lifetime,
    rate,
    duration,
    fadeOut,
    size: number('size', options.size ?? 6, 1, 128),
    velocity: number('velocity', options.velocity ?? 60, 0, 10000),
    velocityRange: number('velocityRange', options.velocityRange ?? 0, 0, 10000),
    angle: number('angle', options.angle ?? -90, -360, 360),
    spread: number('spread', options.spread ?? 30, 0, 360),
    gravity: number('gravity', options.gravity ?? 0, -10000, 10000),
    spin: number('spin', options.spin ?? 0, -3600, 3600),
    spinRange: number('spinRange', options.spinRange ?? 0, 0, 3600),
  }
}

function number(name: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`Particle ${name} must be between ${min} and ${max}.`)
  return value
}

class Emitter {
  private stopped = false
  private queued = false
  private layer: CAEmitterLayer | undefined
  private native: UIView | undefined
  private window: UIWindow | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private unwatch: (() => void) | undefined

  constructor(
    private readonly view: View,
    private readonly settings: Settings,
    private readonly overlay: boolean,
    private readonly running: WeakMap<View, () => void>,
  ) {
    running.set(view, this.stop)
    view.on('loaded', this.schedule)
    view.on('layoutChanged', this.schedule)
    view.on('unloaded', this.stop)
    Application.on(Application.suspendEvent, this.stop)
    this.unwatch = onReducedMotion(this.motionChanged)
    this.schedule()
  }

  stop = () => {
    if (this.stopped) return
    this.stopped = true
    this.view.off('loaded', this.schedule)
    this.view.off('layoutChanged', this.schedule)
    this.view.off('unloaded', this.stop)
    Application.off(Application.suspendEvent, this.stop)
    if (this.running.get(this.view) === this.stop) this.running.delete(this.view)
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.unwatch?.()
    this.layer?.removeAllAnimations()
    this.layer?.removeFromSuperlayer()
    this.layer = this.native = this.window = undefined
    this.timer = this.unwatch = undefined
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

  private motionChanged = () => {
    if (reducedMotion()) this.stop()
  }

  private update() {
    if (!this.view.isLoaded) return
    if (reducedMotion()) return this.stop()
    const native = this.view.nativeViewProtected as UIView | undefined
    const window = native?.window
    if (this.layer && (!native || !window)) return this.stop()
    if (!native || !window) return
    if (this.native && (this.native !== native || this.window !== window))
      return this.stop()
    const bounds = native.layer.bounds
    if (bounds.size.width <= 0 || bounds.size.height <= 0) {
      if (this.layer) this.stop()
      return
    }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      if (!this.layer) {
        this.native = native
        this.window = window
        const host = this.overlay ? window.layer : native.layer
        const layer = (this.layer = CAEmitterLayer.new())
        layer.name = this.overlay ? 'jolt:confetti' : 'jolt:particles'
        layer.frame = host.bounds
        layer.emitterShape =
          this.settings.source === 'center' ? kCAEmitterLayerPoint : kCAEmitterLayerLine
        layer.emitterCells = NSArray.arrayWithArray(this.cells())
        host.addSublayer(layer)
        // Start from an empty emitter, even if its parent has been alive for hours.
        layer.beginTime = host.convertTimeFromLayer(CACurrentMediaTime(), null)
        if (this.overlay)
          layer.emitterPosition = native.convertPointToView(
            CGPointMake(
              bounds.origin.x + bounds.size.width / 2,
              bounds.origin.y + bounds.size.height / 2,
            ),
            window,
          )
        if (this.settings.duration !== undefined) {
          // The render server stops emission even if JS is blocked. The timer
          // only removes the empty layer after the last particles have expired.
          layer.birthRate = 0
          const emission = CABasicAnimation.animationWithKeyPath('birthRate')
          emission.fromValue = 1
          emission.toValue = 1
          emission.duration = this.settings.duration / 1000
          layer.addAnimationForKey(emission, 'jolt:emission')
          this.timer = setTimeout(
            this.stop,
            this.settings.duration + this.settings.lifetime + 50,
          )
        }
      }
      if (!this.overlay) {
        const layer = this.layer
        layer.frame = bounds
        layer.emitterSize = CGSizeMake(bounds.size.width, 0)
        layer.emitterPosition = CGPointMake(
          bounds.size.width / 2,
          this.settings.source === 'top'
            ? 0
            : this.settings.source === 'bottom'
              ? bounds.size.height
              : bounds.size.height / 2,
        )
      }
    } finally {
      CATransaction.commit()
    }
  }

  private cells(): CAEmitterCell[] {
    const options = this.settings
    const image = texture(options.shape)
    return options.colors.map((color) => {
      const cell = CAEmitterCell.emitterCell()
      cell.contents = image.CGImage
      cell.color = new Color(color).ios.CGColor
      cell.birthRate = options.rate / options.colors.length
      cell.lifetime = options.lifetime / 1000
      cell.scale = options.size / 32
      cell.velocity = options.velocity
      cell.velocityRange = options.velocityRange
      // Horizontal line emitters point upward at longitude zero; point
      // emitters point right. Keep the public angle in view coordinates.
      cell.emissionLongitude = radians(
        options.angle + (options.source === 'center' ? 0 : 90),
      )
      cell.emissionRange = radians(options.spread)
      cell.yAcceleration = options.gravity
      cell.spin = radians(options.spin)
      cell.spinRange = radians(options.spinRange)
      cell.alphaSpeed = options.fadeOut ? -1 / cell.lifetime : 0
      return cell
    })
  }
}

function texture(shape: Settings['shape']): UIImage {
  const cached = textures.get(shape)
  if (cached) return cached
  const format = UIGraphicsImageRendererFormat.defaultFormat()
  format.scale = 1
  format.opaque = false
  const height = shape === 'rectangle' ? 18 : 32
  const renderer = UIGraphicsImageRenderer.alloc().initWithSizeFormat(
    CGSizeMake(32, height),
    format,
  )
  const image = renderer.imageWithActions((context) => {
    const cg = context.CGContext
    CGContextSetFillColorWithColor(cg, UIColor.whiteColor.CGColor)
    if (shape === 'rectangle') CGContextFillRect(cg, CGRectMake(0, 0, 32, height))
    else if (shape === 'circle') CGContextFillEllipseInRect(cg, CGRectMake(0, 0, 32, 32))
    else {
      CGContextSetStrokeColorWithColor(cg, UIColor.whiteColor.CGColor)
      CGContextSetLineWidth(cg, 3)
      CGContextStrokeEllipseInRect(cg, CGRectMake(2, 2, 28, 28))
    }
  })
  textures.set(shape, image)
  return image
}
