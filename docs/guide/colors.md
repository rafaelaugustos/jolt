# Colors

Background, border and text colors use `animate()` on iOS and Android:

<Clip name="colors" caption="Background and text colors interpolated in OKLab." />

```ts
animate(
  card,
  {
    backgroundColor: '#263b27',
    borderColor: '#b6ee64',
    color: '#d5ff91',
  },
  { duration: 800 },
)
```

Use a NativeScript color string or a `Color` object. Arrays define keyframes; `null` means the visible color when the animation starts:

```ts
animate(
  card,
  {
    backgroundColor: [null, '#38273f', '#21394a'],
  },
  { duration: 1800, times: [0, 0.3, 1] },
)
```

Colors default to a 300 ms tween. You can set per-property transitions, springs, delays, repeats and stagger as usual. Spring progress is clamped at the first and last color; packed colors do not inherit a scalar velocity. Color values remain absolute with `relative: true`.

## Interpolation

Jolt computes intermediate colors in OKLab with premultiplied alpha, clips the result to sRGB, and gives the samples to the native animator. This avoids the dark RGB midpoint between saturated colors and prevents a transparent endpoint from adding its invisible hue to the transition. No JavaScript runs for each frame.

Transforms and colors can run together. A new animation takes over from the color on screen. Stop a single color while the rest keeps playing:

```ts
stop(card, ['backgroundColor'])
```

Stopping commits the visible color to the NativeScript model and resolves the animation with `false`. Completion leaves the final color in the model. Changing a color externally or unloading the view cancels that property's native playback.

## Borders and backgrounds

`borderColor` requires the same starting color on all four edges. Different widths and corner radii are supported. Gradients, images, clip paths and shadows are preserved; their own parameters are not interpolated. A background color beneath an opaque gradient remains covered by it. On iOS, Core rasterizes image backgrounds together with their color: background-color playback on these views is skipped with `false`, keeping the image and the final model color.

iOS animates the existing background or border layer. Android uses a small Java `ObjectAnimator` target that updates Core's drawable without replacing its geometry or image. This target adapts to Core replacing the drawable during playback. Its compatibility depends on Core's native drawable fields; if those fields are unavailable, playback is skipped and the final model color is kept. Rebuild the Android app after installing or upgrading Jolt so the native target is included.

## Text

On iOS, `color` supports Label and Button. Jolt draws a UILabel alpha mask once and animates a solid layer through it, preserving native wrapping, fonts and glyph positions. Spans and formatted strings with their own explicit color retain that color. Text and accessibility stay on the original native label. Editing text, changing its layout or restyling it cancels playback and restores the current model text. Starting `animateText()` also releases an active text-color mask.

Color emoji and some symbol ranges, attachments, text shadows and masks above four million pixels are skipped on iOS: the final model color is applied and `finished` resolves with `false`. TextField and TextView color animation is not supported on iOS. There is no fallback that animates an entire screenshot of the control.

On Android, `color` supports TextBase controls and uses the native text color setter. Android's explicit formatted-span colors stay intact.
