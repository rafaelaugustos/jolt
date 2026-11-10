# Portable inspection and sensor replay

Available in **0.1.0-rc.13 (Beta)**: bounded inspector plots of expected/observed values and canonical synthetic sensor replay through the optional Web inspector/testing entries. Native equivalents already exist; replay does not establish physical sensor availability.

```ts
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 128,
})
const unwatch = inspector.watch(card, 'card')
inspector.sample('card', 'x', 80, 'replace')
const svg = inspector.plot('card', 'x')
// Application teardown:
unwatch()
inspector.dispose()
```

Sampling is explicit and pull-only: x/y are CSS transform translation in pixels; opacity is unitless. The caller supplies the expected value and optional semantic event. Observations come from computed style, not the GPU or a physical sensor. Detached or unsupported/projective transforms produce null gaps. Capacity bounds the shared history (default 256); exported plots accept at most 4096 ordered samples. Known event markers are start, replace, pause, play, stop, complete and seek.

Watch mounted elements under unique non-personal IDs. Release a watch before reusing its ID; a new watch starts a fresh history. Disposing the inspector clears its observations and owned diagnostics, leaving application targets/playback alive. Borrowed diagnostics remain the caller’s responsibility. There is no automatic polling, recording of user content or performance claim.

```ts
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'
const source = runtime.sensor('gravity', { reducedMotion: 'continue' })
const unsubscribe = source.x.subscribe((value) => console.log(value))
const replay = replaySensor(
  source,
  [
    { time: 0, values: [0, -9.81, 0], orientation: 0 },
    { time: 100, values: [1, -9.76, 0], orientation: 0 },
  ],
  { manual: true },
)
replay.advanceTo(0)
replay.advanceTo(100)
await replay.finished
unsubscribe()
source.dispose()
```

Samples are explicitly synthetic: 2–10000 copied entries, strictly increasing relative milliseconds from 0 to 60000. Vectors use device-coordinate xyz with canonical m/s², rad/s or µT units; rotation uses a normalized quaternion xyzw. Optional orientation is 0/90/180/270 degrees. Existing interface mapping and recentering apply. No intermediate hardware samples are invented.

Replay detaches only its own sensor from device events. It pauses with missing demand, source pause, background/visibility or Reduced Motion; manual mode requires advanceTo within its duration. The handle also offers pause/play/stop/dispose and finished (true for completion, false for cancellation). Invalid input leaves a previous replay intact. Source disposal cancels replay. On completion or stop, ordinary permission/demand-based acquisition resumes.

snapshot().sampleSource distinguishes replay, device-event and none, including retained last values. Replay never grants permission and available stays false for synthetic input. Browser API presence, emulator events and replay do not prove physical sensor delivery; #385 remains open. Test code must own its subscriptions, mapped values, bindings and source, and dispose them through its scope or explicit cleanup.

<Clip name="web-tools" caption="Chromium on macOS: synthetic sensor samples move a real DOM element; pause/resume, explicit CSS observations and replacement markers are exercised. The plot labels its observation source; no physical sensor or GPU measurement." />

<Clip name="interaction-inspector-ios" caption="Existing native inspector on an iOS simulator: real interaction with playback controls and observations. Native and browser observation sources remain distinct." />

<Clip name="composition-sensors-ios" caption="Existing native sensor demo on an iOS simulator. This is lifecycle and mapping evidence, not a physical-device reading or a new hardware benchmark." />
