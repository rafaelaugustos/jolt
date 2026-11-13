# Combined values, scroll, layout exits and keyed lists

RC.15 implementation/acceptance report for Jolt #494, #495, #498, #499, #500 and #501, delivered by PR #506. The release contains the documented tested subset; the remaining acceptance below stays open. This is not a performance comparison with Reanimated.

## Delivery plan and evidence

| Issue | Implementation                                                                                                                             | Acceptance evidence                                                                                                                                                                                        | Remaining acceptance                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #494  | Shared scalar graph, finite track composition, native live evaluation, Web scheduler and SwiftUI computed values                           | 26 canonical vectors in TS, Swift, production Java on JVM and production Objective-C on macOS; native/live observer tests; real native, browser and SwiftUI recordings                                     | Physical Android allocations/frame times for one combined node driving 16 views. Maintainer selected emulator-only validation.                                        |
| #495  | Native ScrollView/ListView/linear collection offset adapters; native scroll-linked tracks; eligible Web mapped bindings use ScrollTimeline | Actual vertical ScrollView and 200-row ListView input, zero Jolt per-event callbacks; observer/source replacement tests; Chromium/WebKit ScrollTimeline and Firefox scheduler acceptance                   | Complete real horizontal/RTL/bounce and third-party CollectionView matrix; matched five-property per-event cost comparison. No current 0.25–0.3 ms performance claim. |
| #498  | Bounded static exit copies on NativeScript/Web; Vue transition groups                                                                      | Mixed mutation, repeated removals, interruption, reinsertion and reduced motion in native recordings; Web removal/cleanup/accessibility attributes and actual Vue group; capture/reparent experiment below | Full VoiceOver/TalkBack traversal remains a manual acceptance item. Copies are excluded through native accessibility flags and inert/aria-hidden on Web.              |
| #499  | Shared key diff; Core fixed-height ListView; explicit DOM/virtualizer adapter                                                              | 200-row native/browser interactions; first-visible key and intra-row offset assertions; completion/interruption checks; browser focus preservation and recycled-target invalidation                        | Full native accessibility-focus traversal during moves. CollectionView transitions, grids, sections and cross-list motion are explicitly outside this first adapter.  |
| #500  | Retained SwiftUI header geometry/controller, programmatic scroll, remeasure and anchor preservation                                        | Actual iOS and macOS XCTest interaction and recordings; geometry/anchor/cancellation/scope tests                                                                                                           | No known implementation blocker in the declared iOS/macOS scope.                                                                                                      |
| #501  | Independent scroll subranges, structural translation/pose roles and effective reduced-motion environment                                   | iOS/macOS header works under app reduced motion; subrange/lifecycle and role tests                                                                                                                         | No known implementation blocker in the declared iOS/macOS scope.                                                                                                      |

The four language guides include native/browser coverage, supported properties/units, interruption, disposal, accessibility policy and platform limits. PR videos reuse the English recordings. Existing NativeScript/Web `scrollHeader()` implementations remain the equivalents of the new SwiftUI controller.

## Validation performed

- TypeScript: 1,871 tests in 139 files, including Android accessibility-focus restoration and a regression ensuring an update cannot steal focus after the user leaves the list. These adapter tests do not replace full TalkBack traversal.
- Swift: 92 JoltSwiftUI and 35 JoltCore tests, plus the real standalone iOS/macOS `testValuesScrollExpansion` UI test.
- New Web acceptance: 27 checks across Chromium, Firefox and WebKit.
- Existing dynamic Web regression: 49 passed, two existing platform-specific skips. Existing Web lifecycle/shared-layout regression: 132 passed.
- Native scalar kernels: 26 shared vectors each, compiled from the production sources. Host execution is separate from device evidence.
- Root build, type checks, portable core, public capability matrix, packed consumers (native/Web/Vue/SSR and framework facades) and benchmark type checks.
- Native fixture builds: dedicated iOS 27 iPhone 17 Pro simulator and Android API 36 arm64 emulator, with production JavaScript and no HMR. The emulator is not the older physical phone.

Native app-side reports in `evidence/` supplement the OS input scripts. `validate.py` rejects errors, nonzero Jolt scroll callbacks, failed anchor preservation, missing completion and missing interruption even if the XCTest/ADB taps succeeded. A sort around a preserved edge key can have no overlapping moving rows and legitimately finish immediately; the explicit delete/prepend pair verifies interruption of an active operation.

