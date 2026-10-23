# Live spring validation

`springValue()` uses the same analytical constant-target spring solution in C and Java, with persistent position and velocity. A shared CADisplayLink/Choreographer callback steps older nodes before their followers, using substeps of at most 1/240 second and a 64 ms catch-up limit. Fixed-target animations continue to use the existing sampled native playback.

Android's `SpringAnimation.animateToFinalPosition` was considered as a platform-specific alternative. The shared equations let both platforms use the same target sampling, follower order, rest criteria and layer composition without an AndroidX dependency. This is an architectural choice supported by trajectory checks, not a measured performance comparison against AndroidX.

## Executable checks

- `python3 benchmarks/live-spring-tests/test_solver.py` compiles the production C and Java kernels. Five checks cover 500 seeded parity cases across damping regimes, energy/equilibrium, position and velocity continuity on retarget, step partitioning, and a three-link chain at simulated 60/120 Hz with repeated reversals and a delayed frame. The delayed-frame check compares bounded integration against uncapped catch-up; it is not a hardware refresh-rate measurement.
- `test/live-spring.spec.ts` exercises native node ownership, source playback boundaries, mapped native chains, independent layers, unload/reload, reduced motion, app/scope suspension, explicit observers and invalid inputs. Scalar target updates do not request a sampled track. These tests use a fake bridge and do not prove native rendering.
- `benchmarks/live-spring-checks.ts`, part of Native CI, reads actual native state and view properties. It covers three followers, reversal continuity, pause/resume, a paused additive layer, an animated source, 300 consecutive target updates without allocating additional native nodes, delayed UI delivery, rest/wake, reduced motion, repeated/descending mappings and disposal. The host requires the complete baseline and a separate intentional geometry failure.

The native suite passed locally on an iOS 26.0 simulator with NativeScript iOS 9.1.0 and an Android 16 emulator with NativeScript Android 9.1.1, both using core 9.1.3 and production JavaScript without HMR. Android uses a debuggable shell for report extraction. CI stores the tested commit and complete results in the `native-ios` and `native-android` artifacts.

## Recordings and limits

The Live springs native demo was recorded with actual touch interaction on both platforms. Reviewed recordings are embedded in the English and Portuguese live-springs guides. They show three followers, abrupt target changes, dragging, a separate shake layer and reduced motion.

Scalar retargeting uses a direct native setter and retains its existing node and bindings. The C/Java solver step does not allocate a track. Animated source snapshots and changes to layer membership still allocate boundary data. The native-node count assertion does not establish zero total heap allocation; there is no physical-device allocation or frame-time profile in this report.

Both live schedulers execute on the UI thread. They do not isolate movement from busy JavaScript on that thread. The demo's touch input also enters JavaScript. Native gesture recognition/scroll handoff has its own [validation report](./gestures.md). Native chains and bindings do not require a per-frame JavaScript observer; explicit `subscribe()` does. These results do not claim physical-device 120 Hz performance, R8 coverage, or support for live color/decoration/compound-adapter bindings.

## Português

Os testes compilam os solvers de produção C/Java, comparam trajetórias e validam a integração nativa em simulador iOS e emulador Android. A cadeia de três seguidores foi exercitada com reversões, pausa, fonte animada, camada independente, repouso, retomada e descarte. A simulação de passos de 60/120 Hz não é uma medição em aparelho físico.

As gravações revisadas dos dois demos estão nos guias EN/PT. A atualização escalar mantém o mesmo nó nativo e não reconstrói tracks; isso não é uma promessa de zero alocações totais. Callbacks nativos ao vivo usam a thread de UI, e os eventos de toque desse demo ainda passam por JavaScript. Composição de gestos e transferência para scroll têm um [relatório próprio](./gestures.md).
