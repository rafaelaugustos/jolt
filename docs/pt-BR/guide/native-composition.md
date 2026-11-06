# Cenas nativas e ciclo de vida dos recursos

Disponível em `0.1.0-rc.11.1`. Instale a versão correspondente e recompile os aplicativos nativos; o texto com gradiente no Android exige o novo helper compilado.

Estas APIs compõem movimento nativo no iOS e Android: desenhos retidos, prioridades de comportamento, partes articuladas, texto com gradiente e efeitos nomeados em timelines. São entradas nativas; esta entrega não introduz um contrato equivalente para a Web. Regras, assets e objetos de SDK continuam pertencendo ao aplicativo. Veja a base em [escopos e estados visuais](./motion-controllers).

## Manter o recurso e pausar seu movimento {#resources}

`scope.resource(factory)` cria e retém um recurso; `scope.retain(resource)` adota um existente. Ambos mantêm a posse até `release(resource)`, `reset()` ou `dispose()`, mesmo quando a animação termina. Aceitam funções de limpeza ou objetos com `dispose()` ou `stop()`. Um recurso não pode pertencer a dois escopos. Reter novamente o mesmo objeto é idempotente; chamar a factory novamente cria outro recurso.

| Recurso                             | Suspensão                                                           | Descarte final                                           |
| ----------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Shape ou texto com gradiente retido | Mantém o desenho e pausa a animação ativa                           | Remove pintura nativa e listeners                        |
| Controlador retido com playback     | Chama `pause()`; retoma apenas o que o escopo pausou                | Chama `dispose()` ou `stop()`                            |
| Propriedade nativa retida           | Mantém o adaptador; não pausa animações/bindings sem dono no escopo | Descarta o adaptador, preservando o objeto de SDK do app |
| `scope.add(animation)`              | Pausa playback e deixa de reter handles concluídos                  | Interrompe o trabalho restante                           |
| `scope.use(factory)`                | Remove a assinatura e a recria ao retomar                           | Remove a assinatura                                      |

A retenção prefere `suspend()/resume()` quando o recurso oferece esse par; caso contrário, usa `pause()/play()`. Um recurso estático sem esses métodos permanece retido. Uma pausa manual sobrevive à ida e volta do background. Os contratos existentes de `add()` e `use()` permanecem; tentar reter um objeto já adotado com outro tempo de vida lança erro.

`useShape()` vincula um callback ref ao unmount real do Vue. Refs repetidas não duplicam recursos; trocar a view libera o desenho anterior. A desativação pelo KeepAlive suspende playback. O padrão do helper é `unload: 'pause'`; `shape()` imperativo mantém `unload: 'stop'` até uma escolha explícita. O desenho pode continuar visível enquanto pausado.

Nos adaptadores nativos, retenha a propriedade, adote sua animação e registre bindings separadamente. O segundo exemplo pressupõe um uniform de shader SceneKit já declarado e inicializado; esse adaptador é exclusivo do iOS. O motion value de origem e o objeto de SDK continuam pertencendo ao app. Descarte o escopo antes de destruir o alvo nativo.

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/vue'

const drawing = useShape({
  d: 'M10 50 L50 10 L90 50',
  viewBox: [0, 0, 100, 100],
  stroke: '#8B5CF6',
  strokeWidth: 3,
})
function replay() {
  drawing.current?.animate({ strokeEnd: [0, 1] }, { duration: 900 })
}
</script>

<template>
  <GridLayout :ref="drawing.ref" width="160" height="160" @tap="replay" />
</template>
```

```ts
import { motionScope } from '@rafaelaugusto/jolt'
import { sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const focus = scope.resource(() =>
  sceneKitUniform(material, 'focus', {
    type: 'float',
    range: [0, 1],
    units: ['fraction'],
    motion: 'appearance',
  }),
)
scope.add(focus.animate(1, { duration: 800 }))
// For a binding instead: scope.use(() => focus.bind(applicationOwnedValue, p => p))
// Dispose the scope before destroying the application's native target.
```

<Clip name="native-resources-ios" caption="Simulador iOS 26.2: pausa, retomada, cache pelo Vue KeepAlive e unmount/remount real. Os contadores separam a vida do recurso de sua animação." />
<Clip name="native-resources-android" caption="ASUS ZenFone 3 físico, Android 8: o desenho permanece pausado, sobrevive ao cache e é descartado no unmount real. Toques ADB reais; não é medição de desempenho." />

## Prioridades e interrupção {#behaviors}

`motionBehaviors()` coordena uma única linha de interação exclusiva. Maior prioridade interrompe; prioridades iguais são rejeitadas, salvo quando o comportamento solicitado declara `equal: 'replace'`. `blocks` exclui solicitações nomeadas independentemente da prioridade; `when` verifica condições do aplicativo antes de trocar a posse. Coordenadores separados permanecem independentes.

Cada execução possui um escopo privado. A interrupção descarta esse escopo antes de iniciar a substituta, permitindo que a animação nativa parta da apresentação atual. `wait()` verifica a identidade após o await e segura a continuação durante pausa manual/background. Use-o a cada etapa aguardada; use `checkpoint()` após um await externo e `guard(callback)` para callbacks atrasados. Esses auxiliares não desfazem mutações arbitrárias do app nem abortam uma requisição externa.

Os resultados são `completed`, `interrupted`, `cancelled`, `failed` ou `blocked`. `cancel()` restaura o comportamento de repouso declarado; `stop()` cancela sem restaurá-lo, e `dispose()` impede novas execuções. O repouso reinicia após conclusão, cancelamento ou falha; ações interrompidas não retomam implicitamente. `pause()/play()` controlam a pausa. Guards podem lançar erros síncronos; falhas da execução aparecem no resultado e no `onError` opcional. Retenha o controlador em um escopo para vinculá-lo ao ciclo de vida do componente.

```ts
import { motionBehaviors } from '@rafaelaugusto/jolt'

const behavior = motionBehaviors(
  {
    rest: {
      priority: -1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 0, rotate: 0 }, 'smooth'))
      },
    },
    touch: {
      priority: 1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: -15 }, { duration: 900 }))
      },
    },
    dress: {
      priority: 2,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 60 }, { duration: 900 }))
      },
    },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: 15 }, { duration: 900 }))
      },
    },
  },
  { rest: 'rest' },
)

