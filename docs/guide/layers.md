# Layered motion

A property normally has one animation at a time: a new one takes it over. A layer plays next to it instead. A shake rides on top of a drag, a breathing pulse keeps going while the card moves, and a press scales a card that is still entering:

```ts
animate(card, { x: 120 }, 'snappy') // the base
animate(card, 'shake', { layer: 'feedback' }) // on top of it
```

<Clip name="layers-ios" caption="A breathing layer keeps going while the card moves and shakes, then the card is dragged, on the iOS simulator. Real-time playback." />

## How layers combine

A layer is named by the `layer` option. Its keyframes are what it adds: translations and rotations **add** to the base and to other layers, scale and opacity **multiply**. A shake is `x: [0, -10, 10, 0]` around wherever the card is, and a pulse is `scale: [1, 1.08, 1]` of whatever scale it has. The relative presets, like `shake`, `pulse` and `heartbeat`, work as layers unchanged.

```ts
animate(card, { y: -8 }, { duration: 200, layer: 'hover' }) // stays lifted
animate(
  card,
  { scale: [1, 1.08] },
  {
    duration: 700,
    repeat: Infinity,
    repeatType: 'reverse',
    layer: 'breathe',
  },
)
```

Layers apply to `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` and `opacity`. Colors, corners, borders, shadows and paths keep a single owner. A layer takes every transition `animate()` does and returns the same animation, with `pause()`, `play()` and `progress`. It works in sequences, scopes and motion states too.

## Replacing and stopping

Each layer works like a property of its own. A new animation on the same layer replaces it, starting from what the layer adds at that moment and with its velocity. A new animation without a layer replaces the base and leaves the layers running. With [reduced motion](./configure#reduced-motion), transform layers jump to their end, and opacity layers still play.

```ts
stop(card, ['x'], { layer: 'feedback' }) // that layer stops, and what it adds goes away
stop(card, undefined, { layer: 'hover' }) // also after it finished
stop(card) // everything stops; what is on screen becomes the new value
```

To ease a layer out instead, animate it back to nothing: `animate(card, { scale: 1 }, { duration: 250, layer: 'breathe' })`.

A drag keeps its layers: while you drag, a shake or a pulse on the same view goes on.

<Clip name="layers-android" caption="The card shaken while it is dragged, and its breathing layer turned on and off, on the Android emulator. Real-time playback." />

## How it plays

While a property has layers, Jolt plays its base and layers as one composite native track. It samples the composition when something changes: an animation starts, ends, pauses, seeks or is stopped, or a drag moves the base. Nothing runs in JavaScript between those moments. Endless layers become a native loop over the least common multiple of their periods, up to 30 seconds; beyond that, a native composer plays the layers on their own clocks without rebuilding anything. An app built without Jolt's native classes falls back to sampling the composition again every few seconds. When the last layer is gone and adds nothing, the property goes back to a plain animation.

## Motion values

[`animate(value, target, { layer })`](./motion-values#layers-on-a-value) adds scalar contributions before all derived mappings. Value layers use zero as neutral, including when mapped to scale or opacity. See the motion values guide for stopping, dragging and native composition.

**Fixed in 0.1.0-rc.2:** [press on a dedicated layer](./press#layered-press) returns only its own contribution to neutral. Compiled view-layer playback also catches up after native keyframe allocation, so setup time does not leave a newly composed track behind its source clock.

<Clip name="motion-rfc-ios" caption="iOS 26.2 simulator, English Layers demo with the opt-in RFC audit: real held touch, shake removal during the entrance, release to the non-unit base, two endless layers and a composition-window rollover. Native playback at original speed; no physical-device performance claim." />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 emulator, English Layers demo with the opt-in RFC audit: real ADB taps and held touch exercise the same press, independent layers and window rollover. Original speed; emulator correctness evidence." />
