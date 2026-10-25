# Movimento que vem do celular

`sensor()` fornece rotação e gravidade ao grafo nativo de valores do Jolt. Uma fonte pode inclinar um cartão, mover o reflexo e deslocar o fundo, com springs nativos suavizando o resultado. Importe pela entrada opcional `@rafaelaugusto/jolt/sensors`. Disponível neste checkout para a próxima beta; recompile o app nativo.

<Clip name="device-sensors-ios" caption="Simulador iOS 26.2: views nativas reais recebem entradas de sensores explicitamente simuladas, com toques reais para pausar, retomar, centralizar e reduzir movimento. Velocidade original. O simulador não tem sensores físicos; não é evidência de desempenho ou coleta em aparelho real." />
<Clip name="device-sensors-ios-pt" caption="Simulador iOS, português: a mesma prévia nativa e controles de ciclo de vida. A tela identifica a entrada simulada." />
<Clip name="device-sensors-android" caption="Emulador Android 16: cartão, luz e paralaxe nativos seguem amostras de teste explícitas. Toques reais por ADB exercitam pausa, retomada e redução de movimento. Velocidade original; não comprova desempenho em aparelho físico." />
<Clip name="device-sensors-android-pt" caption="Emulador Android, português: reprodução nativa com entradas identificadas como simuladas e controles traduzidos." />

## Conectar uma fonte

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { sensor } from '@rafaelaugusto/jolt/sensors'

const scope = motionScope()
const rotation = sensor('rotation', { scope })
const gravity = sensor('gravity', { scope, interval: 'auto' })
const tilt = scope.add(springValue(rotation.y, { stiffness: 155, damping: 23 }))

// use() recria o binding após suspensão; add(cleanup) o removeria definitivamente.
scope.use(() => bind(card, { rotateY: tilt.to([-0.6, 0.6], [-20, 20]) }))
scope.use(() => bind(highlight, { x: tilt.to([-0.6, 0.6], [-90, 90]) }))
scope.use(() => bind(background, { x: gravity.x.to([-6, 6], [-35, 35]) }))

rotation.recenter()
scope.suspend()
scope.resume()
// Ao liberar a tela definitivamente:
scope.dispose()
```

A coleta começa quando um binding em uma view carregada ou uma assinatura JS explícita precisa da fonte. A demanda percorre as cadeias de springs nativos. Pausar o último seguidor, descarregar a última view ou remover seu binding interrompe a coleta. Mantenha a fonte em um escopo e descarte-a ao terminar. `get()` e `snapshot()` leem o último valor sem iniciar sensores.

## Valores e coordenadas

| Fonte                 | Valores            | Contrato                                                                                                                                                                            |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rotation`            | `x`, `y`, `z`      | Ângulos Euler relativos XYZ extrínsecos, em radianos; equivalentes a ZYX intrínsecos. A primeira leitura válida é a identidade. Converta para os graus usados nas rotações do Jolt. |
| `rotation.quaternion` | `x`, `y`, `z`, `w` | Quaternion de Hamilton normalizado, com continuidade de sinal entre amostras. Relativo à postura inicial, não ao norte magnético.                                                   |
| `gravity`             | `x`, `y`, `z`      | Aceleração gravitacional para baixo, em m/s². Um celular deitado com a tela para cima tem z próximo de −9,80665. Não representa aceleração total nem aceleração linear.             |

O padrão `coordinates: 'interface'` usa x para a direita, y para cima e z para fora da tela visível. O código nativo remapeia os eixos ao girar a interface. `'device'` mantém os eixos do hardware; no Android eles seguem a orientação natural do aparelho, inclusive tablets cuja orientação natural é paisagem. A base da rotação acompanha os eixos: mudar a orientação da interface não transforma a identidade em uma rotação artificial de 90°.

