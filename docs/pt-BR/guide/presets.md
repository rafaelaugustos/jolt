# Presets

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

<Clip name="presets" caption="fadeInUp, popIn e shake no playground." />

|         |                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------- |
| Entrada | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Saída   | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Atenção | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

As direções seguem o animate.css: `fadeInUp` sobe de baixo, `fadeOutUp` sai para cima. Cada preset embutido é só keyframes e uma transição, listados em [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) e exportados como `presets`.

Os presets de atenção usam [keyframes relativos](./animating#keyframes-relativos). Um card em `x: 40` faz o shake em torno de 40 e volta para lá. `pulse`, `heartbeat`, `jelly` e `tada` preservam a escala atual de cada eixo; `flash` volta para a opacidade original. `spin` acrescenta uma volta completa à rotação atual.

Passe `{ relative: false }` para usar os keyframes absolutos originais. Os presets de entrada e saída continuam absolutos.

## Mudando o tempo ou a curva de um preset

Opções só de tempo (`delay`, `repeat`, `stagger`) mantêm as curvas do preset. Opções com curva (`duration`, `ease`, um spring) as substituem:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // o spring do preset, 100ms depois
animate(card, 'fadeInUp', { duration: 600 }) // um tween de 600ms no lugar
animate(card, 'fadeInUp', 'bouncy') // um spring bouncy no lugar
```

## Presets personalizados

Use `definePreset` para registrar keyframes e uma transição com um nome:

```ts
import { animate, definePreset, sequence } from '@rafaelaugusto/jolt'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    cardIn: true
  }
}

definePreset('cardIn', {
  keyframes: { opacity: [0, 1], y: [40, 0] },
  transition: { type: 'spring', bounce: 0.2, opacity: { duration: 150 } },
})

animate(card, 'cardIn')
animate(cards, 'cardIn', { stagger: 40 })
sequence([
  [logo, 'popIn'],
  [card, 'cardIn'],
])
```

Coloque o registro num módulo importado na inicialização do app, antes de qualquer animação usar o nome. A declaração de `Presets` amplia `PresetName` no TypeScript; ela não registra nada em tempo de execução. Usar um nome sem registro gera um erro.

A definição usa o tipo exportado `Preset`. A `transition` aceita as mesmas opções de `animate()`, incluindo transições por propriedade e `stagger`. As opções passadas para `animate()` substituem esses valores seguindo as regras acima.

Registrar um nome personalizado de novo troca a definição para as próximas animações; as que já estão rodando continuam com suas curvas. Os nomes dos presets embutidos não podem ser substituídos por `definePreset`. O objeto exportado `presets` continua contendo apenas os embutidos.
