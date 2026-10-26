import { Application, type View } from '@nativescript/core'
import { toView } from '../animate.js'
import { onReducedMotion, reducedMotion } from '../config.js'
import { TimedAnimation } from '../timed-animation.js'
import { createTrack, instantTrack, type Track } from '../track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from '../transition.js'
import type { Target } from '../types.js'
import { createBlur, type BlurPainter } from './native.js'
import type { Blur, BlurOptions, BlurSnapshot } from './types.js'
export type { Blur, BlurOptions, BlurSnapshot } from './types.js'

const owners = new WeakMap<View, BlurOwner>()
function amount(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError('Blur amount must be within 0..1.')
  return value
}
/** Blur a dedicated content view after native layout. Keep sharp controls in a sibling. */
export function blur(target: Target, options: BlurOptions = {}): Blur {
  if (!options || typeof options !== 'object')
    throw new TypeError('Invalid blur options.')
  const settings: Required<BlurOptions> = {
    amount: amount(options.amount ?? 0),
    radius: options.radius ?? 24,
    style: options.style ?? 'system',
  }
  if (!Number.isFinite(settings.radius) || settings.radius < 1 || settings.radius > 64)
    throw new RangeError('Blur radius must be within 1..64 DIPs.')
  if (!['system', 'light', 'dark'].includes(settings.style))
    throw new TypeError('Invalid blur style.')
  const view = toView(target)
  if (!view.isLoaded || !view.nativeViewProtected)
    throw new Error('Create blur after native layout.')
  if (owners.has(view)) throw new Error('This view already owns blur. Dispose it first.')
  return new BlurOwner(view, settings)
}
class BlurOwner implements Blur {
  disposed = false
  private painter?: BlurPainter
  private native?: object
  private state: BlurSnapshot
  private active?: { animation: TimedAnimation; track: Track; destination: number }
  private suspended = false
  private backgrounded = false
  private offReduced: () => void
  constructor(
    private readonly view: View,
    private readonly options: Required<BlurOptions>,
  ) {
    this.attach(options.amount)
    this.state = this.painter!.snapshot()
    owners.set(view, this)
    view.on('loaded', this.layout)
    view.on('layoutChanged', this.layout)
    view.on('unloaded', this.unload)
    Application.on(Application.suspendEvent, this.background)
    Application.on(Application.resumeEvent, this.foreground)
    this.offReduced = onReducedMotion((value) => {
      if (!value || !this.active) return
      const destination = this.active.destination
      this.set(destination)
    })
  }
  private alive() {
    if (this.disposed) throw new Error('Blur has been disposed.')
  }
  private attach(value: number) {
    this.painter = createBlur(this.view, { ...this.options, amount: value })
    this.native = this.view.nativeViewProtected
  }
  private layout = () => {
    if (this.disposed || !this.view.isLoaded || !this.view.nativeViewProtected) return
    if (this.native && this.native !== this.view.nativeViewProtected) this.unload()
    if (!this.painter) {
      this.attach(this.state.amount)
      if (this.active) {
        this.painter!.play(this.active.track)
        this.painter!.control(this.active.animation.time, true)
      }
    }
    this.painter!.resize()
    if (!this.backgrounded && this.suspended) {
      this.active?.animation.play()
      this.suspended = false
    }
  }
  private unload = () => {
    if (!this.backgrounded || !this.active) this.stop()
    this.state = this.snapshot()
    this.painter?.dispose()
    this.painter = undefined
    this.native = undefined
  }
  private background = () => {
    if (this.backgrounded) return
    this.backgrounded = true
    this.suspended = !!this.active && !this.active.animation.paused
    if (this.suspended) this.active!.animation.pause()
  }
  private foreground = () => {
    this.backgrounded = false
    if (this.painter) {
      if (this.suspended) this.active?.animation.play()
      this.suspended = false
    }
  }
  snapshot(): BlurSnapshot {
    if (this.painter) this.state = this.painter.snapshot()
    return {
      ...this.state,
      attached: !!this.painter,
      appliedAmount: this.painter ? this.state.appliedAmount : 0,
      nativeAnimations: this.painter ? this.state.nativeAnimations : 0,
    }
  }
  set(value: number) {
    this.alive()
    amount(value)
    this.stop()
    this.state.amount = value
    this.painter?.paint(value)
  }
  animate(value: number, options: Transition | SpringName = {}) {
    this.alive()
    amount(value)
    if (!this.painter || !this.view.isLoaded)
      throw new Error('Load blur before animating.')
    if (typeof options === 'string' && !Object.hasOwn(springs, options))
      throw new TypeError('Unknown blur spring.')
    const settings = typeof options === 'string' ? springs[options] : options
    if ('layer' in settings)
      throw new TypeError('Blur owns one animation; named layers are not supported.')
    const transition = resolveTransition(settings, 'opacity', 2)
    const from = this.snapshot().amount
    const velocity =
      this.active && !this.active.animation.paused
        ? this.active.track.velocityAt(this.active.animation.time)
        : 0
    const track =
      reducedMotion() || this.state.backend === 'none'
        ? instantTrack('opacity', value)
        : createTrack('opacity', [from, value], transition, velocity)
    this.stop()
    let animation: TimedAnimation
    animation = new TimedAnimation(
      track.end,
      track.arrival,
      (time, paused) => this.painter?.control(time, paused),
      (completed) => {
        const current = completed
          ? Math.max(0, Math.min(1, track.to))
          : this.snapshot().amount
        this.state.amount = current
        this.painter?.paint(current)
        if (this.active?.animation === animation) this.active = undefined
      },
    )
    this.active = { animation, track, destination: value }
    try {
      if (track.end > 0) this.painter.play(track)
      else this.painter.paint(value)
      animation.start()
      if (this.backgrounded && this.active) {
        this.suspended = true
        animation.pause()
      }
    } catch (e) {
      animation.stop()
      throw e
    }
    return animation
  }
  stop() {
    this.active?.animation.stop()
    this.suspended = false
  }
  dispose() {
    if (this.disposed) return
    this.stop()
    this.unload()
    this.disposed = true
    this.offReduced()
    this.view.off('loaded', this.layout)
    this.view.off('layoutChanged', this.layout)
    this.view.off('unloaded', this.unload)
    Application.off(Application.suspendEvent, this.background)
    Application.off(Application.resumeEvent, this.foreground)
    owners.delete(this.view)
  }
}
