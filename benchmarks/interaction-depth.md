# RC.12 interaction/depth validation

Candidate branch `feat/rc12-interaction-depth`, based on `d4a63ecfffa8d99afec998072a497bbcc5c5ba31`. Not merged or published by this report. Owning issues: #399, #415/#383, #402, #380, #381, #382. Source/APK identities and raw reports are retained in [results/interaction-depth](results/interaction-depth).

## Acceptance scope

- Physical ASUS ZenFone 3 (`ASUS_Z017DC`), Android 8/API 26, approximately 60 Hz; production JavaScript in a debug native package. Real ADB swipes/taps verified all six demos. This is compatibility evidence on old hardware.
- Dedicated iOS 26.2 simulator, real XCTest input; six scenes, including actual SceneKit uniforms and AVAudioPlayer completion. This is not a physical iPhone. Manual pause/background and repeated remount are covered by additional lifecycle clips; the inspector fixture now retains its owner with `scope.resource` instead of disposing it on scope suspension. This fixture wiring follow-up was validated on iOS after the maintainer stopped physical Android collection.
- Chromium/Firefox/WebKit browser behavior tests. Reviewed browser demos use Chromium with software WebGL; this is not hardware-GPU performance evidence.
- Native/browser screen recordings do not capture audio. Audio completion callbacks are verified separately; no fabricated soundtrack is added. Physical iOS silent-switch behavior remains unverified. #402 must retain that acceptance item.
- The maintainer asked to stop stressing the old Android and defer further physical performance work until a newer phone is available. Collection has stopped and the demo was closed. Do not require more runs on this device or use these exploratory timings as a product performance conclusion. #415 and the existing performance work #405/#406 retain the newer-device follow-up.

The phone intermittently failed to initialize EGL at process startup (`EGL_NOT_INITIALIZED` in the system RenderThread, also observed before this batch). Failed starts were excluded from recordings and measurements. The final measured session and recorded interactions completed. This is a limitation of this acceptance environment, not proof of either an engine defect or immunity to device faults. Preserve error logs if reproducing; never retry a failed interaction silently or count a crashed run as a pass.

## Repeatable inspector workload

`demo/src/inspection-audit.ts` registers three compiled native drawing properties. Each variant performs five phases of 50 setter rounds across all three properties, followed by a 180 ms group animation and a short idle interval. Run one warmup per variant and five alternating repetitions each with collection disabled/enabled. The same native Choreographer/CPU/ART probe runs in both variants. Inspection happens after the timed window. No screen recorder runs during measurement.

Launch the normal demo with `interaction-depth=inspector`, `depth-measure=true`, `depth-audit=true`, then collect `inspection-measurements.json` from the app files directory. The report must say `complete: true` and contain 12 runs including the two warmups. Do not rerun on the old phone following the maintainer's instruction; this protocol is for a future suitable device.

The browser counterpart is `node benchmarks/web-interaction-depth/measure.mjs OUTPUT.json`. It writes actual WebGL uniforms with the same phase counts, alternates inspector off/on and uses the same RAF callback probe in both. It measures JS wall time, not process CPU or allocation. Browser rendering uses software WebGL in automation.

Exploratory Android results, excluding warmups:

| Observation                              |               Collector off |                Collector on |
| ---------------------------------------- | --------------------------: | --------------------------: |
| Median per-run setter burst (150 writes) |                   40.902 ms |                   52.444 ms |
| Median per-run group preparation         |                   11.637 ms |                   10.738 ms |
| Median process CPU per run               |                      768 ms |                      807 ms |
| Callback interval p50 / p95 / p99        | 16.733 / 53.792 / 71.503 ms | 16.732 / 61.057 / 81.174 ms |
| Median ART allocated bytes per run       |                     339,968 |                     323,584 |

Each burst deliberately repeats redundant writes. The collector identifies approximately 191.95 ms of observed JS update work per enabled run, with bounded event loss reported explicitly. This locates a real bridge/update hotspot in this deliberately inefficient fixture; it does not establish the cost of a normal grouped animation. The practical application experiment is to collapse redundant setters to the last meaningful value, then measure the actual app on suitable hardware. That optimization is not inferred from the numbers or silently applied to user callbacks.

Collector instrumentation has a visible cost in this fixture and remains opt-in. Off/on here means the same candidate with observation disabled/enabled, not a comparison against an uninstrumented release. ART excludes V8 and native/GPU allocations; differing allocation totals do not establish an allocation win. RSS is not PSS. Callback opportunities are not presented frames. Timing covers JS preparation/observed writes, not total bridge/native sampling/GPU time. No CPU/PSS advantage over Reanimated is claimed.

Chromium's median setter burst was below the 0.1 ms timer resolution when off and 0.1 ms when on; p95 callback intervals were 17.5 ms in both variants. These values are near timer resolution and describe only this host/software renderer. They cannot establish zero overhead, native equivalence or hardware performance. Full raw distributions, source identity and summaries remain available.

## Reproducing demonstrations

Build the library, then the native demo separately per platform with production JavaScript. The demo accepts `--interaction-depth=drop|audio|inspector|path|depth|shadow` and `--depth-audit`.

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID OUTPUT_DIR testInteractionDepth
python3 benchmarks/record-interaction-android.py SERIAL OUTPUT_DIR ADB_PORT
node benchmarks/web-interaction-depth/record.mjs OUTPUT_DIR
node benchmarks/web-interaction-depth/record-tools.mjs OUTPUT_DIR
```

Only use a device explicitly available for testing; do not resume the old-phone collection without a new instruction. Android recording restores its previous touch-indicator setting. The scripts assert scene-specific drop acceptance/audio completion and fail on interaction errors. Native inspector clips distinguish iOS SceneKit uniforms from Android non-shader drawing adapters. The browser fixture exercises real WebGL uniforms; no renderer/GPU cost is inferred from the video.

The separate Web tooling recording uses actual button input over the optional public inspector/testing entries: pause, seek, application-owned spring tuning, copyable code, and an explicit target-change trace replayed twice with matching checkpoints and no remaining replay resources. Existing reviewed native inspector and replay recordings are reused alongside it. These recordings do not claim automatic OS input interception.

## Mavis adoption audit

Audited Mavis main `e46d2bd6a6d0cad17c425dd6cb6b12d0905eaf3e`, including current source plus open/closed issues. Follow-ups:

- [Mavis #296](https://github.com/getcortexlabs/mavis-ui/issues/296): existing shared Kanban target selection and native/Web drag wiring can consume Jolt drop zones while preserving controlled moves, insertion policy and accessible alternatives. Distinct from keyed reorder #237.
- [Mavis #297](https://github.com/getcortexlabs/mavis-ui/issues/297): existing pull-only diagnostics #209 do not expose editable playback or an application semantic replay adapter. Borrow current collectors and preserve shared identities/lifecycle; #262 remains the surface-error task.
- [Mavis #298](https://github.com/getcortexlabs/mavis-ui/issues/298): shared MotionValues validation currently accepts only x/y/rotate/scale/opacity. Paths, rotateX/Y and supported shadow contracts must extend shared definitions and both adapters together. Drawing/morph issue #246 is separate from moving a surface along a path.

No current local-audio consumer or custom-uniform scene justifies a new speculative Mavis audio/uniform task. All new dependencies remain pending Jolt review/publication; Mavis implementation stays in its own workstream.
