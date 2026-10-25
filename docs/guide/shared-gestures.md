# Shared gestures

`sharedNavigationEntry(frame, options)` keeps one image or card connected while opening a route and dragging back. Cancel the gesture to stay in detail; complete it to return to the source. The router owns history, while Jolt's native drivers own the shared presentation.

Available in this checkout for the next beta; **not in beta.18**. Rebuild the native app. Verified with NativeScript Core 9.1.3 and `vue-router-ns` 0.1.0-rc.2 on an iOS 26.2 simulator and Android 16 / API 36 emulator. Android requires API 34+, AndroidX Activity 1.8+, gesture navigation and `<application android:enableOnBackInvokedCallback="true" ...>`.

<Clip name="shared-entry-ios" caption="iOS 26.2 simulator, English: real taps and edge swipes open an image, cancel a partial return, complete a return, then open and cancel a card before using its back button. Original native playback speed." />
<Clip name="shared-entry-pt-ios" caption="iOS 26.2 simulator, Portuguese: the same image/card journey, native cancellation and committed return with real OS input. This is not physical-device performance evidence." />
<Clip name="shared-entry-android" caption="Android 16 emulator, English: real system left-edge cancellation and right-edge completion keep the photo connected; the card also cancels and returns with its accessible button. Original speed." />
<Clip name="shared-entry-pt-android" caption="Android 16 emulator, Portuguese: real OS gestures and taps demonstrate image/card transitions, cancellation and completion. Touch indicators identify the actual input; no simulated animation frames." />

## One entry, one owner

Give the source and destination the same unique `sharedTransitionTag`. Both pages must retain their view trees. Images must be decoded static Core Images with the same source; `aspectFill`/`aspectFit` crop changes are supported. Plain layout cards crossfade their snapshots. Follow the supported-content rules in [shared navigation](./shared-navigation).

```ts
import { sharedNavigationEntry } from '@rafaelaugusto/jolt/shared-navigation'

// The source Frame and page are already loaded.
const entry = sharedNavigationEntry(frame, {
  tag: 'place-cover',
  spring: { duration: 480, bounce: 0 },
  // vue-router-ns resolves undefined for success and a failure object for rejection.
  back: async (options) => (await router.back(options)) === undefined,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Still in detail')
  },
})

const result = await entry.open((options) => router.push('/place/cove', options))
// Wire the destination's accessible back button to the same owner.
backButton.on('tap', () => entry.back())
// Dispose when this owned entry is removed, not merely when its source is covered.
```

For Core, pass the supplied options into `frame.navigate({ create: createDetail, ...options })` and use a `back` callback that checks `frame.canGoBack()` before `frame.goBack()`. Return `false` if no return is possible. A synchronous `navigate` returning void is supported. Do not add another transition to the same entry.

`open()` is single-use and resolves after entry presentation settles with the existing `SharedNavigationResult` (`completed`, `unavailable`, `cancelled` or `failed`, plus `navigated` and optional `reason`). A missing or unsupported pair uses ordinary navigation. `unavailable` can therefore have `navigated: true`. Repeated opens do not invoke another route. Back requests during opening coalesce into one return after entry finishes.

## Native gesture ownership

| Platform    | Shared presentation and history                                                                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS         | Core's custom transition hooks keep its navigation delegate and UIKit history. A native edge recognizer drives the page crossfade and shared image/card from the same progress. The pair is resolved after UIKit lays out the transition.                                                                          |
| Android 14+ | The existing system back dispatcher drives native progress and the native spring. A bounded snapshot of the static source page and its anchor is captured before entry. The real detail page stays underneath the shared return. The app's `back` callback runs once after completion, with `{ animated: false }`. |

No JavaScript callback runs per gesture sample or display frame. JavaScript resolves tags, validates the static source at gesture boundaries, delivers lifecycle notifications and performs application navigation. This does not make synchronous main-thread JavaScript work nonblocking.

On iOS, UIKit commits an interactive pop through Core; the supplied application `back` callback is used by the accessible button. Respect `Page.enableSwipeBackNavigation` and the router's guard policy: a leave guard can disable the native swipe. On Android, a rejected async guard springs back, retaining the same entry for retry. The OS decides whether a gesture commits; there is no shared-entry halfway threshold.

## Cleanup and fallback

- `back()` uses the native return path; repeated requests while a return is pending are ignored. Keep an ordinary router-back fallback for a button whose handle is already disposed.
- `cancel()` restores a held gesture. Calling it during opening disposes the presentation; it cannot cancel the router's own pending operation. An Android release already committed by the OS continues.
- `dispose()`, Frame unload, route removal or application suspension release input, overlays and retained snapshots. After suspension, use ordinary back or create a fresh entry on the next push.
- Reduced motion preserves navigation without the shared flight. Missing/duplicate tags, incompatible images, changed static Android source, unsupported content or insufficient snapshot budget fall back without leaving a hidden view behind.
- `maxSnapshotPixels` defaults to **8,000,000** and accepts positive integers up to **32,000,000**. Android accounts for the retained return scene alongside its flight; iOS bounds each flight. This limits counted image pixels, not total process memory.
- `navigationTimeout` defaults to **5000 ms**, with a maximum of **10000 ms**. Opening and fallback-return waits release ownership on timeout. Android's guarded commit restores its preview on timeout. None of these can cancel an application promise or undo late external navigation; keep guards bounded.

The spring accepts `smooth`, `snappy`, `bouncy`, duration/bounce or stiffness/damping/mass. Native settling is bounded by the existing drivers (3 seconds on iOS, 1.5 seconds on Android). Visible shared geometry is clamped to its endpoints.

Lifecycle `state` is `ready`, `opening`, `idle`, `tracking`, `finishing`, `cancelling`, `committing` or `disposed`. Events may include `shared: { status: 'ready' | 'unavailable', reason? }`, terminal `outcome`, and sampled `release: { progress, velocity }`. They are lifecycle diagnostics, not a reactive progress stream.

This stage supports **stable retained pages, one static image or plain card**. Android's return background is a snapshot: keep that source static while covered; change detection falls back instead of resolving a new destination. Recycled/offscreen targets, scrolling destination resolution, live video/GL/WebView content, arbitrary modal dismissal, iOS native zoom transitions and gallery coordination remain outside this stage. Rotation, RTL and physical-device performance were not exhaustively validated. See [native reproduction and audit evidence](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shared-entry.md).
