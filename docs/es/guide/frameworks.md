# Adaptadores para frameworks nativos

Implementados para la próxima versión; estas entradas no están en RC.10. Importe solo el adaptador de su aplicación NativeScript. Comparten la reproducción y la gestión de recursos de Jolt.

Cada binding administra sus animaciones y listeners. Unload suspende el trabajo; load lo reanuda y aplica el último valor pendiente. La destrucción del framework libera los recursos. Un valor nuevo interrumpe desde la posición actual. Los valores inline equivalentes no reinician la animación. La presión usa una capa independiente y coexiste con la entrada o el movimiento.

## React NativeScript

Esta integración usa React NativeScript y vistas NativeScript. El hook resuelve refs después del commit, sigue sus reemplazos y limpia al desmontar. La función devuelta permite repetir explícitamente el mismo valor. El ejemplo nativo fija React NativeScript 4.0.1 / React 16.14; las pruebas también usan React 18. El paquete 5.0.0 inspeccionado no incluía sus archivos de runtime declarados.

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

<Clip name="framework-react-ios" caption="Reproducción nativa real con toques XCTest en simulador iPhone 17 con iOS 26.2: interrupción, presión, desmontaje/montaje y reemplazo. Interfaz en inglés. No demuestra rendimiento en dispositivos físicos." />

## Svelte Native

Las actions de Svelte Native reciben su wrapper nativeView. Configure Svelte con namespace: "foreign" para conservar las mayúsculas de las propiedades NativeScript. El ejemplo fija Svelte Native 1.0.29 / Svelte 4.2.20.

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/svelte'
  let x = 0
</script>
<label use:animate={{ x }} use:press={{ scale: 0.94 }} text="Card" />
<button text="Move" on:tap={() => x = x ? 0 : 80} />
```

<Clip name="framework-svelte-ios" caption="Reproducción nativa real con toques XCTest en simulador iPhone 17 con iOS 26.2: interrupción, presión, desmontaje/montaje y reemplazo. Interfaz en inglés. No demuestra rendimiento en dispositivos físicos." />

## Solid / DOMiNATIVE

La directiva Solid recibe una vista DOMiNATIVE. Use el runtime cliente de Solid y la transformación JSX universal de @dominative/solid; los exports de servidor no ejecutan efectos reactivos. El ejemplo fija Solid 1.9.18 y el renderer experimental @dominative/solid 0.0.4-alpha.1, con directivas JSX reales. No es un adaptador DOM.

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

<Clip name="framework-solid-ios" caption="Reproducción nativa real con toques XCTest en simulador iPhone 17 con iOS 26.2: interrupción, presión, desmontaje/montaje y reemplazo. Interfaz en inglés. No demuestra rendimiento en dispositivos físicos." />

El renderer DOMiNATIVE fijado no exporta el helper JSX `use`. El ejemplo proporciona este módulo y apunta `babel-preset-solid` a él con `moduleName`, después del hook de NativeScript (`chainWebpack` con orden 100). Conserve los exports de `@dominative/solid`; este ajuste invoca la directiva sin capturar sus lecturas en el efecto padre.

```js
export * from '@dominative/solid'
import { untrack } from 'solid-js'
export const use = (directive, element, accessor) =>
  untrack(() => directive(element, accessor))
```

## Angular

Importe las tres directivas standalone en el componente. Se valida Angular 22.2.4 / NativeScript Angular 22.0.2. La biblioteca distribuye compilación parcial Angular. joltIf retiene una raíz nativa hasta completar la salida; volver a true cancela la eliminación y entra desde la posición actual. Envuelva raíces hermanas en un layout. Use joltIf para las salidas: ngIf elimina la vista antes de que termine la animación.

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

<Clip name="framework-angular-ios" caption="Reproducción nativa real con toques XCTest en simulador iPhone 17 con iOS 26.2: interrupción, presión, desmontaje/montaje y reemplazo. Interfaz en inglés. No demuestra rendimiento en dispositivos físicos." />

## Reproducción y límites

[Native fixtures and acceptance](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/frameworks) · [Protocol](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/frameworks.md).
