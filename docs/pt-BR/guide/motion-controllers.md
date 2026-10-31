# Escopos e estados de movimento

`motionScope()` dá a uma página, componente ou item reciclado um dono para animações e subscriptions. `motionStates()` coordena estados visuais nomeados entre várias views, com interrupção. Os dois reutilizam os drivers nativos existentes, sem adicionar um loop JavaScript por frame. Ownership pelo scope não muda a execução: recursos como [`animateSize()`](./size) mantêm seu custo documentado de layout em JS por frame.

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

`use(setup)` retorna uma função idempotente de remoção. Assinaturas registradas durante a suspensão aguardam a retomada do escopo. Os helpers e `add()` rejeitam trabalho novo após `suspend()` explícito; trabalho criado enquanto apenas o app está em background é registrado e suspenso imediatamente. Não retome handles individuais enquanto o escopo estiver suspenso.

O evento nativo `unloaded` não destrói permanentemente o componente. A remoção normal de uma view continua cancelando suas animações, sem reiniciá-las no reload. A exceção é o unload temporário da raiz durante background: o escopo pausa a reprodução antes do unload e a preserva para a volta ao app. O escopo permanece reutilizável até `dispose()`. Use `suspend()/resume()` para páginas mantidas em cache e descarte no unmount real. `size` conta recursos registrados, não alocações de GPU.

Controllers de drag cancelam o gesto e a soltura quando o escopo suspende, e aceitam gestos novos ao retomar. Veja [o ciclo de vida do drag](./drag#ciclo-de-vida).

## Background e retorno ao app {#app-background}

Os escopos acompanham automaticamente os eventos de suspensão e retomada do NativeScript. A reprodução sob seu controle continua da posição preservada quando o app retorna, incluindo paths infinitos, stagger, repetições reversas e composição de camadas. Um handle pausado manualmente continua pausado. A suspensão manual do escopo e a suspensão pelo KeepAlive são independentes da suspensão do app: voltar ao app não reativa um componente inativo. Animações interrompidas, removidas por `reset()` ou descartadas não reiniciam.

A política da tabela também vale em background: assinaturas de `use()` são removidas e recriadas; recursos sem controle de playback, incluindo sequences, são cancelados. Os listeners do app são removidos quando o escopo fica sem recursos. Esse comportamento vale para trabalho pertencente a `motionScope()` ou `useMotionScope()`; animações fora de um escopo mantêm seu ciclo de vida existente.

<Clip name="background-playback-ios" caption="Simulador iOS 26.2: loops nativos em Vue antes e depois de sair do app pelo Home. Órbita, stagger, repetição reversa e duas camadas continuam; o ponto pausado manualmente fica imóvel. Reprodução nativa real, sem aparelho físico." />

<Clip name="background-playback-android" caption="Emulador Android 16: a mesma cena nativa em Vue retoma após Home sem recriar os handles. O ponto pausado manualmente fica imóvel. A gravação não comprova desempenho em aparelho físico." />

Os [testes automatizados de background](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/background-playback.md) também cobrem intervalos de 20 segundos, pausa/retomada do escopo e stop seguido de outro retorno ao app.

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

### Uma transição por alvo

Uma transição pode separar alvos pelo nome, do jeito que as opções do `animate()` nomeiam propriedades. Neste splash, um único controller faz o logo entrar com spring, desenha o traço com um tween 250 ms depois e mostra o título por último:

```ts
const splash = motionStates(
  { logo, stroke, title },
  {
    hidden: {
      logo: { opacity: 0, scale: 0.5 },
      stroke: { scaleX: 0 },
      title: { opacity: 0, y: 12 },
    },
    shown: {
      logo: { opacity: 1, scale: 1 },
      stroke: { scaleX: 1 },
      title: { opacity: 1, y: 0 },
    },
  },
)

splash.to('shown', {
  type: 'spring',
  bounce: 0.4,
  duration: 600,
  stroke: { duration: 650, ease: 'cubicOut', delay: 250 },
  title: { duration: 400, ease: 'easeOut', delay: 500 },
})
```

<Clip name="state-transitions-ios" caption="Um único controller de estados faz o logo entrar com spring, desenha o traço com um tween atrasado e mostra o título por último, no simulador iOS. Velocidade real." />

A transição de um alvo se combina com a principal como uma [transição por propriedade](./transitions#por-propriedade): sobre um tween ela muda só o que define, sobre um spring ela substitui a curva, e mantém o delay principal a menos que defina o próprio. Ela também pode ser o nome de um spring. Uma transição que só nomeia alvos mantém a transição do controller para os outros, e a opção `transition` do controller também aceita nomes de alvo. Uma view anexada durante uma transição entra nela com a transição do seu alvo. Um alvo não pode ter o nome de uma opção de transição (`delay`, `duration`, `ease`...). A `Animation` devolvida, `current`, `settled`, `pause()` e `stop()` continuam valendo para todos os alvos.

<Clip name="state-transitions-android" caption="O mesmo splash no emulador Android. Velocidade real." />

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