A referência de rotação é arbitrária e não magnética: `XArbitraryZVertical` do Core Motion no iOS e `TYPE_GAME_ROTATION_VECTOR` no Android. Pode haver deriva de yaw. `recenter()` transforma a próxima postura válida na identidade. A retomada reajusta a referência relativa para preservar a postura anterior; gravidade retoma a medição real. Use `springValue()` para suavizar mudanças da gravidade. Ângulos Euler têm descontinuidades e gimbal lock: use faixas pequenas para tilt. Interpolação 3D completa exige tratamento de quaternion; aplicar springs independentes aos quatro componentes não equivale a slerp.

## Coleta e ciclo de vida

`interval` aceita `'auto'` (intervalo informado pelo display) ou 5–1000 milissegundos. A solicitação respeita limites do hardware e não garante cadência exata. O iOS compartilha uma assinatura de Core Motion; o Android compartilha um listener nativo por tipo disponível. Consumidores compatíveis usam o menor intervalo solicitado, e cada fonte agrupa as leituras conforme seu intervalo e os frames do display. Vários bindings usam os mesmos valores retidos.

Ao ir para segundo plano, a coleta para nativamente e também pelos hooks de ciclo de vida do Jolt. `pause()` mantém os valores e interrompe a coleta daquela fonte; `play()` retoma e permite tentar uma assinatura que falhou novamente. `dispose()` é idempotente, desconecta bindings, libera valores e assinaturas. Outra fonte ativa pode manter o hardware compartilhado ligado.

O padrão `reducedMotion: 'pause'` interrompe a coleta decorativa e mantém a postura atual. Funções não decorativas podem escolher `'continue'` explicitamente. A demo **Mova a luz** usa o padrão e oferece pausa, centralização e redução de movimento em inglês, português, espanhol e chinês simplificado.

## Disponibilidade e configuração

No iOS, inclua uma descrição apropriada em `NSMotionUsageDescription` no Info.plist. A ausência produz `error: 'missing-motion-usage-description'` antes de iniciar Core Motion. No Android, o limite de 200 Hz dispensa a permissão de alta frequência. Não há fallback de acelerômetro apresentado como sensor de gravidade ou de rotação.

`available` informa a existência do hardware necessário. `status` distingue `idle`, `starting`, `active`, `paused`, `unavailable`, `error`, `replaying` e `disposed`. `snapshot().error` informa falhas de acesso/inicialização ou `no-data` após três segundos sem medições válidas (ou três intervalos solicitados). Valores inválidos e timestamps de hardware fora de ordem são ignorados. Sem hardware, os valores permanecem em zero/identidade e o app pode apresentar uma composição estática.

`onStatus` é opcional e roda somente nas mudanças de estado. `snapshot()` retorna os valores atuais, timestamp monotônico em milissegundos desde a inicialização do dispositivo, amostras recebidas, frames publicados, callbacks nativos e milissegundos acumulados no processamento de publicação. É uma leitura diagnóstica explícita, não uma assinatura nem uma medida de desempenho de ponta a ponta. `.subscribe()` opta pela observação em JS; `bind()` comum não precisa de chamadas JS por leitura.

## Prévia reproduzível e validações restantes

O botão **Ver movimento** usa `replaySensor()` de `@rafaelaugusto/jolt/testing`. Uma sequência finita de amostras canônicas de quaternion/gravidade é entregue uma vez ao código nativo. A coleta de hardware se desconecta durante a reprodução; a mesma matemática, agrupamento, grafo de valores e springs renderizam o resultado. A tela identifica a entrada simulada. Isso é um recurso de teste e não altera a disponibilidade física informada.

O caminho nativo ainda depende da thread de UI. Trabalho JavaScript síncrono nessa thread pode bloquear atualizações visuais; eliminar chamadas JS por amostra não torna a UI imune a bloqueios.

Veja [a tela de referência](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/SensorLab.vue) e [o procedimento de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md). A #114 continua acompanhando verificações em iPhone/Android físicos de sinais dos eixos, rotação, permissões, custo da coleta, latência e bateria. Acelerômetro com gravidade, aceleração linear, giroscópio e campo magnético também permanecem explicitamente adiados nessa issue. As gravações e posturas sintéticas não encerram esses critérios.

Contratos das plataformas: [Core Motion](https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data), [sensores de movimento Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion) e [coordenadas e limites Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview).
