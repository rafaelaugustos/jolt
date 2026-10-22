# Drag values

How much JavaScript a pan event costs when `drag()` writes into a motion value that drives several views, compared to moving the dragged view and writing the other views from `onMove`. Measured on 2026-10-22 for #50 and the motion values RFC (#152).

## Setup

The sheet from the demo's **Drag values** screen: the dragged sheet's `y`, the page behind it (`scale` and `y`), the backdrop's `opacity` and a hint's `opacity`. Six properties in all.

- **value:** `drag(sheet, { axis: 'y', value })` and four `bind()` calls with `to()` mappings. A value at rest writes each bound property once per event.
- **onMove:** `drag(sheet, { axis: 'y', onMove })`, with the same mappings written by hand to the other views' properties in the callback.

Each round sends 600 pan events, one every 16 ms, moving the sheet 380 DIPs up and back. The events go straight to the sheet's pan gesture observers, so native gesture recognition, which is the same in both modes, is left out. The time is measured around those callbacks, with a nanosecond clock on Android and `__time()` on iOS. There were two rounds per mode, alternating. These were debug builds of the normal demo, on an iPhone 17 simulator (iOS 26) and an Android emulator (API 36, `JoltReview`), not on physical devices.

## Results

| Platform                | Mode     | Mean per event | p50            | p95            |
| ----------------------- | -------- | -------------- | -------------- | -------------- |
| iOS 26 simulator        | `value`  | 0.89 / 0.81 ms | 0.85 / 0.77 ms | 1.47 / 1.45 ms |
| iOS 26 simulator        | `onMove` | 0.93 / 0.72 ms | 0.85 / 0.69 ms | 1.47 / 1.06 ms |
| Android API 36 emulator | `value`  | 0.36 / 0.24 ms | 0.27 / 0.22 ms | 0.74 / 0.36 ms |
| Android API 36 emulator | `onMove` | 0.31 / 0.22 ms | 0.23 / 0.20 ms | 0.73 / 0.37 ms |

## Reading

Driving the views through a value costs about the same as writing them by hand, within the spread between rounds. Most of the time goes to the six property writes. The worst p95 stays under 9% of a 60 Hz frame. During the gesture, the only JavaScript per event is Jolt's own pan callback; the app has none. After the release, nothing runs in JavaScript: the release curve is sampled once and each bound property plays it as native keyframes. Native allocations were not measured. As with [scroll values](./scroll-values.md), the evaluation stays in JavaScript until a physical device or a heavier screen shows otherwise.
