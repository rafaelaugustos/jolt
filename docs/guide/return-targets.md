# Returning to recycled cells

Give a shared navigation entry a stable item key and a `returnTarget` resolver. Jolt asks for the **current** view after the returning page is laid out, so a photo can return to its thumbnail after reordering, scrolling or recycling. The source view saved at entry is never used as the return identity.

Available in the checkout for the next beta, not beta.18. Rebuild the native application. The reference uses one Core Frame, Core ListView and vue-router-ns 0.1.0-rc.2.

<Clip name="return-targets-ios" caption="iOS simulator, English: real taps move the selected photo to the end of a recycled grid, cancel a return, return to its new cell, then remove the photo and use the fallback. Original speed; not hardware performance evidence." />
<Clip name="return-targets-pt-ios" caption="iOS simulator, Portuguese: the same reordered, cancelled and deleted-photo journey with real OS input." />
<Clip name="return-targets-android" caption="Android emulator, English: real system-back cancellation and completion, current-cell resolution after reordering, and a deleted-item fallback. Original speed." />
<Clip name="return-targets-pt-android" caption="Android emulator, Portuguese: real gestures and accessible back controls exercise current-cell return and deletion. Touch indicators show actual OS input." />

## A bounded resolver

```ts
import {
  sharedNavigationEntry,
  resolveListTarget,
} from '@rafaelaugusto/jolt/shared-navigation'

const entry = sharedNavigationEntry(frame, {
  tag: `photo:${photo.key}`,
  spring: 'smooth',
  returnTarget: {
    key: photo.key,
    timeout: 1500,
    resolve(context) {
      return resolveListTarget(context, {
        list,
        // Return the current ROW index, including grouped/grid rows.
        indexOf: (key) => rows.findIndex((row) => row.some((p) => p.key === key)),
        // Search realized cells by their current tag; never return a saved cell.
        viewForKey: (key) => findCurrentImage(list, `photo:${key}`),
      })
    },
    fallbackFocus: () => collectionHeading,
  },
  back: async (options) => (await router.back(options)) === undefined,
})
await entry.open((options) => router.push(`/photos/${photo.key}`, options))
```

`findCurrentImage` is application code that traverses the list's current children. See the complete [collection adapter](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/photo-collection.ts) and [native cell template](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/collection-cells.ts). The template updates each recycled image's tag from its new item's key. It retains only realized cells and uses the image cache normally.

The resolver receives `{ key, tag, page, signal }`. It can return a view, `null`, `undefined` or a promise. `signal` exposes `aborted`, `addEventListener('abort', callback)` and `removeEventListener`; it needs no browser `AbortController` polyfill. Observe cancellation when performing application work. The wait defaults to 1500 ms and accepts up to 5000 ms, including realization and final layout. Late results are ignored. `resolveListTarget` scrolls to the current row and checks again after layout, with at most four attempts if the item moves during preparation.

After resolution Jolt requires exactly one matching tag on the returned page and the same loaded view returned by the provider. Missing, deleted, duplicate or stale views, rejected resolvers and timeouts take the ordinary/fade path. They do not change route commitment. A refusal to scroll or incompatible final geometry also falls back. The resolved view receives accessibility focus; `fallbackFocus` supplies a nearby heading when the item is missing.

## Platform behavior

On iOS, Core/UIKit mounts the returning page beneath detail. Native motion holds its initial pose while the resolver realizes the target, then rebases the remaining edge gesture without jumping. A cancellation while waiting aborts preparation and retains detail. A committed return finishes once. Changing cell identity or geometry during the flight ends that presentation safely.

On Android 14+, the system back gesture previews the current detail page. Cancellation restores it without running a route or resolving a target. After OS commitment, Jolt captures the visible image/page, invokes the router once, realizes the current cell and runs the native shared flight. **The live recycled destination is not an interactive predictive-back preview**: resolving it happens after commitment. Unlike the static [shared gestures](./shared-gestures) backend, this mode does not retain the original grid as a long-lived bitmap.

Both paths keep gesture/animation frames native. JavaScript runs at setup, resolution and lifecycle boundaries. The existing combined pixel budget also covers any temporary held page; unsupported GPU/WebView/video content or insufficient budget uses ordinary navigation. Reduced Motion still resolves identity/focus, without a shared flight. Route timeouts cannot cancel application-owned promises or undo a late external navigation.

For programmatic navigation, the same `returnTarget` can be passed to `sharedNavigation().navigate()`. `holdSource: true` preserves a bounded source-page snapshot while the destination mounts. `onCaptured` runs once after capture and before calling the router, allowing a held photo controller to release its transforms. Calling `cancel()` ends presentation and resolution; it never undoes a committed route.

## UIKit zoom investigation

iOS 18 introduced `UIViewController.preferredTransition = .zoom(...)`. Its synchronous source provider can return the current source view repeatedly; it operates on pushed or presented view controllers and owns interactive dismissal. The public options do not expose Jolt stiffness/damping/mass or this asynchronous realization contract. It is a separate potential backend, not enabled by this adapter. See Apple's [zoom source provider](https://developer.apple.com/documentation/uikit/uiviewcontrollertransition/zoomwithoptions%3Asourceviewprovider%3A) and [fluid transition guidance](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions).

This delivery covers decoded static images/plain containers, one Frame/window and axis-aligned supported geometry. Native modals, nested Frames/tabs, network-image replacement and a gallery pager are outside the contract. Simulator/emulator evidence does not complete the physical-device, screen-reader and performance acceptance matrix in #24/#117. See [reproduction and remaining checks](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/return-targets.md).
