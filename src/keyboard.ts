import { Application, Utils, isAndroid, isIOS, type View } from '@nativescript/core'
import { animate, stop, toView } from './animate.js'
import type { EasingFunction, EasingName } from './easing.js'
import type { Spring, Transition, Tween } from './transition.js'
import type { Target } from './types.js'

export interface KeyboardOptions {
  /** DIPs kept between the view's bottom edge and the keyboard. Defaults to zero. */
  offset?: number
}

export interface KeyboardState {
  /** Whether a docked software keyboard covers part of the window. */
  readonly visible: boolean
  /** DIPs of the window the keyboard covers, from its bottom edge. Zero when hidden or floating. */
  readonly height: number
  /** Milliseconds the keyboard takes to get there. Zero when it changes at once. */
  readonly duration: number
  /** The keyboard's own timing, to pass to `animate()` and move in step with it. */
  readonly transition: Transition
}

const BEGIN_FROM_CURRENT_STATE = 4
const IOS_KEYBOARD_CURVE = 7
// Measured: Core Animation plays the keyboard's spring (stiffness 1000, mass 3) critically damped in 500 ms.
const iosKeyboard: Spring = {
  type: 'spring',
  stiffness: 1000,
  mass: 3,
  damping: 2 * Math.sqrt(3000),
}
const iosCurves: readonly EasingName[] = ['easeInOut', 'easeIn', 'easeOut', 'linear']
// Before Android 11 nothing reports the keyboard's timing. Measured on an Android 9 emulator,
// its window fades and slides into place in about 150 ms, decelerating, and leaves as quickly.
const LEGACY_DURATION = 150
const legacyShow: Tween = { duration: LEGACY_DURATION, ease: 'quadOut' }
const legacyHide: Tween = { duration: LEGACY_DURATION, ease: 'quadIn' }
const legacy = () => isAndroid && android.os.Build.VERSION.SDK_INT < 30
const hidden: KeyboardState = Object.freeze({
  visible: false,
  height: 0,
  duration: 0,
  transition: { duration: 0 },
})

const listeners = new Set<(keyboard: KeyboardState) => void>()
let state = hidden
let unwatch: (() => void) | undefined

/**
 * Calls back whenever the keyboard shows, hides or changes height, with how much
 * of the window it covers and its timing. Returns a cleanup function.
 *
 * ```ts
 * const off = onKeyboard(({ visible, transition }) => {
 *   animate(header, { scale: visible ? 0.8 : 1 }, transition)
 * })
 * ```
 */
export function onKeyboard(callback: (keyboard: KeyboardState) => void): () => void {
  if (typeof callback !== 'function')
    throw new TypeError('onKeyboard() takes a callback.')
  const listener = (keyboard: KeyboardState) => callback(keyboard)
  if (listeners.size === 0) {
    state = hidden
    unwatch = isIOS ? watchIOS() : isAndroid ? watchAndroid() : undefined
  }
  listeners.add(listener)
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return
    unwatch?.()
    unwatch = undefined
  }
}

/** The last state reported while someone listens. */
export function currentKeyboard(): KeyboardState {
  return state
}

function update(height: number, duration: number, transition: Transition) {
  if (height === state.height) return
  state = Object.freeze({ visible: height > 0, height, duration, transition })
  for (const listener of [...listeners]) listener(state)
}

function watchIOS() {
  const name = UIKeyboardWillChangeFrameNotification
  const observer = Application.ios.addNotificationObserver(
    name,
    (notification: NSNotification) => {
      const info = notification.userInfo
      const window = Application.ios.window
      const end = info?.objectForKey(UIKeyboardFrameEndUserInfoKey)?.CGRectValue as
        CGRect | undefined
      if (!info || !window || !end) return
      const frame = window.convertRectFromWindow(end, null)
      const bottom = window.bounds.size.height
      const docked =
        frame.size.height > 0 &&
        frame.origin.y < bottom &&
        frame.origin.y + frame.size.height >= bottom - 0.5
      const reported = numberIn(info, UIKeyboardAnimationDurationUserInfoKey) * 1000
      const curve = numberIn(info, UIKeyboardAnimationCurveUserInfoKey)
      const height = docked ? bottom - frame.origin.y : 0
      if (!reported) return update(height, 0, { duration: 0 })
      if (curve === IOS_KEYBOARD_CURVE) return update(height, 500, iosKeyboard)
      update(height, reported, {
        duration: reported,
        ease: iosCurves[curve] ?? 'easeInOut',
      })
    },
  )
  return () => Application.ios.removeNotificationObserver(observer, name)
}

