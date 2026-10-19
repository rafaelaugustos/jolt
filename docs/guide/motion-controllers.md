# Motion scopes and states

Use `motionScope()` to give a page, component or recycled item one owner for its animations and subscriptions. Use `motionStates()` to move several views between named, interruptible visual states. Both use the existing native animation drivers; neither adds a JavaScript frame loop.

<Clip name="motion-controllers-ios" caption="Upload, error, retry and success states, scope controls and unmount/remount in the iOS simulator." />

## Owning work

```ts
import { motionScope, followKeyboard, zoomable } from '@rafaelaugusto/jolt'

const motion = motionScope()
motion.animate(icon, 'spin', { repeat: Infinity })
motion.press(button)
motion.use(() => followKeyboard(composer))
motion.use(() => zoomable(photo, { viewport }))

// At the actual destruction/unmount boundary:
motion.dispose()
```

The scope has `animate()`, `decay()`, `sequence()`, `press()`, `drag()` and `states()` helpers. `add(handle)` adopts any cleanup function or object exposing `stop()` or `dispose()`; `dispose()` takes precedence when both exist. A resource belongs to one scope. Duplicate `add()` calls in that scope do not duplicate cleanup. Animation handles with `finished` promises are released from the scope when they settle.

Disposal is idempotent. It cancels delayed and not-yet-loaded animations, scheduled sequence steps, native playback and registered subscriptions. Cancelled animation handles resolve `false`. Disposal stops owned handles rather than calling `stop(view)`, so newer or unrelated animations owned elsewhere survive. All cleanups run even if one throws; their errors are reported together as an `AggregateError`.

Only registered work is owned. For a timer, for example, register `motion.add(() => clearTimeout(timer))`. Custom factories must clean up their own partial setup if they throw before returning a resource.

## Suspension, reuse and disposal

| Operation   | Behavior                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suspend()` | Pauses handles with `pause()/play()`, preserving already-paused handles. Detaches `use()` subscriptions. Cancels non-playable resources, including sequences. |
| `resume()`  | Resumes only playback paused by the scope and recreates `use()` subscriptions. Cancelled sequences do not restart.                                            |
| `reset()`   | Disposes all current work while retaining a reusable scope. Call before assigning a recycled cell a new item identity, then register its new work.            |
| `dispose()` | Permanently ends ownership. Starting or registering more work throws.                                                                                         |

Drag controllers cancel their contact/release on scope suspension and accept new gestures on resume. See [drag lifecycle](./drag#ownership-and-lifecycle).

`use(setup)` returns an idempotent remover. Registering a subscription while suspended defers setup until resume. Other helpers and `add()` reject new work while suspended. Configure ongoing playback through the scope while it is suspended; do not manually resume its individual handles.

A native `unloaded` event is not permanent component destruction. Existing animation/effect unload behavior still applies: ordinary animations cancel on unload and do not restart automatically on reload. The scope remains reusable until explicit disposal. Call `suspend()/resume()` when retaining a page or component, and dispose at the actual unmount boundary. Read `size`, `suspended` and `disposed` for lifecycle diagnostics; `size` counts owned entries, not GPU allocations.

## Vue lifecycle

```ts
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

// Inside setup(); create animations once template refs are available.
const motion = useMotionScope()
```

This helper disposes on Vue unmount, suspends on KeepAlive deactivation, and resumes on activation. Native unload alone does not dispose it. The core scope works without Vue; Angular/React/Svelte/Solid lifecycle hooks belong in their adapters or app code.

## Named visual states

```ts
const upload = motion.states(
  { icon, label, progress },
  {
    idle: {
      icon: { scale: 1, rotate: 0 },
      label: { opacity: 1 },
      progress: { scaleX: 0 },
    },
    sending: {
      icon: { scale: 0.8, rotate: 180 },
      label: { opacity: 0.4 },
      progress: { scaleX: 0.65 },
    },
    success: {
      icon: { scale: 1, rotate: 360 },
      label: { opacity: 1 },
      progress: { scaleX: 1 },
    },
  },
  { transition: 'snappy' },
)

const completed = await upload.to('sending')
if (completed) showSendingStatus()
```

Or construct `motionStates(targets, definitions, { scope, transition })` directly. Target and state names are inferred by TypeScript. Creating the controller validates the definitions without moving the views; call `to('idle')` explicitly to enter the initial state.

States contain absolute numeric/color endpoints. They do not accept keyframe arrays, paths, relative offsets or loops. A transition accepts a spring name or finite tween/spring configuration, including delay. `to(name, transition)` overrides the controller's transition for that request. Use `sequence()` separately for timed choreography.

Every target is validated before the new state changes ownership. Replacement tracks start before old handles are cancelled, letting the native engine inherit current presentation values and spring velocity. Properties owned by the old transition but omitted from the new state stop at their visible values; unrelated external properties keep running. Define a property's endpoint in every relevant state if it should return to a resting value. An empty state freezes the previous transition. Each target name must identify a distinct view.

A superseded, stopped or disposed transition resolves `false`, including rapid transitions under reduced motion. Awaited callbacks still run: check the boolean before applying completion side effects. `current` is the latest requested state; `settled` is the last successfully completed state, not a live measurement of the view. `stop()` cancels current work; `pause()/play()` control it; `dispose()` also prevents future transitions. Scope suspension pauses an owned state controller. Retargeting that paused controller keeps the replacement paused.

The playground's **Motion states & scopes** example provides upload, cancel, retry, success/error, pause/resume and unmount/remount controls. Its owner is `useMotionScope()`; use the global Reduce Motion toggle to exercise immediate transitions. Native lifecycle probes are documented in [the benchmark directory](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-lifecycle.md).
