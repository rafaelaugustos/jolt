# Shared navigation

`sharedNavigation(frame)` connects **one static image or plain card** across two pages in the same NativeScript Frame. A single native overlay carries its position, size and rounded clip; images also interpolate their displayed content rectangle, including `aspectFill` → `aspectFit`. Card contents crossfade without stretching text.

Available in this checkout for the next beta; **not included in beta.18**. Rebuild the native application after installing this version. This is the first delivery of [#24](https://github.com/rafaelaugustos/jolt/issues/24): programmatic forward/back navigation. For native interactive image/card return on iOS and Android 14+, use [shared gestures](./shared-gestures). Recycled galleries remain follow-up work.

<Clip name="shared-navigation-ios" caption="iOS 26.2 simulator: real XCTest taps open a photo and a plain day-pass card, then return through vue-router-ns. Native Jolt playback; original speed. Not physical-device performance evidence." />
<Clip name="shared-navigation-pt-ios" caption="iOS 26.2 simulator: the same photo/card navigation in Portuguese, using real XCTest taps and original timing." />
<Clip name="shared-navigation-android" caption="Android emulator: real ADB taps open and return from the photo and card through vue-router-ns. Native Jolt playback; original speed. Programmatic back, not an interactive or predictive-back preview." />

## One owner per Frame

```ts
import { sharedNavigation } from '@rafaelaugusto/jolt/shared-navigation'

// Keep this owner for the lifetime of the Frame, not the source page component.
const motion = sharedNavigation(frame, {
  transition: 'smooth', // 'snappy', 'bouncy', or a finite Jolt spring/tween
  navigationTimeout: 3000,
  layoutTimeout: 500,
  maxSnapshotPixels: 8_000_000,
})
```

Give the source and destination the same **Core `sharedTransitionTag`**. Tags are scoped to the current page in this Frame; nested Frames are excluded. A missing or duplicate tag skips the shared animation and keeps the route working. `sharedTransitionIgnore` excludes a view.

```vue
<!-- Source page -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFill"
  width="170"
  height="210"
  borderRadius="24"
/>
<!-- Destination page: the same decoded local image, with different geometry. -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFit"
  width="320"
  height="440"
  borderRadius="10"
/>
```

Load images before navigating. Image mode requires NativeScript `Image`, the same `src` or `ImageSource` at both ends, no tint, and `aspectFill`/`aspectFit`. Animated images, fill distortion, remote images still loading and GPU-backed views fall back. Plain view containers use bounded native snapshots. Ancestors may scroll or scale uniformly; rotated, translucent, clipped/offscreen and cross-window geometry is unavailable.

## Core Frame and vue-router-ns

The callback is invoked **exactly once**, after source capture. Pass its `animated: false` option through: the Frame/router owns route commitment, hooks and history; Jolt owns the shared overlay. Do not combine this operation with a second page transition, Core `SharedTransition.custom()` or UIKit zoom on the same route.

```ts
const opening = motion.navigate({
  tag: 'place:42',
  navigate: (options) => frame.navigate({ create: createDetailPage, ...options }),
})
const result = await opening.finished

// Return resolves the current source page's tag after layout; no cached view/rect.
await motion.navigate({
  tag: 'place:42',
  navigate: () => frame.goBack(), // entry was created without a page animation
}).finished
```

The preview declares and exercises **vue-router-ns 0.1.0-rc.2**:

```ts
await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.push('/places/42', options),
}).finished

await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.back(options),
}).finished
```

Use a single Frame/window, normal push/back and already available content in this delivery. Nested/modal routes, tabs, replacement across Frames and automatic list-item realization are outside this contract. Disable the page's interactive swipe-back when demonstrating this programmatic backend; system navigation outside the controller keeps the router's normal behavior and cancels any active overlay.

## Ownership and interruption

`state` is `idle`, `preparing`, `running` or `disposed`. While active, another `navigate()` returns `unavailable` / `busy` **without invoking its callback**. Disable repeated navigation controls or handle that result; requests are not queued. This stage does not provide continuous back-drag retargeting.

`finished` always settles for an invoked operation: `completed`, `unavailable`, `cancelled` or `failed`, plus `navigated`, an optional `reason` and an optional thrown `error`. A rejected route guard reports `failed`; a resolved guard that leaves the page unchanged reports `unavailable`. Missing targets, invalid layout and deadlines restore the real views. `cancel()` cancels only the overlay. It never rolls back a committed route or aborts a router guard; a guard can still complete later.

Rotation, destination movement/unload, another navigation, app suspension, reduced-motion activation and `dispose()` end the overlay safely. Reduced motion skips capture and performs the same route. Native overlays are excluded from accessibility and touch targeting; accessibility focus remains with the real routed pages. The library does not install or replace navigation-controller delegates or OS recognizers.

Preparation can call JavaScript. Playback uses sampled Jolt tracks on native `CADisplayLink` / Android `Choreographer`, with no JavaScript callback or bitmap copy per frame. This uses Core's tags and Frame navigation boundary rather than Core's `SharedTransition` timing helper, whose platform-specific spring/crop behavior cannot express this contract consistently. It is **not** an adapter around iOS 18 UIKit zoom, and it makes no claim that opaque UIKit spring parameters equal Jolt physics.

The default combined capture budget is 8 million pixels (about 32 MB RGBA), capped at 32 million. Each wait is bounded; native playback is capped at 30 seconds. Dispose the owner when abandoning the Frame; Frame unload disposes it automatically. Use the [shared-layout API](./shared-layout) for changes within one page.

For image/card motion tied to native back gestures on stable pages, use [shared gestures](./shared-gestures).
