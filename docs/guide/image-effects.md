# Image effects

Experimental Web equivalent: see [Web particles, surfaces and images](./web-surfaces). Available since RC.10.

`imageEffect()` adds ripple, touch distortion, dissolve and liquid masks to a NativeScript `Image`. These APIs require a native rebuild after installing the package. They operate on loaded raster images, with optional local video textures on iOS. Arbitrary view trees, SVG and animated images remain unsupported.

<Clip name="image-effects-ios" caption="Ripple, touch distortion and dissolve on a raster fixture using Metal in the iOS simulator." />

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

Unloading, hiding or changing the active image source/stretch/tint stops an effect and releases its resources. A not-yet-loaded source waits for loading and positive layout. Backgrounding pauses native playback; returning resumes only if the user did not pause it. OS reduced-motion changes are observed on iOS. Global `configure()` preferences are read when the effect starts; stop and recreate a continuous effect after changing them.

`diagnostics` reports the selected backend, frame count, owned texture bytes, peak owned texture bytes, preparation time in milliseconds and longest observed draw interval. These are debugging measurements, not a GPU profiler or a promise of a frame-rate target. Resources owned by a completed/stopped handle report zero texture bytes; the platform may retire GPU allocations asynchronously. The surface pixel cap is a conservative allocation guard, not a measured performance guarantee.

Changing size, padding, border widths or corner radii refreshes the surface and clipping while preserving progress, pause, direction and bindings. Replacement textures are prepared before the swap; the pixel budget still applies. A failed resize stops safely and restores the source. Borders and backgrounds stay outside the displacement texture.

The [demo](./demo) image lab includes tap origins, native drag, playback, reverse, scrub, restore, four stretch modes, rounded borders and reduced-motion controls. The landscape source dissolves into portrait artwork with a transparent corner.

<Clip name="web-image-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

## Renderer scope and native measurements

The backend supports static images and local iOS video textures. One-time application snapshots stay frozen; live subtrees, refreshed snapshots, backdrop sampling, camera/WebView and hosted SwiftUI filters are not provided by this API. The design, input mapping, ownership, fallback, pass counts and reproducible measurements are documented in the [renderer report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/image-renderer.md). `diagnostics.frameIntervalsMs` retains at most 512 active native draw-callback intervals in milliseconds. Paused gaps are excluded; these are not GPU or presentation times.

<Clip name="image-profile-ios" caption="iPhone 17 simulator, iOS 26.2, English. Real taps run image ripple, two concurrent dissolves and cancellation. Original playback speed; timing measurements use a separate run without recording. No physical-device performance claim." />

## Native shader parameters

`bind()` connects a numeric Jolt value, including a retained `springValue()` or its `.to()` mappings, to the renderer. `bindScroll()` reads a NativeScript ScrollView's native offset directly. Neither connection installs a JavaScript frame subscription. App-owned scroll listeners or explicit `subscribe()` calls still run when requested.

```ts
import { animate, imageEffect, motionValue, springValue } from '@rafaelaugusto/jolt'

const target = motionValue(0)
const spring = springValue(target, { stiffness: 100, damping: 13 })
const effect = imageEffect(photo, 'ripple', { paused: true })
const unbind = effect.bind('progress', spring)
animate(target, 1, { duration: 0 })
animate(target, 0, { duration: 0 }) // interrupt/reverse the retained spring

// Replaces just the progress binding; offsets are DIPs.
const stopScroll = effect.bindScroll('progress', scroll, {
  range: [0, 240],
  output: [0, 1],
  axis: 'y',
})
effect.set('amplitude', 16)
// On owner disposal:
effect.stop()
spring.dispose()
```

| Parameter            | Units/range                           |
| -------------------- | ------------------------------------- |
| `progress`           | 0–1; unavailable for touch distortion |
| `amplitude`          | 0–64 local DIPs                       |
| `radius`             | Positive local DIPs                   |
| `originX`, `originY` | Local DIPs                            |

Native spring overshoot is clamped for progress/amplitude, and radius stays positive. `.bindScroll()` supports ascending/descending offset ranges and clamps outside them. These are typed inputs to Jolt's presets; this API does not compile arbitrary application shaders.

Each parameter has one binding owner. Rebinding or an explicit `set()` replaces that parameter's owner; stale disposers are harmless. Setting `progress` or calling `play()` takes progress back from its binding. `pause()` freezes the finite timeline; an attached native source continues to own its parameter. Dispose the binding or pause its spring to hold a live input. `stop()` releases all bindings and native scroll observers. Work runs on the native UI/rendering paths and can still contend with the UI thread.

