# Ciclo de vida e input na Web

Novo, ainda não publicado: [montagem Vue/Nuxt, entradas por identidade e scroll horizontal LTR/RTL](./web-collections).

**Disponível desde a 0.1.0-rc.7.** As issues #314–#317 acrescentam escopos filhos, acompanhamento do ponteiro, entrada na viewport e configuração contínua no Vue ao runtime experimental `/web`. Reutilizam valores, springs, playback e scheduler existentes. [Overlays, elementos compartilhados e receitas](./web-interactions) usam essa mesma organização de recursos.

## Recursos de uma interação {#scopes}

```ts
const owner = runtime.scope()
const input = owner.motionValue(0)
const spring = owner.springValue(input)
owner.bind(card, { x: spring, rotate: owner.map(spring, [0, 100], [0, 8]) })
input.set(100)
owner.dispose()
```

As factories adotam seus resultados. `add(handle)` adota um recurso existente uma vez; `borrow(handle)` mantém seu ciclo de vida com o dono original. Receber uma fonte em `springValue`, `map` ou `bind` não transfere sua propriedade. `map()` possui o mapeamento numérico/de cor resultante; `subscribe()` possui apenas a assinatura. Um recurso não pode pertencer a dois escopos no mesmo runtime. Descartar um escopo encerra seus handles, bindings e escopos filhos, preservando fontes emprestadas, runtime, press independente e canais assumidos por animações mais novas. Não chama `runtime.release(target)`.

`scope(setup)` e `use(setup)` desfazem recursos criados pelo escopo fornecido se a configuração síncrona falhar. Aguarde dados antes de configurar. Animações concluídas saem da contagem. `reset()` limpa e permite reutilizar; `dispose()` é permanente e idempotente. Adotar após o descarte lança erro; o chamador continua responsável por um recurso externo recusado por `add()`. O cleanup tenta todos os recursos mesmo se um deles lançar erro.

`suspend()` pausa handles/followers em execução, preserva inputs numéricos e mapeamentos criados pelo escopo e suspende controllers compatíveis. Não retoma handles que a aplicação já havia pausado. Recursos sem playback, como bindings e press diretos, são descartados. Registre uma factory em `use()` para recriar bindings, observers e assinaturas em `resume()`:

```ts
owner.use((active) => {
  active.bind(card, { x: spring })
  active.observeGeometry(card)
  active.press(card)
})
```

O runtime mantém o estado de repouso da superfície até o host liberá-la. Descartar um escopo não remove conteúdo nem restaura o CSS de outro dono. O scheduler mantém sua política de documento oculto. Não reinicie manualmente recursos de um escopo suspenso.

<Clip name="web-lifecycle-scopes-chromium" :width="900" caption="Chromium no macOS arm64: controles reais alteram duas springs, descartam o primeiro dono e mantêm o segundo ativo. O press do host continua disponível. Gravação na velocidade original." />

## Acompanhar uma região de ponteiro {#pointer}

```ts
const follow = owner.pointerFollow(region, {
  range: { x: [-90, 90], y: [-45, 45] },
  spring: { stiffness: 150, damping: 18 },
})
owner.bind(icon, { x: follow.x, y: follow.y })
owner.press(icon)
owner.animate(icon, 'pulse')
```

Use uma região estável separada da superfície animada. As coordenadas padrão são centradas em `[-1, 1]`; `range` define os limites da saída. `coordinates: 'pixels'` usa pixels CSS da viewport a partir do centro, limitados pelo range informado. `axis`, `rest`, `spring: false` e `disabled` são opções explícitas. O repouso padrão é zero e precisa caber nos limites. `x`/`y` são saídas somente leitura; use `owner.map()` para rotação, escala ou cor.

Mouse e caneta em hover atualizam o input sem captura do ponteiro ou bloqueio de ações padrão. Toque e contato da caneta não simulam hover. Saída/cancelamento retorna ao repouso; blur, documento oculto, superfície desabilitada/inert e movimento reduzido ativo estabilizam imediatamente. Restaurar movimento aguarda input novo. O controller oferece `update({ disabled })`, `refresh()`, `suspend()`, `resume()` e `dispose()`.

A geometria fica em cache, invalidada por resize, scroll capturado, alterações de classe/style nos ancestrais, mudanças de layout no DOM e fontes. Use `refresh()` para mudanças externas não observadas. Não há leitura de layout em cada evento de ponteiro. Translação e escala positiva alinhadas aos eixos são aceitas; rotação, skew, reflexão e perspectiva são recusados com orientação para usar um wrapper estável. Animar continuamente a própria região não fornece coordenadas estáveis. A top layer define a fronteira real dos ancestrais de renderização.

<Clip name="web-lifecycle-pointer-chromium" :width="900" caption="Chromium no macOS arm64: ponteiro real conduz uma spring com press/pulse independentes, movimento reduzido, retomada com input novo e descarte. Sem alegação de latência em aparelho físico." />

## Entrada na viewport {#viewport}

