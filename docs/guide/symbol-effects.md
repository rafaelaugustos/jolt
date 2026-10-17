# SF Symbol effects

`symbolEffect()` plays Apple's native symbol effects on an `Image`. Use an SF Symbol source such as `sys://bell.fill`.

<Clip name="symbols" caption="Bounce, pulse and replace on SF Symbols." />

```ts
import { symbolEffect } from '@rafaelaugusto/jolt'

symbolEffect(bell, 'bounce')
symbolEffect(heart, 'pulse')
symbolEffect(wifi, 'variableColor')
symbolEffect(favorite, { replace: 'sys://heart.fill' })
```

The target is one NativeScript `Image`, or a ref holding one. Playback runs in UIKit, without JavaScript work per frame. This API is separate from the transform presets in `animate()`.

## Effects and options

| Effect                      | Behavior                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `bounce`                    | Bounces the symbol once.                                                                        |
| `pulse`                     | Pulses its opacity once.                                                                        |
| `variableColor`             | Animates the symbol's layers, such as the bars in `wifi`. The appearance depends on the symbol. |
| `scale`                     | Scales the symbol and holds it until stopped.                                                   |
| `{ replace: 'sys://name' }` | Transitions to another symbol and updates the Image's `src` and `imageSource`.                  |

`speed` is a positive multiplier of Apple's timing, not a duration in milliseconds. Bounce, pulse and variable color accept `repeat: true` to keep playing. Scale and replacement do not repeat.

```ts
const loading = symbolEffect(wifi, 'variableColor', { repeat: true, speed: 0.8 })
loading.stop()

const selected = symbolEffect(star, 'scale')
selected.stop() // removes the held scale
```

## Completion and cleanup

The result has `finished`, `stop()` and `then()`, like other Jolt animations:

```ts
const completed = await symbolEffect(bell, 'bounce')

await sequence([
  () => symbolEffect(favorite, { replace: 'sys://heart.fill' }),
  () => animate(card, 'popIn'),
])
```

Finite effects resolve with `true` when UIKit reports completion. Stopped, superseded or skipped effects resolve with `false`. Scale and repeating effects stay pending until stopped. Stopping a replacement keeps the destination icon.

A new `symbolEffect()` on the same Image cancels the previous one. Unloading the view or changing its source also cancels it. Calls made before the view or its image loads wait for it. Use the returned handle to stop a symbol effect; `stop(view)` controls the properties played by `animate()`.

Replacement loads the new symbol synchronously, preserving `loadMode`, tint and symbol configuration. If `src` is bound to application state, keep that state in sync too so a later render doesn't restore the previous icon. Avoid controlling the same Image with `iosSymbolEffect` while Jolt owns an effect.

## Compatibility

Effects require **iOS 17+**. On earlier iOS versions, decorative effects are skipped and replacement updates the icon immediately. An unavailable symbol leaves the current icon unchanged and resolves with `false`.

With Reduce Motion enabled when playback starts, decorative effects are skipped and replacement is immediate. On Android every call is a no-op resolving with `false`, including replacement. A bitmap cannot play a symbol effect; replacing it with a symbol is immediate.

For Apple's effect definitions, see the [Symbols framework](https://developer.apple.com/documentation/symbols?language=objc).
