# Mobile browser acceptance — 2026-11-03

The maintainer requested **simulators/emulators only**. This is actual Safari 26.2 on an iPhone 17 / iOS 26.2 simulator and Chrome 133 on an API 36 Android emulator, 1080×2400 at 420 dpi. Browser user-agent OS strings are reduced/frozen and are not the OS version source. These runs do not establish physical sensor accuracy, tactile output, power use or physical-device performance.

Use Node 22. Run `node benchmarks/web-mobile/server.mjs` at the repository root; the secure-context loopback fixture is bundled directly from candidate source. Reports are written under ignored `.local/web-mobile/`. The server keeps the longest cumulative event report per session to avoid asynchronous request reordering. No script injects motion, orientation, keyboard or vibration API results.

On a dedicated Android emulator, complete Chrome first-run setup without an account, then run:

```sh
python3 benchmarks/web-mobile/android.py emulator-5590 /tmp/jolt-mobile-android
```

The runner forwards port 4318 and uses real ADB taps/text/system Back. This Chrome build can omit the transformed fixed input from its accessibility tree: the checked 1080×2400 fallback tap is recorded in input-point.json. Android IME state must confirm the software keyboard opened. Chrome may retain stale accessibility button bounds while the visual viewport pans, so system Back dismisses the keyboard before more toolbar taps. Do not share the emulator with other input workflows. If other Android sessions use ADB, use a dedicated server socket and SDK adb consistently.

For iOS, use the repository XCTest host and a dedicated booted simulator:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/jolt-mobile-ios testMobileBrowser
```

The test grants the actual motion permission prompt when shown, types into the real input, asserts the OS keyboard, rotates, suspends/resumes and unmounts. Safari granted permission but delivered no readings, so the sources settled as unavailable. Chrome delivered emulated rotation/gravity and accepted a vibration request. Neither result proves physical output. A real permission denial is not covered by these captures; deterministic denied/unsupported cases remain in browser conformance tests.

Reviewed original-speed captures are embedded in all documentation locales (`guide/mobile-web.md`); English clips are reused for PRs. Raw accepted reports are in `benchmarks/results/mobile-web/`. Each report includes actual keyboard geometry, source status, scope lifecycle and final resource counts. Full video decode and visual review confirmed keyboard motion, input, rotation and unmount. Validate the retained reports with:

```sh
python3 benchmarks/web-mobile/verify.py benchmarks/results/mobile-web/ios.json benchmarks/results/mobile-web/android.json
npm run web:platforms:test
```

The fixes distinguish an inactive VirtualKeyboard API from actual exact geometry, estimate visibility when both viewports resize without double coverage, and retain visibility during browser viewport panning. VisualViewport remains an estimate: a focused desktop window resize can resemble a keyboard. Jolt never takes ownership of the app’s overlaysContent setting.
