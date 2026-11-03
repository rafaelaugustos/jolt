# Adapters para frameworks nativos

Implementados para a próxima versão; estas entradas ainda não estão na RC.10. Importe apenas o adapter usado pelo seu app NativeScript. Todos compartilham o playback e a gestão de recursos do Jolt.

Cada binding cuida de suas animações e listeners. O unload nativo suspende o trabalho; o load retoma e aplica o último valor pendente. A destruição pelo framework libera os recursos. Um novo valor interrompe a partir da posição atual. Valores inline equivalentes não reiniciam a animação. O feedback de pressão usa uma camada separada e pode coexistir com a entrada ou o movimento de posição.

## React NativeScript

Esta integração usa React NativeScript e views NativeScript. O hook resolve refs após o commit, acompanha sua substituição e limpa tudo ao desmontar. A função retornada pode repetir explicitamente o mesmo valor. O exemplo nativo fixa React NativeScript 4.0.1 / React 16.14; os testes dos hooks também usam React 18. O pacote 5.0.0 inspecionado nesta entrega não continha os arquivos de runtime declarados.

```tsx
import { useRef } from 'react'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/react'

function Card({ x }) {
  const ref = useRef(null)
  const play = useAnimate(ref, { x })
  usePress(ref, { scale: 0.94 })
  return <label ref={ref} text="Card" onTap={() => play('popIn')} />
}
```

<Clip name="framework-react-ios" caption="Playback nativo real com toques XCTest em simulador iPhone 17 com iOS 26.2: interrupção, pressão, remoção/remontagem e substituição do alvo. Interface em inglês. A evidência de simulador não comprova desempenho em aparelho físico." />

## Svelte Native

As actions do Svelte Native recebem o wrapper nativeView. Configure o compilador Svelte com namespace: "foreign" para preservar maiúsculas e minúsculas das propriedades NativeScript. O exemplo completo fixa Svelte Native 1.0.29 / Svelte 4.2.20.

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/svelte'
  let x = 0
</script>
<label use:animate={{ x }} use:press={{ scale: 0.94 }} text="Card" />
<button text="Move" on:tap={() => x = x ? 0 : 80} />
```

<Clip name="framework-svelte-ios" caption="Playback nativo real com toques XCTest em simulador iPhone 17 com iOS 26.2: interrupção, pressão, remoção/remontagem e substituição do alvo. Interface em inglês. A evidência de simulador não comprova desempenho em aparelho físico." />

## Solid / DOMiNATIVE

A diretiva Solid recebe uma view DOMiNATIVE. Use o runtime cliente do Solid e a transformação JSX universal fornecida por @dominative/solid; os exports de servidor não executam os efeitos reativos. O exemplo fixa Solid 1.9.18 e o renderer experimental @dominative/solid 0.0.4-alpha.1. Seu JSX usa diretivas reais; esta não é uma integração com o DOM.

```jsx
import { createSignal } from 'solid-js'
import { animate, press } from '@rafaelaugusto/jolt/solid'

function Card() {
  const [x, setX] = createSignal(0)
  return (
    <label
      use:animate={{ x: x() }}
      use:press={{ scale: 0.94 }}
      text="Card"
      on:tap={() => setX(x() ? 0 : 80)}
    />
  )
}
```

<Clip name="framework-solid-ios" caption="Playback nativo real com toques XCTest em simulador iPhone 17 com iOS 26.2: interrupção, pressão, remoção/remontagem e substituição do alvo. Interface em inglês. A evidência de simulador não comprova desempenho em aparelho físico." />

O renderer DOMiNATIVE fixado não exporta o helper JSX `use`. O exemplo executável fornece este módulo e aponta `babel-preset-solid` para ele com `moduleName`, depois do hook do renderer NativeScript (`chainWebpack` com ordem 100). Preserve os exports normais de `@dominative/solid`; este ajuste apenas chama a diretiva sem capturar suas leituras no efeito pai.

```js
export * from '@dominative/solid'
import { untrack } from 'solid-js'
export const use = (directive, element, accessor) =>
  untrack(() => directive(element, accessor))
```

## Angular

Importe as três diretivas standalone no componente. Angular 22.2.4 / NativeScript Angular 22.0.2 é o par validado. A biblioteca distribui compilação parcial Angular. joltIf mantém uma raiz nativa até terminar a saída; tornar a condição verdadeira novamente cancela a remoção e inicia a entrada da posição atual. Agrupe raízes irmãs em um layout. Use joltIf quando precisar de saída: o ngIf comum remove a view antes de a saída terminar.

```ts
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/angular'
// @Component({ imports: [NativeScriptCommonModule,
//   JoltAnimateDirective, JoltPressDirective, JoltIfDirective], ... })
```

```html
<GridLayout *joltIf="visible(); enter: 'fadeIn'; leave: ['fadeOut', { duration: 400 }]">
  <label
    [joltAnimate]="{ x: position() }"
    [joltPress]="{ scale: 0.94 }"
    text="Card"
  ></label>
</GridLayout>
```

<Clip name="framework-angular-ios" caption="Playback nativo real com toques XCTest em simulador iPhone 17 com iOS 26.2: interrupção, pressão, remoção/remontagem e substituição do alvo. Interface em inglês. A evidência de simulador não comprova desempenho em aparelho físico." />

## Reprodução e limites

[Native fixtures and acceptance](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/frameworks) · [Protocol](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/frameworks.md).
