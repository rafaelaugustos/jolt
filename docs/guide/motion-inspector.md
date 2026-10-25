# Inspect motion on a running device

Select a view, see which animation owns its properties, and compare the expected curve with native observations. Experiment **59 — Motion inspector** also tunes a spring, replays it and copies the TypeScript needed to reproduce it.

::: warning Development only
Available since **0.1.0-beta.18** in the core package. Rebuild the native app for the probe. Keep the inspector import inside a development entry that your production build excludes.
:::

<Clip name="motion-inspector-ios" caption="iOS simulator with actual XCTest taps: inspect an interruption, tune and replay a spring, hold its playback, inspect delayed/layered/bound motion and copy TypeScript. Lime is the engine model; pink is the sampled CALayer presentation. Original capture timing, not a physical-display performance measurement." />

<Clip name="motion-inspector-android" caption="Android emulator with actual ADB taps: the same inspector reads native View properties in a bounded buffer. These are UI-thread observations, not GPU presentation timestamps or physical-device FPS. Original playback speed." />

## Start only in development

```ts
// dev/motion-tools.ts — exclude this entry from the production build
import { createMotionInspector } from '@rafaelaugusto/jolt/inspector'

const inspector = createMotionInspector({
  development: true,
  capacity: 240,
  hertz: 60,
})
const unwatch = inspector.watch(card, 'card')
inspector.select('card', 'x')

const animation = animate(card, { x: 220 }, 'bouncy')
inspector.label(animation, 'Entrance')

// One batch, normally read by a development panel every 200–250 ms.
const state = inspector.read()
// state.properties: owner, label, layer, target, value, velocity, delay, elapsed, duration
// state.bindings: motion-value root, mapping ranges, live-follower input
// state.events: starts, replacements, stops, completion, pause/play/seek
// state.samples: time, expected, observed, source

unwatch()
inspector.dispose()
```

Reading and selecting do not seek, restart, subscribe to a motion value, or take ownership of animation properties. Label the original `animate(view, ...)` handle; a group handle is not the owner of each child property. Named layers appear as separate owners even when the driver plays one composite track. Driver events for that composite have their own identity.

Watch and select before reproducing a bug to capture its boundaries. Selecting an existing animation provides its current state but cannot recover past events. Bindings expose their existing root and numeric mapping chain; live spring follower inputs are expanded up to eight levels. Color mapping internals and arbitrary external dependencies are not reconstructed.

## Tune, copy and hold

```ts
import { inspectorSpring, springCode } from '@rafaelaugusto/jolt/inspector'

const spring = { duration: 650, bounce: 0.35 }
const options = inspectorSpring(spring)
// Physics is also accepted: { stiffness: 180, damping: 22, mass: 1 }
const code = springCode({ target: 'card', to: 220, spring })
```

The demo changes duration/bounce only when **Replay** is pressed. **Copy TypeScript** copies an explicit `[0, target]` spring with zero initial velocity, so a fresh view reproduces the same motion after a restart. The preview saves those knobs when copying. An interrupted return is a separate action and intentionally preserves incoming velocity.

`inspector.control(animation, 'seek', 0.25)` explicitly pauses and seeks a finite playback handle. Use `'play'` to continue, or `'pause'` to hold its current point. This is an edit command, separate from inspection. Endless animations cannot be scrubbed; the current `timeline()` API does not expose an arbitrary whole-timeline seek. Delayed sequences can be inspected while their actual participants activate.

## Know what was measured

- **iOS:** the native probe reads the presentation layer. If it is absent, `observed` is `null`; the model layer is never substituted.
- **Android:** the probe reads native View properties on the UI thread. These values are not proof of GPU scan-out, and callback order can put a read one frame behind an animator.
- Native sampling supports `x`, `y`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` and `opacity`. Other properties retain engine diagnostics with explicit native sampling unavailability. Translation uses DIP, rotations degrees, scale/opacity unitless values.
- `expected` is the curve handed to the native driver, anchored to its reported clock. It is a model, not a second screen measurement. Live-native followers and composites that started before selection can lack a reconstructible curve; their expected samples are `null`. Direct app writes and third-party animators are outside the event recorder's coverage.
- Native and JavaScript histories are bounded: capacity 8–600, default 240, at most 32 registered views and one inspector session. Collection is native; JavaScript drains batches. Requested hertz is an upper bound, not a refresh-rate guarantee. Dropped old samples are counted. Plot gaps stay gaps.

Unloading the selected view or backgrounding stops native collection. Select the view again to resume after returning. Unwatching releases its listeners; disposing restores the previous driver and stops the probe without stopping the application's animations. Use disposal when a development page or hot-reload session ends.

The production core entry imports neither inspector hooks nor its UI; a bundle check verifies they are removed. Native probe classes ship with the core binary but are dormant until explicitly started. `development: true` is an explicit opt-in, not automatic detection of a release build.

`state.overhead` reports accumulated JavaScript read/hook cost, native sampling/serialization cost, sample count and buffer drops. Native drain cost is reported one batch later. The measurements exclude panel rendering and are local observations; the benchmark also compares preparation with and without inspection. See [validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-inspector.md).
