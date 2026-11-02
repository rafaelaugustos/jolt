# Finite Web runtime

New, unreleased: [gestures, image zoom, coordinated scroll, refresh and reorder](./web-gestures).

Since RC.8: [Vue/Nuxt attachment, keyed item entrances and horizontal LTR/RTL scroll](./web-collections).

**Also in RC.7:** [resource scopes, pointer/viewport helpers and continuous Vue setup](./web-lifecycle), plus [overlay geometry, shared elements, complete recipes and diagnostics](./web-interactions). Mavis adoption remains separate.

**Since RC.7:** [colors, borders, continuous paint, real size, FLIP and seekable scenes](./web-visual) extend this runtime. The Web APIs remain experimental; full parity is tracked in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Since **0.1.0-rc.5**, the experimental `@rafaelaugusto/jolt/web` entry uses Jolt’s portable compiler and WAAPI directly on HTML elements, independently of Vue, React or NativeScript. See [installation](./install#experimental-web-candidate). Mavis completed its initial press/reveal migration and shared application example; adoption of newer Web capabilities continues [in Mavis](https://github.com/getcortexlabs/mavis-ui/issues/191).

RC.6 includes [continuous Web motion](./web-dynamic), with values, followers and drag/snap, plus [numeric mappings, geometry refresh and vertical scroll](./web-support). The Web APIs remain experimental.

Pointer and keyboard input are now covered by [Web press feedback](./web-press); the recording below remains the finite-runtime reference.

<Clip name="web-runtime-chromium" :width="720" caption="Chromium 156 on macOS arm64, real browser playback and clicks at real-time speed: movement with opacity, partial interruption, application scale plus a press contribution, reverse repeat, pause, seek, resume and reduced motion. Buttons exercise the contribution; full pointer/keyboard press recognition is separate work (#283)." />

## Supported motion {#supported-motion}

`x` and `y` use CSS pixels, `rotate` uses degrees, `scaleX`/`scaleY` use factors and `opacity` is clamped to 0–1. `scale` expands to both axes; an explicit axis overrides the shorthand. Fixed-target springs, tweens, numeric keyframes, compatible built-in/custom presets, per-property transitions, delay and stagger use the existing compiler. The native numeric recipes are shared without importing the native runtime.

A runtime belongs to one document. Configuration, presets, ownership tokens, effects and cleanup belong to that context. Two contexts cannot simultaneously claim the same element. Importing the Web entry is safe without a DOM; creating a runtime requires a live document with WAAPI. There is no global driver installation.

```ts
// Experimental entry from the locally packed candidate.
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
motion.set(card, { scale: 1.1 })
const move = motion.animate(card, { x: 240, opacity: 1 }, 'snappy')
motion.animate(card, { scale: 0.96 }, { layer: 'press', duration: 120 })
// Visual scale is 1.056. Releasing only press preserves the application scale.
motion.animate(card, { scale: 1 }, { layer: 'press', duration: 120 })
move.pause()
move.progress = 0.5
move.play()
const completed = await move.finished
motion.release(card)
motion.dispose()
```

## Controls, composition and cleanup {#controls-and-cleanup}

Each call owns its logical channels and one source clock. Translation/rotation contributions add; scale/opacity contributions multiply. One composed visual effect per surface plays the result. Replacing `x` preserves other channels and private contributions. The old handle cannot reclaim replacements, including when it seeks or completes later. A failed preparation or keyframe-budget check leaves existing playback intact.

`progress` covers the entire finite timeline, including delays and repeats. A paused seek to `1` stays paused and can seek backward; playback completes when resumed. `stop()` holds the current sampled values and resolves `finished` to `false`. Natural completion retains final values and resolves to `true`; partial replacement makes the old call resolve to `false` when its remaining channels finish. Terminal handles stay terminal. Effects and source clocks are removed at completion; retained final values remain until `release()` restores the original inline styles. External inline changes are preserved during release.

Detached targets are released automatically, including targets in shadow roots. Framework adapters must still release surfaces when their lifecycle ends. `dispose()` also removes observers, preference listeners and pending frames. An unresolved document timeline holds the pose until activation; `ready` resolves on activation or disposal. Normal finite playback has no library frame loop or JavaScript style writes per frame.

## Timing and reduced motion {#timing-and-reduced-motion}

Interruption projects the resolved source start time onto the document's performance clock at the command, then uses that same timestamp for composition and new playback. Position and velocity come from the source model. Paused or pending motion transfers zero velocity. This avoids using a stale rendering tick during a long input task. Browser presentation and numerical curve accuracy are tested separately, including a 2,000 px/s interruption after a busy JavaScript task in WebKit.

`reducedMotion: 'user'` follows the live browser preference. Enabling reduction finishes active transform channels at their final values; opacity continues. Disabling it allows future motion without replaying finished channels. `'always'` and `'never'` override the preference per context. `timeScale` affects future tracks. Finite loop/reverse repeats support 0–1,000 repetitions; infinite playback is outside this slice. The default prepared-keyframe budget is 6,001 per track/composed surface, configurable from 2 to 60,001; exceeding it rejects the transaction.

## Surface policy and limits {#surface-policy-and-limits}

The runtime owns `transform` and `opacity` on a mounted, transformable HTML box. Transform order is `static 2D baseline × translate × rotate × scale`; the original `transform-origin` stays in effect. Individual CSS transforms, 3D baselines, existing animations/transitions and inline `!important` motion styles are unsupported. Release and recreate before external CSS changes; arbitrary stylesheet/CSS-variable mutations are not monitored. Use a dedicated inner surface when other code owns the outer element's styles.

Supported size and 2D pivot changes can preserve this ownership using the RC.6 [geometry refresh API](./web-support#geometry); other external-style changes retain the release/recreate rule.

This guide covers finite playback. See [continuous motion](./web-dynamic) for values, springs and drag/snap, and [Web support](./web-support) for mappings, geometry and vertical scroll. Pan/pinch/rotation, image zoom, scroll coordination, headers/refresh and interactive reorder are documented in [Web gestures and scroll](./web-gestures). Native-only properties and other framework adapters remain outside this guide. It does not establish a stable portable-reference API or complete Mavis integration. WAAPI playback alone does not establish compositor acceleration or an FPS guarantee.

## Native reference and validation {#native-reference-and-validation}

Native playback behavior is unchanged. These reviewed English native recordings illustrate composition; they do not show the Web fixture or a shared Mavis screen running natively.

<Clip name="layers-ios" caption="iOS simulator, existing native Layers demo: movement and feedback layers coexist. Preserved native reference, not a physical-device recording or the new Web runtime." />

<Clip name="layers-android" caption="Android emulator, existing native Layers demo: movement and feedback layers coexist. Preserved native reference, not a physical-device recording or the new Web runtime." />

Using Node 22, run `npm run web:runtime:typecheck`, `npm run web:runtime:test` and `npm run web:runtime` after installing dependencies and Playwright's Chromium/Firefox/WebKit. The fixture opens at `http://127.0.0.1:4282`; stop it before running tests. The [evidence report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-runtime.md) describes clock tests, shared native baselines, rollback, cleanup and reproducible recording commands.

The optional [Vue DOM adapter](./web-vue) now supplies declared refs and enter/leave lifecycle.
