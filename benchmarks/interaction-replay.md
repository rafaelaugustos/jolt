# Interaction replay validation

This is the initial stage of #63: an interrupted spring and a cancelled single-pointer drag. The scroll-to-sheet replay adapter remains subsequent work in that issue. No new GitHub workflow is added. The existing native baseline includes one bounded replay group and retains its 90-second app watchdog.

The frozen spring checkpoints use the independent closed-form solution of mass 1, stiffness 170 and damping 26 (underdamped angular frequency 1). It reverses from target 180 to 20 at 96 ms, asserting position and velocity immediately before and after that exact boundary. The trace includes a 288 ms frame gap and a settled checkpoint. The drag fixture asserts cancellation holds position, ignores subsequent move/end, survives suspend/resume and releases all owned resources.

Both fixtures run first through a controllable engine driver and then through actual iOS presentation layers / Android native translation getters. Native tracks are paused and sought to recorded logical timestamps. Velocity and settled state are engine observations. This tests correctness at those instants, not wall-clock scheduling or physical-device performance. The deliberately incorrect native checkpoint must fail by more than 70 DIP. Adapter disposal and driver restoration also run on failure.

## Reproduce

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run benchmark:typecheck
python3 -m unittest discover -s benchmarks -p 'test_native_ci.py'
```

Build and run the existing fixture according to [native-ci.md](./native-ci.md). The baseline now has 12 groups, including the unchanged 20 dimension checks. Replay failures produce **interaction-replay-failure.json** and **interaction-replay-failure.svg** in the existing workflow artifact. The host accepts those files only for the current launch's run ID.

For real OS input and documentation footage, build the normal Vue demo with **JOLT_BENCHMARK=1**, without a native-probe entry flag. Use explicit dedicated devices and build platforms sequentially, as described in [layout-lifecycle.md](./layout-lifecycle.md).

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltReplayIOS testInteractionReplay testInteractionReplayChecks testInteractionReplayPortuguese
python3 benchmarks/interaction-replay-android.py YOUR_EMULATOR_SERIAL /tmp/JoltReplayAndroid
```

The isolated **--interaction-replay** launch opens experiment 57 in English. Add **--replay-checks** to run the canonical cases automatically. Android uses equivalent string extras. Normal launches open the localized collection.

XCTest/ADB inject actual taps and drags into the Core recognizer. The app cancels the drag after 120 ms of movement while the OS contact continues. These tests exercise ordinary touch hit testing and post-cancel input. The existing [gesture](./gestures.md) and [bottom-sheet](./bottom-sheet.md) OS tests still cover multi-touch and scroll arbitration; semantic replay does not replace them.

The preview writes numeric inputs plus raw native observations to **jolt-recorded-presentation.json**. Accepting a take freezes a controlled-engine baseline in **jolt-interaction-trace.json**; later replays do not regenerate it. Native frame startup latency is deliberately excluded from this engine oracle. A replay writes engine/native reports to **jolt-interaction-replay.json** and a plot to **jolt-interaction-replay.svg**. Canonical checks write **jolt-replay-checks.json**. Files live in app Documents (also external app files on Android); nothing is uploaded automatically.

Reviewed recordings live in **docs/public/media/interaction-replay-ios.mp4** and **interaction-replay-android.mp4**, embedded in both language guides. Keep the source timing when compressing with the commands in CONTRIBUTING.md.

## Results and limits

[Recorded results](./results/interaction-replay/) include the canonical engine/native checkpoints on both simulators, full native-CI reports and a deliberately failing expected/observed SVG. They were produced from the feature working tree based on main 9d70479. The maximum canonical native position error was 0.104 DIP (rounded up), within the 3 DIP limit. All canonical replays left zero owned resources; the deliberate 80 DIP mismatch was rejected.

The native driver wrapper temporarily replaces Jolt's global driver. Run in an isolated fixture with matching time scale / Reduced Motion and no concurrent animations. It does not take control of retained native live-spring clocks. OS recognizers, native bottom-sheet ownership, keyboard timing, clipping and arbitrary plugin views require their own adapters and real-input tests. Traces preserve layout, keyboard, scroll and lifecycle events, but the reference graph explicitly rejects routing it does not implement.

## Português

Etapa inicial da #63: spring interrompido e drag cancelado, com checkpoints fixos, relógio controlado, probes de apresentação nativa e controle negativo. O handoff scroll→sheet ainda precisa de adaptador próprio e a issue permanece aberta. A validação aproveita o job existente, sem workflow novo nem espera pelo tempo real de repouso.

Os comandos acima reproduzem testes e vídeos com entrada real do SO. Os relatórios registram posições nativas, velocidade/repouso do motor e zero recursos após descarte. A referência aceita pelo preview é fixa entre replays; a captura bruta de apresentação fica separada por causa da latência de início dos animadores nativos. O JSON não inclui texto digitado ou imagens. Os limites e a fronteira entre replay semântico e teste do reconhecedor estão no [guia em português](../docs/pt-BR/guide/interaction-replay.md).
