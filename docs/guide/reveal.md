# Circular reveal

Reveal content from a point, or conceal it with the reverse effect:

```ts
import { reveal, conceal } from '@rafaelaugusto/jolt'

await reveal(details, { from: { x: 40, y: 40 }, duration: 500 })
await conceal(details, { to: { x: 40, y: 40 }, duration: 500 })
```

Both functions accept a view or a ref holding one. On iOS, a temporary `CAShapeLayer` mask animates its circular path in Core Animation, without JavaScript work per frame. The circle grows far enough to cover every corner, including for origins outside the view.

## Options

| Option               | Default | Meaning                                                                           |
| -------------------- | ------- | --------------------------------------------------------------------------------- |
| `from` in `reveal()` | Center  | Circle origin, with finite `x` and `y` in DIPs from the target's top-left corner. |
| `to` in `conceal()`  | Center  | Point the circle contracts toward, in the same coordinates.                       |
| `duration`           | `400`   | Nonnegative finite milliseconds. Zero changes visibility immediately.             |

The curve is ease-in-out. When interrupting an active reveal or conceal, omitting the point keeps the current circle's center. These functions currently support circular masks; wipes and other shapes are not included.

## Visibility and layout

`reveal()` makes the target visible behind the expanding mask. `conceal()` ends with `view.visibility = 'hidden'`, so it keeps its layout space and no longer receives touches. Concealing an already hidden or collapsed target leaves its visibility unchanged.

The mask does not resize or reposition the view. Existing masks, including Core's clip paths and nonuniform rounded borders, are kept inside the temporary mask and restored afterward. Opacity and transforms are preserved.

An unloaded view waits for loading, a window and nonzero bounds. Revealing a collapsed target first changes it to `hidden` so it can be measured. Prefer an initially hidden target when its space should already be reserved.

If application state also controls `visibility`, keep it in sync with the effect. During playback the mask only clips rendering; the view's rectangular touch area is unchanged until conceal finishes. Shadows drawn outside the view's own layer are not included in the circular mask.

## Interruption and cleanup

The result has `finished`, `stop()` and `then()`, like `animate()`:

```ts
const opening = reveal(details, { duration: 800 })
// A later action can reverse from the circle currently on screen.
const closing = conceal(details)

await opening // false: superseded
await closing // true if it reached the hidden state
```

Native completion resolves with `true`. Stopping, superseding, unloading or native cancellation resolves with `false`. Invalid options throw before replacing a running effect. Use the returned handle; `stop(view)` controls `animate()` tracks.

`animation.stop()` removes the temporary mask and restores visibility from before the interrupted reveal/conceal chain. It does not leave a frozen partial mask. An external visibility change cancels the animation while keeping the application's new value.

Changing bounds, native views, backgrounds or clip styles cancels the effect and restores the prior visibility. Start a new effect after the layout/style change has finished. Unloading cancels without replay on reload. Completion and cancellation remove the native animation, mask, listeners and Reduce Motion observer. Keep the handle and stop it when the owning component is disposed.

Use separate wrapper views when combining this effect with another effect that actively manages masks, such as `shimmer()`.

## Reduce Motion and platforms

With Reduce Motion enabled, the final visibility is applied immediately and the result is `true`. Enabling it during playback finishes the effect immediately too, with no replay if it is later disabled.

This implementation is **iOS only**. Android calls resolve with `false` without changing the view.
