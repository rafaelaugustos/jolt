# Web orchestration and control

Experimental additions available since **0.1.0-rc.8**, tracked by #327–#333. These APIs use the same portable trajectories and scheduling rules as native playback. The browser entry remains independent of NativeScript and frameworks; the optional Vue adapter owns lifecycle through `motion.use()` and its child scope.

## Values and playback progress {#values}

`animate(value, destinationOrKeyframes, transition)` accepts a mutable numeric value from the same context. `null` samples its current channel. Replacement inherits position and velocity; independently named scalar layers add, including for values bound to scale. A finished layer retains its endpoint; stopping that layer removes its contribution. `set(value, number)` clears playback and layers. Whole-value `stop(value)` holds the combined value. Derived and foreign values reject before ownership changes.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
scope.bind(card, { x })
const travel = scope.animate(x, [0, 240, 100], { duration: 1200 })
scope.animate(x, 24, { layer: 'accent', duration: 200 })
const progress = scope.playbackProgress(travel)
scope.bind(meter, { scaleX: progress })
travel.pause()
travel.progress = 0.5
travel.play()
// Remove only this additive contribution:
motion.stop(x, { layer: 'accent' })
```

`playbackProgress(handle)` is readonly and borrows the existing clock. Pauses, seeks, completion and cancellation propagate to mappings and bindings. Disposing progress leaves playback alive. A finite, known duration is required; an imperative timeline may not know it until all participants activate. Unobserved values and progress create no frame loop. Observers and live bindings use the shared demand-driven scheduler; subscriptions do not create a second visual playback.

<Clip name="web-orchestration-values-chromium" caption="Chromium on macOS: real controls play keyframes, add/remove a layer, pause, seek and retarget to a spring. The meter reads playbackProgress; this is browser footage." />

<Clip name="motion-values-ios" caption="iOS simulator reference: one animated motion value drives the sheet, page scale and backdrop. Existing native recording, reused with unchanged playback behavior." />

## Decay and snap {#decay}

`decay(element, { x?, y? }, { friction?, snap? })` compiles velocity in CSS pixels/second into finite WAAPI playback. Friction must be between 0 and 1; larger values coast farther. Snap can be one list for both axes or `{ x: [...], y: [...] }`; the nearest projected endpoint wins. The supplied velocity is explicit. During retargeting the current position is preserved, while unrelated channels continue. Use the gesture’s measured release velocity for continuity. Pause/resume/seek/stop and reduced motion follow the normal playback contract.

<Clip name="web-orchestration-decay-chromium" caption="Chromium on macOS: actual pointer drag/release, projected snap, pause/resume and cancellation. Pointer input belongs to this example; decay owns the release trajectory." />

<Clip name="orchestration-decay-ios" caption="iOS simulator reference: native free decay and snap. Reused original capture with its launch prefix removed; playback speed is unchanged." />

## Sequences and imperative timelines {#groups}

Both APIs accept absolute positions, `<` for the previous activation, and signed offsets from visual arrival. Later tuple targets take their first absolute keyframe at preparation; null and relative starts resolve at activation. Negative offsets need an animate/decay arrival forecast. Callback factories execute on the JavaScript thread and must return an animation; failed setup rejects completion and cancels owned work.

```ts
const scene = scope.timeline([
  [card, { x: 240 }, { duration: 1400 }],
  [x, [0, 1], { duration: 1400, at: '<' }],
  { at: 800, run: () => scope.animate(badge, 'fadeIn') },
])
scene.pause()
scene.play()
await scene.finished

