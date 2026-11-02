# Springs that follow a moving target

Available since **0.1.0-beta.16**, in the core package. Rebuild the native app after upgrading. No optional native-property plugin is needed.

`springValue()` retains a native spring's position and velocity while its target changes. Retargeting updates the existing node; it does not rebuild a keyframe animation. A follower can drive another follower without a JavaScript subscription between them.

```ts
import { bind, motionScope, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const pointer = motionValue(0)
const first = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
const second = scope.add(springValue(first, { stiffness: 260, damping: 24 }))
scope.use(() => bind(cursor, { x: first }))
scope.use(() => bind(trailingCursor, { x: second }))

set(pointer, 180)
set(pointer, -40) // preserves each follower's position and velocity
// On page/component disposal:
scope.dispose()
```

<Clip name="live-springs-ios" caption="Three native followers on an iOS simulator: target reversals, real touch drags, an additive shake and reduced motion. Real-time playback; this recording does not demonstrate physical-device 120 Hz performance." />

<Clip name="live-springs-android" caption="The same follower chain on an Android emulator, driven by real taps and swipes. The last follower also receives a shake layer; reduced motion moves the chain directly to its target." />

## Sources and bindings

The source can be a motion value, a numeric mapping, or another spring value. `animate(pointer, ...)` sends a sampled source track at playback boundaries, so the follower can also follow a native timeline. Numeric `to()` mappings, including descending ranges, repeated stops and extrapolation, execute natively for follower chains and bindings.

