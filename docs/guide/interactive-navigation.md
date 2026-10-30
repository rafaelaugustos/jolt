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

By default this API animates whole Frame pages. For image/card motion on the same native progress, use the [shared gestures](./shared-gestures) composition. Modal presentation uses the separate `interactiveModal()` handle below. Full-screen page swipes and automatic realization of recycled views remain outside the Frame contract. Use a normal back button as an accessible alternative. See [native validation](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).

## Interactive modals

**Unreleased:** `interactiveModal()` adds a downward dismissal to a full-window NativeScript modal. Open **Interactive navigation → Open a modal** in the preview. Rebuild the native app; this path is verified with Core **9.1.3**, NativeScript-Vue **3.1.2** and iOS **26.2 Simulator**.

<Clip name="interactive-modal-ios" caption="iPhone 17, iOS 26.2 Simulator, English: open a real NativeScript-Vue modal, cancel a downward drag, retry and commit, then reopen and close with the button. Original-speed native playback. No physical-device performance or screen-reader claim." />

Create a fresh handle for each presentation. Core and Vue own the modal and its close callback; Jolt supplies the native animation and interaction objects through Core's existing transition delegate.

```ts
import { interactiveModal } from '@rafaelaugusto/jolt/interactive-navigation'
import { $showModal } from 'nativescript-vue'

const motion = interactiveModal({
  spring: 'smooth',
  canBegin: () => !saving,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Still open')
  },
})
try {
  const result = await $showModal(Detail, {
    transition: motion.transition,
    props: { motion },
  })
} finally {
  motion.dispose()
}
```

Inside the modal, use `motion.close(result)` for the close button. On an unsupported platform, use the framework's ordinary `$closeModal(result)` instead. For Core without Vue, pass the same `transition` to `parent.showModal(content, { transition, closeCallback })`; ordinary `content.closeModal(result)` remains available. Dispose an unused handle if presentation fails or is abandoned. The [runnable Vue example](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/InteractiveModalDetail.vue) is independent of the page router.

| Operation        | Contract                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Downward drag    | One native pan owns the modal. Progress follows the finger; release projects velocity to choose commit or cancellation. Native UIControls and UIScrollView descendants keep their own gestures. |
| Cancel           | Restore the original controller-view transform, keep the same Core modal and Vue component, and leave the close callback/promise pending. Another gesture or button close can follow.           |
| Commit           | Complete UIKit once; Core invokes the close callback and Vue unmounts once. Native gesture/display-link resources and Core transition state are released.                                       |
| `close(...args)` | Forward arguments to Core. The first request during opening queues until `shownModally`; duplicates and requests during a drag/settlement return `false`. Accepted requests return `true`.      |
| `cancel()`       | Roll back a held drag. A release already accepted by UIKit finishes its chosen outcome.                                                                                                         |
| `dispose()`      | Idempotently detach Jolt without closing the modal. A held drag cancels before Core bookkeeping is released; ordinary Core/framework close remains available.                                   |

`cancelable: false` in the modal options and synchronous `canBegin()` block gesture dismissal. Keep an accessible close button. Reduce Motion makes presentation and settlement immediate while retaining direct finger control. Changes to the preference cancel a held drag. Global `timeScale` affects settlement, bounded to three wall-clock seconds. Lifecycle notifications use `ready`, `presenting`, `idle`, `dragging`, `finishing`, `cancelling`, `closed` and `disposed`; cancellation reports `idle/cancelled`, completion reports `closed/completed`. Release velocity is in **modal heights per second**. There is no per-frame JS observer.

Suspending during a held drag cancels it and retains the modal for resume. The recorded rotation is requested while contact remains down; UIKit displays landscape after the cancelled transition settles on this configuration. Portrait restoration and subsequent dismissal remain usable.

<Clip name="interactive-modal-lifecycle-ios" caption="iPhone 17, iOS 26.2 Simulator, English: real held drag, Home/foreground, rotation, a cancelled retry and a committed dismissal, followed by reopening and button close. Original speed; landscape is rotated inside the portrait recording. Snapshot and other small controls are opt-in diagnostics. No physical-device or accessibility acceptance claim." />

The supported style is Core's **custom full-window modal**, with its default animated presentation. Do not override `ios.presentationStyle` or replace its transitioning delegate. `animated: false` explicitly uses ordinary noninteractive presentation/close; it does not install the Jolt pan. Native sheet detents, popovers, foreign UIKit presentations and scroll-to-dismiss handoff are outside this API. A scrollable modal can expose a non-scrolling header for dismissal. `supported` is false on Android, without the rebuilt native class, or on Core versions without `closedModallyEvent`; `transition` is then undefined. The example's physical-device performance and VoiceOver traversal have not been measured.

[Native observations and reproduction](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md#interactive-modals--2026-10-30) cover the tested modal behavior and cleanup.
