# Web press feedback

`motion.press()` adds finite pointer and keyboard feedback to a declared HTML surface. It uses the [Web runtime](./web-runtime), without Vue, React or a permanent frame loop. This API is experimental and available in the [locally packed candidate](./install#experimental-web-candidate), **not the published 0.1.0-rc.4**. Mavis integration follows separately.

<Clip name="web-press-chromium" :width="720" caption="Chromium 156 on macOS arm64, original-speed browser recording with actual pointer holds and keyboard input: application scale 1.1, press factor 0.96, application retarget to 1.2 while held, release, Space/Enter, release outside, disposal and loading cancellation. This is browser behavior, not a physical-device measurement." />

## Imperative usage {#imperative-usage}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document) // after mounting
motion.set(button, { scale: 1.1 })
const feedback = motion.press(button) // scale: 0.96, snappy spring

// Application motion can change while the pointer or Space/Enter is held.
motion.animate(button, { scale: 1.2 }, 'snappy')
feedback.update({ loading: true }) // cancels feedback; does not disable HTML activation
feedback.update({ loading: false }) // next input may press again

// On component disposal, or before replacing its declared surface:
feedback.dispose() // immediately removes only its contribution and input listeners
motion.release(button) // release the entire surface when its lifecycle ends
motion.dispose() // dispose the context when no longer needed
```

Optional values use the runtime's numeric channels: `motion.press(button, { scale: 0.96, opacity: 0.8 }, { transition: 'snappy', disabled: false, loading: false })`. Scale/opacity multiply; translation/rotation add. Feedback always returns to its neutral contribution, not a captured application value.

| State                                    | Visual scale |
| ---------------------------------------- | ------------ |
| Application at 1.1                       | 1.1          |
| Held with factor 0.96                    | 1.056        |
| Application retargeted to 1.2 while held | 1.152        |
| Released or feedback disposed            | 1.2          |

One binding per surface is supported. The private `jolt:press:` layer namespace is reserved. `pressed` reports input state; `animation` exposes the latest finite handle. Interrupted feedback resolves `finished` to `false`; completed feedback resolves to `true`, once. Retargeting uses the current position and velocity. A stale handle cannot reclaim newer motion. Live reduced-motion settings follow the runtime policy.

## Input and lifecycle {#input-and-lifecycle}

Primary pointer input works on transformable HTML boxes. Native `<button>` elements additionally get Space/Enter feedback. Jolt does not synthesize clicks, change focus, call `preventDefault()`, set `touch-action` or request pointer capture. Native button activation, form submission and keyboard repeat behavior remain the browser's. Other elements receive pointer feedback only; the application owns their keyboard and accessibility semantics. Nested interactive controls are ignored.

Release outside, pointer cancellation/lost capture, mouse exit, ancestor scrolling, focus/window loss and page hiding cancel feedback. Scroll takeover remains available. Native `:disabled` (including fieldsets), `aria-disabled`, `aria-busy` on the target, ancestor `inert`, and `update({ disabled, loading })` block feedback and cancel a held press. These flags govern feedback only: the component must implement its activation, focus and loading semantics, usually with the native `disabled` property.

Targets must be mounted. Detached targets are released automatically, including in shadow roots; explicit disposal is idempotent and works immediately after removal. Bind the replacement surface anew. Use the runtime's [CSS surface policy](./web-runtime#surface-policy-and-limits): static 2D baseline, no competing CSS animations/transitions or changing motion styles/classes while claimed. A dedicated inner surface can separate component styling from motion.

## Native reference and verification {#native-reference-and-verification}

Native press behavior is unchanged. These preserved English recordings show its existing layered composition; they do not demonstrate Web code or a shared Mavis screen.

<Clip name="motion-rfc-ios" caption="iOS 26.2 simulator, existing English Layers audit: real held touch and release preserve a non-unit base alongside independent motion layers. Original speed; native reference, not a physical iPhone recording." />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 emulator, existing English Layers audit with real ADB taps and held touch. Native composition reference at original speed; no physical-device performance claim." />

Run `npm run web:press:typecheck` and `npm run web:press:test`. Chromium, Firefox and WebKit cover input, composition and cleanup; the actual touch-scroll gesture uses Chromium CDP only. See the [verification and recording report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-press.md).
