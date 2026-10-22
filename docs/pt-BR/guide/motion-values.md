# Valores de movimento

Um valor de movimento é um número que anima nativamente e controla toda propriedade de view ligada a ele. Um único valor pode mover um sheet, escurecer o fundo e encolher a página por trás, tudo no mesmo relógio nativo:

```ts
import { animate, bind, motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
bind(page, { scale: progress.to([0, 1], [1, 0.92]) })
bind(backdrop, { opacity: progress.to([0, 1], [0, 0.45]) })
bind(sheet, { y: progress.to([0, 1], [200, 0]) })

animate(progress, 1, 'snappy')
```

<Clip name="motion-values-ios" caption="Um valor de movimento abre e fecha um sheet, escurece o fundo e encolhe a página, no simulador iOS. Velocidade real." />

## Mapeando

`to(input, output)` mapeia um valor por faixas de entrada e de saída, como o `interpolate` do React Native: em trechos lineares, segurando a primeira e a última saída fora da faixa de entrada. Passe `{ clamp: false }` para estender o primeiro e o último trecho, e assim o passo além do ponto de uma mola chega até a view. As entradas não podem diminuir, e há uma saída por entrada.

```ts
const y = progress.to([0, 0.4, 1], [600, 120, 0])
const tint = progress.to([0, 1], ['#18181B', '#FACC15']) // cores se misturam em OKLab
const bounce = progress.to([0, 1], [0, 300], { clamp: false })
```

Um número mapeado pode ser mapeado de novo. Saídas de cor se ligam a `backgroundColor`, `borderColor` e `color`; saídas numéricas se ligam a todo o resto que o `animate()` aceita, e `scale` define os dois eixos. Um valor também pode ser ligado direto: `bind(dot, { x: offset })`.

## Animando e aplicando

`animate(value, to, transition)` recebe um número ou keyframes e as mesmas transições do `animate()`: tweens, molas, `repeat`, `repeatType`, `repeatDelay`, `delay` e `easeTrack`. Devolve uma [`Animation`](./api#animacoes). O Jolt amostra a curva do valor uma vez, mapeia por cada ligação e toca um track nativo por propriedade ligada, todos começando juntos. Nada roda em JavaScript enquanto eles tocam.

```ts
animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.6], { duration: 700, times: [0, 0.5, 1] })
animate(pulse, 1, { duration: 900, repeat: Infinity, repeatType: 'reverse' })
```

Uma animação que interrompe outra começa do valor na tela, com a velocidade dele, então todas as views ligadas viram juntas. `set(value, número)` aplica um valor a todas as views ligadas na hora. `stop(value)` segura o valor e as views onde estão. `value.get()` lê o valor agora, inclusive durante a animação.

Com [redução de movimento](./configure#reducao-de-movimento), transformações ligadas pulam para o fim enquanto opacidade e cores continuam animando. A [escala de tempo](./configure#escala-de-tempo) vale uma vez, na curva do valor.

## Ligando

`bind(views, bindings)` dá às views o estado atual dos valores na hora e as mantém acompanhando. Devolve uma função de limpeza: depois dela, as views ficam onde estão. `motionScope().use(() => bind(...))` prende uma ligação a um escopo.

Um valor dura mais que as views. Uma view que ainda não carregou recebe o valor quando carregar, e entra numa animação em andamento no ponto em que ela está. Um `animate()` ou `set()` comum numa propriedade ligada assume essa propriedade no valor e na velocidade atuais; o valor continua controlando as outras ligações. `stop(view)` para o movimento na tela, mas mantém a ligação.

## Vue

`useMotionValue()` cria um valor que para quando o componente desmonta. `useBinding()` devolve um template ref que liga ao montar e solta ao desmontar, então um elemento recriado por `v-if` pega o valor de novo:

```vue
<script setup lang="ts">
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const toggle = (open: boolean) => animate(progress, open ? 1 : 0, 'snappy')
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

<Clip name="motion-values-android" caption="O mesmo sheet no emulador Android, incluindo um toque no meio do caminho que faz as três views virarem juntas. Velocidade real." />

## O que vem depois

Aqui os valores são movidos por linhas do tempo, e se combinam com [camadas](./layers) na mesma propriedade. Valores que seguem o dedo ou a rolagem a partir do código nativo estão planejados no [RFC de valores de movimento](https://github.com/rafaelaugustos/jolt/issues/152).
