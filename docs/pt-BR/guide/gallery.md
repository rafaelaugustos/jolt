# Uma galeria que continua conectada

Abra uma miniatura, aproxime um detalhe com pinça, continue arrastando ao soltar um dedo, interrompa o zoom de toque duplo e puxe para voltar. A referência combina `sharedNavigationEntry`, `zoomable` e um resolvedor da célula atual com Core ListView e vue-router-ns. O router mantém a navegação; gestos e frames de animação ficam no nativo.

Disponível desde a **0.1.0-rc.1**. Recompile o app nativo. Abra **A galeria viva** no preview em quatro idiomas.

<Clip name="gallery-ios" caption="Simulador iOS 26.2, inglês: multitoque real, interrupção do toque duplo, arraste cancelado, retorno da posição solta após reordenar e fallback de exclusão. Velocidade original." />
<Clip name="gallery-pt-ios" caption="Simulador iOS, português: a interação completa com gestos reais do sistema. Não é evidência de desempenho em aparelho físico." />
<Clip name="gallery-android" caption="Emulador Android 16, inglês: pinça continuando em pan, interrupção, cancelamento e retorno à miniatura reciclada atual." />
<Clip name="gallery-pt-android" caption="Emulador Android, português: aproximar, cancelar, mover, arrastar de volta e remover. Os indicadores mostram toques reais; o vídeo não foi acelerado." />

## Conecte os dois responsáveis

As duas imagens recebem o mesmo `sharedTransitionTag`, derivado da chave estável da foto. Crie a entrada conforme [alvos de retorno](./return-targets). Espere `entry.open()` terminar antes de conectar o zoom à imagem carregada do detalhe. Assim, a abertura e o visualizador não disputam a mesma imagem.

```ts
import { zoomable } from '@rafaelaugusto/jolt'

// Depois de entry.open() e do carregamento da imagem:
const viewer = zoomable(detailImage, {
  viewport, // pai direto; sem escala nesta receita
  backdrop,
  chrome, // irmão separado, não um ancestral da imagem
  dismiss: 'vertical',
  async onDismiss(intent) {
    const result = await entry.returnToSource({
      velocity: { x: 0, y: intent.velocity },
    })
    if (!result.navigated) intent.cancel()
  },
})
zoomButton.on('tap', () => viewer.zoomTo(2.5))
resetButton.on('tap', () => viewer.reset())
closeButton.on('tap', () => viewer.requestDismiss())
```

`returnToSource()` captura a **posição nativa atual e o recorte do viewport antes de navegar**, preserva a página visível dentro do orçamento de pixels, resolve a miniatura atual e inicia a transição nativa. A velocidade de translação x/y informada entra nas curvas de mola. A unidade é DIP por segundo no espaço da janela; converta se o viewport tiver um ancestral com escala. A API não deduz velocidade de escala/pinça a partir de uma soltura vertical.

Mantenha a intenção pendente durante a operação. Não chame `intent.complete()` antes da captura: isso restauraria a imagem. A navegação aceita descarrega a imagem e descarta o controlador de zoom. Uma recusa retorna `navigated: false`; `intent.cancel()` então restaura o visualizador a partir da posição mantida. Uma segunda solicitação recebe `unavailable/busy` sem outra navegação. O resultado usa os mesmos estados de [navegação compartilhada](./shared-navigation).

O exemplo completo está em [GalleryPhotoDetail.vue](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/GalleryPhotoDetail.vue), com [identidade e rotas da coleção](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) e o [template reciclado](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts). Layout, dados, busca por chave, interpretação de falhas do router e controles acessíveis continuam no app. O Jolt fornece gestos, captura, resolução e transição nativos.

## Voltar, cancelar e usar alternativas

| Situação                              | Comportamento da referência                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Arraste vertical curto                | Foto e controles voltam por mola; nenhuma rota executa.                                                                        |
| Arraste com zoom                      | Pan nos limites da imagem; fechar exige escala mínima.                                                                         |
| Fechar acessível com zoom             | Restauração nativa ao mínimo, seguida de uma intenção de fechar.                                                               |
| Borda do iOS com zoom ou arraste      | `canBegin` impede a disputa; restaure ou use fechar.                                                                           |
| Voltar do Android com zoom            | O commit restaura o zoom e mantém o detalhe; o próximo Voltar pode sair.                                                       |
| Voltar do Android em repouso          | Preview do detalhe; a célula atual é resolvida após o commit do sistema.                                                       |
| Voltar durante a abertura             | Solicitações recebidas são agrupadas até terminar. O UIKit pode ignorar toques físicos durante sua curta transição de entrada. |
| Item reordenado/fora da tela          | Busca a linha atual por chave e rola antes de medir.                                                                           |
| Item excluído ou não realizado        | Uma volta com fade/ordinária, sem usar um retângulo antigo.                                                                    |
| Detalhe direto sem entrada            | Voltar comum ou substituir pela galeria quando não há histórico.                                                               |
| Mudança de janela/layout na transição | Encerra a representação temporária e mantém a rota confirmada.                                                                 |
| Suspensão                             | Descarta a entrada; o próximo fechar usa navegação comum.                                                                      |

