# Pause, play and scrub

`animate()` and `decay()` return a `PlaybackAnimation`. Pause it, set its progress, then continue:

```ts
const animation = animate(card, 'flipInY')
animation.pause()
animation.progress = 0.4
animation.play()
```

`pause()` freezes only the properties this animation owns. Another animation on the same view, an effect on a child, and native widget animations keep running. `play()` resumes from the current position. Both methods are idempotent.

## Progress

`progress` is a number from 0 to 1 over the **whole finite timeline**, including initial delay, per-property delays, repeats, reverse repeats and stagger. `duration` is that timeline's length in milliseconds; `paused` reports whether it is held.

```ts
const animation = animate(
  cards,
  { x: [0, 100], opacity: [0, 1] },
  { duration: 1000, stagger: 200 },
)
animation.pause()
animation.progress = 0.5
```

With two cards, this timeline lasts 1200 ms. At 50%, the first card is 60% through its motion and the second is 40% through. Different property durations use the same time range.

Setting progress preserves the paused/playing state. A paused animation can reach 1 and scrub backward without settling. A playing animation continues forward from the new position and completes normally. Values outside 0–1, `NaN` and infinities throw before changing playback.

An infinite loop can pause and play, but has no finite `progress`: reading or setting it throws. Before a view loads, a finite duration is reported as 0; a requested progress is remembered and applied when its tracks are ready. A group waits for every target to be ready before applying its requested progress.

## Gestures and sliders

Create and pause the animation once. Set progress in response to user input:

```ts
const animation = animate(card, { rotateY: [0, 180] }, { duration: 1000 })
animation.pause()

slider.on('valueChange', ({ value }) => {
  animation.progress = value / 100 // slider range: 0–100
})

// Continue from the selected frame.
animation.play()
```

Jolt does not run a JS frame loop to hold or continue playback. Scrubbing runs only when you set progress. The playground has Play, Pause, Stop and a slider, with an independent pulse to show that other animations keep moving.

## Interruption and lifecycle

Pausing leaves `finished` pending. `stop()` freezes the current position and resolves with `false`; unloading also stops and releases native resources. An animation that takes over reads the controlled position. A paused track has zero inherited velocity; a resumed track inherits the velocity of its original curve at that position.

Shorter properties and staggered views can be rewound while their containing animation is still active. A property taken over by another animation, or changed after it completed, is not reclaimed by a scrub. Completed and stopped animations remain terminal: controls do not restart them. Create another animation to replay.

Sequence objects keep the base `Animation` lifecycle. Control a specific step by retaining the `PlaybackAnimation` returned by `animate()` or `decay()`. Pausing a step before its arrival holds the next step; an arrival that already happened cannot be undone. Effects such as `animateText()`, `reveal()` and `symbolEffect()` retain their own documented controls and do not expose generic progress.

Haptics wait through a pause and resume with the remaining timeline. Seeking silently skips points it crosses; seeking backward never replays consumed feedback.

## Native timing

On iOS, each `CAAnimation` has its own speed and time offset. Jolt leaves the layer's timing untouched, including the layers that Core uses for colors and shadows. Replacing a CA copy during a control command cannot settle the original promise through a stale completion callback.

On Android, native pause/resume controls the existing animators. A seek repositions their keyframes, including delay and repeat phases. Active animations share one native elapsed-time marker to respect the system animator duration scale. Jolt removes that marker when every owner pauses and starts a fresh one on resume, avoiding Android's paused-clock correction; it is released after the last owner settles. None of these markers calls JavaScript per frame. Android's UI-thread limitation still [applies](./android-performance).
