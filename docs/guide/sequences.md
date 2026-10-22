# Sequences and timelines

## Joint playback

`timeline(steps)` accepts the same view tuples and positions as `sequence()`, plus motion-value tuples and playable factories:

```ts
const scene = timeline([
  [car, { path: route, orient: true }, { duration: 8000, ease: 'linear' }],
  [pulse, 1, { duration: 1000, repeat: 7, repeatType: 'reverse', at: '<' }],
  { at: 0, run: () => imageEffect(image, 'ripple', { duration: 8000 }) },
  [checkpoint, 'fadeIn', { at: 4000 }],
])
scene.pause()
scene.play()
await scene.finished
```

<Clip name="controlled-playback-ios" caption="One pause control freezes active motion, a ripple and a future checkpoint, then resumes their remaining timing. iOS simulator, real time." />
<Clip name="controlled-playback-android" caption="Joint timeline pause and resume with actual input on an Android emulator, in real time." />

Pause holds running participants and future launches, including gaps and overlaps. Play resumes from that position without restarting effects or counting the paused wall-clock interval. Both commands are idempotent. Stop cancels active and pending work, resolves `finished` with false, and remains terminal. A scope can create `scope.timeline(steps)` or own the returned handle.

Participants must expose `pause()`, `play()` and `paused` as well as the animation lifecycle. View animations, motion-value animations, nested timelines, image effects and [native property animations](./native-properties) support this. Cleanup functions such as `shimmer()` and base-only animations such as `animateText()` do not. Unsupported callback results reject `finished` and clean up already-started and pending work. Factories run at activation, so their capabilities cannot be inspected before they return. Their unrelated side effects are the factory author's responsibility.

| Participant                              | Joint pause/resume                   | Duration                                      |
| ---------------------------------------- | ------------------------------------ | --------------------------------------------- |
| View/path `animate()` and `decay()`      | Yes                                  | Finite or infinite                            |
| `animate(motionValue)` and scalar layers | Yes                                  | Finite or infinite                            |
| `imageEffect()`                          | Yes                                  | Finite; distortion is infinite                |
| Native adapter `.animate()`              | Yes                                  | Finite or infinite                            |
| Nested timeline                          | Yes                                  | Can remain unknown until every step activates |
| Custom factory                           | Must implement the playback contract | Optional; aggregate progress requires it      |
| `animateText()` and cleanup functions    | No; use `sequence()`                 | Not applicable                                |

The timeline does not offer a generic seek setter: callbacks, haptics and touch-driven effects cannot safely be rewound as a group. `duration` is `undefined` until every step is active, ready and declares a duration, then the maximum scheduled end (or Infinity for endless work). `playbackProgress(scene)` is available once this duration is finite. Observe a known finite main track when the composition also contains endless or still-unplanned effects. Use fresh handles in factories; adopting already-running handles does not rewind or realign their past playback.

A parent resumes only children it paused. An independently paused child remains paused, and stopped/finished handles stay terminal. Independent child seeking or manual delays can invalidate the timeline's calculated end; control the scene through its parent when using aggregate progress. Child interruption preserves the existing sequence arrival/ownership rules and makes final completion false.

Native tracks retain native playback. JavaScript runs at activation and control boundaries, so blocked JavaScript can delay a new factory's launch. This API does not claim native execution of arbitrary callbacks. App owners can pause on background and resume explicitly, as the demo does.

## Sequential playback

Without a position, each step starts once the previous one looks done:

<Clip name="timeline" caption="Overlapping steps and steps in order." />

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Each tuple takes the same arguments as `animate()`, plus `at` in its options. A callback can start and return an animation. Springs count as arrived when they stay close to their target, before fully settling.

## Overlap and fixed positions

```ts
sequence([
  [logo, 'popIn'],
  [title, 'fadeInUp', { at: '-150' }],
  [buttons, 'fadeIn', { at: '<', stagger: 50 }],
  [footer, 'fadeIn', { at: 900 }],
])
```

