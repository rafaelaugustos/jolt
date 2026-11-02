# Orquestração e controle na Web

Adições experimentais após **0.1.0-rc.7**, acompanhadas pelas #327–#333. Estas APIs usam as mesmas trajetórias portáteis e regras de agendamento do playback nativo. A entrada do navegador continua independente de NativeScript e frameworks; o adapter opcional de Vue controla o ciclo de vida por `motion.use()` e seu escopo filho.

## Valores e progresso do playback {#values}

`animate(value, destinoOuKeyframes, transição)` aceita um valor numérico mutável do mesmo contexto. `null` lê o canal atual. A substituição herda posição e velocidade; layers escalares nomeados somam suas contribuições, inclusive quando o valor alimenta escala. Um layer concluído mantém o destino; pará-lo remove sua contribuição. `set(value, número)` limpa playback e layers. `stop(value)` mantém o valor combinado. Valores derivados ou de outro contexto são rejeitados antes da troca de ownership.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const scope = motion.scope()
const x = scope.motionValue(0)
scope.bind(card, { x })
const travel = scope.animate(x, [0, 240, 100], { duration: 1200 })
scope.animate(x, 24, { layer: 'accent', duration: 200 })
const progress = scope.playbackProgress(travel)
scope.bind(meter, { scaleX: progress })
travel.pause()
travel.progress = 0.5
travel.play()
// Remova somente esta contribuição aditiva:
motion.stop(x, { layer: 'accent' })
```

`playbackProgress(handle)` é somente leitura e usa o relógio existente. Pausa, seek, conclusão e cancelamento chegam aos mapeamentos e bindings. Descartar o progresso mantém o playback ativo. É necessária uma duração finita conhecida; uma timeline imperativa pode conhecê-la apenas quando todos os participantes forem ativados. Valores e progresso sem observadores não criam loop por frame. Observadores e bindings usam o scheduler compartilhado sob demanda; assinaturas não criam outro playback visual.

<Clip name="web-orchestration-values-chromium" caption="Chromium no macOS: controles reais reproduzem keyframes, adicionam/removem um layer, pausam, fazem seek e mudam o destino com spring. A barra usa playbackProgress; gravação de navegador." />

<Clip name="motion-values-ios" caption="Referência no simulador iOS: um motion value anima sheet, escala da página e backdrop. Gravação nativa existente reutilizada, com comportamento de playback preservado." />

## Decay e snap {#decay}

`decay(elemento, { x?, y? }, { friction?, snap? })` compila velocidade em pixels CSS/segundo para playback WAAPI finito. Friction deve ficar entre 0 e 1; valores maiores percorrem mais distância. Snap aceita uma lista para ambos os eixos ou `{ x: [...], y: [...] }`; vence o destino mais próximo da projeção. A velocidade fornecida é explícita. Ao mudar o destino, a posição atual é preservada e os outros canais continuam. Use a velocidade medida na soltura do gesto para manter continuidade. Pausa, retomada, seek, stop e movimento reduzido seguem o contrato normal.

<Clip name="web-orchestration-decay-chromium" caption="Chromium no macOS: arraste e soltura reais, snap projetado, pausa/retomada e cancelamento. O exemplo fornece o input; decay controla a trajetória após soltar." />

<Clip name="orchestration-decay-ios" caption="Referência no simulador iOS: decay livre e snap nativos. Captura original reutilizada sem o início de abertura do app, mantendo a velocidade de reprodução." />

## Sequências e timelines imperativas {#groups}

As duas APIs aceitam posições absolutas, `<` para a ativação anterior e offsets com sinal a partir da chegada visual. Alvos futuros recebem o primeiro keyframe absoluto na preparação; valores null e relativos são resolvidos na ativação. Offsets negativos exigem previsão de chegada de animate/decay. Factories executam na thread JavaScript e devem retornar uma animação; erros de preparação rejeitam a conclusão e cancelam os recursos do grupo.

```ts
const scene = scope.timeline([
  [card, { x: 240 }, { duration: 1400 }],
  [x, [0, 1], { duration: 1400, at: '<' }],
  { at: 800, run: () => scope.animate(badge, 'fadeIn') },
])
scene.pause()
scene.play()
await scene.finished

