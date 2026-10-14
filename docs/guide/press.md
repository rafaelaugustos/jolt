# Press

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

Animates to the given values while a finger is down, and back to where the view was once it lifts, or once the touch is cancelled by a scroll taking over. Views with `isEnabled` set to `false` don't react. It returns a function that removes the effect.
