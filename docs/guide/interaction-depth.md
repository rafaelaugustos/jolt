# Drop, cues and depth

This RC.12 candidate adds six connected capabilities on native and Web. It is **not in RC.11.1**. The examples use explicit owners; dispose the scope on unmount. Browser imports remain optional and SSR-safe; create runtimes and resolve targets only after mounting.

The old Android is used for compatibility only. Further physical performance acceptance is deferred until a newer phone is available, at the maintainer’s request; these recordings and exploratory measurements do not establish a CPU/PSS advantage.

## Drop zones

Native `dropZones(view, options)` and Web `runtime.dropZones(element, options)` build on Jolt drag. Both scopes expose `dropZones`. This is an in-app target coordinator, not OS drag-and-drop or file import.

```ts
const drop = scope.dropZones(card, {
  targets: [
    { id: 'basket', target: basket, priority: 1, accept: () => canAccept() },
    { id: 'blocked', target: blocked, accept: () => false },
  ],
  drag: { snap: [0] },
  onDrop: () => scope.animate(card, { scale: [1, 0.7, 1] }, { duration: 700 }),
})
// Connect the same action to an accessible application button.
const acceptFromButton = () => drop.request('basket')
```

The default hit test uses the source's center against current axis-aligned target bounds; `hitTest: 'overlap'` requires positive overlap. Higher priority wins, then declaration order. The winning target may reject; this does not fall through to a lower target. Acceptance is synchronous and rechecked at release. `request(id)` skips geometry but still checks mounted/enabled targets and acceptance. It does not move the card into a container or modify application data.

The accepted effect is owned until completion, cancellation, regrab, pause, target removal or disposal. Rejection keeps the drag return animation. `refresh()` rechecks application layout changes. Native coordinates are DIPs in the same window; Web uses CSS viewport pixels in one document. Bounds are rectangles, not pixel/occlusion tests. Existing drag constraints still apply under transformed parents. Scrolling containers must cooperate with the drag gesture; the demo disables its surrounding ScrollView while dragging. Keep keyboard/focus/announcements in application controls.

<Clip :autoplay="false" name="interaction-drop-ios" caption="iOS 26.2 simulator: real XCTest drag rejection, acceptance, button alternative and pause." />
<Clip :autoplay="false" name="interaction-drop-android" caption="Physical ASUS ZenFone 3, Android 8: real ADB swipes, rejection, acceptance and scoped remount." />
<Clip :autoplay="false" name="interaction-drop-web" caption="Chromium: real mouse input and keyboard acceptance. No OS file drag is involved." />

## Optional one-shot audio and timeline cues

```ts
// Native: import { audioCue } from '@rafaelaugusto/jolt/audio'
// Web:
import { audioCue } from '@rafaelaugusto/jolt/web/audio'
const sound = scope.add(
  audioCue(document, '/sounds/impact.wav', {
    volume: 0.6,
    onError: reportAudioError,
  }),
)
await sound.ready
// Invoke from a user-initiated action after preload.
const motion = scope.animate(card, { x: [0, 100, 0] }, { duration: 1500 })
const timeline = scope.withTimelineCues(motion, [
  { name: 'impact', at: 300, effect: () => sound.play() },
])
```

Native uses `scope.resource(() => audioCue('~/assets/impact.wav'))` and `scope.add(withTimelineCues(motion, cues))`. Native sources are bundled/absolute local files; Web sources are same-origin HTTP(S) assets or blob URLs. Preload resolves `ready: false` on failure. Playback failures resolve the voice's `finished` to `false`, report `onError`, and leave visual completion independent. Browser autoplay policy can reject audio; use a user gesture and handle failure.

One cue owns one voice. A new `sound.play()` replaces it; `voice.play()` resumes an unfinished voice and never replays a completed one. Pause preserves time; stop cancels and rewinds. Mute changes volume without stopping the audio clock. Background/visibility suspends audio; a manually paused voice stays paused on return. Disposal releases player, listeners and pending work. Native playback uses AVAudioPlayer/MediaPlayer; the browser uses HTMLAudioElement. There is no Jolt audio frame loop.

A timeline seek cancels active cue effects without firing cues at the destination; future crossings can fire again. Audio has **fixed rate 1 and no seek/progress API**. Visual time scale changes move future cue boundaries but never stretch an already-playing clip. Reduce Motion suppresses timeline cues, including audio, while direct `sound.play()` remains an explicit application action. Boundaries use timers and cannot promise sample-accurate synchronization.

