# Scroll-linked animations

Build an animation once, then let a `ScrollView` choose its frame:

<Clip name="scroll-linked-ios" caption="Real scrolling collapses the large heading and reveals the compact title, then restores it. iOS simulator." />

```ts
import { scrollLinked } from '@rafaelaugusto/jolt'

const unlink = scrollLinked(
  scrollView,
  header,
  { y: [0, -60], opacity: [1, 0] },
  { range: [0, 120] },
)
```

At offset 0 the header starts at `y: 0`, opacity 1. At 60 DIPs it reaches `y: -30`, opacity 0.5. At 120 DIPs it holds the last frame. Scrolling backward reverses it, including after reaching either endpoint. Overscroll is clamped.

The interpolation is linear, with equally spaced keyframes. All properties supported by [`animate()`](./animating) are available, including [colors](./colors) and [decorations](./decorations) within their platform limits. A scalar value or `null` captures the starting value when the target loads.

## Range and axis

`range` is a pair of distinct finite offsets in DIPs. A descending range reverses the mapping:

```ts
scrollLinked(scrollView, badge, { opacity: [0, 1] }, { range: [120, 0] })
```

The default axis is `y`. For a horizontal ScrollView, choose `x`:

```ts
scrollLinked(
  carousel,
  artwork,
  { rotateY: [-15, 15] },
  {
    range: [0, 300],
    axis: 'x',
  },
)
```

Both arguments accept native views or framework wrappers, just like `animate()`. The source must hold a NativeScript `ScrollView`; this helper does not attach to a ListView or a custom native scroller. The current offset is applied immediately and refreshed on load, so a restored scroll position does not need a new gesture to update the target. Calls made before the target loads remember the latest progress.

## Cleanup and interruption

The return value is an idempotent cleanup function:

```ts
unlink() // remove the binding and freeze the properties at their current frame
```

Unloading either view also removes the binding and releases its animation. Create a new binding when reusing an unloaded screen. Stopping or replacing every linked property removes the listener as well. Replacing just one property lets the remaining ones follow the scroll without taking the replaced property back. Other animations and scroll listeners remain independent.

The animation stays paused throughout the binding, including at progress 1. It does not finish just because the user reached the end of the range. Use `animate()` separately after unlinking if the view should continue moving on its own.

## Timing and cost

Each scroll event synchronously sets one `progress` value on the paused animation. Repeated values, including clamped overscroll, are skipped. There is no timer, animation-frame callback, new curve calculation or call to `animate()` per event.

The playback drivers still seek each property they own: this is not a single native bridge call for an arbitrary number of properties. iOS applies the corresponding paused Core Animation copies; Android repositions native animators. Scroll delivery and progress updates need JavaScript on the main thread. This is not a native scroll timeline that can keep following input while JavaScript is blocked; Android's [UI-thread limitation](./android-performance) still applies.

The playground uses the main ScrollView to move and fade the large heading while revealing a fixed compact title. Both directions use this public API.
