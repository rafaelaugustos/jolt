# Motion along a path

```ts
animate(
  plane,
  { path: 'M0 0 C80 -120 200 -120 280 0', orient: true },
  { duration: 1200, ease: 'linear' },
)
```

`path` supplies translation coordinates in **DIPs**, relative to the view's untransformed layout position. Positive X points right; positive Y points down. The example arches upward and ends 280 DIPs to the right. It does not resize or reflow the view, or animate the layout-owned native position.

## Timing and orientation

Jolt measures distance along the curve. Linear easing moves at approximately constant distance per unit of time; another easing changes progress over the whole route, rather than restarting at each geometric sample. The default is a 300 ms ease-out tween. Use `path` in the options to time the route separately from other properties:

```ts
animate(
  plane,
  { path: route, orient: true, opacity: [0, 1] },
  {
    duration: 300,
    path: { duration: 1200, ease: 'easeInOut' },
  },
)
```

`orient: true` aligns artwork facing **+X** with the forward tangent, in degrees. Angles are unwrapped across ±180° so a circle turns continuously. With orientation omitted or `false`, the current rotation is left alone; a separate `rotate` animation is also allowed.

Springs drive the same shared 0–1 path progress:

```ts
animate(plane, { path: route, orient: true }, 'bouncy')
```

Progress outside 0–1 is clamped to the route endpoints, so an overshooting spring can hold there briefly before moving back along the path. Paths have an explicit starting pose and do not infer a progress velocity from the animation they replace. A spring's explicit `velocity` uses progress units per second. Ordinary animations taking over from a running path inherit its coordinate velocity.

Repeats, reverse repeats, delay, stagger and haptics use the existing animation timeline. Reversing rewinds the sampled orientation as well as the coordinates; it does not add a 180° turn to make the artwork face backward travel. Sharp corners and cusps can turn abruptly, with interpolation between adjacent native samples.

## Relative paths

```ts
animate(
  plane,
  { path: 'M0 0 Q80 -120 160 0', orient: true },
  {
    duration: 1000,
    relative: true,
  },
)
```

`relative: true` adds the view's starting translation to the route, and its starting rotation to an oriented route. The base is captured once when the target loads, using the presented value if another animation owns it. Coordinates are not rotated by that base angle: a starting rotation acts as an artwork heading offset. Without relative mode, the first `M` explicitly selects the starting translation.

## Playback, sequences and stopping

The return value is the usual [`PlaybackAnimation`](./playback). Pause, scrub, continue or stop it. Paths also work in [`sequence()`](./sequences), [custom presets](./presets#custom-presets), [`scrollLinked()`](./scroll-linked) and `press()`.

```ts
const flight = animate(plane, { path: route, orient: true }, { duration: 2000 })
flight.pause()
flight.progress = 0.5
flight.play()

stop(plane, ['x', 'y', 'rotate']) // freeze the generated tracks
```

A path owns `x` and `y`, and owns `rotate` when oriented. Supplying competing keyframes or per-property timing for those coordinates in the same call throws; use the shared `path` transition instead. Other properties remain independent. Stopping or replacing just one coordinate leaves the others running along their original tracks, so they no longer describe the whole route together. There is no virtual `path` property to pass to `stop()`.

## SVG data and limits

The parser accepts one continuous subpath with a single `M`/`m`, lines (`L H V`), cubic and quadratic Béziers (`C S Q T`), elliptical arcs (`A`) and closing (`Z`), in absolute or relative forms. Repeated argument groups, compact numbers, exponents and packed arc flags are supported. Arc conversion follows the [SVG implementation notes](https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter). Pass path data, not an SVG document, transform or URL.

A move-only or zero-length path holds its point and uses a zero heading. Multiple `M` commands, malformed data, conflicting coordinates and unsupported values throw before taking over a view. Duration and delay must be finite; repeats may be infinite.

Input is limited to 100,000 characters and 1,024 segments. Numeric magnitudes and geometry coordinates must stay within ±1,000,000. Geometry uses adaptive subdivision with a 0.025 DIP flatness target and bounded work (8,192 vertices / 18 subdivisions); geometry that cannot meet that bound is rejected. Native timing uses up to 6,001 keyframes per coordinate, chosen from route length and duration. Distance, heading and native interpolation are approximations, particularly on very long routes, tiny loops and sharp corners.

## Native playback

JavaScript parses and measures the route once per `animate()` call. Timing and coordinate samples are built once when its first target is ready, shared by the generated tracks and staggered targets. Native translation and rotation keyframes play on both iOS and Android; no JS frame callback moves the view. Playback commands and interruption read the same route. Android's [UI-thread limitation](./android-performance) still applies.

The playground includes a curved flight, an arc-based orbit, orientation controls, pause/resume and stop.
