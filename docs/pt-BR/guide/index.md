# O que é o Jolt

O Jolt anima views do [NativeScript](https://nativescript.org): presets, springs, keyframes e stagger, uma chamada cada.

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Por que não o `view.animate()`

O `view.animate()` do NativeScript cobre o básico e para por aí: uma curva para todas as propriedades, uma curva `spring` sem ajustes, nenhum keyframe, e uma promise que rejeita quando a animação é cancelada. Qualquer coisa mais rica acaba virando código de plataforma.

O Jolt calcula o movimento uma vez, em JavaScript, quando a animação começa, e entrega à plataforma como keyframes: Core Animation no iOS, `ObjectAnimator` no Android. Nada roda em JavaScript enquanto ela toca. Os springs seguem física de verdade, e uma animação que interrompe outra começa de onde a view está, na velocidade em que ia.

## O que ele cobre

- [25 presets](./presets) para entrar, sair e chamar atenção: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Springs](./transitions#springs) descritos pela sensação (`bouncy`), por `bounce` e `duration`, ou por rigidez, amortecimento e massa.
- [Keyframes e tweens](./transitions#tweens) com um easing por trecho e tempos de keyframe exatos.
- [Stagger](./stagger) entre várias views, a partir da primeira, da última ou do centro.
- [Sequências](./sequences) que começam cada passo quando o anterior parece pronto.
- [Efeitos de press](./press) que acompanham o dedo e soltam quando um scroll assume.
- [Interrupções](./interrupting) que pegam o valor e a velocidade na tela, sem pulo.
- [Reprodução nativa](./how-it-works): Core Animation no iOS, `ObjectAnimator` no Android, nada em JavaScript enquanto toca.

## Por onde começar

1. [Instale](./install).
2. Leia [Animando](./animating): o que é um alvo, quais propriedades se movem, e como os keyframes são escritos.
3. Escolha uma [transição](./transitions) ou um [preset](./presets).

Está em beta, publicado sob a tag `next`. Não depende de framework: recebe uma view, ou um elemento que contém uma.
