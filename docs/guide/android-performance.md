# Busy JavaScript on Android

Jolt computes its keyframes once and plays them natively. That removes JavaScript work from each animation frame, but Android's `ObjectAnimator` still updates View properties on the UI thread. In a normal NativeScript app, main-runtime JavaScript shares that thread. A long synchronous task can stop transforms, opacity and color playback until the task returns.

`ViewPropertyAnimator.withLayer()` does not move this work to RenderThread. It caches the view's drawing in a hardware layer, restores the previous layer afterward, and still uses a `ValueAnimator` to update properties. Jolt's existing opacity layer cache reduces drawing work; it cannot make a blocked UI thread responsive. See the Android source for [`withLayer()` and property updates](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewPropertyAnimator.java).

## Try it

The Android playground includes **Busy JavaScript**, with three controls:

- A Jolt `spin` preset.
- The same rotation through native `ViewPropertyAnimator.withLayer()`.
- A native circular reveal as a separate effect to compare.

**Play** runs without extra work. **Block JS** runs a synchronous 300 ms CPU loop after the animations have started. **Worker** runs the identical loop on another thread. The worker is ready before playback starts, so this comparison excludes worker startup.

The native reveal is a diagnostic control, not an Android implementation of Jolt's `reveal()` API. RenderThread-capable effects are specific platform effects; they do not supply a general backend for arbitrary Jolt keyframes or springs.

The [repeatable benchmark](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-busy.md) records native property samples, worker thread IDs and `gfxinfo` frame gaps. It distinguishes UI-window frame records from actual screen presentation. The recorded emulator result is a diagnostic, not a physical-device performance guarantee.

## Keep CPU work off the UI thread

Use a [NativeScript Worker](https://docs.nativescript.org/guide/multithreading) for data preparation, parsing or other CPU work that can return a small serializable result. Views and UI updates stay on the main thread:

```ts
// In the app, not in Jolt.
const worker = new Worker('./prepare.worker.ts')
worker.onmessage = ({ data }) => {
  applyResult(data)
  worker.terminate()
}
worker.postMessage(input)
```

```ts
// prepare.worker.ts
import '@nativescript/core/globals'

self.onmessage = ({ data }) => {
  self.postMessage(prepareData(data))
}
```

Handle worker errors and terminate pending work when its screen is disposed; the demo does both. Workers cannot manipulate NativeScript views directly. Moving computation off-thread also does not make a large list reconciliation or layout pass free: apply results in small batches and avoid expensive view changes during motion.

If work cannot move to a worker, split it into bounded tasks that yield to the native event loop, or complete it before starting the animation. `Promise.resolve()` only yields to microtasks; wrapping a long task in `setTimeout()` merely delays the same UI-thread block.

On iOS, Jolt's submitted Core Animation tracks can keep playing in the render server during a JavaScript block, but input, new animation setup and JavaScript completion callbacks still wait for the main thread.
