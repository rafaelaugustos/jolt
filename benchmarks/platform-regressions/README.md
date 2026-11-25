# Bottom-anchored editors and same-turn scroll updates

Both fixtures run against the built Jolt package. Use Node 22, install the root and native benchmark dependencies, run `npm run build` and then `node benchmarks/native-app/prepare.mjs`. Build the app from `benchmarks/native-app` using its NativeScript CLI with `--env.production --env.platformRegressions --no-hmr`.

## Android Core ScrollView

Install the debug APK on a dedicated emulator. Run `python3 benchmarks/platform-regressions/anchor-android.py emulator-5554 /tmp/jolt-anchor`. Add `--record` to capture the interaction or `--baseline` to assert the original failure on RC.17. Rebuild the plugin AAR when switching Java revisions.

The fixture scrolls to 270 DIP without animation and immediately inserts a keyed 162 DIP row. It measures the same card relative to the scroll viewport before and after the transaction. The second transaction runs inside the refresh guard. Neither path waits for a layout pass before capturing the anchor.

| Android API 36         | RC.17 card Y (DIP) | RC.18 card Y (DIP) |
| ---------------------- | ------------------ | ------------------ |
| Direct prepend         | 253.33 → 523.05    | 253.33 → 253.33    |
| Guarded refresh commit | 415.24 → 684.95    | 415.24 → 415.24    |

Both fixed paths sampled 269.71 DIP before insertion, ended at 431.62 DIP and committed once. RC.17 returned zero from the native snapshot before both transactions.

## iPad keyboard

Build for the simulator with `ns build ios --env.production --env.platformRegressions --no-hmr --for-device false --release`, install the app and enable the onscreen keyboard. Generate the UI test project from the repository root and run it on the same iPad simulator.

```sh
ruby benchmarks/docs-ios-ui.rb /tmp/jolt-keyboard-ui benchmarks/platform-regressions/KeyboardTests.swift
xcodebuild test -project /tmp/jolt-keyboard-ui/DocsTests.xcodeproj -scheme DocsTests \
  -destination "platform=iOS Simulator,id=$IPAD_UDID" -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO -only-testing:DocsTests/KeyboardTests/testKeyboardModes
```

On an iPad Pro 11-inch (M4) simulator with iPadOS 26.2, the editor rose 340 pt with the portrait keyboard docked. The floating keyboard incorrectly lifted it 626.46 pt on RC.17. With RC.18 it returned to zero while floating, rose 340 pt after redocking, tracked the landscape keyboard at 428 pt and returned to zero on dismissal. The UI test operates the system keyboard and reads the editor's live status. Unit tests cover zero-height hardware keyboard notifications, horizontal intersection, native timing and an already-resized container. Physical iPads and external keyboards were not part of this run.
