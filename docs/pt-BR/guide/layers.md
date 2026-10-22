# Movimento em camadas

Uma propriedade normalmente tem uma animação por vez: uma nova assume o lugar. Uma camada toca ao lado dela. Um tremor anda por cima de um arrasto, uma respiração continua enquanto o card se move, e um press escala um card que ainda está entrando:

```ts
animate(card, { x: 120 }, 'snappy') // a base
animate(card, 'shake', { layer: 'feedback' }) // por cima dela
```

<Clip name="layers-ios" caption="Uma camada de respiração continua enquanto o card se move e treme, e depois o card é arrastado, no simulador iOS. Velocidade real." />

## Como as camadas se combinam

Uma camada é nomeada pela opção `layer`. Os keyframes dela são o que ela acrescenta: translações e rotações **se somam** à base e às outras camadas, escala e opacidade **se multiplicam**. Um tremor é `x: [0, -10, 10, 0]` em volta de onde o card estiver, e um pulso é `scale: [1, 1.08, 1]` da escala que ele tiver. Os presets relativos, como `shake`, `pulse` e `heartbeat`, funcionam como camadas sem mudança.

```ts
animate(card, { y: -8 }, { duration: 200, layer: 'hover' }) // fica levantado
animate(
  card,
  { scale: [1, 1.08] },
  {
    duration: 700,
    repeat: Infinity,
    repeatType: 'reverse',
    layer: 'breathe',
  },
)
```

Camadas valem para `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` e `opacity`. Cores, cantos, bordas, sombras e paths continuam com um único dono. Uma camada aceita todas as transições do `animate()` e devolve a mesma animação, com `pause()`, `play()` e `progress`. Ela também funciona em sequências, escopos e estados.

## Substituindo e parando

Cada camada funciona como uma propriedade própria. Uma nova animação na mesma camada a substitui, começando do que a camada acrescenta naquele momento e com a velocidade dela. Uma nova animação sem camada substitui a base e deixa as camadas rodando. Com [redução de movimento](./configure#reducao-de-movimento), camadas de transformação pulam para o fim, e camadas de opacidade continuam tocando.

```ts
stop(card, ['x'], { layer: 'feedback' }) // essa camada para, e o que ela acrescenta some
stop(card, undefined, { layer: 'hover' }) // também depois de ela terminar
stop(card) // tudo para; o que está na tela vira o novo valor
```

Para tirar uma camada suavemente, anime-a de volta a nada: `animate(card, { scale: 1 }, { duration: 250, layer: 'breathe' })`.

Um arrasto mantém as camadas: enquanto você arrasta, um tremor ou um pulso na mesma view continua.

<Clip name="layers-android" caption="O card tremendo enquanto é arrastado, e a camada de respiração ligada e desligada, no emulador Android. Velocidade real." />

## Como toca

Enquanto uma propriedade tem camadas, o Jolt toca a base e as camadas como um único track nativo composto. Ele amostra a composição quando algo muda: uma animação começa, termina, pausa, é buscada ou parada, ou um arrasto move a base. Nada roda em JavaScript entre esses momentos. Camadas infinitas viram um loop nativo no mínimo múltiplo comum dos períodos delas, até 30 segundos; acima disso, a composição é amostrada de novo a cada poucos segundos. Quando a última camada some e não acrescenta nada, a propriedade volta a ser uma animação simples.
