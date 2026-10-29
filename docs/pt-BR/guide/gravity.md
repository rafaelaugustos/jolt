# Gravidade e quique

Defina uma posição de pouso e deixe o card cair e quicar. `{ type: 'gravity' }` está disponível desde a **0.1.0-rc.1**, pela API existente de `animate()`.

<Clip name="gravity-ios" caption="Simulador iOS: preview nativo real, com toques para soltar, lançar, pausar/retomar, retornar, mudar a restituição e reduzir movimento. Interface em inglês; velocidade original." />
<Clip name="gravity-android" caption="Emulador Android: a mesma trajetória balística e os controles, com views nativas e toques via ADB. Interface em inglês; velocidade original. As gravações não são medições de desempenho em aparelhos físicos." />

```ts
import { animate } from '@rafaelaugusto/jolt'

const falling = animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.55,
  },
)

falling.pause()
falling.play()
// Interrompa preservando a posição e a velocidade atuais:
animate(card, { y: 0 }, 'smooth')
```

O destino é um limite nas coordenadas de translação da propriedade, não um chão detectado nem outra view. Se o topo original do card fica em 20 DIPs e sua altura é 100, um chão em 400 pede `y: 280`. Meça seu layout. A trajetória fixa não reage a obstáculos ou a um chão que muda de posição; atualize o destino após mudanças de layout.

## Parâmetros físicos

| Opção          | Padrão  | Significado                                                                                                                                                                   |
| -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceleration` | `1800`  | Magnitude positiva e finita em unidades/segundo², orientada do início para o destino. Nas translações de views, a unidade é DIP.                                              |
| `restitution`  | `0.55`  | Fração da velocidade de impacto preservada, de `0` inclusive a `1` exclusivo. `0` pousa sem quicar; a altura de cada novo quique é multiplicada pelo quadrado da restituição. |
| `velocity`     | herdada | Unidades/segundo com sinal no eixo da propriedade. Um valor explícito substitui a velocidade da animação interrompida; uma view parada começa em zero.                        |

A curva aceita apenas `x`, `y` e motion values numéricos. Informe o início atual/explícito e um destino, sem lista de múltiplos segmentos. Destinos negativos funcionam: a aceleração aponta para o destino e a velocidade mantém o sinal do eixo. Quando início e destino coincidem, o limite fica no sentido positivo; uma velocidade negativa lança para longe dele. Uma velocidade positiva de chegada reflete imediatamente nesse limite.

A duração vem da física. Não combine gravidade com `duration`, easing ou parâmetros de mola. Delay, stagger, repetições, reprodução reversa, camadas nomeadas, escopos, pausa/retomada e busca por progresso seguem os contratos existentes. A reprodução reversa inverte a trajetória gravada; não é uma nova simulação física. `finished` espera o último quique, evitando que sequências avancem no primeiro contato.

## Uma fonte, várias views

```ts
import { bind, motionScope, motionValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const height = motionValue(0)
scope.use(() => bind(ball, { y: height }))
scope.use(() =>
  bind(shadow, {
    scaleX: height.to([0, 280], [0.35, 1]),
    opacity: height.to([0, 280], [0.08, 0.4]),
  }),
)
scope.animate(height, 280, { type: 'gravity', restitution: 0.7 })
// Suspenda na inatividade temporária; descarte ao liberar a tela.
```

Motion values mantêm suas unidades originais de aceleração e velocidade. O preview **Um pouso mais suave** usa um valor para a esfera e a sombra, com controles em inglês, português, espanhol e chinês simplificado. Também demonstra lançamento e interrupção por uma mola.

## Execução e limites

O Jolt resolve os voos de aceleração constante durante a preparação. Os instantes exatos de contato e ápice permanecem na amostragem, e os players nativos interpolam as amostras. Não há loop de física em JavaScript nem callback do app por frame. Isso reutiliza Core Animation no iOS e o driver de animação existente no Android. O JavaScript do NativeScript compartilha a thread de UI; execução nativa não garante que toda plataforma ou vínculo continue quando ela é bloqueada.

A trajetória termina no limite quando o próximo quique fica dentro das tolerâncias de posição e velocidade. A amostragem de translações/motion values usa tolerância de interpolação de 0,25 unidade; o amostrador compartilhado informa quando casos extremos exigem o fallback com trabalho limitado. A preparação rejeita trajetórias com mais de 60 segundos ou 512 voos, além de entradas não finitas ou fora do alcance numérico. Quiques perfeitamente elásticos e infinitos ficam fora desta curva finita.

Reduce Motion vai direto ao destino de repouso pela configuração existente. O controle do preview interrompe imediatamente a queda em andamento. Descarregar/descartar libera vínculos e animações; a entrada temporária em segundo plano suspende o escopo do preview.

Gravidade finita, [colisões entre círculos](./circle-physics) e [vínculos com pontos fixos e encaixe](./physics-attachments) são as três partes entregues da [#39](https://github.com/rafaelaugustos/jolt/issues/39), disponíveis desde a **0.1.0-rc.1**. O mundo de círculos opcional também aceita impulsos pontuais por `world.impulse()`. A 0.1.0-rc.2 acrescenta o [arraste com mola no ponteiro](./physics-attachments) da [#238](https://github.com/rafaelaugustos/jolt/issues/238); o arraste direto continua sendo o padrão. Os [pontos de encaixe de decay](./decay) e as [molas contínuas](./live-springs) mantêm seus próprios contratos. Veja a [validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gravity.md) e a [auditoria das entregas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).
