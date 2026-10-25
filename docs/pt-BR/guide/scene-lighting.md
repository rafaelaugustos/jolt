# Luzes e materiais SceneKit

Anime intensidade/cor de luz, transparência de material e cores sólidas de diffuse/emission pelo [contrato de propriedades nativas](./native-properties). Os adaptadores são **exclusivos do iOS** e exigem o plugin opcional `@rafaelaugusto/jolt-native` e uma recompilação nativa. Não incluem renderer 3D Android, mistura de texturas ou uniforms de shaders.

Disponível desde a **0.1.0-beta.14**. Instale versões correspondentes do core e do runtime nativo opcional e recompile o aplicativo iOS:

```sh
npm install @rafaelaugusto/jolt@0.1.0-beta.18 @rafaelaugusto/jolt-native@0.1.0-beta.18
```

<Clip name="scene-lighting-ios" caption="Simulador iPhone 17, iOS 26: renderização SceneKit real e toques do XCTest. Câmera, pintura, vidro e iluminação compartilham bindings nativos; uma camada escalar de carga soma um pulso enquanto a base continua. Inclui pausa/retomada, seek nos playbacks filhos e descarte/recriação da cena. Reprodução em tempo real na thread principal; não é gravação de aparelho físico." />

## Propriedades e unidades

```ts
import {
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '@rafaelaugusto/jolt/native'

const brightness = sceneKitLightIntensity(light) // SCNLight
const tint = sceneKitLightColor(light)
const opacity = sceneKitMaterialTransparency(material) // SCNMaterial
const paint = sceneKitMaterialDiffuse(material)
const glow = sceneKitMaterialEmission(material)

brightness.animate(1800, { duration: 800, ease: 'sineInOut' })
paint.animate('#14b8a6', 'smooth')
opacity.set(0.6)
```

| Adaptador                                | Propriedade do alvo             | Valores aceitos                                                                                                                |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `sceneKitLightIntensity(light)`          | `SCNLight.intensity`            | Números finitos ≥ 0. Lúmens na iluminação fisicamente baseada; nos demais modelos, intensidade / 1000 multiplica a cor da luz. |
| `sceneKitLightColor(light)`              | `SCNLight.color`                | String de cor do NativeScript ou `Color`.                                                                                      |
| `sceneKitMaterialTransparency(material)` | `SCNMaterial.transparency`      | Números finitos entre 0 e 1; 1 é o multiplicador opaco padrão.                                                                 |
| `sceneKitMaterialDiffuse(material)`      | `SCNMaterial.diffuse.contents`  | Apenas cor sólida: string ou `Color`.                                                                                          |
| `sceneKitMaterialEmission(material)`     | `SCNMaterial.emission.contents` | Apenas cor sólida: string ou `Color`.                                                                                          |

Os alvos nativos precisam ser `SCNLight` ou `SCNMaterial`, respectivamente. O conteúdo de cor existente precisa ser um `UIColor` ou `CGColor` sólido conversível. Cores em escala de cinza e Display P3 são convertidas para sRGB; cores dinâmicas do UIKit são resolvidas com a coleção de traits atual no momento da leitura. Padrões, imagens, texturas, caminhos/URLs, camadas, números e `nil` são rejeitados antes da troca de proprietário. O adaptador nunca substitui uma textura por cor silenciosamente. Se o app atribuir conteúdo incompatível depois, o playback nativo para e preserva esse conteúdo; crie outro binding depois de restaurar uma cor sólida.

