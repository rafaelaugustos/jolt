# Record and replay an interaction

Keep the inputs that reproduced a bug, freeze their expected motion, and replay them against the next build. The optional **@rafaelaugusto/jolt/testing** entry provides a versioned numeric trace, an opt-in recorder and an adapter-based runner. **@rafaelaugusto/jolt/testing/native** adds a controlled Jolt driver, Core pan capture and native presentation reads.

::: warning Development preview
This checkout prepares the replay tools for beta.18; published beta.17 does not contain these entries. Use them in an isolated development fixture. They are not production telemetry and do not install observers merely by being imported.
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

The scroll-to-sheet adapter below covers contact ownership in the native gesture session used by **bottomSheet**. Existing real OS [gesture](./gestures) and [bottom-sheet](./bottom-sheet) tests retain recognizer and recipe coverage. Synthetic graph replay bypasses the recognizer and does not prove hit testing, keyboard animation timing or clipping.

Experiment **57 — Interaction replay** is localized in English and Portuguese. The [validation guide](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-replay.md) lists commands, artifacts and limitations.

<Clip name="interaction-replay-pt-ios" caption="The embedded preview in Brazilian Portuguese on an iOS simulator: a real spring recording and native replay, using actual XCTest taps at original recording speed." />

## Scroll → sheet handoff

In experiment 57, choose **Scroll → sheet**. Record a pull inside the notes and reverse it: scrolling reaches its top before the sheet moves down; on reversal, the sheet expands before the content scrolls. Accept the take, replay it, or deliberately break a scroll checkpoint.

<Clip name="scroll-handoff-replay-ios" caption="iOS simulator: real XCTest drags hand the contact from content to sheet and back, then the saved numeric trace replays through the native session. A wrong scroll checkpoint is detected. Original capture speed; replay uses logical time." />

<Clip name="scroll-handoff-replay-android" caption="Android emulator: real ADB drags, recorded replay and native ownership negative control. Both sheet translation and native scroll offset are checked. No physical-device performance claim." />

```ts
import { parseTrace, scrollHandoffTraceGraph } from '@rafaelaugusto/jolt/testing'
import {
  nativeScrollHandoffTraceGraph,
  replayWithDriver,
} from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) =>
      native
        ? nativeScrollHandoffTraceGraph(trace.motions, gestureSurface, scrollView)
        : scrollHandoffTraceGraph(trace.motions),
    { native },
  )
  if (!report.passed) saveFailure(report)
}
```

The headless adapter is an independent ownership contract. The native adapter invokes the same consumption code used by the production gesture session: iOS's scroll-delta routing and Android's pre-scroll/child/post-scroll sequence. It does not implement a second native approximation. Raw OS input remains covered by the separate XCTest/ADB assertions in the clips.

Configure two **drag** motions with **axis: 'y'**, empty **snap** arrays and stable IDs **sheet** and **scroll**. The scroll minimum is zero; its maximum must match the loaded scroll range within 1 DIP. Both adapters accept an optional **{ sheet, scroll }** ID mapping. The native views must be loaded, the scroll must be a vertical descendant of an unowned **GestureSurface**, and native classes must be rebuilt. Replay-only native sessions disable OS input and refuse an already-owned surface.

Inputs use cumulative window-relative contact positions; contact membership changes rebase without moving the sheet. Scroll events set the external offset. Cancellation, suspend and unload terminate the old contact; resume/load require a fresh begin. Unsupported targets, keyboard and layout routing throw. This adapter holds at the released position: fling, automatic snap selection and free-running retained springs belong to the recipe's separate tests.

**observeScrollHandoffInputs(scrollView, recorder, traceNow)** optionally captures raw Core touch contacts and the starting scroll offset; dispose its returned function before replay. The capture is numeric and contains no list text or native handles. It records raw contacts, not recognizer decisions. The preview freezes the independent contract's expected states during capture; replays keep those checkpoints unchanged. Canonical fixtures additionally cover same-contact reversal, a long frame, cancellation, pointer rebasing, bounds and tiny fractional steps. Android carries fractional pixels between samples instead of accumulating rounding error.

The native report reads actual sheet presentation and native scroll offset. Sheet velocity is the native held-input velocity when that sample moves the sheet, zero otherwise; scroll velocity is not measured by this adapter. Settled state means the contact ended and the native node is at rest. A deliberately wrong scroll checkpoint must fail, and disposal must return the native node count to its baseline. See [reproduction and limits](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-handoff.md).
