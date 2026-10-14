# Presets

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

|           |                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Enter     | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Exit      | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Attention | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

Directions follow animate.css: `fadeInUp` comes up from below, `fadeOutUp` leaves upwards. Every preset is plain keyframes and a transition, listed in [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) and exported as `presets`.

## Changing a preset's timing or curve

Options with timing only (`delay`, `repeat`, `stagger`) keep the preset's curves. Options with a curve (`duration`, `ease`, a spring) replace them:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // the preset's spring, 100ms later
animate(card, 'fadeInUp', { duration: 600 }) // a 600ms tween instead
animate(card, 'fadeInUp', 'bouncy') // a bouncy spring instead
```