The new Web suite runs in CI; the standalone SwiftUI scenario is discovered by the existing UI-test job. Native input/recording scripts are reproducible locally and complement the existing native CI probe. None of these reports replaces the physical-device requirement of #494.

## Exit-copy decision

Only actual removals are captured. A scoped NativeScript `_removeView` interception captures the view before Core dismantles it. The Web path intercepts instance removal/replacement methods, never global DOM prototypes. Surviving children are measured but not copied. Copies share an 8-million-pixel default budget per operation, are static and noninteractive, and release on cancellation, reinsertion and lifecycle teardown.

`costs.ts` measures production capture setup and a raw native reparent round trip for the same simple card: three warmups, five recorded samples, no sustained load. The latter excludes NativeScript teardown and is a lower-level experiment, not a working retained-view implementation. The raw values are in each report's `exit-costs` event. Median capture/reparent samples were 1.089/0.092 ms on the iOS simulator and 0.313/0.019 ms on the Android emulator. These are separate device environments, not a cross-platform ranking. It is cheaper to reparent this native card, but Core's removal/recycling invalidates the native view and its bindings. Keeping it alive would require a separate ownership/teardown protocol, especially for editors and recycled cells. The implementation therefore chooses bounded static copies, with unsupported content removed immediately. It does not claim snapshotting is universally faster.

These are synchronous setup samples on a simulator/emulator, not presented frame time, allocations, process CPU/PSS or an application throughput result. The broader workload and physical-device measurement remain separate.

## Reproduce

Install the root and `benchmarks/angular-tools` dependencies, build Jolt, and install `benchmarks/native-app` dependencies/resources as described in its guide. Use dedicated device IDs to avoid other development sessions.

```sh
npm run build
npm run web:values:test
python3 benchmarks/verify-scalar-program.py --json-jar /path/to/org.json.jar
swift test

# From benchmarks/native-app:
npx ns build ios --env.production --env.valuesLab --no-hmr --emulator
npx ns build android --env.production --env.valuesLab --no-hmr
# Install that built app on the explicitly selected simulator/emulator.

# From the repository root:
python3 benchmarks/values-scroll-lists/record-ios.py SIMULATOR_UUID OUTPUT_DIRECTORY
python3 benchmarks/values-scroll-lists/record-android.py EMULATOR_SERIAL OUTPUT_DIRECTORY
node benchmarks/values-scroll-lists/server.mjs
node benchmarks/values-scroll-lists/record-web.mjs OUTPUT_DIRECTORY
ruby benchmarks/swiftui-demo/project.rb
python3 benchmarks/swiftui-demo/record.py SIMULATOR_UUID OUTPUT_DIRECTORY values-scroll
python3 benchmarks/swiftui-demo/record.py macos OUTPUT_DIRECTORY values-scroll
```

The Java host probe needs a real `org.json` implementation; Android SDK stubs do not execute. Native recordings require ffmpeg; iOS UI generation requires the `xcodeproj` Ruby gem. Android captures use actual screen timestamps; normalization to H.264/60 fps repeats frames while preserving elapsed time, without accelerating playback. Clips are decoded fully and sampled through their duration for visual review before R2 upload.

Media names: `values-scroll-{ios,android}`, `combined-values-web`, `layout-exits-{ios,android,web}`, `list-changes-{ios,android,web}`, `swiftui-values-scroll-{ios,macos}`, and `list-changes-playground-web`. They are in the R2 manifest, not committed as MP4s. Native recordings are labeled simulator/emulator, browser recordings Chromium, and the desktop clip macOS.

## Mavis follow-up

Audited `getcortexlabs/mavis-ui` main `4fc065a6efe3ed06705cbcbaa5c2d4fdb54aa689` and existing open/closed issues. `MotionReadable` still exposes mapping rather than scalar algebra; `MotionLayoutOptions` lacks exits; the native scroll adapter already delegates to Jolt, so it should retain ownership rather than acquire another scroll loop. Existing adoption owners are #139 (values/followers), #193 (keyed layout), #185 (virtualization), #262 (scroll sources/ranges) and #236 (header/controllers), with #354 covering generated Swift motion. Their candidate dependencies must remain explicitly unmerged/unpublished until those events happen. No Mavis implementation or release is included here.
