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
  - title: Dimensões reais
    details: Anime width, height e auto. O texto se reorganiza e os controles vizinhos acompanham os limites reais. Usa layout em JavaScript por frame.
    link: /pt-BR/guide/size
  - title: Zoom da câmera SceneKit
    details: Anime o campo de visão em perspectiva junto com pintura, iluminação e pose da câmera no iOS, usando o plugin nativo opcional.
    link: /pt-BR/guide/scene-camera
---

## Novidades da 0.1.0-beta.15

[Dimensões reais](/pt-BR/guide/size) para cards expansíveis e [campo de visão da câmera SceneKit](/pt-BR/guide/scene-camera) para zoom coordenado em perspectiva. [Instale a versão](/pt-BR/guide/install) ou leia as [notas do release](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.15).

<div class="clips">
<Clip name="size-ios" caption="Width/height e auto reais, com reorganização do texto, interrupção e alvos de toque funcionais. Simulador iPhone 17, iOS 26; o app seleciona velocidade 0,25× no trecho de interrupção." />
<Clip name="scene-camera-ios" caption="Zoom em perspectiva SceneKit coordenado com pintura e iluminação, incluindo pausa e inversão. Gravação em tempo real no simulador iPhone 17, iOS 26." />
</div>

## Mais movimento

<div class="clips">
<Clip name="assistant-flow" caption="O assistente da demo no iOS. Cada movimento é uma chamada do Jolt." />
<Clip name="presets" caption="Presets, springs e stagger no playground." />
</div>
