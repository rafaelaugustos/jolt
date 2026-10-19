# Touch targets during animation

`interactionSurface(target)` keeps native touch geometry aligned with Jolt's animated transforms and opacity in a view subtree. Added in beta.8. **Rebuild the iOS app** after installing the new native helper.

```ts
import { animate, drag, interactionSurface } from '@rafaelaugusto/jolt'

const surface = interactionSurface(container)
const animation = animate(button, { x: 180 }, { duration: 1200 })
const cardDrag = drag(card, { axis: 'x', bounds: { left: 0, right: 180 } })

// When this screen is disposed:
cardDrag.dispose()
animation.stop()
surface.dispose()
```

Register the surface **before starting animations**. The target can be a NativeScript view or a supported template ref. It includes the target and its NativeScript descendants. Include every ancestor you animate: opting in only the button cannot fix a separate Core Animation transform on a parent outside the surface. The drag demo registers its container so a card's release remains interactive.

## Why opt in?

By default, Jolt writes the destination to the NativeScript model and plays a Core Animation presentation on iOS. UIKit can then hit-test the destination while the button is visibly elsewhere. The device probe for issue #56 reproduced this with a real button paused halfway through a translation.

Inside a surface, iOS plays the precomputed numeric keyframes with a shared native `CADisplayLink`, updating the actual native transform and opacity. UIKit's ordinary hit testing, gesture delivery, clipping, sibling order and accessibility geometry use that same geometry. No UIView methods are replaced, no transparent proxy control is inserted, and no JavaScript callback runs per frame. Colors and decorations continue using their existing drivers.

Android's native property animations already update touch geometry. The same API is safe to use there and keeps the existing driver.

This is a UI-thread cost on iOS: use a surface for moving interactive content, rather than opting an entire decorative scene in by default. Heavy main-thread JavaScript can delay this playback and touch handling. There is no promise of render-server playback while the app's main thread is blocked. NativeScript's JS property values still follow the engine's destination bookkeeping; they are not reactive per-frame motion values.

## Ownership and playback

The returned handle has `disposed: boolean` and an idempotent `dispose()`. Independent registrations on the same view are reference counted. Disposing one does not remove another.

Disposal disables the surface for **future** animations. It does not stop or switch the driver of animations already running. Registering a surface also does not migrate an existing Core Animation track. Stop or replace that animation after registering if it needs interactive geometry.

Pause, resume, scrub, delay, reverse/repeat and selective interruption retain their animation-handle semantics. Paused tracks keep their native pose without an active display link. Unload cancels the view's animations. On iOS, application suspension cancels interactive tracks at their current pose and resolves them with `false`; start new playback after resume when needed. This avoids retaining an interactive frame loop in the background.

A scope can own both registration and playback:

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
scope.use(() => interactionSurface(container))
const animation = scope.animate(button, { x: 180 })
// scope.dispose() stops owned animations and disposes the registration.
```

## Native interaction rules still apply

A disabled or non-interactive view stays disabled. A clipped part cannot receive touches, and an ancestor's native bounds still constrain hit testing. This API does not expand a parent's touch bounds, arbitrate competing recognizers, or change the drag coordinate limitations documented in [drag](./drag). NativeScript owns the control's label, role and enabled-state accessibility semantics; the surface preserves those controls rather than creating duplicates.

The [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-lifecycle.md) covers OS-injected taps, animated ancestors, clipping, overlapping controls, `press()`, native accessibility frames and lifecycle checks on iOS and Android. It does not claim a manual VoiceOver or TalkBack navigation audit.
