# Vínculos e pontos de encaixe

Dê ao círculo um ponto para o qual voltar ou deixe a soltura escolher seu próximo lugar. Vínculos e encaixes ampliam a entrada nativa [`physicsWorld()`](./circle-physics) na **0.1.0-rc.1**. Recompile o aplicativo nativo.

<Clip name="physics-attachments-ios" caption="Simulador iOS: arrastes reais esticam o vínculo cobre; solturas lentas e rápidas levam a esfera lilás aos pontos de encaixe. Linha nativa, mudança da âncora, pausa/retomada e redução de movimento. Interface em inglês, temporização da gravação original." />
<Clip name="physics-attachments-android" caption="Emulador Android: as mesmas interações com gestos reais via ADB, molas/colisões e desenho do vínculo nativos. Interface em inglês, temporização original; não é uma medição de desempenho em aparelho físico." />

Crie o mundo após o layout. Continuam valendo o contêiner dedicado, views circulares quadradas, propriedade exclusiva, densidade e limites de corpos da [física de círculos](./circle-physics).

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'

// board tem 320 × 360; copper tem 56 × 56 e lilac tem 52 × 52.
const world = physicsWorld(board, [
  {
    id: 'copper',
    view: copper,
    radius: 28,
    x: 160,
    y: 130,
    attachment: {
      anchor: { x: 160, y: 50 },
      length: 72,
      stiffness: 180,
      damping: 14,
      line: { color: '#DBB994', width: 1.5 },
    },
  },
  {
    id: 'lilac',
    view: lilac,
    radius: 26,
    x: 160,
    y: 280,
    snap: {
      points: [
        { x: 64, y: 280 },
        { x: 160, y: 280 },
        { x: 256, y: 280 },
      ],
      stiffness: 220,
      damping: 25,
      projection: 0.12,
    },
  },
])
world.snapTo('lilac', 1) // Encaixe inicial opcional; a soltura escolhe automaticamente.
// Depois, mude a âncora sem zerar a velocidade atual:
world.attach('copper', { anchor: { x: 100, y: 50 }, length: 72 })
world.snapTo('lilac', 2)
// Remova a mola e qualquer encaixe selecionado:
world.attach('copper', null)
// Ao encerrar a tela (ou use um motionScope proprietário):
world.dispose()
```

## Mola presa à âncora

`attachment` conecta o centro do corpo a um ponto fixo do contêiner. `anchor` usa DIPs locais e deve começar dentro da área. `length` é o comprimento de repouso, de 0–10000 DIPs (padrão 0). É uma distância elástica, não um limite rígido de corda. O equilíbrio de um corpo pendurado inclui o alongamento pela gravidade: na configuração vertical, a distância extra é `mass * gravity / stiffness`.

`stiffness` é força por DIP, de 1–1000 (padrão 180). `damping` é amortecimento viscoso, de 0–120 (padrão 24), diferente do amortecimento exponencial de velocidade do mundo. A massa do corpo afeta a resposta. O integrador nativo de passo fixo aplica a mola e o amortecimento viscoso implícito junto das colisões e do limite de velocidade existente.

`line` desenha opcionalmente a conexão da âncora até a borda do círculo. A cor usa `#RRGGBB`; a largura fica entre 0,5–6 DIPs (padrão 1,5). O iOS usa uma shape layer e o Android um drawable. O relógio nativo existente atualiza a linha; não há outro relógio de display nem observador JavaScript. A mudança de âncora substitui toda a configuração do vínculo, inclusive o estilo da linha. Omitir `line` remove a linha anterior.

## Encaixe na soltura

`snap.points` contém 1–8 centros de círculo distintos e válidos. O círculo começa sem encaixe selecionado; use `snapTo(id, index)` se ele já deve iniciar preso a um ponto. Na soltura nativa, o Jolt limita a velocidade recebida, projeta a posição do corpo por `velocity * projection` e escolhe o ponto mais próximo. `projection` fica entre 0–0,3 segundo (padrão 0,12); zero escolhe pela posição atual. Empates escolhem o primeiro ponto configurado.

A mola de encaixe preserva a velocidade da soltura e converge para o centro selecionado. A gravidade é suprimida nesse corpo enquanto o encaixe está selecionado, para evitar que ele pare abaixo do destino. As colisões continuam valendo: um ponto ocupado pode impedir a chegada. `snapshot().bodies[i].snap` informa o índice/ponto escolhido e se o círculo está a até 0,25 DIP em baixa velocidade; não há reserva exclusiva. O diagnóstico nativo `release` registra posição e velocidade limitada antes da escolha e integração.

Rigidez e amortecimento do encaixe usam os mesmos limites/padrões das molas de âncora. Um corpo pode configurar ambos: o encaixe selecionado tem prioridade; um novo arraste suspende as forças das molas e sua soltura escolhe novamente. A linha opcional aponta para o destino efetivo da mola.

## Comandos, cancelamento e layout

