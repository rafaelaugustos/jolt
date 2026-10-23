# Real dimensions

`animateSize()` changes a view's actual `width` and `height`, including transitions to and from `auto`. Text reflows, icons retain their proportions, and siblings move through ordinary NativeScript layout. Use it for expanding cards and accordions.

<Clip name="size-ios" caption="Real width/height, intrinsic content changes, pause, reversal and a tappable following row in the iPhone 17 simulator, iOS 26.0. The controls explicitly select 0.25× speed for the interruption segment; video timing is unchanged." />
<Clip name="size-android" caption="The native Android 16 emulator demo: width and height reflow, content-driven auto sizing, pause/resume, interruption and GridLayout. Slow motion is selected in the app; these are real ADB touches." />

```ts
import { animateSize } from '@rafaelaugusto/jolt'

await animateSize(card, { height: 'auto' }, 'snappy')
await animateSize(card, { height: 80 }, { duration: 300 })
await animateSize(card, { width: 240, height: 'auto' }, 'smooth')

// Capture the current bounds BEFORE changing content.
await animateSize(
  card,
  { height: 'auto' },
  () => {
    description.text = longerDescription
  },
  { duration: 350 },
)
```

This is separate from [`animateLayout()`](./layout). FLIP measures a final layout once, then animates transforms; its size mode scales content. `animateSize()` performs measurement and real layout during playback. Neither API is a shared-element navigation transition. `animate()` keyframes continue to exclude width/height.

## Destinations and containers

Pass one or both dimensions. Destinations are finite, nonnegative DIP numbers or `'auto'`; arrays, percent strings, unit objects and unknown properties are rejected before replacing an existing size animation. Existing NativeScript numeric, DIP/px declarations and `auto` can be starting points; a percent declaration on an animated axis is rejected. Ancestor percentages can resolve normally in the layout tree.

`auto` follows the view's **existing alignment and parent constraints**. It is intrinsic size where the parent permits it; a stretched cross-axis can fill the available slot. Set `horizontalAlignment="left"` or `verticalAlignment="top"` when you want intrinsic sizing in a constrained axis. Jolt does not change alignment, padding, margins or clipping. Set `clipToBounds="true"` on an accordion if overflowing children should be hidden while it closes.

| Container or allocation                                                            | Contract                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct child of vertical/horizontal StackLayout                                    | Supported; following siblings participate in every layout.                                                                                                        |
| Direct child of GridLayout                                                         | Supported; `auto` rows/columns grow with content. Fixed or `*` tracks keep their own allocation, so resizing an inner view does not animate the track definition. |
| Stack/Grid nested inside ScrollView                                                | Supported; real content bounds update scrolling. Do not animate the ScrollView's content offset with this API.                                                    |
| Both width and height                                                              | Measured together at the destination width; text wraps at every intermediate width. Pass `height: 'auto'` as well to animate the changing height envelope.        |
| FlexboxLayout, WrapLayout, AbsoluteLayout, custom direct parent                    | Rejected. Layout policy needs separate validation.                                                                                                                |
| Recycled ListView/CollectionView cells, virtualized or custom-measured descendants | Unsupported; no recycled-cell ownership or measurement contract.                                                                                                  |

Parent allocation remains authoritative. Values and spring overshoot are clamped to zero and min/max constraints; max wins if min exceeds max. A numeric destination outside min/max settles to the clamped number. An `auto` destination restores **semantic auto**, allowing later content changes to resize normally.

## Content, interruption and controls

The optional change callback runs synchronously after the old bounds are captured. Vue's queued view updates can run before the first measurement. Fetch data before the call; async callbacks are rejected. Text, image, font and parent-constraint changes during playback are remeasured on subsequent animation frames. A changed endpoint starts from the current real bounds, carrying the current curve velocity and dropping the original delay. Continuously changing content can therefore extend completion. After completion Jolt stops observing; call again to animate a later change.

One operation owns the requested axes of a view. A second `animateSize()` on that view replaces the entire old operation, resolves it `false`, and starts at the current bounds; any previously owned axis omitted by the new request returns to its original declaration. Other transform/opacity tracks remain independent.

```ts
const animation = animateSize(card, { height: 'auto' })
animation.pause() // hold actual bounds, no pending frame callback
animation.play() // remeasure on resume
animation.stop() // keep current size as local numeric declarations
// Alternatively: animation.stop({ restore: true })
// releases the temporary overrides, revealing the original local/CSS declarations.
const completed = await animation.finished
```

Completion resolves `true`; replacement, stop, unload and background suspension resolve `false`. An unloaded/collapsed view, or a tree without its initial layout allocation, applies the destination without retaining playback and resolves `false`. Unload/background restore original declarations so recycled or reloaded views are not stranded at intermediate sizes. Unexpected measurement errors reject `finished` after cleanup.

Explicit local or CSS writes to an owned dimension cancel the operation and take ownership, including writes hidden beneath its temporary override. Unowned dimensions are left alone. Jolt refuses to replace an existing CSS keyframe animation of an owned dimension. A content mutation is never undone by cancellation.

Use `motionScope().animateSize()` or Vue's `useMotionScope().animateSize()`. Scope suspension pauses; resume continues; reset/disposal stops and holds the current numeric size. Reduced Motion settles to the destination, including a preference change while paused. Global `timeScale` applies; Android playback uses the system animator clock. Tweens/springs, easing and delay are supported. Repeat, arbitrary keyframe times and seeking are deliberately unsupported because intrinsic endpoints can change; this is a `SizeAnimation`, not a `PlaybackAnimation`.

## Execution and cost

**This API runs JavaScript and NativeScript layout on the UI thread each animation frame.** A library-owned CADisplayLink/Choreographer callback samples the curve, probes the destination in the existing tree, restores current dimensions and lays out the tree before drawing. It creates no duplicate/accessibility views and never draws the speculative endpoint. Both axes share a measurement pass; there is no application timer. Default transform animations retain their existing native playback path.

The initial implementation probes the destination every frame to detect intrinsic changes. Expect two root measurement calls and one explicit layout per active operation/frame, plus framework passes. Multiple animated views and deep trees add cost; this is not render-thread independence. Main-thread JS stalls this animation. Prefer transform-based `animateLayout()` when reflow is unnecessary.

Open **Real dimensions** in the playground, or launch `--size-lab` on iOS / `--es size-lab true` on Android. The [native validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/size-layout.md) records container coverage, runtime versions, real bounds/hit tests and measured layout costs. Simulator/emulator results are not a device-performance guarantee.
