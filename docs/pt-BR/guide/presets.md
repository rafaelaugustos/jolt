# Presets

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

|         |                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------- |
| Entrada | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Saída   | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Atenção | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

As direções seguem o animate.css: `fadeInUp` sobe de baixo, `fadeOutUp` sai para cima. Todo preset é só keyframes e uma transição, listados em [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) e exportados como `presets`.

## Mudando o tempo ou a curva de um preset

Opções só de tempo (`delay`, `repeat`, `stagger`) mantêm as curvas do preset. Opções com curva (`duration`, `ease`, um spring) as substituem:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // o spring do preset, 100ms depois
animate(card, 'fadeInUp', { duration: 600 }) // um tween de 600ms no lugar
animate(card, 'fadeInUp', 'bouncy') // um spring bouncy no lugar
```