- `attach(id, options | null)` substitui/remove a âncora, limpa o encaixe selecionado e preserva a velocidade. Aceita mudanças durante a pausa, mas o contêiner deve comportar os círculos antes da atualização.
- `snapTo(id, index)` seleciona um ponto configurado, inclusive durante a pausa. Ignora o corpo enquanto ele é arrastado. Ofereça botões acessíveis para esse comando além da manipulação direta.
- O arraste nativo é cinemático. Cancelamento, pausa, unload, segundo plano e redução de movimento soltam o corpo com velocidade zero e restauram seu encaixe anterior; um gesto cancelado não escolhe um novo destino.
- `reset()` restaura posições/velocidades iniciais, limpa encaixes selecionados e diagnósticos de soltura e mantém as configurações atuais de âncoras/pontos. Chame `snapTo()` novamente para escolher o encaixe inicial.
- Âncoras e pontos acompanham o tamanho do contêiner por coordenadas normalizadas armazenadas; os pontos respeitam os limites do círculo sem acumular deslocamento após vários redimensionamentos. Raio e comprimento de repouso permanecem fixos em DIPs. Redimensionar cancela o arraste e zera velocidades, como antes.

Pausa/redução de movimento param o relógio nativo existente. Uma mola assentada entra em repouso; impulso, mudança de destino ou novo gesto a acordam. O descarte remove as linhas nativas junto dos recursos de entrada/ciclo de vida do mundo. Comandos e eventos de ciclo de vida passam pelo JavaScript; forças, escolha do destino, contatos, desenho e atualizações por frame permanecem nativos. A thread da interface continua compartilhada com o JavaScript do NativeScript.

O preview **Um lugar para voltar / Equilibrium**, em quatro idiomas, demonstra ambos os comportamentos. Molas para pontos fixos e encaixes na soltura são a terceira parte entregue da [#39](https://github.com/rafaelaugustos/jolt/issues/39), disponível na **0.1.0-rc.1**. O arraste direto padrão suspende as forças das molas. O build de desenvolvimento acrescenta o modo de mola no ponteiro da [#238](https://github.com/rafaelaugustos/jolt/issues/238), descrito abaixo. Juntas entre corpos, restrições rígidas, formas arbitrárias e um motor geral de dinâmica ficam fora deste contrato. Veja a [validação e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-attachments.md) e a [auditoria das entregas](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/physics-completion.md).

## Arraste com mola no ponteiro (build de desenvolvimento)

Esta adição está no build de desenvolvimento posterior ao RC.1; recompile o app nativo. Use `CircleBody.drag: { type: 'spring' }` para mover uma âncora temporária com o toque nativo. O círculo continua dinâmico, sujeito à gravidade, massa e colisões. Sem `drag`, ou com `'direct'`, o arraste cinemático existente é preservado.

<Clip name="pointer-spring-ios" caption="Simulador iOS: gestos reais do XCTest movem a âncora da mola, com atraso visível, colisão, retorno e snap ao soltar, pausa e Reduce Motion. Interface em inglês, tempo original; não mede desempenho em aparelho físico." />
<Clip name="pointer-spring-android" caption="Emulador Android: gestos reais via ADB mostram a âncora móvel, a resposta às colisões e o retorno à mola fixa ou ao dock ao soltar. Pausa e Reduce Motion; interface em inglês, tempo original, sem medição em aparelho físico." />

```ts
const world = physicsWorld(board, [
  {
    id: 'orb',
    view: orb,
    radius: 28,
    x: 160,
    y: 130,
    drag: {
      type: 'spring',
      length: 45,
      stiffness: 140,
      damping: 12,
      line: { color: '#FFE1A6', width: 2 },
    },
    attachment: { anchor: { x: 160, y: 50 }, length: 72 },
  },
])
```

`length` é o comprimento de repouso elástico em DIPs (0–10000, padrão 0); `stiffness` aceita 1–1000 (padrão 180) e `damping`, 0–120 (padrão 24). A linha opcional usa `#RRGGBB` e largura de 0,5–6 DIPs (padrão 1,5). A configuração é copiada na criação. A linha temporária aparece durante o toque; a linha da âncora fixa reaparece depois.

O gesto começa dentro do círculo visível. Um ponteiro controla um corpo por mundo. O alvo temporário soma à posição do ponteiro a distância inicial entre o contato e o centro, preservando essa diferença, e fica limitado às bordas locais do contêiner. Não é uma articulação na superfície: os círculos não giram. Multitoque simultâneo e ancestrais transformados continuam fora do contrato.

Ao soltar, a âncora temporária é removida e a **velocidade simulada do corpo** é preservada, sem substituí-la pela velocidade do dedo. Os pontos de snap usam essa posição/velocidade; sem snap, a mola fixa volta a atuar ou o corpo fica livre. Cancelar remove o ponteiro, zera a velocidade e restaura o dock anterior sem registrar uma soltura. Pausa, Reduce Motion, unload, segundo plano, resize, reset e dispose cancelam o gesto. `attach()` altera a mola de repouso, sem alterar a mola do ponteiro ativo. `snapTo()` e `impulse()` continuam ignorando corpos segurados.

No snapshot, `held` indica posse do gesto; `pointer` descreve a âncora temporária ativa ou vale `null`, enquanto `attachment` descreve a âncora de repouso. Input, integração e desenho usam o relógio nativo existente, sem callback JavaScript por movimento ou frame. A thread de UI continua compartilhada. Veja [validação e limites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/pointer-spring.md).