const steps = scope.sequence([
  [card, 'fadeInUp'],
  [badge, 'fadeIn', { at: '-100' }],
  () => scope.decay(card, { x: 400 }, { snap: [0, 240] }),
])
// Stops started participants and prevents future factories:
steps.stop()
```

`sequence()` provides ordered/overlapping playback and stop. `timeline()` also accepts numeric tuples and playable factories, and jointly pauses active participants and future launches. It resumes only children it paused. Hidden-document time is excluded from future scheduling; a manually paused timeline stays paused after visibility returns. Cancellation prevents pending factories. Scopes cancel sequences on suspension and pause timelines. There is no imperative group seek: use the existing `seekableTimeline()` for declarative scrubbing. The group can report unknown or infinite duration until its participants are known.

<Clip name="web-orchestration-groups-chromium" caption="Chromium on macOS: pause holds the future checkpoint; resume activates it at the remaining time. The second run overlaps sequence steps; cancellation removes future work." />

<Clip name="orchestration-timeline-ios" caption="iOS simulator reference: ordered and overlapping native sequence steps. Reused real capture with its launch prefix removed, at original speed." />

<Clip name="controlled-playback-ios" caption="iOS simulator reference: native route, value, ripple, progress and scheduled checkpoint pause/resume together. This is not physical-device performance evidence." />

## Named states and replaceable references {#states}

`current` is the latest requested state; `settled` is the last successfully completed state. Definitions contain absolute endpoints and named target overrides. Invalid definitions/transitions reject before changing ownership. Replacements inherit motion; omitted old channels hold their current values. `attach()` or a stable `ref(name)` callback can change a declared surface: the old owned child stops, the new child joins from its current presentation, and completion waits for it. A settled state applies immediately to a newly attached surface. `null` detaches; missing targets are skipped. Unrelated owners survive cleanup.

```ts
const states = scope.motionStates(
  { card, badge: null as HTMLElement | null },
  {
    idle: { card: { x: 0, scale: 1 }, badge: { opacity: 0 } },
    active: { card: { x: 240, scale: 1.1 }, badge: { opacity: 1 } },
  },
  { transition: { duration: 600, badge: { duration: 180 } } },
)
const transition = states.to('active')
states.attach('badge', mountedBadge)
states.attach('card', replacementCard)
await transition.finished
// Vue setup: create these resources in motion.use((scope, element) => { ... }).
// Permanent teardown:
scope.dispose()
```

<Clip name="web-orchestration-states-chromium" caption="Chromium on macOS: interrupt work with an error, pause, replace the card element, resume and complete. The replacement participates in the same state completion." />

<Clip name="motion-controllers-ios" caption="iOS simulator reference: native upload/error/retry/success states, scope controls and unmount/remount. Existing English recording, reused for the equivalent native contract." />

## Validation and integration {#validation}

Run `npm run web:orchestration:test` for Chromium, Firefox and WebKit conformance, and `npm run web:orchestration` for the interactive demo (`?demo=values`, `decay`, `groups`, `states` or `stroke`). Packed imperative/Vue consumers exercise all seven APIs, with SSR-safe imports and native bundles. Recordings demonstrate behavior, not compositor eligibility or physical-device frame rates. Mavis adoption is a separate integration; shared application recipes should retain their platform-independent intent.

## Controlled SVG drawing {#svg}

`drawPath(svgGeometry, { progress? })` creates an owned drawing controller (#333). Its `animate()` accepts a normalized destination or keyframes, returning the same finite pause/play/seek/stop contract. Animate toward `0` to erase or reverse an unfinished draw; replacement starts from the current position and velocity. `playback.progress` is timeline progress, while `drawing.snapshot().progress` is the visible normalized stroke fraction. A newer draw survives old-handle cleanup.

```ts
const drawing = scope.drawPath(connectionPath, { progress: 0 })
const playback = drawing.animate(1, {
  duration: 1100,
  ease: [0.16, 1, 0.3, 1],
})
playback.pause()
playback.progress = 0.5
playback.play()
const reverse = drawing.animate(0, 'snappy')
await reverse.finished
```

The driver measures geometry in SVG user units and respects an authored `pathLength`, rather than assuming a fixed length or treating CSS percentages as path progress. WAAPI replays the prepared dash trajectory; optional progress observation uses the shared scheduler. Stroke drawing can require browser painting and does not promise compositor acceleration. See the [SVG dashing model](https://www.w3.org/TR/SVG2/painting.html#StrokeDashing).

Use one continuous contour per drawing. Paths, lines, polylines, polygons, circles, ellipses and rectangles use their measured geometry; separate compound contours into separate targets. Zero-length geometry is an invisible immediate completion. Normalized endpoints stay in 0–1, and displayed spring overshoot is clamped. Finite repeat/keyframe budgets follow Web playback; this API does not morph `d`. The portable path validator retains the native bounds of 20,000 characters and 256 normalized commands.

The controller owns inline dasharray, dashoffset and stroke opacity until disposal, restoring original authored values while preserving later external inline edits. Fill, transform, input and accessibility remain with the host. Remove conflicting CSS animations from these owned stroke channels. Geometry attributes and resize are observed; `refresh()` explicitly remeasures after application changes while preserving normalized time. Invalid explicit updates reject; invalid geometry discovered by an observer safely disposes the drawing. Removal (including shadow roots), scope teardown and reduced-motion changes release or finish the appropriate work.

Lume keeps `vEnter`, `useContentTransition`, `useListLayout` and `useConnectionMotion` for Vue integration and choreography. Only its manual SVG drawing belongs in this driver. Animated Reveal height remains Mavis adoption of existing size animation, not missing Jolt physics.

<Clip name="web-orchestration-stroke-chromium" caption="Chromium on macOS: actual controls draw three SVG connections, pause, seek, change geometry, reverse mid-flight and enable reduced motion. Original timing; no fabricated footage." />

<Clip name="shapes-ios" caption="iOS simulator reference: actual native shape drawing with pause/resume and reduced motion, alongside the native morph example. Existing English recording; this Web API covers stroke drawing, not morphing." />