Bind the result to `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` or `opacity`. The stable baseline excludes paint and compound native adapters; the [RC.6 extension](#live-paint) adds background color and uniform radius. The spring value is read-only: update its source instead of passing the follower to `animate()` or `set()`.

Named transform and opacity layers still compose with the bound base:

```ts
bind(card, { x: first })
animate(card, { x: [0, -12, 12, 0] }, { layer: 'feedback', duration: 500 })
```

The native mixer adds translation/rotation layers and multiplies scale/opacity layers. Pausing or stopping a layer leaves the follower running. Replacing a live binding with a regular animation detaches it and commits its current base position; the follower keeps driving its other bindings.

## Configuration and lifetime

Options accept `stiffness`, `damping`, `mass`, or the existing `duration`/`bounce` spring parameterization. `initial` selects a starting position; otherwise the follower starts at its source's current value. `duration: 0` follows immediately. The global time scale is captured when the follower is created.

`restDelta` defaults to **0.001 source units** and `restSpeed` to **0.01 source units per second**. Both must be positive. A resting spring holds its target exactly and stops requesting frames when no other native follower or layer needs them. It wakes on the next target change. Rest is not disposal: the subscription remains owned by its scope until `dispose()`.

`get()` and `getVelocity()` read the native state. `moving` reports spring motion, independently of any layer. `subscribe()` explicitly opts into JavaScript observation; plain bindings and follower chains require no per-frame JS callbacks. Unloading a bound view removes its native binding, and loading it again uses the follower's current state.

`pause()` holds position and velocity; `play()` resumes toward the current target. A motion scope pauses retained springs during suspension and resumes them without creating new nodes. A manually paused spring remains paused across app background/resume. In Vue, use `useMotionScope().add(springValue(source, options))` with `useBinding()` to own the follower through cached-component activation and actual unmount.

Reduced motion updates the chain directly to its current target. App suspension holds spring state; resume follows the current source again. The live scheduler uses bounded substeps of at most 1/240 second and integrates at most 64 ms after a delayed frame, avoiding a large catch-up jump. Fixed-target `animate()` calls retain their existing Core Animation / Android playback paths.

The demo's touch events currently update the source from JavaScript. For native gesture input and scroll handoff, use the optional [gestures API](./gestures); `springValue()` does not make the gesture recognizer itself native. The C and Java spring kernels have matching trajectory tests, including 60/120 Hz time-step partitioning and delayed frames. Those tests do not replace performance measurements on physical devices.

## Live color and corners (RC.6) {#live-paint}

Since **0.1.0-rc.6**, native playback supports `backgroundColor` and uniform `borderRadius` bindings. Rebuild the app to include the new native code.

```ts
const target = motionValue(0)
const follower = springValue(target, { stiffness: 140, damping: 14 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderRadius: follower.to([0, 1], [8, 70]),
})
set(target, 1)
```

The retained native graph interpolates colors in premultiplied OKLab, including alpha, clips to sRGB and clamps color progress to its endpoints. Numeric mappings can precede the final color mapping. Radius is nonnegative; the renderer limits visible corners to the available box. Scalar retargeting retains the node and bindings, without a JavaScript observer or rebuilt track per frame.

The RC.6 baseline had these limits; the [extension below](#extended-live-paint) expands them. Use solid backgrounds without images/gradients. Radius requires uniform circular corners and compatible uniform borders, with no clip path, corner shape or CSS box shadow; use a separate shadow surface. Text color, border color/width and other decorations remain outside this live binding surface. An incompatible target is rejected before replacing its current binding.

A direct style write owns that paint channel and detaches its binding. Changes to background images, clipping or border structure release affected paint bindings. Other channels continue. Normal release preserves the current paint; a stale cleanup never restores over a newer style or animation. Pause, scope suspension, background handling, unload/reload and Reduce Motion use the existing spring lifecycle. Dispose the follower and release its bindings when the component ends.

<Clip name="live-paint-ios" caption="iOS simulator, English UI: real taps retarget color and corner radius, interrupt the spring and pause/resume it. Native playback; no physical-device performance claim." />
<Clip name="live-paint-android" caption="Android emulator, English UI: actual ADB taps retarget and pause the retained color/radius spring. Recorded at its original speed." />

[Native validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-capabilities.md).

## Extended retained paint (RC.9) {#extended-live-paint}

**0.1.0-rc.9** extends the RC.6 baseline above. Rebuild the native app: these bindings need updated native classes.

| Channel                                                                                            | Native live spring                                   | Web binding                   |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| `backgroundColor`, `borderColor`                                                                   | Solid background; uniform starting border color      | Supported                     |
| `color`                                                                                            | Plain Label/Button on iOS; plain TextBase on Android | CSS text color                |
| `borderWidth`, `borderRadius`                                                                      | Uniform DIP values                                   | CSS lengths                   |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`                       | Independent nonnegative DIP values                   | Independent CSS lengths       |
| `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius` | Independent circular DIP radii                       | Circular/elliptical CSS radii |

```ts
const progress = motionValue(0)
const follower = springValue(progress, { stiffness: 180, damping: 24 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderColor: follower.to([0, 1], ['#17332B', '#993C56']),
  color: follower.to([0, 1], ['#17332B', '#6B203F']),
  borderTopLeftRadius: follower.to([0, 1], [8, 64]),
  borderBottomRightRadius: follower.to([0, 1], [8, 64]),
  borderTopWidth: follower.to([0, 1], [3, 12]),
  scale: follower.to([0, 1], [1, 1.1]),
})
set(progress, 1)
// Component teardown: release(); follower.dispose()
```

Native side/corner keys in this extension accept mappings from `springValue()`; this does not extend finite native `animate()` to individual sides/corners. Widths change paint without animating the content inset. Paint still runs on the native UI thread; there is no application JavaScript frame loop and no claim of independence from a busy UI thread.

Use solid backgrounds and circular corners. Images/gradients, clip paths, squircle corners and formatted text are rejected; live geometry requires a separate CSS shadow surface. Existing iOS/Android target differences remain explicit. Invalid batches reject before replacing valid owners.

Choose a shorthand or its individual sides/corners within one `bind()` call. A later shorthand takes over its family; a later individual channel releases an existing shorthand, preserving its other edges at their current values. Independent edge bindings coexist. Direct style writes take over their own channel. Other border writes now resynchronize retained paint after Core replaces its drawable/layer, preserving background, radius and scale. Old cleanup cannot overwrite a newer binding. Pause, suspension, unload/reload and reduced motion retain the same lifecycle.

<Clip name="live-paint-extended-ios" caption="iPhone 17 Pro simulator, iOS 26.2, English UI: actual XCTest taps retarget background, text and border colors, independent corners and widths, and scale; interrupt and pause/resume the retained spring. Original speed, not a physical-device performance measurement." />
<Clip name="live-paint-extended-android" caption="Android 16 emulator, English UI: actual ADB taps perform the same independent paint changes, interruption and pause/resume. Native playback at original speed; no physical-device claim." />

[Validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/live-paint-346.md).
