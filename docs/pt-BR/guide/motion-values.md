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

## Offsets de rolagem

`scrollValue(scrollView)` é o offset de um ScrollView como um valor, em DIPs. Ligue-o como qualquer valor de movimento; cada evento de rolagem escreve as propriedades ligadas direto, sem animação no meio:

```ts
import { bind, scrollValue } from '@rafaelaugusto/jolt'

const offset = scrollValue(scroll)
bind(header, { y: offset.to([0, 90], [0, -64]) })
bind(title, { scale: offset.to([0, 90], [1, 0.72]), y: offset.to([0, 90], [0, 30]) })
bind(subtitle, { opacity: offset.to([0, 50], [1, 0]) })
bind(progress, { scaleX: offset.to([0, 700], [0, 1]) })
```

<Clip name="scroll-values-ios" caption="Rolar a lista recolhe o cabeçalho, encolhe o título, apaga o subtítulo e enche a barra de progresso, no simulador iOS. Velocidade real." />

`{ axis: 'x' }` segue o offset horizontal. O valor começa do offset atual, e `offset.ref(scrollView)` passa a seguir outro ScrollView, ou nenhum com `null`. `offset.dispose()` para de seguir e deixa as views ligadas onde estão. No Vue, `useScrollValue()` devolve um valor cujo `ref` vai no template ref do ScrollView, e para junto com o componente:

```vue
<script setup lang="ts">
const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
</script>

<template>
  <ScrollView :ref="offset.ref">...</ScrollView>
  <GridLayout :ref="header" />
</template>
```

Os eventos de rolagem chegam no JavaScript, como no [`scrollLinked()`](./scroll-linked). Com cinco propriedades ligadas, um evento custa cerca de 0,25 a 0,3 ms no simulador iOS e no emulador Android, cerca de metade da configuração equivalente com `scrollLinked()` no Android; veja as [medições](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-values.md).

<Clip name="scroll-values-android" caption="O mesmo cabeçalho seguindo a lista no emulador Android. Velocidade real." />

## Arrastando

`drag(view, { axis, value })` escreve a posição do dedo num valor em vez de mover a view, e depois toca a soltura no valor. Tudo o que está ligado a ele segue o dedo e o arremesso junto. O gesto é lido na view que você passa; ligue essa view também se ela deve se mover:

```ts
import { bind, drag, motionValue } from '@rafaelaugusto/jolt'

const closed = 380
const y = motionValue(closed)
bind(sheet, { y })
bind(page, { scale: y.to([0, closed], [0.9, 1]) })
bind(backdrop, { opacity: y.to([0, closed], [0.5, 0]) })
bind(hint, { opacity: y.to([closed / 2, closed], [0, 1]) })

drag(sheet, {
  axis: 'y',
  value: y,
  bounds: { top: 0, bottom: closed },
  snap: [0, closed / 2, closed],
  rubberband: true,
})
```

<Clip name="drag-values-ios" caption="Um sheet arrastável controla um valor de movimento que escala a página, escurece o fundo e apaga a dica, com pontos de encaixe, rubberband e o mesmo valor animado por um botão, no simulador iOS. Velocidade real." />

`axis` é `'x'` ou `'y'`. Limites, pontos de encaixe e o eixo arrastado nos eventos ficam nas unidades do valor; o outro eixo vem 0. O resto funciona como no [`drag()`](./drag): rubberband, atrito, callbacks e o controller. A soltura é a mesma curva, calculada uma vez e tocada nativamente por cada propriedade ligada, sem nada no JavaScript até terminar. O `onRelease` recebe uma [`Animation`](./api#animacoes) em vez de uma `PlaybackAnimation`. Tocar na view durante a soltura, ou durante um `animate(value, ...)`, para o valor onde ele está, e o gesto continua dali.

Cada evento de pan escreve as propriedades ligadas direto. Com seis propriedades ligadas, um evento custa mais ou menos o mesmo que escrevê-las à mão no `onMove`: cerca de 0,8 ms no simulador iOS e de 0,25 a 0,35 ms no emulador Android; veja as [medições](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/drag-values.md). No Vue, comece o arrasto a partir do `useMotionScope()` no `onMounted`, como faz a tela **Drag values** do demo.

<Clip name="drag-values-android" caption="O mesmo sheet no emulador Android, com arremessos reais nas duas direções e uma pegada enquanto a animação do botão ainda roda. Velocidade real." />

## O que vem depois

Os valores se combinam com [camadas](./layers) na mesma propriedade. O cálculo nativo, onde as medições pedirem, está planejado no [RFC de valores de movimento](https://github.com/rafaelaugustos/jolt/issues/152).
