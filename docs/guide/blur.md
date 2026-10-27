# Animated blur

Let the background soften while a modal, title or button stays sharp. `@rafaelaugusto/jolt/blur` controls an owned native effect with the same transition and playback concepts as the rest of Jolt. Available since **0.1.0-rc.1**; rebuild both native apps to include its compiled helpers.

<Clip name="blur-ios" caption="iOS simulator: real taps move between clear, soft and full material, interrupt an animation, pause/resume a round trip and apply Reduce Motion. English UI; original playback timing." />
<Clip name="blur-android" caption="Android 12+ emulator: the same controls animate a content blur while sibling controls stay sharp. English UI and real ADB taps; original playback timing, not a physical-device performance measurement." />

## Keep the foreground sharp

Create blur on a dedicated background/content view after native layout. Place modal content and controls in a sibling above it, rather than inside the blurred view.

```ts
import { blur } from '@rafaelaugusto/jolt/blur'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const backdrop = scope.add(
  blur(backgroundView, { amount: 0, radius: 24, style: 'light' }),
)

const reveal = backdrop.animate(1, { duration: 700, ease: 'easeInOut' })
reveal.pause()
reveal.progress = 0.5
reveal.play()

// A new command starts at the currently displayed amount.
backdrop.animate(0, 'smooth')

// At permanent teardown:
scope.dispose()
```

| Option   | Meaning                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `amount` | Initial intensity in 0–1, default 0. Zero is clear.                                                                      |
| `radius` | Android maximum blur radius in DIPs, 1–64, default 24. The applied radius is `amount × radius`. iOS ignores this option. |
| `style`  | iOS material: `system` (default), `light` or `dark`. Android ignores this option.                                        |

Options stay fixed for the handle's lifetime; dispose/recreate to change them. One handle owns each target. Invalid amounts/options/transitions throw before replacing existing playback.

## Different native materials

iOS adds a noninteractive `UIVisualEffectView` over the target's content. A paused `UIViewPropertyAnimator` defines the clear-to-material transition; a compiled native display link scrubs its `fractionComplete`. The effect follows the target's bounds and corner radius. No private blur-radius APIs are used. Material tint, transparency accessibility settings and OS styling can affect the appearance; an amount of 0.5 is half the material transition, not a specified Gaussian radius. [Apple's visual effect view](https://developer.apple.com/documentation/uikit/uivisualeffectview) and [animator progress](https://developer.apple.com/documentation/uikit/uiviewanimating/fractioncomplete).

Android 12 / API 31 and later use a compiled `ValueAnimator` to replace `RenderEffect.createBlurEffect()` on the view's render node. This blurs that view and its descendants; it does **not** sample arbitrary views behind a transparent overlay. Use the content view that should become soft. Edge pixels use `CLAMP`. [Android RenderEffect](https://developer.android.com/reference/android/graphics/RenderEffect).

On older Android versions, or without hardware acceleration, the fallback leaves content unchanged. `snapshot().backend` is `none`, `appliedAmount` is 0, and animation handles finish immediately. The fallback does not change opacity or block input.

The Android handle exclusively owns the target's `RenderEffect` slot and clears it on disposal. Do not combine it with an existing/custom effect on that same view: Android does not expose the previous effect for restoration. Use a dedicated wrapper. Effects on separate views can coexist. Platform-specific video/camera surfaces are not promised to participate in a view's blur.

Blur is a visual effect. It does not hide accessibility elements or disable interaction with the underlying content. The app still owns focus and input when presenting a modal. Keep the iOS effect view and its ancestors at full opacity for correct backdrop capture; animate the material amount rather than fading the effect view.

## Playback and lifecycle

`animate(amount, transition?)` accepts a destination and existing tween/spring transitions, delay and repeat controls. The returned `PlaybackAnimation` supports `finished`, `pause()`, `play()`, `stop()` and finite `progress`. Infinite loops support pause/resume but reject progress. Springs inherit interrupted velocity and output is clamped to 0–1. There is one animation per handle; arrays and named additive layers are not accepted.

`set(amount)` applies a value immediately. `stop()` holds the displayed value. Both cancel the previous handle (`finished` resolves `false`). `dispose()` removes the owned effect, native playback and lifecycle listeners; repeated disposal is safe. The background view's opacity, transforms and input handlers remain unchanged.

Backgrounding pauses active work. If NativeScript unloads the view while backgrounded, the surface is released and the paused program resumes after foreground loading. Ordinary unload/native replacement cancels playback and reattaches its held amount on load. Explicitly paused playback stays paused. A motion scope can own the effect for disposal or the playback handle for suspension.

Reduce Motion applies new destinations immediately. Enabling it during an animation stops that handle and applies its requested destination. Unsupported fallback handles also settle immediately, including requests to repeat forever.

`snapshot()` reads `amount`, `appliedAmount`, `backend`, `attached`, `nativeAnimations`, `frames`, `width` and `height` on demand. It installs no observer. Counts include retained paused native clocks; detached effects report zero applied amount and zero playback objects.

JavaScript prepares a sampled curve and handles commands, lifecycle and completion boundaries. Native code updates the effect each frame. Both native helpers use the UI thread; this is not a promise of a separate thread, zero allocation or uninterrupted playback while the UI thread is blocked. Blur cost depends on view size, radius and device. Limit the effect to the area that needs it.

The four-language **Soft focus / Lento** preview is the 72nd example. See [native validation and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/blur.md).
