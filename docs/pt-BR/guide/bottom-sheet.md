# Bottom sheet

`bottomSheet()` combina arraste nativo, transferência para o scroll, springs, backdrop e acompanhamento do teclado em uma receita opcional dentro da página. Importe de `@rafaelaugusto/jolt/bottom-sheet`; o entry point principal continua independente do sheet.

Disponível desde a **0.1.0-beta.17**, no pacote principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.2` e recompile o app para incluir os callbacks nativos de contato. Não exige o plugin opcional de propriedades nativas.

Coloque um `GestureSurface` diretamente em um `GridLayout` de uma célula que ocupe a área do overlay. Dentro do painel, use um handle separado e um `ScrollView` vertical do NativeScript. O backdrop é um irmão atrás do painel. As views e sua aparência continuam pertencendo ao app.

```ts
import { bottomSheet } from '@rafaelaugusto/jolt/bottom-sheet'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const sheet = scope.add(
  bottomSheet(panel, {
    handle,
    scrollView: results,
    snap: ['content', '50%', '90%'],
    backdrop,
    returnFocus: openButton,
    keyboard: 'follow',
  }),
)

sheet.open('50%')
sheet.expand() // Próxima parada de maior altura
sheet.collapse() // Próxima parada menor, depois fecha
sheet.dismiss()
// Ao destruir o componente:
scope.dispose()
```

O handle é uma view acessível separada: suas ações não transformam todos os filhos do painel em um único elemento do leitor de tela. `GestureSurface` também é exportado pelo entry point do bottom sheet.

## Arraste, scroll e paradas que mudam

Os snaps são alturas positivas em DIP, percentuais até `100%` ou `content`. Os percentuais usam a altura útil do host, descontando safe areas e a sobreposição do teclado. `content` mede `scrollView.content` e a área do painel fora do scroll. Sem ScrollView, passe uma view `content` com tamanho intrínseco contendo o conteúdo desejado do sheet.

Mudanças de layout recalculam as paradas. Conteúdo que cresce, redimensionamento do host e rotação atualizam o alvo lógico sem reiniciar o spring nativo em outra posição. O viewport usa a maior parada, permitindo alcançar as últimas linhas quando totalmente expandido. Também existe `sheet.remeasure()` para mudanças controladas pelo app.

Arrastar para cima dentro da lista primeiro expande o painel e depois rola o conteúdo, no mesmo contato. Arrastar para baixo primeiro retorna a lista ao topo e depois move o painel. Tocar interrompe um fling imediatamente; soltar sem chegar a arrastar também escolhe uma parada. O coordenador nativo cuida do movimento e do consumo do scroll. Painel e backdrop usam bindings nativos de motion values. JavaScript trata eventos de layout/teclado e observa brevemente o fechamento para esconder as views após o repouso.

<Clip name="bottom-sheet-ios" caption="Entrada real via XCTest em simulador iOS 26: conteúdo que cresce, transferência do arraste para o scroll, campo focado acompanhando o teclado virtual e fechamento. Não é uma medição em aparelho físico nem de desempenho do leitor de tela." />

<Clip name="bottom-sheet-android" caption="Entrada real do sistema em emulador Android: expansão antes de rolar, retorno da lista ao topo antes de mover o painel, conteúdo que cresce, acompanhamento do teclado e fechamento pelo botão voltar." />

## Teclado e fechamento

`keyboard: 'follow'` é o padrão. Com o teclado visível, o sheet ocupa temporariamente a área útil acima dele, mantém o campo focado visível e guarda o snap escolhido. Quando o teclado desaparece, o snap é restaurado. Se o Android já redimensionou o host, o espaço do teclado não é descontado novamente. Use `'none'` quando o app já cuida disso.

O backdrop, uma soltura para baixo, o voltar do Android e a ação nativa de acessibilidade podem fechar o sheet. `dismissible: false` desativa essas formas de fechamento pelo usuário; `sheet.dismiss()` continua funcionando. Um fechamento interrompido não chama `onDismiss` nem restaura o foco antes da hora.

Os insets de safe area vêm do host, em DIP. O Core já posiciona os filhos do host dentro desses insets, então o painel começa no inset superior do host e a altura útil desconta os dois insets. Sob um indicador de home, o painel se estende até a borda da janela enquanto o conteúdo fica acima do indicador; enquanto o teclado cobre essa borda, o painel termina no teclado. `safeArea: { top, bottom }` substitui os insets medidos quando o layout externo já cuida deles; um override de topo só soma ao posicionamento do host. Mantenha o host do overlay na mesma janela do painel e do teclado.

<Clip name="bottom-sheet-safe-area-ios" caption="Entrada real via XCTest num simulador de iPhone 17 Pro (iOS 26.0) com host de janela inteira: o snap de conteúdo termina na borda da janela com as linhas acima do indicador de home, o snap total começa abaixo da barra de status e o painel acompanha o teclado. Gravação de simulador, não evidência de aparelho físico." />

## Acessibilidade e ciclo de vida

O handle recebe ações nativas Expand, Collapse e Dismiss, preservando ações existentes. Traduza os textos com `accessibility: { label, expand, collapse, dismiss }`. O voltar nativo só é interceptado enquanto o sheet está aberto e carregado. `returnFocus` indica o controle que deve recuperar o foco após o fechamento; sem ele, a receita captura o foco nativo atual. Reduced Motion segue a configuração do Jolt e a preferência do sistema.

O controle expõe `isOpen`, `snapPoint`, `visibleHeight`, `paused` e `disposed`, além de `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `pause`, `play` e `dispose`. `onChange(point)` informa o snap escolhido, ou `null` ao solicitar fechamento; `onDismiss()` espera a conclusão.

O unload libera sessão de gestos, bindings e assinatura do teclado; o reload reconecta as mesmas views. O descarte restaura as propriedades de layout/acessibilidade administradas pela receita. Não anime simultaneamente o Y do painel ou a opacidade do backdrop com outro owner.

A primeira versão suporta painel dentro da página e o `ScrollView` vertical do core. Modal nativo, plugins de listas virtualizadas e transferência de scroll entre janelas exigem outros adaptadores. Os testes nativos exercitam ações de acessibilidade e foco; uma auditoria completa de navegação VoiceOver/TalkBack em aparelhos físicos é separada destas gravações em simulador.

Com o snap `content`, a receita alinha o conteúdo ao topo para manter a altura intrínseca de listas curtas. `dispose()` restaura também esse alinhamento.
