# Gradients

NativeScript's CSS only has a static `linear-gradient`. `gradient()` paints a native linear, radial or conic gradient behind a layout's children, and animates its colors, stops, angle, center and radius:

```ts
import { gradient } from '@rafaelaugusto/jolt'

const glow = gradient(card, {
  type: 'radial',
  colors: ['#A78BFA', '#0F172A'],
  center: { x: 0.3, y: 0.3 },
  radius: 0.45,
})

glow.animate({ center: { x: 0.7, y: 0.7 }, radius: 0.9 }, { duration: 1400 })
```

<Clip name="gradients-ios" caption="A linear angle, a moving radial light, a spinning conic sweep and a linear band on a wide view, then the linear colors swapped, on the iOS simulator. Real-time playback." />

## Types and values

| Value    | Meaning                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors` | two to eight colors, as strings or `Color`                                                                                                   |
| `stops`  | where each color sits, from 0 to 1, without going back; evenly spaced by default                                                             |
| `angle`  | degrees, like CSS. `linear` points this way: 180 runs top to bottom, 90 left to right. `conic` starts here: 0 is up, and colors go clockwise |
| `center` | `radial` and `conic`: fractions of the view's width and height; `{ x: 0.5, y: 0.5 }` by default                                              |
| `radius` | `radial`: a fraction of the view's shorter side; 0.5 by default reaches the nearer edges                                                     |

A linear gradient runs through the center and is long enough for the corners to get the first and last colors, as in CSS. Its bands stay square to the angle on views of any shape, on both platforms. Values a type doesn't use are kept. The direct API's `type` is immutable: remove it and create another gradient to change type. `v-gradient` handles that replacement for you.

## Animating

`animate(values, transition)` starts from the gradient on screen and returns an [`Animation`](./api#animations). It takes the same transitions as `animate()`: tweens, springs, `repeat`, `repeatType`, `repeatDelay` and `delay`, and follows the [time scale](./configure#time-scale).

```ts
const sweep = gradient(loader, {
  type: 'conic',
  colors: ['#22D3EE', '#A855F7', '#22D3EE'],
})
sweep.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
```

Colors mix in OKLab, like [color animations](./colors), and keep their count while animating; `set()` changes it. On a spring, the angle, center and radius follow the overshoot while colors and stops stay between their ends. A gradient plays one animation at a time: a new `animate()` takes over from where the previous one is. `stop()` holds the current frame and `set(values)` applies values at once. With [reduced motion](./configure#reduced-motion), the angle, center and radius jump to their end while colors and stops still fade.

`remove()` takes the gradient off the view. Unloading the view stops the animation in progress.

## Scopes and Vue

`motionScope().gradient(target, options)` returns the same `Gradient` and removes it when the scope is disposed. Suspending the scope stops an animation in progress where it is and keeps the gradient. In Vue, `useMotionScope()` ties it to the component:

```ts
const scope = useMotionScope()
onMounted(() => scope.gradient(card.value, { type: 'linear', colors: warm, angle: 135 }))
```

The `v-gradient` directive does the same from a template. It paints the gradient when the element mounts, animates to the new values when they change, and removes it on unmount. Pair the options with a transition or a spring name to time the changes:

```vue
<GridLayout v-gradient="{ type: 'linear', colors: ['#18181B', '#3F3F46'], angle: 135 }" />
<GridLayout
  v-gradient="[
    { type: 'linear', colors: mood.colors, angle: mood.angle },
    { duration: 700 },
  ]"
/>
```

<Clip name="gradient-directive-ios" caption="A v-gradient banner animating its colors and angle as its value changes, on the iOS simulator. Real-time playback." />

A change in the number of colors applies at once, since a gradient keeps its color count while animating. A change of `type` replaces the gradient. Values are compared by content, so an object written in the template doesn't restart the animation on every render.

<Clip name="gradient-directive-android" caption="The same banner on the Android emulator. Real-time playback." />

## Platforms

On iOS the gradient is a `CAGradientLayer` at the back of the view's layer, with Core Animation keyframes for its colors, locations and points. On Android it is a drawable stacked on the view's own background, and a native animator interpolates the sampled frames. There is no JavaScript paint callback per frame. Rebuild the Android app after upgrading so the native class and its bridge metadata are included.

The gradient covers the view's background color and follows a uniform `borderRadius`. It sits behind the children of a layout. On a view that draws its own content, like a `Label`, it covers that content: put the gradient on a layout around it.

<Clip name="gradients-android" caption="The same gradients and the color swap on the Android emulator. Real-time playback." />

## Following motion values

Pass numeric motion/derived values to `angle`, either `center` component, `radius` or individual `stops`, and derived colors to individual `colors`. Static and bound components can coexist. `GradientBindings` is exported for typed configuration. One source can also drive view properties, descending mappings, extrapolation and [scalar layers](./motion-values):

```ts
import { animate, bind, gradient, motionValue } from '@rafaelaugusto/jolt'

const offset = motionValue(0)
const progress = offset.to([0, 220], [0, 1], { clamp: false })
const releaseView = bind(thumb, { x: offset, opacity: progress.to([0, 1], [0.5, 1]) })
const glow = gradient(card, {
  type: 'radial',
  colors: [progress.to([0, 1], ['#ed4b82', '#45c8f5']), 'rgba(16,23,43,0)'],
  center: {
    x: progress.to([0, 1], [0.15, 0.85]),
    y: progress.to([1, 0], [0.2, 0.8]),
  },
  radius: progress.to([0, 1], [0.35, 0.9]),
  stops: [0, progress.to([0, 1], [0.45, 1])],
})

