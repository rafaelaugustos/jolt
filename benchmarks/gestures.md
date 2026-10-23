# Native gesture validation

The optional `gestures` entry owns native recognizers/dispatch on a `GestureSurface`. Pan, pinch and rotation share retained live spring outputs. iOS uses UIKit recognizers and a forwarding scroll delegate; Android uses native touch dispatch and `NestedScrollingParent3`. JavaScript runs setup and requested state callbacks, not every pointer movement. The integration preserves Core touch listeners and Core's lazily attached iOS scroll delegate, including listeners added or removed after setup.

The built-in relationships cover simultaneous transforms, single tap waiting for double tap, one-axis failure and vertical Core ScrollView handoff. This is not an arbitrary graph of external recognizers or an adapter for list plugins. Tested versions are Core 9.1.3, iOS runtime 9.1.0 and Android runtime 9.1.1.

## Executable checks

- `test/gestures.spec.ts` checks retained-value ownership, replacement validation, mapped outputs, partial moves/bounds, supported scroll ancestry, scope/app suspension, disabled interaction, deferred setup failure and reentrant callbacks with a fake bridge.
- `test/gesture-scroll-delegate.spec.ts` checks per-instance Core delegate hooks and cleanup without replacing a newer owner.
- `benchmarks/gesture-lifecycle-checks.ts` runs in Native CI on both platforms. It checks native bounds/settle continuity, scope cancellation, retained-node cleanup and preservation of an existing Core scroll listener. On iOS it also checks Core's delegate after removing/adding the last listener and after disposal.
- `benchmarks/live-spring-checks.ts` measures the actual native location of a view with a nonzero live translation bound before its first layout, then changes its width. This caught an iOS frame-origin regression that a transform getter alone missed. Live bindings now retain the existing instance layout guard.
- `benchmarks/docs-ios-ui.swift` (`testGestureComposition`) uses XCTest and OS multi-touch injection to check simultaneous transforms, finger membership changes, independent gestures, tap exclusivity, an existing Core tap listener, a horizontal carousel inside vertical scrolling, and panel/content handoff in both directions. `testGestureNavigation` leaves the screen during an active OS drag; `gesture_navigation.py` requires one cancellation, no end callback, disposal and the original native-node count.
- `benchmarks/docs-record-gestures-android.py` uses real emulator input for the same scenarios, including an explicit pointer cancellation and navigation during a held drag, with the same cleanup assertions. `gesture-input/build.py` builds its shell-only multi-touch injector; pass the generated jar as the recording script's third argument. No injector or private XCTest interface is shipped in Jolt.

The native baseline passed locally on an iOS 26.0 simulator and an Android 16 emulator with production JavaScript and HMR disabled: 11 groups, 20 size checks, and the separately verified deliberate midpoint failure on each platform. Android uses a debuggable shell for report extraction. Hosted Native CI records the tested commit in its artifacts.

## Recordings and limits

Six reviewed native recordings are embedded in both guides: composition, carousel/axis competition and panel/content handoff on each platform. The final videos show actual OS input, preserve playback speed and decode completely. Neither simulator/emulator footage nor synthetic solver time steps establish physical-device performance. Native input, live springs, Core listeners and opted-in JS callbacks still share the UI thread.

Android handoff requires Core's vertical NestedScrollView implementation; iOS handoff forwards the existing UIScrollView delegate and keeps Core listener attachment working. Third-party delegate replacement, horizontal inner scrolling, RecyclerView/ListView adapters and a generic recognizer relationship graph require separate integration and tests. The panel demo demonstrates handoff, not a complete bottom-sheet recipe.

## Português

As seis gravações revisadas mostram composição simultânea, carrossel horizontal dentro de rolagem vertical e transferência entre painel/conteúdo em simulador iOS e emulador Android. Os testes usam entrada real do SO, inclusive múltiplos dedos; o cancelamento explícito também é exercitado no Android. Os injetores pertencem somente ao harness de gravação.

O baseline nativo valida lifecycle, atualização de limites sem zerar velocidade, descarte e preservação do listener/delegate de scroll. Uma regressão mede a posição real de uma view iOS com binding aplicado antes do primeiro layout, inclusive após mudar a largura. A integração suporta o ScrollView vertical do Core nas versões acima. Não há promessa de suporte a plugins de listas, substituição arbitrária de delegates, desempenho em aparelhos físicos ou isolamento da thread de UI.
