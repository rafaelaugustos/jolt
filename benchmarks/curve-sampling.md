# Adaptive curve sampling (#61)

Numeric fixed-target springs, decays and tweens now refine their native keyframes against a property error budget instead of always using 60 intervals per second. The source position/velocity solvers, settlement duration and incoming interruption velocity are unchanged. Sequence arrival retains the old capped 60 Hz **reference grid**, evaluated without allocating that grid's keyframe arrays; native point placement no longer determines arrival.

## Error model and limits

For springs and free exponential decays, a segment of length **h** with acceleration bounded by **M** has linear interpolation error at most **M h² / 8**. The solver supplies an interval-wide envelope for underdamped, critically damped and overdamped springs. Oscillations cannot disappear just because endpoint/midpoint samples agree. The bound also includes the final displacement snapped to the settled target and the extra chord error at property clamp boundaries (for example, shadow opacity at 1). Numerical position and velocity functions themselves are unchanged.

Other curves check quarter, midpoint and three-quarter errors against half the property budget. Named easings, piecewise drag release and whole-track easing use this measured estimate, not an analytical certificate. Whole-track easing locates logical keyframe crossings before refinement, so very narrow adjacent knots survive. Arbitrary functions can hide spikes or extra crossings between finite probes: unknown easing callbacks retain a 120 Hz seed grid, but receive **no mathematical guarantee**. Even a familiar function supplied through a wrapper is treated as unknown.

Normal intervals span at most 100 ms of playback. Refinement is bounded by 6,000 intervals, 24,000 position evaluations and depth 24 per sampled segment. If a limit or invalid analytical bound is encountered, discard the attempted refinement and use the old uniform 60 Hz representation capped at 6,000 intervals, retaining mandatory seams. Fallback is explicit in the internal track diagnostics and claims no error guarantee. Authored segment boundaries, repeat expansion and color samples are additional points; the limit is not a global cap on a complete composed/repeated track. An undamped spring forcibly stopped by the solver's existing ten-second cap may necessarily fall back because its last snap exceeds the budget.

Default budgets reuse property precision: translation **0.25 DIP**, scale **0.001**, opacity/shadow opacity **0.002**, rotation **0.1°**, and other numeric decorations **0.1 DIP**. Translation error in physical pixels is DIP error times screen density: 0.25 DIP is 0.75 pixels at 3×. Scale/rotation have their own units, so their pixel error depends on element geometry. Color mixing and derived/mapped motion-value representations retain their separate sampling policies. Retained native live springs are not sampled by this code.

## Reproduce the comparison

```sh
npm ci
npm run build
node benchmarks/curve-sampling.mjs > /tmp/jolt-sampling.json
npm test
npm run typecheck
npm run benchmark:typecheck
```

The host benchmark bundles the source with the same Core shim used by unit tests, then runs Node with GC exposed. It compares interpolation with a 0.1 ms reference, reports keyframe count and scalar bridge payload, measures median preparation time after warm-up, and measures retained JS heap for 1,000 tracks across three GC rounds. These are retained allocations, not allocation churn, total native heap or compositor memory. The fixed-sampler baseline was captured from **dbdfbe0** before implementation with this same harness; timing/heap results depend on the host and runtime. Tests retain its duration, arrival and initial-velocity snapshots independently.

The optimization trades additional setup computation for accuracy where curves bend sharply and a smaller native payload where they do not. It is not a universal CPU or memory reduction: fast, sharp and custom curves often need more points. The slow four-second ease drops from 241 to 41 points; the fast 300-DIP spring improves from about 6.79 to 0.24 DIP maximum sampled error. See [numeric results](./results/curve-sampling/).

## Native presentation and recording

Build the [native CI fixture](./native-ci.md) and normal demo sequentially. The existing replay group also runs **runCurveSamplingChecks**; there is no new CI job or emulator and the existing watchdog remains. It reads actual presentation-layer/native translation at the union of 60/120 Hz logical timestamps, checks a velocity-preserving replacement and final position, and requires an intentionally wrong expected position to fail. Android seeks truncate to integer milliseconds, so the artifact records requested and effective times separately; interpolation error is measured at the effective native time. This is not proof of physical 120 Hz refresh.

Native tolerances are 0.28 DIP (0.25 sampling budget plus 0.03 floating-point/probe margin). The artifact also reports density-adjusted pixel error and median native setup cost for fixed/adaptive point sets. The benchmark creates and stops both kinds of real native animations; it does not estimate native preparation from JS array length.

### Presentation timing regression (#216)

The beta.18 check reproduced the iOS 26.2 CI failure locally (`87.7765` versus `0`) and failed again during investigation (`91.1694` versus `0`), while other runs passed. Its two nested `driver.frame()` callbacks did not necessarily cross two display ticks: NativeScript Core 9.1.3's `animation-frame/index.js` schedules the first request outside a frame through `queueMacrotask`; only nested requests use its native FPS callback. The original artifact did not retain enough seek state to establish which native transaction was stale.

The check now uses three nested callbacks, allowing at least two display ticks before one presentation read. This removes the incorrect scheduling assumption without polling until a value matches, replaying an assertion, relaxing tolerance, or modifying production playback. It is a bounded sampling barrier, not proof of GPU scan-out. The existing 1,500-ms timeout remains; cancellation and scheduling errors release queued work. Every comparison, including the intentionally wrong expected position, still asserts the observed native value.

Failures retain `diagnostic` in `baseline.json`: seek phase, requested/effective time, held state, track duration, elapsed clock, the last eight comparisons and a failure-time iOS animation/presentation snapshot. Model values are labeled separately and never substitute for missing presentation. Capture errors cannot replace the original assertion. Success reports identify `kind: curve-sampling` and include accumulated presentation wait time.

The regression tests exercise the initial macrotask, the first native callback before an update, subsequent presentation, a persistently wrong value, stalled display, cancellation and scheduling failure. Local iOS 26.2 and Android results are recorded in [`results/ios-presentation/`](./results/ios-presentation/). The existing native CI group/job remains; no rerun loop, emulator or workflow was added. The existing recordings remain representative because the visible animation and its controls are unchanged.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltSamplingIOS testCurveSampling testCurveSamplingPortuguese
python3 benchmarks/curve-sampling-android.py YOUR_EMULATOR_SERIAL /tmp/JoltSamplingAndroid
```

Both recordings use actual OS taps in the normal Vue demo. The fast comparison plays the already-prepared point sets **four times slower** so the first bend is visible; the slow glide plays at original speed. Both lanes use the native driver. The EN/PT preview is experiment 58, **Curve precision**; isolated launch uses **--curve-sampling** and optional **--sampling-checks**. Numeric probe output is **jolt-curve-sampling.json** in app Documents (also external app files on Android).

## Português

A representação nativa passa a concentrar pontos onde a curva precisa de detalhe. A posição, velocidade, duração e chegada usada pelas sequências mantêm o contrato anterior. Springs e decays usam um limite analítico de curvatura; os demais caminhos usam verificações numéricas. Funções arbitrárias e fallback por limite não têm garantia matemática.

O relatório distingue DIP de pixels físicos, custo de preparação em JS e no driver nativo, além do heap JS retido. Casos rápidos podem custar mais para preparar em troca de precisão; curvas suaves podem reduzir bastante os keyframes enviados. Os probes de 60/120 Hz usam tempos lógicos e não medem a taxa física do display. No vídeo, a comparação rápida é reproduzida quatro vezes mais devagar; a curva longa mantém a velocidade original.
