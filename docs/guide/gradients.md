# Gradients

NativeScript's CSS only has a static `linear-gradient`. `gradient()` paints a native linear, radial or conic gradient behind a layout's children, and animates its colors, stops, angle, center and radius:

```ts
import { gradient } from '@rafaelaugusto/jolt'

const glow = gradient(card, {
  type: 'radial',
  colors: ['#A78BFA', '#0F172A'],
  center: { x: 0.3, y: 0.3 },
  radius: 0.45,
})

glow.animate({ center: { x: 0.7, y: 0.7 }, radius: 0.9 }, { duration: 1400 })
```

<Clip name="gradients-ios" caption="A linear angle, a moving radial light, a spinning conic sweep and a linear band on a wide view, then the linear colors swapped, on the iOS simulator. Real-time playback." />

## Types and values

| Value    | Meaning                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors` | two to eight colors, as strings or `Color`                                                                                                   |
| `stops`  | where each color sits, from 0 to 1, without going back; evenly spaced by default                                                             |
| `angle`  | degrees, like CSS. `linear` points this way: 180 runs top to bottom, 90 left to right. `conic` starts here: 0 is up, and colors go clockwise |
| `center` | `radial` and `conic`: fractions of the view's width and height; `{ x: 0.5, y: 0.5 }` by default                                              |
| `radius` | `radial`: a fraction of the view's shorter side; 0.5 by default reaches the nearer edges                                                     |

A linear gradient runs through the center and is long enough for the corners to get the first and last colors, as in CSS. Its bands stay square to the angle on views of any shape, on both platforms. Values a type doesn't use are kept, so switching between them later is just another `set()`.

## Animating

`animate(values, transition)` starts from the gradient on screen and returns an [`Animation`](./api#animations). It takes the same transitions as `animate()`: tweens, springs, `repeat`, `repeatType`, `repeatDelay` and `delay`, and follows the [time scale](./configure#time-scale).

```ts
const sweep = gradient(loader, {
  type: 'conic',
  colors: ['#22D3EE', '#A855F7', '#22D3EE'],
})
sweep.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
```

Colors mix in OKLab, like [color animations](./colors), and keep their count while animating; `set()` changes it. On a spring, the angle, center and radius follow the overshoot while colors and stops stay between their ends. A gradient plays one animation at a time: a new `animate()` takes over from where the previous one is. `stop()` holds the current frame and `set(values)` applies values at once. With [reduced motion](./configure#reduced-motion), the angle, center and radius jump to their end while colors and stops still fade.

`remove()` takes the gradient off the view. Unloading the view stops the animation in progress.

## Platforms

On iOS the gradient is a `CAGradientLayer` at the back of the view's layer, with Core Animation keyframes for its colors, locations and points. On Android it is a drawable stacked on the view's own background, and a native animator interpolates the sampled frames; nothing runs in JavaScript while it plays. Rebuild the Android app after upgrading so the native class is included.

The gradient covers the view's background color and follows a uniform `borderRadius`. It sits behind the children of a layout. On a view that draws its own content, like a `Label`, it covers that content: put the gradient on a layout around it.

<Clip name="gradients-android" caption="The same gradients and the color swap on the Android emulator. Real-time playback." />
