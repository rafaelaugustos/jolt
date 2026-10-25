# Springs e tweens

O terceiro argumento do `animate()` diz como chegar lá. Sem ele, transforms se movem com um spring e `opacity` faz ease em 300ms. Keyframes fazem tween.

<Clip name="springs" caption="As três springs nomeadas numa bola que pode ser interrompida." />

## Springs

```ts
animate(card, { scale: 1.2 }, 'bouncy')
animate(card, { y: 0 }, { bounce: 0.3, duration: 600 })
animate(card, { y: 0 }, { stiffness: 300, damping: 20, mass: 1 })
```

| Spring   | Sensação                              |
| -------- | ------------------------------------- |
| `smooth` | sem overshoot                         |
| `snappy` | rápido, mal passa do alvo. O padrão   |
| `bouncy` | passa do alvo e assenta com um quique |

`bounce` vai de -1 a 1: 0 assenta sem passar do alvo, valores maiores quicam mais, valores negativos assentam mais devagar. `duration` é quanto tempo o spring parece durar, o mesmo modelo do SwiftUI. Ou descreva com `stiffness`, `damping` e `mass`. Um spring começa com a velocidade da animação que interrompe, a menos que você passe `velocity` (unidades por segundo).

## Tweens

```ts
animate(card, { opacity: 0 }, { duration: 200, ease: 'easeIn' })
animate(
  card,
  { x: [0, 100, 50] },
  { duration: 600, ease: ['easeOut', 'easeIn'], times: [0, 0.3, 1] },
)
```

**Um tween dura 300 ms com `easeOut` a menos que se diga o contrário.** É mais curto que o `Animated.timing` do React Native (500 ms, com ease na entrada e na saída) e arranca mais rápido que o `ease` do CSS, então passe os dois quando um port precisar ficar igual.

