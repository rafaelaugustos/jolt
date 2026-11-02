# Continuous Web motion {#web-dynamic}

**Since RC.7:** [colors, borders, continuous paint, real size, FLIP and seekable scenes](./web-visual) extend this runtime. The Web APIs remain experimental; full parity is tracked in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Since **0.1.0-rc.6**, `motionValue()`, `bind()`, `springValue()` and `drag()` are available on the document-owned runtime from `@rafaelaugusto/jolt/web`. The Web APIs remain experimental; native entry points and the Vue adapter keep their existing contracts.

<Clip name="web-dynamic-chromium" caption="Chromium 156 desktop, original speed: real pointer and keyboard input steers a follower, retargets application scale while pressed, drags and catches a returning snap, removes/remounts the card and changes pause/reduced motion. Browser recording, not native or physical-device performance evidence." />

## Input values and bindings {#values}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const follower = motion.springValue(input, { stiffness: 170, damping: 22 })
const binding = motion.bind(card, { x: follower })
input.set(180)
input.set(60) // Retarget the same follower, retaining position and velocity.

// On teardown:
binding.dispose()
follower.dispose()
input.dispose()
motion.release(card)
motion.dispose()
```

Values belong to their context. `get()` reads the current number; `getVelocity()` uses units/second. Input `set()` changes the value synchronously, while visual writes coalesce into a frame. Bind numeric x/y/rotation/scale/opacity channels; scale expands to scaleX/scaleY. Cross-context, disposed and nonnumeric inputs fail before replacing existing ownership.

`subscribe(listener)` observes changes after scheduled frame writes and returns an unsubscribe function. It does not emit an initial value. Observers run in JavaScript and have their own cost; they do not convert unrelated finite WAAPI animations to frame callbacks. Numeric mappings and bounded follower chains are available in the [RC.6 Web support](./web-support). RC.7 adds [color mappings and continuous paint bindings](./web-visual#paint); full native/Web API equivalence remains tracked in #236.

A binding owns only its selected base channels. A later `animate()`, `set()` or `stop()` replaces the matching channels; other bindings and press layers survive. Disposing an obsolete binding cannot restore an old value. Unbinding holds the current value. `release()` restores owned inline styles and cancels target work; detachment does the same automatically. Values can outlive a target: dispose them separately, or dispose the runtime. Disposing an input also disposes its spring followers.

## Scheduler and springs {#scheduler}

One scheduler per context batches reads, updates and writes, using timestamps rather than a fixed 60 Hz step. No frames remain scheduled once inputs, observers and motion settle. Hidden-document time is excluded from continuous spring time; resume does not simulate the entire gap. Finite WAAPI clocks retain their existing browser timeline behavior.

While a surface has live bindings, its finite channels are also composed on that surface by the scheduler. Other surfaces retain WAAPI playback. Unbinding returns the remaining finite tracks to WAAPI without restarting their clocks. The real-time composition path is JavaScript work, not a compositor guarantee.

A spring follows a same-context readable numeric value and uses the portable analytic solver. Options are `stiffness`, `damping`, `mass` or `duration`/`bounce`, plus `initial`, `restDelta` (default 0.001 units) and `restSpeed` (0.01 units/second). `pause()` holds position/velocity while the source can change; `play()` resumes toward its latest value. `stop()` holds with zero velocity. `jump()` settles at the current source. `dispose()` is terminal.

Reduced-motion changes settle all generic spring followers immediately, including unbound followers; direct input remains direct. A new trajectory captures the current `timeScale`; changing it does not rescale a trajectory already running. Zero damping may remain active until stopped or disposed.

## Drag and finite snap {#drag}

```ts
const drag = motion.drag(card, {
  axis: 'x',
  bounds: { left: -120, right: 120 },
  snap: { x: [-100, 0, 100] },
  spring: { stiffness: 180, damping: 20 },
})
// drag.update({ disabled: true })
// drag.cancel() // Hold the owned input position without snapping.
// drag.dispose()
```

Drag uses one primary pointer and x/y translation in CSS pixels. The static target baseline must be identity; affecting ancestors must not introduce transforms, perspective or CSS zoom. RC.7 accepts identity ancestor transforms and stops at a real modal/popover top-layer root, whose own geometry still matters; see [overlay geometry](./web-interactions#overlays). Jolt rotation/scale and press compose after translation. Scroll and resize cancel the drag; arbitrary transformed input spaces, pinch and nested-scroll handoff remain unsupported.

Drag claims its translation on pointerdown and uses pointer capture. It temporarily applies `touch-action: pan-y` for x, `pan-x` for y, or `none` for both, restoring the previous inline value on disposal. Nested interactive controls keep their input. Native taps and keyboard activation remain; an actual drag suppresses its generated click. Disabled/inert/busy state, cancellation, lost capture, blur, hiding and detachment stop input without a successful-release snap.

Bounds clamp direct input and snap destinations; the release spring can overshoot. Snap selects the nearest per-axis point using 150 ms velocity projection; absent points return to the position at attachment. Release velocity uses recent pointer samples, becomes zero after 80 ms without movement and is capped at 5,000 CSS pixels/second. A successful release transfers position/velocity to finite WAAPI playback. A new drag can catch that playback; a newer application owner cancels the old drag without restoring its translation.

`drag.animation` exposes the latest finite snap and its `finished` result. Explicit drag disposal stops only its own snap. Target/runtime disposal also releases bindings and listeners. The component still owns any keyboard alternative to dragging and its accessibility semantics.

## Native references and validation {#verification}

The following reviewed recordings preserve the existing native implementations. They demonstrate native values, followers and drag; they do not demonstrate the new Web scheduler or a shared Mavis screen. The native and Web APIs retain distinct supported subsets.

<Clip name="live-springs-ios" caption="Existing iOS simulator demo: actual input reversals, touch following, a separate shake layer and reduced motion. Original speed; native reference, not a physical-device recording." />
<Clip name="live-springs-android" caption="Existing Android emulator demo: native followers react to actual taps/swipes and reduced motion. Original speed; native reference." />
<Clip name="drag-values-ios" caption="Existing iOS simulator demo: a draggable sheet drives bound values and snaps after release; application motion can be interrupted. Original speed; native reference." />
<Clip name="drag-values-android" caption="Existing Android emulator demo: actual flings and catching a moving sheet, with native value bindings. Original speed; native reference." />

Run `npm run web:dynamic:typecheck` and `npm run web:dynamic:test`. Chromium, Firefox and WebKit cover composition, cancellation and cleanup. Actual touch-scroll injection is Chromium-only; other engines retain pointer-cancellation coverage. Hidden-time checks deliberately control the visibility signal and are not physical mobile background measurements. See the [reproduction report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-dynamic.md). Native CI and packed Web/Vue/SSR/native consumers remain required. There is no new framework adapter or Mavis implementation in this delivery.
