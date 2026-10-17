# Decay

Dê uma velocidade à view e deixe ela desacelerar, como um card depois de um deslize:

<Clip name="decay" caption="Uma desaceleração livre e outra com encaixe." />

```ts
import { decay } from '@rafaelaugusto/jolt'

decay(card, { x: 600 })
decay(card, { x: -400, y: 200 }, { friction: 0.995 })
```

`x` e `y` são velocidades de translação em **DIPs por segundo**, partindo da posição atual. Eixos omitidos continuam fazendo o que já faziam. O alvo pode ser uma view, um template ref, um `ElementRef` ou um array desses alvos.

`friction` multiplica a velocidade a cada milissegundo. O padrão é `0.998`; valores menores param antes, valores mais próximos de `1` vão mais longe. Precisa ser finito e estar estritamente entre `0` e `1`. O movimento segue o tempo decorrido, então mudar a taxa de atualização da tela não muda o ponto de parada.

A curva inteira é calculada uma vez e tocada pelo Core Animation no iOS ou pelo `ObjectAnimator` no Android, sem JavaScript por frame. A implementação usa os drivers existentes; a validação nativa desta adição foi feita no iOS.

## Pontos de parada

```ts
decay(card, { x: 600 }, { snap: [0, 320] })

decay(
  card,
  { x: 600, y: -400 },
  {
    snap: { x: [0, 320], y: [-200, 0] },
  },
)
```

Com `snap`, o Jolt projeta onde o decay pararia, escolhe a posição mais próxima e vai **direto** até ela com o spring padrão, preservando a velocidade passada. Ele não espera o decay terminar para encaixar.

Um array usa os mesmos pontos em cada eixo informado. Um objeto define pontos independentes; eixos sem pontos desaceleram livremente. Os pontos podem estar fora de ordem, precisam ser finitos e cada lista deve conter pelo menos uma posição. Empates usam o primeiro ponto listado. São translações absolutas em DIPs, não deslocamentos relativos à posição inicial.

## Interrompendo e parando

```ts
const motion = decay(card, { x: 600 })
motion.stop() // deixa o card onde está

stop(card, ['x']) // também para o decay neste eixo

await sequence([
  () => decay(card, { x: 600 }, { snap: [0, 320] }),
  () => animate(card, { opacity: 0 }),
])
```

`decay()` retorna o mesmo `Animation` de `animate()`: espere com `await` ou leia `finished`. Resolve com `true` ao terminar e `false` se for parado ou substituído. O spring de encaixe pode avançar uma sequência quando chega visualmente, como os outros springs.

`decay()` e `animate()` compartilham o controle das propriedades. Cada um parte da posição atual do outro; um spring iniciado por `animate()` herda a velocidade atual do decay. Um novo `decay()` usa a velocidade passada para ele. Chamadas antes do carregamento esperam a view e leem a posição nesse momento; parar antes disso cancela a execução.

As velocidades precisam ser finitas. Entradas cuja projeção transborde ou cuja duração ultrapasse o limite dos timers da plataforma são rejeitadas antes de assumir uma animação. Decays livres muito longos limitam a quantidade de keyframes nativos a 6.001.

Esta API fornece o movimento depois de soltar. O acompanhamento do gesto, os limites e as colisões são separados.
