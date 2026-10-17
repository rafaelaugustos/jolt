# Presets

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

<Clip name="presets" caption="fadeInUp, popIn and shake from the playground." />

|           |                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Enter     | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Exit      | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Attention | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

Directions follow animate.css: `fadeInUp` comes up from below, `fadeOutUp` leaves upwards. Each built-in preset is plain keyframes and a transition, listed in [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) and exported as `presets`.

Attention presets use [relative keyframes](./animating#relative-keyframes). A card at `x: 40` shakes around 40 and returns there. `pulse`, `heartbeat`, `jelly` and `tada` preserve the current scale of each axis; `flash` returns to the original opacity. `spin` adds a full turn to the current rotation.

Pass `{ relative: false }` to use the original absolute keyframes. Enter and exit presets remain absolute.

## Changing a preset's timing or curve

Options with timing only (`delay`, `repeat`, `stagger`) keep the preset's curves. Options with a curve (`duration`, `ease`, a spring) replace them:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // the preset's spring, 100ms later
animate(card, 'fadeInUp', { duration: 600 }) // a 600ms tween instead
animate(card, 'fadeInUp', 'bouncy') // a bouncy spring instead
```

## Custom presets

Register keyframes and a transition under a name with `definePreset`:

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

Put the registration in a module imported during app startup, before any animation uses the name. The `Presets` declaration extends `PresetName` for TypeScript; it does not register anything at runtime. Using an unregistered name throws an error.

The definition has the exported `Preset` type. Its `transition` takes the same options as `animate()`, including per-property transitions and `stagger`. Options passed to `animate()` override those defaults using the rules above.

Registering a custom name again replaces its definition for future animations; running animations keep their existing tracks. Built-in names cannot be replaced through `definePreset`. The exported `presets` object continues to contain only the built-ins.
