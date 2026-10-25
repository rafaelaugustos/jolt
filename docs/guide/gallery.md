# A gallery that stays connected

Open a thumbnail, pinch into a detail, keep panning after lifting one finger, interrupt a double-tap zoom, then pull down to return. The reference composes `sharedNavigationEntry`, `zoomable` and a current-cell resolver with Core ListView and vue-router-ns. The route stays with the router; gesture and animation frames stay native.

Available in this checkout for the next beta, not beta.18. Rebuild the native app. Open **The living gallery** in the bilingual preview.

<Clip name="gallery-ios" caption="iOS 26.2 simulator, English: actual multi-touch input, interrupted double-tap, cancelled drag, return from the released pose after reordering, and deletion fallback. Original speed." />
<Clip name="gallery-pt-ios" caption="iOS simulator, Portuguese: the same complete interaction with real OS gestures. This is not physical-device performance evidence." />
<Clip name="gallery-android" caption="Android 16 emulator, English: real pinch-to-pan handoff, interruption, cancelled drag and committed return to the current recycled thumbnail." />
<Clip name="gallery-pt-android" caption="Android emulator, Portuguese: zoom, cancel, move, drag back and remove. Touch indicators represent actual input; footage is not accelerated." />

## Connect the two owners

Give both images the same `sharedTransitionTag`, based on the photo's stable key. Create the entry as described in [return targets](./return-targets). Wait for `entry.open()` to finish before attaching zoom to the live detail image. This prevents the opening transition and viewer from owning the image at the same time.

```ts
import { zoomable } from '@rafaelaugusto/jolt'

// After entry.open() settles and the detail image is loaded:
const viewer = zoomable(detailImage, {
  viewport, // direct parent; unscaled in this recipe
  backdrop,
  chrome, // separate sibling, not an ancestor of the image
  dismiss: 'vertical',
  async onDismiss(intent) {
    const result = await entry.returnToSource({
      velocity: { x: 0, y: intent.velocity },
    })
    if (!result.navigated) intent.cancel()
  },
})
zoomButton.on('tap', () => viewer.zoomTo(2.5))
resetButton.on('tap', () => viewer.reset())
closeButton.on('tap', () => viewer.requestDismiss())
```

`returnToSource()` captures the image's **current native pose and viewport clip before routing**, holds the visible source page within the snapshot budget, resolves the current thumbnail and starts the native flight. It carries the supplied x/y translation velocity into spring tracks. Velocity is in window-space DIPs/second; convert it if your viewport has a scaled ancestor. It does not infer pinch/scale velocity from a vertical release.

Keep the dismissal intent pending while this operation runs. Do not call `intent.complete()` before capture: that would reset the photo. Accepted navigation unloads the image, which disposes the zoom controller. Rejected navigation returns `navigated: false`; `intent.cancel()` then restores the live viewer from its held pose. A second return request gets `unavailable/busy` without another route. The returned result has the same statuses as [shared navigation](./shared-navigation).

The complete runnable application code is [GalleryPhotoDetail.vue](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/GalleryPhotoDetail.vue), with [collection identity/routing](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) and the [recycled cell template](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts). Layout, item storage, key lookup, router failure mapping and accessible controls remain application code. Jolt supplies the native gesture, capture, resolution and flight primitives.

## Back, cancellation and fallback

| Situation                            | Behavior in the reference                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Small vertical drag                  | Native photo/chrome settle back; no route runs.                                                                         |
| Drag while zoomed                    | Pan within image bounds; dismissal waits for minimum scale.                                                             |
| Accessible close while zoomed        | Native reset to minimum, then one dismissal intent.                                                                     |
| iOS edge while zoomed or dragging    | `canBegin` rejects competing ownership; reset or use close.                                                             |
| Android Back while zoomed            | Commitment resets zoom and retains detail; another Back can leave.                                                      |
| Android Back at rest                 | Detail preview first; resolve the current cell after OS commitment.                                                     |
| Back request during opening          | Delivered requests coalesce until entry settles. UIKit may suppress physical touches during its short entry transition. |
| Reordered/offscreen item             | Resolve the current row by key and scroll before measuring.                                                             |
| Deleted item or failed realization   | One fade/ordinary return; never target a saved rectangle.                                                               |
| Direct detail without an entry       | Ordinary router back, or replace with the gallery when history is empty.                                                |
| Window/layout change during a flight | End the overlay safely; keep the committed route.                                                                       |
| Suspension                           | Dispose the entry; subsequent close uses ordinary navigation.                                                           |

Reduce Motion preserves zoom/reset/close and route/focus semantics without the shared flight. Replicas are hidden from accessibility. The current return item receives screen-reader focus; a collection heading is the fallback when it is missing. Physical VoiceOver/TalkBack and large-text acceptance remain unverified.

## Supported milestone

Bundled/cached static portrait, landscape and transparent square images, one Core Frame/window, Core ListView and vue-router-ns 0.1.0-rc.2. Custom dragged returns support rectangular viewport clipping and uniform positive scale. A partly clipped thumbnail at entry may use ordinary opening; resolving a visible return target remains independent. Network replacement, a photo pager, arbitrary modal/nested-frame transitions, rotated images and video/GL/WebView surfaces are follow-ups.

The guide and [native evidence](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) cover simulator/emulator correctness. Physical-device frame pacing, input latency and process-memory profiling remain open in #117; these clips do not close that acceptance matrix.
