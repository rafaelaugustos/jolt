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

Tweens duram 300ms com `easeOut` a menos que se diga o contrário. `ease` aceita `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`, `anticipate`, um cubic bezier (`[0.2, 0, 0, 1]`) ou qualquer função de 0..1 para um valor. Com keyframes, passe um por trecho. `times` posiciona cada keyframe entre 0 e 1.

Com `easeTrack: true`, um único `ease` vale para o track inteiro, e o valor anda em linha reta entre os keyframes, do jeito que o `interpolate` do React Native posiciona o `outputRange` sobre um valor com easing:

```ts
animate(
  spark,
  { y: [0, -30, -12, 0] },
  { duration: 900, ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] },
)
```

Um easing que passa do ponto, como `backOut`, estende o primeiro ou o último trecho, como o `interpolate` faz com `extrapolate: 'extend'`. `easeTrack` recebe um único `ease` e vale só para tweens.

Funções de easing customizadas rodam uma vez, quando a animação começa, como os springs. Não custam nada por frame.

## Por propriedade

```ts
animate(
  card,
  { y: 0, opacity: 1 },
  { type: 'spring', bounce: 0.3, opacity: { duration: 150 } },
)
```

A transição de uma propriedade substitui a curva, e mantém o tempo (`delay`, `repeat`) da principal a menos que defina o próprio.

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

A espera faz parte dos keyframes nativos, então não custa JavaScript enquanto toca. Parar durante a espera deixa a view no valor segurado.
