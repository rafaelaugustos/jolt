# Press

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Three press effects on Android." />

Animates to the given values while a finger is down, and back to where the view was once it lifts, or once the touch is cancelled by a scroll taking over. Views with `isEnabled` set to `false` don't react. It returns a function that removes the effect.

## Press on its own layer {#layered-press}

**Unreleased fix:** use a dedicated layer name when press feedback should coexist with an entrance or other motion. Translation and rotation contributions return to `0`; scale and opacity contributions return to `1`. Releasing or cancelling the touch therefore restores the current base, including a nonzero translation or non-unit scale. Removing the effect also clears a settled press contribution.

```ts
set(card, { x: 24, scale: 1.5 })
const remove = press(card, { x: 8, scale: 0.88 }, { layer: 'press' })
animate(card, { x: 80 }, 'snappy')
// Later: remove()
```

Reserve that layer name for this press effect. Other layers remain independent. Without `layer`, press keeps its existing behavior of animating the base and returning to the captured resting values.

<Clip name="motion-rfc-ios" caption="iOS 26.2 simulator, English Layers demo with the opt-in RFC audit: real held touch, shake removal during the entrance, release to the non-unit base, two endless layers and a composition-window rollover. Native playback at original speed; no physical-device performance claim." />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 emulator, English Layers demo with the opt-in RFC audit: real ADB taps and held touch exercise the same press, independent layers and window rollover. Original speed; emulator correctness evidence." />
