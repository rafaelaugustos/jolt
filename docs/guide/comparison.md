# Performance comparison

The first equivalent scenario is a 48×48 tile moving 240 logical pixels while opacity changes from 1 to 0.4. Each linear leg lasts one second. Start resets playback; Stop holds the current pose. These production builds use the same dedicated Android API 36 emulator.

Normal motion, a 300 ms application-runtime block and a 300 ms platform-UI-thread block are separate phases. NativeScript JavaScript shares the Android UI thread; Reanimated application JavaScript does not. Do not treat those probes as the same thread experiment.

## Jolt / NativeScript

<Clip name="comparison-jolt-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## React Native / Reanimated

<Clip name="comparison-reanimated-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## Flutter

<Clip name="comparison-flutter-android" caption="Actual native app, Android API 36 emulator, English. Real button taps start/restart, block the application runtime, block the UI thread and stop. Original speed; this recording is separate from timing collection." />

## Measurements and reproduction

[Protocol, pinned versions and source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/comparison.md).
