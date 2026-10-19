# Layout changes

`animateLayout(container)` animates the next layout change of a container's direct children. A new row makes room, removing a card closes the gap, and reordering existing views moves them into their new positions. Available in the next release after beta.8.

```ts
import { animateLayout } from '@rafaelaugusto/jolt'

animateLayout(list, () => rows.value.splice(1, 0, newRow))
animateLayout(list, () => rows.value.reverse(), 'snappy')
animateLayout(list, () => {
  expanded.value = !expanded.value
})
```

Use stable keys for Vue children. This API tracks **view instances**, not data IDs. It supports ordinary containers such as StackLayout, GridLayout and WrapLayout. Recycled ListView/CollectionView rows need their own item-animation integration; they are outside this API.

## Capture, change, animate

With a callback, Jolt captures the current geometry, executes the mutation synchronously, requests layout and applies the inverse transforms before the next draw. Vue's queued DOM update can happen between the mutation and that layout pass.

Without a callback, change the layout immediately after calling it:

```ts
const animation = animateLayout(list, { duration: 350, ease: 'easeOut' })
rows.value.push(newRow)
await animation
```

One call covers one layout pass; it is not a permanent observer. Fetch or await data **before** calling it. Async callbacks are rejected. A no-op still requests a layout pass and resolves without a fixed-delay fallback. An unloaded or collapsed container applies the mutation immediately and resolves without retaining work to animate on a later load.

Only direct children are tracked. To move a container's neighbours when it grows, call `animateLayout` on its parent. Nested changes can use separate calls on their own containers. Removed views leave immediately; the remaining views animate into the gap. This API does not retain removed views for an exit animation.

## Size and content

The default `size: 'scale'` scales from the old dimensions to the new dimensions, respecting the view's existing translation, scale and origin. Layout itself computes its final size once. Scaling temporarily stretches text, corners and other content; it is not continuous text reflow.

Use `size: false` to apply the new size immediately while animating positional changes:

```ts
animateLayout(
  list,
  () => {
    expanded.value = !expanded.value
  },
  {
    size: false,
    duration: 300,
  },
)
```

Views with zero/nonfinite dimensions or collapsed visibility are not measured. A child becoming measurable is treated as new. Origin or rotation changes made in the same mutation, and children using X/Y 3D rotation, skip the translation/scale inversion; animate those transforms explicitly instead. Ancestor transforms are outside this local-layout calculation.

## Options

The third argument (or the second without a callback) accepts `'smooth'`, `'snappy'`, `'bouncy'`, or a `LayoutOptions` object:

| Option                   | Behavior                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Tween or spring settings | `duration`, `ease`, `times`, `type`, `bounce`, `stiffness`, `damping`, `mass`, `velocity`, `delay`; same units as `animate()` |
| `size`                   | `'scale'` (default) or `false`                                                                                                |
| `enter`                  | `true` (default) fades new children to their configured opacity; `false` shows them immediately                               |

Settings apply uniformly to the children. Duration/delay must be finite and nonnegative; physical stiffness/mass must be positive, damping nonnegative, and bounce between -1 and 1. A duration-based spring needs a positive duration; use a zero-duration tween for an immediate result. Repeats, relative frames, per-property overrides and stagger are not layout options. Invalid options are rejected before the mutation runs or an earlier request is cancelled.

Global `timeScale` applies to playback. Reduced Motion makes geometry settle immediately and keeps the optional opacity entrance, following Jolt's normal reduced-motion behavior.

## Interruptions and ownership

A second request before layout replaces the pending request. During playback, a new change reads the old animation's live pose at the next layout pass and starts replacement tracks before cancelling old handles. Existing application translations/scales remain the resting values; they are not forced to zero/one.

An explicit animation started after capture keeps ownership of its properties. Geometry playback owns `x`, `y`, `scaleX`, `scaleY` as needed and the opacity of entering children. Disjoint properties continue normally.

The returned `Animation` is awaitable, exposes `finished`, and has `stop()`. Completion resolves `true`; replacement or cancellation resolves `false`. **Stopping settles this operation's temporary offsets into the final layout**, rather than leaving cards between their layout positions. Cleanup preserves newer animation owners. It does not undo the data mutation. This aggregate handle does not expose pause or scrub.

Native unload and app suspension cancel the request/playback and remove listeners. Use a scope for component ownership:

```ts
const scope = motionScope() // or useMotionScope() in Vue setup
const animation = scope.animateLayout(list, () => rows.value.reverse())
// scope.reset(), scope.suspend() and scope.dispose() cancel owned layout work.
```

Mutation exceptions are rethrown synchronously after cleanup. Unexpected errors while preparing native playback reject `finished` after stopping partially started work.

## Native drawing and touch geometry

Jolt reads untransformed native bounds in parent DIPs. Android starts playback from a one-shot pre-draw listener. iOS waits until the container's NativeScript layout method has finished, then writes the inverse transform before drawing. Measurement and inversion run once in JavaScript; curves play natively afterwards.

Layout tracks automatically select the [interactive geometry driver](./interaction-surface) on iOS so moving controls remain tappable at their visible positions. Only these new tracks are opted in; this does not migrate unrelated existing animations. Animated ancestors outside the layout operation still need their own interaction surface. iOS playback uses the native UI thread, so heavy main-thread JavaScript can delay it. The iOS integration also handles NativeScript's cached transform flag while interactive tracks assign new native frames; hooks are local to the affected instances and removed on completion/cancellation.

Open **Layout changes** in the playground, or launch `--layout-lab` on iOS / `--es layout-lab true` on Android. The demo includes insertion/removal, reorder, expansion, slow motion, size policy, stop, Reduced Motion and unmount/remount. See the [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/layout-lifecycle.md) for native and OS-input coverage.
