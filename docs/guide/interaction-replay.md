# Record and replay an interaction

Keep the inputs that reproduced a bug, freeze their expected motion, and replay them against the next build. The optional **@rafaelaugusto/jolt/testing** entry provides a versioned numeric trace, an opt-in recorder and an adapter-based runner. **@rafaelaugusto/jolt/testing/native** adds a controlled Jolt driver, Core pan capture and native presentation reads.

::: warning Development preview
This checkout prepares the initial replay tools for beta.18; published beta.17 does not contain these entries. Use them in an isolated development fixture. They are not production telemetry and do not install observers merely by being imported.
:::

<Clip name="interaction-replay-ios" caption="iOS simulator, real XCTest taps and drag: accept a spring take, replay it, detect a deliberately wrong checkpoint, then cancel and replay a drag. Replay uses recorded logical time; its wall-clock duration is not a performance measurement." />

<Clip name="interaction-replay-android" caption="Android emulator with real ADB taps and swipe. The app cancels the drag while contact continues. The saved trace is checked first in the engine and then against native view positions. Original recording speed." />

## Record only the inputs you choose

```ts
import { recordInteraction } from '@rafaelaugusto/jolt/testing'
import {
  observeTraceInputs,
  traceMetadata,
  traceNow,
  traceSettings,
} from '@rafaelaugusto/jolt/testing/native'

const take = recordInteraction({
  now: traceNow,
  seed: 63,
  metadata: traceMetadata(),
  settings: traceSettings(),
  motions: [
    {
      id: 'card',
      kind: 'spring',
      axis: 'x',
      initial: 0,
      stiffness: 170,
      damping: 26,
      mass: 1,
      min: 0,
      max: 240,
      snap: [],
    },
  ],
})

take.input({ type: 'target', id: 'card', value: 180 })
// Apply the same target to your graph. Sample at its controlled clock boundary:
take.checkpoint('card', { position: 0, velocity: 0, settled: false })

// Optional environment capture. These events need an application replay adapter.
const detach = observeTraceInputs(cardView, 'card', take, {
  layout: true,
  keyboard: true,
  lifecycle: true,
})
detach()
const trace = take.stop()
saveFixture(JSON.stringify(trace))
```

The caller owns persistence and the monotonic clock. Equal timestamps retain insertion order. Inputs include target changes, pan position/velocity/contact slots, layout rectangles, scroll offsets, keyboard insets and lifecycle changes. Coordinates are DIP, velocity is DIP/s, and timestamps are milliseconds from recording start. Contact slots describe the active contact count; they are not native pointer identities and do not reconstruct multi-touch recognition.

The schema rejects unknown fields, unknown view IDs, non-finite values, backwards timestamps and unsupported versions. Traces contain no field text, image bytes, view objects or native handles. Choose non-personal stable IDs and OS/model labels. Version 1 limits recordings to 5,000 entries, five minutes and 32 motions; JSON input is limited to 2 MB. A recorder that reaches a limit throws, so its owner must detach observers and stop recording.

**Checkpoints must use the same logical clock as replay.** A native animator can start after the input callback and present a frame later than the engine sample. The preview preserves that raw presentation capture separately, then **Finish take** freezes a controlled-engine baseline once. Subsequent replays use the saved baseline without regenerating it. Review and commit that JSON as the regression oracle. Canonical CI fixtures use independent, frozen checkpoints rather than accepting the current implementation on every run.

## Run the engine, then the native probe

```ts
import { parseTrace } from '@rafaelaugusto/jolt/testing'
import { motionTraceGraph, replayWithDriver } from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) => motionTraceGraph(trace.motions, (id) => views.get(id)!, { native }),
    { native },
  )
  if (!report.passed) {
    saveArtifact('trace.json', JSON.stringify(report.trace))
    saveArtifact('expected-observed.svg', report.plot)
    throw new Error(report.errors.join('\n'))
  }
}
```

The native fixture must already have loaded views. Configure its time scale and resolved Reduced Motion to match the trace first. The runner temporarily replaces Jolt's global driver and restores it in **finally**. Run one isolated replay at a time, without unrelated animation. It does not control retained live-spring clocks or native gesture sessions.

**ReplayClock** advances once per distinct recorded timestamp. A 288 ms gap stays one long frame. Native tracks are held and sought to the corresponding logical time; the probe waits two presentation frames, with a bounded deadline. iOS reads the presentation layer without a model-layer fallback; Android reads native translation in DIP. Velocity and settled state come from the engine, not a finite-difference native velocity measurement.

Every checkpoint compares position and velocity against explicit tolerances (defaults: 3 DIP and 30 DIP/s), plus exact settled state. The runner disposes the adapter on success, mismatch, cancellation or error, then requires its owned resource count to be zero. Reports contain observations, errors, remaining resources, the trace and an expected/observed position plot.

## Application adapters and coverage

The reference graph uses real **animate**, **motionValue**, **bind**, **drag** and **motionScope**. It covers the initial cases in #63: an interrupted spring, continuity at the exact target handoff, a cancelled single-pointer drag, ignored post-cancel motion, lifecycle suspension and disposal. A deliberately wrong native checkpoint must fail. The regression suite also caught and fixes the engine dropping incoming spring velocity at the exact handoff instant.

Layout, keyboard, scroll and load/unload events are preserved but require application routing. The reference graph rejects unsupported events; it never silently ignores them. Use its **environment** callback or supply a **ReplayAdapter** with **input**, **read**, **dispose** and **resources**. The pure **replayInteraction** runner accepts your **advanceTo** clock and passes a local seeded random function to the adapter factory. It never replaces global **Math.random**.

The scroll-to-sheet replay adapter remains the next stage of #63. Recording those numeric events does not yet reproduce the native bottom-sheet ownership policy. Existing real OS [gesture](./gestures) and [bottom-sheet](./bottom-sheet) tests retain that coverage. Synthetic graph replay bypasses the recognizer and does not prove hit testing, native gesture arbitration, keyboard animation timing or clipping.

Experiment **57 — Interaction replay** is localized in English and Portuguese. The [validation guide](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-replay.md) lists commands, artifacts and limitations.

<Clip name="interaction-replay-pt-ios" caption="The embedded preview in Brazilian Portuguese on an iOS simulator: a real spring recording and native replay, using actual XCTest taps at original recording speed." />
