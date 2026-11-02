# Gestos, zoom e scroll na Web

Trabalho experimental ainda não publicado após a **0.1.0-rc.8**, acompanhado nas #340–#345. Os seis recursos pertencem ao mesmo runtime do documento e aos seus escopos. O grafo de imports Web não depende de NativeScript nem de frameworks. As implementações nativas continuam disponíveis; as gravações nativas abaixo são referências, não demonstrações desta implementação Web.

Crie o runtime após a montagem. Coordenadas usam pixels CSS, rotação usa graus e velocidades usam unidades por segundo. Mantenha a superfície de entrada sem transforms e anime um filho; a fronteira de coordenadas renderizadas/top-layer existente continua válida. A aplicação cuida de marcação, semântica, dados e navegação.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
```

## Arraste com inércia e valores {#drag}

Use `release: "decay"` para o solver nativo de arraste: fricção, snap projetado e recuperação nas bordas. `rubberband` oferece resistência fora dos limites. O padrão existente continua retornando por spring à posição inicial ou aos pontos de snap. Informe `value` com um eixo para controlar um motion value emprestado; sem ele, o elemento de entrada se move. `dragging`, `settling`, `position`, `animation`, `paused` e `disposed` expõem o ciclo de vida. Há callbacks de início, movimento, soltura, cancelamento e repouso. Cancelar congela o movimento controlado; dispose preserva o valor emprestado. A soltura finita de elementos usa WAAPI.

```ts
const drag = scope.drag(handle, {
  axis: 'x',
  value: x,
  release: 'decay',
  bounds: { left: -200, right: 200 },
  rubberband: true,
  friction: 0.998,
  snap: [-200, 0, 200],
  onRelease: ({ animation }) => animation.finished.then(onFinished),
})
drag.pause()
drag.play()
drag.cancel()
```

<Clip name="web-gestures-drag-chromium" :width="760" caption="Chromium no macOS, arraste e soltura reais por mouse: inércia limitada, inversão e motion value emprestado. Velocidade original; gravação Web." />

<Clip name="drag-ios" caption="Referência no simulador iOS: demo nativa existente de drag com limites, rubberband e snap, com input real. Playback nativo preservado." />

## Composição de contatos {#contacts}

Pan, pinch e rotação reconhecem juntos. Adicionar ou remover um contato refaz a referência sem saltar o centroide. Os valores podem ser observados sem renders do framework; `settleTo`, `jumpTo`, `updateBounds`, pause/play/cancel/dispose controlam a interação. Pan aceita eixo, threshold, failOffset e limites, inclusive uma função da posição atual. O toque simples espera quando existe toque duplo. O ponto focal usa coordenadas CSS da viewport. Só há frames enquanto existe input ou movimento ativo.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: true,
  pinch: { min: 0.5, max: 4 },
  rotate: true,
  onTap: select,
  onDoubleTap: reset,
})
scope.bind(card, {
  x: gesture.x,
  y: gesture.y,
  scale: gesture.scale,
  rotate: gesture.rotate,
})
gesture.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 })
```

<Clip name="web-gestures-gesture-chromium" :width="760" caption="Chromium no macOS: pinch/rotação com dois contatos confiáveis via CDP, continuação com um contato, pan e toque duplo. Automação de input do navegador, não hardware touch físico." />

<Clip name="gesture-composition-ios" caption="Referência no simulador iOS: composição nativa de contatos e toques. Não é medição de desempenho em aparelho físico." />

## Painel e scroll aninhado {#scroll}

Declare um pan de eixo único com limites e seu descendente de scroll. O movimento para cima expande o painel antes de rolar; o sentido contrário esvazia o scroll dos descendentes elegíveis antes de recolher. Cada delta é consumido uma vez, inclusive na inversão de direção. A soltura reutiliza o solver de decay. O eixo horizontal considera os offsets RTL do navegador. Roda, teclado e foco continuam usando o scroll do browser. O eixo de toque coordenado pertence ao Jolt: Pointer Events resolve touch-action antes do contato; trocar CSS durante o gesto não devolve o pan ao navegador. Campos dentro da região preservam suas interações.

```ts
const gesture = scope.gestures(inputSurface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 240 } },
  initial: { y: 240 },
  scroll: { element: content },
})
scope.bind(panel, { y: gesture.y })
```

<Clip name="web-gestures-scroll-chromium" :width="760" caption="Chromium no macOS: um contato mantido expande o painel, rola o conteúdo e inverte sem soltar; depois, scroll pela roda do browser." />

<Clip name="gesture-handoff-ios" caption="Referência no simulador iOS: passagem nativa entre painel e conteúdo em um contato. Playback preservado." />

## Zoom de imagem e fechamento {#zoom}

Use a caixa da imagem centralizada no pai direto que representa a viewport, normalmente com `width:100%; height:100%; object-fit:contain`. A imagem recebe uma contribuição própria de transform. Pinch focal, pan com limites, toque duplo, zoom pela roda, teclas +/−/0/setas e Escape usam o mesmo controlador. Os atalhos de zoom da página continuam pertencendo ao browser. Consulte `ready`, `error` e `state`; carregamento, resize, pausa e descarte pertencem ao controlador. Backdrop/chrome opcionais recebem contribuições de opacidade independentes. O fechamento é uma intenção protegida: a aplicação decide a navegação; cancel/complete obsoletos retornam false.

