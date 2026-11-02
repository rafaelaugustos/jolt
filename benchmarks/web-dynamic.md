# Continuous Web motion — #293, #294, #295

This checkout adds a bounded experimental continuous-input path after RC.5. It does not publish a new version or modify Mavis. The public `/web` context gains numeric inputs/bindings, spring followers and one-pointer x/y drag with finite snap; the existing native entries and optional Vue adapter remain compatible.

## Reproduce

```sh
npm ci
npm run web:dynamic:typecheck
npm run web:dynamic:test
npm run web:dynamic
# In a separate terminal, after stopping the interactive server:
node benchmarks/web-dynamic/record.mjs
npm run build
npm run package:check
npm run docs:check-media
npm run docs:build
```

The recording script starts its own server on port 4285 and uses real Playwright pointer/keyboard input. It writes an original-speed Chromium MP4 and source/video hashes in `web-dynamic/recording.json`. Captures/results stay ignored; the compact validation report is checked in. Full native reference recordings are preserved, not regenerated or relabeled as physical-device footage.

## Contract and execution

- One phased scheduler per runtime handles dynamic work and unresolved finite activation. It batches reads before updates/writes, coalesces input, isolates observer errors, freezes continuous time while hidden and cancels the frame request when idle.
- Live bindings own only selected base channels. That surface composes its finite channels on the frame scheduler too; unbound surfaces retain finite WAAPI. Removing the binding recompiles remaining finite presentation against its existing clock. A stale unbind cannot reclaim a newer finite owner.
- Springs reuse the portable analytic trajectory and its exact derivative for continuous retargeting. Native finite sampling retains its previous derivative approximation and settlement behavior; frozen pre-extraction trajectories and the native regression CI remain required. There is no 60 Hz fixed integration step or 10-second artificial continuous-spring snap.
- Followers accept input values from their context, not another follower/derived graph. Pause retains velocity; stop clears it; jump and reduced motion settle at the latest input. Source disposal terminates followers and releases bindings.
- Drag claims one primary pointer and selected translation channels, preserves press/other channels, handles capture/cancel/disabled/blur/hiding/detachment, and returns to finite WAAPI on successful release. Its own disposal cannot stop a newer application animation. First-scope coordinates require an identity static target baseline and untransformed/unzoomed ancestors. Pointer bounds limit input/destinations; spring overshoot remains possible.
- Snap uses a 150 ms projected position and recent velocity capped at 5,000 CSS px/s. Inactivity beyond 80 ms yields zero release velocity. Nested interactive controls retain their input; taps/keyboard clicks remain, while a completed drag suppresses its generated click. Horizontal drag permits native vertical touch scrolling through `pan-y`.

## Evidence and limits

`web-dynamic/validation.json` records **49 passing browser cases**, with two explicit skips: actual touch-scroll injection uses Chromium CDP; Firefox/WebKit still exercise pointer cancellation. Tests cover ownership, partial replacement, press composition, finite release position/velocity, catching a snap, idle frames, hidden-time policy, reduced motion, repeated mounts and context disposal. Hidden-document tests control the visibility signal; they are not real mobile background measurements.

The bounded workload creates 32 followers from one input, records preparation time and verifies no additional scheduler frames during a 100 ms idle observation after settlement. It then checks zero targets, values, animations, observers and scheduled tasks. These are headless desktop preparation/resource observations, not heap-retention, presented-frame, physical-device or universal throughput claims. Raw per-browser preparation observations remain in the JSON without adopting a hardware-independent timing budget.

Deterministic tests cover 60/120/144 Hz sampling, exact command-time retarget continuity, timeScale, long frames, manual/hidden pause, source disposal, validation and scheduler reentrancy. The public tarball is installed without NativeScript or a framework, compiled through NodeNext/Bundler, loaded by direct/Vite SSR and exercised in Vite development/production with live followers and real drag/snap. Optional Vue and NativeScript production consumers remain part of `package:check`.

The four-language guide embeds the new Chromium clip plus reviewed iOS-simulator/Android-emulator references for native followers and value-bound dragging. Native follower chains exceed this first Web scope; the footage does not prove shared Mavis implementation or Web/native pixel parity. Native CI checks the shared compiler refactor on both platforms, with its existing negative controls.
