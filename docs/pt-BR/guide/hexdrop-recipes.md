# A receita de movimento do Hexdrop

O [Hexdrop](https://github.com/rafaelaugustos/hexdrop) transforma um card de arquivo em ingrediente para uma poção nativa. A receita preserva o `useIngredientDrag.ts` completo do commit `ebdc02a2652051c982779ea43ba3d76cf99bb538`, com NativeScript-Vue 3 e Jolt **0.1.0-rc.11**.

## Um arraste com destino {#ingredient-drag}

[Leve a receita do gesto](/pt-BR/recipes/hexdrop-drag) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)

O `drag()` do Jolt acompanha o card e `snap: [0]` o devolve com spring quando o drop é rejeitado. O app reduz a escala para 0,86, inclina conforme o deslocamento horizontal e compara o retângulo transformado com o frasco nas coordenadas da janela. Um drop aceito pausa o controlador do gesto e absorve o card em 200 ms antes de chamar `onDrop`.

<Clip name="hexdrop-native-ios" :width="320" caption="Hexdrop · simulador iPhone 17 Pro, iOS 26.2. Arrastes reais via idb: retorno com spring, drop aceito, ignição, preenchimento e balanço da tampa. Interface em inglês, velocidade original, captura sem áudio. Demo local; nenhum arquivo é enviado. Não mede desempenho em aparelho físico." />

Chame `useIngredientDrag` no setup do componente. Conecte `loaded` e `tap` ao card nativo. Forneça `disabled`, um `target()` com limites nas coordenadas da janela e os callbacks `onStart`, `onHover` e `onDrop`. Copie `transformedRect`, `intersects` e o tipo `Rect` do módulo de geometria na revisão indicada; veja o painel para a integração completa. O Jolt fornece a mecânica do arraste; o app define a regra de aceitação.

Mantenha o controlador do gesto separado do scope de animação: reiniciar o feedback visual não deve remover a entrada. Preserve a proteção por geração na absorção, o teste na posição final, a supressão de tap após arrastar e a limpeza ao entrar em background ou desmontar. Um drop cancelado ou descartado não pode iniciar uma poção depois. O tap e o botão Brew potion oferecem alternativas ao arraste; preserve-os na adaptação.

O hook copiado não desenha a poção nem envia arquivos. A cena nativa completa está em `potion-view.ts`: ignição de 540 ms, preenchimento de 8,4 segundos guiado por um motion value, morphs do líquido, partículas e a aranha transferida ao pivô da tampa. O ciclo de vida e a redução de movimento pertencem à cena. Execute o projeto completo para essa arte. A gravação verifica apenas o simulador iOS; Android e Web não são demonstrados.

## Uma abertura com um relógio compartilhado {#launch}

[Um feitiço de abertura.](/pt-BR/recipes/hexdrop-launch) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/launch/launch-animation.ts)

A timeline de 1550 ms sobrepõe a marca flutuante, brilhos radiais, o traçado hexagonal, partículas e a entrada do título e legenda. Após reveal montar o conteúdo real, um fade de 320 ms remove a camada. Com Reduzir Movimento, os efeitos dão lugar a uma breve espera e fade. Copie o código completo com a estrutura do componente e o asset abaixo.

<Clip name="hexdrop-launch-ios" :width="320" caption="Abertura do Hexdrop no iOS: trecho de 3,8 a 7,0 segundos da gravação enviada pelo criador. Marca flutuante, selo desenhado, partículas, onda de luz e revelação do app. Interface em inglês, velocidade original, sem áudio. Dispositivo não informado; não é medição de desempenho." />

NativeScript-Vue 3 e Jolt RC.11. Forneça o GridLayout nativo montado e medido, os IDs de LaunchScreen.vue, seus estilos e hexdrop-mark.png. Preserve as superfícies de desenho em tamanho fixo e transforme os contêineres. O callback reveal monta o conteúdo e aguarda nextTick antes do fade. Guarde o handle, aguarde finished e chame dispose no descarte permanente; preserve redução de movimento e fallback de falha. A tela de inicialização do sistema é estática; a timeline começa quando o NativeScript está pronto. Execução verificada no simulador iOS.

[LaunchScreen.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/LaunchScreen.vue) · [App.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/App.vue) · [hexdrop-mark.png](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/assets/hexdrop-mark.png)

## Código e integração

- [useIngredientDrag.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)
- [geometry.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/geometry.ts)
- [IngredientPanel.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/IngredientPanel.vue)
- [potion-view.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/potion-view.ts)
- [README](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/README.md)

## O site em movimento

<Clip name="hexdrop-site-chromium" :width="960" caption="Chromium no macOS arm64. Interação real de ponteiro e teclado com o destaque do Hexdrop na home, o showcase e a receita, incluindo cópia de código e prompt. Velocidade original. Os vídeos incluem a gravação iOS do criador (dispositivo não informado) e a receita de arraste no simulador iPhone 17 Pro; não são versões Web. A listagem da comunidade, sem mudanças, usa uma resposta vazia isolada no teste local." />

<Clip name="hexdrop-creator-ios" :width="320" caption="Hexdrop no iOS: gravação enviada pelo criador com abertura animada, arraste, preparo da poção, seletor de documentos e replay. Velocidade original, sem áudio; os primeiros 3,8 segundos da tela inicial e transição do sistema foram omitidos. Dispositivo não informado. Demo local; nenhum arquivo é enviado." />
