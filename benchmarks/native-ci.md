# Native CI

The `Native CI` workflow builds a small, isolated app from this checkout and runs it on an iOS simulator and an Android emulator for every pull request and push to `main`. It uses production JavaScript with HMR disabled. Android's native shell is debuggable so `adb run-as` can retrieve the reports; this does not validate R8 or a signed release APK.

The probe reads iOS **presentation layers**, without falling back to model layers, and Android native view getters. It checks combined transforms and opacity, intermediate playback, pause/resume, interruption, shared motion-value bindings, scope cleanup, unload/reload, reduced motion, and the existing 20 StackLayout/GridLayout dimension checks. Position tolerances are 2–3 DIP (6 DIP during interruption), scale/opacity 0.04, and rotation 2°. Timing checks allow a broad intermediate window; this is a correctness gate, not a performance benchmark or a physical-device test.

After the baseline, a second launch intentionally expects 160 DIP at a native midpoint of 60 DIP. CI accepts this negative control only when that exact assertion fails and the measured midpoint is still within tolerance. Each launch has a unique ID, and the host checks the source commit, production mode, platform, and complete check list. Old reports, missing checks, crashes, and watchdog timeouts cannot turn into a passing run.

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

Reports, native logs, and a final diagnostic screenshot are written to `benchmarks/native-app/results/` and uploaded as `native-ios` / `native-android` workflow artifacts even on failure. The final screen normally shows the expected negative-control failure; consult `baseline.json` for the baseline outcome. Existing feature recordings remain the visual evidence in the EN/PT guides. Changes to public visual behavior still require reviewed native recordings under `CONTRIBUTING.md`.

## Português

O workflow `Native CI` compila um app isolado a partir do checkout e executa os testes em simulador iOS e emulador Android em cada PR e push para `main`. O JavaScript usa produção, sem HMR. No Android, o shell nativo permite depuração para extrair os relatórios com `adb run-as`; o teste não valida R8 nem APK assinado de release.

O probe lê a **presentation layer** do iOS e os getters nativos do Android. Valida transformações combinadas, opacidade, posições intermediárias, pausa/retomada, interrupção, motion values compartilhados, limpeza de escopo, unload/reload, redução de movimento e os 20 testes existentes de dimensões em StackLayout/GridLayout. As tolerâncias são 2–3 DIP para posições (6 DIP na interrupção), 0,04 para escala/opacidade e 2° para rotação. É uma verificação de comportamento em simulador, sem promessa de desempenho ou cobertura de aparelhos físicos.

Uma segunda execução espera propositalmente 160 DIP onde a posição medida deve ser 60 DIP. Só essa falha específica é aceita como controle negativo. IDs únicos, commit, modo de produção, plataforma e lista completa de testes impedem que um relatório antigo ou incompleto passe. Os comandos acima também servem para execução local. Use dispositivos dedicados com ID explícito e compile uma plataforma de cada vez. O runner deixa o dispositivo ligado para inspeção e ajusta as escalas de animação do emulador Android para 1.

Os artefatos `native-ios` e `native-android` guardam JSON, logs e uma captura final, inclusive em falhas. A captura final costuma mostrar a falha esperada do controle negativo; o resultado normal está em `baseline.json`. As gravações existentes continuam nos guias EN/PT. Qualquer mudança de comportamento visual público continua exigindo gravação nativa revisada conforme `CONTRIBUTING.md`.
