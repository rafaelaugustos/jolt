# Como funciona

Quando uma animação começa, o Jolt resolve de onde cada propriedade parte (o valor na tela, ou os keyframes que você deu), e calcula a curva inteira: easing, keyframes, física do spring. Ele amostra a curva 60 vezes por segundo de movimento, e mantém os tempos dos keyframes exatos. Trechos lineares não são amostrados.

As amostras vão para a plataforma de uma vez:

- **iOS**: um `CAKeyframeAnimation` por propriedade na layer da view (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). O Core Animation os compõe, então `x` e `scale` podem pertencer a animações diferentes, e os toca no render server.
- **Android**: um `ObjectAnimator` por propriedade com `Keyframe`s e um interpolador linear, nos `alpha`, `translationX`, `scaleY`, `rotation`... da view.

Antes de tocar, os valores finais são definidos na view do NativeScript, como o `view.animate()` faz, então `view.translateX` já contém o alvo enquanto a animação roda. Parar escreve de volta os valores na tela.

Cada propriedade em andamento lembra a própria curva e o instante de início, então o Jolt sabe o valor e a velocidade de qualquer propriedade a qualquer momento sem perguntar à plataforma. É isso que permite a uma interrupção continuar o movimento de onde estava. No Android, onde um animator começa no frame seguinte, ele lê o valor na tela no lugar.

## Testes

Os testes rodam a engine contra um driver de plataforma falso ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) com o próprio relógio: ele registra os keyframes que tocaria e os encerra quando o relógio passa do fim. Os drivers de iOS e Android são checados pelos tipos contra as tipagens das plataformas.
