# Como funciona

Quando uma animação começa, o Jolt resolve de onde cada propriedade parte (o valor na tela, ou os keyframes que você deu), e calcula a curva inteira: easing, keyframes, física do spring e desaceleração exponencial. Ele amostra a curva 60 vezes por segundo de movimento, e mantém os tempos dos keyframes exatos. Trechos lineares não são amostrados. Decays livres muito longos limitam a amostragem a 6.001 keyframes.

As amostras vão para a plataforma de uma vez:

- **iOS**: um `CAKeyframeAnimation` por propriedade na layer da view (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). O Core Animation os compõe, então `x` e `scale` podem pertencer a animações diferentes, e os toca no render server.
- **Android**: um `ObjectAnimator` por propriedade com `Keyframe`s e um interpolador linear, nos `alpha`, `translationX`, `scaleY`, `rotation`... da view.

Antes de tocar, os valores finais são definidos na view do NativeScript, como o `view.animate()` faz, então `view.translateX` já contém o alvo enquanto a animação roda. Parar escreve de volta os valores na tela.

Cada propriedade em andamento guarda sua curva e o instante de início. No Android, as interrupções leem o valor na tela e o tempo atual do animator, então a velocidade herdada acompanha a escala de duração das animações do sistema. A chegada antecipada dos springs usa um marcador de tempo nativo com callbacks apenas na conclusão; as demais sequências avançam na conclusão nativa. Delays, repetições e animações desativadas seguem o mesmo relógio da plataforma, sem JavaScript por frame.

## Testes

Os testes rodam a engine contra um driver de plataforma falso ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) com o próprio relógio: ele registra os keyframes que tocaria e os encerra quando o relógio passa do fim. Os drivers de iOS e Android são checados pelos tipos contra as tipagens das plataformas.