const steps = scope.sequence([
  [card, 'fadeInUp'],
  [badge, 'fadeIn', { at: '-100' }],
  () => scope.decay(card, { x: 400 }, { snap: [0, 240] }),
])
// Para os participantes ativos e impede factories futuras:
steps.stop()
```

`sequence()` oferece reprodução ordenada/sobreposta e stop. `timeline()` também aceita tuplas numéricas e factories controláveis, pausando participantes e ativações futuras em conjunto. Ela retoma apenas os filhos que pausou. O tempo com o documento oculto não conta no agendamento futuro; uma pausa manual continua valendo após retornar. Cancelar impede factories pendentes. Escopos cancelam sequências ao suspender e pausam timelines. O grupo imperativo não tem seek: use `seekableTimeline()` para cenas declarativas. A duração pode ser desconhecida ou infinita enquanto os participantes não forem conhecidos.

<Clip name="web-orchestration-groups-chromium" caption="Chromium no macOS: a pausa segura o checkpoint futuro; retomar o ativa após o tempo restante. A segunda execução sobrepõe etapas; cancelar remove o trabalho futuro." />

<Clip name="orchestration-timeline-ios" caption="Referência no simulador iOS: etapas nativas em ordem e sobrepostas. Captura real reutilizada sem o início de abertura do app, na velocidade original." />

<Clip name="controlled-playback-ios" caption="Referência no simulador iOS: rota, valor, ripple, progresso e checkpoint nativos pausam e retomam juntos. Não é evidência de desempenho em aparelho físico." />

## Estados nomeados e referências substituíveis {#states}

`current` é o último estado solicitado; `settled`, o último concluído com sucesso. As definições contêm destinos absolutos e transições por alvo nomeado. Entradas inválidas são rejeitadas antes de alterar ownership. Substituições herdam movimento; canais antigos omitidos mantêm o valor atual. `attach()` ou um callback estável de `ref(nome)` muda a superfície declarada: o filho antigo para, o novo parte da apresentação atual e a conclusão aguarda sua chegada. Um estado já concluído é aplicado imediatamente à nova superfície. `null` desconecta; alvos ausentes são ignorados. Outros owners sobrevivem à limpeza.

```ts
const states = scope.motionStates(
  { card, badge: null as HTMLElement | null },
  {
    idle: { card: { x: 0, scale: 1 }, badge: { opacity: 0 } },
    active: { card: { x: 240, scale: 1.1 }, badge: { opacity: 1 } },
  },
  { transition: { duration: 600, badge: { duration: 180 } } },
)
const transition = states.to('active')
states.attach('badge', mountedBadge)
states.attach('card', replacementCard)
await transition.finished
// No setup do Vue, crie os recursos em motion.use((scope, element) => { ... }).
// Desmontagem definitiva:
scope.dispose()
```

<Clip name="web-orchestration-states-chromium" caption="Chromium no macOS: interrompe trabalho com erro, pausa, troca o elemento do card, retoma e conclui. O novo elemento participa da conclusão do mesmo estado." />

<Clip name="motion-controllers-ios" caption="Referência no simulador iOS: upload/erro/retry/sucesso, controles de escopo e desmontagem/remontagem nativos. Gravação existente em inglês reutilizada para o contrato nativo equivalente." />

## Validação e integração {#validation}

Execute `npm run web:orchestration:test` para os testes em Chromium, Firefox e WebKit e `npm run web:orchestration` para a demo (`?demo=values`, `decay`, `groups`, `states` ou `stroke`). Consumidores do tarball imperativo/Vue exercitam as sete APIs, imports seguros em SSR e bundles nativos. Os vídeos demonstram comportamento, não elegibilidade ao compositor ou FPS em aparelho físico. A adoção no Mavis é uma integração separada; receitas compartilhadas da aplicação preservam a intenção independente da plataforma.

## Desenho SVG controlado {#svg}

`drawPath(geometriaSvg, { progress? })` cria um controlador de desenho com ownership (#333). Seu `animate()` aceita destino normalizado ou keyframes e retorna controles finitos de pausa, retomada, seek e stop. Anime para `0` para apagar ou reverter um desenho em andamento; a substituição parte da posição e velocidade atuais. `playback.progress` é o progresso temporal; `drawing.snapshot().progress` é a fração normalizada visível. A limpeza de um handle antigo preserva o novo desenho.

```ts
const drawing = scope.drawPath(connectionPath, { progress: 0 })
const playback = drawing.animate(1, {
  duration: 1100,
  ease: [0.16, 1, 0.3, 1],
})
playback.pause()
playback.progress = 0.5
playback.play()
const reverse = drawing.animate(0, 'snappy')
await reverse.finished
```

O driver mede a geometria em unidades SVG e respeita `pathLength`, sem assumir comprimento fixo nem tratar porcentagens CSS como progresso do traçado. A WAAPI reproduz a trajetória de dash preparada; observar o progresso usa o scheduler compartilhado. Desenhar stroke pode exigir pintura no navegador e não promete aceleração pelo compositor. Consulte o [modelo de dash do SVG](https://www.w3.org/TR/SVG2/painting.html#StrokeDashing).

Use um contorno contínuo por desenho. Paths, linhas, polylines, polígonos, círculos, elipses e retângulos usam a geometria medida; separe contornos compostos em alvos distintos. Comprimento zero conclui imediatamente e permanece invisível. Destinos ficam em 0–1 e o overshoot visual da spring é limitado a essa faixa. Repetições finitas e limites de keyframes seguem o playback Web; esta API não faz morph de `d`. O validador portátil mantém os limites nativos de 20.000 caracteres e 256 comandos normalizados.

O controlador assume dasharray, dashoffset e opacidade do stroke até o descarte, restaurando os estilos originais e preservando alterações inline externas posteriores. Fill, transform, input e acessibilidade continuam com o host. Remova animações CSS concorrentes desses canais. Atributos geométricos e resize são observados; `refresh()` mede novamente após alterações da aplicação sem reiniciar o tempo normalizado. Atualizações explícitas inválidas são rejeitadas; geometria inválida detectada por observer descarta o desenho com segurança. Remoção, inclusive em shadow roots, descarte do escopo e movimento reduzido liberam ou concluem o trabalho correspondente.

O Lume mantém `vEnter`, `useContentTransition`, `useListLayout` e `useConnectionMotion` para integração Vue e coreografia. Apenas o desenho SVG manual passa a ser responsabilidade deste driver. A altura animada do Reveal continua sendo adoção no Mavis da animação de tamanho existente, não física ausente no Jolt.

<Clip name="web-orchestration-stroke-chromium" caption="Chromium no macOS: controles reais desenham três conexões SVG, pausam, fazem seek, alteram a geometria, revertem durante o movimento e ativam movimento reduzido. Tempo original; sem imagens fabricadas." />

<Clip name="shapes-ios" caption="Referência no simulador iOS: desenho nativo real com pausa/retomada e movimento reduzido, junto do exemplo nativo de morph. Gravação existente em inglês; esta API Web cobre stroke, não morph." />
