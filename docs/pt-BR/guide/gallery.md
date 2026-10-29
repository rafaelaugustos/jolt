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

Reduzir Movimento mantém zoom, restaurar, fechar, navegação e foco sem a transição compartilhada. Réplicas ficam ocultas da acessibilidade. O foco volta ao item atual; o título da coleção é a alternativa quando ele desaparece. A validação física de VoiceOver/TalkBack e fontes grandes continua pendente.

## Etapa suportada

Imagens estáticas empacotadas/em cache, retrato, paisagem e quadradas transparentes; um Core Frame/janela, Core ListView e vue-router-ns 0.1.0-rc.2. O retorno arrastado aceita recorte retangular do viewport e escala positiva uniforme. Uma miniatura parcialmente cortada pode abrir pela navegação comum; a resolução do destino de volta é independente. Troca de imagem de rede, pager, modais/Frames aninhados arbitrários, rotação da imagem e vídeo/GL/WebView ficam para outras etapas.

O guia e as [evidências nativas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) cobrem correção em simulador/emulador. Frame pacing, latência de entrada e memória do processo em aparelhos físicos continuam abertos na #117; os vídeos não encerram essa matriz.

## Rotação e retomada no Android {#android-rotation-and-resume}

A auditoria no emulador Android 16 / API 36 preserva o zoom de 2,5× ao alternar retrato → paisagem → retrato e verifica um pan real no viewport redimensionado. Após ir à tela inicial e retomar o app, a rota de detalhe continua ativa e aceita um novo gesto de pinça seguido de pan, reset e cancelamento da saída.

A suspensão descarta a entrada de navegação compartilhada, como descrito acima; por isso, o primeiro fechamento após a retomada usa navegação comum. Cada abertura posterior cria uma entrada nova: três ciclos com imagens em retrato, transparentes e em paisagem concluem a volta compartilhada à miniatura atual. Ao final, o histórico retorna à galeria e os contadores nativos de transições, callbacks de Back e cenas retidas ficam zerados. Isso verifica esses recursos e interações visíveis; não mede memória do processo nem desempenho em aparelho físico.

<Clip name="gallery-lifecycle-android" caption="Emulador Android 16 / API 36, galeria em inglês: zoom, rotação, pan, tela inicial e retomada, nova pinça, cancelamento da saída e voltas repetidas com entrada real. Reprodução nativa na velocidade original. A gravação mantém faixas vazias em paisagem; sem medição de desempenho em aparelho físico." />

[A reprodução e os registros de ciclo de vida](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md#android-lifecycle-audit-2026-10-29) cobrem esse adaptador e cenário. A matriz mais ampla de aceitação continua na [#117](https://github.com/rafaelaugustos/jolt/issues/117).
