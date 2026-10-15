# Movimento ao longo de um caminho

```ts
animate(
  plane,
  { path: 'M0 0 C80 -120 200 -120 280 0', orient: true },
  { duration: 1200, ease: 'linear' },
)
```

`path` fornece coordenadas de translação em **DIPs**, relativas à posição de layout da view sem transformações. X positivo aponta para a direita; Y positivo, para baixo. O exemplo sobe em arco e termina 280 DIPs à direita. Ele não redimensiona nem reorganiza a view e não anima a posição nativa controlada pelo layout.

## Timing e orientação

O Jolt mede a distância ao longo da curva. Easing linear mantém uma distância aproximadamente constante por unidade de tempo; outro easing altera o progresso no percurso inteiro, sem reiniciar a cada amostra geométrica. O padrão é um tween de 300 ms com ease-out. Use `path` nas opções para temporizar o percurso separadamente das outras propriedades:

```ts
animate(
  plane,
  { path: route, orient: true, opacity: [0, 1] },
  {
    duration: 300,
    path: { duration: 1200, ease: 'easeInOut' },
  },
)
```

`orient: true` alinha uma imagem apontada para **+X** com a tangente de avanço, em graus. Os ângulos atravessam ±180° sem dar uma volta extra, permitindo uma rotação contínua em círculos. Sem orientação ou com `false`, a rotação atual fica intacta; também é possível animar `rotate` separadamente.

Springs controlam o mesmo progresso compartilhado de 0 a 1:

```ts
animate(plane, { path: route, orient: true }, 'bouncy')
```

O progresso fora de 0–1 fica limitado aos extremos do percurso, então um spring com overshoot pode segurar ali brevemente antes de voltar pelo caminho. Paths têm uma pose inicial explícita e não inferem velocidade de progresso da animação substituída. O `velocity` explícito de um spring usa unidades de progresso por segundo. Animações comuns que assumem uma propriedade herdam sua velocidade de coordenada no caminho.

Repetições, repetições reversas, delay, stagger e haptics usam a timeline existente. Reverter rebobina a orientação amostrada junto com as coordenadas; não acrescenta um giro de 180° para a imagem encarar o deslocamento de volta. Cantos e cúspides podem girar abruptamente, com interpolação entre amostras nativas vizinhas.

## Caminhos relativos

```ts
animate(
  plane,
  { path: 'M0 0 Q80 -120 160 0', orient: true },
  {
    duration: 1000,
    relative: true,
  },
)
```

`relative: true` soma a translação inicial da view ao percurso e a rotação inicial ao caminho orientado. A base é capturada uma vez quando o alvo carrega, usando o valor apresentado se outra animação possuir a propriedade. As coordenadas não são giradas por esse ângulo de base: a rotação inicial funciona como ajuste da orientação da imagem. Sem modo relativo, o primeiro `M` escolhe explicitamente a translação inicial.

## Reprodução, sequências e parada

O retorno é o [`PlaybackAnimation`](./playback) habitual. Pause, escolha o progresso, continue ou pare. Paths também funcionam em [`sequence()`](./sequences), [presets personalizados](./presets#custom-presets), [`scrollLinked()`](./scroll-linked) e `press()`.

```ts
const flight = animate(plane, { path: route, orient: true }, { duration: 2000 })
flight.pause()
flight.progress = 0.5
flight.play()

stop(plane, ['x', 'y', 'rotate']) // congela as tracks geradas
```

Um path possui `x` e `y`, e possui `rotate` quando orientado. Fornecer keyframes concorrentes ou timing separado para essas coordenadas na mesma chamada lança erro; use a transição compartilhada `path`. Outras propriedades continuam independentes. Parar ou substituir apenas uma coordenada deixa as outras seguindo suas tracks originais, então elas deixam de descrever o percurso completo juntas. Não existe uma propriedade virtual `path` para passar a `stop()`.

## Dados SVG e limites

O parser aceita um subcaminho contínuo com um único `M`/`m`, linhas (`L H V`), Béziers cúbicas e quadráticas (`C S Q T`), arcos elípticos (`A`) e fechamento (`Z`), nas formas absolutas ou relativas. Grupos de argumentos repetidos, números compactos, expoentes e flags de arco juntas são aceitos. A conversão dos arcos segue as [notas de implementação SVG](https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter). Passe dados de path, não um documento SVG, transformação ou URL.

Um caminho só com move ou comprimento zero segura seu ponto e usa ângulo zero. Vários comandos `M`, dados malformados, coordenadas conflitantes e valores não suportados lançam erro antes de assumir a view. Duração e delay precisam ser finitos; repetições podem ser infinitas.

A entrada fica limitada a 100.000 caracteres e 1.024 segmentos. Magnitudes numéricas e coordenadas geométricas precisam ficar dentro de ±1.000.000. A geometria usa subdivisão adaptativa com alvo de planicidade de 0,025 DIP e trabalho limitado (8.192 vértices / 18 subdivisões); geometrias que não atendem ao limite são rejeitadas. O timing nativo usa até 6.001 keyframes por coordenada, conforme comprimento e duração. Distância, orientação e interpolação nativa são aproximações, especialmente em percursos muito longos, loops minúsculos e cantos vivos.

## Reprodução nativa

O JavaScript interpreta e mede o percurso uma vez por chamada a `animate()`. As amostras de timing e coordenadas são criadas uma vez quando o primeiro alvo fica pronto e são compartilhadas pelas tracks geradas e pelos alvos do stagger. Keyframes nativos de translação e rotação tocam no iOS e Android; nenhum callback JS por frame move a view. Controles de reprodução e interrupção consultam o mesmo percurso. O [limite da UI thread no Android](./android-performance) continua valendo.

O playground inclui um voo em curva, uma órbita com arcos, controle de orientação, pausa/continuação e parada.
