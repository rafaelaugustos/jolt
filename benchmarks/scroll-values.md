# Scroll values

How much JavaScript a scroll event costs when a scroll offset drives several properties, with `scrollValue()` bindings compared to `scrollLinked()`. Measured on 2026-10-21 to decide whether the evaluation should move into native code (#152).

## Setup

Two ScrollViews side by side, each driving the same five properties on four labels: a header `y`, a title `scale` and `y`, a subtitle `opacity` and a bar `scaleX`.

- **scrollValue:** one `scrollValue()` and four `bind()` calls with `to()` mappings. A value at rest writes each bound property once per event.
- **scrollLinked:** four `scrollLinked()` calls with the same ranges and keyframes. Each event seeks a paused native animation.

Each round scrolls programmatically in 600 steps of 2 DIPs (down 600 DIPs and back), one step every 16 ms. The time is measured around the ScrollView's `scroll` notification, so it includes every listener on it, with a nanosecond clock on Android and `__time()` on iOS. There were two rounds per mode, alternating. These were debug builds of the normal demo, on an iPhone 17 simulator (iOS 26) and an Android emulator (API 36, `JoltReview`), not on physical devices.

## Results

| Platform                | Mode           | Mean per event | p50            | p95            |
| ----------------------- | -------------- | -------------- | -------------- | -------------- |
| iOS 26 simulator        | `scrollValue`  | 0.31 / 0.31 ms | 0.25 / 0.25 ms | 0.71 / 0.63 ms |
| iOS 26 simulator        | `scrollLinked` | 0.25 / 0.26 ms | 0.21 / 0.21 ms | 0.56 / 0.53 ms |
| Android API 36 emulator | `scrollValue`  | 0.25 / 0.26 ms | 0.21 / 0.21 ms | 0.53 / 0.59 ms |
| Android API 36 emulator | `scrollLinked` | 0.46 / 0.56 ms | 0.34 / 0.39 ms | 1.21 / 1.47 ms |

## Reading

Both stay well under a millisecond per event, under 4% of a 60 Hz frame even at p95. On Android, `scrollValue()` costs about half of `scrollLinked()`; on iOS it costs about a fifth more. JavaScript and the UI share one thread in NativeScript, so native evaluation would save these fractions of a millisecond, not make scrolling immune to a busy thread. The evaluation stays in JavaScript until a physical device or a heavier screen shows otherwise.
