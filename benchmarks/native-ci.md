# Native CI

The `Native CI` workflow builds a small, isolated app from this checkout and runs it on an iOS simulator and an Android emulator for every pull request and push to `main`. It uses production JavaScript with HMR disabled. Android's native shell is debuggable so `adb run-as` can retrieve the reports; this does not validate R8 or a signed release APK.

The iOS job runs on `macos-26` with the image's Xcode and a preinstalled iPhone simulator. A simulator's first boot migrates data for several minutes on these runners, so the job starts booting right after checkout, compiles while the boot runs, and only then waits for boot (12 minutes at most) and keeps the boot log. Before the probe, the host launches Settings once so a slow SpringBoard shows up there rather than in the measurements. A `simctl launch` that hangs is terminated and attempted again, up to three times; native assertions are never skipped or rerun, and the unique run ID still rejects stale reports. The broader workflow optimization remains in #201.

The probe reads iOS **presentation layers**, without falling back to model layers, and Android native view getters. It checks combined transforms and opacity, intermediate playback, pause/resume, interruption, shared motion-value bindings, scope cleanup, unload/reload, reduced motion, and the existing 20 StackLayout/GridLayout dimension checks. Position tolerances are 2–3 DIP (6 DIP during interruption), scale/opacity 0.04, and rotation 2°. Timing checks allow a broad intermediate window; this is a correctness gate, not a performance benchmark or a physical-device test.

The Flexbox pause/resume check observes real native bounds before pausing, with a three-second deadline. It requires the same intermediate range (more than 10 DIP from the start and more than 5 DIP from the end). This accounts for `animateSize()` starting its clock on the first layout frame rather than at the API call. A stalled layout, a jump past the intermediate range or a missed deadline still fails; sibling allocation, scale, pause stability and final size checks are unchanged.

After the baseline, a second launch intentionally expects 160 DIP at a native midpoint of 60 DIP. CI accepts this negative control only when that exact assertion fails and the measured midpoint is still within tolerance. Each launch has a unique ID, and the host checks the source commit, production mode, platform, and complete check list. Old reports, missing checks, crashes, and watchdog timeouts cannot turn into a passing run.

The baseline also checks retained live spring chains, reversal continuity, scope suspension, native layer composition, animated sources, rest/wake and disposal. See [live spring validation](./live-springs.md) for the solver checks and limits.

The baseline now includes 16 groups, including 20 existing dimension checks and 19 native capability checks. Gesture checks cover retained values, bounds retargeting without a velocity reset, scope cancellation, native node cleanup and existing ScrollView delegate/listener preservation. A live-binding regression probe measures the actual location of a translated view before and after its first layout and a later width change. Actual OS multi-touch/scroll recordings run separately; see [gesture validation](./gestures.md). The drop-zone group drives a real card through scripted pans on its handle view: only the handle holds a pan recognizer, move reports match the card's window location, a 50 DIP spacer inserted above the card during the drag leaves it in place (re-anchoring), 60 DIP bottom padding accepts a release below a short column and rejects one beyond it, cancellation and pause stop reports, and reduced motion returns a rejected drop at once. The path group (#479) replaces a path 600 ms into its 1,400 ms run with an immediate set, running and paused, naming x/y/rotate or only x/y, and with a 300 ms replacement, and reads the native translation and rotation, not only the model. The pointer group dispatches in-app mouse hover events through the Android window callback over a rotated and scaled region, then a region scaled below 1, and checks the normalized point, exit, re-entry, disposal and the restored callback; on the iPhone simulator it checks that hover reports unavailable and adds no recognizer. It does not exercise a physical mouse, a trackpad or device removal.

The recorded-interaction group replays three frozen traces against the controlled engine and native presentation, then rejects a deliberately wrong checkpoint. It adds no workflow or real-time settling wait. Failure artifacts include the trace/report JSON and expected/observed SVG, retrieved only for the current run ID. See [interaction replay](./interaction-replay.md).

Dependencies and native templates are pinned in `native-app/package-lock.json`. Webpack is pinned to 5.101.3 because NativeScript's worker loader uses the `webpack/lib/dependencies/WorkerDependency` layout. Generated resources and builds stay inside the fixture, separate from `demo`. Node 22, Python 3, and a working NativeScript platform toolchain are required.

```sh
npm ci
npm run build
npm run benchmark:typecheck
python3 -m unittest discover -s benchmarks -p 'test_native_ci.py'
cd benchmarks/native-app
npm ci
npm run prepare:resources
npx ns build ios --env.production --no-hmr --for-device false --release
cd ../..
python3 benchmarks/native-ci.py ios --device YOUR_SIMULATOR_UUID
```

For Android, build with `npx ns build android --env.production --no-hmr` in the fixture, then run `python3 benchmarks/native-ci.py android --device emulator-PORT` from the repository root. Build the two platforms sequentially because NativeScript shares generated assets. Always use a dedicated simulator/emulator and an explicit device ID; the host never targets a physical Android device. The Android runner restores animation scales to 1 on that test emulator. The local runner leaves the device booted for inspection.

Reports, native logs, any `nativeapp` crash reports, and a final diagnostic screenshot are written to `benchmarks/native-app/results/` and uploaded as `native-ios` / `native-android` workflow artifacts even on failure. The final screen normally shows the expected negative-control failure; consult `baseline.json` for the baseline outcome. Existing feature recordings remain the visual evidence in the EN/PT guides. Changes to public visual behavior still require reviewed native recordings under `CONTRIBUTING.md`.

