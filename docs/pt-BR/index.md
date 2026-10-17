---
layout: home

hero:
  text: Faça o NativeScript se mexer.
  tagline: Presets, springs, keyframes e stagger para views do NativeScript, uma chamada cada. Calculado uma vez em JavaScript, tocado pela plataforma.
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
  - title: Nada roda enquanto toca
    details: O movimento vai para o Core Animation no iOS e para o ObjectAnimator no Android como keyframes. O JavaScript fica livre durante a animação.
  - title: Sequências, stagger e press
    details: Passos que começam quando o anterior parece pronto, staggers a partir do primeiro, do último ou do centro, e efeitos de press que soltam quando um scroll assume.
  - title: Interrupções sem pulo
    details: Uma animação nova numa propriedade em movimento começa do valor na tela, na velocidade em que ia.
---

<div class="clips">
<Clip name="assistant-flow" caption="O assistente da demo no iOS. Cada movimento é uma chamada do Jolt." />
<Clip name="presets" caption="Presets, springs e stagger no playground." />
</div>
