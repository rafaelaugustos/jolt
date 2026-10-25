# Complete gallery integration (#117)

The 65th preview composes the public `sharedNavigationEntry`, `resolveListTarget`, `zoomable` and `returnToSource` APIs. It uses one Core Frame, Core ListView, vue-router-ns 0.1.0-rc.2, bundled static images and an unscaled viewport. Sixty unique keys cover portrait photos, a transparent square logo and landscape artwork. A photo pager and asynchronous network replacement are separate milestones.

## Native ownership

Entry settles before zoom attaches. Pinch/pan, double-tap, dismissal progress, backdrop and chrome execute in the existing native photo controller. A cancelled drag settles without a route callback. Committing holds the released native pose; `returnToSource` captures it before the router unloads detail, preserves the rectangular viewport clip and supplies translation release velocity to native spring tracks. The router mounts the grid and the provider realizes the current cell by key. It confirms the same cell/rectangle across layout passes before capture: real UIKit evidence exposed a 9.33-DIP content-offset correction with estimated row heights, which otherwise cancelled a valid return on its first frame. Unload disposes the live viewer; completion restores the cell and releases the flight. Rejection leaves the live viewer available for `intent.cancel()`.

The clipped-image path stores full image bounds/content coordinates plus a separate clip rectangle; it does not crop the bitmap and then stretch that crop. Both native backends interpolate the clip alongside geometry. The existing pixel budget includes the held visible page, source and destination. Cached image bitmaps remain owned by the app/cache and are not recycled by a navigation flight.

`returnToSource` serializes one route and ignores overlapping requests. An iOS controller-disposal notification during an accepted ordinary pop cannot prematurely cancel the held flight. Android OS back cannot issue a second commit during that operation. A rejected route remains retryable. These contracts have host regressions in addition to the real demo.

## Reproduce with actual OS input

Use the assigned devices and release-build instructions in `CONTRIBUTING.md`. Build platforms sequentially. No automation is added to the user's review simulator or to a new CI job.

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/JoltGallery \
  testGallery testGalleryPortuguese testGalleryHandoffCheck testGalleryChecks testGalleryLifecycle
ANDROID_HOME=/path/to/sdk python3 benchmarks/gesture-input/build.py /tmp/JoltGalleryInput
adb -s YOUR_EMULATOR push /tmp/JoltGalleryInput/gesture-input.jar /data/local/tmp/jolt-predictive-input.jar
python3 benchmarks/gallery-android.py YOUR_EMULATOR /tmp/JoltGallery audit
python3 benchmarks/gallery-android.py YOUR_EMULATOR /tmp/JoltGallery record en
```

Select the preview language through real settings before Android recordings, passing `pt-BR` for its Portuguese clip. Restore the original preference afterwards. The test helper injects OS pointers and is never shipped in the app. Its `photo-pinch` path begins with two fingers, lifts one, then continues panning; `photo-interrupt` starts a pan 40 ms after a double tap. iOS pointer paths replay equivalent native inputs. No runner calls application gesture handlers.

Use `--gallery-audit --collection-audit` (Android string intent extras) for boundary traces. `--gallery-direct` opens a source-free detail route. These flags only write diagnostics; ordinary recordings exercise the normal preview.

## Recorded evidence

- iPhone 17, iOS 26.2 simulator and Android 16 / API 36 emulator; Core 9.1.3, Vue 3.1.2, router rc.2; release builds without HMR. The reviewed EN/PT MP4s preserve native playback timing and are embedded in both guides and attached to the PR.
- [iOS photo trace](results/gallery/ios-gallery.json): pinch/pan settles above minimum; interruption settles from the caught pose; cancellation restores minimum without a route. The recorded committed drag starts at y=150 DIP, scale approximately 0.91 and nonzero release velocity, then completes the shared flight. Deletion records `missing-target` with `navigated: true`.
- [iOS collection trace](results/gallery/ios-collection.json): the stable key moves to index 59, returns to its current cell, reopens and is removed. Terminal flight and native back-recognizer counts are zero. Additional XCTest assertions exercise transparent/landscape images, edge cancellation/commit, Reduced Motion and direct detail. The [lifecycle trace](results/gallery/ios-lifecycle.json) covers rotation while zoomed, suspension and three further open/close cycles with zero terminal counters.
- The [Android photo trace](results/gallery/android-gallery.json) and [collection audit](results/gallery/android-collection.json) check pinch-to-pan, interruption, zoomed panning, cancelled drag, moved/deleted targets, transparent/landscape images, predictive back, reset-before-back at increased zoom, Reduced Motion and direct detail. Missing targets use fallback; the moved supported image must finish with shared status `ready`.

UIKit can suppress touches during its noninteractive entry; requests actually delivered to `entry.back()` queue until entry settles. The native test retries the accessible control after entry if UIKit suppressed the first touch, then verifies one return. Host tests exercise queued requests directly. Partial source thumbnails may open ordinarily; return resolution is independent of that fallback.

Validation also passes 1,353 host tests, library/benchmark typechecks, package build, formatting, media checks and documentation build. No native CI job was added.

These are correctness/lifetime traces, not physical-device performance measurements. Physical iOS/Android, VoiceOver/TalkBack focus, large text, every lifecycle phase, RTL, frame pacing, preparation cost, input latency and peak process memory remain acceptance work in #24/#117. Do not close either issue from these simulator results.

## Integration comparison, not a benchmark

Documentation inspected on 2026-10-25: Flutter's current `Hero` and `InteractiveViewer` API pages and Reanimated's **4.x** shared-transition page. No Flutter or React Native build was run, so no version-pinned timing, memory or code-size ranking is claimed.

| Stack          | Documented building blocks                                                                                                         | Application integration still needed for this journey                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jolt checkout  | Stable-tag entry, native photo zoom/dismiss, bounded return provider, held-pose return                                             | Router/result mapping, current-key list lookup, item state, layout, controls and fallback destination.                                           |
| Flutter        | `Hero` matches route tags and uses a Navigator overlay; `InteractiveViewer` handles pan/zoom                                       | Compose dismissal/route policy and current-item realization with those primitives. A Hero must exist on the destination's first animation frame. |
| Reanimated 4.x | `sharedTransitionTag` with native-stack integration; the current page labels shared transitions experimental behind a feature flag | Compose viewer gestures, route policy and current-item lookup for the selected navigator/configuration.                                          |

Primary references: [Flutter Hero](https://api.flutter.dev/flutter/widgets/Hero-class.html), [InteractiveViewer](https://api.flutter.dev/flutter/widgets/InteractiveViewer-class.html), [Reanimated shared transitions](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/). The integration column is a scope comparison, not a claim that another stack cannot implement the behavior. A fair measured comparison must pin framework, navigator, list, renderer, device and build mode first.