## Liquid shape masks

`liquid-mask` clips the source with a smooth union of 1–8 circles or rounded rectangles. Every shape interpolates between `from` and `to` using the same progress; reversing progress reverses fusion and separation. This changes the visible contour, unlike [`liquid()`](./liquid).

```ts
const mask = imageEffect(photo, 'liquid-mask', {
  paused: true,
  mask: {
    blend: 22, // union softness in DIPs; 0 gives a hard union; maximum 128
    shapes: [
      {
        kind: 'circle',
        from: { x: 0.25, y: 0.5, radius: 0.18 },
        to: { x: 0.43, y: 0.5, radius: 0.22 },
      },
      {
        kind: 'rectangle',
        from: { x: 0.77, y: 0.5, width: 0.3, height: 0.5, radius: 0.09 },
        to: { x: 0.59, y: 0.5, width: 0.44, height: 0.6, radius: 0.15 },
      },
    ],
  },
})
mask.progress = 0.5
mask.play()
mask.reverse()
```

Centers and rectangle sizes are normalized to the target width/height. Radius is a fraction of the shorter side, so circles remain circular during resize. Rectangle corner radii are capped at half its size. Shape centers may be off-canvas within −4…4; dimensions are positive and at most 4; radius is 0…2 (positive for circles).

The shader multiplies premultiplied source color and alpha by the mask coverage. Transparent areas expose the underlying content; the mask is decorative and does not change hit testing. Endpoints remain visible and reversible: unlike ripple/dissolve, a mask retains its renderer at either endpoint. `finish()` holds the current direction's endpoint; `finished` remains pending until `stop()`/replacement, which resolves `false`.

<Clip name="shader-inputs-liquid-mask-ios" caption="iPhone 17 Pro simulator, iOS 26.2, English. Actual XCTest taps and scroll gestures drive fusion/separation, paused and playing resize, and cleanup. The checkerboard shows transparent mask edges. Original speed; no physical-device claim." />

<Clip name="shader-inputs-liquid-mask-android" caption="Android API 36 emulator, English. Real ADB taps and swipes drive native spring/scroll inputs, reversible liquid masks, resize and cleanup through AGSL. Original speed; no physical-device performance claim." />

## Local video textures on iOS

```ts
const effect = imageEffect(photo, 'ripple', {
  paused: true,
  amplitude: 28,
  video: { src: absoluteLocalMP4Path, loop: true },
})
effect.progress = 0.35 // hold the deformation while decoded video keeps playing

effect.pauseVideo()
effect.playVideo()
effect.setVideo({ src: anotherAbsoluteLocalPath, paused: true })
effect.setVideo(null) // restore the poster texture, keeping the effect
```

The Image must have a loaded raster poster. This first backend accepts local, unprotected video decoded by AVFoundation, with silent playback; test fixtures use SDR H.264 MP4 at 640×360. Network streams, DRM, camera, audio synchronization, HDR color guarantees and Android/Web video are outside this contract. Video cannot be used as a dissolve destination. Decode failures keep the last available pixels and expose `diagnostics.videoStatus`; missing local paths are rejected without replacing a live video source.

AVPlayer owns the clock; AVPlayerItemVideoOutput supplies frames to a Metal texture cache. Pixel buffers do not pass through JavaScript. Video pause is independent of the effect timeline. A paused frame survives resize, source replacement releases the old player/output, and backgrounding suspends both rendering and video while preserving explicit pauses. Stop/unload releases the player, output, cache, bindings and textures. Source frames and output surfaces each have a 4,194,304-pixel cap; decoder memory is additional.

Stopped handles retain the last diagnostic counters/status, with current owned texture bytes set to zero. `loop` defaults to `true` and video `paused` defaults to `false`.

`diagnostics.videoFrames` counts decoded frames consumed, `videoTime` reports player seconds, and `nativeParameterWrites` counts changed native parameter values. `resizeCount` records surface refreshes. On iOS, `renderCpuMs` accumulates draw/encoding CPU time and `renderGpuMs` accumulates completed Metal command-buffer GPU durations; these are not presentation latency. Android does not expose those two counters (zero). Texture counters exclude decoder pools, drawables and other app resources; the video peak is a conservative in-flight estimate. See the [validation and measurements](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shader-textures.md) for instrumented checks, process memory and environment limits.

<Clip name="shader-video-ios" caption="iPhone 17 Pro simulator, iOS 26.2, English. Real taps show decoded Big Buck Bunny video through a held ripple, video pause/resume, resize, source replacement and poster restoration. Original speed. Simulator acceptance was explicitly authorized; this is not physical-device footage." />
