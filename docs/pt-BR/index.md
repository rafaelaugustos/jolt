---
layout: home

hero:
  text: Faça o NativeScript se mexer.
  tagline: Presets, springs, keyframes e stagger para views do NativeScript, uma chamada cada. Playback nativo nas tracks de views, layout real quando o conteúdo precisa se reorganizar.
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: Jolt
  actions:
    - theme: brand
      text: Começar
      link: /pt-BR/guide/install
    - theme: alt
      text: O que é o Jolt
      link: /pt-BR/guide/
    - theme: alt
      text: Presets
      link: /pt-BR/guide/presets

features:
  - title: Uma chamada
    details: "animate(card, 'fadeInUp'), animate(button, { scale: 1.1 }, 'bouncy'), animate(rows, 'fadeInUp', { stagger: 40 }). Essa é a API inteira para a maioria das telas."
  - title: Springs com física de verdade
    details: Descreva pela sensação, por bounce e duração, ou por rigidez, amortecimento e massa. Um spring interrompido mantém a velocidade.
  - title: Keyframes e easing por trecho
    details: Listas de valores com tempos exatos, um easing por trecho, cubic beziers ou qualquer função. Easings customizados rodam uma vez, não por frame.
  - title: Playback nativo de views
    details: As tracks padrão de views tocam pelo Core Animation no iOS e ObjectAnimator no Android sem JavaScript por frame. APIs de layout e interação documentam seus próprios custos de execução.
  - title: Sequências, stagger e press
    details: Passos que começam quando o anterior parece pronto, staggers a partir do primeiro, do último ou do centro, e efeitos de press que soltam quando um scroll assume.
  - title: Interrupções sem pulo
    details: Uma animação nova numa propriedade em movimento começa do valor na tela, na velocidade em que ia.
  - title: Springs ao vivo
    details: Seguidores nativos mantêm posição e velocidade entre mudanças de alvo, com mapeamentos, camadas e descarte por escopo.
    link: /pt-BR/guide/live-springs
  - title: Gestos nativos
    details: Combine pan, pinch e rotação. Coordene o eixo com uma lista e transfira o arrasto entre um painel e seu ScrollView.
    link: /pt-BR/guide/gestures
  - title: Dimensões reais
    details: Anime width, height e auto. O texto se reorganiza e os controles vizinhos acompanham os limites reais. Usa layout em JavaScript por frame.
    link: /pt-BR/guide/size
  - title: Zoom da câmera SceneKit
    details: Anime o campo de visão em perspectiva junto com pintura, iluminação e pose da câmera no iOS, usando o plugin nativo opcional.
    link: /pt-BR/guide/scene-camera
---

## Novidades da 0.1.0-beta.16

[Springs ao vivo](/pt-BR/guide/live-springs) acompanham alvos em movimento; [gestos nativos](/pt-BR/guide/gestures) combinam pan, pinch e rotação e transferem o arrasto para o ScrollView. O CI agora valida comportamento nativo em iOS e Android. [Instale a versão](/pt-BR/guide/install) ou leia as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.16).

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
