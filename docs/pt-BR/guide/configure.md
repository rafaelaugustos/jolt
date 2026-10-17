# Escala de tempo

Ajustar uma spring em velocidade normal é chute. Desacelere tudo:

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // tudo cinco vezes mais lento
configure({ timeScale: 1 }) // de volta ao normal
```

`configure()` altera configurações globais. Cada uma vale para as animações que começam depois da chamada; o que já está tocando mantém seu tempo. Valores inválidos lançam erro antes de qualquer mudança: a escala de tempo precisa ser um número finito e positivo.

## O que ela afeta

A escala estica a linha do tempo inteira de cada animação do motor: durações, delays, stagger, repetições, tempo de acomodação das springs, desaceleração e posições de sequências. `animate()`, `decay()`, `sequence()`, `press()`, `scrollLinked()` e `animateText()` seguem a escala, no iOS e no Android igualmente, porque o Jolt calcula a curva em JavaScript e entrega a duração à plataforma.

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: o delay e o movimento dobraram
```

A trajetória continua a mesma, só mais lenta. Os keyframes são amostrados por segundo de reprodução, então uma spring desacelerada mantém o detalhe perto do overshoot. Uma animação que interrompe outra desacelerada continua partindo do valor na tela, com a velocidade na tela. `progress` segue indo de 0 a 1; `duration` informa os milissegundos esticados.

Animações ligadas ao scroll definem o progresso a partir do deslocamento, então sua aparência não muda. Os pontos de feedback tátil são frações da linha do tempo e se movem com ela.

## O que ela não afeta

Os loops nativos mantêm o próprio tempo: [shimmer](./shimmer), [indicadores de carregamento](./loaders), [imagens com movimento líquido](./liquid), [partículas](./particles), [efeitos de SF Symbols](./symbol-effects) e [revelação circular](./reveal). Animações da plataforma fora do Jolt também não mudam.

A opção Slow Animations do simulador iOS só desacelera o Core Animation, e o Android não tem equivalente por app. A escala de tempo é a mesma nas duas plataformas e funciona em dispositivos, o que a torna útil para compará-las.
