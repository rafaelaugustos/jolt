# Interrupting and stopping

Starting an animation on a property that's already animating takes it over: the new one starts from the value on screen, with the same velocity, so a card can change its mind halfway without a jump. Other properties of the previous animation keep going.

<Clip name="interrupting-ios" caption="Repeated taps reverse an in-flight spring. Real iOS simulator playback at one-fifth speed to make the handoff visible." />

`animate()` returns an animation you can `await`. It resolves with `true` when it played to the end, and `false` when it was stopped or taken over. It never rejects.

```ts
const animation = animate(card, { x: 300 })
animation.stop() // the card stays where it is

stop(card) // stops everything running on the card
stop(card, ['x', 'scale']) // stops translation on x and both scale axes
```

Selected properties stay at their current values; the others keep animating. `scaleX` and `scaleY` can also be stopped separately. Pass an empty array to stop nothing, or omit it to stop everything. This works with arrays of targets too.

If part of an animation is stopped, its `finished` promise resolves with `false` once its remaining properties finish.

## Loops and the background

Infinite repeats keep playing natively. On iOS, Core Animation drops animations when the app goes to the background; Jolt starts them again when it comes back.

For holding an animation and choosing its frame, see [pause, play and scrub](./playback).
