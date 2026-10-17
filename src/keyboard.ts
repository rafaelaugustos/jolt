import { Application, Utils, isAndroid, isIOS, type View } from '@nativescript/core'
import { stop, toView } from './animate.js'
import type { Target } from './types.js'

export interface KeyboardOptions {
  /** DIPs kept between the view's bottom edge and the keyboard. Defaults to zero. */
  offset?: number
}

const BEGIN_FROM_CURRENT_STATE = 4

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
    const duration = info.objectForKey(UIKeyboardAnimationDurationUserInfoKey)
      ?.doubleValue as number | undefined
    if (!duration) return apply()
    const curve =
      (info.objectForKey(UIKeyboardAnimationCurveUserInfoKey)?.integerValue as
        number | undefined) ?? 0
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
  if (android.os.Build.VERSION.SDK_INT < 30) return () => {}
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
