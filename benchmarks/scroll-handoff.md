# Scroll → sheet replay

Completes the handoff case from #63 after the interrupted spring and cancelled drag in #211. No new workflow: the existing recorded-interaction group runs an independent headless ownership contract, the production native consumption policy, and a deliberately wrong scroll checkpoint. Its canonical fixture is [scroll-sheet-handoff.json](./traces/scroll-sheet-handoff.json).

The fixture checks scroll-to-top before sheet collapse, sheet expansion before upward content scroll, same-contact reversal, held velocity at the seam, a 288 ms gap, pointer membership rebasing, cancellation with ignored stale motion, suspension/resume, bounds, a fresh contact and final rest. Twenty 0.1 DIP steps detect per-sample Android pixel rounding drift. Canonical position tolerances are 1 DIP (0.5 DIP for fractional accumulation); velocity tolerance is 0.1 DIP/s at the ownership checkpoints.

iOS routes the same **consumeScrollDelta** method as its recognizer. Android calls the production **consume** method around the actual child scroll, matching the pre/child/post nested-scroll sequence. These hooks require an isolated replay-only session; normal controllers reject them. The native adapter retains real live-value nodes and a native binding, reads iOS presentation layers / Android translation getters and actual content offset, then disposes the session, binding, delegate wrapper and nodes. Its resource audit requires the node count to return to baseline.

This is a held-contact adapter, not a free-running live-spring clock. Release holds position; fling, automatic snap selection, keyboard timing and full bottom-sheet recipe behavior remain in the existing real-input tests. Raw touch capture observes Core events and numeric window coordinates, not recognizer decisions or user content. The preview freezes the headless contract's oracle during capture; native replay never regenerates expected values.

## Reproduce

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run benchmark:typecheck
```

Use [native-ci.md](./native-ci.md) to build and run the isolated CI app with explicit device IDs. There are still 12 baseline groups and the existing app watchdog. Failure JSON/SVG use the current run ID and the existing artifact upload.

Build the normal Vue demo with **JOLT_BENCHMARK=1**, following [CONTRIBUTING.md](../CONTRIBUTING.md). Rebuild native classes and metadata when changing the plugin; an incremental Android build with stale metadata cannot expose the new replay methods. Always build platforms sequentially.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltHandoffIOS testScrollHandoffReplay testScrollHandoffReplayChecks
python3 benchmarks/scroll-handoff-android.py YOUR_EMULATOR_SERIAL /tmp/JoltHandoffAndroid
```

Both runners inject actual OS drags and assert that the sheet moves down after scroll-to-top, then returns to its expanded position before content scrolls upward. They record numeric events, replay the frozen take through both adapters and reject a wrong scroll expectation. The canonical checks separately test same-contact reversal and cancellation. Isolated launch uses **--scroll-handoff**, with optional **--handoff-checks** (equivalent string extras on Android). Normal preview navigation exposes the same lab inside experiment 57.

Files in app Documents (also external app files on Android): **jolt-handoff-trace.json**, **jolt-handoff-replay.json**, **jolt-handoff-replay.svg**, **jolt-handoff-checks.json**. Nothing uploads automatically. Reviewed MP4s are embedded in the EN/PT interaction replay guides. [Recorded results](./results/scroll-handoff/) retain per-platform numeric evidence and the negative-control plot.

## Português

O handoff da #63 agora passa pelo contrato independente e pela política nativa de consumo. Os mesmos gestos reais são gravados e reproduzidos nos simuladores. O controle negativo altera o offset esperado da lista e precisa falhar. A captura não guarda texto das notas nem handles nativos; posições usam DIP e velocidade usa DIP/s.

O teste usa o grupo existente do CI, sem workflow novo. O adaptador segura a posição ao soltar e não controla springs retidos em movimento livre. Snap automático, fling, teclado e arbitragem do reconhecedor continuam nos testes de SO da receita completa. As tolerâncias menores para passos fracionários detectam a perda acumulada de pixels no Android.