const run = behavior.request('touch')
behavior.request('dress')
const result = await run.finished // { status: 'interrupted' }
```

<Clip name="native-behaviors-ios" caption="Simulador iOS: vestir interrompe carinho, comer bloqueia vestir e a conclusão restaura o repouso. A mesma coordenação anima personagem e confirmação de interface." />
<Clip name="native-behaviors-android" caption="Android físico: toques reais interrompem e bloqueiam ações por prioridade, depois restauram o repouso. Os nomes dos comportamentos pertencem ao aplicativo." />

## Partes articuladas e pontos de encaixe {#rig}

Importe `rig2d` pela entrada opcional `/rig`. O app fornece views nativas na hierarquia direta de pais e filhos declarada; Jolt não altera seus pais. As definições contêm partes, poses e pontos de encaixe, sem assets ou refs de framework. O limite de validação é 64 partes; ele não garante desempenho em qualquer dispositivo.

Os transforms são `x` e `y` em DIPs, `rotate` em graus e `scaleX/scaleY` como multiplicadores. Pivôs usam frações do tamanho nativo da parte. Sockets usam DIPs locais por padrão ou frações com `units: 'relative'`; o acessório deve ser filho direto da parte. Os transforms nativos do pai movem o acessório sem observador JavaScript por frame. `point(name)` amostra coordenadas relativas ao pai da parte raiz e exige ancestrais com layout; não é um binding contínuo. O modelo cobre transforms 2D, sem perspectiva, skew, deformação de malha ou IK.

Pesos não negativos combinam deslocamentos em relação ao repouso de cada canal. Canais omitidos usam repouso; somas acima de um são normalizadas por canal. Rotações sem limites usam o menor deslocamento angular; com limites, todas as amostras são restringidas, inclusive o overshoot de springs. Somente canais declarados em repouso/poses são controlados. Novas misturas partem da apresentação atual.

`attach()` valida posse e hierarquia antes de substituir partes. `accessory(name, null)` solta o acessório. O descarte restaura transforms ainda pertencentes ao rig sem cancelar novos donos externos. `pause()/play()/stop()/dispose()` controlam o ciclo de vida; retome antes de pedir uma pose após uma pausa manual. A mesma API serve para personagens e ilustrações articuladas comuns.

```ts
import { rig2d } from '@rafaelaugusto/jolt/rig'

