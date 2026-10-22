# Drag, fling and snap

`drag()` follows a single finger, constrains translation and carries release velocity into a native animation. Added in beta.8.

<Clip name="drag-ios" caption="Real drags with bounded release, rubberband and three panel snap points in the iOS simulator." />

```ts
import { drag } from '@rafaelaugusto/jolt'

const panel = drag(sheet, {
  axis: 'y',
  bounds: { top: 0, bottom: 600 },
  snap: [0, 300, 600],
  rubberband: true,
})

panel.dispose()
```

## Coordinates and release

`axis` is `'x'`, `'y'` or `'both'` (default). Bounds and snap points are **absolute translation coordinates in DIPs**, relative to the view's layout position. They are not screen coordinates or a container's rectangle. Set `right` to the available travel distance yourself; `drag()` does not measure the card's size and subtract it. Omitted edges are unbounded. Bounds must be finite and ordered; equal edges lock an axis.

Snap accepts an array for every enabled axis, or `{ x: [...], y: [...] }`. Points must be finite, nonempty and inside that axis's bounds. The nearest point to the projected decay landing wins; ties choose the first listed. Velocity therefore affects selection. Without snap, the view decelerates with `friction` (default `0.998`, strictly between 0 and 1, retained each millisecond).

Hard bounds are the default: tracking and release stay inside the limits. With `rubberband: true`, dragging past an edge meets increasing resistance. A release outside bounds springs back. A fling reaching a boundary carries its remaining velocity into an edge spring. A snap uses a critically damped spring carrying the release velocity; rubberband allows it to briefly exceed bounds. An omitted snap axis keeps free decay.

An existing translation is preserved when tracking starts. A new gesture interrupts the selected axes at their current presentation; other properties keep animating. Touching during a release stops that release immediately. If the touch never becomes a pan, the view remains at that position. Configure bounds/snap before creation; options are copied. Dispose and recreate to change them after layout changes.

## Driving a motion value

With `value`, the gesture moves a [motion value](./motion-values#dragging) instead of the view, so one sheet can drive the page behind it, a backdrop and anything else bound to that value. The axis is `'x'` or `'y'`, and bounds and snap points are in the value's units:

```ts
const y = motionValue(380)
bind(sheet, { y })
bind(backdrop, { opacity: y.to([0, 380], [0.5, 0]) })
drag(sheet, { axis: 'y', value: y, bounds: { top: 0, bottom: 380 }, snap: [0, 190, 380] })
```

## Events

```ts
drag(card, {
  axis: 'x',
  bounds: { left: -160, right: 160 },
  snap: [-160, 0, 160],
  onStart: ({ x, y }) => highlightCard(),
  onMove: ({ x, y, velocityX, velocityY }) => updateReadout(x, y),
  onRelease: ({ target, animation }) => {
    void animation.finished.then((completed) => {
      if (completed) savePosition(target)
    })
  },
  onCancel: () => clearHighlight(),
  onSettle: ({ x, y }) => clearHighlight(),
})
```

Positions and velocities use DIPs and DIPs/second. Disabled axes have zero velocity. Beyond an edge, reported velocity includes rubberband resistance. `onRelease` receives the projected resting `target` and the `PlaybackAnimation` that plays toward it. `onSettle` fires only after successful completion. Superseded or cancelled release handles resolve `false`; guard completion effects accordingly. Callbacks may cancel or dispose their own controller. Keep move callbacks light.

## Ownership and lifecycle

```ts
const motion = motionScope() // or useMotionScope() in Vue setup
const controller = motion.drag(card, { axis: 'x' })

controller.position // current motion position; x and y
controller.dragging
controller.settling
controller.cancel() // freeze current input/release, remain subscribed
controller.pause() // cancel and detach input
controller.play() // accept a fresh gesture
motion.dispose() // remove listeners and cancel owned release
```

`pause()` cancels, rather than holding a gesture or release for later playback. Scope suspension calls it; scope resume accepts new gestures. A manually paused controller remains paused across scope suspension. Native unload and application suspension cancel input/release and detach gesture listeners. Reload/resume reattach while the controller is alive and not manually paused. Explicit `dispose()` is terminal and idempotent. A second `drag()` on the same view disposes the first; invalid options leave the first intact. Disposal only stops its own release handle, preserving newer animations started by other owners.

Cancellation freezes the current position, even if it is rubberbanded outside bounds. It does not produce a fling, release or settle callback. Multitouch and native gesture cancellation cancel the gesture. `isEnabled = false` prevents tracking. Reduced Motion keeps direct finger tracking and immediately applies the resting target after release.

## Platform behavior and scope

Tracking uses NativeScript's synchronous main-thread pan callbacks and JavaScript property writes. iOS uses `UIPanGestureRecognizer` translation/velocity in parent coordinates. Android estimates velocity from a recent window of raw motion-event positions and timestamps, avoiding feedback as the target moves. Release curves are sampled once and played by the existing native keyframe drivers; there is no JavaScript frame loop after release. A busy JavaScript thread can still delay finger tracking and application callbacks. Android main-runtime JavaScript shares the UI thread with View animations: [native release playback can also stall under heavy main-thread work](./android-performance).

Use an untransformed parent/ancestor chain for matching Android/iOS translation coordinates. This API does not coordinate competing gestures or nested scrolling, perform reorder hit testing, or provide a production bottom sheet. NativeScript/OS gesture arbitration still applies: a parent scroll may take over and cancel a drag, and iOS recognizers may run simultaneously. The demo places the vertical panel on a dedicated non-scrolling screen. Gesture composition and nested-scroll handoff are tracked separately in [#51](https://github.com/rafaelaugustos/jolt/issues/51).

Open **Drag, fling and snap** in the playground, or launch with `--drag-lab` on iOS / `--es drag-lab true` on Android. The demo includes bounded card decay, a panel with three stops, pause/resume, unmount/remount and Reduced Motion.

For content that must stay interactive during native release, register an [interaction surface](./interaction-surface) on its container before starting playback. This is enabled in the drag demo.