```ts
const entrance = owner.viewportEnter(cards, {
  root: scroller,
  threshold: 0.2,
  rootMargin: '0px',
  once: false,
  keyframes: { opacity: [0, 1], y: [24, 0] },
  transition: { duration: 400, stagger: 80 },
})
```

O padrão é `fadeInUp` uma vez. O grupo é fixo e não aceita identidades duplicadas; stagger segue sua ordem original mesmo com observações separadas. Para trocar o grupo, descarte o controller e crie outro. `root`, `rootMargin`, `threshold`, `once` e `disabled` configuram a observação. Presets, keyframes, transições spring/tween e delays existentes continuam valendo, sem timers na aplicação.

O conteúdo não é ocultado antes do setup ou no SSR. Sem IntersectionObserver, permanece legível. Movimento reduzido pula a entrada decorativa e finaliza os canais ainda pertencentes à entrada, incluindo opacidade. Não sobrescreve uma nova decisão de visibilidade da aplicação. Sair durante a reprodução cancela trabalho pendente e finaliza apenas canais ainda próprios; novos donos são preservados. O próprio transform da entrada cruzar o limiar não conta como novo scroll de saída. Scroll/resize/layout reais e `refresh()` invalidam essa proteção.

Observações únicas concluídas desconectam; modo repetido rearma após a saída. Remoção, descarte, desabilitação, documento oculto e suspensão invalidam callbacks pendentes. Reativar observa a geometria atual. Jolt não altera foco, ordem de tabulação, navegação ou visibilidade da aplicação. Animações CSS concorrentes precisam de wrapper separado ou propriedade explícita.

<Clip name="web-lifecycle-viewport-chromium" :width="900" caption="Chromium no macOS arm64: scroll real dispara entradas ordenadas, reentrada, remoção e movimento reduzido. O observer não exige CSS que mantenha o conteúdo oculto." />

## Configuração contínua no Vue {#vue}

```ts
import { shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const target = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(target)
motion.use((scope, element) => {
  const pointer = scope.pointerFollow(element.parentElement!)
  scope.bind(element, { x: scope.map(pointer.x, [-1, 1], [-40, 40]) })
  scope.observeGeometry(element)
  scope.press(element)
})
```

Chame `useWebMotion` no setup. `use()` registra configuração síncrona sem acessar DOM antes da montagem. Recebe todas as factories do escopo, incluindo valores, bindings, geometria/scroll, ponteiro/viewport e shared layout. Executa uma vez para a ref montada; limpa em null, substituição ou desativação e executa novamente na ativação do KeepAlive. Estado contínuo criado ali é recriado; mantenha estado persistente da aplicação fora do callback. O removedor retornado encerra apenas essa configuração.

As escritas visuais não passam pelo render do Vue. Assine explicitamente apenas se precisar de um indicador reativo. Enter/leave finitos mantêm o comportamento existente: leave pode preservar sua superfície depois de a ref ficar null, enquanto input contínuo é removido imediatamente. Métodos imperativos de animação, set, press e layout exigem ref montada.

Para uma superfície declarada pelo host, use `useWebMotion(target, { runtime: hostRuntime })`. O host fornece ref e runtime compatíveis, sem descoberta de `$el` ou segundo contexto assumindo o elemento. O adapter descarta apenas seus recursos, preservando runtime e press do host. `stop()` emprestado afeta apenas seus handles finitos; recursos contínuos pertencem ao cleanup de `use()`. Configure o runtime pelo host. `WebAnimation.stop(properties, { layer })` cancela canais selecionados ainda pertencentes ao handle.

Imports e setup no servidor não agendam trabalho de browser nem criam estado global de aplicação. `/vue` nativo mantém seu contrato; a adaptação da superfície portátil do Mavis é separada.

<Clip name="web-lifecycle-vue-chromium" :width="900" caption="Chromium no macOS arm64: controles Vue alteram uma spring, executam pulse, desativam/reativam KeepAlive, substituem a ref e desmontam. Escritas contínuas dispensam render Vue por frame." />

## Referências nativas e validação {#verification}

Estas demos existentes mostram springs, ciclo de vida e entradas nativas; não executam APIs de ponteiro ou IntersectionObserver do browser.

<Clip name="live-springs-ios" caption="Demo NativeScript existente em inglês, no simulador iOS: springs persistentes acompanham novos destinos. Referência nativa; não é hover Web nem aparelho físico." />
<Clip name="motion-controllers-ios" caption="Demo existente em inglês no simulador iOS: estados, escopos e desmontagem/remontagem. Referência de ciclo de vida nativo, sem medição em aparelho físico." />
<Clip name="vue-lifecycle-reference-ios" caption="Recorte da demo NativeScript Vue existente em inglês no simulador iOS: entrada e remoção de linhas. Abertura omitida, velocidade original. Referência nativa, não observação da viewport Web." />

Execute `npm run web:lifecycle:test`, `npm run web:lifecycle:typecheck`, `npm run package:check`, `npm run docs:check-media` e `npm run docs:build`. O [relatório](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md) informa engines e reprodução. Testes e vídeos não comprovam aceleração universal, FPS mobile ou latência até o display.
