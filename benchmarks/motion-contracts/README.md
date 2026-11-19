# Motion contracts: first six issues

Included in RC.16 through PR #509 for #497, #502, #503, #504, #505 and #508. Acceptance was recorded on the source candidate after RC.15, before the release version bump; raw evidence retains its original labels. The four-language [guide](../../docs/guide/motion-contracts.md) owns the API contract and reviewed recording captions.

| Issue | Native acceptance                                                                                                                                                              | Web acceptance                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #497  | UIKit and Android native arbitration; nested wait in both directions, press/carousel, drag/reorder, photo/sheet. Real OS input; one winning lifecycle and one reorder commit.  | Same four compositions with Pointer Events; cycle/disposal tests in the portable arbiter. Mouse policy in Chromium/Firefox/WebKit; trusted pinch/touch in Chromium. |
| #502  | SwiftUI custom grip drives the model's existing edge clock on iOS/macOS; row action remains usable and keyed commit follows scrolling.                                         | Existing keyed reorder edge scrolling retained; Web gestures regression includes edge advance and replacement cancellation.                                         |
| #503  | SwiftUI emission remains bounded beyond a real minute in both recordings. Manual-clock test also jumps an hour without a backlog.                                              | Existing continuous emitter reused; no new Web particle API.                                                                                                        |
| #504  | SwiftUI SVG normalization, evenodd fill, caps/joins, independent stroke trim, viewBox and compatible morph; iOS/macOS interaction. Shared TS-generated normalization fixtures. | Existing SVG shape/style/trim/morph API reused.                                                                                                                     |
| #505  | SwiftUI replacement inherits construction-time sampled velocity; explicit override, delayed/from tracks, sequence duration, pause/seek and invalid-input ownership tested.     | Existing timeline velocity contract reused.                                                                                                                         |
| #508  | Real iOS/Android pause/resume checks verify direct and derived velocity zero while position is frozen.                                                                         | Paused/hidden/stopped follower velocity and dependent graphs are invalidated immediately; resume retains momentum.                                                  |

## Recorded environment

Validated on 2026-11-18 using Node 22.23.3, a dedicated iPhone 17 Pro / iOS 27.0 simulator, a dedicated Pixel 7 / Android API 36 emulator, the native macOS demo and Playwright's Chromium/Firefox/WebKit. Recordings contain English controls at original speed. Browser gesture clips concatenate separate real scenarios without speeding them up. No physical iPhone/Android or performance comparison is claimed. Accessibility expansion is outside this batch; existing Reduced Motion behavior stays covered.

The reviewed H.264 recordings are `gesture-relations-{ios,android,web}`, `spring-velocity-{ios,android,web}` and `swiftui-motion-contracts-{ios,macos}` in `docs/.vitepress/media.json`. All eight decoded successfully and representative frames were inspected for the stated behavior. Docs embed them in English, Portuguese, Spanish and Simplified Chinese. PR attachments use these English recordings.

## Reproduction

Install the pinned root, Angular and native fixture dependencies as described in [CONTRIBUTING](../../CONTRIBUTING.md). Build with `npm run build`. The native fixture flag is `--env.motionContracts`; use production JS and `--no-hmr`. Build platforms sequentially because generated assets are shared. Install only on dedicated devices with explicit IDs.

```sh
# From benchmarks/native-app:
ns build ios --env.production --env.motionContracts --no-hmr --for-device false --release
ns build android --env.production --env.motionContracts --no-hmr

# From the repository root, after installing the corresponding build:
python3 benchmarks/motion-contracts/record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltContractsIOS
python3 benchmarks/gesture-input/build.py /tmp/JoltGestureInput
python3 benchmarks/motion-contracts/record-android.py emulator-PORT /tmp/JoltContractsAndroid /tmp/JoltGestureInput/gesture-input.jar
npm run web:motion-contracts:typecheck
npm run web:motion-contracts:test
node benchmarks/web-motion-contracts/record.mjs
```

The native scripts validate app snapshots/status from actual touches and retain XCTest/JSON evidence. The iOS runner uses the CocoaPods Ruby at `/opt/homebrew/opt/ruby@3.3/bin/ruby`; adjust that path for another host. Android restores the emulator's touch-indicator preference. Normalize Android screenrecord VFR to CFR H.264 at 30 fps without changing its elapsed duration before publishing, as in CONTRIBUTING.

For SwiftUI, use `benchmarks/swiftui-demo/record.py` with `motion-contracts` and the dedicated iOS simulator or macOS destination. `testMotionContractsExpansion` runs for over a minute to prove continuous emission across the previous limit. Ordinary SwiftUI CI includes this XCTest.

## Verification

- TypeScript: 1,879 tests in 141 files; root and benchmark type checks.
- Swift: 39 JoltCore and 100 JoltSwiftUI tests, including generated SVG fixtures and eight motion contract cases.
- Browser motion contracts: 14 passed, four documented non-Chromium multi-touch skips. Existing Web gestures: 53 passed, four documented skips.
- Both native production builds and native input runners; SwiftUI iOS/macOS input runners.
- Portable core, packed consumers (types/SSR/browser/native production resolver), capability inventory and generated Swift definitions.
- Documentation media checks, published media verification and static build.

The recorded interaction checks do not replace wider native CI or physical hardware validation. Mavis adoption belongs to its existing #139, #235, #352 and #354 workstreams; source availability and the eventual containing published version must be tracked separately from RC.15 history.
