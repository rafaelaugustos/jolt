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

Enquanto uma propriedade tem camadas, o Jolt toca a base e as camadas como um único track nativo composto. Ele amostra a composição quando algo muda: uma animação começa, termina, pausa, é buscada ou parada, ou um arrasto move a base. Nada roda em JavaScript entre esses momentos. Camadas infinitas viram um loop nativo no mínimo múltiplo comum dos períodos delas, até 30 segundos; acima disso, um compositor nativo toca as camadas nos próprios relógios sem reconstruir nada. Um app compilado sem as classes nativas do Jolt volta a amostrar a composição a cada poucos segundos. Quando a última camada some e não acrescenta nada, a propriedade volta a ser uma animação simples.

## Motion values

[`animate(value, target, { layer })`](./motion-values#camadas-em-um-valor) soma contribuições escalares antes dos mapeamentos derivados. Camadas de valores usam zero como neutro, inclusive ao mapear para escala ou opacidade. Veja o guia de motion values para parada, arraste e composição nativa.

**Corrigido na 0.1.0-rc.2:** [press em uma camada exclusiva](./press#layered-press) devolve apenas sua contribuição ao valor neutro. O playback das camadas também compensa o tempo de criação dos keyframes nativos, mantendo a nova composição alinhada ao relógio de origem.

<Clip name="motion-rfc-ios" caption="Simulador iOS 26.0, demo Layers em inglês com a auditoria opcional da RFC: toque real mantido, remoção da shake durante a entrada, soltura preservando a base e duas camadas infinitas sem período comum compostas nativamente através do antigo limite da janela de quatro segundos. Reprodução nativa na velocidade original; sem medição em aparelho físico." />
<Clip name="motion-rfc-android" caption="Emulador Android 16 / API 36, demo Layers em inglês com a auditoria opcional da RFC: toques reais via ADB exercitam press, camadas independentes e troca de janela. Velocidade original; evidência de correção no emulador." />
