# Web mappings, geometry and scroll validation

Candidate for Jolt #302, #303 and #304, based on `89679b6` (after RC.5). This does not publish a release or modify NativeScript rendering. All browser checks use the actual DOM/WAAPI runtime, without framework adapters.

## Reproduce

Use Node 22, `npm ci`, and `npx playwright install chromium firefox webkit`.

```sh
npm run web:support:typecheck
npm run web:support:test
npm run web:support
# Separate recording run, with no other process on port 4286:
node benchmarks/web-support/record.mjs
```

Playwright 1.64.1 ran 49 passing checks: 17 Chromium, 16 Firefox and 16 WebKit. Two touch-injection cases are intentionally skipped outside Chromium. Tests compare computed CSS presentation with the expected numeric pose, not just the internal value.

Coverage includes descending mappings, independent disposal, mapped spring inputs, cross-context rejection, readonly declarations, press multiplication after application changes, paused finite clocks, actual resized bounds, automatic text/size observation, stale geometry leases, rejected refresh, drag cancellation, scroll endpoint reversal, partial channel replacement, reduced motion, document/element sources, content shrink/non-scrollable sources, source/target detachment and idle scheduler shutdown. Hidden-time checks explicitly control the scheduler; they are not physical-device background tests.

The native timeline test verifies Chromium selects `scroll-timeline`, traverses pixel ranges and reverses after the endpoint. The forced `scheduler` variant exercises identical outputs in every engine. Actual wheel/keyboard input and Chromium touch injection scroll the source. A separate optional scroll subscription leaves the visual execution path unchanged. After that subscriber is removed, Chromium scroll presentation advances without additional Jolt scheduler frames. This does not establish compositor promotion, GPU use, device FPS or input-to-photon latency.

## Additional checks

- 1,633 unit tests across 102 files, including strict range/overflow/derivative validation and lazy dependency cleanup.
- Existing browser suites: composition 42, runtime 54, press 73, integration 34, dynamic 49 passing checks. Their six pre-existing engine-specific skips remain explicit.
- Actual packed Web-only and Vue consumers: strict NodeNext/Bundler types, source boundaries, direct and Vite SSR, development and production browser execution. The plain Web consumer exercises mapped followers, geometry observation/refresh and scroll creation/disposal through the public facade.
- Native packed root, Vue and native-entry declarations and iOS/Android production webpack bundles retain their contracts. Native implementation files are unchanged. Repository CI also runs the existing native math/solver and lifecycle checks.
- Root/support typechecks, portable-core and Web import checks, formatting, documentation media checks and the four-language documentation build.

An initial browser input test overlapped the browser's keyboard scroll animation with a programmatic offset assertion. It now waits for the actual end offset before testing reversal. Velocity continuity is checked at a held scheduler timestamp instead of comparing across unrelated context construction. A separate interrupted run lost worker modules while local dependencies were reinstalled; the complete suite was rerun after installation and passed. The first Linux CI run exposed missing touch emulation in the new input fixture: it now enables Chromium touch emulation, dispatches actual touch start/move/end events, and holds the touch during the presentation comparison to exclude inertial movement between protocol reads. No retries mask these failures.

## Recording review

`recording.json` records browser/version, input sequence and hashes at capture. Formatting afterward does not alter the recorded behavior. `web-support-chromium.mp4` is an original-speed Playwright browser recording of the actual fixture: slider endpoint input and spring retarget, held keyboard press, responsive label change, wheel scrolling in both directions, press at the scroll endpoint and complete disposal. Full MP4 decoding and sampled frames confirm visible changes, readable English controls and no error overlays. Capture asserts that no page errors occurred.

Reviewed existing English native references are reused because their implementation is unchanged: `descending-values-ios.mp4` (iOS simulator, 20.67 seconds) shows descending/chained mappings during actual sheet gestures; `scroll-values-android.mp4` (Android emulator, 5.83 seconds) shows the actual scroll header responding to the list. Full decoding and representative frame inspection confirm both play and the effects are visible. They are not physical-device recordings or evidence of the Web backend running natively.

The browser recording and both native references are embedded in English, Portuguese, Spanish and Simplified Chinese documentation. English videos must also be attached as playable PR media.

## Boundaries and adoption

The Web subset is numeric, single-source and bounded to 32 mapping/follower levels. Geometry accepts same-surface size and computed 2D origin changes, retaining the static CSS baseline. Scroll is ordinary vertical document/element flow over explicit pixel ranges; there is no ViewTimeline, pinning, virtualized-header or nested-scroll handoff API. Direct-child ResizeObserver/content/font invalidation cannot detect every deep overflow change; consumers must call `refresh()` for those cases.

Mavis already tracks surface geometry in #137 and continuous inputs in #139. Its current Web feedback still pins a computed origin and its experimental surface exposes finite animate/set only. Upstream support does not itself remove either Mavis restriction. Its scrolling MScreen is an HTMLElement on Web and MavisScreenScroll on native, making a bounded shared application scroll proof a concrete follow-up. Shared application code must not receive DOM/native objects, and published adoption must wait for a Jolt version containing these APIs.