`ease` aceita `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, as curvas `quad`, `cubic`, `quart`, `quint`, `sine` e `expo` com `In`, `Out` ou `InOut` (`'cubicOut'`), um cubic bezier (`[0.2, 0, 0, 1]`) ou qualquer função de 0..1 para um valor. Com keyframes, passe um por trecho. `times` posiciona cada keyframe entre 0 e 1.

<Clip name="easing-curves-ios" caption="Seis curvas nomeadas em 900 ms, e um logo cuja opacidade define só times e mantém a duração e o easing principais, no simulador iOS. Velocidade real." />

Com `easeTrack: true`, um único `ease` vale para o track inteiro, e o valor anda em linha reta entre os keyframes, do jeito que o `interpolate` do React Native posiciona o `outputRange` sobre um valor com easing:

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

<Clip name="ease-track-ios" caption="No simulador iOS, os mesmos keyframes e times com easeOut em cada trecho (esquerda) e sobre o track inteiro (direita). Velocidade real." />

Um easing que passa do ponto, como `backOut`, estende o primeiro ou o último trecho, como o `interpolate` faz com `extrapolate: 'extend'`. `easeTrack` recebe um único `ease` e vale só para tweens.

Funções de easing customizadas rodam uma vez, quando a animação começa, como os springs. Não custam nada por frame.

## Keyframes adaptativos

Curvas numéricas concentram keyframes nativos onde precisam de detalhe, em vez de usar 60 amostras por segundo em todos os trechos. Um easing suave de quatro segundos pode usar 41 pontos em vez de 241; uma spring rápida de 300 DIP precisa de mais pontos, reduzindo o erro medido de interpolação de aproximadamente 6,79 para 0,24 DIP. São comparações numéricas, não medições de FPS. Velocidade original, duração de estabilização e chegada usada pelas sequências permanecem iguais.

<Clip name="curve-sampling-ios" caption="Simulador iOS com toques reais do XCTest: os pontos adaptativos e os de taxa fixa são reproduzidos pelo driver nativo. A comparação da spring rápida está quatro vezes mais lenta; a curva longa mantém a velocidade original. Os números mostram erro amostrado em DIP, não FPS medidos." />

<Clip name="curve-sampling-android" caption="Emulador Android com toques reais via ADB: a mesma comparação nativa, com a spring a um quarto da velocidade e a curva longa em velocidade original. Quantidade de pontos e erros numéricos descrevem as curvas preparadas. Não é uma medição da taxa de atualização em aparelho físico." />

O orçamento de erro é **0,25 DIP** para translação, **0,001** para escala, **0,002** para opacidade e opacidade de sombra, **0,1°** para rotação e **0,1 DIP** para as demais decorações numéricas. Multiplique o erro em DIP pela densidade da tela para obter pixels físicos: 0,25 DIP equivale a 0,75 pixels em 3×. Os efeitos de rotação e escala em pixels dependem da geometria. Trechos lineares mantêm extremos exatos; tempos dos tweens e pontos de mudança sob easing global são preservados.

Springs e decays exponenciais livres usam limites analíticos de curvatura, incluindo o ajuste final ao alvo. As outras curvas usam três verificações internas com margem. Callbacks desconhecidos de easing mantêm também uma grade inicial de 120 Hz. **Uma função arbitrária não tem garantia matemática com amostragem finita:** um pico estreito ou cruzamento extra pode passar despercebido. Mistura de cores, mapeamentos derivados e springs nativos retidos têm caminhos próprios.

Os intervalos têm no máximo 100 ms de playback. Cada segmento amostrado limita o refinamento a 6.000 intervalos, 24.000 avaliações e profundidade 24. Se o orçamento não puder ser atendido, o Jolt usa a representação uniforme anterior com limite e não promete a precisão solicitada. Pontos obrigatórios, segmentos definidos pelo app, cores e repetições expandidas podem acrescentar pontos além desse limite por segmento. Curvas difíceis podem aumentar o custo de preparação e memória. O ganho está na precisão onde necessária e em menos dados nativos para curvas suaves; não é uma redução universal de CPU.

O experimento **58 — Precisão das curvas** traz a comparação e os probes nativos. Eles verificam posições nativas em instantes lógicos de 60/120 Hz; o seek no Android usa milissegundos inteiros, registrados separadamente do tempo solicitado. Isso não certifica renderização física a 120 Hz. Veja [medições, limites e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/curve-sampling.md).

## Por propriedade

```ts
animate(
  logo,
  { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
  { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
)
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

Sobre um tween, a transição de uma propriedade muda só o que ela define: a opacidade do logo mantém os 900 ms com `easeInOut` e só posiciona seus keyframes. Sobre um spring, ou quando ela mesma é um spring, ela substitui a curva, então a opacidade do card ganha um tween de 150 ms. Nos dois casos, ela mantém o tempo (`delay`, `repeat`) da principal a menos que defina o próprio. `times` e easings por trecho herdados da transição principal ficam de fora quando não batem com os keyframes da propriedade. Opções passadas para um [preset](./presets) se combinam do mesmo jeito, então `animate(card, 'heartbeat', { duration: 1600 })` mantém o ritmo da batida.

<Clip name="easing-curves-android" caption="As mesmas curvas e o mesmo logo no emulador Android. Velocidade real." />

## Tempo

```ts
animate(
  badge,
  { scale: [1, 1.2] },
  { delay: 300, repeat: Infinity, repeatType: 'reverse' },
)
```

`delay` é em milissegundos, e a view assume o primeiro keyframe durante ele. `repeat` é quantas vezes a mais tocar, `Infinity` até ser parada. `repeatType: 'reverse'` toca cada repetição alternada de trás para frente. As repetições também tocam nativamente.

`repeatDelay` segura o valor final por essa quantidade de milissegundos antes de cada repetição. A primeira vez não espera, nem o fim da última. Com `'reverse'` a espera acontece nas duas pontas:

```ts
animate(
  z,
  { y: [0, -40], opacity: [0, 1] },
  { duration: 1200, repeat: Infinity, repeatDelay: 1800 },
)
```

<Clip name="repeat-delay-ios" caption="No simulador iOS, cada z descansa 900 ms entre as subidas e a bola espera 700 ms nas duas pontas de um loop reverso. Velocidade real." />

A espera faz parte dos keyframes nativos, então não custa JavaScript enquanto toca. Parar durante a espera deixa a view no valor segurado.

Um intervalo, `repeatDelay: [min, max]`, sorteia uma nova espera antes de cada repetição, para que um loop ocioso como uma piscada não caia sempre no mesmo ritmo:

```ts
animate(
  eyes,
  { scaleY: [1, 0.1, 1] },
  { duration: 160, repeat: Infinity, repeatDelay: [1000, 4000] },
)
```

<Clip name="random-pauses-ios" caption="No simulador iOS, o mascote da esquerda pisca e olha para o lado depois da mesma pausa toda vez, e o da direita depois de pausas sorteadas entre 1 e 4 segundos. Velocidade real." />

As esperas são sorteadas quando a animação começa e entram nos keyframes nativos. Um `repeat` finito sorteia uma por repetição. Um loop infinito sorteia dezesseis ciclos e os repete nativamente, então o padrão só se repete depois desses dezesseis, sem JavaScript entre as repetições. Todas as propriedades e views de uma mesma chamada de `animate()` compartilham as mesmas esperas, então `scaleX` e `scaleY`, ou os dois olhos, ficam juntos. Chamadas separadas sorteiam as suas.

<Clip name="random-pauses-android" caption="Os mesmos dois mascotes no emulador Android. Velocidade real." />
