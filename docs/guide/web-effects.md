# Web gradients, loading and text

**Development build, not included in RC.9.** Issues #352–#357 add `gradient`, `shimmer`, `loader`, `reveal`/`conceal`, `animateText` and `rollTo` to the experimental `/web` runtime and its child scopes. The `/web/vue` adapter owns these resources through `useWebMotion().use()`. Mavis adoption remains a separate workstream.

## Gradients {#gradients}

Linear, radial and conic gradients accept 2–8 CSS colors with a fixed color count. Stops are ordered fractions from 0 to 1; center coordinates are fractions of the box; radial radius is a nonnegative fraction of its smaller dimension. Angles are degrees. Color, stop and geometry channels replace independently. Colors use shared premultiplied OKLab interpolation; overshooting stops are projected into order without exchanging color identities. `bind()` borrows same-runtime numeric/color values and returns token-aware cleanup. Geometry bindings hold their current pose under reduced motion; color bindings remain active.

Gradients paint above existing background images and restore only the styles they still own. Finite gradients and live values use the runtime scheduler because ordinary CSS gradient strings do not interpolate as numeric WAAPI channels. No independent gradient frame loop is created.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const paint = scope.gradient(card, {
  type: 'radial',
  colors: ['#4135c2', '#f5cf8e'],
  center: { x: 0.3, y: 0.4 },
  radius: 0.7,
})
await paint.animate({ center: { x: 0.7 }, colors: ['#087e8b', '#ffe1b2'] }, 'snappy')
const centerX = scope.motionValue(0.3)
const unbind = paint.bind({ center: { x: centerX } })
// unbind(); paint.stop(); paint.suspend(); paint.resume(); paint.dispose()
```

<Clip name="web-gradient-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks demonstrate playback, pause/resume, replacement, reduced motion and cleanup at original speed. Browser capture; no physical-device performance claim." />

## Loading {#loading}

`shimmer()` adds a clipped decorative sweep. `loader()` supports `dots`, `bars` and `ring`; size is in CSS pixels. Both return callable cleanup handles with `pause`, `play`, `suspend`, `resume` and `dispose`. Temporary layers are inert and hidden from accessibility. They preserve application content, transforms and background. Supply loading labels and `aria-busy` in the application. Reduced motion hides the sweep and holds a static loader; document hiding pauses playback.

```ts
const shimmer = scope.shimmer(placeholder, { duration: 1500 })
const loader = scope.loader(indicator, { style: 'ring', color: '#f3be7c', size: 48 })
shimmer.pause()
shimmer.play()
loader.pause()
loader.play()
// shimmer(); loader.dispose()
```

<Clip name="web-loading-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks demonstrate playback, pause/resume, replacement, reduced motion and cleanup at original speed. Browser capture; no physical-device performance claim." />

## Circular reveal {#reveal}

Origins are local CSS pixels. Reversal starts at the displayed circle. Conceal ends with `visibility: hidden`, retaining layout and the original DOM; reveal restores visibility. Move focus before concealing focused interactive content. An existing clip path is intersected through a temporary mask, preserving authored clipping. Resizing cancels the old circle and restores its owned styles.

```ts
const hiding = scope.conceal(panel, { to: { x: 24, y: 24 }, duration: 600 })
const showing = scope.reveal(panel, { from: { x: 24, y: 24 }, duration: 600 })
showing.pause()
showing.progress = 0.5
showing.play()
await showing
```

<Clip name="web-reveal-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks demonstrate playback, pause/resume, replacement, reduced motion and cleanup at original speed. Browser capture; no physical-device performance claim." />

## Text and rolling values {#text}

`animateText()` groups Unicode graphemes or words. `rollTo()` accepts a finite number or a formatted string; automatic direction compares numeric destinations. Changed digits roll while unchanged glyphs remain. Temporary copies preserve shaped text and are inaccessible; the original Text node remains the semantic and framework-owned content. Retargeting captures the displayed fragments before cancellation.

Use a plain-text block or inline-block leaf with at most one Text node and 256 graphemes. Inline markup, editable controls, vertical writing and rotated/skewed/negative transforms are rejected. Positive axis-aligned transforms are supported. Resize, font changes and application text replacement cancel safely. Rolling snapshots are flattened and bounded to 2048 visible fragments; exceeding that budget rejects the next retarget before replacing the current animation. Tabular figures are temporary; use CSS `font-variant-numeric: tabular-nums` when the resting label must keep them.

```ts
await scope.animateText(label, { by: 'word', duration: 400, stagger: 60, y: 12 })
await scope.rollTo(amount, 12980.6, {
  format: (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  direction: 'auto',
  duration: 600,
  bounce: 0.2,
  stagger: 20,
  tabular: true,
})
```

<Clip name="web-text-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks demonstrate playback, pause/resume, replacement, reduced motion and cleanup at original speed. Browser capture; no physical-device performance claim." />

<Clip name="web-roll-chromium" :width="900" caption="Chromium on macOS, English UI: actual clicks demonstrate playback, pause/resume, replacement, reduced motion and cleanup at original speed. Browser capture; no physical-device performance claim." />

## Ownership and Vue {#lifecycle}

A target accepts one owner per effect kind. Replacement within a runtime cleans the previous owner; a foreign runtime is rejected. Animations expose pause/play, progress and a boolean completion result. Scope suspension pauses playback and disposal releases owned resources. Detachment and ref replacement clean effects; KeepAlive deactivation releases setup resources and activation recreates them. Disposal preserves newer application style writes. Gradient/mask painting uses the shared scheduler; text, reveal without an authored clip and loading layers use WAAPI. These are rendering choices, not an off-main-thread guarantee.

```ts
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
const motion = useWebMotion(elementRef)
motion.use((scope, element) => {
  scope.shimmer(element)
  scope.gradient(element, { type: 'linear', colors: ['#4135c2', '#087e8b'] })
})
```

## Native references and verification {#verification}

The following fresh recordings show the corresponding native implementations in the normal Vue demo. They are references for the visual behavior; the browser recordings above exercise the new Web backend. Existing native effect APIs retain their behavior.

<Clip name="web-native-gradients-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

<Clip name="web-native-shimmer-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

<Clip name="web-native-loaders-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

<Clip name="web-native-reveal-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

<Clip name="web-native-text-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

<Clip name="web-native-rolling-ios" caption="iPhone 17 simulator, iOS 26, English normal Vue demo: actual XCTest interaction demonstrates the corresponding native effect at original speed. This is a simulator recording." />

Run `npm run web:effects:typecheck` and `npm run web:effects:test`. The browser suite covers Chromium, Firefox and WebKit, live bindings, replacement, Unicode, original Text identity, reduced motion, cleanup and Vue ref/KeepAlive lifecycle. Packed consumers also exercise all six public APIs with strict NodeNext/Bundler types and SSR-safe imports.
