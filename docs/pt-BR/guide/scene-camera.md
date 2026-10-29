# Campo de visão da câmera SceneKit

`sceneKitFieldOfView(camera)` anima o ângulo de visão de uma câmera em perspectiva mantendo sua posição. Vincule-o ao mesmo motion value da pintura, iluminação ou pose da câmera para coordenar a cena sem um loop por frame no app. O adaptador é **exclusivo do iOS**, pelo plugin opcional `@rafaelaugusto/jolt-native`.

<Clip name="scene-camera-ios" caption="Simulador iPhone 17, iOS 26: reprodução SceneKit real e toques do XCTest. A câmera fixa aproxima o enquadramento de 70° para 32° enquanto pintura e luz mudam; pausa/retomada, reversão, troca de fonte, seek dos filhos e recriação da cena. Tempo real na thread principal; gravação de simulador." />

Disponível desde a **0.1.0-beta.15**. Instale versões correspondentes do core e do plugin e recompile o app nativo:

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.2 @rafaelaugusto/jolt-native@0.1.0-rc.2
```

O mínimo continua NativeScript 8.9 e iOS 13; a validação nativa usou Core 9.1.3, runtime 9.1.0 e simulador iOS 26.

## Ângulo da câmera em graus

```ts
import { sceneKitFieldOfView } from '@rafaelaugusto/jolt/native'

const fov = sceneKitFieldOfView(cameraNode.camera!) // SCNCamera, não SCNNode
const zoom = fov.animate(32, 'smooth')
zoom.pause()
zoom.progress = 0.5
zoom.play()

fov.get() // ângulo atual do modelo nativo, em graus
fov.set(70) // interrompe o proprietário Jolt atual e aplica imediatamente
// Antes de destruir a cena:
fov.dispose()
```

A faixa aceita é **1–179 graus, inclusive**. É o limite conservador do Jolt para evitar projeções degeneradas próximas de zero/180°. O ângulo inicial, destinos explícitos e todas as amostras de bindings devem ser finitos e estar nessa faixa. Entradas inválidas falham antes de substituir um proprietário ativo. Springs limitam o overshoot a essa faixa; mappings customizados precisam produzir ângulos válidos. Tweens interpolam graus antes do easing, não a ampliação visual.

`projectionDirection` da câmera escolhe o ângulo vertical ou horizontal; o Jolt o preserva. O SceneKit calcula o outro eixo pela proporção do viewport. Redimensionar o viewport muda o ângulo complementar, não o valor vinculado. Esse zoom muda a perspectiva; mover a câmera com `sceneKitPose(cameraNode)` é outra operação.

Somente a **projeção automática em perspectiva** é suportada. Câmeras ortográficas usam `orthographicScale`, e uma `projectionTransform` customizada controla a própria projeção. A criação rejeita ambas sem modificá-las. Se forem instaladas durante a reprodução, o player nativo para e preserva a configuração do app. Libere o binding da fonte e descarte o wrapper antes de configurar/substituir a câmera. Recrie o binding após restaurar uma câmera automática em perspectiva compatível.

O sink compilado verifica os resultados da API pública de projeção em duas proporções de viewport. Não lê flags privadas nem sobrescreve uma matriz customizada para testar o FOV. Uma matriz fixa customizada é rejeitada mesmo se coincidir numericamente com a projeção padrão de um viewport.

## Movimento e playback compartilhados

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitFieldOfView, sceneKitLightIntensity } from '@rafaelaugusto/jolt/native'

const progress = motionValue(0)
const scope = motionScope()
const fov = sceneKitFieldOfView(cameraNode.camera!)
const light = sceneKitLightIntensity(keyLight)

scope.use(() => fov.bind(progress, (p) => 70 - p * 38))
scope.use(() => light.bind(progress, (p) => 550 + p * 350))
scope.add(animate(progress, 1, { duration: 2000, ease: 'sineInOut' }))

scope.suspend() // mantém a fonte e libera seus bindings
scope.resume() // reconecta os bindings e retoma o que estava rodando

// Antes de destruir câmera/luz:
scope.dispose()
fov.dispose()
light.dispose()
```

