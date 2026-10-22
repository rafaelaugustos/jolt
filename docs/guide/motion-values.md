# Motion values

A motion value is a number that animates natively and drives every view property bound to it. One value can move a sheet, darken a backdrop and shrink the page behind it, all on one native clock:

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
bind(page, { scale: progress.to([0, 1], [1, 0.92]) })
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })

animate(progress, 1, 'snappy')
```

<Clip name="motion-values-ios" caption="One motion value opens and closes a sheet, darkens the backdrop and shrinks the page, on the iOS simulator. Real-time playback." />

## Mapping

`to(input, output)` maps a value through input and output ranges, like React Native's `interpolate`: piecewise linear, with the first and last outputs held outside the input range. Pass `{ clamp: false }` to extend the first and last segments instead, so a spring's overshoot carries through. Inputs must not decrease, and there is one output per input.

```ts
const y = progress.to([0, 0.4, 1], [600, 120, 0])
const tint = progress.to([0, 1], ['#18181B', '#FACC15']) // colors mix in OKLab
const bounce = progress.to([0, 1], [0, 300], { clamp: false })
```

A mapped number can be mapped again. Color outputs bind to `backgroundColor`, `borderColor` and `color`; number outputs bind to everything else `animate()` takes, with `scale` setting both axes. A value can also be bound as is: `bind(dot, { x: offset })`.

## Animating and setting

`animate(value, to, transition)` takes a number or keyframes and the same transitions as `animate()`: tweens, springs, `repeat`, `repeatType`, `repeatDelay`, `delay` and `easeTrack`. It returns an [`Animation`](./api#animations). Jolt samples the value's curve once, maps it through each binding, and plays one native track per bound property, all started together. Nothing runs in JavaScript while they play.

```ts
animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.6], { duration: 700, times: [0, 0.5, 1] })
animate(pulse, 1, { duration: 900, repeat: Infinity, repeatType: 'reverse' })
```

An animation that interrupts another starts from the value on screen, with its velocity, so every bound view turns around together. `set(value, number)` applies a value to every bound view at once. `stop(value)` holds the value and its views where they are. `value.get()` reads the value now, while it animates too.

With [reduced motion](./configure#reduced-motion), bound transforms jump to their end while opacity and colors still animate. The [time scale](./configure#time-scale) applies once, to the value's curve.

## Binding

`bind(views, bindings)` gives the views the values' current state at once and keeps them following. It returns a cleanup function: after it, the views stay where they are. `motionScope().use(() => bind(...))` ties a binding to a scope.

A value outlives its views. A view that is not loaded yet takes its value when it loads, and joins an animation in progress at the point it has reached. A regular `animate()` or `set()` on a bound property takes that property over at its current value and velocity; the value keeps driving its other bindings. `stop(view)` stops the motion on screen but keeps the binding.

## Vue

`useMotionValue()` creates a value that stops when the component unmounts. `useBinding()` returns a template ref that binds on mount and releases on unmount, so an element recreated by `v-if` picks the value up again:

```vue
<script setup lang="ts">
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const toggle = (open: boolean) => animate(progress, open ? 1 : 0, 'snappy')
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

<Clip name="motion-values-android" caption="The same sheet on the Android emulator, including a tap mid-way that turns all three views around together. Real-time playback." />

## Scroll offsets

`scrollValue(scrollView)` is a ScrollView's offset as a value, in DIPs. Bind it like any motion value; each scroll event writes the bound properties directly, with no animation in between:

```ts
import { bind, scrollValue } from '@rafaelaugusto/jolt'

const offset = scrollValue(scroll)
bind(header, { y: offset.to([0, 90], [0, -64]) })
bind(title, { scale: offset.to([0, 90], [1, 0.72]), y: offset.to([0, 90], [0, 30]) })
bind(subtitle, { opacity: offset.to([0, 50], [1, 0]) })
bind(progress, { scaleX: offset.to([0, 700], [0, 1]) })
```

<Clip name="scroll-values-ios" caption="Scrolling the list collapses the header, shrinks the title, fades the subtitle and fills the progress bar, on the iOS simulator. Real-time playback." />

`{ axis: 'x' }` follows the horizontal offset. The value starts from the current offset, and `offset.ref(scrollView)` follows another ScrollView, or none with `null`. `offset.dispose()` stops following and leaves bound views where they are. In Vue, `useScrollValue()` returns a value whose `ref` goes on the ScrollView's template ref, and stops with the component:

```vue
<script setup lang="ts">
const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
</script>

<template>
  <ScrollView :ref="offset.ref">...</ScrollView>
  <GridLayout :ref="header" />
</template>
```

Scroll events arrive in JavaScript, as for [`scrollLinked()`](./scroll-linked). With five bound properties, one event costs about 0.25 to 0.3 ms on the iOS simulator and the Android emulator, about half of the equivalent `scrollLinked()` setup on Android; see the [measurements](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-values.md).

<Clip name="scroll-values-android" caption="The same header following the list on the Android emulator. Real-time playback." />

## Dragging

`drag(view, { axis, value })` writes the finger's position into a value instead of moving the view, then plays the release on the value. Everything bound to it follows the finger and the fling together. The gesture is read on the view you pass; bind that view too if it should move:

```ts
import { bind, drag, motionValue } from '@rafaelaugusto/jolt'

const closed = 380
const y = motionValue(closed)
bind(sheet, { y })
bind(page, { scale: y.to([0, closed], [0.9, 1]) })
bind(backdrop, { opacity: y.to([0, closed], [0.5, 0]) })
bind(hint, { opacity: y.to([closed / 2, closed], [0, 1]) })

drag(sheet, {
  axis: 'y',
  value: y,
  bounds: { top: 0, bottom: closed },
  snap: [0, closed / 2, closed],
  rubberband: true,
})
```

<Clip name="drag-values-ios" caption="One draggable sheet drives a motion value that scales the page, darkens the backdrop and fades the hint, with snap points, rubberband and the same value animated by a button, on the iOS simulator. Real-time playback." />

`axis` is `'x'` or `'y'`. Bounds, snap points and the dragged axis in events are in the value's units; the other axis reads 0. Everything else works as in [`drag()`](./drag): rubberband, friction, callbacks and the controller. The release is the same curve, sampled once and played natively by every bound property, with nothing in JavaScript until it ends. `onRelease` receives an [`Animation`](./api#animations) rather than a `PlaybackAnimation`. Touching the view during a release, or during `animate(value, ...)`, stops the value where it is, and the gesture carries on from there.

Each pan event writes the bound properties directly. With six bound properties, an event costs about the same as writing them by hand in `onMove`: around 0.8 ms on the iOS simulator and 0.25 to 0.35 ms on the Android emulator; see the [measurements](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/drag-values.md). In Vue, start the drag from `useMotionScope()` in `onMounted`, as the demo's **Drag values** screen does.

<Clip name="drag-values-android" caption="The same sheet on the Android emulator, with real flings in both directions and a grab while the button animation is still running. Real-time playback." />

## What comes next

Values compose with [layers](./layers) on the same property. Native evaluation, where measurements call for it, is planned in the [motion values RFC](https://github.com/rafaelaugustos/jolt/issues/152).
