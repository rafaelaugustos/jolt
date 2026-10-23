# Gradientes

O CSS do NativeScript só tem um `linear-gradient` estático. O `gradient()` pinta um gradiente nativo linear, radial ou cônico atrás dos filhos de um layout, e anima as cores, as posições, o ângulo, o centro e o raio:

```ts
import { gradient } from '@rafaelaugusto/jolt'

const glow = gradient(card, {
  type: 'radial',
  colors: ['#A78BFA', '#0F172A'],
  center: { x: 0.3, y: 0.3 },
  radius: 0.45,
})

glow.animate({ center: { x: 0.7, y: 0.7 }, radius: 0.9 }, { duration: 1400 })
```

<Clip name="gradients-ios" caption="O ângulo de um linear, uma luz radial se movendo, um cônico girando e uma faixa linear numa view larga, depois as cores do linear trocadas, no simulador iOS. Velocidade real." />

## Tipos e valores

| Valor    | Significado                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors` | de duas a oito cores, como strings ou `Color`                                                                                                                                               |
| `stops`  | onde cada cor fica, de 0 a 1, sem voltar; distribuídas por igual por padrão                                                                                                                 |
| `angle`  | graus, como no CSS. O `linear` aponta para esse lado: 180 vai de cima para baixo, 90 da esquerda para a direita. O `conic` começa aqui: 0 é para cima, e as cores seguem no sentido horário |
| `center` | `radial` e `conic`: frações da largura e da altura da view; `{ x: 0.5, y: 0.5 }` por padrão                                                                                                 |
| `radius` | `radial`: fração do lado menor da view; 0.5 por padrão alcança as bordas mais próximas                                                                                                      |

Um gradiente linear passa pelo centro e é longo o bastante para os cantos receberem a primeira e a última cor, como no CSS. As faixas ficam perpendiculares ao ângulo em views de qualquer formato, nas duas plataformas. Valores que um tipo não usa ficam guardados. Na API direta, `type` é imutável: remova o gradiente e crie outro para trocar o tipo. O `v-gradient` faz essa substituição automaticamente.

## Animando

`animate(values, transition)` começa do gradiente na tela e devolve uma [`Animation`](./api#animacoes). Aceita as mesmas transições do `animate()`: tweens, molas, `repeat`, `repeatType`, `repeatDelay` e `delay`, e segue a [escala de tempo](./configure#escala-de-tempo).

```ts
const sweep = gradient(loader, {
  type: 'conic',
  colors: ['#22D3EE', '#A855F7', '#22D3EE'],
})
sweep.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
```

As cores se misturam em OKLab, como nas [animações de cor](./colors), e mantêm a quantidade durante a animação; o `set()` muda essa quantidade. Numa mola, o ângulo, o centro e o raio acompanham o passo além do ponto, enquanto as cores e as posições ficam entre as pontas. Um gradiente toca uma animação por vez: um novo `animate()` assume de onde a anterior está. `stop()` segura o quadro atual e `set(values)` aplica valores na hora. Com [movimento reduzido](./configure#reducao-de-movimento), o ângulo, o centro e o raio pulam para o fim enquanto as cores e as posições continuam com fade.

`remove()` tira o gradiente da view. Descarregar a view para a animação em andamento.

## Escopos e Vue

`motionScope().gradient(target, options)` devolve o mesmo `Gradient` e o remove quando o escopo é descartado. Suspender o escopo para uma animação em andamento onde ela está e mantém o gradiente. No Vue, o `useMotionScope()` amarra o gradiente ao componente:

```ts
const scope = useMotionScope()
onMounted(() => scope.gradient(card.value, { type: 'linear', colors: warm, angle: 135 }))
```

A diretiva `v-gradient` faz o mesmo a partir do template. Ela pinta o gradiente quando o elemento é montado, anima até os novos valores quando eles mudam e remove o gradiente ao desmontar. Passe as opções em par com uma transição ou o nome de um spring para controlar o tempo das mudanças:

```vue
<GridLayout v-gradient="{ type: 'linear', colors: ['#18181B', '#3F3F46'], angle: 135 }" />
<GridLayout
  v-gradient="[
    { type: 'linear', colors: mood.colors, angle: mood.angle },
    { duration: 700 },
  ]"
