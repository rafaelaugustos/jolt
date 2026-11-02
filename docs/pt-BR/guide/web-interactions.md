# Overlays e movimento compartilhado na Web

**Em desenvolvimento após a RC.6**, nas issues #320–#323; não integra a RC.6 publicada. O [guia de escopos e input](./web-lifecycle) cobre #314–#317. A adoção no Mavis é uma integração separada.

## Fronteira da geometria renderizada {#overlays}

Um dialog modal ou popover aberto participa da top layer do browser. Seus ancestrais DOM podem continuar animando sem alterar as coordenadas do overlay. Jolt encerra a caminhada nessa raiz renderizada, incluindo Shadow DOM e remoção pendente da top layer. O transform da própria raiz continua relevante. Transforms identidade também são aceitos fora de overlays.

Isso corrige a falha reproduzida na [Mavis #197](https://github.com/getcortexlabs/mavis-ui/issues/197): um transform identidade ou animado no Card que contém Select não deve recusar o arraste válido do Sheet. Essa distinção segue o [modelo CSS da top layer](https://www.w3.org/TR/css-position-4/#top-layer).

```ts
dialog.showModal() // A aplicação controla foco, seleção e fechamento.
const open = runtime.scope()
open.drag(panel, { axis: 'y', snap: { y: [0] } })
dialog.addEventListener('close', () => open.dispose(), { once: true })
```

Descendentes comuns de um ancestral com escala, rotação ou zoom ainda exigem adaptação de coordenadas. Jolt recusa espaços de arraste incompatíveis antes de alterar touch-action ou anexar input. Uma raiz transformada dentro do modal também afeta a geometria. Mantenha identidade no transform estático da superfície arrastável. Use modal/popover real na top layer ou superfície de input sem transform; z-index não cria essa fronteira.

Fechar um dialog libera superfícies sem caixa renderizada. Cancelar/descartar imediatamente após fechar é seguro; recrie os attachments ao reabrir. Jolt não substitui seleção, restauração de foco, Escape, scroll do conteúdo ou navegação da aplicação. Falhas preservam esses comportamentos do host. FLIP e geometria da região de ponteiro usam a mesma fronteira.

<Clip name="web-lifecycle-overlay-chromium" :width="900" caption="Chromium no macOS arm64: cliques reais abrem um modal semelhante a Select dentro de um card em translação/rotação, arrastam o painel, escolhem Porto, reabrem e fecham com Escape. Demonstra a fronteira do Jolt; não é o componente Mavis." />
<Clip name="bottom-sheet-ios" caption="Demo NativeScript existente em inglês no simulador iOS 26: arraste/scroll, crescimento de conteúdo, teclado e fechamento reais. Referência nativa; não é a correção de geometria Web." />

## Elementos compartilhados {#shared}

`sharedLayout()` conecta até oito identidades sem sobreposição em um container declarado. Captura a apresentação de saída, executa a alteração síncrona da aplicação e aguarda o próximo layout do destino. Vue pode substituir/anexar a ref na microtask resultante. O controller não navega nem escolhe conteúdo.

```ts
const shared = owner.sharedLayout(container, { transition: 'smooth' })
const detach = shared.attach(card, 'cover')
const flight = shared.transition(() => {
  card.remove()
  container.append(detail)
  shared.attach(detail, 'cover')
})
const result = await flight.finished
```

O resultado informa `completed`, `cancelled` ou `unavailable`, com motivo quando aplicável. Attachments podem substituir a identidade durante a transição; um detach antigo não remove o novo. Cópias são inert, aria-hidden, sem IDs/atributos/handlers ou interação de ponteiro. Congelam a apresentação computada, sem duplicar código da aplicação. Originais recebem uma contribuição privada de opacidade; cleanup remove somente essa contribuição, preservando novos donos e outros movimentos. Foco continua com aplicação/browser.

A transição faz crossfade entre cópias de saída/entrada, com translação e escala. Uma reversão captura a apresentação atual antes de cancelar a anterior. Conteúdo é escalado visualmente; não há reflow real do texto. `cancel()`/`stop()` mantêm o novo layout da aplicação e removem cópias. `pause()`/`suspend()` cancelam e bloqueiam novas transições até `play()`/`resume()`. Remoção do container/alvo, scroll/resize e movimento reduzido ativo também limpam. Movimento reduzido executa a alteração e deixa o conteúdo final visível.

`layoutTimeout` padrão: 500 ms, máximo 10 s. Destinos ausentes/sem tamanho retornam `missing-target` ou `layout-timeout`. `maxElements`: 512 elementos copiados por operação, contando reversões; máximo 4096. HTML/texto estáticos e imagens decodificadas são aceitos. Controles de formulário, canvas/video, documentos incorporados, custom elements, conteúdo Shadow DOM, pseudo-elementos gerados e raízes rotacionadas/inclinadas/projetivas retornam `unsupported-target`. Geometria positiva alinhada aos eixos é aceita. Captura não suportada ainda executa a mudança síncrona e preserva conteúdo real visível; exceção da aplicação limpa e propaga o erro.

O palco temporário usa popover manual em coordenadas da viewport, sem herdar transforms da página. Sem essa capacidade, retorna indisponibilidade. É uma cópia de apresentação DOM, não screenshot ou promessa de desempenho. Carregue dados e decodifique imagens antes da transição.

<Clip name="web-lifecycle-shared-chromium" :width="900" caption="Chromium no macOS arm64: controles reais alternam card/detalhe e miniatura/visualização, revertem durante o movimento, cancelam e testam destino ausente. A aplicação altera o conteúdo; as cópias são temporárias." />
<Clip name="shared-layout-ios" caption="Demo existente em inglês no simulador iOS: identidades nativas mudam de pai, expandem a capa e revertem do snapshot atual. Referência nativa, não evidência Web ou aparelho físico." />

## Receitas completas de interação {#recipes}

O [código executável](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle/recipes.ts) combina três interações num escopo:

- `drag()` com limites e retorno por spring; `press()` independente.
- `animateSize(panel, { height: open ? 'auto' : 0 })` para expansão intrínseca. A aplicação controla `aria-expanded`, conteúdo inert e foco ao fechar.
- `animateLayout(list, mutation)` para reordenar/remover identidades estáveis. A aplicação controla a ordem; Jolt mede e anima.

Alternâncias e interrupções usam as regras existentes de continuidade e propriedade. Não há solver ou loop por frame próprio do exemplo. O escopo descarta listeners, controllers e movimentos pendentes. Botões semânticos atendem teclado; Return acompanha o arraste por ponteiro. Não é uma implementação de lista virtualizada ou novo framework de componentes.

<Clip name="web-lifecycle-recipes-chromium" :width="900" caption="Chromium no macOS arm64: arraste/soltura, expansão intrínseca e reversão, reordenação/remoção, movimento reduzido e descarte. As três receitas compõem primitivas existentes do runtime." />
<Clip name="drag-ios" caption="Demo existente em inglês no simulador iOS: arraste e soltura nativos reais. Referência de interação, sem medição de coordenadas Web ou desempenho em aparelho físico." />
<Clip name="size-ios" caption="Demo existente em inglês no simulador iPhone 17 / iOS 26.0: layout real e interrupção. O segmento de interrupção seleciona 0,25× na aplicação; a velocidade do vídeo não foi alterada." />
<Clip name="layout-ios" caption="Demo FLIP nativa existente em inglês no simulador iOS: mudanças de layout e interrupção. Não é a receita Web executada em um aparelho." />

## Diagnosticar uma integração {#diagnostics}

```ts
const diagnostics = runtime.diagnostics({ development: true, maxEvents: 200 })
console.log(diagnostics.snapshot())
diagnostics.clear()
diagnostics.dispose()
```

Snapshots mostram canais/layers, IDs dos donos de animação/valor, canais em repouso, caminhos de execução e contagens de recursos. Eventos identificam aquisição, conclusão, substituição, stop explícito, liberação, movimento reduzido e ciclo de vida dos escopos/runtime. IDs são locais à sessão; histórico guarda números/enums, sem DOM ou valores da aplicação. Substituição parcial preserva os demais canais. Uma animação que perdeu um canal pode resolver false mesmo concluindo os restantes.

Histórico de 1–2000 eventos, padrão 200. Exige `development: true`, um coletor por runtime, sem histórico antes da ativação ou após descarte. `snapshot()` é consultado sob demanda: não cria observer, timer, assinatura de frame ou render. Nenhum callback de evento roda dentro de transações. Descartar o runtime retém um snapshot final serializável sem manter o documento vivo pelo handle de diagnóstico.

Uma superfície/canal em repouso não equivale a animação ativa. Compare valores ativos, tarefas de frame, observers e escopos com o estado inicial do host; o host chama `release(target)` ou descarta seu runtime. Diagnóstico não mede GPU, FPS apresentado ou latência de input.

<Clip name="web-lifecycle-diagnostics-chromium" :width="900" caption="Chromium no macOS arm64: controles iniciam x/y, substituem só x, consultam donos/motivos e descartam a tela. Relatório atualizado sob demanda, sem polling." />
<Clip name="motion-inspector-ios" caption="Inspector nativo existente em inglês no simulador iOS com input XCTest real: interrupção, ajustes, playback pausado, layers e bindings. Não é medição do display físico." />

Execute `npm run web:lifecycle:test` e consulte a [reprodução das gravações](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md). A matriz inclui Chromium, Firefox, WebKit, cleanup e consumidores empacotados imperativo/Vue/SSR. O CI nativo protege os caminhos existentes. A paridade completa Web/mobile da #236 permanece aberta.