The default iOS ambient policy respects the system silent policy and mixes with other audio. An existing non-ambient session requires `iosSession: 'application'`; Jolt does not override that owner. Ambient leases restore the prior configuration only if it is still theirs. iOS interruptions stop the voice. Android uses sonification audio attributes and application background suspension; it does not acquire audio focus or implement an application-wide interruption policy. Streaming, recording, loops and mixing are outside this module. See [Apple ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient), [Android MediaPlayer](https://developer.android.com/reference/android/media/MediaPlayer), and [browser play restrictions](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).

<Clip :autoplay="false" name="interaction-audio-ios" caption="iOS 26.2 simulator: real native timeline, pause, silent seek, mute and remount. Screen capture contains no audio; native completion is checked separately. Physical silent-switch behavior is unverified." />
<Clip :autoplay="false" name="interaction-audio-android" caption="Physical ASUS ZenFone 3, Android 8: timeline markers, pause, seek, mute and replay with native audio completion checks. Android screenrecord captures no sound." />
<Clip :autoplay="false" name="interaction-audio-web" caption="Chromium: local audio cue lifecycle and visual markers through real button interaction. This browser screen recording contains no audio." />

## Inspector and semantic replay

Native `@rafaelaugusto/jolt/inspector` gains `inspector.adapters`; the optional `@rafaelaugusto/jolt/web/inspector` entry provides the Web equivalent. Both require `development: true`. Inspection is pull-only, bounded and does not enable rendering or start a sampling timer.

```ts
import { createMotionInspector, springCode } from '@rafaelaugusto/jolt/web/inspector'
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 64,
})
scope.add(() => inspector.dispose())
inspector.adapters.watch(materialProperty, 'material')
inspector.adapters.activity(renderActivity, 'scene')
inspector.adapters.label(playback, 'hover')
inspector.track(playback, 'transition')
inspector.control('transition', 'pause')
inspector.control('transition', 'seek', 0.5)
const snapshot = inspector.read()
const code = springCode({ to: 100, spring: { duration: 500, bounce: 0.2 } })
```

Register existing properties and playback handles. `watch(element, id)` includes computed Web transform/opacity. `tune(settings, apply)` validates settings and calls the application's replacement callback; it does not create a competing owner. Pass an existing `diagnostics` collector to borrow it without disposing it. Detached/destroyed targets disappear on inspection; use non-personal IDs, at most 128 explicit resources and 8–2,000 history events.

Adapter events identify start, replacement, binding, pause/play, seek, cancellation, completion and disposal. Values come from the adapter's read function: they are not automatically presentation/GPU samples. Timings measure **JS preparation and observed JS writes/reads**. Native sampling, GPU time and total allocated bytes are explicitly unavailable. Native animation bridge setup and asynchronous renderer work must not be inferred from `updateMs`. Web custom adapters still execute in JS; ordinary WAAPI motion retains its existing backend. See the [repeatable inspection audit](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-depth.md) for the physical-device workload and limits.

`@rafaelaugusto/jolt/web/testing` shares the version-1 bounded trace format and `recordInteraction`, `parseTrace`, `serializeTrace`, `replayInteraction`. Recording is explicit; there is no global interception or private user content. Supply a replay adapter implementing `create`, `advanceTo`, semantic input, read and dispose. Supported operations belong to that adapter: reject others explicitly. The regression fixture supports one-pointer horizontal drag and public spring seeking, replays a large time jump twice and checks identical endpoints/zero remaining resources. This is not automatic OS gesture injection, sensor emulation or deterministic GPU rendering. Trace limits are 5,000 events, 300 seconds and 2 MB.

Native inspection should be retained with `scope.resource(() => inspector)`. Web `scope.add` disposes non-playable tools on scope suspension; use `scope.use` to recreate them on resume, and keep the latest collector reference. The same rule applies to Web audio resources when explicitly suspending the scope; document visibility handling by the cue is separate.

<Clip :autoplay="false" name="interaction-inspector-ios" caption="iOS 26.2 simulator: three real SceneKit uniforms plus three native drawing properties. Replace changes the owner; inspection and renderer demand are explicit." />
<Clip :autoplay="false" name="interaction-inspector-android" caption="Physical ASUS ZenFone 3, Android 8: three native drawing-property adapters, ownership replacement, inspection and remount. This Android fixture has no shader adapter." />
<Clip :autoplay="false" name="interaction-inspector-web" caption="Chromium with software WebGL: three real material uniforms, replacement and pull-only inspection. This demonstrates behavior, not GPU performance." />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium: real button input pauses and seeks application-owned playback, edits spring settings and shows copyable code. An explicit numeric target-change trace replays twice with endpoint assertions and zero remaining replay resources; this is not OS input capture." />
<Clip :autoplay="false" name="motion-inspector-ios" caption="iOS simulator, existing native inspector: real XCTest taps inspect interruption, tune a spring, hold playback and copy TypeScript. Reused native counterpart recording; not a physical-device performance measurement." />
<Clip :autoplay="false" name="interaction-replay-ios" caption="iOS simulator, existing native replay: real XCTest taps and drag record and replay spring/drag takes and detect a deliberately wrong checkpoint. Reused native counterpart; replay uses logical time." />

## Paths and tangent orientation

```ts
scope.animate(
  card,
  {
    path: 'M0 0 C40 -150 160 90 190 -80',
    orient: true,
  },
  { duration: 2600, ease: 'linear' },
)
```

Native and Web use shared parsed geometry and a coordinated progress track. Translation uses DIPs/native or CSS pixels/Web; orientation uses degrees. Pause, seek, repeats, reverse, repeat holds, reduced motion and replacement use normal playback controls. Paths also work in Web sequences and seekable scenes. A relative initial `m` offsets from the current pose; an absolute `M` deliberately selects its authored origin. Do not combine a path with explicit x/y or tangent orientation with explicit rotate. Replacing a path with an ordinary spring carries sampled position/velocity; an authored discontinuous path does not promise continuous tangents or velocity.

<Clip :autoplay="false" name="interaction-path-ios" caption="iOS 26.2 simulator: cubic path with tangent orientation, pause, seek and replacement." />
<Clip :autoplay="false" name="interaction-path-android" caption="Physical ASUS ZenFone 3, Android 8: the same native path contract with real playback controls." />
<Clip :autoplay="false" name="interaction-path-web" caption="Chromium: the shared path definition drives translation and orientation with one timeline." />

## Rotation in three axes

Web now accepts `rotateX` and `rotateY` in degrees. Compose order is authored 2D baseline, translation, rotateZ, rotateY, rotateX, scale. Set CSS `perspective` on an application-owned parent when projection is wanted. Jolt does not accept a projective authored target transform or claim 3D layout/FLIP support. Keep perspective separate from the animated child. Native rotateX/Y preserve their existing platform contract and do not promise identical projection pixels.

```ts
// Web: configure the parent once, outside Jolt ownership.
container.style.perspective = '700px'
scope.animate(
  card,
  { rotateX: 55, rotateY: -40, rotate: 12, scale: 1.15 },
  { duration: 2400 },
)
```

<Clip :autoplay="false" name="interaction-depth-ios" caption="iOS 26.2 simulator: native axis rotation, seek and replacement." />
<Clip :autoplay="false" name="interaction-depth-android" caption="Physical ASUS ZenFone 3, Android 8: native axis rotation and scoped remount." />
<Clip :autoplay="false" name="interaction-depth-web" caption="Chromium: rotateX/Y/Z with explicit parent CSS perspective, paused seeking and replacement." />

## Shadow and depth channels

Web supports `shadowOpacity`, `shadowRadius`, signed `shadowOffsetX/Y` and Web-only `shadowColor`. It owns one outer, zero-spread `box-shadow`; inset, multiple shadows and nonzero spread fail before replacing existing motion. Start from `none` or a supported computed shadow. Colors use the existing color interpolation; color alpha multiplies shadow opacity.

`shadowRadius` is half CSS blur distance, matching the numeric convention of the existing iOS radius. Web uses CSS pixels; native uses DIPs. Radius is nonnegative and opacity is clamped to 0–1 in Web playback; native explicit-invalid-value validation remains unchanged. Partial channel replacement preserves sibling channels. Release restores the initial inline shadow unless application code changed it. External style changes during owned motion remain ownership conflicts: release before taking over.

Android `elevation`/`translationZ` affect native lighting/order and remain unsupported Web keyframes. They are not aliases for CSS shadows or translateZ. Native iOS shadow channels remain unchanged. No identical-pixel or lower-paint-cost claim follows from API similarity.

<Clip :autoplay="false" name="interaction-shadow-ios" caption="iOS 26.2 simulator: native shadow radius, opacity and offsets with rounded corners." />
<Clip :autoplay="false" name="interaction-shadow-android" caption="Physical ASUS ZenFone 3, Android 8: native elevation/translationZ, not CSS shadow emulation." />
<Clip :autoplay="false" name="interaction-shadow-web" caption="Chromium: one outer CSS shadow, signed offsets, color and radius channels, replacement and remount." />

<Clip :autoplay="false" name="interaction-audio-lifecycle-ios" caption="iOS 26.2 simulator: manual pause survives background/foreground; repeated remount cancels old resources. Real XCTest interaction; screen capture contains no audio." />
<Clip :autoplay="false" name="interaction-inspector-lifecycle-ios" caption="iOS 26.2 simulator: manual pause survives background/foreground; repeated remount cancels old resources. Real XCTest interaction; screen capture contains no audio." />
