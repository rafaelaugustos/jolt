# Voltando para células recicladas

Informe uma chave estável e um resolvedor `returnTarget` à entrada de navegação compartilhada. O Jolt busca a **view atual** depois do layout da página de retorno. Assim, a foto volta à miniatura correta mesmo após reordenação, rolagem ou reciclagem. A view salva na abertura não é usada como identidade de retorno.

Disponível no checkout para a próxima beta, ainda fora da beta.18. Recompile o aplicativo nativo. A referência usa um Core Frame, Core ListView e vue-router-ns 0.1.0-rc.2.

<Clip name="return-targets-ios" caption="Simulador iOS, inglês: toques reais movem a foto ao fim da grade reciclada, cancelam uma volta, retornam à nova célula e removem a foto para exercitar a alternativa. Velocidade original; não é medição de aparelho físico." />
<Clip name="return-targets-pt-ios" caption="Simulador iOS, português: o mesmo percurso com reordenação, cancelamento e exclusão, usando entrada real do sistema." />
<Clip name="return-targets-android" caption="Emulador Android, inglês: cancelamento e conclusão pelo gesto do sistema, resolução da célula atual e alternativa após exclusão. Velocidade original." />
<Clip name="return-targets-pt-android" caption="Emulador Android, português: gestos reais e controles acessíveis exercitam a volta à célula atual e a exclusão. Os indicadores mostram os toques reais." />

## Resolução com prazo

```ts
import {
  sharedNavigationEntry,
  resolveListTarget,
} from '@rafaelaugusto/jolt/shared-navigation'

const entry = sharedNavigationEntry(frame, {
  tag: `photo:${photo.key}`,
  spring: 'smooth',
  returnTarget: {
    key: photo.key,
    timeout: 1500,
    resolve(context) {
      return resolveListTarget(context, {
        list,
        // Índice atual da LINHA, inclusive em grades com itens agrupados.
        indexOf: (key) => rows.findIndex((row) => row.some((p) => p.key === key)),
        // Busque a tag atual nas células montadas; não guarde uma célula antiga.
        viewForKey: (key) => findCurrentImage(list, `photo:${key}`),
      })
    },
    fallbackFocus: () => collectionHeading,
  },
  back: async (options) => (await router.back(options)) === undefined,
})
await entry.open((options) => router.push(`/photos/${photo.key}`, options))
```

`findCurrentImage` pertence ao aplicativo e percorre os filhos atuais da lista. Consulte o [adaptador completo](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) e o [template de células nativas](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts). O template atualiza a tag da imagem reciclada com a chave do novo item, mantém apenas células realizadas e respeita o cache de imagens.

O resolvedor recebe `{ key, tag, page, signal }`. Pode devolver uma view, `null`, `undefined` ou uma promessa. `signal` oferece `aborted`, `addEventListener('abort', callback)` e `removeEventListener`, sem exigir o `AbortController` do navegador. Observe o cancelamento no trabalho do aplicativo. O prazo padrão é 1500 ms, com máximo de 5000 ms, incluindo realização e layout final. Resultados atrasados são ignorados. `resolveListTarget` rola até a linha atual e verifica novamente após o layout, exigindo a mesma célula e geometria em duas passagens, com até quatro tentativas se a identidade ou a posição estimada das linhas mudar.

Ao final, o Jolt exige uma única tag correspondente na página retornada e a mesma view carregada devolvida pelo resolvedor. Item ausente ou excluído, tags duplicadas, células antigas, falhas e timeout usam a transição comum/fade, preservando a decisão da rota. Rolagem recusada ou geometria incompatível também usam a alternativa. A view resolvida recebe o foco acessível; `fallbackFocus` pode indicar um título próximo quando o item sumiu.

## Comportamento por plataforma

No iOS, Core/UIKit monta a página de retorno sob o detalhe. O movimento nativo mantém a pose inicial enquanto o resolvedor realiza a célula e depois ajusta a origem do restante do gesto, sem saltar. Cancelar durante a espera aborta a preparação e mantém o detalhe. Uma volta confirmada termina uma vez. Mudanças de identidade ou geometria da célula durante o voo encerram a apresentação com segurança.

No Android 14+, o gesto do sistema mostra uma prévia da página atual de detalhe. Cancelar restaura essa página sem chamar a rota nem resolver o destino. Após a confirmação do sistema, o Jolt captura imagem/página visíveis, chama o roteador uma vez, realiza a célula atual e executa o voo nativo. **O destino reciclado ao vivo não é uma prévia interativa do predictive back**: sua resolução ocorre após a confirmação. Diferentemente do modo estático de [gestos compartilhados](./shared-gestures), esse modo não retém uma imagem antiga da grade durante toda a visita.

Os quadros dos gestos e animações continuam nativos. JavaScript participa da configuração, resolução e eventos de ciclo de vida. O orçamento combinado de pixels inclui a página temporária; conteúdo GPU/WebView/vídeo ou orçamento insuficiente usam navegação comum. Reduzir Movimento ainda resolve identidade/foco, sem o voo. Timeouts não cancelam promessas do aplicativo nem desfazem navegação externa tardia.

Na navegação programática, passe o mesmo `returnTarget` a `sharedNavigation().navigate()`. `holdSource: true` preserva uma captura limitada da página de origem enquanto o destino monta. `onCaptured` roda uma vez após a captura e antes do roteador, permitindo liberar as transformações de um controlador de foto suspenso. `cancel()` encerra apresentação e resolução; não desfaz uma rota confirmada.

## Investigação do zoom do UIKit

O iOS 18 introduziu `UIViewController.preferredTransition = .zoom(...)`. Seu provedor síncrono pode consultar repetidamente a view de origem atual; trabalha com controladores empilhados ou apresentados e controla o fechamento interativo. As opções públicas não expõem stiffness/damping/mass do Jolt nem este contrato de realização assíncrona. É uma possível implementação separada, não ativada por este adaptador. Consulte o [provedor de origem do zoom](https://developer.apple.com/documentation/uikit/uiviewcontrollertransition/zoomwithoptions%3Asourceviewprovider%3A) e as [orientações da Apple](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions).

Esta entrega cobre imagens estáticas decodificadas/contêineres simples, um Frame/janela e geometria compatível alinhada aos eixos. Modais nativos, Frames aninhados/abas, troca de imagens de rede e paginação da galeria ficam fora desse contrato. Evidência de simulador/emulador não conclui a matriz de aparelhos físicos, leitores de tela e desempenho das #24/#117. Veja a [reprodução e as verificações restantes](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/return-targets.md).

Combine este resolvedor com zoom nativo e retorno a partir da pose de soltura na [receita completa da galeria](./gallery).
