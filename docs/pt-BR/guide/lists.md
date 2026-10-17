# Linhas de lista

Toque uma entrada em cada linha de uma `ListView` conforme ela aparece no scroll:

```ts
import { animateItems } from '@rafaelaugusto/jolt'

const unlink = animateItems(listView, 'fadeInUp')
```

Toda linha que a lista entrega toca a animação, com os mesmos keyframes, presets e transições de [`animate()`](./animating). Uma linha que ainda não está na tela recebe o primeiro keyframe na hora e toca quando a lista faz o layout dela, então nada aparece com opacidade cheia antes.

```ts
animateItems(listView, { opacity: [0, 1], x: [-16, 0] }, { duration: 250 })
animateItems(listView, 'popIn', 'bouncy')
```

Cada linha anima sozinha quando aparece, então `stagger` não tem o que espaçar e é rejeitado.

## Linhas recicladas

Listas reutilizam um punhado de views de linha enquanto você rola. Quando uma linha é reaproveitada para outro item, o Jolt para o que ela ainda estava tocando e recomeça a entrada do primeiro keyframe. As outras animações da linha, iniciadas pelo seu código, ficam como estão.

Com `once`, cada item de dados anima só na primeira vez em que aparece. Uma linha reaproveitada para um item que já foi mostrado assenta nos valores finais:

```ts
animateItems(listView, 'fadeInUp', { once: true })
```

Os itens são acompanhados por identidade: um objeto conta como o mesmo item enquanto você mantém a mesma referência, e um item primitivo é lembrado pelo índice. Trocar os itens por objetos novos anima tudo de novo.

## Quais listas

O alvo é a `ListView` do core, ou qualquer coisa que notifique `itemLoading` com o `index` e a `view` da linha e liste as linhas realizadas por `eachChildView`, que é o contrato da CollectionView da comunidade também. Listas com seções informam a seção junto com o índice. Alvos embrulhados, como um template ref do NativeScript-Vue, funcionam do mesmo jeito que em `animate()`.

## Limpeza

O retorno é uma função de limpeza idempotente:

```ts
unlink() // para de escutar e assenta cada linha nos valores finais
```

Descarregar a lista também remove o efeito, então uma página em cache precisa de uma nova chamada quando volta. As linhas param nos valores que estão mostrando e vão para os valores finais que a animação alcançaria, para nenhuma linha ficar meio apagada. Valores finais que dependem da view, como keyframes `null`, animações relativas e caminhos, ficam onde pararam.
