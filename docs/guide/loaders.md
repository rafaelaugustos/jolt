# Loaders

Add a loading indicator to an empty view:

```ts
import { loader } from '@rafaelaugusto/jolt'

const stopLoading = loader(slot, {
  style: 'dots',
  color: '#71717a',
  size: 48,
  duration: 1200,
})

stopLoading() // when the content is ready
```

The indicator stays centered in the target. It uses a `CAReplicatorLayer` with one animated source layer: three pulsing dots, five equalizer bars, or twelve fading dots around a ring. Core Animation plays the loop without JavaScript callbacks per frame or additional NativeScript views.

## Options

| Option     | Default     | Meaning                                                               |
| ---------- | ----------- | --------------------------------------------------------------------- |
| `style`    | `'dots'`    | `'dots'`, `'bars'` or `'ring'`.                                       |
| `color`    | `'#71717a'` | A NativeScript color string.                                          |
| `size`     | `48`        | Maximum width and height in DIPs. Shrinks to fit the target's bounds. |
| `duration` | `1200`      | Milliseconds per cycle.                                               |

Size and duration must be positive finite numbers. Invalid options throw before replacing an existing loader. The indicator follows layout changes without restarting its animation.

The target needs a nonzero width and height; the loader does not give it an intrinsic size. It adds a layer without changing existing content, masks, transforms or hit testing. An empty `GridLayout` makes a suitable slot. Existing clipping still applies.

```vue
<GridLayout ref="slot" width="80" height="64" accessibilityLabel="Loading results" />
```

Set an accessible label or provide a nearby loading status in the app. Decorative layers do not create accessibility elements, and Jolt leaves the target's accessibility settings unchanged.

## Cleanup and lifecycle

`loader()` accepts a view or a ref holding one and returns an idempotent cleanup function. Starting another loader on the same target replaces the previous one. An older cleanup function cannot remove its replacement. Use the returned function to stop the loader; `stop(view)` controls `animate()` tracks.

Calls made before loading wait for a window and a nonzero layout. Unloading, including when the app goes into the background, removes the native layers and the Reduce Motion observer. Loading recreates the indicator. A zero-size target temporarily removes it until a usable layout returns.

Explicit cleanup removes the listeners too and prevents any restart. Keep the function and call it when the owning component is disposed.

## Reduce Motion and platforms

With Reduce Motion enabled, the dots, bars or ring remain visible without animation. The loader responds to preference changes while it is loaded, resuming motion if the setting is disabled.

This implementation is **iOS only**. Android returns a no-op cleanup function and does not draw an indicator.
