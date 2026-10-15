# Liquid images

`liquid()` gives an iOS `Image` a slow, continuous deformation. Parts of the texture move relative to each other while the image's boundary stays fixed.

```ts
import { liquid } from '@rafaelaugusto/jolt'

const flow = liquid(orb, { intensity: 0.9, duration: 7200 })

flow.pause() // freeze the current shape
flow.resume() // continue from that shape
flow.stop() // remove the effect and restore the original image
```

## Options

| Option      | Default | Meaning                                                                |
| ----------- | ------- | ---------------------------------------------------------------------- |
| `intensity` | `0.7`   | Deformation strength from `0` to `1`. Zero leaves the image unchanged. |
| `duration`  | `8000`  | Milliseconds per seamless cycle. Must be finite and greater than zero. |

The handle controls this effect only. Transforms and opacity still belong to `animate()`; stopping those animations does not stop the liquid effect. Call `flow.stop()` when its owner is disposed. Calling `liquid()` again on the same image replaces the previous effect. Invalid options leave the running effect alone.

## Rendering and lifecycle

Jolt prepares a periodic displacement field on a 24 × 24 texture grid. SpriteKit interpolates 64 stages per cycle through a native repeating action. The GPU deforms the pixels; there is no JavaScript frame callback, timer, custom shader compilation or sequence of image assets.

The native renderer lives inside the existing image view. It keeps the image's alpha, accessibility, masks, transforms and stretch mode (`aspectFit`, `aspectFill`, `fill` or `none`). Layout changes resize the renderer without restarting the cycle. The original image source stays in the NativeScript model.

Pause freezes the current deformation. App inactivity also pauses rendering; becoming active resumes unless you explicitly paused it. Unloading releases the scene, texture and native action; loading recreates the effect. A source change rebuilds the texture. Reduce Motion or hiding the image removes the renderer and shows the original image; turning motion back on or showing the image recreates it.

## Supported content

This helper accepts NativeScript `Image` targets and their template refs. It uses one static raster image. Animated images, template images/SF Symbols, missing images and images above 16 megapixels keep their original rendering. Android returns an inert handle without accessing iOS APIs.

The effect deforms the existing artwork. It does not generate new folds or simulate a fluid, and it is not a general shader API for arbitrary views. That work is tracked separately in [#35](https://github.com/rafaelaugustos/jolt/issues/35).

See the assistant's [Voice screen](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/assistant/Voice.vue) for a complete example with pause/resume and unmount cleanup.
