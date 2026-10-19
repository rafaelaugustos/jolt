# Photo zoom, pan and dismissal

`zoomable()` gives a NativeScript `Image` native pinch, double-tap zoom, bounded pan and optional vertical dismissal. It preserves the same image view. Pointer processing, focal-point math, transforms and settling run in native code on both platforms.

```ts
import { zoomable } from '@rafaelaugusto/jolt'

const viewer = zoomable(photo, {
  viewport: photo.parent, // Must be the direct parent
  scale: [1, 5],
  doubleTap: 2.5,
  dismiss: 'vertical',
  backdrop,
  onDismiss(intent) {
    // The application owns navigation; this callback fires once per intent.
    showCloseConfirmation().then((accepted) => {
      if (accepted) {
        if (intent.complete()) closeViewerRoute({ animated: false })
      } else intent.cancel()
    })
  },
})
```

Rebuild the native application after adding the package. Attach after the image has a parent, or supply its future viewport explicitly. Setup waits for both views to load, positive layout and a loaded image. `ready` indicates whether the native controller exists.

Invalid arguments throw synchronously. A later native setup failure disposes the controller, populates `error` and calls optional `onError(error)`, so a missing native rebuild does not become an unhandled initialization rejection.

## Gesture rules

- Pinch follows its focal point in viewport coordinates and stays within the configured scale range.
- Double tap toggles between minimum zoom and `doubleTap` (default 2.5, clamped to the range).
- Above minimum zoom, one finger pans the image; bounds account for visible image content and viewport size. Overscroll resists movement and settles on release.
- At minimum zoom, horizontal movement is available to an ancestor pager. Vertical dismissal requires a clear vertical direction and `dismiss: 'vertical'`; it is disabled by default.
- A dismissal past 35% progress, or a same-direction vertical fling over 1,000 DIPs/s, emits one intent. The controller holds that pose until cancelled, completed or reset.

The scale range defaults to `[1, 5]`. Minimum must be at least 1. Scale is relative to the image's original positive, axis-aligned transform. Rotate an ancestor rather than the image. The viewport clips the transformed content while attached and restores its previous clipping on disposal.

The controller owns image transforms and its gesture input. Do not run another transform animation on the same image while attached. `imageEffect()`, `liquid()` and another `zoomable()` replace this ownership and dispose the previous controller. Use an ancestor for independent screen motion.

## Controls and accessibility

```ts
viewer.zoomTo(3, { x: 100, y: 160 }) // Viewport-local focal point, in DIPs
viewer.zoomTo(2, undefined, false) // Immediate, without settling animation
viewer.reset()
viewer.requestDismiss()
viewer.cancelDismiss()
viewer.dispose()
```

Expose buttons or application accessibility actions for zoom, reset and close, as the demo does. Gesture recognition alone is not an accessible replacement for these controls. Reduced motion makes programmatic movement and settling immediate; direct finger tracking still follows the user.

`state` is a snapshot with `x`, `y` (viewport-local DIPs), relative `scale`, dismissal `progress` and `pending`. `onSettled(state)` runs at rest. There is intentionally no JavaScript progress callback. Optional separate `backdrop` and `chrome` views fade natively with dismissal; their original opacity is restored on reset/dispose.

## Navigation and lifecycle

`onDismiss` receives `{ state, velocity, cancel, complete }`. Velocity is vertical DIPs/s. `cancel()` returns to minimum zoom; `complete()` releases the controller after the router accepts closing. Both return `false` if the intent became obsolete; navigate only after a successful completion. Without a handler, dismissal cancels automatically. Calling a stale intent after reset, replacement or disposal has no effect.

This API is the image interaction portion of a viewer. Shared-element route transitions remain [separate work](./not-there-yet). `nativeController` exposes the native object for adapters; a route must explicitly take ownership before disposing it, using the final state if it wants a continuous handoff.

For a transition that animates a viewer ancestor, keep the dismissal intent pending while navigation animates that ancestor. The image stays at the released pose. On acceptance, hide/remove the route before restoring the image with `complete()`; on cancellation, restore the ancestor and call `cancel()`. Completing before a visible route transition resets the photo too early. An adapter that needs to animate the same image transform must explicitly transfer the native pose; that shared-transition adapter is outside this recipe.

The demo's **Open viewer route** uses a real NativeScript Frame page, a portrait image with transparency and accessible controls. Android system Back and the close button use `requestDismiss()`, which returns a zoomed image to its resting scale before asking the app to close. The example disables iOS's independent edge-back gesture to keep one navigation owner. Keep viewing cancels on the same image view; Leave viewer fades its ancestor before accepting the route pop. The inline image lab also works without a navigation stack.

Source/stretch changes safely reset and reattach. Viewport changes recompute bounds. Unloading either view disposes listeners and restores the original transform. Backgrounding cancels an outstanding dismissal and settles the image; resume re-enables input. Always dispose when an application removes a viewer without unloading its views.
