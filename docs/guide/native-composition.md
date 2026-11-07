# Native scenes and resource ownership

The next-version [portable composition candidate](./portable-composition) adds feasible Web equivalents while preserving these published native contracts. These additions are not included in RC.12.

Available in `0.1.0-rc.11.1`. Install the matching package version and rebuild native applications; Android gradient text requires the new compiled helper.

These APIs compose native iOS and Android motion: retained drawings, behavior priorities, articulated parts, gradient text and named timeline effects. They are native entry points; no equivalent Web contract is introduced here. Application rules, assets and SDK targets remain application-owned. See [scopes and visual states](./motion-controllers) for the existing foundations.

## Retain the resource, pause its motion {#resources}

`scope.resource(factory)` constructs and retains a resource; `scope.retain(resource)` adopts an existing one. Both keep ownership until `release(resource)`, `reset()` or `dispose()`, even when playback finishes. They accept cleanup functions and objects with `dispose()` or `stop()`. Ownership cannot be shared between scopes. Repeated retention of the same object is idempotent; calling the factory again creates another resource.

| Resource                        | Suspension                                                             | Final disposal                                       |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Retained shape or gradient text | Keeps the drawing; pauses active motion                                | Removes native paint and listeners                   |
| Retained playable controller    | Calls `pause()`; resumes only motion paused by the scope               | Calls `dispose()` or `stop()`                        |
| Retained native property        | Retains the property target; does not pause unowned animation/bindings | Disposes the adapter, not the application SDK target |
| `scope.add(animation)`          | Pauses playable work; automatically forgets completed handles          | Stops remaining work                                 |
| `scope.use(factory)`            | Removes the subscription and recreates it on resume                    | Removes the subscription                             |

Retention prefers `suspend()/resume()` when the resource exposes that pair, otherwise `pause()/play()`. A static resource without either pair remains retained. Manual pause survives app background/foreground. Existing `add()` and `use()` semantics remain unchanged; retaining an object already adopted with a different lifetime throws.

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/vue'

const drawing = useShape({
  d: 'M10 50 L50 10 L90 50',
  viewBox: [0, 0, 100, 100],
  stroke: '#8B5CF6',
  strokeWidth: 3,
})
function replay() {
  drawing.current?.animate({ strokeEnd: [0, 1] }, { duration: 900 })
}
</script>

<template>
  <GridLayout :ref="drawing.ref" width="160" height="160" @tap="replay" />
</template>
```

`useShape()` owns its callback ref through actual Vue unmount. Repeated refs do not create duplicates; replacing a target releases the previous drawing. KeepAlive deactivation suspends playback. It defaults to `unload: 'pause'`; imperative `shape()` keeps its existing `unload: 'stop'` default unless explicitly changed. A retained drawing can stay visible while paused.

For native properties, retain the adapter, adopt its playback, and register bindings separately. For example, with an initialized SceneKit shader uniform (iOS only):

```ts
import { motionScope } from '@rafaelaugusto/jolt'
import { sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const focus = scope.resource(() =>
  sceneKitUniform(material, 'focus', {
    type: 'float',
    range: [0, 1],
    units: ['fraction'],
    motion: 'appearance',
  }),
)
scope.add(focus.animate(1, { duration: 800 }))
// For a binding instead: scope.use(() => focus.bind(applicationOwnedValue, p => p))
// Dispose the scope before destroying the application's native target.
```

<Clip name="native-resources-ios" caption="iOS 26.2 simulator: pause and resume, Vue KeepAlive caching, then actual unmount and remount. The created/disposed counters distinguish resource lifetime from playback." />
<Clip name="native-resources-android" caption="Physical ASUS ZenFone 3, Android 8: the same retained drawing stays unchanged while paused, survives caching and is disposed on actual unmount. Real ADB taps; recording is not a performance measurement." />

## Priorities and interruption {#behaviors}

`motionBehaviors()` coordinates one exclusive lane. Higher priority interrupts; equal priority rejects unless the incoming behavior declares `equal: 'replace'`. `blocks` excludes named requests regardless of priority, and `when` checks application conditions before changing ownership. Separate coordinators remain independent.

```ts
import { motionBehaviors } from '@rafaelaugusto/jolt'

const behavior = motionBehaviors(
  {
    rest: {
      priority: -1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 0, rotate: 0 }, 'smooth'))
      },
    },
    touch: {
      priority: 1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: -15 }, { duration: 900 }))
      },
    },
    dress: {
      priority: 2,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 60 }, { duration: 900 }))
      },
    },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: 15 }, { duration: 900 }))
      },
    },
  },
  { rest: 'rest' },
)

