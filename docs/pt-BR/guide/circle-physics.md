# Física de círculos

Faça algumas views colidirem entre si, quicarem nas bordas e seguirem o dedo. `physicsWorld()` é uma entrada opcional disponível neste checkout para a próxima beta. Recompile o aplicativo nativo após atualizar.

<Clip name="circle-physics-ios" caption="Simulador iOS: Bump Club com arraste e soltura nativos reais, colisões entre círculos e bordas, impulsos, pausa/retomada e redução de movimento. Interface em inglês, velocidade original." />
<Clip name="circle-physics-android" caption="Emulador Android: a mesma interação nativa, com toques reais via ADB. Interface em inglês, velocidade original; gravações de simulador/emulador não são medições de desempenho em aparelho físico." />

Crie o mundo **após o layout**, em um `AbsoluteLayout` dedicado, com filhos diretos quadrados. A largura e a altura de cada view devem ser iguais ao diâmetro do círculo. As posições representam centros em DIPs locais do contêiner, com x para a direita e y para baixo.

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
// board tem pelo menos 240 × 300; red e blue são filhos diretos de 48 × 48.
const world = physicsWorld(
  board,
  [
    { id: 'red', view: red, radius: 24, x: 70, y: 60 },
    { id: 'blue', view: blue, radius: 24, x: 170, y: 80, mass: 2 },
  ],
  { scope, restitution: 0.7 },
)

world.impulse('blue', { x: 180, y: -700 })
world.pause()
world.play()
world.reset()
console.log(world.snapshot()) // Diagnóstico sob demanda, sem observador por frame.
// Ao encerrar a tela:
scope.dispose()
```

## Corpos e opções

| Entrada         | Contrato                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Corpos          | 1–16 círculos sem sobreposição, IDs únicos e não vazios, raio de 12–256 DIPs e massa de 0,1–100 (padrão 1). Todos começam dentro do contêiner. |
| Área            | A área total dos círculos ocupa no máximo 40% do contêiner. Cada diâmetro deve caber nas duas dimensões.                                       |
| `velocity`      | Velocidade inicial `{ x, y }` em DIPs/s, padrão zero; módulo máximo de 1200.                                                                   |
| `gravity`       | Padrão `{ x: 0, y: 750 }` DIPs/s²; cada componente fica entre −2000 e 2000.                                                                    |
| `restitution`   | 0–1, padrão 0,65. Contatos normais abaixo de 40 DIPs/s assentam sem quicar.                                                                    |
| `damping`       | Amortecimento exponencial da velocidade por segundo, 0–20; padrão 0,5.                                                                         |
| `reducedMotion` | Padrão `'pause'`. `'continue'` permite interação essencial mediante escolha explícita.                                                         |
| `scope`         | Escopo ativo opcional; suspensão pausa, retomada recupera o estado anterior e descarte remove o mundo.                                         |

`impulse(id, {x,y})` usa massa × DIPs/s e adiciona impulso/massa à velocidade. Os componentes ficam limitados a ±120000 e a velocidade resultante a 1200. Corpos pausados, fora da tela, com movimento reduzido ou sendo arrastados ignoram impulsos. `reset()` restaura posições iniciais proporcionalmente aos limites atuais e velocidades iniciais, inclusive durante a pausa. `paused` informa a pausa explícita; `snapshot().status` também informa suspensão automática, repouso e limites inválidos.

## Interação nativa e propriedade das views

O kernel C no iOS e o Java no Android usam passos fixos de 1/240 segundo. Callbacks nativos do display avançam a física e escrevem translações nas views; os handlers nativos de pan/toque controlam o arraste e a velocidade de soltura. Não há callback JavaScript por frame, movimento do dedo ou colisão. O JavaScript cria a cena, envia comandos, trata mudanças de layout/ciclo de vida e lê snapshots opcionais. O NativeScript compartilha a thread da interface com JavaScript; a API **não** promete manter o movimento durante bloqueios dessa thread.

O círculo segurado age como corpo cinemático e empurra os outros. Um dedo/corpo pode ser segurado por vez; cancelamento o solta com velocidade zero. A soltura usa a velocidade do ponteiro fornecida pela plataforma, limitada a 1200 DIPs/s. Não há rotação, atrito, juntas, formas arbitrárias, detecção contínua de colisão ou callbacks de contato. É um solver pequeno para interfaces, não um motor geral de corpos rígidos nem uma integração com Box2D.

Reserve o contêiner e os corpos exclusivamente ao mundo. Não anime/vincule suas transformações, adicione outros gestos/listeners nativos de toque, mova os corpos para outro pai ou transforme/role seu espaço de coordenadas durante o uso. Observadores de gestos NativeScript, transformações iniciais e propriedade duplicada são rejeitados. Mantenha os filhos decorativos sem interação. O descarte remove os handlers de entrada/ciclo de vida, para o relógio e restaura translações e flags de interação originais.

## Limites, repouso e ciclo de vida

Redimensionar reposiciona os centros proporcionalmente, cancela o arraste, zera velocidades e separa contatos. Se o contêiner não comportar os círculos, o relógio pausa até caberem novamente. Arranjos densos ou adversariais ficam fora do contrato; o solver iterativo tem trabalho limitado e é aproximado.

Pausa, segundo plano, unload e redução de movimento param as atualizações e cancelam o arraste ativo. As demais velocidades são preservadas para a retomada. Em repouso, o mundo remove seu callback de display; toque ou impulso o acordam. Cada frame executa no máximo 16 passos (1/15 segundo). Tempo excedente é descartado e informado em `droppedMs`, evitando trabalho acumulado sem limite após travamentos da interface.

O preview **Melhor juntos**, com a marca Bump Club, tem controles em inglês, português, espanhol e chinês simplificado. Veja a [validação nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/circle-physics.md). Esta é a segunda etapa da [#39](https://github.com/rafaelaugustos/jolt/issues/39); vínculos físicos, uma API geral de empurrão e física mais ampla continuam como próximas etapas. [Gravidade e quique](./gravity) continua sendo a API de animação finita de uma propriedade.

Se o NativeScript reconstruir as views nativas, o mundo é descartado automaticamente. Crie outro após o novo layout. Unload/load que preserva as mesmas views apenas suspende e retoma.
