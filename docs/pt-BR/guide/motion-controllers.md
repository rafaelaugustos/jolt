# Escopos e estados de movimento

`motionScope()` dá a uma página, componente ou item reciclado um dono para animações e subscriptions. `motionStates()` coordena estados visuais nomeados entre várias views, com interrupção. Os dois reutilizam os drivers nativos existentes, sem adicionar um loop JavaScript por frame.

<Clip name="motion-controllers-ios" caption="Estados de upload, erro, nova tentativa e sucesso, controles do scope e montagem/desmontagem no simulador iOS." />

## Controle do ciclo de vida

```ts
import { motionScope, followKeyboard, zoomable } from '@rafaelaugusto/jolt'

const motion = motionScope()
motion.animate(icon, 'spin', { repeat: Infinity })
motion.press(button)
motion.use(() => followKeyboard(composer))
motion.use(() => zoomable(photo, { viewport }))

// Na destruição real do componente:
motion.dispose()
```

O escopo oferece `animate()`, `decay()`, `sequence()`, `press()`, `drag()` e `states()`. `add(handle)` registra uma função de limpeza ou objeto com `stop()` ou `dispose()`; se ambos existirem, usa `dispose()`. Cada recurso pertence a um único escopo. Registrar o mesmo recurso novamente no mesmo escopo não duplica a limpeza. Animações com uma promise `finished` deixam o escopo quando terminam.

`dispose()` é idempotente e cancela animações aguardando carregamento, delays, passos futuros de sequências, playback e subscriptions registradas. Handles cancelados resolvem `false`. O escopo encerra seus próprios handles; animações de outros donos na mesma view continuam. Se uma limpeza lançar erro, as demais ainda executam e os erros são reunidos em um `AggregateError`.

Só o trabalho registrado pertence ao escopo. Para um timer, use `motion.add(() => clearTimeout(timer))`. Factories personalizadas precisam desfazer sua própria preparação parcial se lançarem erro antes de retornar um recurso.

## Suspender, reutilizar e destruir

| Operação    | Comportamento                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suspend()` | Pausa handles com `pause()/play()`, preservando os que já estavam pausados. Desconecta subscriptions de `use()`. Cancela recursos sem playback, inclusive sequências. |
| `resume()`  | Retoma apenas o que o escopo pausou e recria subscriptions de `use()`. Sequências canceladas não reiniciam.                                                           |
| `reset()`   | Limpa o trabalho atual e mantém o escopo reutilizável. Use antes de atribuir outra identidade a uma célula reciclada e registre o trabalho do novo item.              |
| `dispose()` | Encerra o escopo definitivamente. Novos registros e animações lançam erro.                                                                                            |

`use(setup)` retorna uma função idempotente para remover a subscription. Durante suspensão, novos registros via `use()` aguardam `resume()` para executar a factory. Outros helpers e `add()` rejeitam trabalho novo enquanto suspensos. Não retome manualmente handles individuais durante a suspensão do escopo.

O evento nativo `unloaded` não destrói o escopo. O comportamento de unload de cada animação/efeito continua valendo: animações comuns são canceladas e não reiniciam automaticamente ao recarregar. O escopo permanece reutilizável. Suspenda páginas/componentes mantidos em cache e destrua no unmount real. `size`, `suspended` e `disposed` ajudam a inspecionar o ciclo de vida; `size` conta recursos registrados, não memória de GPU.

Controllers de drag cancelam o gesto e a soltura quando o escopo suspende, e aceitam gestos novos ao retomar. Veja [o ciclo de vida do drag](./drag#ciclo-de-vida).

## Integração Vue

```ts
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

// Dentro de setup(); inicie animações quando as refs estiverem disponíveis.
const motion = useMotionScope()
```

O helper destrói no unmount, suspende na desativação do KeepAlive e retoma na ativação. Unload nativo sozinho não destrói o escopo. O core não depende de Vue; outros frameworks conectam seus hooks de ciclo de vida no adapter ou no app.

## Estados nomeados

```ts
const upload = motion.states(
  { icon, label, progress },
  {
    idle: {
      icon: { scale: 1, rotate: 0 },
      label: { opacity: 1 },
      progress: { scaleX: 0 },
    },
    sending: {
      icon: { scale: 0.8, rotate: 180 },
      label: { opacity: 0.4 },
      progress: { scaleX: 0.65 },
    },
    success: {
      icon: { scale: 1, rotate: 360 },
      label: { opacity: 1 },
      progress: { scaleX: 1 },
    },
  },
  { transition: 'snappy' },
)

