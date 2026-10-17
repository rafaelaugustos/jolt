import { Application, Utils, View, isAndroid, isIOS } from '@nativescript/core'
import {
  animate,
  animateText,
  type Animation,
  type AnimateOptions,
  type Keyframes,
  type Target,
  type TextOptions,
} from '@rafaelaugusto/jolt'

export type Element<T extends View = View> = { nativeView: T }
/** For content decisions only; Jolt already reduces the animations themselves. */
export function reducedMotion() {
  if (isIOS) return UIAccessibilityIsReduceMotionEnabled()
  if (isAndroid)
    return (
      android.os.Build.VERSION.SDK_INT >= 26 &&
      !android.animation.ValueAnimator.areAnimatorsEnabled()
    )
  return false
}
export function viewOf<T extends View = View>(element: Element<T> | T | undefined) {
  return element instanceof View ? element : element?.nativeView
}
export function dismissKeyboard(view: View | undefined) {
  const native = view?.nativeViewProtected
  if (!native) return
  if (isIOS) (native as UIView).endEditing(true)
  else if (isAndroid) Utils.dismissSoftInput(native as android.view.View)
}

/** Own the finite animations, native loops and waits of one mounted screen. */
export class Motion {
  private animations = new Set<Animation>()
  private waits = new Set<() => void>()
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
    return this.track(animate(target, values, options))
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
  }
}
