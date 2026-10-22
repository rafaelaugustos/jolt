# Haptics

Add an impact when an animation arrives:

<Clip name="haptics-ios" caption="Arrival and bounce animations in the iOS simulator. Video cannot reproduce haptic feedback; feeling it requires a supported physical iPhone." />

<Clip name="haptics-android" caption="Spring arrivals, bounce, stagger and playback controls on an Android 15 emulator. White flashes mark native feedback requests, not proof of vibration. Video cannot reproduce tactile feedback." />

<Clip name="haptics-android-device" caption="Real touches on a physical ASUS_Z017DC, Android 8.0, Animator scale 1 and touch feedback enabled. White flashes mark requests at the native view; the recording cannot reproduce their tactile sensation." />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

Choose `light`, `medium` or `heavy`. Feedback is opt-in on **iOS and Android**. You need a supported physical device to feel it. A simulator/emulator can verify requests and timing, but cannot establish the sensation. Device settings and hardware decide whether a request is felt; the styles are not calibrated intensity levels across devices.

## Android behavior

Jolt calls [`View.performHapticFeedback()`](https://developer.android.com/develop/ui/views/haptics/haptic-feedback) without bypass flags or a `VIBRATE` permission. It respects the view's `hapticFeedbackEnabled` setting and the system's touch-feedback preference. A declined request is not retried as a stronger vibration.

| Style    | Android mapping          | Older-platform fallback |
| -------- | ------------------------ | ----------------------- |
| `light`  | `CLOCK_TICK`, API 21+    | `KEYBOARD_TAP`          |
| `medium` | `CONTEXT_CLICK`, API 23+ | `KEYBOARD_TAP`          |
| `heavy`  | `LONG_PRESS`             | Same effect             |

On modern Android versions, a `true` API result can acknowledge asynchronous dispatch even when the system later suppresses the request. It is not proof of vibration.

These are platform feedback categories, not custom waveforms. OEMs can make two categories feel similar. No optional native-adapter package is required for haptics.

See the [native validation notes](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/haptics.md) for device settings, recorded request times and the distinction between platform acknowledgement and felt feedback.

## Arrival

A spring triggers feedback at the same visual arrival that advances a sequence, before its settling tail finishes. A tween triggers at the end. With several properties, Jolt waits for the last arrival and fires one impact per view. Delays, property overrides and stagger are included.

```ts
animate(
  card,
  { x: 160, scale: 1.1 },
  {
    type: 'spring',
    duration: 500,
    haptic: 'medium',
  },
)
```

Finite repeats trigger once, at the end of the last iteration. Infinite animations have no final arrival and do not produce feedback. Empty animations, zero-duration changes and stationary keyframes also stay silent.

## Impacts during a movement

Use `times` for specific impacts. These are increasing points greater than `0` and at most `1`, over the complete finite animation after its initial delay. With property overrides, the span starts at the earliest moving property's delay and ends when the last property finishes. Finite repeats are included in that span; the points are not repeated automatically.

The `bounce` preset lands at 60% and 100%:

```ts
animate(button, 'bounce', {
  haptic: { style: 'light', times: [0.6, 1] },
})
```

Points follow the resolved duration rather than a separate millisecond timer supplied by the app. They replace the default arrival impact.

## Cancellation and timing

`animation.stop()`, `stop(view)` and interruption cancel pending feedback. Taking over or stopping any property cancels that animation's remaining impacts, even if its other properties keep playing. Independent animations on the same view keep their own feedback.

Unloading the view cancels its pending impacts permanently. Feedback is also skipped if the native view was replaced, is outside a window, or the app is inactive. A new animation can schedule new feedback when the view returns.

`pause()` holds pending impacts, and `play()` schedules the remaining time. This also applies to animations owned by `timeline()`. Seeking skips crossed impact points; rewinding does not replay consumed points. These are one-shot events, not a reversible waveform.

Jolt prepares `UIImpactFeedbackGenerator` on iOS when playback starts and again shortly before a distant impact. On Android, discrete native timing markers follow Animator duration scale, and the impact request executes through JavaScript at the scheduled boundary. There is no JavaScript callback per animation frame in the haptic scheduler. The demo separately opts into progress observation for its percentage label.

Timing is best effort: JavaScript shares the UI thread in NativeScript, and a busy thread can delay a request. Impacts more than 100 ms late **in animation time** are discarded instead of replayed. A timely platform request still does not guarantee physical feedback.

## Motion settings

Jolt slow motion and Android Animator duration scale affect feedback timing with playback. Android scale **0** suppresses feedback even when `configure({ reducedMotion: 'never' })` preserves a logical animation. A scale change to zero also silences pending requests.

Reduced-motion transforms that jump immediately do not produce impacts. An opacity/color animation that still plays can retain its explicitly requested feedback, unless Android's animators are disabled. `haptic: false` always disables feedback for the call.

Custom presets can include `haptic` in their transition. Pass `haptic: false` to disable it for a call:

```ts
animate(card, 'myPreset', { haptic: false })
```