`get()` de cor retorna um `Color` do NativeScript, normalizado para sRGB/alpha de 8 bits. As amostras reutilizam a [interpolação OKLab pré-multiplicada](./colors) do Jolt, limitada ao gamut sRGB. O sink nativo recebe vetores RGBA sRGB pré-multiplicados e normalizados (RGB entre 0 e alpha; alpha entre 0 e 1), interpola entre amostras, desfaz a pré-multiplicação e atribui um `UIColor` completo. Isso preserva extremos transparentes sem callbacks separados para cada canal. As leituras são arredondadas na fronteira pública de cor, portanto a precisão na interrupção é de um componente de 8 bits. Saída HDR/gamut ampliado além de sRGB não é preservada. Overshoot de springs é limitado aos intervalos de cor e escalares; os mapeamentos de bindings precisam retornar valores válidos por conta própria.

O alpha é preservado no valor da cor; as regras de iluminação e material do SceneKit definem sua contribuição visual. Use intensidade para brilho e transparência de material para um multiplicador de opacidade. Os adaptadores não alteram `transparent`, `transparencyMode`, `blendMode`, profundidade, metalness, roughness ou shaders. Alpha zero em uma cor não substitui de forma geral a configuração de geometria transparente.

Nos modelos `physicallyBased`, `lambert`, `phong` e `blinn`, a aparência diffuse depende de iluminação e das demais propriedades do material; uma superfície preta sem luz pode esconder a mudança de cor. `constant` exibe diffuse independentemente da iluminação direta. Emission adiciona aparência independente da luz; **não ilumina objetos próximos**. `shadowOnly` e shaders próprios podem ignorar a contribuição usual de diffuse/emission. Use uma luz real para iluminar e configure bloom separadamente se desejar. Essas são regras do SceneKit, descritas nas referências da Apple para [intensity](https://developer.apple.com/documentation/scenekit/scnlight/intensity), [emission](https://developer.apple.com/documentation/scenekit/scnmaterial/emission) e [transparency](https://developer.apple.com/documentation/scenekit/scnmaterial/transparency).

## Valores compartilhados e camadas de carga

```ts
import { Color, Application } from '@nativescript/core'
import { animate, motionValue, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const charge = motionValue(0)
const brightness = sceneKitLightIntensity(light)
const glow = sceneKitMaterialEmission(material)

scope.use(() => brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600))
scope.use(() =>
  glow.bind(
    charge,
    (n) => new Color(255, 0, Math.round(Math.min(1, Math.max(0, n)) * 255), 180),
  ),
)
scope.add(animate(charge, 0.6, { duration: 10000, ease: 'linear' }))
scope.animate(charge, [0, 0.5, 0], {
  duration: 1100,
  ease: 'sineInOut',
  repeat: Infinity,
  layer: 'charge',
})
```

O pulso é uma camada sobre um **motion value escalar**; a base continua por baixo. Isso não soma cores, materiais ou poses com quaternion arbitrariamente. Use `stop(charge, { layer: 'charge' })` para remover só o pulso. Um valor derivado ou `playbackProgress(animation)` também pode alimentar `bind()`. A demo usa as mesmas fontes para câmera, luz e materiais, sem polling ou setter JS por frame.

Os mapeamentos rodam quando o Jolt prepara amostras ou reconstrói a trilha da fonte; mantenha-os puros. A composição de camadas escalares pode reconstruir janelas de amostragem em JS; eventos de gestos/fontes também continuam sendo fronteiras JS. As escritas nativas rodam em Objective-C compilado pelo player existente, na thread principal. JS ocupado nessa thread pode atrasá-las. `subscribe(value => sceneKitSetter(value))` continua sendo um callback JS, não um binding nativo.

`animate()` retorna o playback comum: pausa/play, seek de progresso finito, stop e conclusão. `timeline()` coordena esses handles para pausa/retomada/stop; faça seek no handle individual quando suportado, pois a timeline não tem setter de progresso. Alvos, cores, intervalos numéricos e amostras mapeadas são validados antes de substituir o proprietário atual.

## Interrupção, ownership e ciclo de vida

Dois nós que referenciam o mesmo `SCNMaterial` ou `SCNLight` compartilham seu estado. Wrappers da mesma instância nativa e propriedade compartilham a interrupção. Propriedades diferentes permanecem independentes; descartar um wrapper antigo não para o trabalho de um wrapper mais novo. Copie o material/luz no app quando as instâncias precisarem animar independentemente.

`sceneKitPose` lê o presentation node ao interromper. Luzes e materiais isolados não têm getter público equivalente; por isso estes adaptadores leem a **propriedade atual do modelo**. O Jolt escreve com ações implícitas do SceneKit desativadas. Durante o playback controlado pelo Jolt, o modelo contém a última amostra escrita e o redirecionamento parte dela, sem uma segunda curva de easing. A apresentação na tela pode estar um frame de renderização atrás. O Jolt não consegue recuperar o valor intermediário exibido por uma animação do app em uma luz/material isolado. Remova animações/actions/constraints concorrentes do SceneKit e grave o valor desejado para a transferência antes de passar o controle ao Jolt. Pare/libere o Jolt antes de devolver a propriedade. O controle é exclusivo, sem mistura aditiva com animações do SDK.

Coloque handles de playback e fábricas de bindings em um motion scope. Mantenha os wrappers fora de um scope que pretenda suspender: `scope.add(property)` adota um recurso descartável, então a suspensão o descarta permanentemente. Descarte os wrappers explicitamente ao destruir a cena/alvo:

```ts
const suspend = () => scope.suspend()
Application.on(Application.suspendEvent, suspend)
// Na volta intencional à cena:
scope.resume()

// Antes de remover/substituir a cena:
Application.off(Application.suspendEvent, suspend)
scope.dispose()
brightness.dispose()
glow.dispose()
```

Suspender pausa os handles controláveis, desconecta bindings e remove players nativos. Retomar explicitamente recria os bindings e continua os handles que estavam rodando; não retoma um handle pausado manualmente. A demo suspende ao ir para o segundo plano e exige retomada explícita. Os adaptadores isolados não instalam uma política própria de ciclo de vida: sem pausa/stop pelo scope, o relógio avança enquanto o display link está suspenso e, ao retornar, o efeito pode avançar ou concluir imediatamente. Não dependa de execução em segundo plano para renderizar.

Iluminação/cor/transparência não são espaciais e preservam seu tempo sob movimento reduzido, inclusive os pulsos. `sceneKitPose` é espacial e vai direto ao destino quando movimento reduzido está ativo na criação/reconstrução da fonte. Para evitar piscadas decorativas, suprima o pulso de carga quando seu app aplicar movimento reduzido. Uma mudança de política não reconstrói retroativamente toda animação isolada existente. Ambos seguem o `timeScale` do Jolt ao criar trilhas.

O runtime opcional usa alvos nativos fracos; os wrappers mantêm a identidade do alvo até `dispose()`. Descarte antes da destruição, mesmo bindings pausados, sem depender do GC. Leituras e escritas compiladas usam a thread principal; não chame a API JS de um callback de renderer em outra fila. Os mínimos continuam NativeScript 8.9 e iOS 13; esta implementação foi validada com Core 9.1.3/runtime 9.1.0 e iOS 26. Recompile com versões compatíveis do core/plugin que incluam esses adaptadores; binários antigos do plugin beta.13 não os contêm.

## Migrando o loop por frame de um modelo

Substitua polling ou assinatura por frame:

```ts
// Antes: escrita JS do app em cada frame observado.
const unsubscribe = charge.subscribe((n) => {
  light.intensity = 400 + n * 1600
})

// Depois: amostra nas fronteiras da fonte; escrita nativa.
const brightness = sceneKitLightIntensity(light)
const release = brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600)
// Na destruição: release(); brightness.dispose()
```

Para a câmera, continue usando `sceneKitPose(cameraNode)`. Remova a assinatura/timer anterior ao instalar o binding. O [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-appearance.md) registra conformidade nativa, continuidade, composição de camadas, contadores de ciclo de vida, tolerâncias de cor e o limite com JS ocupado.
