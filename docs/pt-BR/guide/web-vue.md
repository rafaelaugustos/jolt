# Movimento Vue na Web

A [composição portável](./portable-composition), disponível em `0.1.0-rc.12.1`, adiciona equivalentes Web viáveis com definições e ciclo de vida compartilhados. A validação de sensores no navegador físico segue pendente na #385.

**Também na RC.7:** [escopos, ponteiro/viewport e configuração contínua no Vue](./web-lifecycle), além de [geometria de overlays, elementos compartilhados, receitas e diagnóstico](./web-interactions). A adoção no Mavis permanece separada.

**Desde a RC.7:** [cores, bordas, pintura contínua, tamanho real, FLIP e cenas com seek](./web-visual) ampliam este runtime. As APIs Web continuam experimentais; a paridade completa segue na [#236](https://github.com/rafaelaugustos/jolt/issues/236).

A entrada experimental `@rafaelaugusto/jolt/web/vue` está na **0.1.0-rc.5** e conecta uma ref DOM declarada ao [runtime Web](./web-runtime). Instale Vue 3.5 separadamente. `/vue` continua sendo a integração NativeScript; `/web` imperativo não instala Vue. Veja a [instalação](./install#experimental-web-candidate).

<Clip name="web-vue-chromium" :width="720" caption="Chromium 156 no macOS arm64: ponteiro e teclado reais interrompem a saída, pressionam o card, alteram a escala da aplicação enquanto pressionado, substituem a superfície e completam ocultar/mostrar. Gravação do navegador em velocidade original; não mede desempenho em aparelho físico." />

## Uma superfície DOM declarada {#declared-surface}

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const visible = ref(true)
const surface = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(surface, {
  initial: { opacity: 0, y: 24 },
  enter: { keyframes: { opacity: 1, y: 0 }, transition: { duration: 220 } },
  leave: { keyframes: { opacity: 0, y: -12 }, transition: { duration: 160 } },
})
</script>

<template>
  <button @click="visible = !visible">Toggle</button>
  <Transition v-bind="motion.transition" appear>
    <div v-if="visible" ref="surface">Content</div>
  </Transition>
</template>
```

Chame o composable sincronamente no `setup`. O runtime é criado sob demanda para o documento do alvo. Importação e renderização SSR não precisam de globais do navegador. `animate`, `set`, `press` e `stop` usam a ref DOM montada atual; chamadas antes da montagem ou após o descarte do escopo lançam erro. `configure` segue a política Web. Instâncias de componentes, descoberta por `$el` e refs genéricas de componentes compostos ficam fora deste contrato experimental.

O objeto `transition` fornece `css: false`, entrada, saída e cancelamento. Vincule-o ao `Transition` do Vue e mantenha hooks da aplicação como `@before-leave` e `@after-leave`. As receitas usam os mesmos keyframes e transições do runtime imperativo e precisam ter duração finita. O adaptador não adiciona solver nem loop por frame.

## Ciclo de vida e composição {#lifecycle}

- `initial` é aplicado uma vez por elemento de entrada, após inserção e antes do playback. Reentrada na mesma superfície `v-show` continua do estado atual.
- Uma ref `v-if` pode ficar nula durante a saída. O elemento permanece montado até o playback atual terminar ou ser interrompido; uma interrupção não pode retê-lo indefinidamente.
- O cancelamento do Vue invalida a geração antes de parar o movimento. Promises antigas não concluem uma saída nova nem removem um elemento que reapareceu. `v-if` pode criar outra superfície; `v-show` pode reutilizá-la.
- A troca da ref libera o alvo anterior, exceto durante sua saída atual. Descartar o escopo cancela trabalhos, remove listeners de pressão e efeitos e ignora conclusões antigas.
- Animação da aplicação e pressão usam o mesmo contexto: 1.1 × 0.96 = 1.056. Mudar a base para 1.2 enquanto pressionado resulta em 1.152; soltar restaura 1.2. Crie outro binding de pressão para um novo elemento DOM.
- Mudanças de movimento reduzido seguem o runtime: transforms chegam ao destino e opacidade mantém a timeline finita. Valem os mesmos limites de CSS; não dispute os estilos de movimento controlados.

O componente/aplicação controla foco, `inert`, `aria-hidden`, ativação e restauração do foco ao acionador. Use os hooks do Vue para isso; Jolt não movimenta o foco nem fornece semântica de acessibilidade. Esta é uma base para o Mavis Reveal; sua migração e a API de refs portáteis da aplicação continuam em tarefas separadas.

## Verificação e limites {#verification}

`npm run web:integration:test` verifica interrupção, controles, troca de superfície, movimento reduzido, pressão e descarte repetido em Chromium, Firefox e WebKit. `npm run package:check` instala o tarball real em consumidores imperativo e Vue, verifica declarações estritas, SSR direto/Vite, playback no navegador e bundles nativos de produção.

O [relatório de integração](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-integration.md) registra versões, workloads e limites de regressão. Preparar 100 cards com spring ocupa a thread principal de forma mensurável; os testes não garantem FPS ou latência em aparelhos móveis. A prova de bloqueio exclusiva do Chromium usa frames apresentados e trace do navegador, não contagem de rAF.

O comportamento nativo de `/vue` foi preservado. A gravação existente serve de referência nativa, não demonstra código Web executando no native:

<Clip name="vue" caption="Demo existente NativeScript Vue em inglês no simulador iOS: JoltTransition remove e restaura uma linha. Referência de playback nativo; não é aparelho físico nem tela Mavis compartilhada." />

O mesmo lote corrige a apresentação de layers finalizados no Android e verifica a consistência no iOS:

<Clip name="layer-cleanup-android" caption="Emulador Android 16 / API 36, auditoria Layers em inglês iniciada por toque ADB real: remover feedback durante a soltura restaura a base não unitária, preserva base em movimento, outro layer e movimento reduzido. Verificação dos valores nativos apresentados. Velocidade original; evidência de correção em emulador." />
<Clip name="layer-cleanup-ios" caption="Simulador iOS 26.2, auditoria Layers em inglês iniciada por toque XCTest real: os mesmos casos de remoção, composição e movimento reduzido consultam valores de apresentação do Core Animation. Velocidade original; não é gravação de iPhone físico." />
