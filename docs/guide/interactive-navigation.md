# Interactive navigation

`interactiveNavigation(frame)` gives a **custom iOS page transition** a native edge-swipe return. The page follows the finger; releasing before halfway cancels, while continuing or a forward flick commits the pop. A Jolt spring preserves release velocity and settles the pages. The Frame and router update their history only when UIKit commits.

Available since **0.1.0-rc.1**. Rebuild the native app. This integration is verified with NativeScript Core **9.1.3** and `vue-router-ns` **0.1.0-rc.2**.

<Clip name="interactive-navigation-ios" caption="iOS 26.2 simulator: real XCTest taps and edge drags open a page, cancel a partial return, commit a full return, then use the back button. Native playback at original speed; not a physical-device performance measurement." />
<Clip name="interactive-navigation-pt-ios" caption="iOS 26.2 simulator: the same cancel, commit and button navigation in Portuguese, driven by real XCTest input at original speed." />

## Suspension and rotation

**Fixed in 0.1.0-rc.2:** NativeScript temporarily unloads the root Frame when the app enters the background. Jolt cancels a held return and keeps its owner while that Frame reloads. The same page, history and custom transition remain available after resume. A Frame that stays detached, a removed route or an explicit `dispose()` still releases the owner.

<Clip name="interactive-background-ios" caption="iOS 26.2 simulator, English demo: a real edge drag is held while switching to the Home screen. Returning preserves the page; a new Jolt swipe commits once, followed by button navigation. Original speed; no physical-device performance claim." />

In the tested iOS configuration, rotating the device during a held gesture defers the interface rotation until the partial return settles. The recording verifies the retained page, landscape/portrait layout and a subsequent committed swipe; it does not demonstrate an immediate viewport change during the drag.

<Clip name="interactive-rotation-ios" caption="iOS 26.2 simulator, English demo: orientation changes while the edge gesture is held; UIKit waits for cancellation before displaying landscape. Back in portrait, a new swipe returns normally. Real native input at original speed." />

## One handle per pushed entry

```ts
import { interactiveNavigation } from '@rafaelaugusto/jolt/interactive-navigation'

// The Frame is already loaded. Create a fresh handle for each push.
const motion = interactiveNavigation(frame, {
  spring: 'smooth', // or { duration: 480, bounce: 0 }
  onState(event) {
    // Lifecycle notifications, never a per-frame observer.
    if (event.outcome === 'cancelled') console.log('Still on this page')
  },
})

try {
  await router.push('/place/cala-serena', { transition: motion.transition })
  // A guard/redirect may resolve without using this transition.
  if (motion.state === 'ready') motion.dispose()
} catch (error) {
  motion.dispose()
  throw error
}

// The pushed entry remembers the transition for programmatic back too.
await router.back()
```

For Core alone, pass `transition: motion.transition` to `frame.navigate({ create: () => page, ... })`. Dispose a handle if that navigation is never started. Do not reuse its transition for another entry. A committed pop, history removal or Frame unload automatically releases the recognizer and Core transition state. `dispose()` is idempotent; disposing on the visible page restores Core's default swipe according to `page.enableSwipeBackNavigation`.

`supported` is false and `transition` is undefined on Android or when the compiled native class is absent. The caller can navigate normally with those options. This entry does not implement Android predictive back.

## Finger, spring and route ownership

- A native `UIScreenEdgePanGestureRecognizer` starts at the leading edge (left in LTR, right in RTL). It requires horizontal intent, a current entry with a back destination, and no active UIKit transition.
- The gesture calls Core's supplied pop callback once. Core's existing navigation-controller delegate supplies Jolt's native animator and interactive controller; Jolt does not replace or swizzle that delegate.
- Native gesture updates move the real page views. On release, `JoltSpringAdvance` runs on a native display link, carrying the finger's velocity into the same spring equation used by Jolt's live values. There are no JS callbacks per frame. Main-thread JS can still block UIKit.
- Completion uses progress plus a short velocity projection. Moving back towards the edge can cancel even after crossing halfway. Settlement is bounded to three wall-clock seconds, including unusual spring settings or a slow global `timeScale`.
- Cancelling restores both page transforms and keeps the current route and back stack. Committing pops once. Nested entries keep independent handles; only the top entry accepts gestures.

`spring` accepts `smooth`, `snappy`, `bouncy`, or duration/bounce and stiffness/damping/mass settings. Delay, repeat, tween and explicit velocity options are not accepted. Gesture progress stays attached to the finger; global `timeScale` affects the spring at the start of each navigation. Progress is clamped to the page bounds even with a bouncy spring.

## Guards, accessibility and cleanup

`page.enableSwipeBackNavigation` is always respected. `vue-router-ns` disables it while asynchronous route-leave guards need to run; use the back button for guarded navigation. An optional synchronous `canBegin()` can impose an additional gate. It cannot await an asynchronous decision.

Reduced motion disables the edge gesture and finishes programmatic page motion immediately. The back button remains available. Suspension, viewport changes, `cancel()` and disposal roll a held gesture back. Once UIKit has accepted a release, cleanup finishes that decision rather than trying to reverse a committed pop.

The `state` is `ready`, `animating`, `idle`, `dragging`, `finishing`, `cancelling` or `disposed`. The `finishing`/`cancelling` event includes `release: { progress, velocity }`, with velocity in page widths per second. An `idle` notification after a gesture includes `outcome: 'completed' | 'cancelled'`. Observer exceptions are reported through NativeScript Trace and do not interrupt cleanup.

Keep the previous page's visible content mounted while it is in the Frame's back stack: interactive return previews it **before** `navigatedTo`. Rebuilding everything only on that event produces an empty preview.

By default this API animates whole Frame pages. For image/card motion on the same native progress, use the [shared gestures](./shared-gestures) composition. Arbitrary native modals, full-screen swipe gestures and automatic realization of recycled views remain outside this contract. Use a normal back button as an accessible alternative. See [native validation](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).
