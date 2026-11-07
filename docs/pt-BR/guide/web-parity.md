# Gravidade, haptics, sensores, glass e galeria na Web

O [candidato de interação e profundidade](./interaction-depth) para RC.12 acrescenta drop zones, áudio/cues, inspeção e contratos Web de paths, 3D e sombras. Ainda não faz parte da RC.11.1.

## Auditoria da RC.10 {#rc10-audit}

A RC.10 publicada inclui os PRs #358, #365, #372 e #379. A [matriz completa de exports](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/capability-matrix.json) e a [auditoria de contratos](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-web-audit.md) distinguem disponibilidade de paridade funcional. `npm run parity:check` verifica todos os exports de execução e as propriedades de keyframes. Ainda há diferenças em movimento por caminho, rotação 3D, sombras/profundidade, replay/inspector e validação de hardware em navegadores móveis reais. As gravações desktop abaixo não comprovam esse aceite físico.

**Disponível desde a 0.1.0-rc.10.** Este lote cobre [#373–#378](https://github.com/rafaelaugustos/jolt/issues/373) dentro da [#236](https://github.com/rafaelaugustos/jolt/issues/236) e avança a parte Web da [#117](https://github.com/rafaelaugustos/jolt/issues/117). `/web` pode ser importado durante SSR; crie o runtime e seus alvos montados no cliente. Os recursos criados pelo escopo acompanham sua suspensão, retomada e descarte.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Gravidade finita {#gravity}

`animate()` aceita `type: 'gravity'` em `x`, `y` e valores numéricos de movimento. Usa o mesmo compilador balístico finito do nativo: aceleração positiva em direção ao destino, restituição em `[0, 1)`, velocidade explícita ou herdada com sinal, um destino, atrasos/repetições e camadas independentes. Pausa, retomada, busca, interrupção, movimento reduzido e validação transacional seguem as regras existentes. Uma animação pausada transmite velocidade zero. Este recurso é separado de `physicsWorld()`.

```ts
const fall = scope.animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.6,
  },
)
fall.pause()
fall.progress = 0.3
fall.play()
const height = scope.motionValue(0)
scope.animate(height, 280, { type: 'gravity', velocity: -600 })
```

<Clip name="web-gravity-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais fazem queda, pausa/retomada, arremesso e interrupção balística. Velocidade original." />
<Clip name="gravity-ios" caption="Simulador iOS, demo nativa em inglês: toques reais fazem queda, arremesso, interrupção e pausa/retomada. Gravação existente revisada, em velocidade original; sem medição de desempenho físico." />

## Haptics opcionais {#haptics}

`haptic()` retorna `backend: 'vibration' | 'none'` e `status: 'requested' | 'unavailable' | 'blocked' | 'disabled'`. `requested` confirma a solicitação ao navegador, não a vibração física. A [Vibration API](https://www.w3.org/TR/vibration/) oferece durações curtas de 10/20/30 ms, sem equivalência com as intensidades nativas light/medium/heavy. É necessário um documento visível e ativação prévia do usuário; movimento reduzido silencia as solicitações. Não há vibração forçada como alternativa. O feedback de press dispara uma vez por contato ou tecla aceitos; controles desabilitados/em carregamento não disparam. Na animação, o padrão é a chegada; `times` crescentes em `(0, 1]` excluem o atraso inicial. Pausar reagenda os pontos; buscar consome os pontos ultrapassados, interromper os cancela e atrasos maiores que 100 ms são descartados.

```ts
const result = motion.haptic('light')
scope.press(button, { scale: 0.96 }, { haptic: 'light' })
scope.animate(
  card,
  { x: 240 },
  {
    duration: 800,
    haptic: { style: 'medium', times: [0.5, 1] },
  },
)
```

<Clip name="web-haptics-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: solicitações reais por botão/animação e pausa/retomada. O vídeo de desktop não comprova vibração nem intensidade tátil nativa." />
<Clip name="haptics-android-device" caption="ASUS_Z017DC físico, Android 8, interface em inglês: toques reais solicitam feedback nativo. Flashes indicam solicitações; o vídeo não transmite a sensação tátil. Gravação existente revisada." />

## Sensores de rotação e gravidade {#sensors}

`sensor('rotation')` fornece XYZ relativos em **radianos**, quaternion Hamilton normalizado (`xyzw`) e `recenter()`. `sensor('gravity')` fornece aceleração gravitacional para baixo em **m/s²**; um aparelho deitado com a tela para cima tem Z negativo. A gravidade é a aceleração linear menos a aceleração com gravidade; se uma leitura faltar, o Jolt não usa a aceleração total como substituta. As coordenadas seguem a interface por padrão; `device` conserva os eixos do aparelho. A [Device Orientation and Motion API](https://www.w3.org/TR/orientation-event/) exige contexto seguro e pode exigir permissão. Chame `requestPermission()` diretamente na interação do usuário; criação e retomada nunca abrem uma solicitação. A presença da API não comprova hardware: `available` fica verdadeiro após uma amostra válida; dois segundos sem dados úteis produzem `unavailable` / `no-data`. Também existem `permission-required`, `denied`, `idle`, `starting`, `active`, `paused` e `disposed`. Os timestamps são dos eventos monotônicos do navegador, sem promessa de timestamp do hardware. `interval: 'auto' | 5–1000` limita a entrega, não configura a frequência física. Bindings e assinaturas iniciam a aquisição, compartilhada por evento/documento. Remover o último consumidor, suspender o escopo, ir ao fundo, reduzir movimento ou descartar interrompe a aquisição. A rotação preserva a pose relativa na retomada. Use `reducedMotion: 'continue'` apenas para entrada intencional não decorativa.

```ts
const rotation = scope.sensor('rotation')
const gravity = scope.sensor('gravity', { coordinates: 'interface' })
scope.bind(card, {
  rotate: scope.map(rotation.z, [-Math.PI, Math.PI], [-180, 180]),
  x: scope.map(gravity.x, [-10, 10], [-80, 80]),
})
enableButton.onclick = () => {
  void rotation.requestPermission()
  void gravity.requestPermission()
}
rotation.recenter()
console.log(gravity.snapshot())
```

<Clip name="web-sensors-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: controles reais de ativação, pausa/retomada e recentralização com estado sem dados. Sem amostras físicas ou movimento simulado na gravação." />
<Clip name="device-sensors-physical-ios" caption="iPhone 17 Pro físico, iOS 27.2, demo Release em inglês: rotação e gravidade reais do Core Motion movem views nativas. Captura USB revisada em velocidade original; não comprova sensores do navegador nem calibração dos eixos." />

## Glass controlado {#glass}

`glass()` fornece `set`, `animate`, `stop`, `suspend`, `resume`, `dispose` e `snapshot`. O backend real é `css-backdrop-filter` ou `solid`. Falta de suporte, transparência reduzida e cores forçadas usam fundo sólido; não há promessa de refração ou fusão do UIKit Liquid Glass. O filtro atua no fundo e mantém os controles filhos interativos. Intensidade em `[0, 1]`, raio de `1–64` pixels CSS. O descarte restaura apenas estilos ainda pertencentes ao efeito e preserva alterações da aplicação. Evite dois donos de blur/glass no mesmo canal de fundo.

```ts
const surface = scope.glass(panel, {
  amount: 0.7,
  radius: 24,
  tint: 'rgba(30, 38, 58, 0.35)',
  fallbackColor: '#202638',
})
scope.add(surface.animate(1, { duration: 400 }))
console.log(surface.snapshot().backend)
```

<Clip name="web-glass-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: desfoque real do fundo, intensidade pausada e botão filho interativo. Filtro CSS, sem Liquid Glass nativo." />
<Clip name="glass-legacy-ios" caption="Simulador iOS 18.6, interface em inglês: toques reais controlam superfícies nativas de blur e movimento. Gravação revisada; sem fusão Liquid Glass ou alegação de aparelho físico." />

## Retorno de rota por gesto {#navigation}

`interactiveNavigation()` usa o motor de gestos existente e uma camada própria de translação. Por padrão, o gesto horizontal começa nos primeiros 32 pixels CSS da borda; o vertical usa toda a superfície. Posição e velocidade ao soltar escolhem cancelar ou sair. Uma mola parte da pose e velocidade atuais; após a saída, `commit` chama o roteador uma vez. Retornar `false`, rejeitar ou atingir o timeout traz a superfície de volta. `cancel()` reverte a saída em andamento; `back()` atende botão e teclado. O roteador precisa respeitar o sinal de cancelamento e resolver após confirmar a rota. O Jolt não desfaz uma rota já alterada, não intercepta o histórico, não implementa o retorno preditivo do sistema e não administra o foco da rota automaticamente. O descarte remove a contribuição visual e os listeners próprios.

```ts
const backGesture = scope.interactiveNavigation(page, {
  axis: 'x',
  edgeWidth: 32,
  canBegin: () => !editorIsBusy(),
  commit: ({ animated, signal }) => routerBack({ animated, signal }),
})
backButton.onclick = () => backGesture.back()
// backGesture.cancel()
```

<Clip name="web-navigation-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: arrastos reais na borda cancelam o retorno curto e concluem o longo uma vez. Roteamento da aplicação, sem alegação de gesto do sistema." />
<Clip name="interactive-navigation-ios" caption="Simulador iOS 26.2, interface em inglês: toques e arrastos reais cancelam e concluem retornos nativos. Gravação existente revisada em velocidade original; não é aparelho físico." />

## Galeria e retorno à miniatura por chave {#gallery}

`sharedNavigationEntry()` coordena uma entrada e o retorno, com as mesmas restrições de snapshots do shared-layout. `returnFrom(intent)` captura a pose de zoom/arrasto antes da troca de rota e transmite a velocidade vertical ao soltar. Um retorno rejeitado chama `intent.cancel()` e mantém o visualizador utilizável. Pedidos repetidos compartilham a operação. `resolveListTarget()` relê o índice atual, pede ao virtualizador que materialize o item, confere a chave e exige um retângulo estável em dois frames de layout. Não guarda células ou índices antigos. O resolver recebe sinal de cancelamento e tem prazo padrão de 1500 ms, máximo de 5000 ms. Item excluído, ausente ou expirado conclui a rota sem voo compartilhado e usa `fallbackFocus`; torne esse destino focável. A miniatura atual direciona o foco ao botão/link que a contém. Os callbacks de rota pertencem à aplicação e devem respeitar cancelamento; cancelar a animação não desfaz navegação confirmada. Materialização e decodificação da imagem ficam no callback da aplicação. Os vídeos mostram botão de retorno, zoom focal, arrasto cancelado/concluído, reciclagem e exclusão. Isso avança a #117 sem declarar concluída sua validação nativa restante de acessibilidade/aparelhos.

```ts
import { resolveListTarget } from '@rafaelaugusto/jolt/web'
const entry = scope.sharedNavigationEntry(region, {
  tag: photoKey,
  source: () => thumbnailForKey(photoKey),
  detail: () => detailImage,
  back: ({ animated, signal }) => showCollection({ animated, signal }),
  returnTarget: {
    key: photoKey,
    resolve: (context) =>
      resolveListTarget(context, {
        container: list,
        indexOf: (key) => photos.findIndex((photo) => photo.id === key),
        scrollToIndex: (index, { signal }) => realizeRow(index, signal),
        viewForKey: thumbnailForKey,
        keyOf: (element) => element.dataset.key,
      }),
    fallbackFocus: () => collectionHeading,
  },
})
await entry.open(({ animated, signal }) => showPhoto({ animated, signal }))
scope.zoomable(detailImage, {
  viewport,
  onDismiss: (intent) => {
    void entry.returnFrom(intent)
  },
})
backButton.onclick = () => {
  void entry.back()
}
```

<Clip name="web-gallery-parity-chromium" :width="900" caption="Chromium no macOS, interface em inglês: miniatura, zoom focal, pan, arrasto cancelado/concluído, rolagem virtual e foco após exclusão. Velocidade original." />
<Clip name="gallery-ios" caption="Simulador iOS 26.2, interface em inglês: multitoque real, duplo toque interrompido, arrasto cancelado, retorno após reordenação e alternativa após exclusão. Gravação revisada em velocidade original." />

## Validação e reprodução {#validation}

Execute `npm run web:parity:typecheck`, `npm run web:parity:test`, `npm run build`, `npm run core:check`, `npm run package:check`, `python3 benchmarks/verify-sensor-math.py --web`, `npm run docs:check-media` e `npm run docs:build`. A suíte cobre Chromium, Firefox e WebKit. Entradas injetadas de permissão/sensor/vibração são fixtures de teste, sem comprovação de hardware físico. Reproduza os vídeos reais do navegador com `node benchmarks/web-parity/record.mjs`; a captura nativa segue `CONTRIBUTING.md`. A adoção no Mavis permanece em uma frente separada.

[Validação do Web mobile](mobile-web.md)
