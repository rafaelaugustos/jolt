# Native composition acceptance (#407–#411)

This change adds retained resource ownership and Vue shape refs, exclusive behavior coordination, an optional articulated-parts entry, gradient glyph paint with a moving sheen, and named effects on an existing timeline clock. It does not change the Android rendering architecture or claim a reduction in application CPU or PSS. The latency and process-memory investigations remain separate (#405/#406).

## Environment and reproduction

The production NativeScript-Vue demo uses the actual native drivers, without HMR, under `org.nativescript.jolt.benchmark`. The worktree is based on main `953952f56acfc2fe5f4f172922759068bea62c32`; package version remains RC.11 because this is an unpublished change. NativeScript core 9.1.3, Android runtime 9.1.1, and NativeScript-Vue 3.1.3 were used by the demo.

- Physical ASUS ZenFone 3 / ASUS_Z017DC, Android 8.0.0, API 26, 1080 × 1920.
- Dedicated iPhone 17 Pro simulator, iOS 26.2. Simulator timings do not represent an iPhone's performance.
- Android and iOS builds run sequentially because NativeScript shares generated assets. UI capture and timing probes run separately.

Build/install the normal demo with `JOLT_BENCHMARK=1`, release/production options, and normal Android signing. Then use explicit reserved device IDs:

```sh
python3 benchmarks/native-motion-android.py ANDROID_SERIAL /tmp/motion-text text --port ADB_PORT --record
python3 benchmarks/docs-record-ios.py IOS_SIMULATOR_UUID /tmp/motion-ios testNativeMotion

# No recording during these bounded native probes:
python3 benchmarks/native-motion-probes.py android ANDROID_SERIAL /tmp/motion-probes-android --port ADB_PORT
python3 benchmarks/native-motion-probes.py ios IOS_SIMULATOR_UUID /tmp/motion-probes-ios

# Real Home/activation checks, with a manually paused animation:
python3 benchmarks/native-motion-android.py ANDROID_SERIAL /tmp/motion-background text --port ADB_PORT --background
python3 benchmarks/docs-record-ios.py IOS_SIMULATOR_UUID /tmp/motion-background-ios testNativeMotionBackground
```

Android capture accepts `resources`, `behaviors`, `rig`, `text` and `cues`; repeat for each scene. It injects actual taps and restores the original touch-indicator setting. XCTest uses native touches and coordinates from the accessibility tree. `--native-motion=MODE` selects a scene on iOS; Android uses the string extra `native-motion`. Optional `native-motion-audit` writes interaction evidence, and `native-motion-probe` runs bounded repeated checks. Neither is part of normal application playback.

The raw results are in [results/native-composition-2026-11-06](./results/native-composition-2026-11-06). The first failed attempts are retained in `invalid-initial-attempts`: Android exited in RenderThread initialization with `EGL_NOT_INITIALIZED`, before the cue workload. The same device had recorded this initialization failure in earlier comparison apps. This does not establish that Jolt caused or fixed the driver failure. The retry is recorded separately. The first iOS resource probe was not triggered because its scene has no `motion-main` target; the harness was corrected to use its resource host. Neither failed attempt counts as passing evidence. The first Android background script also omitted the audit Intent extra on activation; the app resumed but stopped writing audit events. Another harness assertion incorrectly required the transient “Resumed” status to remain visible after a cue fired. The corrected check uses the recorded resume event and playback state; both initial traces are retained.

## Functional results

Both platforms passed the five interaction scenes and the second complete repeated-probe run:

| Area              | Evidence                                                                                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retained drawings | Paused geometry stayed unchanged; KeepAlive reused the original owner; actual unmount destroyed it once. Twelve cache/unmount/remount cycles ended with 13 created and 12 disposed, exactly one active drawing.                                                                                           |
| Behaviors         | Touch was interrupted by dress; excluded requests were blocked; eat completed and restored rest. Thirty request/cancel cycles disposed the coordinator with zero scope entries.                                                                                                                           |
| Articulation      | Character and lamp shared the API. The flower followed the hand through native hierarchy, three poses and interrupted blends. Thirty pose transitions respected rotation limits, paused socket coordinates stayed within 1 DIP, and disposal cleared the owner.                                           |
| Gradient text     | Native Latin/Arabic replacement, moving glyph-clipped highlight, pause/resume and reduced motion were visible. Twenty-four create/play/pause/dispose cycles changed text, wrapping, weight, size and alignment. Android native helper count stayed at one while attached and reached zero after disposal. |
| Timeline cues     | Cancel before impact prevented effects; replay and pause/resume delivered the effects at the visual cue. Twelve additional finite clock probes each delivered their marker once.                                                                                                                          |

Real Home/activation checks additionally held a manual pause across background/foreground in all five scenes on both platforms. Drawing geometry and socket coordinates remained held, text paint reattached without resuming itself, and explicit resume completed behaviors/cues. These checks preserve manual pause; automatic background interruption and external awaited work also have unit coverage.

The text paint uses the original Label's accessibility node. CALayers/Drawable overlays do not add a second native text node or take input. This is a structural accessibility check and native UI inspection, not a complete VoiceOver/TalkBack usability study. The recordings exercise haptic calls but cannot prove the vibration's perceived strength or onset timing. Audio is an application adapter contract, not a bundled audio engine.

Unit coverage also checks reentrant guard disposal, stale awaited continuations, equal-priority policies, background/manual pause independence, cleanup failures, seek without cue bursts, backward rearming, reverse passes, dropped late effects, effect tails after visual completion, native-property ownership conflicts, ref replacement, socket coordinate transforms, changed geometry, newer external transform ownership and reduced motion. The complete suite passed 1,731 tests across 117 files.

## Bounded cost observations

These are diagnostic observations from the small demo, not a baseline/candidate benchmark or a frame-pacing comparison. Every sample is retained, including cold setup outliers. Rig setup measures the synchronous `rig.to()` call for the three-part character; it does not measure GPU cost. Text setup observations include diagnostic/lifecycle overhead and are not reported as library-only allocation time.

| Observation                                      |   Physical Android 8 |    iOS 26.2 simulator |
| ------------------------------------------------ | -------------------: | --------------------: |
| Three-part rig setup, 30 transitions: median     |              9.85 ms |               1.87 ms |
| Three-part rig setup: maximum                    |             58.99 ms |               6.26 ms |
| Twelve 90 ms cues: median delivery lateness      |                10 ms |              0.016 ms |
| Twelve 90 ms cues: maximum delivery lateness     |                11 ms |              0.417 ms |
| Glyph mask estimate across 24 text/layout cycles | 99,144–157,464 bytes | 456,768–724,680 bytes |

The mask estimates reflect the native implementation and device scale. They exclude compositor copies, layers, runtime memory and process PSS. Android's alpha bitmap and iOS's RGBA image are different representations. Alternating the same two text layouts reused the same bounded size range; this does not prove a flat process heap under all fonts, content or OS caches.

Cue `lateBy` is sampled against the animation's native clock. Android's marker and property animation are frame-quantized; these numbers do not measure display presentation or haptic/audio onset. The default 50 logical millisecond late tolerance covered these samples. Deliberate JavaScript stalls are covered by unit tests for skip/catch-up policy, not presented as proof of stall immunity. Rig samples show why its 64-part validation cap must not be marketed as a device-independent performance budget.

There is no new JavaScript frame observer for articulation, glyph sheen or cue delivery. NativeScript JavaScript/UI contention still applies. Existing resources may have their own frame costs; owning them in a scope does not change their execution model.

## Reviewed media and package checks

Ten English-UI H.264 clips live under `docs/public/media/native-{resources,behaviors,rig,text,cues}-{ios,android}.mp4`. They contain actual native playback and input, with unchanged elapsed timing. Representative frames across every clip were inspected; all complete files decoded without errors. Media metadata and source durations are recorded in `media.json`. The same footage is embedded with translated captions in EN/PT/ES/ZH; PR descriptions use these English recordings only.

Root build, the complete test suite, portable-core/SSR checks, packed native/Web consumers, capability inventory, `npm run docs:check-media` and `npm run docs:build` passed. The packed consumer imports the optional `/rig` entry and new root/Vue contracts; production iOS/Android bundles resolve the packed package without Jolt source aliases. This adds no Web capability and does not claim Web/native parity for the new methods.
