# Native gestures and scroll handoff

`gestures()` composes pan, pinch and rotation on a `GestureSurface`, a NativeScript `GridLayout` with a native input boundary. Its read-only outputs work with `bind()`, numeric `to()` mappings and `springValue()`. Recognition, pointer tracking and bound output updates do not require JavaScript callbacks for each movement.

Import this optional API from `@rafaelaugusto/jolt/gestures` and rebuild the native app after upgrading.

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'

const scope = motionScope()
const surface = new GestureSurface()
surface.addChild(card)
container.addChild(surface)
const input = scope.add(
  gestures(surface, {
    pan: { bounds: { left: -120, right: 120, top: -160, bottom: 160 } },
    pinch: { min: 0.5, max: 3 },
    rotate: true,
  }),
)
scope.use(() =>
  bind(card, {
    x: input.x,
    y: input.y,
    scale: input.scale,
    rotate: input.rotate,
  }),
)
const follower = scope.add(springValue(input.x))
scope.use(() => bind(trailingCard, { x: follower }))

// On page/component disposal:
scope.dispose()
```

<Clip name="gesture-composition-ios" caption="Actual OS touch input in an iOS simulator: simultaneous pan, pinch and rotation, adding/removing a finger, separate gestures, single/double tap, and an existing NativeScript tap listener. The recording harness uses XCTest; it is not a physical-device performance measurement." />

<Clip name="gesture-composition-android" caption="Actual OS multi-touch input on an Android emulator, followed by single/double taps and pointer cancellation. The NativeScript tap listener remains attached. Gesture positions are DIP; scale is unitless and rotation is degrees." />

## Recognition policies

Enabled pan, pinch and rotation recognize simultaneously. Adding or removing a finger rebases the pan centroid and scale/rotation measurements without adding that change of centroid to the output. Transform outputs are independent; use [zoomable](./photo-zoom) when you need image-specific focal zoom, content bounds and dismissal.

`pan` accepts `axis: 'x' | 'y' | 'both'` (default `'both'`), `threshold` (default **8 DIP**), `failOffset` (default **12 DIP**) and translation `bounds`. A one-axis pan fails before activation when perpendicular motion exceeds `failOffset`, allowing a parent scroll to win. Bounds are hard limits during contact. The surface should sit in an unscaled, unrotated ancestor chain; move its bound content separately when possible.

`pinch: true` uses scale limits **0.25–4**; pass `{ min, max }` to change them. `rotate: true` enables rotation in degrees. `initial` accepts `{ x, y, scale, rotate }`, defaulting to `{ x: 0, y: 0, scale: 1, rotate: 0 }`; initial values must fit their configured bounds.

`onTap` and `onDoubleTap` are separate. When both exist, the single tap waits for double tap to fail. Without a double-tap callback, the single tap does not wait for that relationship. `onStart`, `onEnd` and `onCancel` report `{ x, y, scale, rotate, velocityX, velocityY }`; translation velocities are DIP/second and disabled axes report zero. A cancelled active interaction emits one cancellation and no end callback. There is no automatic fling; choose a release action in `onEnd`.

These are the built-in relationships of one surface, not an arbitrary graph of external recognizers. Existing NativeScript listeners remain independent. A listener that writes the same transform can still compete with a Jolt binding.

## A horizontal interaction in a vertical list

Place a `GestureSurface` in the list's content, configure an x-axis pan and bind the card's x position. Horizontal movement activates the pan; vertical movement lets the surrounding native scroll take over. The surrounding list is not the `scrollView` option below.

<Clip name="gesture-carousel-ios" caption="A horizontal interaction inside a vertical NativeScript ScrollView on an iOS simulator. A vertical drag starts on the same card and scrolls the parent." />

<Clip name="gesture-carousel-android" caption="The same axis competition on an Android emulator. Horizontal motion stays with the card; vertical motion scrolls its parent." />

## Transfer between a panel and its content

For a vertical panel containing a **NativeScript ScrollView**, pass that descendant as `scrollView` and supply both vertical bounds:

```ts
const input = scope.add(
  gestures(panelSurface, {
    initial: { y: 180 },
    pan: { axis: 'y', bounds: { top: 0, bottom: 320 } },
    scrollView: results,
    onEnd: ({ y, velocityY }) => {
      input.settleTo({ y: y + velocityY * 0.15 < 160 ? 0 : 320 })
    },
  }),
)
scope.use(() => bind(panelSurface, { y: input.y }))
```

Dragging up consumes the panel's remaining travel before scrolling its content. Dragging down consumes the content's distance to the top before moving the panel. The same contact continues across the boundary. Android uses nested pre/post scroll consumption; iOS coordinates a simultaneous pan with the native scroll view and forwards its existing delegate. Native scrolling retains its release when the expanded content can consume it.

<Clip name="gesture-handoff-ios" caption="One continuous swipe expands the panel and then scrolls its contents; the reverse swipe reaches the content's top and moves the panel down. iOS simulator, in-page test panel." />

<Clip name="gesture-handoff-android" caption="The same in-page handoff on an Android emulator using NativeScript's NestedScrollView implementation. No finger lift is needed at the panel/content boundary." />

This integration was tested with NativeScript core **9.1.3**, iOS runtime **9.1.0** and Android runtime **9.1.1**. It supports the vertical core ScrollView; it does not promise handoff for ListView, RecyclerView plugins, third-party list implementations or horizontal inner scrolling. Android checks that the native scroll implements the required nested-scroll protocol. A different list needs its own adapter and native tests.

## Movement and ownership

`position` reads all four current values. After the surface loads, `jumpTo(partialPosition)` moves immediately and `settleTo(partialPosition)` uses a native spring. A settle called from `onEnd` carries release velocity; retargeting an existing settle preserves its current velocity. `spring` accepts `stiffness`, `damping` and `mass`. Reduced Motion makes settling immediate while direct finger tracking remains available.

`updateBounds(partialBounds)` updates limits without resetting position or velocity. It does not select a new destination: call `settleTo()` with the newly resolved snap point when layout/content changes.

`cancel()` freezes contact or settling at the current position. `pause()` cancels and stops accepting input; `play()` accepts a fresh contact. Scope suspension uses these methods. Unload and app suspension cancel input; reload/resume restores it unless manually paused. `dispose()` removes owned recognizers/native dispatch, restores scroll delegation and releases all four values. Settling or lifting a finger does not end the controller's lifetime.

In Vue, register `GestureSurface` with `registerElement('GestureSurface', () => GestureSurface)` before mounting the app, and adopt the controller with `useMotionScope().add(...)`. Add bindings with `useBinding()` or the scope's `use()` helper. The demo is available under **Native gestures** in the playground or with `--gesture-lab` on iOS / `--es gesture-lab true` on Android.

Native input and live springs still execute on the UI thread. Busy JavaScript on that thread can delay them. Explicit callbacks, existing Core listeners and `subscribe()` retain their JavaScript costs. The multi-touch injectors live only in the recording harness; they are not shipped as application code.
