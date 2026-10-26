# Predictive back

`predictiveBack(view, values, options)` connects a dedicated surface to Android's system back gesture. The view follows progress from either screen edge; cancelling springs back, and committing finishes the spring before calling your navigation or dismissal function once.

Available since **0.1.0-rc.1**. Rebuild the native application. Requires **Android 14 / API 34+**, gesture navigation, AndroidX Activity **1.8+** and the manifest opt-in below. Verified with NativeScript Core **9.1.3** and `vue-router-ns` **0.1.0-rc.2**.

<Clip name="predictive-back-android" caption="Android 16 / API 36 emulator: real OS taps and edge gestures open the dunes, cancel a partial return, commit from the right edge, then use the back button. Native playback at original speed; not a physical-device performance measurement." />
<Clip name="predictive-back-pt-android" caption="Android 16 emulator: the same native cancellation, right-edge completion and accessible back button in Portuguese, driven by real OS input at original speed." />

## Attach to an owned surface

Opt in on the host application, not on the library's behalf:

```xml
<application android:enableOnBackInvokedCallback="true" ...>
```

Create the handle when the view is attached and its lifecycle is started, for example in the Page's `navigatedTo` handler. Use a dedicated container whose transforms are not also being written by another animation or binding.

```ts
import { predictiveBack } from '@rafaelaugusto/jolt/predictive-back'

const motion = predictiveBack(
  surface,
  {
    x: [0, 28],
    y: [0, 14],
    scale: [1, 0.9],
    rotate: [0, 0.6],
  },
  {
    spring: { duration: 380, bounce: 0 },
    // A successful vue-router-ns navigation resolves undefined; failures resolve an object.
    commit: async (options) => (await router.back(options)) === undefined,
    onState(event) {
      if (event.outcome === 'cancelled') console.log('Still here')
    },
  },
)

// Accessible back button: same animation and single commit path.
backButton.on('tap', () => motion.back())
```

`commit` is required: Jolt cannot infer whether your surface closes a sheet or navigates a route. It receives `{ animated: false }` to prevent a second route transition. Return `false` when a guard rejects; return `true` or nothing after successfully closing/navigating. Synchronous errors and rejected promises restore the presentation too. For an in-page panel, close it inside `commit`. A successful handle disposes itself; create another when that surface opens again.

For Core alone, a commit can check `frame.canGoBack()`, return false if unavailable, then call `frame.goBack()`; configure that entry without a second Core transition when pushing it. Do not attach an enabled owner to a root page that has no owned back action. Set `motion.enabled = false` when another part of your UI should receive back.

## Values and physics

| Values                          | Meaning                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `x`, `y`                        | Relative translation in DIPs, starting at `0`                               |
| `rotate`                        | Relative rotation in degrees, starting at `0`                               |
| `scale`, or `scaleX` / `scaleY` | Multipliers of the captured scale, starting at `1`, positive endpoint       |
| `opacity`                       | Multiplier of captured alpha, starting at `1`, endpoint between `0` and `1` |

Each value is a finite two-number pair. `scale` cannot be combined with `scaleX` / `scaleY`. Defaults preserve omitted properties. Existing native translation, rotation, scale and alpha are captured for each gesture and restored on cancellation or cleanup. These six properties belong to the handle during the interaction; do not animate them concurrently.

`mirrorX` defaults to true: x and rotation reverse direction for a gesture from the right edge. `spring` accepts `smooth`, `snappy`, `bouncy`, duration/bounce or stiffness/damping/mass. Native progress carries sampled release velocity into the Jolt spring. Android owns the commit/cancel decision, including flicks; Jolt imposes no halfway threshold. Visible progress is clamped to `[0, 1]`. Settlement is bounded to **1.5 wall-clock seconds** even with unusual physics or slow global `timeScale`; speed is captured when attaching (or updating reduced motion).

## Native input, guards and cleanup

A Java `OnBackPressedCallback` attaches to the view tree's existing dispatcher owner. It does not replace the Activity, router or dispatcher. The last enabled callback owns back; register this handle after the page is shown and disable or dispose it when it no longer owns that action. Normal IME dismissal remains ahead of the app's back action.

Progress updates and `Choreographer` spring frames stay in Java. JavaScript receives lifecycle events and the final application commit, never one callback per progress sample or frame. This does not make main-thread JavaScript work nonblocking.

A rejected guard springs back without popping history. An asynchronous commit waits at most `commitTimeout` milliseconds (default **5000**, accepted range **1–10000**), then restores the surface with reason `timeout`. This does **not** cancel your promise or undo later external navigation: keep guards bounded or implement cancellation in your application.

`state` is `idle`, `tracking`, `cancelling`, `finishing`, `committing` or `disposed`. Finishing/cancelling events include `release: { progress, velocity }` (progress per second). Terminal idle events include `outcome: 'completed' | 'cancelled'`; rejected commits also report `reason: 'rejected' | 'error' | 'timeout'`. `edge` is left/right for gestures and absent for buttons. `progress` is a polling getter, not a reactive value.

- `cancel()` rolls back a held gesture. A release already committed by Android continues.
- `enabled = false` yields future back input and restores a held preview.
- Reduced motion leaves the surface still while preserving the owned back action and guard checks.
- View detachment, lifecycle destruction and `dispose()` restore the surface and remove input. A route detaching during `commit` keeps only the bounded completion pending. Suspension restores a gesture. If Core unloads the view on Activity stop, create a fresh handle after it reloads and attaches; the preview demonstrates this. A handle whose view stays attached can resume.
- `supported` is false on iOS, older Android, missing native code, unattached views or missing/inactive view-tree owners. No native callback is installed. Explicit `back()` still calls your commit without motion; normal system back remains unchanged. Dispose an unsupported handle before retrying attachment.

The manifest flag and gesture navigation must still be enabled even when `supported` is true. This API animates the supplied surface; it does not render the previous route, add shared-element morphs, or replace the router's back stack. For whole-page interactive iOS navigation see [interactive navigation](./interactive-navigation). See the [native validation and reproduction steps](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/predictive-back.md) and Android's [custom back animation guide](https://developer.android.com/guide/navigation/custom-back/support-animations-views).
