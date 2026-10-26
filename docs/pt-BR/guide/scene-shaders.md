# Ambiente e parâmetros de shader no SceneKit

`sceneKitEnvironmentIntensity(scene)` anima a iluminação do ambiente. `sceneKitUniform(target, name, options)` anima uma entrada escalar ou vetorial declarada no shader da aplicação. São adaptadores opcionais para iOS, importados de `@rafaelaugusto/jolt/native`.

Disponível desde a **0.1.0-beta.17**. Instale `@rafaelaugusto/jolt@0.1.0-rc.1` e `@rafaelaugusto/jolt-native@0.1.0-rc.1` e recompile o app nativo. Atualizar somente JavaScript não instala os adaptadores compilados.

A base nativa exige iOS 13+ e NativeScript 8.9+; o runtime/app escolhido pode exigir versões mais novas. Não há renderização SceneKit no Android.

<Clip name="scene-shaders-ios" caption="Toques reais via XCTest em simulador iOS: iluminação ambiente, mistura da cabine e um vetor do shader seguem a mesma fonte, com pausa, retomada, seek, troca da imagem e recriação da cena. A velocidade original foi preservada. Não é uma medição de desempenho em aparelho físico." />

## Intensidade do ambiente

```ts
import { sceneKitEnvironmentIntensity } from '@rafaelaugusto/jolt/native'
const environment = sceneKitEnvironmentIntensity(scene)
environment.animate(0.45, { duration: 1200 })
// Antes de destruir a cena:
environment.dispose()
```

O alvo é um `SCNScene`. Os valores são multiplicadores finitos e não negativos; overshoot negativo de spring é limitado a zero. O adaptador preserva `lightingEnvironment.contents`, fundo, luzes, exposição e tone mapping. Trocar ou remover a imagem não invalida a intensidade; sem uma imagem, a mudança pode não ter efeito visível.

A documentação genérica da Apple descreve intensidade de material entre 0 e 1. O ambiente aceita multiplicadores acima de 1, e o teste nativo mede 0, 0,45, 1,6 e 4, incluindo a luminância renderizada. Não são unidades de luz calibradas nem uma garantia para qualquer faixa HDR. Consulte a [referência da Apple](https://developer.apple.com/documentation/scenekit/scnmaterialproperty/intensity).

## Entradas tipadas do shader

A aplicação cria o shader e inicializa seus valores antes de conectar o adaptador:

```ts
material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
  `#pragma arguments
float cabinView;
#pragma body
_output.color.rgb = mix(_output.color.rgb, float3(0.03, 0.04, 0.05), cabinView);`,
  SCNShaderModifierEntryPointFragment,
)
material.setValueForKey(0, 'cabinView') // Somente na configuração
const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['fração de mistura'],
  motion: 'appearance',
})
cabin.animate(1, 'smooth')
```

Os alvos aceitos são `SCNMaterial` e `SCNGeometry`, com declarações literais Metal em `#pragma arguments`.

| Tipo     | Valor no Jolt  | Inicialização no SceneKit         |
| -------- | -------------- | --------------------------------- |
| `float`  | número         | NSNumber / valor numérico via KVC |
| `float2` | `[x, y]`       | NSValue contendo CGPoint          |
| `float3` | `[x, y, z]`    | NSValue contendo SCNVector3       |
| `float4` | `[x, y, z, w]` | NSValue contendo SCNVector4       |

Declare uma `range` finita e ordenada, uma string `units` por componente e uma política `motion`. A faixa vale para todos os componentes e limita overshoot de spring. O vetor é escrito como um único valor nativo; a leitura tem a precisão de float da plataforma.

Vetor não significa cor automaticamente: não há conversão sRGB, pré-multiplicação ou significado implícito de alpha. Declare e produza RGB/RGBA linear se esse for o contrato do seu shader. Os adaptadores de cor de material têm outro contrato.

O nome deve ser um identificador próprio, sem caminho KVC nem prefixos reservados `u_`, `a_`, `v_` e `scn_`. A criação verifica declaração literal, tipo e valor inicial. Não são suportados arrays, matrizes, samplers, structs, schemas condicionais/com macros ou buffers de `SCNProgram`. A verificação não substitui o compilador Metal: a aplicação continua responsável por um shader válido que use sua entrada. Consulte [SCNShadable](https://developer.apple.com/documentation/scenekit/scnshadable).

## Fonte compartilhada e execução

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
const scope = motionScope()
const inside = motionValue(0)
const clamp = (p: number) => Math.max(0, Math.min(1, p))
scope.use(() => environment.bind(inside, (p) => 1.6 - 1.15 * clamp(p)))
scope.use(() => cabin.bind(inside, clamp))
const run = scope.add(animate(inside, 1, { duration: 1800 }))
run.pause()
run.progress = 0.5
run.play()
// Ao sair:
scope.dispose()
cabin.dispose()
environment.dispose()
```

Isso substitui o `inside.subscribe(...)` que escreve essas duas propriedades a cada atualização em JavaScript. O consumidor do carro inspecionado usa `cabinView` escalar; emissão e transparência da faixa de ar já usam outros adaptadores. O exemplo faz uma mistura contínua de propósito. O limiar usado no carro é outra escolha visual: mapeamentos amostrados podem interpolar ao cruzar um limiar e não equivalem a eventos discretos exatos.

Motion values comuns, derivações numéricas e `playbackProgress()` usam a ponte existente de propriedades externas. JavaScript amostra o mapeamento na preparação e em mudanças do playback; o player compilado em Objective-C escreve os frames na thread principal. Não há isolamento da thread de renderização nem imunidade à carga da interface.

`springValue()` retido e saídas de gestos nativos não podem ser amostrados como uma faixa fixa nessa ponte. O binding rejeita essas fontes explicitamente, sem subscription JS escondida. A ponte para fontes nativas contínuas é uma capacidade separada.

## Controle e ciclo de vida

Os dois adaptadores oferecem `get`, `set`, `animate`, `bind`, `stop` e `dispose`, com pausa, retomada, seek, time scale e escopos. A leitura usa o valor atual do modelo, pois não existe getter público de apresentação para esses alvos. As escritas desabilitam ações implícitas do SceneKit. Remova animações concorrentes do SceneKit antes de entregar a propriedade ao Jolt.

A propriedade pertence ao par alvo nativo + nome do uniform. Uniforms diferentes animam independentemente; wrappers do mesmo uniform compartilham a interrupção. Descartar um wrapper antigo não cancela o novo. Materiais compartilhados também compartilham seus uniforms.

Trocar o código do shader ou atribuir um programa invalida o adaptador e cancela o playback. Descarte e recrie o adaptador depois de inicializar o novo shader. Comparar dicionários de código não detecta reatribuir código idêntico ou recompilar sem mudar a fonte; recrie explicitamente os adaptadores nesses casos. Os sinks nativos mantêm referências fracas aos alvos.

A iluminação é não espacial e mantém duração com movimento reduzido. Uniforms declaram `motion: 'appearance'`, que mantém a duração, ou `'spatial'`, que chega imediatamente ao destino. O efeito visual de um uniform não pode ser inferido do nome. Suspenda/retome o escopo ao ir para segundo plano e descarte os adaptadores antes de destruir a cena.
