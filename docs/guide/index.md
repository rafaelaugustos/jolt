# What Jolt is

Jolt brings motion to [NativeScript](https://nativescript.org) apps and the Web: presets, springs, keyframes, stagger and gestures, with APIs for native views and HTML elements.

## NativeScript

Animate native views on iOS and Android through the package's root entry:

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Web

Use `@rafaelaugusto/jolt/web` for HTML elements. It shares Jolt's motion compiler and uses the Web Animations API (WAAPI), without requiring NativeScript or a UI framework.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const card = document.querySelector<HTMLElement>('.card')

if (card) {
  motion.animate(card, 'fadeInUp')
}
```

Create the runtime after browser mounting and call `motion.dispose()` when its application or component is torn down. The optional [`/web/vue` adapter](./web-vue) manages resources through Vue's lifecycle. The root import and `/vue` target NativeScript; they do not switch automatically to the DOM.

The Web APIs are **experimental**. Start with the [Web runtime](./web-runtime), then explore [continuous motion](./web-dynamic), [gestures and scroll](./web-gestures), and [gradients, loading and text](./web-effects). Each guide documents its supported targets and limits.

## SwiftUI (Beta)

Available in **0.1.0-rc.14 (Beta)** for iOS 17+ and macOS 14+, without NativeScript or JavaScript. Install the `JoltSwiftUI` product from the [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) package repository, tag `v0.1.0-rc.14`. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits.

## Why not `view.animate()`

NativeScript's `view.animate()` covers the basics and stops there: one curve for every property, a `spring` curve with no settings, no keyframes, and a promise that rejects when the animation is cancelled. Anything richer ends up as platform code.

Jolt computes the motion once, in JavaScript, when the animation starts, and hands it to the platform as keyframes: Core Animation on iOS, `ObjectAnimator` on Android. Default view tracks play without per-frame JavaScript. Real-size layout, opt-in subscriptions and gesture input have their own [execution limits](./how-it-works). Springs follow real physics, and an animation that interrupts another one starts from where the view is, at the speed it was going.

## What it covers

The following guides cover NativeScript views. For HTML elements, use the Web guides above.

- [25 presets](./presets) to enter, exit and draw attention: `fadeInUp`, `popIn`, `shake`, `heartbeat`...
- [Springs](./transitions#springs) described by feel (`bouncy`), by `bounce` and `duration`, or by stiffness, damping and mass.
- [Keyframes and tweens](./transitions#tweens) with an easing per segment and exact keyframe times.
- [Stagger](./stagger) across several views, from the first, the last or the center.
- [Sequences](./sequences) that start each step once the previous one looks done.
- [Press effects](./press) that follow the finger and let go when a scroll takes over.
- [Vue directives and a transition component](./vue) from the optional `@rafaelaugusto/jolt/vue` entry.
- [Text entrances](./text) by letter or word on iOS and Android, keeping one accessible Label.
- [Interruptions](./interrupting) that pick up the value and velocity on screen, with no jump.
- [Native playback](./how-it-works): Core Animation on iOS and `ObjectAnimator` on Android for default view tracks; execution costs are documented per API.

- [Real dimensions](./size): animate width, height and auto while text reflows and siblings move.
- [SceneKit camera field of view](./scene-camera): coordinate perspective zoom with motion values on iOS.

## Where to start

1. [Install Jolt](./install) and choose the entry for your platform.
2. **NativeScript:** read [Animating](./animating), then pick a [transition](./transitions) or a [preset](./presets).
3. **Web:** start with the [Web runtime](./web-runtime) or [Vue DOM adapter](./web-vue).

Jolt is a release candidate; see [installation](./install) for the published version. Both runtimes can be used directly, with optional framework integrations.

## Reading the menu

The sidebar highlights capabilities with three labels:

- **New:** introduced in the documented edition.
- **Updated:** a material change to an existing capability.
- **Beta:** an experimental API or adapter whose contract may change.

New and Updated expire when the documented version changes. Beta stays until the API is stabilized. The label description distinguishes a published capability from a source candidate; the guide states any pending merge or publication. A badge alone does not mean a feature has been released.

<Clip name="docs-navigation-rc14-desktop" caption="Chromium on macOS, desktop viewport: Current-edition sidebar labels, keyboard navigation and light/dark themes. This demonstrates documentation navigation, not a native app." />

<Clip name="docs-navigation-rc14-mobile" caption="Chromium on macOS, emulated mobile viewport: opening the menu and following labeled entries. Browser emulation, not a physical phone recording." />
