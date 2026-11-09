# Adaptadores para frameworks Web

APIs candidatas para React DOM, Angular, Svelte e Solid, sobre o runtime Web existente. Ainda não fazem parte do pacote publicado RC.12.1.

Os bindings começam após a renderização no cliente; a renderização no servidor não cria runtime. Declarações equivalentes não reiniciam o movimento. Um novo valor substitui a animação a partir da pose atual. Elementos desconectados guardam a declaração mais recente para a reconexão; a destruição encerra animações próprias e listeners de feedback. A pausa manual sobrevive à desconexão. Use um dono por propriedade; o feedback de pressão compõe uma camada independente.

Os bindings padrão compartilham um runtime por documento enquanto estão montados. Um runtime explícito é emprestado: o binding não o configura, libera nem destrói. O app destrói seu runtime depois dos componentes. React recebe `{ runtime }`; Angular usa `[joltRuntime]` ou `runtime:` em `*joltIf`; Svelte usa `createActions({ runtime })`; Solid usa `createDirectives({ runtime })`.

Use keyframes e transições Web: translação em pixels CSS, rotação em graus, opacidade e escala sem unidade, duração em milissegundos. Reduzir Movimento segue a política do runtime; os controles preservam teclado e foco do DOM. Execução e threads diferem do NativeScript. Definições dinâmicas usam objetos simples e arrays; uma substituição inválida em elemento montado preserva a animação atual. O retorno do hook React permite replay explícito; os demais adaptadores atualizam declarativamente.

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

<Clip name="web-react" caption="Chromium no macOS: execução DOM real e interação por ponteiro, substituição, remoção/remontagem e Reduzir Movimento. Interface em inglês; sem afirmação de desempenho em dispositivo." />

<Clip name="framework-react-ios" caption="Equivalente NativeScript existente: execução nativa real e toques XCTest no simulador iOS 26.2. Esses adaptadores nativos já foram publicados; as novas entradas atendem elementos DOM." />

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

Angular conecta os bindings após renderizar. `joltIf` mantém exatamente uma raiz HTML até terminar a saída; uma reentrada cancela a remoção pendente. Envolva raízes irmãs em um elemento. Presets personalizados interrompidos exigem keyframes explícitos; nomes de presets incluídos funcionam diretamente. Angular mantém a propriedade das views no servidor e na hidratação.

<Clip name="web-angular" caption="Chromium no macOS: execução DOM real e interação por ponteiro, substituição, remoção/remontagem e Reduzir Movimento. Interface em inglês; sem afirmação de desempenho em dispositivo." />

<Clip name="framework-angular-ios" caption="Equivalente NativeScript existente: execução nativa real e toques XCTest no simulador iOS 26.2. Esses adaptadores nativos já foram publicados; as novas entradas atendem elementos DOM." />

## Svelte

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/web/svelte'
  let x = $state(0)
</script>
<button use:animate={{ x }} use:press={{ scale: 0.94 }} onclick={() => x = x ? 0 : 80}>Jolt</button>
```

<Clip name="web-svelte" caption="Chromium no macOS: execução DOM real e interação por ponteiro, substituição, remoção/remontagem e Reduzir Movimento. Interface em inglês; sem afirmação de desempenho em dispositivo." />

<Clip name="framework-svelte-ios" caption="Equivalente NativeScript existente: execução nativa real e toques XCTest no simulador iOS 26.2. Esses adaptadores nativos já foram publicados; as novas entradas atendem elementos DOM." />

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

<Clip name="web-solid" caption="Chromium no macOS: execução DOM real e interação por ponteiro, substituição, remoção/remontagem e Reduzir Movimento. Interface em inglês; sem afirmação de desempenho em dispositivo." />

<Clip name="framework-solid-ios" caption="Equivalente NativeScript existente: execução nativa real e toques XCTest no simulador iOS 26.2. Esses adaptadores nativos já foram publicados; as novas entradas atendem elementos DOM." />

Consumidores de tarball validados: React 19.3.1 com Strict Mode, Angular 22.2.4 com biblioteca parcialmente compilada e hidratação real, Svelte 5.57.3 e Solid 1.9.18 com JSX cliente/servidor. TypeScript NodeNext/Bundler e Chromium/Firefox/WebKit verificam imports, hidratação, atualização, substituição, acessibilidade e destruição. Isso não comprova Next, todas as versões antigas ou todos os modos de renderização Angular.

## Recursos próprios e presença retida

Use um setup síncrono e estável: useMotion(ref, setup) no React; [joltMotion]="setup" com JoltMotionDirective no Angular; use:motion={setup} no Svelte/Solid. Recebe (scope, element, runtime). Adote recursos pelos métodos do scope ou retorne um recurso descartável; registre limpeza de listeners em scope.add(). Desanexar destrói o grafo; reconectar recria o setup atual. Memorize setup no React com useCallback. Runtimes emprestados continuam pertencendo ao app.

usePresence(ref, present, options) do React retorna a flag que deve controlar a renderização. createPresence(initial, options) do Svelte fornece store legível, set() e action presence; crie durante a inicialização e use {#if $owner}. No Solid, createPresence(accessor, options) retorna show e presence para Show e directive. Angular mantém joltIf; Vue mantém seu suporte de transição. Preserve uma raiz e sua identidade durante a saída; use a flag retida, não o pedido original, para renderizar. A raiz fica inert e aria-hidden durante a saída, restaurados na reentrada/limpeza. SSR segue a presença inicial sem relógios. Options aceita enter/leave; presets personalizados interrompidos precisam de keyframes explícitos.

<Clip name="web-expansion-react" caption="Chromium no macOS, React DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />

<Clip name="web-expansion-angular" caption="Chromium no macOS, Angular DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />

<Clip name="web-expansion-svelte" caption="Chromium no macOS, Svelte DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />

<Clip name="web-expansion-solid" caption="Chromium no macOS, Solid DOM: ponteiro, arraste, presença, valores, eventos, layout e scroll reais. O mesmo contrato é testado nos quatro frameworks." />
