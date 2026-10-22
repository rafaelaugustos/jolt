# Follow the keyboard

Move a composer, a button or a toolbar with the software keyboard:

<Clip name="keyboard" caption="The composer following the keyboard on Android." />

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

<Clip name="keyboard-ios" caption="On the iOS simulator, the composer rises with the keyboard and settles back when it hides, while onKeyboard() shrinks the badge on the keyboard's own spring. Real-time playback." />

## Android

Android 11 and later report the keyboard's progress on every frame through `WindowInsetsAnimation`. Jolt installs a native callback on the view, so the per-frame work runs in Java and nothing crosses to JavaScript while the keyboard moves. The callback measures the view before and after the layout for the keyboard, so it works with `adjustResize` (the view is already laid out above the keyboard and only the motion is smoothed) as well as with `adjustPan` and `adjustNothing` (the view is translated by its overlap). JavaScript is called once when the motion starts and once when it settles.

The app's activity needs `android:windowSoftInputMode` set, as the NativeScript template already does with `adjustResize`, for the window to receive keyboard insets. Rebuild the Android app after upgrading so the native class is included.

Android 7 to 10 have no frame-by-frame progress. There, Jolt reads the keyboard from the window's visible frame on every layout. When a layout for the keyboard moves the view, Jolt puts it back where it was and animates it to its place above the keyboard, at the keyboard's usual timing: about 150 ms, decelerating as it shows and accelerating as it hides, as measured on an Android 9 emulator. That covers `adjustResize`, where the layout already lifts the view, and `adjustPan` and `adjustNothing`, where the view is translated by its overlap. The animation is a regular native Jolt animation, started once per change.

<Clip name="keyboard-android-9" caption="On an Android 9 emulator, the composer rises from where the layout moved it to above the keyboard and settles back when it hides, while onKeyboard() reports 297 DIPs and the measured 150 ms. Real-time playback." />

## Keyboard state

A screen often needs to react in other ways: compact a header, move an illustration, add room at the end of a scroll view. `onKeyboard()` reports how much of the window the keyboard covers and how it gets there:

```ts
import { animate, onKeyboard } from '@rafaelaugusto/jolt'

const off = onKeyboard(({ visible, height, duration, transition }) => {
  animate(header, { scale: visible ? 0.8 : 1 }, transition)
})
```

<Clip name="keyboard-state-android" caption="On the Android emulator, onKeyboard() reports 336 DIPs and the keyboard's 285 ms, and the badge shrinks along the keyboard's own curve while the composer follows it. Real-time playback." />

| Field        | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| `visible`    | a docked keyboard covers part of the window                                           |
| `height`     | DIPs of the window covered, from its bottom edge; zero when hidden or floating        |
| `duration`   | milliseconds the keyboard takes to get there; zero when it changes at once            |
| `transition` | the keyboard's own timing, ready for `animate()`, so other views move in step with it |

The callback runs when the covered height changes: showing, hiding, switching to a taller keyboard. A floating or undocked iPad keyboard covers nothing and reports `visible: false`. All listeners share one observer, removed with the last cleanup.

On iOS the keyboard moves on a spring that Core Animation plays critically damped in 500 ms; `transition` is that spring (`stiffness: 1000`, `mass: 3`). iOS reports keyboard changes only as they happen, so a keyboard already open when the first listener subscribes is reported at its next change. On Android 11 and later, a native callback on the window reads the keyboard's duration and samples its interpolator, so `transition` follows the same curve. A keyboard already open is known from the start. On Android 7 to 10, the height comes from the window's visible frame, `duration` is 150 and `transition` is a 150 ms `quadOut` as the keyboard shows and `quadIn` as it hides, the timing measured on an Android 9 emulator; the height includes the navigation bar below the keyboard, as it does on Android 11.

In Vue, [`useKeyboard()`](./vue#keyboard) gives a ref that stays up to date until the component unmounts.

## Cleanup

The return value removes the effect:

```ts
const release = followKeyboard(composer)
release() // stops following and clears the translation it applied
```

Unloading the view releases it too, so a screen that goes away does not keep an observer. Attach again when reusing an unloaded view. Calling the cleanup twice is harmless.