if (await upload.to('sending')) showSendingStatus()
```

Também é possível criar `motionStates(targets, definitions, { scope, transition })`. TypeScript infere os nomes dos estados e alvos. A criação valida as definições sem mover as views; entre no estado inicial explicitamente com `to('idle')`.

Cada estado contém destinos absolutos numéricos ou de cor. Não aceita arrays de keyframes, paths, deslocamentos relativos ou loops. A transição aceita nome de spring ou configuração finita de tween/spring, incluindo delay. `to(nome, transição)` substitui a configuração para aquela chamada. Use `sequence()` separadamente para coreografias temporizadas.

Os alvos são validados antes de alterar quem controla as propriedades. Novas tracks começam antes do cancelamento dos handles anteriores, permitindo herdar posição apresentada e velocidade da spring. Propriedades do estado anterior omitidas no novo param no valor visível; propriedades externas continuam. Declare um destino em cada estado relevante se a propriedade deve voltar ao repouso. Um estado vazio congela a transição anterior. Nomes de alvo diferentes precisam apontar para views distintas.

Uma transição substituída, interrompida ou descartada resolve `false`, inclusive em trocas rápidas com movimento reduzido. Callbacks de promises ainda executam: confira o booleano antes de aplicar efeitos de conclusão. `current` indica o estado solicitado; `settled`, o último concluído com sucesso, não uma medição contínua. `stop()` cancela a transição; `pause()/play()` controlam playback; `dispose()` também impede novas transições. O escopo pausa controllers registrados durante suspensão; mudar o destino de um controller pausado mantém a nova transição pausada.

O playground **Motion states & scopes** inclui upload, cancelar, tentar novamente, sucesso/erro, pausar/retomar e desmontar/remontar. Usa `useMotionScope()` e respeita o controle global de movimento reduzido. Os testes nativos estão descritos no [diretório de benchmarks](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-lifecycle.md).

## Views que voltam

Uma view dentro de `v-if`, ou um layout que alterna entre uma versão compacta e uma completa, é uma view nova a cada vez que aparece. Sozinha, ela começa dos valores do template: um logo que apareceu com fade volta invisível. Um controller de estados pode durar mais que as views. Comece o alvo com `null` e ligue as views conforme elas vêm e vão:

```vue
<script setup lang="ts">
const stage = useMotionScope().states(
  { logo: null },
  {
    hidden: { logo: { opacity: 0, scale: 0.6 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  },
)
onMounted(() => stage.to('shown'))
</script>

<template>
  <Label v-if="compact" :ref="stage.ref('logo')" class="small" text="J" />
  <Label v-else :ref="stage.ref('logo')" text="J" />
</template>
```

`attach(target, view)` aponta um alvo para uma view nova, ou para nenhuma com `null`. Uma view que chega depois de o estado assentar recebe os valores desse estado na hora, sem animação, pelo [`set()`](./interrupting#aplicar-valores-sem-animar). Uma que chega durante uma transição entra nela a partir de onde está, com o mesmo timing. `ref(target)` devolve um callback estável por alvo para usar como template ref: o Vue chama com o elemento ao montar e com `null` ao desmontar. Uma função criada no template seria chamada de novo a cada render.

Um alvo vazio é ignorado pelo `to()` e lembrado para quando uma view chegar. As definições dele continuam sendo validadas na criação. Uma view que desmonta durante uma transição cancela a parte dela, então essa transição resolve `false`.

<Clip name="recreated-views-ios" caption="No simulador iOS, trocar o layout recria os dois logos. O ligado aos estados volta visível, ou escondido depois de Hide logo; o que só tem entrada volta invisível. Velocidade real." />
