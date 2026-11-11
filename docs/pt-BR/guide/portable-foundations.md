# Ponteiro, grupos de propriedades e superfícies de desenho

Disponível em `0.1.0-rc.12`. NativeScript e o runtime Web experimental compartilham regras de validação e ciclo de vida, com execução própria em cada plataforma. Recompile os apps nativos com versões compatíveis dos pacotes Jolt.

## Posição e presença do ponteiro

O nativo ganha `pointerFollow`; a Web amplia a implementação existente com `presence`. Toque comum não vira hover. Ações essenciais continuam acessíveis por botões, toque e teclado.

```ts
import { bind, motionScope } from '@rafaelaugusto/jolt'
const scope = motionScope()
const pointer = scope.pointerFollow(region, { spring: false })
scope.use(() => bind(dot, { x: pointer.x.to([-1, 1], [-120, 120]) }))
scope.use(() =>
  pointer.presence.subscribe((value) => {
    // 1 dentro da região; 0 fora dela.
  }),
)
// Ao desmontar definitivamente:
scope.dispose()
```

Na Web, use `runtime.scope().pointerFollow(element, options)` e `scope.bind()`. Ambos oferecem `x`, `y`, `presence`, `active`, `available`, `disposed`, `suspended`, `update({ disabled })`, `refresh()`, `suspend()`, `resume()` e `dispose()`. A presença é um valor numérico imediato. No nativo, `spring: false` fornece valores brutos aceitos pelo binding compilado de propriedades externas. As molas padrão suavizam o movimento, mas seus nós não são aceitos pelo sampler atual desse binding; use valores brutos ou uma assinatura JS com ciclo de vida explícito.

| Contrato              | NativeScript                                                              | Web                                                  |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Coordenadas em pixels | DIPs locais, convertidos pelas transformações do alvo                     | Pixels CSS no retângulo do alvo alinhado ao viewport |
| Padrão                | Origem central, normalizado de −1 a 1                                     | Mesmo mapeamento                                     |
| Capacidade            | Hover no iPadOS; mouse/caneta em hover no Android; indisponível no iPhone | Pointer Events e `(any-hover: hover)`                |
| Custo                 | Um callback JS por evento nativo entregue                                 | Atualizações de ponteiro agrupadas pelo navegador    |

As opções são `axis`, `coordinates`, `range`, `rest`, `spring` e `disabled`. `range` mapeia valores normalizados ou limita pixels; `rest` deve caber no intervalo declarado. Tamanho zero não produz posição ativa. Pausa, background, desmontagem, desativação e movimento reduzido restauram repouso e presença zero. Resize é observado; chame `refresh()` após mudanças de coordenadas controladas pelo app. `available` indica suporte à API, sem detectar um acessório conectado. Deixe os seguidores decorativos sem interação. Projeção 3D e política de sobreposição ficam no app. O Android observa e delega os eventos da janela; nenhuma dessas APIs promete continuar com o JavaScript bloqueado.

A entrada do ponteiro não dá foco ao alvo, não chama `preventDefault()` e não bloqueia outros reconhecedores ou listeners; toques, cliques e arrastes independentes continuam funcionando. Um ponteiro criado no scope privado de uma execução de `motionBehaviors` é suspenso junto com a fila, descartado quando a execução é interrompida e ignora eventos que chegam depois.

Apenas no código-fonte, fora do `0.1.0-rc.13`: na Web, `available` indica Pointer Events com `(any-hover: hover)` enquanto a fonte escuta e não está bloqueada, e a presença volta ao repouso quando essa consulta deixa de corresponder durante o hover. Um evento de mouse posterior continua sendo seguido: a consulta é uma indicação do navegador, não uma verificação de dispositivo conectado. No Android, um ponteiro ativo volta ao repouso quando seu dispositivo de entrada é removido, e o hover passa a ser seguido sobre alvos girados e com escala menor que 1, antes rejeitados.

Limites de hardware: não havia iPad, mouse, trackpad, Apple Pencil nem acessório de ponteiro Android físicos. Hover de acessórios, canetas em hover, desconexão de um dispositivo durante o hover e tempo e custo do ponteiro em aparelho físico não foram verificados. A evidência no iPad usa injeção do sistema via XCTest, o Android usa eventos de mouse injetados no app, os navegadores usam entrada do Playwright e a mudança de `(any-hover: hover)` é exercitada com uma media query substituída, não com uma mudança real de dispositivo.

