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

## What comes next

Values here are driven by timelines. Values that follow a finger or a scroll offset from native code, and several animations layered on one property, are planned in the [motion values RFC](https://github.com/rafaelaugustos/jolt/issues/152).
