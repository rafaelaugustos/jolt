# Receitas de movimento do Auralis

Dois padrões do [Auralis](https://github.com/rafaelaugustos/auralis), revisados no commit `e533eae13cbf5a78d59dcadc4e61f45f28de88f2` com NativeScript-Vue 3 e Jolt **0.1.0-rc.11**. Cada receita traz o arquivo completo e um prompt de adaptação. O vídeo mostra o app iOS real do criador; o dispositivo de captura não foi informado.

<Clip name="auralis-native-ios" :width="320" caption="Auralis no iOS: gravação enviada pelo criador com abertura animada, cards de vidro flutuantes, três cenas de onboarding e controles de página. Velocidade original, sem áudio; os primeiros 4,25 segundos da tela inicial e transição do sistema foram omitidos. Dispositivo não informado; não é medição de desempenho. Contas e serviços são ilustrativos." />

## Encontre a luz. {#cards}

[Explore esta receita](/pt-BR/recipes/auralis-cards) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/choreography.ts)

Os cards que saem convergem atrás do horizonte inferior e desaparecem antes de os novos surgirem. A entrada usa um pequeno overshoot e stagger de 42 ms; a saída inverte a ordem com stagger de 26 ms. Os helpers calculam apenas o movimento. AuroraView cuida das máscaras, visibilidade, partículas, timeline e descarte.

NativeScript-Vue 3 e Jolt RC.11. As funções retornam keyframes e opções; AuroraView as agenda em uma timeline com scope. Forneça CardLayout, o limite inferior entre as duas cenas (maior coordenada y) e índice/quantidade de cards. A geometria usa um canvas de 402 pontos com centro x=201: adapte ou escale para sua cena. Separe as transformações de transição em card.view do movimento contínuo em card.art. Preserve fades de movimento reduzido, proteções de ciclo de vida e descarte dos scopes. Os helpers não desenham vidro, texto ou partículas; veja aurora-view.ts e artwork.ts. A plataforma gravada é iOS.

## Um relógio. Todas as cenas. {#clock}

[Explore esta receita](/pt-BR/recipes/auralis-clock) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useCarouselClock.ts)

Um motion value vai de 0 a 1 em 4000 ms. Ele preenche o indicador ativo e chama advance ao terminar. useOnboarding interrompe o relógio antes de mudar de cena e o reinicia depois de a nova cena estabilizar. toggle suspende ou retoma o scope; a proteção por geração rejeita callbacks de timers substituídos.

Chame useCarouselClock no setup do NativeScript-Vue com um callback advance assíncrono. Vincule progress ao scaleX do indicador com originX=0, como em PageIndicator.vue. Chame hold antes de navegar e start após a cena estabilizar; conecte playing/toggle a um controle rotulado. O hook começa pausado se movimento reduzido ou leitor de tela estiver ativo no setup. Preserve a proteção por geração, o motion scope e a limpeza no unmount. Pausar mantém o timer atual; navegar manualmente reinicia o intervalo de leitura. O hook não fornece views, navegação por swipe nem listener para alterações nas preferências. Veja useOnboarding.ts para coordenação.

A gravação demonstra abertura, transições, progresso do indicador e navegação. Background/retomada e modos de acessibilidade são descritos a partir do código revisado e não são demonstrados neste vídeo. As APIs nativas e a geometria não constituem uma implementação Web.

## Código e integração

- [aurora-view.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/aurora-view.ts)
- [artwork.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/artwork.ts)
- [useOnboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useOnboarding.ts)
- [PageIndicator.vue](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/components/PageIndicator.vue)
- [onboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/onboarding.ts)
- [README.md](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/README.md)

## O site em movimento

<Clip name="auralis-site-chromium" :width="960" caption="Chromium no macOS arm64: navegação pelo destaque do Auralis na home, showcase, vídeo nativo e duas receitas, incluindo cópia de código e prompt. Velocidade original. O vídeo nativo foi enviado pelo criador e gravado no iOS, com dispositivo não informado. A listagem da comunidade, sem mudanças, usa uma resposta vazia na revisão local." />