<Clip name="portable-pointer-ipados" :width="720" caption="Simulador iPad Pro de 11 polegadas (M4), iPadOS 26.2, interface em inglês: hover contínuo injetado no sistema move o elemento nativo e uniforms SceneKit, preserva um toque, redimensiona e remonta. Tempo original; não testamos mouse nem iPad físicos." />
<Clip name="portable-pointer-android" caption="ASUS ZenFone 3 físico, Android 8, interface em inglês: eventos nativos de mouse injetados movem o elemento, a saída restaura o repouso e o toque real continua funcionando. Tempo original; não testamos acessório físico de mouse." />
<Clip name="portable-pointer-chromium" :width="900" caption="Chromium no macOS, interface em inglês: entrada, movimento e saída do mouse, clique preservado, resize, pausa/retomada e remontagem. Interação real, tempo original; toque comum não simula hover." />

## Uma operação para propriedades relacionadas

```ts
import { propertyGroup } from '@rafaelaugusto/jolt/native'
const group = scope.resource(() => propertyGroup({ a, b, c }))
const motion = group.animate({ a: 0.8, b: 0.4, c: 1 }, { duration: 1800 })
motion.pause()
motion.progress = 0.5
motion.play()
```

`a`, `b` e `c` são adapters tipados existentes. O grupo toma emprestados 1–64 canais distintos e exige exatamente todos os membros em cada comando. Alvos, valores, quantidade de componentes e transições são preparados antes de interromper uma animação válida. Canais duplicados e mistura de backends são rejeitados. A API inclui `get`, `set`, `animate`, `stop`, `suspend`, `resume` e `dispose`; destruir o grupo não destrói seus adapters.

Substituir um membro cancela o grupo inteiro, preservando canais independentes. Isso inclui outro grupo que compartilha um membro, `set()` ou `bind()` em um membro e um membro cujo player nativo informa a perda do alvo: todos os membros são cancelados uma vez, os canais são liberados e o grupo antigo pode começar de novo. Callbacks nativos de fim atrasados, `stop()` e `progress = 1` depois que uma execução termina não mudam o resultado. Uma nova animação parte da apresentação atual e aproveita a velocidade projetada nas molas. `finished` resolve uma vez: `true` ao concluir, `false` ao cancelar. Se `set()` falha, tenta restaurar os valores já escritos e agrupa erros de rollback; animações canceladas não reiniciam. Falha parcial de setup cancela os players criados, sem desfazer efeitos externos do renderer. O início lógico é coordenado; isso não garante submissão atômica na GPU.

No nativo, um relógio lógico controla players compilados por membro; requer o plugin opcional `@rafaelaugusto/jolt-native`. A posição temporal é sincronizada após o setup. Na Web, `scope.property(target, definition)` recebe `name`, `units`, `read`, `write`, `encode`, `decode` e, opcionalmente, `alive`, `spatial`, `validate`, `interpolate`; `scope.propertyGroup({ a })` usa esses adapters de um único runtime/documento. As escritas usam uma tarefa do scheduler na thread principal do navegador. WAAPI comum mantém sua execução. Alvos DOM precisam estar conectados; use `alive()` para recursos externos e destrua os adapters antes deles. Movimento reduzido leva o grupo espacial ao destino; pausas manuais sobrevivem à suspensão do scope.

Cada propriedade aceita até 64 componentes numéricos. Animações amostradas têm limite de 262.144 componentes por membro e 1.048.576 por grupo; pedidos maiores falham antes de interromper uma reprodução válida. São limites de alocação, não garantia de duração suportada.

<Clip name="portable-groups-ios" caption="Simulador iPhone 17 Pro, iOS 26.2, interface em inglês: três propriedades UIKit compiladas e três uniforms reais de materiais SceneKit, pausa/retomada, substituição e remontagem coordenadas. A demanda volta a idle. Tempo original; não é medição em aparelho físico." />
<Clip name="portable-groups-android" caption="ASUS ZenFone 3 físico, Android 8, interface em inglês: três propriedades nativas compiladas com início, pausa/retomada, substituição e remontagem coordenados. Toques reais, tempo original; esta demo Android não contém SceneKit." />
<Clip name="portable-groups-chromium" :width="900" caption="Chromium no macOS, interface em inglês: três propriedades DOM e uniforms reais de WebGL, pausa/retomada, substituição, demanda ociosa e remontagem. Cliques reais e tempo original." />

## Demanda de renderização

```ts
const activity = scope.renderActivity({
  change(active) {
    renderer.setContinuous(active)
  },
  redraw() {
    renderer.drawFinalFrame()
  },
})
activity.track(motion)
const child = activity.scope()
const release = child.hold()
release()
```

`track()` observa o relógio real, incluindo delay, pausa, seek, substituição e conclusão. Não passa a ser dono da animação nem a interrompe ao remover a observação. Delays reservam demanda. `hold()` cobre trabalho contínuo do app até ser liberado. Filhos independentes somam demanda no mesmo renderer; use `activity.scope()` em vez de duas raízes para o mesmo objeto adapter. O limite é de 4.096 observações/tokens. Não há polling nem loop permanente adicional.

