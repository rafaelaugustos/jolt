import { Application, View, isIOS, type EventData } from '@nativescript/core'
import {
  animate,
  animateText,
  press,
  stop,
  type Animation,
  type AnimateOptions,
  type Keyframes,
  type Target,
  type TextOptions,
} from '@rafaelaugusto/jolt'

export type Element<T extends View = View> = { nativeView: T }
export const reducedMotion = () => isIOS && UIAccessibilityIsReduceMotionEnabled()
export function viewOf<T extends View = View>(element: Element<T> | T | undefined) {
  return element instanceof View ? element : element?.nativeView
}

/** Own the finite animations, native loops, waits and touch bindings of one mounted screen. */
export class Motion {
  private animations = new Set<Animation>()
  private waits = new Set<() => void>()
  private touches = new Map<View, () => void>()
  private disposed = false
  private generation = 0
  constructor() {
    Application.on(Application.suspendEvent, this.cancel)
  }
  get token() {
    return this.generation
  }
  current(token: number) {
    return !this.disposed && token === this.generation
  }

  track(animation: Animation) {
    if (this.disposed) animation.stop()
    else {
      this.animations.add(animation)
      void animation.finished.then(() => this.animations.delete(animation))
    }
    return animation
  }
  play(
    target: Target | readonly Target[],
    values: Keyframes,
    options: AnimateOptions = {},
  ) {
    return this.track(
      animate(
        target,
        values,
        reducedMotion()
          ? { type: 'tween', duration: 0, relative: options.relative }
          : options,
      ),
    )
  }
  text(target: Target, options: TextOptions = {}) {
    return this.track(animateText(target, options))
  }
  wait(ms: number): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false)
    return new Promise((resolve) => {
      const cancel = () => {
        clearTimeout(timer)
        this.waits.delete(cancel)
        resolve(false)
      }
      const timer = setTimeout(() => {
        this.waits.delete(cancel)
        resolve(true)
      }, ms)
      this.waits.add(cancel)
    })
  }
  press = (event: EventData) => {
    const view = event.object as View
    if (this.disposed || this.touches.has(view)) return
    this.touches.set(view, reducedMotion() ? () => {} : press(view, { scale: 0.94 }))
  }
  refreshPress() {
    for (const [view, cleanup] of this.touches) {
      cleanup()
      stop(view, ['scale'])
      view.scaleX = view.scaleY = 1
      this.touches.set(view, reducedMotion() ? () => {} : press(view, { scale: 0.94 }))
    }
  }
  cancel = () => {
    this.generation++
    for (const cancel of [...this.waits]) cancel()
    for (const animation of [...this.animations]) animation.stop()
    this.animations.clear()
  }
  dispose = () => {
    Application.off(Application.suspendEvent, this.cancel)
    this.disposed = true
    this.cancel()
    for (const [view, cleanup] of this.touches) {
      cleanup()
      stop(view, ['scale'])
    }
    this.touches.clear()
  }
}
