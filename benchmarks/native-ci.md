# Native CI

The `Native CI` workflow builds a small, isolated app from this checkout and runs it on an iOS simulator and an Android emulator for pull requests that can affect native behavior. It uses production JavaScript with HMR disabled. Android's native shell is debuggable so `adb run-as` can retrieve the reports; this does not validate R8 or a signed release APK.

## When it runs and time limits

A small Linux job compares the PR merge tree with its base. Changes confined to documentation, media, JS unit tests or the docs workflow skip the two native jobs. Source, dependencies, fixture/build configuration and unknown files still run both platforms. The workflow itself always reports a result, avoiding a required check stuck pending because of workflow-level path filtering. If classification fails, native checks still run. Manual dispatch always runs the full suite.

Native checks run before merge, without an automatic duplicate on every push to `main`. The ordinary JS CI and docs deployment still run on `main`. A direct push that bypasses a PR needs a manual Native CI dispatch; release maintainers can also dispatch it for an additional check of the merged commit.

Each native job has a **10-minute execution limit**, down from 35. This does not bound time waiting for a GitHub-hosted runner. iOS starts booting immediately after checkout, overlapping initialization with dependency installation and compilation. The probe allows 180 seconds of remaining boot wait and 120 seconds to install. Android caches Gradle dependencies, builds before allocating the emulator, and allows 180 seconds for emulator boot. Build and device-test steps each have a 5-minute ceiling within the job's overall limit. No test assertion is retried or skipped to meet the budget.

The same 11 groups, 20 dimension checks and exact negative control remain required. `timings.json` records simulator readiness, installation, app launch and probe durations, including a failed phase; command timeouts retain partial output. Optional diagnostic commands are limited to 10 seconds each. These limits fail a stalled run rather than turning incomplete checks into a pass.

The probe reads iOS **presentation layers**, without falling back to model layers, and Android native view getters. It checks combined transforms and opacity, intermediate playback, pause/resume, interruption, shared motion-value bindings, scope cleanup, unload/reload, reduced motion, and the existing 20 StackLayout/GridLayout dimension checks. Position tolerances are 2–3 DIP (6 DIP during interruption), scale/opacity 0.04, and rotation 2°. Timing checks allow a broad intermediate window; this is a correctness gate, not a performance benchmark or a physical-device test.

After the baseline, a second launch intentionally expects 160 DIP at a native midpoint of 60 DIP. CI accepts this negative control only when that exact assertion fails and the measured midpoint is still within tolerance. Each launch has a unique ID, and the host checks the source commit, production mode, platform, and complete check list. Old reports, missing checks, crashes, and watchdog timeouts cannot turn into a passing run.

The baseline also checks retained live spring chains, reversal continuity, scope suspension, native layer composition, animated sources, rest/wake and disposal. See [live spring validation](./live-springs.md) for the solver checks and limits.

The baseline now includes 11 groups, plus the 20 dimension checks. Gesture checks cover retained values, bounds retargeting without a velocity reset, scope cancellation, native node cleanup and existing ScrollView delegate/listener preservation. A live-binding regression probe measures the actual location of a translated view before and after its first layout and a later width change. Actual OS multi-touch/scroll recordings run separately; see [gesture validation](./gestures.md).

Dependencies and native templates are pinned in `native-app/package-lock.json`. Webpack is pinned to 5.101.3 because NativeScript's worker loader uses the `webpack/lib/dependencies/WorkerDependency` layout. Generated resources and builds stay inside the fixture, separate from `demo`. Node 22, Python 3, and a working NativeScript platform toolchain are required.

```sh
npm ci
npm run build
npm run benchmark:typecheck
python3 -m unittest discover -s benchmarks -p 'test_native_ci*.py'
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

O workflow `Native CI` compila um app isolado a partir do checkout e executa os testes em simulador iOS e emulador Android nas PRs que podem afetar comportamento nativo. O JavaScript usa produção, sem HMR. No Android, o shell nativo permite depuração para extrair os relatórios com `adb run-as`; o teste não valida R8 nem APK assinado de release.

Um job Linux compara a árvore proposta com sua base. Alterações somente em documentação, mídia, testes unitários JS ou workflow de docs pulam os jobs nativos; código, dependências, configuração de build/fixture e arquivos desconhecidos continuam executando ambos. O workflow sempre reporta um resultado, e uma falha na classificação não impede os testes nativos. A execução manual roda a suíte completa.

O CI nativo roda antes do merge, sem repetir automaticamente em cada push para `main`. O CI JS e o deploy de docs continuam rodando na `main`. Um push direto que não passa por PR exige disparar o Native CI manualmente; também é possível fazê-lo para conferir um commit de release já integrado.

Cada job nativo tem **limite de execução de 10 minutos**, antes 35. A fila de runners do GitHub não está incluída nesse limite. O iOS começa o boot logo após o checkout, enquanto instala dependências e compila; depois espera no máximo 180 segundos restantes pelo boot e 120 pela instalação. O Android reutiliza dependências Gradle, compila antes de iniciar o emulador e limita seu boot a 180 segundos. Build e testes no dispositivo têm teto de 5 minutos por etapa, dentro do limite total. Não há retry nem remoção de assertions para caber no orçamento.

Permanecem os 11 grupos, 20 testes de dimensões e o controle negativo exato. `timings.json` registra a duração de cada fase, inclusive falhas, e os timeouts preservam a saída parcial dos comandos. Diagnósticos opcionais têm limite de 10 segundos por comando.

O probe lê a **presentation layer** do iOS e os getters nativos do Android. Valida transformações combinadas, opacidade, posições intermediárias, pausa/retomada, interrupção, motion values compartilhados, limpeza de escopo, unload/reload, redução de movimento e os 20 testes existentes de dimensões em StackLayout/GridLayout. As tolerâncias são 2–3 DIP para posições (6 DIP na interrupção), 0,04 para escala/opacidade e 2° para rotação. É uma verificação de comportamento em simulador, sem promessa de desempenho ou cobertura de aparelhos físicos.

Uma segunda execução espera propositalmente 160 DIP onde a posição medida deve ser 60 DIP. Só essa falha específica é aceita como controle negativo. IDs únicos, commit, modo de produção, plataforma e lista completa de testes impedem que um relatório antigo ou incompleto passe. Os comandos acima também servem para execução local. Use dispositivos dedicados com ID explícito e compile uma plataforma de cada vez. O runner deixa o dispositivo ligado para inspeção e ajusta as escalas de animação do emulador Android para 1.

O baseline também valida cadeias de springs retidos, continuidade nas reversões, suspensão do escopo, composição nativa de camadas, fontes animadas, repouso/retomada e descarte. A [validação dos springs](./live-springs.md) descreve os testes dos solvers e seus limites.

O baseline inclui 11 grupos, além dos 20 testes de dimensões. Os testes de gestos validam valores retidos, atualização de limites sem zerar velocidade, suspensão, descarte e preservação do delegate/listener existente do ScrollView. Uma regressão de binding mede a localização real da view traduzida antes/depois do primeiro layout e de uma mudança de largura. Os testes com entrada multitouch do SO e as gravações são separados: veja a [validação de gestos](./gestures.md).

Os artefatos `native-ios` e `native-android` guardam JSON, logs e uma captura final, inclusive em falhas. A captura final costuma mostrar a falha esperada do controle negativo; o resultado normal está em `baseline.json`. As gravações existentes continuam nos guias EN/PT. Qualquer mudança de comportamento visual público continua exigindo gravação nativa revisada conforme `CONTRIBUTING.md`.
