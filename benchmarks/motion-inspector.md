# Motion inspector (#64)

The optional `/inspector` entry installs development driver hooks only when `createMotionInspector({ development: true })` is called. Native display callbacks fill a preallocated ring, with one JSON batch per explicit `read()`. The panel reads every 200 ms. No native sample calls JavaScript. Native probe classes are bundled but dormant in apps that do not start one; the production core JavaScript bundle contains neither inspector hooks nor UI.

## Validation

`test/inspector.spec.ts` covers read-only selection of an existing owner, interruption boundaries and names, delayed timing, layers, real binding topology without subscriptions, explicit scrubbing, bounded/detached histories, unsupported/missing observations, unload/background cleanup, selection changes and exported spring settings on a fresh view.

`runMotionInspectorChecks` exercises the actual native buffer, overflow accounting, delayed ownership, interruption, held native/model comparison, a deliberate wrong-position assertion, dependency graph, layered owners and cleanup on iOS/Android. It compares median setup time over nine animations after three warm-up runs in each mode, with and without the inspector. It reports JavaScript hook/read cost separately from native collection/serialization cost. These are instrumented local timings, not universal performance limits or a frame-rate comparison; phase order and runtime warm-up can affect the setup comparison. The report excludes UI rendering, and drain CPU includes the preceding batches. The existing native CI replay group runs it; no additional job, emulator or watchdog is added.

The probe samples presentation-layer values on iOS and View properties on Android. Android callback ordering may observe the previous animation frame. Requested hertz is not measured physical refresh. Native samples have no model fallback. Unsupported properties, missing presentation and source curves that cannot be reconstructed remain explicitly unavailable. App writes and third-party animation boundaries are outside the hook's coverage.

The full native run must leave zero extra probes and the exact previous driver; disposing inspection must not stop playback. The real-input demo test additionally adjusts controls, copies configuration, restarts the app and verifies saved knobs, and checks the Portuguese/system-language route.

## Recorded local results

The reports in [`results/motion-inspector/`](./results/motion-inspector/) came from the issue #64 working tree based on `30e0e7e`, using production JavaScript. Both platforms passed all 12 native CI groups and detected the injected failure. These simulator/emulator measurements include seven explicit reads, not panel rendering or physical-display frame rates.

| Measurement                                  | iOS 26 simulator | Android 16 emulator |
| -------------------------------------------- | ---------------: | ------------------: |
| Inspector check duration                     |           916 ms |              915 ms |
| Instrumented JS read cost, total             |         2.087 ms |            1.433 ms |
| Instrumented JS hook cost, total             |         0.604 ms |            0.473 ms |
| Native observations collected                |               52 |                  37 |
| Native collection cost, total                |         7.421 ms |            0.267 ms |
| Native serialization cost, preceding batches |         0.634 ms |            0.471 ms |
| Extra probes after disposal                  |                0 |                   0 |

The buffer test intentionally stops draining long enough to drop old observations. Scrubbing then uses a fresh animation paused synchronously, so a delayed JavaScript timer cannot accidentally try to pause an already completed animation. The held native position must agree with the expected curve within 2 DIP; adding an intentional 80-DIP mismatch must fail.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run typecheck
npm run benchmark:typecheck
node benchmarks/inspector-production.mjs
```

Build native platforms sequentially using the [native CI guide](./native-ci.md). In the normal preview, experiment 59 is **Motion inspector / Inspetor de movimento**. An isolated run accepts `--motion-inspector`; `--inspector-checks` writes `jolt-inspector-checks.json` in Documents and Android's external app files. Copy writes `jolt-inspector-settings.json` and the OS clipboard.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltInspectorIOS testMotionInspector testMotionInspectorPortuguese
python3 benchmarks/motion-inspector-android.py YOUR_EMULATOR /tmp/JoltInspectorAndroid
```

Inspect both recordings, then compress them as H.264 MP4, keeping capture timing. They belong in both guides and as playable PR attachments. Source solvers and playback timing are unchanged. The demo's copied spring deliberately specifies its initial position and zero incoming velocity; interrupted returns are a separate interaction.