/>
```

<Clip name="gradient-directive-ios" caption="Um banner com v-gradient animando as cores e o ângulo quando o valor muda, no simulador iOS. Velocidade real." />

Uma mudança no número de cores é aplicada na hora, já que um gradiente mantém a quantidade de cores enquanto anima. Uma mudança de `type` substitui o gradiente. Os valores são comparados pelo conteúdo, então um objeto escrito no template não reinicia a animação a cada render.

<Clip name="gradient-directive-android" caption="O mesmo banner no emulador Android. Velocidade real." />

## Plataformas

No iOS o gradiente é uma `CAGradientLayer` no fundo da camada da view, com keyframes do Core Animation para as cores, as posições e os pontos. No Android é um drawable empilhado sobre o fundo da própria view, e um animator nativo interpola os quadros amostrados. Não há callback JavaScript de pintura por quadro. Recompile o app Android depois de atualizar para incluir a classe nativa e os metadados da ponte.

O gradiente cobre a cor de fundo da view e segue um `borderRadius` uniforme. Ele fica atrás dos filhos de um layout. Numa view que desenha o próprio conteúdo, como um `Label`, ele cobre esse conteúdo: coloque o gradiente num layout em volta dela.

<Clip name="gradients-android" caption="Os mesmos gradientes e a troca de cores no emulador Android. Velocidade real." />

## Seguindo motion values

Passe motion values ou derivados numéricos para `angle`, cada componente de `center`, `radius` ou cada posição em `stops`, e cores derivadas para os itens de `colors`. Componentes estáticos e vinculados podem coexistir. O tipo `GradientBindings` é exportado. A mesma fonte também pode controlar propriedades de views, mapeamentos decrescentes, extrapolação e [camadas escalares](./motion-values):

```ts
import { animate, bind, gradient, motionValue } from '@rafaelaugusto/jolt'

const offset = motionValue(0)
const progress = offset.to([0, 220], [0, 1], { clamp: false })
const releaseView = bind(thumb, { x: offset, opacity: progress.to([0, 1], [0.5, 1]) })
const glow = gradient(card, {
  type: 'radial',
  colors: [progress.to([0, 1], ['#ed4b82', '#45c8f5']), 'rgba(16,23,43,0)'],
  center: {
    x: progress.to([0, 1], [0.15, 0.85]),
    y: progress.to([1, 0], [0.2, 0.8]),
  },
  radius: progress.to([0, 1], [0.35, 0.9]),
  stops: [0, progress.to([0, 1], [0.45, 1])],
})

const travel = animate(offset, 220, { duration: 3000 })
// travel.pause(), travel.play() e travel.progress = 0.7 também controlam o gradiente.
animate(offset, [0, 35, 0], { duration: 900, layer: 'pulse' })
// Ao descartar: glow.remove(); releaseView(); stop(offset).
```

O contrato também aceita mapeamentos de `playbackProgress(animation)`: por exemplo, `angle: playbackProgress(travel).to([0, 1], [0, 360])` num gradiente cônico. Não precisa de timer nem de `subscribe()`. Substitua `value.subscribe(v => glow.set(...))` pela própria fonte ou pelo mapeamento `.to()`, removendo a assinatura antiga.

<Clip name="gradient-values-ios" caption="Simulador iPhone 17, iOS 26: arraste e toques reais, animação autônoma, pulso em camada, pausa/seek, suspensão do escopo, troca de tipo e resize. Velocidade real; eventos de gesto e reconstruções dos bindings ainda passam pelo JavaScript." />

### Controle e ciclo de vida

| Operação                                   | Resultado                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glow.bind({ center: { x: value } })`      | Substitui apenas o x do centro; devolve uma função de limpeza.                                                                                                      |
| Limpeza do binding                         | Segura os valores atuais dos componentes que ainda controla. Não restaura bindings anteriores nem remove os mais novos.                                             |
| `glow.set(...)` / `glow.animate(...)`      | Desconecta apenas os componentes informados. Os outros bindings continuam. Uma animação concreta nova substitui a anterior. `set()` cancela essa animação concreta. |
| `glow.bind(...)` durante animação concreta | Assume os componentes informados; os demais continuam animando.                                                                                                     |
| `glow.stop()`                              | Segura o quadro atual, para a animação concreta e desconecta todos os bindings do gradiente. A fonte e outros consumidores continuam.                               |
| `glow.suspend()` / `glow.resume()`         | Segura e desconecta temporariamente, depois alcança a posição atual da fonte. `glow.suspended` indica uma suspensão explícita. Não pausa uma fonte independente.    |
| `glow.remove()`                            | Remove assinaturas, timers, animações nativas, camada/drawable e listeners da view e do app. Pode ser chamado novamente.                                            |

`motionScope().gradient()` e `useMotionScope().gradient()` gerenciam o mesmo controlador. A suspensão do escopo segura os bindings; a retomada volta a seguir a fonte sem duplicar assinaturas. Um gradiente suspenso manualmente continua suspenso após suspender/retomar o escopo. Se a animação da fonte também pertence ao escopo, valem suas regras normais de pausa/retomada. Animações concretas do gradiente param na suspensão e não são reiniciadas.

