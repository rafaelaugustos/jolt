# Image effects

`imageEffect()` adds ripple, touch distortion and dissolve to a NativeScript `Image`. These APIs require a native rebuild after installing the package. They operate on loaded raster images, not arbitrary view trees, SVG, video or animated images.

```ts
import { imageEffect } from '@rafaelaugusto/jolt'

const ripple = imageEffect(photo, 'ripple', {
  origin: { x: 80, y: 120 }, // Image-local DIPs
  amplitude: 12,
  radius: 96,
  duration: 700,
})
await ripple.finished // true on completion, false on stop/replacement
```

## Presets and playback

| Preset       | Input                                             | Result                                                          |
| ------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| `ripple`     | Local origin, radius, amplitude                   | A travelling wave that returns to the original image            |
| `distortion` | Native pointer movement                           | Bounded displacement around the touch, settling back on release |
| `dissolve`   | Loaded `to: ImageSource`, optional integer `seed` | Deterministic noise transition between two images               |

Origins, radius and amplitude are in DIPs in the image's local coordinate system. The default origin is the center. Radius defaults to 96; amplitude defaults to 8 and accepts 0–64; duration defaults to 650 ms; seed defaults to 1 and accepts integers 0–65535.

```ts
const transition = imageEffect(photo, 'dissolve', {
  to: nextImageSource,
  seed: 42,
  duration: 900,
  paused: true,
})
transition.progress = 0.4
transition.play()
transition.pause()
transition.reverse() // reverses and plays from the current progress
transition.finish() // completes at the current direction's endpoint
```

Finite effects expose progress from 0 to 1. `progress = value` preserves the paused/running state; call `pause()` first for a still preview. Successful forward dissolve commits `to` to `photo.imageSource`. Reverse completion keeps the original source. `stop()` restores the original pixels and resolves `false`. Completed or stopped handles cannot restart.

Distortion is continuous until stopped. It supports pause/play, but rejects progress seeking and reverse. Its `finish()` behaves like `stop()`. Touch processing and settling happen natively; JavaScript receives no pointer or frame callback.

## Platforms and fallback

| Platform                                                                  | Renderer                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| iOS with Metal support                                                    | Metal texture rendering inside the existing image view |
| Android 13 / API 33+, hardware acceleration                               | AGSL `RuntimeShader`                                   |
| Older Android, unavailable renderer, unsupported image, or reduced motion | Explicit fallback                                      |

Fallback keeps the original image for decorative effects and resolves `false`. Dissolve immediately commits its destination and resolves `true`, including when requested paused. This guarantees that a content update is not lost when animation is unavailable. Check `effect.diagnostics.backend` and `reason` if the application needs to explain or choose another presentation. A native setup error may also provide `detail` for debugging.

The output surface is capped at 4,194,304 physical pixels. Transparent pixels and the image's stretch mode are preserved. The renderer does not animate layout or replace navigation. Large source images should still be decoded at an appropriate display size by the application.

## Ownership and lifecycle

An image has one active `imageEffect()`, `liquid()` or `zoomable()` controller. Starting another stops the previous one. Ordinary outer-view animation can run alongside an image effect; avoid replacing its drawable/native image yourself.

Unloading, hiding, changing the active source/stretch/tint or changing the image's laid-out size stops an effect and releases its resources. A not-yet-loaded source waits for loading and positive layout. Backgrounding pauses native playback; returning resumes only if the user did not pause it. OS reduced-motion changes are observed on iOS. Global `configure()` preferences are read when the effect starts; stop and recreate a continuous effect after changing them.

`diagnostics` reports the selected backend, frame count, owned texture bytes, peak owned texture bytes, preparation time in milliseconds and longest observed draw interval. These are debugging measurements, not a GPU profiler or a promise of a frame-rate target. Resources owned by a completed/stopped handle report zero texture bytes; the platform may retire GPU allocations asynchronously. The surface pixel cap is a conservative allocation guard, not a measured performance guarantee.

Changing padding, border widths or corner radii also stops an active effect, so its surface cannot retain stale clipping geometry. Borders and backgrounds stay outside the displacement texture.

The [demo](./demo) image lab includes tap origins, native drag, playback, reverse, scrub, restore, four stretch modes, rounded borders and reduced-motion controls. The landscape source dissolves into portrait artwork with a transparent corner.