function watchAndroid() {
  const density = Utils.layout.getDisplayDensity()
  let observer:
    | org.rafaelaugusto.jolt.KeyboardObserver
    | org.rafaelaugusto.jolt.KeyboardFrame
    | undefined
  let stopped = false
  const attach = () => {
    Application.off(Application.launchEvent, attach)
    if (stopped || observer) return
    const activity =
      Application.android.foregroundActivity ?? Application.android.startActivity
    const root = activity?.getWindow()?.getDecorView()
    if (!root) return
    try {
      observer = legacy()
        ? new org.rafaelaugusto.jolt.KeyboardFrame(
            root,
            new org.rafaelaugusto.jolt.KeyboardFrame.Listener({
              onChange: (height) =>
                update(
                  height / density,
                  LEGACY_DURATION,
                  height ? legacyShow : legacyHide,
                ),
            }),
          )
        : new org.rafaelaugusto.jolt.KeyboardObserver(
            root,
            new org.rafaelaugusto.jolt.KeyboardObserver.Listener({
              onChange: (height, duration, curve) =>
                update(
                  height / density,
                  duration,
                  duration
                    ? { duration, ease: curve ? sampled(curve) : 'linear' }
                    : { duration: 0 },
                ),
            }),
          )
    } catch {
      // A JS-only update cannot install the native plugin.
      return
    }
    observer.attach()
    const height = observer.height() / density
    if (height > 0) state = Object.freeze({ ...hidden, visible: true, height })
  }
  if (Application.android.foregroundActivity ?? Application.android.startActivity)
    attach()
  else Application.on(Application.launchEvent, attach)
  return () => {
    stopped = true
    Application.off(Application.launchEvent, attach)
    observer?.detach()
    observer = undefined
  }
}

function sampled(curve: ArrayLike<number>): EasingFunction {
  const values = Array.from({ length: curve.length }, (_, i) => curve[i]!)
  const last = values.length - 1
  if (last < 1) return (progress) => progress
  return (progress) => {
    const position = Math.min(Math.max(progress, 0), 1) * last
    const index = Math.min(Math.floor(position), last - 1)
    return values[index]! + (values[index + 1]! - values[index]!) * (position - index)
  }
}

/**
 * Lifts the view by its overlap with the software keyboard, at the keyboard's
 * own speed and curve, and lets it back down when the keyboard hides.
 * Returns a function that removes the effect.
 *
 * ```ts
 * const release = followKeyboard(composer)
 * followKeyboard(sendButton, { offset: 12 })
 * ```
 */
export function followKeyboard(
  target: Target,
  options: KeyboardOptions = {},
): () => void {
  const view = toView(target)
  const offset = options.offset ?? 0
  if (!Number.isFinite(offset)) throw new RangeError('Keyboard offset must be finite.')
  if (isIOS) return followIOS(view, offset)
  if (isAndroid) return followAndroid(view, offset)
  return () => {}
}

