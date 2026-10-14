# Animando

`animate(target, keyframes, transition?)` recebe uma view e para onde levá-la:

```ts
animate(card, { opacity: 0.5, y: -20 })
```

## Propriedades

| Propriedade          | Unidade                                      |
| -------------------- | -------------------------------------------- |
| `opacity`            |                                              |
| `x`, `y`             | DIPs, o mesmo que `translateX`, `translateY` |
| `scale`              | define `scaleX` e `scaleY` juntos            |
| `scaleX`, `scaleY`   |                                              |
| `rotate`             | graus                                        |
| `rotateX`, `rotateY` | graus, com perspectiva                       |

Só transforms e opacidade por enquanto. Cores, tamanho e mudanças de layout [ainda não existem](./not-there-yet).

## Keyframes

Um valor único anima de onde a view estiver. Um array é uma lista de keyframes, e `null` representa o valor atual:

```ts
animate(card, { x: [0, 100] }) // a partir de 0, seja qual for o x agora
animate(card, { x: [null, 20, -20, null] }) // sai e volta para onde estava
```

## Alvos

O alvo pode ser uma view, ou qualquer coisa que contenha uma: um template ref do NativeScript-Vue, um `ElementRef` do Angular.

```vue
<script setup lang="ts">
const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

Uma view que ainda não carregou assume o primeiro keyframe na hora e toca quando aparece na tela. Chamar `animate(title, 'fadeInUp')` no `onMounted` não pisca o título antes do fade.

## O que você recebe de volta

O `animate()` retorna uma animação que você pode esperar com `await`. Ela resolve com `true` quando tocou até o fim, e `false` quando foi parada ou substituída. Nunca rejeita. Veja [Interrompendo e parando](./interrupting).
