# Retained ScrollView header and reorder verification

Development work for #348/#349, after RC.9. The normal Vue showcase entry `retained-scroll` uses one Core ScrollView and a StackLayout with 24 stable-key rows of 88/118 DIPs. The app owns the array and applies move-before-key commits. It retains the existing ListView API and needs neither a second scroll engine nor a ReorderSurface for the new overload.

## Native implementation and limits

`scrollHeader(ScrollView, options)` measures explicit realized rows and owns the content's numeric top padding for header/section space. Anchors use actual variable row bounds around awaited host changes. The same guarded refresh state machine rejects stale commits, reports failure/retry and cleans up on pause/suspend/unload/disposal. The new adapter accepts at most 1000 ordered nonoverlapping mounted rows.

`reorder(LayoutBase, options)` resolves an existing vertical ScrollView ancestor and accepts at most 100 retained rows. Native pickup snapshots are bounded to 16 million source pixels; allocation failure or excess budget declines pickup. Native gesture recognition, neighbor springs, drop and edge scrolling stay in Objective-C/Java. JS receives lifecycle/start/commit/cancel events, never a frame stream. Original views keep application transforms; temporary opacity and native overlays restore on completion/cancel. Use an opaque row background when the lifted preview should be opaque. Live video/surface snapshots, virtualization and arbitrary transformed layouts are not claimed.

Android Core uses `androidx.core.widget.NestedScrollView`. A scoped Window.Callback router forwards to the existing callback and cancels the original touch stream once on ownership transfer; Core listeners remain installed. It is released when the last participant disposes. Targets are resolved after renderer layout because keyed NativeScript-Vue moves can recreate Android native views even when the container bounds do not change. iOS observes the existing UIScrollView and uses native long press/display-link playback. Both platforms keep previews below the header and clipped to the viewport. Programmatic commits refresh targets and preserve the moved key; a regression check also verifies that replacing a ScrollView header does not accumulate its owned padding.

## Reproduce

Install the normal demo on dedicated devices using `JOLT_BENCHMARK=1`, not a probe entry point. **Run `npm run build` at the repository root before each native build**: the demo resolves compiled Jolt `dist`, not TypeScript source. Build platforms sequentially because generated assets are shared. Follow [the contributing capture workflow](../CONTRIBUTING.md) and the local CocoaPods/JDK setup.

```sh
npm run build
cd demo
JOLT_BENCHMARK=1 ns build ios --for-device false --release --env.production --no-hmr
# Install the result on YOUR_SIMULATOR_UUID, then from the repository root:
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/retained-ios testRetainedScroll

# Build/install the Android debug app with production JavaScript:
# JOLT_BENCHMARK=1 ns build android --env.production --no-hmr
python3 benchmarks/gesture-input/build.py /tmp/retained-input
python3 benchmarks/retained-scroll-android.py YOUR_EMULATOR_SERIAL /tmp/retained-android /tmp/retained-input/gesture-input.jar
```

The Android shell input helper is a test artifact, not an application dependency. Its recorder restores the previous touch-indicator setting. Both runners use real OS gestures and exclude application launch/setup from the clips.

## Recorded correctness run, 2026-11-02

- iPhone 17 simulator, iOS 26.0, release app. XCTest checks collapse, insertion while scrolled, native long press/drop, actual pull/release, edge scrolling, refresh failure/retry, cancellation by pause, reduced motion and controller disposal/remount. The final native audit reports zero active header/preview resources.
- Android 16 / API 36 emulator, debug app with production JavaScript. ADB and real injected MotionEvents check the same behaviors, keyed row position within one DIP after insertion, a second drag beyond index 15, OS ACTION_CANCEL, Alt+Up commit and zero resources/fully restored row opacity after disposal.

The videos `retained-scroll-ios.mp4` and `retained-scroll-android.mp4` show collapse, anchored insertion, handle drag/drop and guarded refresh in the English normal demo. Failure/retry, edge scrolling, keyboard and cleanup assertions continue outside the short documentation clip. The new recordings are embedded in scroll-header/reorder guides in EN/PT/ES/ZH, preserving the existing ListView recordings.

These are simulator/emulator functional checks. Controller disposal/remount is not a claim of a separate Vue component unload/navigation or physical-device screen-reader/performance run. Native accessible up/down actions and keyboard handles use the existing Jolt mechanisms; consumer-specific screen-reader speech, unusual transforms and other native surfaces require their own validation.
