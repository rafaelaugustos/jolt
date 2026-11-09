# Web framework adapters

Candidate APIs for React DOM, Angular, Svelte and Solid. These entries use the existing Web runtime. They are not included in the published RC.12.1 package.

Bindings start after client rendering; server rendering does not create a runtime. Equivalent declarations do not restart motion. A new value replaces motion from the current pose. A detached element keeps the latest declaration for reconnection; destruction stops owned animations and removes feedback listeners. Manual pause survives detachment. Use one binding per property owner; press feedback composes on its own layer.

The default bindings share a runtime per document while mounted. An explicit runtime is borrowed: bindings never configure, release or dispose it. The application disposes its runtime after its components. React accepts `{ runtime }`; Angular uses `[joltRuntime]` or `runtime:` in `*joltIf`; Svelte uses `createActions({ runtime })`; Solid uses `createDirectives({ runtime })`.

Use Web keyframes and transitions: translations are CSS pixels, rotation is degrees, opacity and scale are unitless, durations are milliseconds. Reduced Motion follows the runtime policy; the controls retain normal DOM keyboard/focus behavior. Browser execution and threading differ from NativeScript. Dynamic definitions must be plain objects/arrays; invalid mounted replacements preserve active motion. Replay explicitly through the React return function; Svelte/Solid/Angular update declaratively.

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

<Clip name="web-react" caption="Chromium on macOS: real DOM playback and pointer interaction, replacement, removal/remount and Reduced Motion. English UI; no device performance claim." />

<Clip name="framework-react-ios" caption="Existing NativeScript counterpart: actual iOS 26.2 simulator playback and XCTest touches. These native adapters were already published; the new entries target DOM elements." />

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

Angular attaches after rendering. `joltIf` retains exactly one HTML root until its leave animation finishes; reentry cancels pending removal. Wrap sibling roots. Interrupted custom presets must use explicit keyframes; built-in preset names work directly. Angular owns structural views on the server and during hydration.

<Clip name="web-angular" caption="Chromium on macOS: real DOM playback and pointer interaction, replacement, removal/remount and Reduced Motion. English UI; no device performance claim." />

<Clip name="framework-angular-ios" caption="Existing NativeScript counterpart: actual iOS 26.2 simulator playback and XCTest touches. These native adapters were already published; the new entries target DOM elements." />

## Svelte

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/web/svelte'
  let x = $state(0)
</script>
<button use:animate={{ x }} use:press={{ scale: 0.94 }} onclick={() => x = x ? 0 : 80}>Jolt</button>
```

<Clip name="web-svelte" caption="Chromium on macOS: real DOM playback and pointer interaction, replacement, removal/remount and Reduced Motion. English UI; no device performance claim." />

<Clip name="framework-svelte-ios" caption="Existing NativeScript counterpart: actual iOS 26.2 simulator playback and XCTest touches. These native adapters were already published; the new entries target DOM elements." />

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

<Clip name="web-solid" caption="Chromium on macOS: real DOM playback and pointer interaction, replacement, removal/remount and Reduced Motion. English UI; no device performance claim." />

<Clip name="framework-solid-ios" caption="Existing NativeScript counterpart: actual iOS 26.2 simulator playback and XCTest touches. These native adapters were already published; the new entries target DOM elements." />

Validated packed consumers: React 19.3.1 (Strict Mode), Angular 22.2.4 (partial library compilation and actual hydration), Svelte 5.57.3 and Solid 1.9.18 (compiled client/server JSX). TypeScript NodeNext/Bundler and Chromium/Firefox/WebKit exercise imports, hydration, updates, replacement, Reduced Motion and teardown. This does not establish Next, every older framework version or every Angular rendering mode.