const run = behavior.request('touch')
behavior.request('dress')
const result = await run.finished // { status: 'interrupted' }
```

Each run owns a private scope. Interruption disposes that scope before starting the replacement, so native transitions begin at current presentation. `wait()` checks run identity after awaiting and holds continuation during manual pause/background. Use it for every awaited step; use `checkpoint()` after an external await and `guard(callback)` for late callbacks. These helpers cannot undo arbitrary application mutations or abort an external service request.

Results are `completed`, `interrupted`, `cancelled`, `failed` or `blocked`. `cancel()` restores the declared rest behavior; `stop()` cancels without restoration, and `dispose()` prevents future work. Rest restarts after completion/cancellation/failure; interrupted actions are not implicitly resumed. `pause()/play()` pause the lane. Guards may throw synchronously; run failures go to the result and optional `onError`. Retain the controller in a scope to bind it to a component lifetime.

<Clip name="native-behaviors-ios" caption="iOS simulator: dress interrupts touch, eat blocks dress, and completion returns to rest. The same lane animates a character and a normal UI confirmation." />
<Clip name="native-behaviors-android" caption="Physical Android: real taps interrupt and block actions according to priority, then restore rest. Native playback; no app-specific behavior names are built into Jolt." />

## Articulated parts and sockets {#rig}

Import `rig2d` from the optional `/rig` entry. The application supplies native views in the declared direct parent/child hierarchy; Jolt does not reparent them. Definitions contain parts, poses and sockets, without assets or framework refs. Up to 64 parts are accepted; that validation cap is not a device performance guarantee.

```ts
import { rig2d } from '@rafaelaugusto/jolt/rig'

