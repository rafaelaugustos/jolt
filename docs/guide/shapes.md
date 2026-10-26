# Shapes: draw and morph

Draw a checkmark, reveal a ring, or turn a play symbol into pause bars. The optional `@rafaelaugusto/jolt/shapes` entry paints an owned vector surface over a NativeScript view. Its `shape()` handle follows the same creation/animation pattern as gradients. This checkout adds the API for the next beta; rebuild Android to include the native renderer.

<Clip name="shapes-ios" caption="iOS simulator: real taps draw a checkmark, ring and underline, interrupt a play/pause morph, pause/resume drawing and switch shapes under Reduce Motion. English UI; original playback timing." />
<Clip name="shapes-android" caption="Android emulator: the same vector drawing and morphing through real ADB taps, including interruption, pause/resume and Reduce Motion. English UI; original playback timing, not a physical-device performance measurement." />

## Draw a path

Use a dedicated empty view and create the shape after native layout. The view supplies sizing, accessibility and input; the renderer does not install a gesture handler or change the view's hit geometry.

```ts
import { shape } from '@rafaelaugusto/jolt/shapes'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const check = scope.add(
  shape(checkView, {
    d: 'M22 51 L43 71 L79 28',
    viewBox: [0, 0, 100, 100],
    stroke: '#C8E4CF',
    strokeWidth: 5,
    lineCap: 'round',
    strokeEnd: 0,
  }),
)

const drawing = check.animate({ strokeEnd: 1 }, { duration: 900, ease: 'easeInOut' })
drawing.pause()
drawing.progress = 0.5
drawing.play()
// At permanent teardown:
scope.dispose()
```

`viewBox` is `[minX, minY, width, height]`, with positive dimensions. The path fits proportionally and is centered inside the view; stroke width uses viewBox units and scales with the geometry. Drawing is clipped to the host's bounds. Resize updates this mapping without rebuilding the running path animation.

Static options are `stroke` (default `#202630`), `fill` (transparent), `strokeWidth` (0–1000, default 2), `lineCap` (`butt`, `round`, `square`; default `round`), `lineJoin` (`miter`, `round`, `bevel`; default `round`) and `fillRule` (`nonzero` or `evenodd`; default `nonzero`). Dispose/recreate to change style or viewBox. The surface leaves the original background, transforms and touch handling intact and draws over existing content.

`strokeStart` and `strokeEnd` select fractions in 0–1. If start is greater than or equal to end, the stroke is empty; fill is always complete. Partial stroke drawing requires one continuous subpath. Compound paths support fill, full stroke and morphing; use separate shape views when each contour needs its own drawing progress.

## Morph matching geometry

```ts
const icon = shape(iconView, {
  d: 'M20 25 L80 50 L20 75 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#F4B992',
  strokeWidth: 0,
})
icon.animate({ d: 'M20 25 L80 25 L50 80 Z' }, 'snappy')
// Retargeting starts from the native presentation, even during an unfinished morph.
icon.animate({ d: 'M20 25 L80 50 L20 75 Z' }, 'snappy')
```

SVG `M/L/H/V/C/S/Q/T/A/Z`, relative forms, implicit repetitions and multiple subpaths are supported. Setup normalizes shorthand and relative coordinates; elliptical arcs become cubic Bézier segments of at most 90 degrees. Morphing requires the same normalized commands, subpaths and control-point count. There is no automatic topology matching. Different arc sweeps can normalize to different numbers of cubics and therefore be incompatible.

An incompatible destination throws before interrupting existing work. Use `set({ d: newPath, strokeStart: 0, strokeEnd: 1 })` for an immediate topology change. Input is bounded to 20,000 characters, 256 normalized commands and coordinates within ±1,000,000. A sampled animation has a 262,144-component budget; overly complex path/curve combinations are rejected before replacing the current animation.

## Playback and ownership

`animate({ d?, strokeStart?, strokeEnd? }, transition?)` accepts a destination and the existing tween/spring names, easing, delay and repeat controls. Use `set()` followed by `animate()` for explicit start/end drawing. One shape owns one combined geometry/trim animation; properties omitted from a retarget keep their current presentation. Named additive layers and arrays of shape keyframes are not part of this API.

The returned handle exposes `finished`, `pause()`, `play()`, `stop()` and finite `progress`. Springs project the interrupted vector velocity onto their new destination. Trim stays within 0–1 while geometry may overshoot. `shape.stop()` holds the current presentation; `set()` stops and replaces it immediately. `snapshot()` reads current path/trim and native bounds/animation counts on demand; it does not install an observer.

Backgrounding pauses active work. If NativeScript unloads the view while backgrounded, the native surface is released and the paused program resumes when it is loaded in the foreground. A regular unload or native-view replacement cancels playback, releases the old surface and restores its held geometry on load. Explicitly paused work stays paused. `dispose()` removes the shape and its listeners permanently and is idempotent. A view can own only one shape at a time.

Reduce Motion applies new destinations immediately. Enabling it during playback stops that handle (`finished` resolves `false`) and applies its requested destination without further animation. A scope can own the shape for cleanup or own individual playback handles for suspension; do not share one shape between independent owners.

## Native rendering

iOS uses explicit `CAShapeLayer` keyframes for the path and trim, with a native presentation marker for interruption. Apple requires compatible path segment/control-point structure for path interpolation. [CAShapeLayer path documentation](https://developer.apple.com/documentation/quartzcore/cashapelayer/path).

Android uses a compiled drawable, `Path`/`PathMeasure` and `ValueAnimator`. Paths and buffers are reused; morph coordinates and trim update in native code. Partial drawing uses `PathMeasure.getSegment()`. [Android PathMeasure documentation](https://developer.android.com/reference/android/graphics/PathMeasure).

JavaScript parses geometry and prepares curves at setup/commands, then handles lifecycle and completion boundaries. It does not draw or update the path every frame. Android drawing and NativeScript JavaScript still share the UI thread. These APIs do not imply a separate render thread or physical-device performance guarantees.

The four-language **Made of motion / Linework** preview is the 71st example. See [validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shapes.md).