Reduzir Movimento mantém zoom, restaurar, fechar, navegação e foco sem a transição compartilhada. Réplicas ficam ocultas da acessibilidade. O foco volta ao item atual; o título da coleção é a alternativa quando ele desaparece. Fontes ampliadas têm a cobertura em simulador/emulador descrita abaixo. A validação dos leitores está em [Leitores de tela](#screen-readers); a matriz física mais ampla continua pendente.

## Fontes ampliadas do sistema

O detalhe mede o cabeçalho e o painel de controles em vez de reservar linhas de texto com altura fixa. Títulos e botões quebram linha. O painel nativo tem altura limitada e permite rolagem quando necessário, inclusive em paisagem, enquanto a foto mantém uma área separada para gestos. O chrome continua como irmão da imagem para acompanhar a animação de fechamento de forma independente.

O iOS habilita Dynamic Type e aplica a área segura uma vez. No Android, os labels mantidos são atualizados com o dimensionamento nativo em SP após a mudança da configuração de fonte, usando o mesmo helper do exemplo de cabeçalho com scroll. O listener e a atualização pendente são removidos na desmontagem.

Testamos mudanças reais do sistema no simulador iPhone 17 / iOS 26.2 (`large` → `accessibility-medium` → `large`) e no emulador Android 16 / API 36 (`font_scale` 1 → 2 → 1). O zoom de 2,5× sobrevive à mudança; ampliar/restaurar funcionam após a rotação, e uma rolagem real do painel revela os controles por inteiro. A fonte normal é restaurada e outra foto é aberta com fonte ampliada. Os dois retornos chegam à miniatura atual, com uma navegação por retorno e nenhum recurso nativo de navegação restante. Medições nativas verificam o encaixe do texto e as dimensões dos controles. Esse registro anterior cobre essas configurações em simulador; a combinação com leitor e iPhone físico está documentada abaixo.

<Clip name="gallery-large-text-ios" caption="Simulador iPhone 17, iOS 26.2, interface em inglês: mudanças reais de Dynamic Type, zoom preservado, controles em retrato/paisagem com rolagem do painel, restauração e dois retornos à miniatura. Reprodução nativa na velocidade original; a paisagem aparece girada na gravação em retrato. Snapshot apenas coleta diagnósticos opcionais. Não valida aparelho físico ou leitor de tela." />
<Clip name="gallery-large-text-android" caption="Emulador Android 16 / API 36, interface em inglês: escala de fonte de 1 para 2 e de volta, zoom preservado, rotação, rolagem dos controles e dois retornos à miniatura. Reprodução nativa na velocidade original, com indicadores de toques reais; a paisagem tem faixas pretas. Snapshot apenas registra diagnósticos. Não valida aparelho físico ou leitor de tela." />

[Reprodução e observações nativas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#enlarged-system-text-2026-10-30) detalham este recorte da tela de detalhe.

## Etapa suportada

Imagens estáticas empacotadas/em cache, retrato, paisagem e quadradas transparentes; um Core Frame/janela, Core ListView e vue-router-ns 0.1.0-rc.2. O retorno arrastado aceita recorte retangular do viewport e escala positiva uniforme. Uma miniatura parcialmente cortada pode abrir pela navegação comum; a resolução do destino de volta é independente. Troca de imagem de rede, pager, modais/Frames aninhados arbitrários, rotação da imagem e vídeo/GL/WebView ficam para outras etapas.

O guia e as [evidências nativas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) cobrem correção em simulador/emulador e o recorte de leitores no iPhone físico descrito abaixo. Frame pacing, latência de entrada e memória do processo em aparelhos físicos continuam abertos na #117; os vídeos não encerram essa matriz.

## Rotação e retomada no Android {#android-rotation-and-resume}

A auditoria no emulador Android 16 / API 36 preserva o zoom de 2,5× ao alternar retrato → paisagem → retrato e verifica um pan real no viewport redimensionado. Após ir à tela inicial e retomar o app, a rota de detalhe continua ativa e aceita um novo gesto de pinça seguido de pan, reset e cancelamento da saída.

A suspensão descarta a entrada de navegação compartilhada, como descrito acima; por isso, o primeiro fechamento após a retomada usa navegação comum. Cada abertura posterior cria uma entrada nova: três ciclos com imagens em retrato, transparentes e em paisagem concluem a volta compartilhada à miniatura atual. Ao final, o histórico retorna à galeria e os contadores nativos de transições, callbacks de Back e cenas retidas ficam zerados. Isso verifica esses recursos e interações visíveis; não mede memória do processo nem desempenho em aparelho físico.

<Clip name="gallery-lifecycle-android" caption="Emulador Android 16 / API 36, galeria em inglês: zoom, rotação, pan, tela inicial e retomada, nova pinça, cancelamento da saída e voltas repetidas com entrada real. Reprodução nativa na velocidade original. A gravação mantém faixas vazias em paisagem; sem medição de desempenho em aparelho físico." />

[A reprodução e os registros de ciclo de vida](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#android-lifecycle-audit-2026-10-29) cobrem esse adaptador e cenário. A matriz mais ampla de aceitação continua na [#117](https://github.com/rafaelaugustos/jolt/issues/117).

## Leitores de tela {#screen-readers}

Cada miniatura é um botão separado, inclusive as duas fotos de uma linha reciclada. Os metadados decorativos ficam fora da ordem de leitura; o título do detalhe é um cabeçalho, e ampliar/restaurar/fechar continuam acessíveis.

Durante o retorno com resolução de alvo, o Jolt retira temporariamente a página de destino da navegação do leitor para impedir que o foco automático role a célula para fora da transição. O estado original de acessibilidade é restaurado ao concluir, cancelar ou descartar. No próximo ciclo nativo, o foco vai à miniatura da chave atual; se a foto foi excluída, vai ao título da coleção. Uma solicitação pendente é ignorada se a view for reciclada/descarregada ou a navegação mudar de página.

O fluxo gravado cobre abertura, zoom de 2,5×, reset, fechar com zoom, reabrir após mover a foto ao índice 59, exclusão e uma quarta volta com a opção Reduzir Movimento do Jolt. Os registros verificam foco real, escala nativa, quatro navegações e nenhum recurso nativo de navegação restante. Essa gravação cobre o Core ListView/router da referência na configuração de fonte registrada. A combinação com texto ampliado está documentada abaixo; Android físico, outras configurações e desempenho continuam pendentes.

<Clip name="gallery-voiceover-ios" caption="iPhone 17 Pro físico, iOS 27.2, interface em inglês: navegação real com VoiceOver, duplo toque, zoom/reset, foco na miniatura após reordenar, alternativa no título após excluir e Reduzir Movimento. Gravação nativa do XCTest na velocidade original, sem áudio de fala. O registro associado verifica a fala do leitor e o foco nativo." />
<Clip name="gallery-talkback-android" caption="Emulador Android 16 / API 36, interface em inglês: gestos reais do TalkBack, exploração por toque e ativação por duplo toque em quatro retornos, incluindo itens movidos/excluídos e Reduzir Movimento. Gravação nativa na velocidade original, sem áudio de fala. Não valida Android físico nem desempenho." />

[Reprodução e evidências dos leitores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#screen-readers-2026-11-01).

## Leitores de tela com texto ampliado {#screen-readers-with-enlarged-text}

O mesmo fluxo de quatro retornos também passa com **VoiceOver e Dynamic Type do sistema em `accessibility-medium` no iPhone físico**, e **TalkBack com `font_scale=2` no emulador Android**. A navegação do leitor alcança ampliar, restaurar, mover e remover; o painel nativo permite rolar para revelar um controle cortado. O título continua como cabeçalho, o texto quebra linha sem reticências, os controles mantêm pelo menos 44 × 44 DIPs e a foto preserva um viewport separado.

As gravações mostram zoom de 2,5×, restauração, fechamento com zoom, retorno à foto movida para o índice 59, foco no título da coleção após exclusão e outra foto com Reduzir Movimento do Jolt. As verificações confirmam pose nativa, foco na chave atual, uma navegação por fechamento e contadores finais de transições, entradas e cenas retidas zerados. A automação restaura a fonte e as configurações de leitor originais. Isso valida o demo existente, sem exigir nova API pública.

<Clip name="gallery-large-text-voiceover-ios" caption="iPhone 17 Pro físico, iOS 27.2, interface em inglês: navegação e ativação reais com VoiceOver e accessibility-medium selecionado nos Ajustes do iOS. Controles ampliados, zoom/restauração e quatro retornos, incluindo fotos movidas/excluídas e Reduzir Movimento do Jolt. Gravação nativa do XCTest na velocidade original, sem áudio de fala; o registro verifica fala real, foco nativo e tamanho da fonte. Retrato, router/lista de referência." />
<Clip name="gallery-large-text-talkback-android" caption="Emulador Android 16 / API 36, interface em inglês: TalkBack real com escala de fonte 2, navegação pelo leitor, rolagem do painel com dois dedos, zoom/restauração e quatro retornos. Gravação nativa na velocidade original, sem áudio de fala; os registros verificam foco e geometria do texto. Evidência de correção em emulador, sem medição de desempenho ou Android físico." />

[Reprodução e evidências combinadas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#screen-readers-with-enlarged-text-2026-11-01). Outras categorias de fonte, paisagem com leitor, idiomas, Android físico e a matriz mais ampla de ciclo de vida/desempenho continuam na [#117](https://github.com/rafaelaugustos/jolt/issues/117).

[Receitas nativas completas](recipes.md)

## Aceitação atual em emuladores {#current-emulator-acceptance}

O candidato de 2026-11-03 repete as verificações de interrupção, retorno, rotação, texto ampliado e limpeza no iOS Simulator e Android Emulator, conforme solicitado. Interações nativas repetidas também registram amostras de memória do processo. Os 30 ciclos de scroll mostram alocação e coleta, sem crescimento monotônico; amostras finitas não provam ausência de vazamentos. [Resultados brutos e limites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/results/acceptance-2026-11-03/README.md). Este candidato não tem aceitação verificada em aparelhos físicos.
