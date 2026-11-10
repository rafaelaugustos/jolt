# O que é o Jolt

O Jolt leva movimento a aplicativos [NativeScript](https://nativescript.org) e à Web: presets, springs, keyframes, stagger e gestos, com APIs para views nativas e elementos HTML.

## NativeScript

Anime views nativas no iOS e no Android pela entrada principal do pacote:

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Web

Use `@rafaelaugusto/jolt/web` para elementos HTML. Ele compartilha o compilador de movimento do Jolt e usa a Web Animations API (WAAPI), sem exigir NativeScript ou um framework de interface.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const card = document.querySelector<HTMLElement>('.card')

if (card) {
  motion.animate(card, 'fadeInUp')
}
```

Crie o runtime após a montagem no navegador e chame `motion.dispose()` quando a aplicação ou o componente for desmontado. O [adaptador opcional `/web/vue`](./web-vue) gerencia os recursos pelo ciclo de vida do Vue. O import principal e `/vue` atendem ao NativeScript; eles não mudam automaticamente para o DOM.

As APIs Web são **experimentais**. Comece pelo [runtime Web](./web-runtime), depois explore [movimento contínuo](./web-dynamic), [gestos e rolagem](./web-gestures) e [gradientes, carregamento e texto](./web-effects). Cada guia descreve os alvos compatíveis e seus limites.

## SwiftUI (Beta)

Disponível na **0.1.0-rc.13 (Beta)** para iOS 17+ e macOS 14+, sem NativeScript ou JavaScript. Instale o produto `JoltSwiftUI` pela tag `v0.1.0-rc.13` do repositório. Consulte [instalação](./swiftui), [ciclo de vida](./swiftui-motion) e [interação/geometria](./swiftui-geometry) para os limites.

## Por que não o `view.animate()`

O `view.animate()` do NativeScript cobre o básico e para por aí: uma curva para todas as propriedades, uma curva `spring` sem ajustes, nenhum keyframe, e uma promise que rejeita quando a animação é cancelada. Qualquer coisa mais rica acaba virando código de plataforma.

O Jolt calcula o movimento uma vez, em JavaScript, quando a animação começa, e entrega à plataforma como keyframes: Core Animation no iOS, `ObjectAnimator` no Android. As tracks padrão de views tocam sem JavaScript por frame. Layout com dimensões reais, assinaturas opcionais e entrada de gestos têm seus próprios [limites de execução](./how-it-works). Os springs seguem física de verdade, e uma animação que interrompe outra começa de onde a view está, na velocidade em que ia.

## O que ele cobre

Os guias abaixo tratam de views do NativeScript. Para elementos HTML, use os guias Web acima.

- [25 presets](./presets) para entrar, sair e chamar atenção: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Springs](./transitions#springs) descritos pela sensação (`bouncy`), por `bounce` e `duration`, ou por rigidez, amortecimento e massa.
- [Keyframes e tweens](./transitions#tweens) com um easing por trecho e tempos de keyframe exatos.
- [Stagger](./stagger) entre várias views, a partir da primeira, da última ou do centro.
- [Sequências](./sequences) que começam cada passo quando o anterior parece pronto.
- [Efeitos de press](./press) que acompanham o dedo e soltam quando um scroll assume.
- [Diretivas e um componente de transição para Vue](./vue) na entrada opcional `@rafaelaugusto/jolt/vue`.
- [Entrada de texto](./text) por letra ou palavra no iOS e no Android, mantendo uma única Label acessível.
- [Interrupções](./interrupting) que pegam o valor e a velocidade na tela, sem pulo.
- [Reprodução nativa](./how-it-works): Core Animation no iOS e `ObjectAnimator` no Android nas tracks padrão de views; os custos de execução são documentados por API.

- [Dimensões reais](./size): anime width, height e auto enquanto o texto se reorganiza e os vizinhos se movem.
- [Campo de visão da câmera SceneKit](./scene-camera): coordene zoom em perspectiva com motion values no iOS.

## Por onde começar

1. [Instale o Jolt](./install) e escolha a entrada para sua plataforma.
2. **NativeScript:** leia [Animando](./animating) e escolha uma [transição](./transitions) ou um [preset](./presets).
3. **Web:** comece pelo [runtime Web](./web-runtime) ou pelo [adaptador Vue para DOM](./web-vue).

O Jolt está em release candidate; consulte a [instalação](./install) para a versão publicada. Os dois runtimes podem ser usados diretamente, com integrações opcionais para frameworks.

## Como ler o menu {#reading-the-menu}

O menu lateral destaca recursos com três selos:

- **Novo:** introduzido na edição documentada.
- **Atualizado:** mudança relevante em um recurso existente.
- **Beta:** API ou adaptador experimental cujo contrato pode mudar.

Novo e Atualizado expiram quando a versão documentada muda. Beta permanece até a estabilização da API. A descrição do selo diferencia um recurso publicado de um candidato em código; o guia informa as pendências de merge ou publicação. O selo sozinho não significa que o recurso já foi lançado.

<Clip name="docs-navigation-desktop" caption="Chromium no macOS, viewport de desktop: Selos da edição atual no menu, navegação por teclado e temas claro/escuro. Demonstra a navegação da documentação, não um app nativo." />

<Clip name="docs-navigation-mobile" caption="Chromium no macOS, viewport móvel emulado: abertura do menu e navegação pelos itens com selo. Emulação no navegador, não gravação em celular físico." />
