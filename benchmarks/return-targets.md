# Current return targets (#24, stage 3)

The collection example uses Core ListView rows containing two images, one Core Frame and vue-router-ns 0.1.0-rc.2. Sixty items share two bundled images but have distinct stable keys. Moving a selected item changes its current row; removing it exercises ordinary/fade fallback. Native gesture progress and flight frames do not call JavaScript. Resolution and application routing do.

## Reproduce

Build the library and release preview with `JOLT_BENCHMARK=1`, `--env.production`, `--no-hmr`; build iOS and Android sequentially. Use dedicated devices and the signing/recording setup in `CONTRIBUTING.md`.

```sh
python3 benchmarks/docs-record-ios.py YOUR_ASSIGNED_SIMULATOR /tmp/JoltReturnTargets \
  testReturnTargets testReturnTargetsPortuguese testReturnTargetsChecks
ANDROID_HOME=/path/to/sdk python3 benchmarks/gesture-input/build.py /tmp/JoltInput
adb -s YOUR_ASSIGNED_EMULATOR push /tmp/JoltInput/gesture-input.jar /data/local/tmp/jolt-predictive-input.jar
python3 benchmarks/return-targets-android.py YOUR_ASSIGNED_EMULATOR /tmp/JoltReturnTargets audit
python3 benchmarks/return-targets-android.py YOUR_ASSIGNED_EMULATOR /tmp/JoltReturnTargets record en
```

Select English or Português through the real preview language settings before Android recording; use `pt-BR` for its Portuguese output. Restore the previous language afterwards. Both runners inject real OS input. The Android recorder restores the previous touch-indicator setting. The input helper is not packaged in the app.

## Evidence and boundaries

- iPhone 17 / iOS 26.2 simulator; Android 16 / API 36 emulator, 1080 × 2400. NativeScript Core 9.1.3, Release builds without HMR.
- EN/PT clips in `docs/public/media/return-targets*.mp4` show moving the selected photo to the last row, cancelling a back gesture, committing to its current cell, reopening it and deleting it before returning. They preserve actual playback timing.
- The [iOS audit](results/return-targets/ios.json) records route/key state and native resources. XCTest assertions check that cancellation keeps detail, the moved current cell is hittable after commitment, removal returns to the grid, and reset/Reduced Motion permit another complete cycle.
- The [Android audit](results/return-targets/android.json) checks current key resolution, zero route calls on cancellation, exactly one committed route, deletion fallback, Reduced Motion and repeated back coalescing. Terminal flights, retained scenes and input callbacks return to zero; visible cells are restored.
- Host tests cover missing/duplicate/stale identities, cached detached cells, rejected resolvers, timeout/late completion, cancellation, key movement during scrolling, native layout ordering, identity changes during a flight and owned/borrowed controller cleanup.

iOS holds the initial native transition pose while its mounted return page resolves the current cell, then rebases the edge gesture. Android previews the current detail page; it resolves the current target **after system commitment**, rather than displaying a live recycled grid during predictive preview. Programmatic returns capture before routing and can hold a bounded source-page image while the destination mounts. Every terminal path releases that image.

The pixel budget includes source, destination and any held page; it is not a process-memory measurement. A missing/deleted target takes the bounded fade/ordinary path. Route timeout cannot cancel application-owned promises or undo a late external navigation.

This stage does not close #24 or #117. Physical devices, screen-reader focus, rotation/RTL matrices and hardware frame pacing, input latency, preparation cost and peak memory remain unverified. The gallery integration belongs to #117. Validation: 1,348 host tests in 85 files, library and benchmark typechecks, package build, both native release builds, OS-input audits, video decode, documentation media coverage and production docs build. No new CI workflow or long-running native job is added.

## UIKit alternative

The installed UIKit SDK declares `UIViewController.preferredTransition` and `UIViewControllerTransition.zoom(options:sourceViewProvider:)` for iOS 18+. Its synchronous provider supplies the current source view and may be called repeatedly. UIKit owns pushed/modal zoom interaction; the API does not expose arbitrary Jolt spring physics or an asynchronous list-realization contract. This implementation does not enable it. See the linked Apple references in the EN/PT guide.