| `at`     | Starts the step                              |
| -------- | -------------------------------------------- |
| omitted  | At the previous step's arrival               |
| `'-150'` | 150 ms before that arrival                   |
| `'+100'` | 100 ms after that arrival                    |
| `'<'`    | Together with the previous step's activation |
| `900`    | At 900 ms from the sequence's origin         |

All positions use milliseconds of animation time. A numeric position is absolute and nonnegative; a relative offset is a signed decimal string. Absolute positions are independent of earlier steps and may appear out of chronological order. Each unpositioned step still follows the **previous listed step**, not whichever animation finishes last.

`'<'` refers to activation before a step's own `delay`. That delay and its per-property delays still apply. For example, two steps sharing a start with delays 200 and 50 ms begin moving 150 ms apart.

The first step uses the sequence origin as its reference: `'<'`, `'-150'` and `0` start immediately; `'+100'` waits 100 ms. A negative offset that would precede its predecessor's activation is clamped to that activation. The scheduler does not rewind an animation to recover a missed start.

To combine a named spring with a position, use its object form:

```ts
import { sequence, springs } from '@rafaelaugusto/jolt'

sequence([
  [card, 'popIn'],
  [title, 'fadeInUp', { ...springs.bouncy, at: '-100' }],
])
```

## Arrivals and loading

Negative offsets use the actual tracks' arrival forecast, including initial delay, per-property timing, repeats and the last staggered view. An unloaded target waits until its tracks exist before supplying a forecast. Absolute activation times remain independent; their targets still wait to load before native playback can begin.

A callback returning `animate()` or `decay()` also supplies a forecast. Pausing, playing or seeking that handle reschedules a pending negative follower. Once a follower has started, later changes do not undo or replay it.

An arbitrary effect, custom animation or nested sequence does not expose a forecast. It can precede an unpositioned step, a positive offset or `'<'`; a negative offset after it rejects `finished` with a setup error and cancels the sequence's other work. An endless animation has no finite forecast; its relative followers wait until it is interrupted. Absolute positions can still start other steps.

Positive offsets follow the **actual arrival**. If the previous step is interrupted before its forecast, the extra wait starts at that interruption. A pending negative follower also advances when its predecessor is interrupted rather than retaining an obsolete deadline.

## Starting values and ownership

Later views take their first absolute keyframe when the sequence is created, so they stay hidden until their turn. Preparation keeps list order: the first listed step touching a property supplies its initial state, even with absolute positions out of chronological order. Relative and `null` keyframes read the current value when their step activates.

Overlapping steps on the same property use normal [interruption rules](./interrupting): the later activation takes over from the value and velocity on screen. Explicit first keyframes still set an explicit start. Different properties and views remain independent.

## Completion and cleanup

The sequence arrives once **every** step has started and arrived. Its `finished` promise waits for all started animations to finish settling, including longer overlapping steps. It resolves with `false` if any step was interrupted or stopped. This includes deliberate overlap on the same property.

`stop()` cancels future launches and stops all active or settling steps. Call it when the owner of a timeline leaves the screen:

```ts
const animation = sequence(steps)
onUnmounted(() => animation.stop())
```

The returned handle retains the base `Animation` lifecycle; whole-timeline pause and scrubbing are not exposed. Invalid positions throw before starting or applying keyframes. Errors while creating a callback or delayed step reject `finished` after canceling the other work; playback cancellation itself resolves with `false`.

## Native timing

On Android, position timers and the absolute timeline clock follow the system's **Animator duration scale**. With animations disabled, positioned steps advance without waiting for their requested durations. iOS uses its animation clock.

JavaScript runs when a step activates, not once per animation frame. A blocked JS thread can delay a launch; this API cannot start new JS-created steps while JavaScript is unavailable. Once a step starts, its normal native playback and platform limits apply.

The playground compares overlap, sequential arrivals and fixed times using the same entrance.
