# Shared layouts within a page

An album cover can leave a mini player and become the expanded cover. A selected tab indicator can move between different parents. **sharedLayout()** connects those views by identity, captures the outgoing presentation and moves a temporary native image to the new layout.

Available since **0.1.0-beta.18**, in the core package. Install `@rafaelaugusto/jolt@0.1.0-rc.2` and rebuild the native application to install the snapshot/rendering classes. No optional native-property plugin is needed.

<Clip name="shared-layout-ios" caption="Real interaction on an iOS simulator: a tab indicator moves between parents, a mini-player cover expands and returns, and a quick reversal starts from the current snapshot. Original timing." />

<Clip name="shared-layout-android" caption="Shared identities on an Android emulator, with real OS taps and native snapshot playback. This is not a physical-device performance measurement." />

## Capture before changing the tree

Create one owner for a container and attach loaded descendant views with stable string keys:

```ts
import { sharedLayout } from '@rafaelaugusto/jolt/shared-layout'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const shared = scope.add(sharedLayout(pageContent, { transition: 'smooth' }))

const detach = shared.attach(collapsedCover, 'cover', {
  content: 'image',
  radius: 12,
})

const flight = shared.transition(() => {
  // Replace the tree synchronously; register the new loaded view with the same key.
  replaceMiniPlayerWithExpandedPlayer()
  shared.attach(expandedCover, 'cover', { content: 'image', radius: 24 })
})
const result = await flight.finished
```

Vue can update a ref in the mutation and attach the incoming view in its loaded handler. Jolt waits for Vue's queued update and the next native layout before measuring the destination. The [complete example](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/SharedLayoutLab.vue) also handles initial loaded-event ordering.

The mutation must be synchronous. Load data first. The default layout deadline is 500 ms; **layoutTimeout** accepts a positive value up to 10,000 ms. A missing or unmeasured destination finishes with a fallback and releases every snapshot.

An identity has one current view. Duplicate attachment outside a transition throws. During preparation, a new view can replace the captured source with the same key. Removing the source after capture is supported; unloading automatically unregisters it. A stale detach callback cannot remove its replacement. Identities must belong to the owner's subtree and cannot overlap.

## Content and geometry

Position, width, height and uniform corner clipping use native window coordinates. Positive uniform ancestor scale and translation, scroll offsets, safe areas and Android density are included in coordinate conversion.

- **content: 'image'** scales each snapshot uniformly to fill the moving clip and crossfades to the destination capture.
- **content: 'container'** is the default. Captures retain their rendered content size and crossfade within the changing clip, without stretching text.
- **radius** is a finite nonnegative DIP value. Omit it to use the view's numeric uniform borderRadius.

Content stays frozen during playback. Updated labels or images become live when the flight ends. Temporary replicas do not receive touch or accessibility focus. Original views are hidden during flight and restored once when it ends. Keep reversal controls outside attached subtrees and avoid separately mutating their native visibility during playback.

## Interruption and cleanup

A new transition captures the current composite before changing the tree again. Native position and velocity seed the new geometry tracks. The previous handle resolves as cancelled with reason **interrupted**.

```ts
flight.cancel() // stop() is an alias
shared.cancel()
shared.pause() // cancels and rejects new transitions
shared.play()
shared.dispose()
```

Cancellation reveals the application's current layout; it does not undo the app mutation. Destination geometry changes, window rotation/resize, host unload and backgrounding cancel the flight. Reduced Motion applies the mutation without a moving overlay, and enabling it during playback cancels the flight. A motion scope owns cleanup and suspension via pause/play.

The finished promise resolves to **completed**, **cancelled** or **unavailable**, with a reason for the latter two. Reasons include interruption, explicit cancellation, geometry change, suspension, missing endpoints, unsupported capture, reduced motion and the layout deadline. Unsupported capture applies the ordinary app layout change without a JavaScript frame-loop fallback.

## Initial supported case

Static images and plain containers in one page/window are supported. [Navigation transitions](https://github.com/rafaelaugustos/jolt/issues/24) and direct-child [layout animation](./layout) are separate APIs.

Translucent ancestors, native blur/effect views, rotated, skewed, perspective or negatively or nonuniformly scaled ancestors, partially clipped/offscreen endpoints, scroll/list containers as captured content, WebViews, video, camera and GPU-backed surfaces use the unavailable path. Resolve endpoints to fully visible axis-aligned views first. Arbitrary image-crop interpolation and live surfaces are not promised.

At most eight identities can be registered. **maxSnapshotPixels** defaults to 8,000,000 pixels, about 32 MB of additional RGBA captures, including temporary reversal captures. It accepts up to 32,000,000. Exceeding the budget uses the ordinary layout fallback. The budget excludes images already retained by the app.

## Execution

JavaScript handles registration, app mutation, layout coordination, curve sampling and terminal callbacks. Compiled iOS/Android code captures/draws images, evaluates prepared tracks, checks destination geometry and owns the display clock. Flight playback does not call JavaScript per display frame.

Native callbacks still share the UI thread with NativeScript; blocking that thread can delay playback. Each capture or reversal has a one-time UI-thread preparation cost.

The implementation uses a window-attached UIKit view and Android's [ViewGroupOverlay](https://developer.android.com/reference/android/view/ViewGroupOverlay). Source capture on iOS reads the [presentation layer](<https://developer.apple.com/documentation/quartzcore/calayer/presentation()>) when available.

<Clip name="shared-layout-pt-ios" caption="The embedded preview in Brazilian Portuguese on an iOS simulator: tab selection, expanded player and rapid reversal. Real OS input at original timing." />
