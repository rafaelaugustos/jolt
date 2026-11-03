# Histórico de versões

## 0.1.0-rc.11: ajustes Web e playback nativo {#release-candidate}

A RC.11 ajusta o [teclado mobile](./web-platforms), os [intervalos de scroll relativos ao elemento](./web-support) e o diagnóstico de conflitos entre superfícies. No nativo, inclui adapters opcionais, [sensores](./device-sensors), [shaders controlados por spring/scroll, máscaras líquidas e vídeo local sem áudio no iOS](./image-effects). O [playback Android](./android-performance) retém menos dados após as animações terminarem; o exportador de auditoria processa relatórios em um worker. O [estudo em aparelho físico](./performance-study) documenta CPU, memória e apresentação sem alterar os padrões dos aplicativos.

As APIs Web continuam experimentais. O site já usa o runtime Web na escultura, no movimento com scroll e no playground; as mudanças de shaders/vídeo nativos não se aplicam automaticamente ao DOM. [Instale a RC.11](./install), mantenha o pacote nativo opcional na mesma versão e recompile os apps nativos. [Changelog da versão](https://github.com/rafaelaugustos/jolt/blob/v0.1.0-rc.11/CHANGELOG.md).

<Clip name="shader-inputs-liquid-mask-ios" caption="Simulador de iPhone 17 Pro, iOS 26.2, interface em inglês. Toques e scroll reais via XCTest controlam fusão/separação, resize pausado e em reprodução e descarte. O fundo quadriculado mostra a transparência. Velocidade original; não é aparelho físico." />
<Clip name="web-element-range-chromium" caption="Chromium desktop, interface em inglês. Scroll e cliques reais mostram entrada/saída da seção, inserção acima dela, resize, diagnóstico de geometria e recuperação. Gravação do navegador em velocidade original; não é evidência de desempenho nativo ou em aparelho físico." />

## 0.1.0-rc.10: efeitos Web, sensores e retorno completo da galeria {#rc-10}

A RC.10 adiciona [gradientes, loading e texto](./web-effects), [partículas, blur, formas e efeitos de imagem](./web-surfaces), [teclado, sheets, navegação, física e ícones](./web-platforms) e [gravidade, haptics, sensores, glass e retorno à miniatura por chave](./web-parity). Apps nativos ganham [headers no Core ScrollView](./scroll-header#retained-scrollview) e [reordenação de linhas montadas](./reorder#retained-rows).

As APIs Web continuam experimentais. [Instale a RC.10](./install), mantenha os adapters nativos opcionais na mesma versão e recompile apps nativos. [Notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.10). A adoção no Mavis permanece separada.

## 0.1.0-rc.8: orquestração e ciclo de vida Web {#rc-8}

A RC.8 adiciona [playback de valores, decay, progresso, sequências, timelines, estados e desenho SVG](/pt-BR/guide/web-orchestration), além de [montagem Vue/Nuxt, entradas por identidade e scroll horizontal](/pt-BR/guide/web-collections). Os [estados nativos](/pt-BR/guide/motion-controllers#paused-replacement) agora retomam a view substituta depois de remover a anterior durante a pausa.

As APIs Web continuam experimentais, com limites documentados de coordenadas/captura; a adoção no Mavis é separada. [Instale a RC.8](/pt-BR/guide/install), mantenha o pacote nativo opcional na mesma versão e recompile apps nativos. Veja as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.8) e a [aceitação restante](/pt-BR/guide/not-there-yet).

## 0.1.0-rc.7: layout e interações completas na Web {#rc-7}

A RC.7 adiciona [cores, bordas, tamanho intrínseco, FLIP e cenas com seek](/pt-BR/guide/web-visual), [escopos, ponteiro/viewport e configuração contínua Vue](/pt-BR/guide/web-lifecycle), além de [geometria de overlays, elementos compartilhados, receitas e diagnóstico](/pt-BR/guide/web-interactions). O [showcase](/pt-BR/guide/showcase) apresenta exemplos nativos e envios da comunidade.

As APIs Web continuam experimentais, com limites documentados de coordenadas/captura; a adoção no Mavis é separada. [Instale a RC.7](/pt-BR/guide/install), mantenha o pacote nativo opcional na mesma versão e recompile apps nativos. Veja as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.7) e a [aceitação restante](/pt-BR/guide/not-there-yet).

## 0.1.0-rc.6: interação Web e movimento nativo {#rc-6}

A RC.6 adiciona [valores, springs contínuas e drag/snap Web](/pt-BR/guide/web-dynamic), além de [mapeamentos, geometria e scroll](/pt-BR/guide/web-support). No nativo, entrega [cores e raio em springs](/pt-BR/guide/live-springs), [cenas com seek](/pt-BR/guide/sequences), [tamanho em Flexbox](/pt-BR/guide/size) e [molas entre corpos](/pt-BR/guide/physics-attachments).

As APIs Web continuam experimentais; a integração Mavis é separada. [Instale a RC.6](/pt-BR/guide/install), recompile apps nativos e confira as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.6) e a [aceitação restante](/pt-BR/guide/not-there-yet).

