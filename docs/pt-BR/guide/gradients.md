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

Um gradiente linear passa pelo centro e é longo o bastante para os cantos receberem a primeira e a última cor, como no CSS. As faixas ficam perpendiculares ao ângulo em views de qualquer formato, nas duas plataformas. Valores que um tipo não usa ficam guardados, então trocar entre eles depois é só outro `set()`.

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

No iOS o gradiente é uma `CAGradientLayer` no fundo da camada da view, com keyframes do Core Animation para as cores, as posições e os pontos. No Android é um drawable empilhado sobre o fundo da própria view, e um animator nativo interpola os quadros amostrados; nada roda em JavaScript enquanto ele toca. Recompile o app Android depois de atualizar para incluir a classe nativa.

O gradiente cobre a cor de fundo da view e segue um `borderRadius` uniforme. Ele fica atrás dos filhos de um layout. Numa view que desenha o próprio conteúdo, como um `Label`, ele cobre esse conteúdo: coloque o gradiente num layout em volta dela.

<Clip name="gradients-android" caption="Os mesmos gradientes e a troca de cores no emulador Android. Velocidade real." />
