# Simulator/emulator acceptance — 2026-11-03

Candidate based on RC.10 (`9e4d8c868aa1d5aa912c0826738fce40b48507da`). The maintainer explicitly selected emulator/simulator acceptance for this batch. These results do not claim physical-device validation, panel latency or leak-free execution.

- iPhone 17 / iOS 26.2 simulator, NativeScript Core 9.1.3 / iOS runtime 9.1.0: gallery interruption/handoff/current-key return and enlarged text; scroll stretch, insertion/reload anchors, real UIKit rotation geometry, navigation during fling, large text and final native cleanup.
- Pixel 7 Android 16 / API 36 arm64 emulator, Core 9.1.3 / Android runtime 9.1.1: gallery moved/deleted/recycled targets, zoom, cancellation, rotation, background/resume and large text; scroll layout/rotation anchors, fling exit/reentry, pull-to-refresh success/error/retry, short/empty content and large text.
- The JSON files are raw opt-in native observations, not synthetic fixtures. `image-android.log` contains 27 actual native image-renderer assertions after adding bounded frame diagnostics. Reproduction lives in the existing gallery, scroll-header, scroll-refresh and Android image-test runners.

The scroll iOS audit records 326 native updates and five semantic JavaScript callbacks. The Android audit records 191 native updates and seven semantic callbacks. These counters establish native composition in those interactions, not frame pacing. Both platforms release native sources/nodes on disposal; gallery returns release flight/input/retained-scene resources.

## Process memory

`memory/gallery-and-scroll-five` retains five rounds per scene, raw PSS dumps and gfxinfo. Gallery PSS went from 143,502 KiB warm to 145,032 KiB at round five, with a 153,242 KiB sampled peak. The initial scroll run grew, so `memory/scroll-thirty` extends that scenario to 30 rounds. It rises from 126,223 KiB to a sampled 202,451 KiB, falls to 141,056 KiB at round 19 and ends at 190,027 KiB. No forced garbage collection was used. This pattern is compatible with allocation and collection; these samples alone do not identify a leak or prove its absence. They include the VM, native view caches and decoded resources.

Every gallery close checks terminal shared-navigation resources; the scroll runner checks zero sources/nodes after leaving. The first five-round runner needed its final Back tap completed manually through ADB; its `captureNote` preserves that detail. Raw gfxinfo is supporting rendering evidence collected while other host work was running, **not** the controlled cross-stack performance dataset. See [the comparison protocol](../../comparison.md) for that separate measurement.

Existing reviewed native recordings remain embedded in all translated gallery/scroll guides. The new [complete recipes](../../../docs/guide/recipes.md) have their own real native interaction recordings. Historical physical-iPhone recordings keep their original captions and scope.
