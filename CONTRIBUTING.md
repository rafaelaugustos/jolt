# Contributing

The [native CI probe](benchmarks/native-ci.md) runs real iOS/Android measurements and a negative control on pull requests. See its guide for local reproduction and diagnostic artifacts.

## A visual feature is complete only with a recording

For each new visual feature or visible behavior change:

1. Implement and validate it in the native demo.
2. Record the real app. Include the interaction that explains the feature: drag/release, interruption, resizing, scrolling, pause/resume or another relevant action.
3. Watch the clip and inspect representative frames. Confirm the effect is visible, the controls are readable, and the recording does not show errors or unrelated setup. Tests and screenshots are supporting evidence, not replacements for a video.
4. Save a compact H.264 MP4 in `docs/public/media/` and embed it with `<Clip name="..." caption="..." />` in the matching English and Portuguese guides. Captions identify the behavior and platform. Clearly identify slow motion and effects video cannot convey, such as haptics.
5. Run `npm run docs:check-media` and `npm run docs:build`. Do not close the issue or prepare the release before the clips are included. Keep existing recordings current when the visible behavior changes.
6. Attach the reviewed recordings directly to the PR description with playable video players, labeled by platform and behavior. Use `gh pr edit YOUR_PR --attach ./docs/public/media/YOUR_RECORDING.mp4` (repeat `--attach` for multiple platforms), then verify the published description. A link to the repository file alone does not meet this review requirement.

The CI media check requires every visual guide in both languages to have a captioned clip, verifies the referenced MP4 files, and checks language parity. Its explicit exemptions cover setup, architecture, API navigation and planned work. A new guide requires media by default. This check cannot judge whether a video actually demonstrates the feature; human/agent visual review remains required.

GIFs in the README are a selection of highlights. Feature guides always contain their relevant recordings. Prefer MP4 for the documentation because it is smaller and can be paused with the player controls.

## Reproduce the documentation recordings

Use dedicated simulators/emulators and explicit device IDs. Do not take over someone else's running device. Install the normal Vue demo with `JOLT_BENCHMARK=1` so its application ID is `org.nativescript.jolt.benchmark`; omit the native probe entry-point flags. Build platforms sequentially because NativeScript shares generated assets. See `benchmarks/layout-lifecycle.md` for build/signing setup.

The iOS runner needs Xcode and the Ruby `xcodeproj` gem (available with CocoaPods). Set `GEM_PATH`/`PATH` for your local CocoaPods Ruby if necessary:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltDocsRecordings
# Re-record just one scene:
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltDocsRecordings testLayout
```

XCTest injects real touches and gestures. The host starts/stops `simctl recordVideo` around each named scene using a handshake; launch/setup screens are excluded. The exclusive `/tmp/jolt-docs-recording-control-SIMULATOR_UUID` directory prevents concurrent recording sessions on the same device while allowing separate worktrees to record on separate simulators. Raw footage and the XCTest result bundle remain in the output directory. If forcibly interrupted, verify no runner is active before removing a stale control directory.

The Android runner records the Busy JavaScript comparison with real ADB taps and restores the device's original touch-indicator setting:

```sh
python3 benchmarks/docs-record-android.py YOUR_ADB_SERIAL /tmp/JoltDocsRecordings/android-performance.mp4
```

Compress while keeping the source playback timing (the interruption demo explicitly selects the app's one-fifth speed):

```sh
ffmpeg -i /tmp/JoltDocsRecordings/layout-ios.mov \
  -vf 'fps=30,scale=420:-2' -c:v libx264 -preset slow -crf 24 \
  -pix_fmt yuv420p -movflags +faststart -an docs/public/media/layout-ios.mp4
ffmpeg -v error -i docs/public/media/layout-ios.mp4 -f null -
```

Use `ffprobe` to check duration, dimensions and codec. Watch the full clip and sample frames across its duration before committing. Never generate simulated animation footage, accelerate a performance comparison, or label simulator captures as physical-device recordings.