Um desenho estático retido não mantém o renderer ativo. Suspensão/background retiram a demanda; `redraw()` entrega estado final ou buscado enquanto visível. A integração combina essa demanda com as configurações próprias do app, sem política global para SceneKit. Os vídeos acima mostram o ciclo; os testes Web também conferem que o contador real de frames WebGL para quando ocioso.

## Desenho retido com limites

```ts
import { drawBatch } from '@rafaelaugusto/jolt/shapes'
const drawing = scope.resource(() =>
  drawBatch(host, {
    viewBox: [0, 0, 760, 300],
    styles: { signal: { fill: '#63e3c2', strokeWidth: 0 } },
    items: [{ id: 'dot', style: 'signal', kind: 'circle', cx: 30, cy: 80, radius: 4 }],
  }),
)
drawing.update([
  { id: 'dot', style: 'signal', kind: 'circle', cx: 40, cy: 80, radius: 8 },
])
```

Na Web, use `scope.drawBatch(element, sameOptions)`. Há círculos, retângulos e paths SVG validados. IDs únicos aceitam 1–128 letras/dígitos/pontos/underscores/hífens. A ordem do array define a pintura. `set({ items, styles })` substitui as coleções fornecidas, permitindo inserção, remoção e reordenação. `update(items)` substitui itens completos existentes por ID. Estilos compartilhados usam as opções de preenchimento/traço de `shape`; campos desconhecidos são rejeitados antes de alterar o desenho válido.

O `viewBox` imutável se ajusta proporcionalmente, centraliza e recorta nos limites locais do host; geometria e traço usam suas unidades. Resize atualiza esse mapeamento. iOS retém paths em uma layer; Android usa um drawable e primitivas Canvas para círculos/retângulos. Web usa um SVG decorativo com um path por item e reaproveita nós inalterados. Menos views nativas não significa menos DOM ou CPU.

| Limite                                     |                       Nativo e Web |
| ------------------------------------------ | ---------------------------------: |
| Itens / estilos                            |                         1.024 / 64 |
| Comandos normalizados / componentes totais |                     8.192 / 65.536 |
| Por path                                   |   256 comandos / 20.000 caracteres |
| Atualização serializada                    |                              2 MiB |
| Animação amostrada por item                | Indisponível; atualização imediata |

`snapshot()` informa contagens e bytes numéricos da geometria, não memória do processo. Anime o host separadamente, respeitando movimento reduzido. `suspend()` mantém o desenho visível e adia edições até `resume()`; background segue a mesma regra. Unload nativo libera a geometria e load a restaura. `dispose()` remove tudo definitivamente. Hit-testing e acessibilidade dos itens ficam no app; a superfície não intercepta entrada.

<Clip name="portable-drawing-ios" caption="Simulador iPhone, iOS 26.2, interface em inglês: 259 pontos e indicador segmentado em uma layer retida, edições direcionadas, movimento do host, edições adiadas durante pausa e remontagem. Interação nativa real, tempo original." />
<Clip name="portable-drawing-android" caption="ASUS ZenFone 3 físico, Android 8, interface em inglês: 259 pontos, edições direcionadas, indicador segmentado, pausa/retomada e remontagem em uma superfície Canvas nativa. Toques reais, tempo original." />
<Clip name="portable-drawing-chromium" :width="900" caption="Chromium no macOS, interface em inglês: mesma receita de 259 pontos e indicador em SVG, edições, pausa/retomada e remontagem. Tempo original; um path SVG por item." />

## Correções nativas

As formas iOS passam a ler `UIView.bounds` local após layout transformado, evitando que escala/rotação alterem o tamanho interno do desenho. Android e Web já usam geometria local. O observador de pressão iOS deixa de reenviar os toques nativos, evitando ações duplicadas; o feedback é cancelado na suspensão. A duplicação foi reproduzida e corrigida. O relato original de uma ação disparar com o app já suspenso não foi reproduzido independentemente.

<Clip name="portable-shape-ios" caption="Simulador iPhone, iOS 26.2: desenho transformado diretamente e desenho dentro de um pai transformado mantêm a geometria local em escala, rotação e combinação. Interface em inglês, toques reais, tempo original." />
<Clip name="portable-press-ios" caption="Simulador iPhone, iOS 26.2: uma ação por toque real com feedback em scope, Home/background, retorno e remontagem. Interface em inglês, tempo original; demonstra prevenção de duplicação, não uma ação reproduzida durante suspensão." />

Veja [validação e dados brutos](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-foundations.md). Os resultados não comprovam menor CPU/PSS total do app nem superioridade sobre Reanimated.
