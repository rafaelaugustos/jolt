# Montagem, coleções e scroll horizontal na Web

**Disponível desde a 0.1.0-rc.8.** As adições atendem às #334, #336 e #337. O runtime experimental `/web` funciona diretamente ou com Vue, sem exigir outro motor de animação nos componentes.

## Vue e Nuxt: esperar a conexão ao documento {#nuxt}

O hook `mounted` do Vue não garante que o elemento esteja no documento. Transições out-in e Suspense do Nuxt podem montar a página em um container destacado. `createViewportEnterDirective()` observa a conexão real antes de criar a entrada na viewport, sem timeout fixo nem polling por frame. Crie uma diretiva por aplicação/requisição SSR e aplique em elementos HTML.

```ts
import { createViewportEnterDirective } from '@rafaelaugusto/jolt/web/vue'

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.directive(
    'enter',
    createViewportEnterDirective({
      viewport: {
        keyframes: { opacity: [0, 1], y: [24, 0] },
        transition: { duration: 350 },
      },
    }),
  )
})
```

```vue
<template><section v-enter>Content</section></template>
```

A fábrica é segura em SSR e não emite estilos que escondam conteúdo. `runtime` permite compartilhar um contexto do host; `config` configura um contexto próprio e `viewport` define padrões. O valor da diretiva sobrescreve esses padrões; substitua o objeto ao mudar a receita. Desmontar cancela a espera, e desconectar libera apenas essa entrada. KeepAlive recria entradas incompletas/repetidas e mantém o histórico de entradas únicas concluídas. Alterar o binding reinicia esse histórico. Um ShadowRoot conhecido e seu host são observados; mover para uma árvore shadow fechada desconhecida fica fora desse contrato.

`useWebMotion().use()` e as transições de entrada também aguardam a inserção real. Troca de ref, desativação, cancelamento e descarte cancelam a espera. As chamadas imperativas `animate()`, `set()` e `runtime.viewportEnter()` continuam exigindo alvos montados. Resolva dados assíncronos antes do callback síncrono do escopo.

Em uma transição de página que usa apenas opacidade, com filhos assíncronos que alteram sua altura, declare `transform-origin: 0 0` na superfície, como no exemplo Nuxt. A origem percentual padrão muda quando a caixa cresce. Se o transform precisar de um pivô responsivo, use o contrato `observeGeometry()` do runtime; aguardar a inserção não concede controle sobre mudanças externas de geometria.

<Clip name="web-nuxt-attachment-chromium" caption="Chromium no macOS: consumidor Nuxt de produção com navegação out-in, retorno pelo histórico, KeepAlive e página assíncrona. Velocidade original; não é uma gravação de aparelho físico." />

<Clip name="vue-lifecycle-reference-ios" caption="Referência Vue existente no simulador iOS: entrada/saída e diretiva reais na demo. A referência não reproduz o defeito de DOM específico do Nuxt." />

O consumidor empacotado Nuxt 4.6.3/Vue 3.5.44 verifica SSR, histórico, inserção adiada, KeepAlive e movimento reduzido nos três navegadores. Interromper uma rota assíncrona durante out-in pode deixar o placeholder do Nuxt vazio mesmo com transição apenas em CSS; essa limitação do roteador não é corrigida pelo adapter. Cancelamento Vue e limpeza da espera têm testes separados. Veja o [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-attachment/README.md).

## Identidade do item ao reciclar o DOM {#items}

`animateItems()` controla entradas de linhas dinâmicas; não virtualiza dados nem reorganiza com FLIP. As chaves são strings, números finitos ou identidades de objetos, sempre únicas. Os elementos também precisam ser únicos e estar montados no documento do runtime. O lote inteiro é validado antes de substituir ownership. No Vue, atualize depois de `nextTick()` ou em um watcher post-flush.

```ts
const rows = runtime.animateItems([{ key: item.id, target: rowElement }], 'fadeInUp', {
  root: scroller,
  once: true,
  duration: 400,
})

// After the renderer has committed the next DOM rows:
rows.update(nextItems.map((item) => ({ key: item.id, target: elements.get(item.id)! })))
rows.forget(item.id)
rows.suspend()
rows.resume()
rows.dispose()
```

O padrão `once: false` acompanha a reentrada nativa. Com `once: true`, o histórico pertence à chave: uma nova chave no mesmo elemento entra; uma chave já vista em outro elemento recebe o destino. Objetos usam histórico fraco; chaves primitivas permanecem até `forget(key)`, `forget()` ou descarte. Limpe chaves antigas ao expulsar dados do cache. Reordenar o mesmo par chave/elemento preserva animações ativas; remover uma linha para apenas sua entrada. `stagger` é rejeitado porque cada linha entra independentemente; use `viewportEnter()` para grupos e `animateLayout()` para FLIP.

`pending`, `completed`, `suspended` e `disposed` descrevem o controller. Coleções vazias podem receber linhas depois. Um grupo de observers atende à coleção; observação única concluída se desconecta. Sem IntersectionObserver, com movimento reduzido ou observação desabilitada, o conteúdo permanece legível. Escopos adotam o controller; suspensão e descarte preservam canais novos da aplicação e feedback de pressão.

<Clip name="web-attachment-items-chromium" caption="Chromium no macOS: botões reais reciclam uma linha, adicionam um item, reordenam identidades conhecidas e limpam o histórico. A pressão da linha continua independente." />

<Clip name="lists-android" caption="Referência ListView nativa existente: linhas entram durante rolagem real no emulador Android. A API Web recebe chaves e elementos explícitos; não implementa virtualização." />

## Scroll horizontal LTR e RTL {#horizontal}

```ts
const offset = runtime.scrollValue(rail, { axis: 'x' })
const progress = offset.to([0, 600], [0, 1])
const link = runtime.scrollLinked(
  rail,
  indicator,
  { scaleX: [0.02, 1] },
  {
    axis: 'x',
    range: [0, 600],
    execution: 'auto',
  },
)
// After application geometry changes:
offset.refresh()
link.refresh()
// On teardown:
link.dispose()
progress.dispose()
offset.dispose()
```

O eixo padrão continua `y`. `axis: x` fornece pixels CSS normalizados a partir do início lógico: zero à esquerda em LTR e à direita em RTL, aumentando até a outra extremidade. `scrollLeft` negativo e overscroll são normalizados/limitados. Documento e elemento compartilham o contrato. Mudanças de direção, classes, estilos, conteúdo, tamanho e fontes invalidam a geometria; use `refresh()` para outras mudanças da aplicação.

O playback elegível usa `ScrollTimeline` no eixo escolhido. `execution: scheduler` força o fallback compartilhado; os testes comparam extremos e retorno em LTR/RTL. Composição, interrupção parcial, movimento reduzido e remoção da origem preservam as regras de ownership. Em repouso não há frames agendados. Flex invertido no eixo escolhido e escrita vertical são rejeitados antes de assumir propriedades. Pixels CSS, DIPs nativos e convenções RTL nativas não prometem medidas idênticas.

<Clip name="web-attachment-horizontal-chromium" caption="Chromium no macOS: input horizontal real avança e retorna em LTR e RTL; a barra segue o mesmo offset lógico." />

<Clip name="horizontal-scroll-ios" caption="Simulador iOS 26.2: gestos reais no ScrollView horizontal nativo controlam a barra. Referência do eixo x; não valida RTL do navegador nem desempenho em aparelho físico." />
