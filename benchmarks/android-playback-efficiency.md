# Android sampled playback and retention

This audit follows the CPU, memory and busy-runtime questions in [#65](https://github.com/rafaelaugustos/jolt/issues/65). It compares Jolt's previous native keyframe representation with its compact replacement in the same release app. It does not rerun the Reanimated/Flutter comparison or establish physical-device performance.

The starting point is main `9e4d8c8` (0.1.0-rc.10). Adaptive curve sampling (#61), bulk Android keyframe construction (#259), persistent native composition (#260), and the worker diagnostic were already present. This change keeps those improvements and adds two narrower ones:

- `KeyframeFactory.createCompact` stores sampled numeric curves in two primitive float arrays. A native interpolator finds the segment with binary search and applies the same float interpolation arithmetic as Android's original keyframes. `ObjectAnimator` retains timing, delay, repeat/reverse and control. Its 0→1 property values pass the interpolated result through. The driver must preserve this interpolator; it is not a normalized progress value. Two-point tracks use the small existing representation. Nonfinite data, missing endpoint offsets and offsets that collapse to the same float fall back to native keyframes. Older app binaries retain both earlier construction fallbacks.
- A settled `ViewAnimation` releases its entries. Its public promise and final clock/progress remain available, while sampled curves and native handles can be collected. Paused animations and held sequence steps retain the entries required for seeking until they actually settle.

The first change applies to Android numeric transforms/opacity, not colors, decorations, size, native composition or live springs. The second applies to the native animation engine; the portable Web engine is unchanged.

## Method

Use a dedicated device and a normal release/production Vue demo, without HMR. The fixture is opt-in via `--es playback-efficiency true --es efficiency-checks true`; a normal launch runs no audit. The build embeds commit, dirty state, versions and a source hash. Raw reports identify OS/API, model, refresh rate, thermal/power state and whether the device is physical.

The committed capture uses an Android 15 / API 35 ARM64 emulator, approximately 60 Hz, with SwiftShader, Animator scale 1×, NativeScript Core 9.1.3 and Android runtime 9.1.1. Other development work continued on the host; these measurements are not isolated physical-device rankings. Recording runs separately from performance collection.

1. Compare 240,280 actual native property reads between the old and compact paths. Cover eight properties, three unit scales, 2/3/41/241/601 points, every integer millisecond through forward/reverse playback, a backwards seek and collapsed float offsets. Require exact equality.
2. Warm both factories. For each of 2/41/241/601 points, construct 300 animators and evaluate 36,000 native positions, five times per implementation with rotating order. Reflection lookup and input generation are outside the timing windows. Report setup and evaluation wall/CPU time separately. This synthetic evaluation has no rendering or JavaScript per position; it is not 36,000 presented frames or the complete cost of calling `animate()` from JS.
3. Request JS/Java GC outside those windows. Observe Java heap, native allocator and process PSS before allocation, while the batch is retained, and after release. These are retained-memory snapshots, not allocation counts; a GC request does not promise collection, and PSS can drift due to runtime caches and unrelated app resources.
4. Play the same 0→160→0 DIP eased loop for 30 seconds, three times per backend with rotating order. Use the existing native `BudgetProbe`: it samples `Choreographer`, actual translation and inexpensive RSS, without JS frame callbacks. PSS is sampled only before/after. Require native movement and retain all callback gaps. Both backends use the updated engine, so this isolates representation during playback, not every change since main. Callback opportunities are not display presentation/deadline measurements.
5. Keep 1,000 stopped public animation handles alive and observe memory after each batch. Separately compare the main/current engine in Node with a non-retaining fake driver, explicit GC and WeakRefs to the actual tracks. Natural completion and cancellation alternate. The current-source regression requires all settled tracks to become collectable; it does not enforce a noisy heap-byte threshold.

## Reproduce

```sh
npm ci
npm run build
npm run typecheck
npm run benchmark:typecheck
npm test -- --maxWorkers=2
node benchmarks/playback-retention.mjs
# Same harness, only engine.ts replaced with the original main source:
node benchmarks/playback-retention.mjs 9e4d8c8

cd demo
npm install
JOLT_BENCHMARK=1 ns build android --release --env.production --no-hmr \
  --key-store-path YOUR_TEST_KEYSTORE --key-store-password YOUR_PASSWORD \
  --key-store-alias YOUR_ALIAS --key-store-alias-password YOUR_PASSWORD
cd ..
adb -s YOUR_SERIAL install -r demo/platforms/android/app/build/outputs/apk/release/app-release.apk
python3 benchmarks/android-playback-efficiency.py YOUR_SERIAL /tmp/jolt-efficiency
python3 benchmarks/android-playback-efficiency-report.py /tmp/jolt-efficiency/report.json
python3 benchmarks/playback-efficiency-record-android.py YOUR_SERIAL /tmp/jolt-efficiency-controls.mp4
```

Generate missing demo Android resources from the pinned NativeScript template, keeping the repository manifest. Build/signing and recording requirements remain in [CONTRIBUTING.md](../CONTRIBUTING.md). The recorder uses real ADB taps for play, pause/resume, seek, interruption and stop; no synthetic footage or altered playback speed is used.

## Follow-up: process attribution and report offload

The [CPU/PSS investigation](android-resource-profile.md) profiles idle/playback threads, memory mappings, track collectability and 5,000 creation/disposal cycles before selecting the full report export for worker offload. The current audit sends incremental records to a bounded worker; frame JSON parsing, report accumulation, full serialization and file writes happen there, with acknowledgements outside measured playback windows. The worker is terminated after the audit or on cancellation/error. Startup and native thread IDs are recorded in the report.

The historical results below retain their original method and build identity. The new streaming audit is a separate validation run because its worker changes whole-process memory residency; its PSS must not be pooled into the earlier before/after measurements. The follow-up report retains the new raw validation data and describes that memory cost.

## Worker build regression

Fresh demo installs resolved `@nativescript/webpack` 5.0.39 through `~5.0.38`, while the demo explicitly uses webpack 5.101.3 and the repository root also installs webpack 5.112.0. The new worker loader first resolves webpack's newer `dependencies/worker/WorkerDependency` path. In this layout it finds the root's newer copy and patches that class, instead of the older compiler actually building the demo. The emitted worker constructor retained a `file:///app/...mjs` URL, and the Android demo reported “Failed to find module” after **Worker** was tapped. The recorder rejected that run; it is not published as a working demonstration.

Pinning the demo to the already-used fixture pair, `@nativescript/webpack` **5.0.38** and webpack **5.101.3**, restores the native `~/...mjs` worker path. The runtime/source of the computation is unchanged. Build metadata now records both tool versions. The recording runner opens the current isolated `busy-js` showcase route, avoiding the old scrolling-playground coordinates. Actual startup, worker work and cleanup are revalidated below, not inferred from bundle text alone.

## Busy JavaScript and architectural limits

Re-run [android-busy.md](./android-busy.md) in a separately built release benchmark. Keep the intentional 300-ms main-runtime block and the identical worker computation as different modes. The existing lifecycle checks cancel a worker during startup and cancel active playback, verify the worker's distinct native thread ID and restore hardware layers. Worker startup remains outside playback timing, not free.

The separate release run from clean commit `dc418aff1cdb162c7f71514d87f2df41b63d6b24` passed the existing startup cancellation, active cancellation and layer cleanup checks. All nine [raw reports and gfxinfo records](results/playback-efficiency/2026-11-03-busy.json.gz), the [summary](results/playback-efficiency/2026-11-03-busy-summary.json) and [build identity](results/playback-efficiency/2026-11-03-busy-build.json) are retained. Three trials per mode gave:

| Mode                  | Largest UI-window vsync gap overlapping work | Native Jolt rotation during the work interval |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| Idle                  | 16.67 ms in all three trials                 | approximately 60°                             |
| Main-runtime CPU loop | 300.00 / 316.67 / 316.67 ms                  | 0° in all three trials                        |
| Worker CPU loop       | 16.67 ms in all three trials                 | approximately 60°                             |

Every worker trial ran on a different native thread from the main runtime; `withLayer()` rotations showed the same progress/stall pattern. These are UI-window timing gaps, not presented FPS. This validates the existing app-level mitigation and the repaired worker build, not immunity to arbitrary main-thread blocks.

Compact curves reduce the UI thread's work; they cannot make a blocked UI thread advance `ObjectAnimator`. The app still needs to offload suitable computation, return small results and apply expensive UI changes in bounded batches. Moving only the curve evaluator to another worker would leave native View updates waiting for the same UI thread. `withLayer()` caches drawing; it does not move general View-property playback to RenderThread.

A general off-thread backend would require a separate supported-property and lifecycle design. Reanimated's separation between app JS and the UI runtime and Flutter's main Dart isolate are distinct configurations. No runtime rewrite, hidden Android API or new Web capability is introduced here. The physical-device cross-stack scenarios and app-code comparisons in #65 remain open.

## Results and recording review

Captured on 2026-11-03 from clean commit `7e9721e5e8b99ef124b43b3bf2dc21e5ab7e34b6`, source hash `6ee587d6418396117744444154e9f984835f1d10ba2be8c77d0611154e7db922`. The [build record](results/playback-efficiency/2026-11-03-build.json) retains the APK SHA-256. All **240,280 native comparisons passed exactly**. The complete [raw report](results/playback-efficiency/2026-11-03-android.json.gz), [summary with ranges](results/playback-efficiency/2026-11-03-summary.json) and [device identity](results/playback-efficiency/2026-11-03-device.json) are retained.

Medians of five rounds, **300 retained animators** per batch; evaluation performs **36,000 native seeks**, without drawing. Java heap deltas below use decimal MB.

| Points | Setup CPU, original → compact | Evaluation CPU, original → compact | Retained Java heap delta, original → compact |
| ------ | ----------------------------- | ---------------------------------- | -------------------------------------------- |
| 2      | 0.141 → 0.155 ms              | 0.713 → 0.709 ms                   | 0.143 → 0.143 MB                             |
| 41     | 0.321 → 0.132 ms              | 2.978 → 0.891 ms                   | 0.598 → 0.291 MB                             |
| 241    | 1.211 → 0.254 ms              | 14.498 → 1.271 ms                  | 2.761 → 0.770 MB                             |
| 601    | 2.427 → 0.692 ms              | 28.498 → 1.886 ms                  | 6.648 → 1.634 MB                             |

At 241 points, retained Java heap drops about 72% and native setup CPU about 79% in this workload. At two points, both paths use native keyframes and retain the same measured heap; the small timing differences do not establish a gain. Median PSS increases while retaining 300 241-point animators were 2,668 KiB and 724 KiB, but these process-wide deltas are noisier than the Java representation comparison.

For the **30-second single-view loop**, original CPU was **9.007 s** (range 7.125–11.518), compact **7.979 s** (7.197–11.556). These overlapping ranges do not establish a meaningful total-process CPU improvement. Median worst callback gaps were 35.70 ms and 37.42 ms; the worst trials reached 122.27 ms and 105.35 ms. Both paths traversed the expected 160 DIP. This is not an FPS win or a claim of perfect frames. The wider ranges in this final run, while other development continued on the host, reinforce the emulator limitation.

The host retention comparison keeps 1,000 finished/cancelled handles alive: [main](results/playback-efficiency/2026-11-03-retention-main.json) retains **3,000 tracks** and adds approximately **11.26 MB** of JS heap; [current](results/playback-efficiency/2026-11-03-retention-current.json) retains **zero tracks** and adds approximately **2.26 MB**. These are Node 22.23.3 results with a fake driver and requested GC, not Android memory savings. The regression test checks collectability, without a byte threshold.

The device retention run kept 1,000 stopped handles and Java used heap stayed around 3.2–3.33 MB after requested collections. **Process PSS still increased**, from about 85 MB before those batches to about 101 MB after them, and remained around 101 MB after dropping the handles. Native allocated memory stayed around 30 MB. Runtime/allocator residency and the retained public JS objects remain in the process measurement; this audit does not claim to eliminate that PSS growth or explain the earlier cross-framework 104 MB result. A physical-device heap/allocator profile is still needed for that attribution.

The [earlier clean run](results/playback-efficiency/2026-11-03-before-worker-pin-android.json.gz), its [summary](results/playback-efficiency/2026-11-03-before-worker-pin-summary.json), [device](results/playback-efficiency/2026-11-03-before-worker-pin-device.json) and [build record](results/playback-efficiency/2026-11-03-before-worker-pin-build.json) are preserved separately. It used the same core source hash before the worker-loader pin: the 241-point Java heap reduction was also 72%, but the 30-second CPU medians were 7.024 s and 6.892 s with overlapping ranges. It is not pooled with the final run.

The [exploratory run](results/playback-efficiency/2026-11-03-exploratory.json.gz) is retained separately. It preceded shared linear-interpolator reuse and a viewport correction in the demo, and overlapped host builds. It is not combined with the final numbers or used as a before/after performance baseline.

The English recording `playback-efficiency-android.mp4` shows real ADB taps on both native lanes: pause/hold, resume, a 70% seek, replacement toward the starting position, and stopping mid-flight. The complete source-timed H.264 was decoded without errors and frames across the clip were inspected; the lanes follow the same positions, controls remain readable and the final position stays held. It is embedded in EN/PT/ES/ZH guides with the Android 15 emulator label. Recording is separate from every measured run.

The separate English recording `android-performance-compact.mp4` shows idle playback, an intentional main-runtime block and completed worker work using the fixed release bundle. It is embedded in all four guides with the Android 15 emulator label. Both the original source and compressed recording retain source timestamps; the complete H.264 decodes without errors and the three modes and final worker status were visually inspected. The earlier recording remains in the repository.

## Português

A comparação parte da `main` 9e4d8c8 e mede a representação antiga e a compacta no mesmo app de release. Amostragem adaptativa, criação nativa em lote, composição persistente e a demonstração de worker já existiam. O PR reduz objetos Java por curva e libera tracks de animações encerradas, preservando os dados de animações pausadas e passos de timeline ainda controláveis.

O protocolo separa preparação, avaliação sem desenho, heap Java retido, PSS do processo, reprodução de 30 segundos e retenção de heap JavaScript no computador. As medições são de emulador; os intervalos do Choreographer não comprovam frames apresentados. GC é solicitado, sem garantia de coleta. Ganhos do microbenchmark não são promessa de FPS ou bateria, e os números não substituem a comparação física com Reanimated e Flutter da #65.

O bloqueio de 300 ms continua sendo um controle negativo. Mover trabalho adequado do aplicativo para um worker evita disputar a thread da UI; a reprodução compacta não torna essa thread imune a bloqueios. A gravação usa toques reais e velocidade original, fora das janelas de medição.
