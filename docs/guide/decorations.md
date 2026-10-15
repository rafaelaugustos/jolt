# Corners, borders and shadows

Uniform borders use the same `animate()` API on iOS and Android:

```ts
card.borderRadius = 8
card.borderWidth = 2
card.borderColor = '#b6ee64'

animate(card, { borderRadius: 40, borderWidth: 6 }, { duration: 800 })
```

All dimensions are numeric DIPs. Arrays, `null`, per-property transitions, springs, delays, repeats, stagger, sequences and selective stopping work as usual. Decoration properties default to a 300 ms tween. Springs may overshoot; rendered radii, widths and elevation are clamped to zero, and shadow opacity to 0–1. Explicit endpoints outside those ranges are rejected.

```ts
animate(card, { borderRadius: 0, rotate: 12 }, 'bouncy')
stop(card, ['borderRadius']) // rotation keeps playing
```

A replacement starts from the visible value. Stopping commits that value to the model and resolves with `false`. Unloading or externally changing the decoration cancels native playback. `relative: true` adds dimensions and shadow parameters to their values at the start.

## Geometry and layout

The starting widths, radii and edge colors must each be uniform. Clip paths and squircle corners are rejected. Individual corners, individual edge widths and arbitrary shape morphing are not supported. These restrictions are checked before `animate()` changes any target.

`borderRadius` animates the background outline; native content clipping follows Core's final style. On iOS the radius is capped at half the shortest side, and the shadow follows the same sampled curve.

`borderWidth` animates the visual stroke. NativeScript lays out text and children using the final width immediately; it does not animate padding or remeasure content per frame. For fixed content placement, animate the border on a separate decorative view.

## iOS shadows

Configure one outer NativeScript `boxShadow`, then animate its parameters:

```ts
card.boxShadow = '0 4 8 rgba(0, 0, 0, 0.2)'
animate(
  card,
  {
    borderRadius: 40,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffsetX: -8,
    shadowOffsetY: 20,
  },
  { duration: 1000 },
)
```

| Property                         | Meaning                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `shadowOpacity`                  | Alpha, from 0 to 1                                                   |
| `shadowRadius`                   | Native blur radius in DIPs; **half** NativeScript's CSS `blurRadius` |
| `shadowOffsetX`, `shadowOffsetY` | Signed offsets in DIPs                                               |

Jolt animates Core's shadow layer rather than the view's clipped root layer. Changing the corner radius also animates the shadow path and its inner cutout. A zero-opacity endpoint stays hidden after Core redraws. Shadow color and spread remain unchanged. Animating shadow parameters requires exactly one existing outer shadow; shadow lists, inset shadows, spread and shadow color are not interpolated.

## Android shadows

Android exposes elevation-based shadows:

```ts
animate(
  card,
  {
    borderRadius: 40,
    elevation: 24,
    translationZ: 8,
  },
  { duration: 1000 },
)
```

`elevation` writes NativeScript's `androidElevation`. `translationZ` writes the native dynamic Z offset; widget state changes can replace it after playback. Both use DIPs. Jolt suspends the widget's state animator while it owns Z, then restores it, so press-state animations do not fight the active animation. Shadow appearance depends on Android's lighting, background outline and parent clipping.

Use elevation shadows when animating radius on Android. Core caches CSS `boxShadow` geometry, so `borderRadius` on a view with a CSS shadow is rejected. iOS shadow parameters throw on Android; `elevation` and `translationZ` throw on iOS. Branch on the platform when choosing shadow properties.

When an animation ends with both radius and width at zero, Jolt temporarily keeps a Core drawable for playback and restores the final plain background.

Radius and width redraw Core's existing background drawable from native Java, preserving its image, gradient and color. No JavaScript runs per frame, but Android's UI thread still draws every frame; [blocking JavaScript on that thread](./android-performance) can cause stutter. The helper depends on Core's drawable fields: unsupported native versions skip playback with `false` and retain the final model. Rebuild Android after installing or upgrading Jolt to include the helper.