Valores numéricos derivados e `playbackProgress(animation)` usam o mesmo contrato de `bind()`. Mappings executam na preparação/reconstrução das amostras e devem ser puros. Comandos da fonte e eventos de gesto ainda passam pelo JS; interpolação/escritas nativas autônomas não pedem frames de observação JS. O JavaScript do NativeScript e essas escritas SceneKit compartilham a thread principal, portanto JS ocupado pode travar a atualização da câmera.

Use `timeline()` para coordenar playbacks independentes de câmera/luz/material. Há pausa/retomada/stop conjuntos; faça seek nos handles finitos individuais quando suportado. A demo mantém a câmera fixa para evidenciar o efeito do FOV e vincula pintura à mesma fonte, com outro participante da timeline controlando a luz.

## Propriedade da lente e interrupção

O SceneKit acopla `fieldOfView`, `focalLength` e `sensorHeight`: escrever FOV recalcula a distância focal, e mudar as propriedades da lente pode recalcular FOV. Esses efeitos fazem parte do modelo da câmera, descrito pela Apple em [fieldOfView](https://developer.apple.com/documentation/scenekit/scncamera/fieldofview) e [projectionDirection](https://developer.apple.com/documentation/scenekit/scncamera/projectiondirection).

Pare/libere a animação ou binding de FOV antes de mudar distância focal, sensor, direção ou modo de projeção pelo app. Defina a configuração desejada e só então devolva o controle. Animações independentes dessas propriedades acopladas competem com o Jolt; mudanças externas válidas de lente não assumem automaticamente a propriedade e podem ser sobrescritas pela próxima amostra de FOV. O Jolt não altera planos near/far, distância de foco, profundidade de campo ou pose da câmera.

Uma `SCNCamera` isolada não tem getter público de apresentação. `get()` e interrupções leem o **ângulo atual do modelo**, que durante playback do Jolt corresponde à última escrita imediata e pode ficar um frame atrás da apresentação renderizada. As escritas usam uma transação SceneKit com ações implícitas desativadas, inclusive dentro de uma transação externa animada. O Jolt não recupera o FOV visual intermediário de uma animação SceneKit do app: remova animações concorrentes e estabeleça o valor de transferência antes.

Wrappers do FOV da mesma câmera compartilham propriedade, inclusive quando vários nós referenciam essa câmera. Descartar um wrapper antigo não para a animação do novo proprietário. Pose, luz e material continuam independentes. Os alvos nativos são fracos; wrappers JS retêm a identidade da câmera até `dispose()`, então libere-os explicitamente antes de destruir a cena.

## Ciclo de vida e movimento reduzido

FOV é **movimento espacial**. Com movimento reduzido, novas animações diretas chegam imediatamente ao destino, e bindings usam o destino ao preparar uma nova track ativa da fonte. Mudar a preferência não reconstrói retroativamente toda animação nativa submetida. Para reagir imediatamente, pare e aplique o ângulo desejado ou inicie um novo comando da fonte após mudar a preferência. Pausar uma fonte mantém seu valor atual. Adaptadores de iluminação/cor preservam a política não espacial.

Tracks seguem `timeScale` na preparação. Adaptadores isolados não instalam uma política automática de background: o relógio pode avançar enquanto o display link está suspenso. Para manter a cena parada, suspenda o scope em `Application.suspendEvent` e retome intencionalmente. Um handle pausado manualmente continua pausado. Mantenha os wrappers fora de um scope que precise sobreviver à suspensão; use-o para handles e fábricas de binding, como acima.

Substitua a subscription por frame do app por um binding nativo:

```ts
// Remova a subscription antiga que escrevia camera.fieldOfView a cada callback.
const fov = sceneKitFieldOfView(camera)
const release = fov.bind(progress, (p) => 70 - p * 38)
// No descarte:
release()
fov.dispose()
```

O [relatório nativo](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-camera.md) cobre geometria projetada, viewport, acoplamento da lente, interrupção, projeções incompatíveis, scopes e contenção da thread principal. Animação de escala ortográfica, controles arbitrários de lente e renderer 3D Android ficam para trabalhos separados.