const travel = animate(offset, 220, { duration: 3000 })
// travel.pause(), travel.play(), and travel.progress = 0.7 also control the gradient.
animate(offset, [0, 35, 0], { duration: 900, layer: 'pulse' })
// At teardown: glow.remove(); releaseView(); stop(offset).
```

The same contract accepts mappings from `playbackProgress(animation)`: for example, `angle: playbackProgress(travel).to([0, 1], [0, 360])` for a conic gradient. No timer or `subscribe()` is needed. Replace `value.subscribe(v => glow.set(...))` with the source or its `.to()` mapping directly, and remove the old subscription.

<Clip name="gradient-values-ios" caption="iPhone 17 simulator, iOS 26: actual drag and button interaction, followed by autonomous playback, a layered pulse, pause/seek, scope hold, type replacement and resize. Real time; gesture events and binding rebuilds still enter JavaScript." />

### Ownership and lifecycle

| Operation                                    | Result                                                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glow.bind({ center: { x: value } })`        | Replaces only center x; returns a cleanup function.                                                                                                                                      |
| Binding cleanup                              | Holds the current values of components it still owns. Does not restore older bindings or remove newer owners.                                                                            |
| `glow.set(...)` / `glow.animate(...)`        | Detaches bindings only for the components supplied. Other bindings continue. A new concrete animation replaces the previous concrete animation. `set()` cancels that concrete animation. |
| `glow.bind(...)` during a concrete animation | Takes over the supplied components; untouched components of that animation continue.                                                                                                     |
| `glow.stop()`                                | Holds the current frame, stops concrete playback and detaches all gradient bindings. The source and other consumers continue.                                                            |
| `glow.suspend()` / `glow.resume()`           | Temporarily holds and unsubscribes, then catches up to the source. Read `glow.suspended` for an explicit hold. Does not pause an independently owned source.                             |
| `glow.remove()`                              | Detaches subscriptions, timers, native animations, layer/drawable and view/app listeners. Safe to call again.                                                                            |

`motionScope().gradient()` and `useMotionScope().gradient()` own the same controller. Scope suspension holds bindings; resume follows the source again without duplicate subscriptions. A manually suspended gradient remains held across a scope suspend/resume. If the source animation also belongs to that scope, its normal scope pause/resume rules apply. Concrete gradient animations stop on suspension; they are not restarted.

Unloading removes the native layer and subscriptions while retaining the binding definitions. Reloading attaches once at the source's current position. App backgrounding similarly holds/unsubscribes; foregrounding catches up. Scope disposal and Vue unmount remove everything.

Color count is structural: `bind()`/`set()` can replace the whole color array immediately, dropping incompatible color/stop bindings while keeping geometry bindings. Supplying `colors` without `stops` resets stops to even spacing, as in the concrete API. `animate()` requires the same count. Two to eight colors and one stop per color are required.

### Vue bindings

Create sources once in setup. The directive compares motion values by identity, validates a replacement before removing the working gradient, and releases omitted bindings at their held values. A different type replaces the native layer. A transition tuple controls concrete options; bound components follow their own source timing.

```vue
<script setup lang="ts">
import { motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
const angle = progress.to([0, 1], [0, 360])
const tint = progress.to([0, 1], ['#ed4b82', '#45c8f5'])
</script>

<template>
  <GridLayout v-gradient="{ type: 'conic', colors: [tint, '#20233c', tint], angle }" />
</template>
```

### Valid ranges and native execution

Angles use the units/direction above and may exceed 360°. Centers may extrapolate outside the view. Static negative radii, nonfinite numbers, invalid colors and unordered/out-of-range static stops throw before replacing working bindings. Bound radius overshoot is clamped to zero. Bound stops are clamped to `[0, 1]`, then each stop is raised to at least the previous stop; colors are never sorted or swapped. Overshoot can merge stops. A mapping that later produces a nonfinite result holds the last valid compiled frame, detaches that gradient's bindings and writes a NativeScript Trace error; other consumers remain attached. Rebind with valid values to recover.

Derived colors use Jolt's OKLab interpolation and preserve alpha. Native samples use 8-bit color channels; between samples the platform interpolates those colors. With reduced motion, bound geometry uses the source's destination while colors and stops continue to interpolate.

All components are prepared as a coherent frame from one snapshot per source. Moving bindings use windows of at most **4 seconds**, with **at most 241 samples**, spaced no more than **16.7 ms** apart in source playback time. Native playback is aligned to the existing source clock; bindings do not create a second playback clock. Native points/colors on iOS and numeric channels on Android interpolate between these samples. This is a sampled approximation: there is no universal visual-error bound for an arbitrarily sharp mapping or a repeat discontinuity. An abrupt change may blend across one sample interval; keep important transitions wider than that interval. For a linearly interpolated numeric channel whose rate is bounded by L units/ms, interpolation contributes at most L × Δ / 2 error (Δ ≤ 16.7 ms), before native floating-point rounding and display scheduling. Discontinuous mappings do not satisfy that bound.

JavaScript runs at preparation, source commands, gesture events and long-window boundaries. Autonomous playback within a window requests **zero JS observer frames** and has no per-frame `set()`/paint loop. Long-running/infinite sources need a rebuild every four seconds; if JS cannot run then, the gradient holds its last prepared frame until it can rejoin the source. On iOS, submitted Core Animation frames can keep playing during JS contention. Android's animator and drawing still depend on its UI thread, so blocking it stalls rendering. Frequent drag updates still rebuild bindings through JS; this API does not move gesture handling to a worklet.

<Clip name="gradient-values-android" caption="Android 16 / API 36 emulator: actual drag and taps with the same three gradients and controls. Real time; native animator playback, with JavaScript used for gesture events and preparation." />