const rig = rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: { parent: 'body', pivot: { x: 0.5, y: 0.1 }, rotation: [-70, 70] },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { body: { rotate: 12 }, hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
rig.accessory('grip', flower)
rig.to('wave', 'smooth')
rig.blend([
  { pose: 'wave', weight: 0.3 },
  { pose: 'reach', weight: 0.7 },
])
```

Transforms are `x`, `y` in DIPs, `rotate` in degrees, and `scaleX/scaleY` as multipliers. Pivots are fractions of native part size. Sockets use local DIPs by default, or fractions with `units: 'relative'`; an accessory must be a direct child of its socket part. Native parent transforms move the accessory without a JavaScript frame observer. `point(name)` samples in the root part's parent's coordinates and requires laid-out ancestry; it is not a live binding. Only 2D transforms are modeled, not perspective, skew, mesh deformation or IK.

Blend weights are nonnegative offsets from each channel's rest value. Missing channels use rest; totals above one normalize per channel. Unbounded rotations use the shortest angular offset; bounded rotations clamp every sampled value, including spring overshoot. Only channels declared in rest/poses are owned. New blends start at current presentation. `attach()` validates ownership/hierarchy before replacing parts; `accessory(name, null)` detaches an accessory. Disposal restores transforms still owned by the rig without cancelling newer external owners. `pause()/play()/stop()/dispose()` control lifetime; resume before requesting a pose after manual pause.

<Clip name="native-rig-ios" caption="iOS simulator: three poses, interrupted blending, a flower attached to the hand, and a rotation limit. A desk lamp uses the same articulated-parts API." />
<Clip name="native-rig-android" caption="Physical Android: native parent transforms carry the flower through rapid pose changes; the reach pose stops at its declared rotation limit. No per-frame JavaScript socket updates." />

## Gradient glyphs and moving light {#text}

`gradientText(label, options)` keeps the original native Label and its accessible text. Decorative paint adds no second text node or input target. It accepts 2–8 colors, ordered stops in 0–1, a clockwise gradient angle, and a sheen color/width. Width is a fraction in (0, 1]. `sheen.direction` is `right` by default; use `left` for a right-to-left pass. Rebuild Android after adding the native helper; updating JavaScript alone is insufficient.

```ts
import { gradientText, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const title = scope.resource(() =>
  gradientText(label, {
    colors: ['#7C3AED', '#DB2777', '#F59E0B'],
    angle: 0,
    sheen: { color: '#FFFFFFFF', width: 0.35 },
  }),
)
const light = title.play({ duration: 1800, ease: 'easeInOut' })
light.pause()
light.play()
```

`play()` returns a seekable native playback handle; transition repeats/reverse control repeated passes. `stop()` removes the moving light and preserves the static gradient. `suspend()/resume()` preserve active playback, and `dispose()` removes paint and restores the original text color unless replaced by the application. Reduced motion suppresses moving light while retaining readable fill.

Text, font, layout and alignment changes invalidate cached glyphs. Multiline and RTL shaping follow the native Label; emoji become gradient silhouettes rather than preserving their original colors. Formatted spans are unsupported: initial `formattedText` rejects; changing to it releases the effect's paint. `refresh()` requests invalidation after an external native style change. The mask budget is 4,194,304 pixels: Android uses an alpha bitmap; iOS caps raster scale and rejects impractically large surfaces. `snapshot().maskBytes` describes the glyph mask estimate, not total GPU memory or process PSS. Idle layout checks reuse unchanged masks; moving light does not regenerate glyphs each frame.

<Clip name="native-text-ios" caption="iOS simulator: gradient-filled glyphs, a moving highlight, live Latin/Arabic text replacement, pause/resume and reduced motion. The original Label remains the accessible text." />
<Clip name="native-text-android" caption="Physical Android 8: the highlight is clipped to native glyphs and pauses in place; reduced motion keeps the static fill. This is the glyph effect, separate from placeholder shimmer." />

## Named effects on a timeline {#cues}

`withTimelineCues(playback, cues, options)` wraps an existing Jolt clock. Each unique cue has a name, a logical millisecond position and an effect callback returning an owned handle or cleanup function. Place multiple effects at the same time to preserve declaration order. Audio can return an application adapter's stop/dispose handle; Jolt does not add an audio engine here.

```ts
import { animate, motionScope, withTimelineCues } from '@rafaelaugusto/jolt'

const scope = motionScope()
const scene = scope.add(
  withTimelineCues(
    animate(ball, { x: [-100, 100] }, { duration: 2400, ease: 'linear' }),
    [
      {
        name: 'impact',
        at: 1200,
        effect: () =>
          animate(
            star,
            { scale: [0.2, 1.6], opacity: [1, 0] },
            { duration: 650, haptic: { style: 'light', times: [0.001] } },
          ),
      },
    ],
  ),
)
scene.pause()
scene.play()
scene.dispose()
```

Cue callbacks execute in JavaScript at boundaries, using the native playback clock; there is no per-frame polling. They cannot execute during a blocked JavaScript runtime. The default `late: 'skip'` drops events more than 50 logical milliseconds late; choose `tolerance` or explicit `late: 'catch-up'` deliberately. `lateBy` reports clock-relative delivery lateness, not display, audio or haptic onset latency. `configure({ timeScale })` scales markers with the visual clock. Reduced motion suppresses cues.

Pause holds markers and active playable effects, including effect tails after visual completion. Stop/dispose cancels visuals, pending markers and effects together. Completion waits for finite returned effect promises; adapters must settle their promise when stopped. Scrubbing fires no crossed markers, cancels active effects and rearms future markers on backward seeks. Optional `repeat: { every, count, reverse }` declares finite passes explicitly; visual track repeats are not inferred. Limits: 1,024 named cues, 1,024 passes per cue and 4,096 total occurrences. Effects errors go to optional `onError` without aborting visual playback.

<Clip name="native-cues-ios" caption="iOS simulator: cancel before impact, replay the named particle/highlight cue, then pause and resume before it. A simulator does not demonstrate physical haptic output." />
<Clip name="native-cues-android" caption="Physical Android: cancellation prevents the pending impact, and pause/resume keeps effects tied to the visual clock. Haptic calls are exercised, but vibration cannot be conveyed or timed by this video." />

## Validation and limits {#validation}

The recordings show actual native interaction on an ASUS ZenFone 3 (Android 8) and an iPhone 17 Pro simulator (iOS 26.2). They are functional evidence, not a CPU/PSS comparison. See the [native composition validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-composition.md) for reproduction, repeated lifecycle checks and clock measurements. Native execution does not remove NativeScript's main-thread contention; these APIs do not introduce a general RenderThread backend.
