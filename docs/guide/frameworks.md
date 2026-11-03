# Native framework adapters

Implemented for the next release; these entries are not in RC.10. Import only the adapter your NativeScript app uses. They share Jolt playback and ownership with the imperative API.

Every binding owns its animations and listeners. Native unload suspends work; load resumes it and applies the latest pending value. Framework destruction disposes it. A new value interrupts from the current pose. Equivalent inline values do not restart playback. Press feedback owns a separate layer, so it can coexist with entrance or position motion.

## React NativeScript

This is React NativeScript, using NativeScript views. The hook resolves refs after commit, follows replacement refs and cleans up on unmount. The returned function can explicitly replay the same value. The native fixture pins React NativeScript 4.0.1 / React 16.14; hook tests also exercise React 18. The 5.0.0 renderer tarball inspected for this delivery omitted its declared runtime files.

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

<Clip name="framework-react-ios" caption="Real native playback with XCTest touches on an iOS 26.2 iPhone 17 simulator: interruption, press, removal/remount and target replacement. English UI. Simulator evidence does not establish physical-device performance." />

## Svelte Native

Svelte Native actions receive its nativeView wrapper. Configure the Svelte compiler with namespace: "foreign" so NativeScript property names retain their case. The complete fixture pins Svelte Native 1.0.29 / Svelte 4.2.20.

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/svelte'
  let x = 0
</script>
<label use:animate={{ x }} use:press={{ scale: 0.94 }} text="Card" />
<button text="Move" on:tap={() => x = x ? 0 : 80} />
```

<Clip name="framework-svelte-ios" caption="Real native playback with XCTest touches on an iOS 26.2 iPhone 17 simulator: interruption, press, removal/remount and target replacement. English UI. Simulator evidence does not establish physical-device performance." />

## Solid / DOMiNATIVE

The Solid directive receives a DOMiNATIVE view. Use the client Solid runtime and the universal JSX transform supplied by @dominative/solid; server exports do not run reactive effects. The complete fixture pins Solid 1.9.18 and the experimental @dominative/solid 0.0.4-alpha.1 renderer. Its JSX uses actual directives; this is not a DOM adapter.

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

<Clip name="framework-solid-ios" caption="Real native playback with XCTest touches on an iOS 26.2 iPhone 17 simulator: interruption, press, removal/remount and target replacement. English UI. Simulator evidence does not establish physical-device performance." />

The pinned DOMiNATIVE renderer omits the JSX `use` helper. The runnable fixture supplies this forwarding module and points `babel-preset-solid` at it with `moduleName`, after the NativeScript renderer hook (`chainWebpack` order 100). Keep the normal `@dominative/solid` exports; this shim only invokes a directive without capturing its reads in the parent effect.

```js
export * from '@dominative/solid'
import { untrack } from 'solid-js'
export const use = (directive, element, accessor) =>
  untrack(() => directive(element, accessor))
```

## Angular

Import the three standalone directives into the component. Angular 22.2.4 / NativeScript Angular 22.0.2 is the validated pair. The library ships partial Angular compilation. joltIf retains one native root until exit finishes; setting the condition back to true cancels removal and enters from the current pose. Wrap sibling roots in a layout. Use joltIf where an exit is required: ordinary ngIf removes the view before an exit can finish.

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

<Clip name="framework-angular-ios" caption="Real native playback with XCTest touches on an iOS 26.2 iPhone 17 simulator: interruption, press, removal/remount and target replacement. English UI. Simulator evidence does not establish physical-device performance." />

## Reproduction and limits

[Native fixtures and acceptance](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/frameworks) · [Protocol](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/frameworks.md).