```ts
const photo = scope.zoomable(image, {
  viewport,
  scale: [1, 5],
  doubleTap: 2.5,
  backdrop,
  chrome,
  onDismiss(intent) {
    closeRoute().then(
      (closed) => (closed ? intent.complete() : intent.cancel()),
      () => intent.cancel(),
    )
  },
})
photo.zoomTo(2, { x: 180, y: 120 })
photo.reset()
```

<Clip name="web-gestures-zoom-chromium" :width="760" caption="Chromium no macOS: toque duplo, pan, pinch confiável, reset, cancelamento de fechamento e zoom pelo teclado." />

<Clip name="photo-zoom-ios" caption="Referência no simulador iOS: pinch, pan, reset e fechamento cancelado da imagem nativa." />

## Cabeçalho, âncoras e refresh {#header}

Declare capa, artwork/títulos/seção fixa opcionais e o container real de scroll. O Jolt cuida de um espaçador removível e das contribuições de movimento. A altura mínima pode ser medida dinamicamente. `preserveAnchor` guarda uma linha visível por chave durante alterações síncronas ou assíncronas do renderer; se ela sair, usa uma posição sobrevivente. `scrollToItem`, `scrollToTop`, remeasure e controles usam a mesma fonte. Visibilidade e transferência de foco entre os títulos evitam dois títulos acessíveis ao mesmo tempo. Refresh é opcional: uma promise ativa, limiar de soltura, cancelamento e erro/retry. `commit` confere a requisição antes de executar a mudança e antes de restaurar a âncora. Uma mudança assíncrona deve conferir `cancelled` antes de escrever após um await. Cancelar resolve imediatamente o resultado do refresh.

```ts
const header = scope.scrollHeader(scroller, {
  header: cover,
  artwork,
  title,
  toolbarTitle,
  section,
  expanded: () => cover.offsetHeight,
  minimum: () => toolbar.offsetHeight,
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  async onRefresh(context) {
    const next = await fetchRows()
    await context.commit(() => replaceRows(next))
  },
  onRefreshError: showRetry,
})
await header.preserveAnchor(() => insertRows())
header.scrollToItem('album-6')
header.cancelRefresh()
```

<Clip name="web-gestures-header-chromium" :width="760" caption="Chromium no macOS: recolhimento, inserção ancorada, pull/release reais, erro/retry e conclusão. Gravação revisada após corrigir a velocidade dos motion values." />

<Clip name="scroll-header-refresh-ios" caption="Referência no iPhone 17 Pro físico / iOS 27.2: pull-to-refresh nativo, erro/retry e atualização ancorada. Gravação original preservada; não mostra o backend Web." />

## Reordenação interativa por identidade {#reorder}

A aplicação fornece chaves estáveis string/number e alvos DOM realizados, depois confirma um movimento por identidade. O Jolt posiciona vizinhos de alturas diferentes em layers privados e usa FLIP na reconciliação. Transforms da aplicação e press continuam separados. Há mouse, toque longo, scroll nas bordas e pickup/move/commit/cancel por teclado. Prefira handles dedicados para manter o scroll normal no restante do conteúdo. Espaço/Enter inicia ou confirma; setas/Home/End movem; Escape cancela. move/moveTo/moveUp/moveDown programáticos usam o mesmo commit. Mudanças de dados, identidade, remoção, geometria e ciclo de vida cancelam trabalho obsoleto. O renderer e a virtualização continuam fora do controlador.

```ts
const reorder = scope.reorder(list, {
  items: () => rows.map((row) => ({ key: row.id, target: row.element })),
  handle: '[data-reorder-handle]',
  onCommit: ({ key, beforeKey }) => moveItemBefore(key, beforeKey),
  edge: { size: 72, speed: 640 },
})
reorder.moveDown('album-1')
reorder.move('album-1', null)
reorder.refresh()
```

<Clip name="web-gestures-reorder-chromium" :width="760" caption="Chromium no macOS: reordenação por mouse, confirmação por teclado, scroll nas bordas e movimento programático por controles reais." />

<Clip name="reorder-ios" caption="Referência no simulador iOS: reordenação nativa com alturas diferentes, botões e scroll nas bordas. Gravação original preservada." />

## Ciclo de vida e evidências {#lifecycle}

Todos os controladores aceitam dispose e pausa/retomada pelo escopo. No Vue, use `useWebMotion(ref).use((scope, element) => ...)` para acompanhar troca de ref, KeepAlive e desmontagem. Separe a superfície de entrada da superfície animada no componente. Movimento reduzido preserva o destino e evita springs opcionais; o scheduler fica ocioso sem trabalho. Essas APIs não substituem a semântica da aplicação nem prometem FPS.

Execute `npm run web:gestures:typecheck`, `npm run web:gestures:test` e `npm run web:gestures`. Os testes distinguem reconhecimento sintético de input multitouch confiável no Chromium. Veja o [relatório de evidências](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-gestures.md). A adoção no Mavis está nas [#234](https://github.com/getcortexlabs/mavis-ui/issues/234), [#235](https://github.com/getcortexlabs/mavis-ui/issues/235), [#236](https://github.com/getcortexlabs/mavis-ui/issues/236) e [#237](https://github.com/getcortexlabs/mavis-ui/issues/237).