## 0.1.0-rc.4: composição nativa, retomada e sheets {#rc-4}

A RC.4 toca [camadas infinitas sem período comum](/pt-BR/guide/layers) em compositores nativos em vez de reconstruir janelas de quatro segundos, então composições de 64 views passam de centenas de milissegundos por boundary para zero nos aparelhos medidos. Retoma [shapes, gradientes e blur do Android](/pt-BR/guide/shapes) do tempo em que estavam pausados, posiciona o [bottom sheet](/pt-BR/guide/bottom-sheet) pelos insets de safe area do host e oferece só as ações do handle que um stop pode executar.

O [preview](/pt-BR/guide/demo) tem **74 exemplos em quatro idiomas**. [Instale a RC.4](/pt-BR/guide/install) e recompile o app nativo. Confira as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.4) e as [validações pendentes em aparelhos físicos](/pt-BR/guide/not-there-yet) antes da estável.

## 0.1.0-rc.3: modais, formas e alvos {#_0-1-0-rc-3-modals-shapes-and-targets}

A RC.3 adiciona [modais interativos no iOS](/pt-BR/guide/interactive-navigation), constrói [keyframes numéricos do Android em uma única chamada nativa](/pt-BR/guide/motion-values), permite [criar formas antes de a view carregar](/pt-BR/guide/shapes) e aceita [refs de componente como alvos](/pt-BR/guide/vue). Ajusta a [galeria](/pt-BR/guide/gallery) e os [cabeçalhos de scroll](/pt-BR/guide/scroll-header) ao texto grande do sistema e conclui as auditorias físicas de [sensores](/pt-BR/guide/device-sensors) e de [bindings/camadas](/pt-BR/guide/motion-values).

O [preview](/pt-BR/guide/demo) tem **74 exemplos em quatro idiomas**. [Instale a RC.3](/pt-BR/guide/install) e recompile o app nativo. Confira as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.3) e as [validações pendentes em aparelhos físicos](/pt-BR/guide/not-there-yet) antes da estável.

## 0.1.0-rc.2: correções de ciclo de vida e composição {#_0-1-0-rc-2-lifecycle-and-composition-fixes}

A RC.2 corrige [âncoras de scroll durante resize e reload](/pt-BR/guide/scroll-header), [gestos de volta no iOS após background](/pt-BR/guide/interactive-navigation), [a soltura do press em camadas](/pt-BR/guide/press#layered-press) e [a sincronização da composição nativa](/pt-BR/guide/layers). Inclui [arraste nativo com mola no ponteiro](/pt-BR/guide/physics-attachments) e [validação do ciclo de vida da galeria no Android](/pt-BR/guide/gallery#android-rotation-and-resume).

O [preview](/pt-BR/guide/demo) agora tem **74 exemplos em quatro idiomas**. [Instale a RC.2](/pt-BR/guide/install) e recompile o app nativo. Confira as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.2) e as [validações pendentes em aparelhos físicos](/pt-BR/guide/not-there-yet) antes da estável.

## 0.1.0-rc.1: a primeira candidata a release

O escopo de funcionalidades da 0.1.0 está congelado. Esta candidata reúne [navegação compartilhada](/pt-BR/guide/shared-navigation) e uma [galeria conectada](/pt-BR/guide/gallery), [gestos nativos de voltar no iOS](/pt-BR/guide/interactive-navigation) e [predictive back no Android](/pt-BR/guide/predictive-back), [composição por scroll](/pt-BR/guide/scroll-header), [sensores](/pt-BR/guide/device-sensors), [gravidade](/pt-BR/guide/gravity) e [física de círculos com vínculos](/pt-BR/guide/physics-attachments).

[Desenho e morph de vetores](/pt-BR/guide/shapes), [blur animado](/pt-BR/guide/blur) e [Liquid Glass no iOS 26](/pt-BR/guide/glass) completam um [preview](/pt-BR/guide/demo) com **73 exemplos em português, inglês, espanhol e chinês simplificado**. Recompile o app nativo após atualizar. [Instale a RC.1](/pt-BR/guide/install), leia as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.1) ou confira as [validações pendentes antes da estável](/pt-BR/guide/not-there-yet). A fase de RC se concentra em correções, compatibilidade e testes em aparelhos físicos.

<div class="clips">
<Clip name="gallery-ios" caption="Simulador iOS, interface em inglês: pinch/pan reais, zoom interrompido, dispensa cancelada e retorno à miniatura atual após reordenação. Tempo original." />
<Clip name="physics-attachments-android" caption="Emulador Android, interface em inglês: arrasto e soltura reais com vínculos, molas, colisões e pontos de encaixe nativos. Tempo original; não mede desempenho em aparelho físico." />
<Clip name="shapes-android" caption="Emulador Android, interface em inglês: toques reais desenham um traço vetorial, transformam caminhos compatíveis, interrompem e pausam a animação. Tempo original." />
<Clip name="glass-ios" caption="Simulador iOS 26.2, interface em inglês: superfícies nativas de vidro se unem e separam, com troca de material, interrupção, pausa/retomada e Reduzir Movimento. Toques reais; tempo original." />
</div>