## Português

O workflow `Native CI` compila um app isolado a partir do checkout e executa os testes em simulador iOS e emulador Android em cada PR e push para `main`. O JavaScript usa produção, sem HMR. No Android, o shell nativo permite depuração para extrair os relatórios com `adb run-as`; o teste não valida R8 nem APK assinado de release.

O probe lê a **presentation layer** do iOS e os getters nativos do Android. Valida transformações combinadas, opacidade, posições intermediárias, pausa/retomada, interrupção, motion values compartilhados, limpeza de escopo, unload/reload, redução de movimento e os 20 testes existentes de dimensões em StackLayout/GridLayout. As tolerâncias são 2–3 DIP para posições (6 DIP na interrupção), 0,04 para escala/opacidade e 2° para rotação. É uma verificação de comportamento em simulador, sem promessa de desempenho ou cobertura de aparelhos físicos.

O teste de pausa/retomada do Flexbox observa as dimensões nativas antes de pausar, com prazo de três segundos. Mantém o mesmo intervalo intermediário: mais de 10 DIP do início e mais de 5 DIP do final. Isso considera que `animateSize()` inicia seu relógio no primeiro frame de layout, não na chamada da API. Layout parado, salto além do intervalo intermediário ou prazo excedido continuam falhando. As verificações de posição do irmão, escala, estabilidade durante a pausa e tamanho final permanecem iguais.

Uma segunda execução espera propositalmente 160 DIP onde a posição medida deve ser 60 DIP. Só essa falha específica é aceita como controle negativo. IDs únicos, commit, modo de produção, plataforma e lista completa de testes impedem que um relatório antigo ou incompleto passe. Os comandos acima também servem para execução local. Use dispositivos dedicados com ID explícito e compile uma plataforma de cada vez. O runner deixa o dispositivo ligado para inspeção e ajusta as escalas de animação do emulador Android para 1.

O baseline também valida cadeias de springs retidos, continuidade nas reversões, suspensão do escopo, composição nativa de camadas, fontes animadas, repouso/retomada e descarte. A [validação dos springs](./live-springs.md) descreve os testes dos solvers e seus limites.

O baseline inclui 16 grupos, incluindo os 20 testes de dimensões existentes e 19 testes das novas capacidades nativas. Os testes de gestos validam valores retidos, atualização de limites sem zerar velocidade, suspensão, descarte e preservação do delegate/listener existente do ScrollView. Uma regressão de binding mede a localização real da view traduzida antes/depois do primeiro layout e de uma mudança de largura. Os testes com entrada multitouch do SO e as gravações são separados: veja a [validação de gestos](./gestures.md). O grupo de drop zones move um card real com pans programados na view da alça: só a alça tem reconhecedor de pan, os relatórios de movimento coincidem com a posição do card na janela, um espaçador de 50 DIP inserido acima do card durante o arrasto não o tira do lugar (reancoragem), 60 DIP de padding inferior aceitam soltar abaixo de uma coluna curta e rejeitam além disso, cancelamento e pausa interrompem os relatórios, e a redução de movimento devolve na hora um drop rejeitado. O grupo de path (#479) substitui um path aos 600 ms de 1.400 ms por um set imediato, rodando e pausado, com x/y/rotate ou só x/y, e com uma substituição de 300 ms, e lê a translação e a rotação nativas, não só o modelo. O grupo de ponteiro envia eventos de hover de mouse dentro do app pelo callback da janela Android sobre uma região girada e ampliada, depois sobre uma região com escala menor que 1, e confere o ponto normalizado, a saída, a reentrada, o descarte e o callback restaurado; no simulador de iPhone confere que o hover aparece indisponível e que nenhum reconhecedor é adicionado. Não exercita mouse físico, trackpad nem remoção de dispositivo.

Os artefatos `native-ios` e `native-android` guardam JSON, logs e uma captura final, inclusive em falhas. A captura final costuma mostrar a falha esperada do controle negativo; o resultado normal está em `baseline.json`. As gravações existentes continuam nos guias EN/PT. Qualquer mudança de comportamento visual público continua exigindo gravação nativa revisada conforme `CONTRIBUTING.md`.

O grupo de replay executa três traces fixos no motor controlado e na apresentação nativa, além de rejeitar um checkpoint propositalmente errado. Usa o job existente, sem espera pelo tempo real de repouso. Falhas incluem JSON e gráfico SVG, coletados apenas para o ID da execução atual. Veja a [validação do replay](./interaction-replay.md).

The scroll→sheet portion exercises the production native gesture consumption code and takes about 3 seconds locally (including an independent reference and native negative control). It checks both positions, cancellation, contact rebasing and fractional-pixel accumulation; see [handoff validation](./scroll-handoff.md).

The same replay group also verifies [adaptive curve sampling](./curve-sampling.md) at 60/120 Hz logical presentation times, with integer-millisecond Android seeks, interruption continuity and a negative control. The added portion took about 0.8 seconds locally; it does not create another workflow or emulator.

The native capability group covers retained color/radius bindings, finite scene seeking, FlexboxLayout reflow and body-to-body springs. It shares the existing app and OS jobs. See [scope, measurements and recordings](./native-capabilities.md).
