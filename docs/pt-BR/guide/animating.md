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

Cores de fundo, borda e texto também são suportadas. Veja [Cores](./colors). Veja [cantos, bordas e sombras](./decorations) para propriedades numéricas de decoração. Tamanho e mudanças de layout [ainda não existem](./not-there-yet).

## Fades no Android

Nas animações de opacidade, o Jolt usa temporariamente uma camada de hardware para containers com filhos quando a aceleração está ativa. A camada começa depois do atraso, permanece nas repetições e é restaurada ao terminar, parar, substituir a animação ou descarregar a view. Isso pode reduzir o trabalho de desenho em conteúdo estático, como cards com imagens.

Camadas de hardware ou software já configuradas pelo app são preservadas. Containers vazios, views sem tamanho medido e containers mais largos ou altos que a tela não recebem essa otimização. O limite evita colocar árvores de conteúdo muito grandes numa textura. As texturas usam memória gráfica; conteúdo que muda constantemente continua invalidando o cache. Veja o [benchmark de fades no Android](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-fade.md).

## Perspectiva 3D

`rotateX`, `rotateY`, `flipInX` e `flipInY` usam a `perspective` da view nas duas plataformas. O padrão do NativeScript é 1000 DIPs; uma distância positiva menor dá uma perspectiva mais forte:

```ts
card.perspective = 600
animate(card, { rotateY: [-60, 0] })
```

O Android converte essa distância pela densidade da tela antes de iniciar o animator nativo. A perspectiva continua aplicada quando uma rotação termina ou é parada num ângulo.

## Keyframes

Um valor único anima de onde a view estiver. Um array é uma lista de keyframes, e `null` representa o valor atual:

```ts
animate(card, { x: [0, 100] }) // a partir de 0, seja qual for o x agora
animate(card, { x: [null, 20, -20, null] }) // sai e volta para onde estava
```

## Keyframes relativos

Use `relative: true` para partir dos valores atuais:

```ts
animate(card, { x: [0, -10, 10, 0] }, { relative: true })
animate(card, { scale: [1, 1.06, 1] }, { relative: true })
animate(card, { y: 20 }, { relative: true }) // move 20 DIPs a partir do y atual
```

Translação e rotação usam deslocamentos. Escala e opacidade usam multiplicadores: uma escala de `1.06` aumenta cada eixo em 6%, preservando a diferença entre `scaleX` e `scaleY`. O valor `0` representa a posição inicial num deslocamento; `1` representa o valor inicial num multiplicador. `null` sempre mantém o valor atual.

O Jolt captura a base uma vez, quando cria as curvas da view carregada, antes de qualquer delay ou stagger. As repetições reutilizam os keyframes calculados. Se outra animação estiver controlando a propriedade, a base vem da posição atual na tela. Uma etapa relativa numa sequência calcula seus valores quando chega a vez de tocar; ela não altera nem para o alvo enquanto uma etapa anterior estiver rodando.

Também funciona em presets personalizados: coloque `relative: true` na `transition` do preset. Uma chamada pode substituir essa opção com `relative: false`.

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

Uma view que ainda não carregou assume o primeiro keyframe absoluto na hora e toca quando aparece na tela. Chamar `animate(title, 'fadeInUp')` no `onMounted` não pisca o título antes do fade. Animações relativas preservam os valores da view até ela carregar e só então calculam os keyframes a partir desses valores.

## O que você recebe de volta

O `animate()` retorna uma animação que você pode esperar com `await`. Ela resolve com `true` quando tocou até o fim, e `false` quando foi parada ou substituída. Nunca rejeita. Veja [Interrompendo e parando](./interrupting).