const rig = rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: { parent: 'body', pivot: { x: 0.5, y: 0.1 }, rotation: [-70, 70] },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { body: { rotate: 12 }, hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
rig.accessory('grip', flower)
rig.to('wave', 'smooth')
rig.blend([
  { pose: 'wave', weight: 0.3 },
  { pose: 'reach', weight: 0.7 },
])
```

<Clip name="native-rig-ios" caption="Simulador iOS: três poses, mistura interrompida, flor na mão e limite de rotação. Uma luminária usa a mesma API de partes articuladas." />
<Clip name="native-rig-android" caption="Android físico: transforms dos pais carregam a flor nas mudanças rápidas de pose; o alcance respeita o limite de rotação. Sem atualização JavaScript do socket a cada frame." />

## Letras com gradiente e brilho em movimento {#text}

`gradientText(label, options)` mantém o Label nativo e seu texto acessível. A pintura decorativa não adiciona outro nó de texto nem intercepta entrada. Aceita 2–8 cores, stops ordenados em 0–1, ângulo de gradiente no sentido horário e cor/largura do brilho. A largura é uma fração em (0, 1]. `sheen.direction` usa `right` por padrão; `left` faz o brilho atravessar da direita para a esquerda. Recompile o Android para instalar o helper nativo; atualizar apenas JavaScript não basta.

`play()` retorna um handle nativo com seek; repeats/reverse da transição controlam passagens repetidas. `stop()` remove o brilho móvel e preserva o gradiente estático. `suspend()/resume()` preservam playback ativo. `dispose()` remove a pintura e restaura a cor original, salvo quando o app a substituiu. Movimento reduzido suprime o brilho móvel e mantém o preenchimento legível.

Mudanças de texto, fonte, layout e alinhamento invalidam os glifos em cache. Múltiplas linhas e RTL seguem o Label nativo; emojis viram silhuetas com gradiente, sem suas cores originais. Spans formatados não são suportados: `formattedText` inicial é rejeitado; trocar para ele libera a pintura. `refresh()` solicita invalidação após uma alteração de estilo nativo externa.

O orçamento da máscara é 4.194.304 pixels: Android usa bitmap alfa; iOS limita a escala de rasterização e rejeita superfícies impraticavelmente grandes. `snapshot().maskBytes` estima a máscara dos glifos, não a memória total de GPU ou o PSS. Verificações de layout reutilizam máscaras sem mudanças; mover o brilho não recria os glifos a cada frame.

```ts
import { gradientText, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const title = scope.resource(() =>
  gradientText(label, {
    colors: ['#7C3AED', '#DB2777', '#F59E0B'],
    angle: 0,
    sheen: { color: '#FFFFFFFF', width: 0.35 },
  }),
)
const light = title.play({ duration: 1800, ease: 'easeInOut' })
light.pause()
light.play()
```

<Clip name="native-text-ios" caption="Simulador iOS: gradiente nas letras, brilho em movimento, troca de texto latino/árabe, pausa e movimento reduzido. O Label original mantém o texto acessível." />
<Clip name="native-text-android" caption="Android 8 físico: brilho recortado pelos glifos e pausado na posição; movimento reduzido mantém o gradiente. Efeito separado do shimmer de placeholders." />

## Efeitos nomeados na timeline {#cues}

`withTimelineCues(playback, cues, options)` envolve um relógio Jolt existente. Cada cue tem nome único, posição em milissegundos lógicos e callback que retorna um handle ou função de limpeza sob sua posse. Efeitos na mesma posição respeitam a ordem de declaração. Áudio pode usar um adaptador do aplicativo com stop/dispose; esta API não adiciona um motor de áudio.

Callbacks executam em JavaScript nos pontos marcados, usando o relógio nativo de playback, sem polling por frame. Não podem executar durante bloqueio do JavaScript. O padrão `late: 'skip'` ignora eventos atrasados mais de 50 milissegundos lógicos; escolha `tolerance` ou `late: 'catch-up'` explicitamente. `lateBy` informa o atraso de entrega relativo ao relógio, não a latência de apresentação, áudio ou haptic. `configure({ timeScale })` escala os pontos com o relógio visual. Movimento reduzido suprime cues.

A pausa segura pontos pendentes e efeitos com playback, inclusive efeitos que continuam após a animação visual. Stop/dispose cancela visuais, pontos e efeitos juntos. A conclusão aguarda promises finitas dos efeitos retornados; adaptadores devem resolver sua promise ao parar. Seek não dispara pontos atravessados, cancela efeitos ativos e rearma pontos futuros ao voltar.

`repeat: { every, count, reverse }` declara passagens finitas explicitamente; repeats das tracks visuais não são inferidos. Limites: 1.024 nomes, 1.024 passagens por cue e 4.096 ocorrências totais. Erros de efeito vão para `onError`, sem abortar a animação visual.

```ts
import { animate, motionScope, withTimelineCues } from '@rafaelaugusto/jolt'

const scope = motionScope()
const scene = scope.add(
  withTimelineCues(
    animate(ball, { x: [-100, 100] }, { duration: 2400, ease: 'linear' }),
    [
      {
        name: 'impact',
        at: 1200,
        effect: () =>
          animate(
            star,
            { scale: [0.2, 1.6], opacity: [1, 0] },
            { duration: 650, haptic: { style: 'light', times: [0.001] } },
          ),
      },
    ],
  ),
)
scene.pause()
scene.play()
scene.dispose()
```

<Clip name="native-cues-ios" caption="Simulador iOS: cancelamento antes do impacto, replay das partículas/brilho e pausa antes do ponto marcado. O simulador não demonstra vibração física." />
<Clip name="native-cues-android" caption="Android físico: cancelar impede o impacto pendente; pausa e retomada mantêm efeitos no relógio visual. O vídeo não transmite nem mede o início da vibração." />

## Validação e limites {#validation}

As gravações mostram interação nativa real em um ASUS ZenFone 3 (Android 8) e no simulador iPhone 17 Pro (iOS 26.2). São evidências funcionais, não uma comparação de CPU/PSS. Consulte o [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-composition.md) para reprodução, testes repetidos de ciclo de vida e medidas do relógio. Execução nativa não elimina a disputa pela thread principal no NativeScript; estas APIs não introduzem um backend geral de RenderThread.
