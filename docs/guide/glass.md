# Liquid Glass

Bring nearby controls together and let iOS blend their surfaces. `@rafaelaugusto/jolt/glass` adds `GlassContainer` and `GlassView`, two NativeScript layouts that work with the existing `animate()` API. This checkout adds the API for the next beta.

<Clip name="glass-ios" caption="iOS 26.2 simulator: real taps merge and separate three native glass surfaces, change material, interrupt motion, pause/resume and apply Reduce Motion. English UI; original timing." />
<Clip name="glass-android" caption="Android API 36 emulator: the same layout, movement and touch interaction with explicitly styled classic cards. Android has no Liquid Glass or fusion. English UI and real ADB taps; original timing." />

<Clip name="glass-legacy-ios" caption="iOS 18.6 simulator: ordinary rounded blur surfaces preserve content, input and motion, without Liquid Glass fusion. English UI and real touches; original timing." />

## A shared surface

Register the layouts once when using NativeScript-Vue:

```ts
import { registerElement } from 'nativescript-vue'
import { GlassContainer, GlassView } from '@rafaelaugusto/jolt/glass'

registerElement('GlassContainer', () => GlassContainer)
registerElement('GlassView', () => GlassView)
```

```vue
<GlassContainer height="160" glassSpacing="26">
  <GlassView id="left" width="72" height="72" translateX="-104"
    glassInteractive="true">
    <Label text="✦" textAlignment="center" verticalAlignment="center" />
  </GlassView>
  <GlassView id="right" width="72" height="72" translateX="104"
    glassInteractive="true">
    <Label text="＋" textAlignment="center" verticalAlignment="center" />
  </GlassView>
</GlassContainer>
```

After the views are loaded, pass the native **NativeScript view instances** to Jolt:

```ts
import { animate, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
scope.add(animate(left, { x: -36 }, 'smooth'))
scope.add(animate(right, { x: 36 }, 'smooth'))

// In your application suspend/resume handlers:
// scope.suspend()
// scope.resume()

// At permanent component teardown:
// scope.dispose()
```

In Core NativeScript, construct these classes and use `addChild()` normally. A `GlassView` is a `GridLayout`: it can contain labels, icons and controls. Put glass elements directly inside the same `GlassContainer`. The layouts route children into each native effect's `contentView`, retaining NativeScript ownership, layout and input.

On iOS 26+, the container uses `UIGlassContainerEffect` and each surface uses `UIGlassEffect`. Moving the elements closer changes the shape of their shared material. UIKit decides the blend based on geometry and spacing; Jolt animates the views. See [Apple's glass container](https://developer.apple.com/documentation/uikit/uiglasscontainereffect) and [custom Liquid Glass views](https://developer.apple.com/videos/play/wwdc2025/284/).

## Properties

| Property                 | Default     | Meaning                                                            |
| ------------------------ | ----------- | ------------------------------------------------------------------ |
| Container `glassSpacing` | `16`        | Distance in DIPs at which nearby glass blends, 0–200.              |
| View `glassStyle`        | `'regular'` | `'regular'` or `'clear'`, iOS 26+.                                 |
| View `glassRadius`       | `'capsule'` | Capsule or a corner radius in DIPs, 0–1000. Applies on iOS.        |
| View `glassTint`         | `undefined` | Jolt `ColorValue`; `null`/`undefined` clears tint. iOS 26+.        |
| View `glassInteractive`  | `false`     | Native response to touch, iOS 26+. Does not install a tap handler. |
| View `glassFallback`     | `'blur'`    | `'blur'` or `'none'` before iOS 26. Android always uses no effect. |

Numeric properties accept numbers and numeric strings for declarative markup. `glassInteractive` also accepts `'true'` and `'false'`. Invalid values throw before replacing the material. Property changes configure the native material immediately; they are not separate animation channels. Use `glassRadius` for native glass corners instead of a competing CSS clip or mask.

`supportsLiquidGlass()` checks the OS and available NativeScript metadata. Readonly `glassBackend` reports the selected capability: container `'liquid-glass'`/`'none'`, view `'liquid-glass'`/`'blur'`/`'none'`. It describes configuration, not whether an unloaded view is currently rendering.

## Platforms and lifecycle

Build with Xcode and NativeScript iOS metadata supporting UIKit 26 to use Liquid Glass. On an older iOS runtime, each surface uses an ordinary `UIBlurEffect`, unless `glassFallback="none"`; the container has no effect and surfaces do not fuse. On Android both classes remain normal `GridLayout`s: content and interaction remain available, with no blur or fusion. Set an explicit background and `borderRadius` for Android, as the preview does. The fallback was also run on an iOS 18.6 simulator.

Keep glass and its ancestors at opacity 1, and avoid clipping the container's blend area. Fading an effect view is not a supported way to fade its material. UIKit handles system accessibility appearance; check contrast against the actual background. [Apple's effect-view guidance](https://developer.apple.com/documentation/uikit/uivisualeffectview).

Use existing transform playback for interruption, springs, delays, repeats, pause, seek and Reduce Motion. Own the returned animations in a motion scope and wire its suspend/resume methods if they should survive application backgrounding. Effects clear on unload/disposal and return with the latest settings on load; ordinary animation unload follows Jolt's existing cancellation behavior.

JavaScript configures materials and prepares animation curves. UIKit renders the glass; existing native transform playback advances motion. There is no new JavaScript frame loop, native helper or dependency. This is not arbitrary SVG path morphing, a blur-radius animation API or a physical-device performance measurement. For those different operations, see [shapes](./shapes), [animated blur](./blur) and [liquid image deformation](./liquid).

The four-language **Better as one / Still** preview is example 73. [Native checks and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/glass.md).
