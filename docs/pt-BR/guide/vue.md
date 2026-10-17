# Vue

```ts
import Jolt from '@rafaelaugusto/jolt/vue'

createApp(App).use(Jolt).start()
```

<Clip name="vue" caption="JoltTransition removendo e restaurando uma linha, v-animate trocando a entrada." />

O núcleo recebe uma view ou um elemento que contém uma, então `animate(card.value, 'popIn')` já funciona a partir de um template ref. `@rafaelaugusto/jolt/vue` acrescenta o lado do template: `v-animate`, `v-press` e um componente `<JoltTransition>` para views que aparecem e somem. Precisa do NativeScript-Vue 3 e só é carregado pelos apps que o importam.

## Registro

`app.use(Jolt)` registra as duas diretivas e o componente para todos os templates. Um componente também pode importar só o que usa. Em `<script setup>`, importar `vAnimate` e `vPress` com esses nomes deixa `v-animate` e `v-press` disponíveis naquele template:

```vue
<script setup lang="ts">
import { JoltTransition, vAnimate, vPress } from '@rafaelaugusto/jolt/vue'
</script>
```

## v-animate

```vue
<Label v-animate="'fadeInUp'" />
<Label v-animate="{ opacity: [0, 1], y: [24, 0] }" />
<Label v-animate="['popIn', { delay: 200 }]" />
<Label v-animate="[entrance, 'bouncy']" />
```

O valor é o que [`animate()`](./animating) recebe: o nome de um preset ou keyframes, sozinhos ou em par com uma transição ou o nome de um spring. A animação toca quando o elemento é montado. A montagem acontece antes de a view estar na tela, então a view assume o primeiro keyframe na hora e toca quando carrega; nada pisca.

Quando o valor muda, o elemento anima de novo, pegando o valor e a velocidade na tela como em qualquer [interrupção](./interrupting). Os valores são comparados pelo conteúdo, então um objeto escrito no template não reinicia a animação a cada render. Desmontar o elemento para a animação.

## v-press

```vue
<GridLayout v-press />
<GridLayout v-press="{ scale: 0.95, opacity: 0.8 }" />
<GridLayout v-press="[{ scale: 0.9, rotate: -4 }, 'bouncy']" />
```

O mesmo que [`press()`](./press): a view anima até os valores pressionados enquanto um dedo está sobre ela, e volta quando ele levanta ou um scroll assume. Sem valor, escala para 0.96. Um valor diferente substitui o efeito; desmontar o elemento remove o efeito.

## JoltTransition

```vue
<JoltTransition enter="popIn" leave="fadeOut">
  <Label v-if="saved" text="Salvo" />
</JoltTransition>

<JoltTransition :enter="['fadeInUp', { delay: 100 }]" leave="fadeOutDown" mode="out-in">
  <component :is="screen" />
</JoltTransition>
```

`JoltTransition` envolve o `BaseTransition` do Vue, então segue as regras do `<Transition>`: um único filho, alternado com `v-if` ou `v-show`, ou substituído por uma `key` ou um componente que muda. `enter` toca quando o filho é inserido e `leave` toca antes de ele ser removido. O Vue mantém o elemento até a animação de saída terminar, e é isso que torna as saídas possíveis: sem o componente, `v-if` remove a view antes de qualquer coisa tocar.

| Prop     | Significado                                                                |
| -------- | -------------------------------------------------------------------------- |
| `enter`  | Preset, keyframes ou um par com uma transição. Omita para inserir na hora. |
| `leave`  | As mesmas formas. Omita para remover na hora.                              |
| `appear` | Toca `enter` também no primeiro render.                                    |
| `mode`   | `out-in` espera a saída antes de inserir, `in-out` faz o contrário.        |

As interrupções seguem o motor. Mostrar um filho enquanto sua saída ainda toca cancela a saída, e a entrada começa de onde a view está. Uma entrada cancelada ainda libera o Vue, então nada fica travado pela metade. Sair de uma página cancela o que estiver tocando nela.

## Transições de página

Navegar entre páginas é outro trabalho: o frame é dono dessa navegação. O [vue-router-ns](https://github.com/rafaelaugustos/vue-router-ns) combina com o Jolt para isso, e o `JoltTransition` cuida das views dentro de uma página.