function followIOS(view: View, offset: number) {
  let disposed = false
  let current = 0
  const onKeyboard = (notification: NSNotification) => {
    if (disposed || !view.isLoaded) return
    const native = view.nativeViewProtected as UIView | undefined
    const window = native?.window
    const info = notification.userInfo
    if (!native || !window || !info) return
    const end = info.objectForKey(UIKeyboardFrameEndUserInfoKey)?.CGRectValue as
      CGRect | undefined
    if (!end) return
    const keyboard = window.convertRectFromWindow(end, null)
    const hidden =
      keyboard.size.height <= 0 || keyboard.origin.y >= window.bounds.size.height
    const frame = native.convertRectToView(native.bounds, null)
    const bottom = frame.origin.y + frame.size.height - view.translateY
    const overlap = hidden ? 0 : Math.max(0, bottom + offset - keyboard.origin.y)
    if (overlap === current) return
    current = overlap
    stop(view, ['y'])
    const apply = () => {
      view.translateY = overlap ? -overlap : 0
    }
    const duration = numberIn(info, UIKeyboardAnimationDurationUserInfoKey)
    if (!duration) return apply()
    const curve = numberIn(info, UIKeyboardAnimationCurveUserInfoKey)
    // The keyboard's curve is private; shifted into the options it still applies.
    UIView.animateWithDurationDelayOptionsAnimationsCompletion(
      duration,
      0,
      ((curve << 16) | BEGIN_FROM_CURRENT_STATE) as UIViewAnimationOptions,
      apply,
      () => {},
    )
  }
  const observer = Application.ios.addNotificationObserver(
    UIKeyboardWillChangeFrameNotification,
    onKeyboard,
  )
  const cleanup = () => {
    if (disposed) return
    disposed = true
    Application.ios.removeNotificationObserver(
      observer,
      UIKeyboardWillChangeFrameNotification,
    )
    view.off('unloaded', cleanup)
    if (current) view.translateY = 0
  }
  view.on('unloaded', cleanup)
  return cleanup
}

function followAndroid(view: View, offset: number) {
  if (legacy()) return followLegacy(view, offset)
  const density = Utils.layout.getDisplayDensity()
  let disposed = false
  let follower: org.rafaelaugusto.jolt.KeyboardFollower | undefined
  const attach = () => {
    if (disposed || follower) return
    const native = view.nativeViewProtected as android.view.View | undefined
    if (!native) return
    try {
      follower = new org.rafaelaugusto.jolt.KeyboardFollower(
        native,
        offset * density,
        new org.rafaelaugusto.jolt.KeyboardFollower.Listener({
          onStart: () => stop(view, ['y']),
          onSettled: (translation) => {
            view.translateY = translation / density
          },
        }),
      )
    } catch {
      // A JS-only update cannot install the native plugin. Leave the platform's resize in place.
      return
    }
    follower.attach()
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    view.off('loaded', attach)
    view.off('unloaded', cleanup)
    if (follower) {
      follower.detach()
      follower = undefined
      view.translateY = 0
    }
  }
  view.on('loaded', attach)
  view.on('unloaded', cleanup)
  if (view.isLoaded) attach()
  return cleanup
}

/** Android 7 to 10: no frame-by-frame progress, so the view animates with the keyboard's usual timing. */
function followLegacy(view: View, offset: number) {
  const density = Utils.layout.getDisplayDensity()
  let disposed = false
  let follower: org.rafaelaugusto.jolt.KeyboardFrameFollower | undefined
  const attach = () => {
    if (disposed || follower) return
    const native = view.nativeViewProtected as android.view.View | undefined
    if (!native) return
    try {
      follower = new org.rafaelaugusto.jolt.KeyboardFrameFollower(
        native,
        offset * density,
        new org.rafaelaugusto.jolt.KeyboardFrameFollower.Listener({
          onMove: (from, to, keyboard) => {
            stop(view, ['y'])
            view.translateY = from / density
            animate(view, { y: to / density }, keyboard ? legacyShow : legacyHide)
          },
        }),
      )
    } catch {
      // A JS-only update cannot install the native plugin. Leave the platform's resize in place.
      return
    }
    follower.attach()
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    view.off('loaded', attach)
    view.off('unloaded', cleanup)
    if (follower) {
      follower.detach()
      follower = undefined
      stop(view, ['y'])
      view.translateY = 0
    }
  }
  view.on('loaded', attach)
  view.on('unloaded', cleanup)
  if (view.isLoaded) attach()
  return cleanup
}

/** The runtime hands NSNumber values over as plain numbers. */
function numberIn(info: NSDictionary<unknown, unknown>, key: string): number {
  const value = info.objectForKey(key) as number | NSNumber | null | undefined
  if (typeof value === 'number') return value
  return value?.doubleValue ?? 0
}
