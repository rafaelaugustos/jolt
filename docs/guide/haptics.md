# Haptics

Add an impact when an animation arrives:

<Clip name="haptics-ios" caption="Arrival and bounce animations in the iOS simulator. Video cannot reproduce haptic feedback; feeling it requires a supported physical iPhone." />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

Choose `light`, `medium` or `heavy`. Feedback is opt-in and **iOS only** for now; Android ignores the option. You need a supported physical device to feel it. The simulator can run the animation but cannot reproduce the sensation.

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

Jolt prepares `UIImpactFeedbackGenerator` when playback starts and again shortly before a distant impact. It uses discrete engine timers, with no JavaScript callback per animation frame. Timing is best effort: JavaScript shares the UI thread in NativeScript, and a busy thread can delay an impact. Impacts more than 100 ms late are discarded instead of replayed. iOS and device settings decide whether a requested impact is felt.

Custom presets can include `haptic` in their transition. Pass `haptic: false` to disable it for a call:

```ts
animate(card, 'myPreset', { haptic: false })
```
