# Escala de tempo e redução de movimento

`configure()` altera configurações globais. Cada uma vale para as animações que começam depois da chamada; o que já está tocando mantém seu tempo. Valores inválidos lançam erro antes de qualquer mudança.

<Clip name="tuning" caption="O playground a um quinto da velocidade." />

```ts
import { configure } from '@rafaelaugusto/jolt'

configure({ timeScale: 0.2 }) // tudo cinco vezes mais lento
configure({ reducedMotion: 'always' }) // transformações pulam, a opacidade ainda faz fade
```

## Escala de tempo

Ajustar uma spring em velocidade normal é chute. Desacelere tudo:

```ts
configure({ timeScale: 0.2 })
configure({ timeScale: 1 }) // de volta ao normal
```

A escala de tempo precisa ser um número finito e positivo. Ela estica a linha do tempo inteira de cada animação do motor: durações, delays, stagger, repetições, tempo de acomodação das springs, desaceleração e posições de sequências. `animate()`, `decay()`, `sequence()`, `press()`, `scrollLinked()` e `animateText()` seguem a escala, no iOS e no Android igualmente, porque o Jolt calcula a curva em JavaScript e entrega a duração à plataforma.

```ts
configure({ timeScale: 0.5 })
const animation = animate(card, { x: 100 }, { duration: 300, delay: 100 })
animation.duration // 800: o delay e o movimento dobraram
```

A trajetória continua a mesma, só mais lenta. Os keyframes são amostrados por segundo de reprodução, então uma spring desacelerada mantém o detalhe perto do overshoot. Uma animação que interrompe outra desacelerada continua partindo do valor na tela, com a velocidade na tela. `progress` segue indo de 0 a 1; `duration` informa os milissegundos esticados.

Animações ligadas ao scroll definem o progresso a partir do deslocamento, então sua aparência não muda. Os pontos de feedback tátil são frações da linha do tempo e se movem com ela.

Os loops nativos mantêm o próprio tempo: [shimmer](./shimmer), [indicadores de carregamento](./loaders), [imagens com movimento líquido](./liquid), [partículas](./particles), [efeitos de SF Symbols](./symbol-effects) e [revelação circular](./reveal). Animações da plataforma fora do Jolt também não mudam.

A opção Slow Animations do simulador iOS só desacelera o Core Animation, e o Android não tem equivalente por app. A escala de tempo é a mesma nas duas plataformas e funciona em dispositivos, o que a torna útil para compará-las.

## Redução de movimento

O iOS tem Reduzir Movimento e o Android tem Remover animações. O Jolt segue essas opções por padrão:

```ts
configure({ reducedMotion: 'user' }) // o padrão: segue a configuração da plataforma
configure({ reducedMotion: 'always' }) // reduz sempre, para conferir o resultado
configure({ reducedMotion: 'never' }) // toca tudo
```

Com movimento reduzido, translação, escala, rotação, [paths](./paths), [cantos, bordas e sombras](./decorations) e [desaceleração](./decay) pulam direto para o valor final em vez de animar. Opacidade e [cores](./colors) continuam animando, do mesmo jeito que o Framer Motion faz, então o conteúdo segue aparecendo e sumindo com fade. Nada muda na API: `finished` resolve com `true`, uma sequência passa de imediato ao próximo passo, `press()` encaixa na hora e um grupo com stagger chega junto.

```ts
await animate(card, 'fadeInUp') // o card já está no lugar, o fade ainda toca
```

Repetições infinitas e os presets de atenção ficam parados em vez de entrar em loop. A preferência é lida quando cada animação começa, então uma mudança vale a partir da próxima. Os efeitos que consultam a plataforma por conta própria seguem a mesma preferência, inclusive `always` e `never`: [texto](./text), [shimmer](./shimmer), [indicadores de carregamento](./loaders), [imagens com movimento líquido](./liquid), [partículas](./particles), [efeitos de SF Symbols](./symbol-effects) e [revelação circular](./reveal).

No iOS, a configuração vem de `UIAccessibilityIsReduceMotionEnabled()`. No Android, Remover animações zera a escala de duração dos animators, que o Jolt lê com `ValueAnimator.areAnimatorsEnabled()` a partir do Android 8 e pela configuração global antes disso.

## Lendo a preferência

Uma tela pode fazer mais do que pular o movimento: mostrar uma ilustração parada ou dispensar o splash. Leia a mesma preferência que o Jolt usa:

```ts
import { onReducedMotion, reducedMotion } from '@rafaelaugusto/jolt'

reducedMotion() // true ou false, agora
const off = onReducedMotion((reduced) => {
  // chamado com o novo valor quando ele muda
})
off()
```

`reducedMotion()` informa o que o Jolt aplica: a configuração da plataforma com `user`, `true` com `always` e `false` com `never`. `onReducedMotion()` só chama de volta quando esse valor muda, pelo `configure()` ou pela plataforma. No iOS a mudança chega na hora, pela notificação do Reduzir Movimento, inclusive quando ele é ligado pela Central de Controle. O Android não avisa, e a configuração só muda nos Ajustes, então o Jolt confere de novo quando o app volta para o primeiro plano.

No Vue, [`useReducedMotion()`](./vue#movimento-reduzido) devolve um ref que fica atualizado até o componente desmontar.

Para tocar tudo e ainda decidir por conta própria, escolha `never` e leia a configuração da plataforma no app.
