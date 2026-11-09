# Adaptadores para frameworks Web

APIs candidatas para React DOM, Angular, Svelte y Solid sobre el runtime Web existente. Todavía no están incluidas en RC.12.1.

Los bindings empiezan después del renderizado cliente; el servidor no crea un runtime. Declaraciones equivalentes no reinician la animación. Un valor nuevo sustituye el movimiento desde la pose actual. Un elemento desconectado conserva la última declaración para reconectarse; la destrucción detiene sus animaciones y elimina sus listeners. La pausa manual sobrevive a la desconexión. Use un propietario por propiedad; la respuesta de presión compone su propia capa.

Los bindings predeterminados comparten un runtime por documento mientras están montados. Un runtime explícito es prestado: los bindings no lo configuran, liberan ni destruyen. La aplicación lo destruye después de sus componentes. React acepta `{ runtime }`; Angular usa `[joltRuntime]` o `runtime:` en `*joltIf`; Svelte usa `createActions({ runtime })`; Solid usa `createDirectives({ runtime })`.

Use keyframes y transiciones Web: traslación en píxeles CSS, rotación en grados, opacidad y escala sin unidad, duración en milisegundos. Reducir movimiento sigue la política del runtime; teclado y foco siguen siendo DOM. Ejecución e hilos difieren de NativeScript. Las declaraciones requieren objetos simples y arrays; una sustitución inválida montada conserva la animación anterior. El retorno del hook React permite reproducción explícita; los demás adaptadores actualizan declarativamente.

## React DOM

```tsx
import { useRef } from 'react'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/web/react'
function Card({ x }: { x: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const replay = useAnimate(ref, [{ x }, { duration: 500 }])
  usePress(ref, { scale: 0.94 })
  return (
    <button ref={ref} onClick={() => replay('popIn')}>
      Jolt
    </button>
  )
}
```

<Clip name="web-react" caption="Chromium en macOS: ejecución DOM real, interacción de puntero, sustitución, eliminación/remontaje y Reducir movimiento. Interfaz en inglés; no es un benchmark de dispositivo." />

<Clip name="framework-react-ios" caption="Equivalente NativeScript existente: ejecución nativa real y toques XCTest en el simulador iOS 26.2. Esos adaptadores nativos ya fueron publicados; las entradas nuevas usan elementos DOM." />

## Angular DOM

```ts
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/web/angular'
// @Component({ imports: [JoltAnimateDirective, JoltPressDirective, JoltIfDirective], ... })
```

```html
<button [joltAnimate]="{ x: position() }" [joltPress]="{ scale: 0.94 }">Jolt</button>
<div *joltIf="visible(); enter: 'fadeIn'; leave: 'fadeOut'">Jolt</div>
```

Angular conecta después de renderizar. `joltIf` conserva exactamente una raíz HTML hasta terminar su salida; la reentrada cancela la eliminación. Envuelva raíces hermanas. Los presets personalizados interrumpidos requieren keyframes explícitos; los nombres incluidos funcionan directamente. Angular conserva la propiedad estructural en servidor e hidratación.

<Clip name="web-angular" caption="Chromium en macOS: ejecución DOM real, interacción de puntero, sustitución, eliminación/remontaje y Reducir movimiento. Interfaz en inglés; no es un benchmark de dispositivo." />

<Clip name="framework-angular-ios" caption="Equivalente NativeScript existente: ejecución nativa real y toques XCTest en el simulador iOS 26.2. Esos adaptadores nativos ya fueron publicados; las entradas nuevas usan elementos DOM." />

## Svelte

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/web/svelte'
  let x = $state(0)
</script>
<button use:animate={{ x }} use:press={{ scale: 0.94 }} onclick={() => x = x ? 0 : 80}>Jolt</button>
```

<Clip name="web-svelte" caption="Chromium en macOS: ejecución DOM real, interacción de puntero, sustitución, eliminación/remontaje y Reducir movimiento. Interfaz en inglés; no es un benchmark de dispositivo." />

<Clip name="framework-svelte-ios" caption="Equivalente NativeScript existente: ejecución nativa real y toques XCTest en el simulador iOS 26.2. Esos adaptadores nativos ya fueron publicados; las entradas nuevas usan elementos DOM." />

## Solid

```tsx
import { createSignal } from 'solid-js'
import {
  animate,
  press,
  type AnimateValue,
  type PressValue,
} from '@rafaelaugusto/jolt/web/solid'
declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      animate: AnimateValue
      press: PressValue
    }
  }
}
function Card() {
  const [x, setX] = createSignal(0)
  return (
    <button
      use:animate={{ x: x() }}
      use:press={{ scale: 0.94 }}
      onClick={() => setX(x() ? 0 : 80)}
    >
      Jolt
    </button>
  )
}
```

<Clip name="web-solid" caption="Chromium en macOS: ejecución DOM real, interacción de puntero, sustitución, eliminación/remontaje y Reducir movimiento. Interfaz en inglés; no es un benchmark de dispositivo." />

<Clip name="framework-solid-ios" caption="Equivalente NativeScript existente: ejecución nativa real y toques XCTest en el simulador iOS 26.2. Esos adaptadores nativos ya fueron publicados; las entradas nuevas usan elementos DOM." />

Consumidores de tarball validados: React 19.3.1 con Strict Mode, Angular 22.2.4 con biblioteca parcialmente compilada e hidratación real, Svelte 5.57.3 y Solid 1.9.18 con JSX cliente/servidor. TypeScript NodeNext/Bundler y Chromium/Firefox/WebKit verifican imports, hidratación, cambios, accesibilidad y destrucción. Esto no valida Next, todas las versiones anteriores ni todos los modos Angular.
