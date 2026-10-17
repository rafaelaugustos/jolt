# Follow the keyboard

Move a composer, a button or a toolbar with the software keyboard:

```ts
import { followKeyboard } from '@rafaelaugusto/jolt'

const release = followKeyboard(composer)
followKeyboard(sendButton, { offset: 12 })
```

When the keyboard appears, the view rises by exactly the distance it would otherwise be covered, at the keyboard's own speed and curve. When the keyboard changes height, the view follows. When it hides, the view settles back. A view the keyboard does not reach stays where it is.

The target is a view or anything holding one, like `animate()`. Attach the effect before the keyboard appears; it reacts to keyboard changes and does not read the keyboard's current position on its own.

## Offset

`offset` keeps extra DIPs between the view's bottom edge and the keyboard:

```ts
followKeyboard(composer, { offset: 8 })
```

The default is zero, so the view ends touching the top of the keyboard.

## What moves

The effect owns the view's `translateY`. It writes the NativeScript property, so the value an app reads and the value Jolt starts its next animation from are the one on screen. Any Jolt animation on `y` is stopped at its current position before the keyboard takes over, so the two never fight. Other properties and other views are untouched.

The view's untranslated position is measured when the keyboard moves. Layout changes while the keyboard is open are not followed; the next keyboard change measures again.

## iOS

Jolt observes `UIKeyboardWillChangeFrameNotification`, which covers showing, hiding, height changes and the split and floating layouts on iPad. The notification carries the keyboard's end frame, duration and curve. The frame is converted into the view's window, and the view moves inside a `UIView` animation with that duration and curve, so it stays attached to the keyboard edge for the whole motion. The curve is a private value that only exists shifted into animation options; Jolt does that for you.

Hardware keyboards and zero-duration changes apply the new position immediately.

## Android

Android 11 and later report the keyboard's progress on every frame through `WindowInsetsAnimation`. Jolt installs a native callback on the view, so the per-frame work runs in Java and nothing crosses to JavaScript while the keyboard moves. The callback measures the view before and after the layout for the keyboard, so it works with `adjustResize` (the view is already laid out above the keyboard and only the motion is smoothed) as well as with `adjustPan` and `adjustNothing` (the view is translated by its overlap). JavaScript is called once when the motion starts and once when it settles.

The app's activity needs `android:windowSoftInputMode` set, as the NativeScript template already does with `adjustResize`, for the window to receive keyboard insets. Rebuild the Android app after upgrading so the native class is included.

Below Android 11 the call does nothing and returns a no-op cleanup; the platform's own resize behavior remains.

## Cleanup

The return value removes the effect:

```ts
const release = followKeyboard(composer)
release() // stops following and clears the translation it applied
```

Unloading the view releases it too, so a screen that goes away does not keep an observer. Attach again when reusing an unloaded view. Calling the cleanup twice is harmless.