O unload remove a camada nativa e as assinaturas, preservando as definições dos bindings. O load reconecta uma vez na posição atual da fonte. Ir para segundo plano também segura/desconecta; voltar ao app alcança a fonte. Descartar o escopo ou desmontar o componente Vue remove tudo.

A quantidade de cores é estrutural: `bind()`/`set()` podem substituir o array inteiro imediatamente, removendo bindings de cores/posições incompatíveis e preservando os de geometria. Informar `colors` sem `stops` redistribui as posições igualmente, como na API concreta. `animate()` exige a mesma quantidade. São necessárias de duas a oito cores e uma posição para cada cor.

### Bindings no Vue

Crie as fontes uma vez no setup. A diretiva compara motion values pela identidade, valida a substituição antes de remover o gradiente atual e libera bindings omitidos mantendo seus valores. Outro tipo substitui a camada nativa. A tupla com transição controla opções concretas; componentes vinculados seguem o tempo da própria fonte.

```vue
<script setup lang="ts">
import { motionValue } from '@rafaelaugusto/jolt'

const progress = motionValue(0)
const angle = progress.to([0, 1], [0, 360])
const tint = progress.to([0, 1], ['#ed4b82', '#45c8f5'])
</script>

<template>
  <GridLayout v-gradient="{ type: 'conic', colors: [tint, '#20233c', tint], angle }" />
</template>
```

### Faixas válidas e execução nativa

Ângulos usam as unidades/direções descritas acima e podem ultrapassar 360°. O centro pode extrapolar os limites da view. Raios estáticos negativos, números não finitos, cores inválidas e posições estáticas desordenadas ou fora da faixa lançam erro antes de substituir bindings válidos. O raio vinculado é limitado a zero quando passa abaixo dele. Posições vinculadas são limitadas a `[0, 1]` e cada posição é elevada até pelo menos a anterior; as cores nunca são reordenadas. O overshoot pode juntar posições. Se um mapeamento depois produzir um resultado não finito, o gradiente segura o último quadro compilado válido, desconecta seus bindings e registra um erro no Trace do NativeScript; os outros consumidores continuam conectados. Faça um novo binding válido para recuperar.

Cores derivadas usam a interpolação OKLab do Jolt e preservam alpha. As amostras nativas usam canais de cor de 8 bits; entre amostras, a plataforma interpola essas cores. Com movimento reduzido, a geometria vinculada usa o destino da fonte enquanto cores e posições continuam interpolando.

Todos os componentes são preparados num quadro coerente, com um snapshot por fonte. Bindings em movimento usam janelas de até **4 segundos**, com **no máximo 241 amostras**, separadas por até **16,7 ms** no tempo de reprodução da fonte. A reprodução nativa é alinhada ao relógio existente da fonte; o binding não cria um segundo relógio. Pontos/cores nativos no iOS e canais numéricos no Android interpolam entre amostras. É uma aproximação: não existe limite universal de erro visual para um mapeamento arbitrariamente abrupto ou uma descontinuidade de repetição. Uma mudança brusca pode se misturar ao longo de um intervalo de amostragem; mantenha transições importantes mais largas que esse intervalo. Para um canal numérico interpolado linearmente cuja velocidade é limitada a L unidades/ms, a interpolação contribui com erro de no máximo L × Δ / 2 (Δ ≤ 16,7 ms), antes do arredondamento nativo e do agendamento de exibição. Mapeamentos descontínuos não satisfazem esse limite.

JavaScript participa da preparação, dos comandos da fonte, dos eventos de gesto e dos limites das janelas longas. A reprodução autônoma dentro de uma janela solicita **zero frames de observação JS**, sem loop de `set()`/pintura por quadro. Fontes longas ou infinitas precisam reconstruir a janela a cada quatro segundos; se o JS não puder executar nesse momento, o gradiente segura o último quadro preparado até conseguir alcançar a fonte. No iOS, quadros já enviados ao Core Animation podem continuar durante uma ocupação do JS. No Android, o animator e o desenho ainda dependem da thread de UI; bloqueá-la interrompe a renderização. Atualizações frequentes de drag ainda reconstroem bindings via JS; esta API não transfere gestos para um worklet.

<Clip name="gradient-values-android" caption="Emulador Android 16 / API 36: arraste e toques reais com os mesmos três gradientes e controles. Velocidade real; reprodução pelo animator nativo, com JavaScript nos eventos de gesto e na preparação." />