## Entregue na beta.18

[Layouts compartilhados](/pt-BR/guide/shared-layout) movem elementos com identidade estável entre layouts da mesma página. O [replay de interações](/pt-BR/guide/interaction-replay) transforma springs interrompidas, arrastos cancelados e transferências entre scroll e sheet em testes de regressão. A [amostragem adaptativa](/pt-BR/guide/transitions) concentra keyframes nativos onde a curva precisa, enquanto o [inspetor de movimento](/pt-BR/guide/motion-inspector) mostra quem controla cada propriedade, compara observações nativas, ajusta uma spring e copia o TypeScript. Aquela versão ampliou o preview para 59 exemplos em português e inglês. [Instale a versão](/pt-BR/guide/install) ou leia as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.18).

<div class="clips">
<Clip name="shared-layout-ios" caption="Indicador de aba compartilhado, expansão da capa do álbum e inversão rápida. Entrada real do SO em simulador iOS, na velocidade original." />
<Clip name="scroll-handoff-replay-android" caption="Gravação da transferência entre scroll e sheet, replay e detecção de checkpoint errado de propósito. Interação real via ADB no emulador Android; o replay de contato mantido não testa o reconhecedor do SO." />
<Clip name="curve-sampling-ios" caption="Curvas adaptativas e de taxa fixa pelo player nativo no simulador iOS. A spring rápida está quatro vezes mais lenta de propósito; os números descrevem erro da curva, não FPS." />
<Clip name="motion-inspector-android" caption="Inspeção de controle das propriedades, ajuste e pausa de uma spring, com cópia do TypeScript. Entrada real no emulador Android; observações da View nativa não medem apresentação da GPU nem FPS de aparelho físico." />
</div>

## Bottom sheet, listas e SceneKit

[Bottom sheet](/pt-BR/guide/bottom-sheet) coordena arrasto, scroll e teclado; [reordenação de listas](/pt-BR/guide/reorder) move itens entre células recicladas com rolagem automática nativa. No iOS, [ambiente e shaders](/pt-BR/guide/scene-shaders) recebem intensidade e uniforms tipados pelo player nativo. O preview também oferece aparência clara, escura ou do sistema.

<div class="clips">
<Clip name="bottom-sheet-ios" caption="Arrasto, transferência para o scroll, crescimento do conteúdo e teclado. Entrada real via XCTest em simulador iOS 26." />
<Clip name="reorder-android" caption="Reordenação de 200 itens com rolagem automática e reciclagem de células. Toques reais do SO em emulador Android, na velocidade original." />
<Clip name="scene-shaders-ios" caption="Iluminação ambiente e parâmetros escalares/vetoriais do shader pelo player nativo SceneKit. Toques reais em simulador iOS; não é uma medição em aparelho físico." />
<Clip name="showcase-appearance-ios" caption="Preview Jolt com temas claro/escuro e transição circular. Gravação real do simulador iOS." />
</div>

## Springs ao vivo e gestos nativos

<div class="clips">
<Clip name="live-springs-ios" caption="Seguidores nativos com inversões e uma camada independente. Interação real no simulador iOS; os eventos de toque desta demo passam por JavaScript." />
<Clip name="live-springs-android" caption="A mesma cadeia de springs com inversões e redução de movimento no emulador Android. Não é uma medição de desempenho em aparelho físico." />
<Clip name="gesture-composition-ios" caption="Pan, pinch e rotação simultâneos, seguidos de toques simples e duplos. Entrada real do SO no simulador iOS." />
<Clip name="gesture-handoff-android" caption="Um arrasto expande o painel e rola seu conteúdo; o arrasto inverso retorna ao painel sem soltar o dedo. Emulador Android, ScrollView vertical do Core." />
</div>

## Dimensões e câmera

<div class="clips">
<Clip name="size-ios" caption="Width/height e auto reais, com reorganização do texto, interrupção e alvos de toque funcionais. Simulador iPhone 17, iOS 26; o app seleciona velocidade 0,25× no trecho de interrupção." />
<Clip name="scene-camera-ios" caption="Zoom em perspectiva SceneKit coordenado com pintura e iluminação, incluindo pausa e inversão. Gravação em tempo real no simulador iPhone 17, iOS 26." />
</div>

## Mais movimento

<div class="clips">
<Clip name="assistant-flow" caption="O assistente da demo no iOS. Cada movimento é uma chamada do Jolt." />
<Clip name="presets" caption="Presets, springs e stagger no playground." />
</div>
