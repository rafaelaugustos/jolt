# Web visual parity verification

Candidate after published `0.1.0-rc.6`, based on main `6fc4d92a707b50a67044b3e35949666f423ac2fb`. This is the six-issue batch #308–#313 under the full-parity umbrella #236. It does not publish a release or claim all native APIs are available on Web.

## Scope and implementation

| Issue | Capability                                                            | Execution                                                                             |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| #308  | Background/text/four border-side colors, alpha and CSS parsing        | Shared premultiplied OKLab compiler; prepared WAAPI paint keyframes                   |
| #309  | Side widths, independent elliptical corner radii, CSS shorthand/units | Independent logical ownership and combined CSS corners                                |
| #310  | Continuous color and numeric decoration bindings                      | Existing dependency graph and context scheduler; finite unrelated surfaces keep WAAPI |
| #311  | Numeric/auto width and height, intrinsic changes, controls            | Real layout measurement and writes through the context scheduler                      |
| #312  | Direct-child position/size FLIP, entry, reorder, interruption         | Batched capture/final measurement and private playback contributions                  |
| #313  | Nested finite scenes with element and mutable-value tracks            | One source clock; numeric observation uses the context scheduler                      |

The native runtime/platform sources are unchanged. DOM parsing stays outside the portable property/value modules, so native consumers still compile without DOM ambient types. The optional Vue adapter exposes size/layout operations on its declared ref with scope disposal.

## Local evidence, 2026-11-02

Node 22.23.3 on macOS arm64, Playwright 1.64.1: Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. WebKit here is Playwright's engine build, not physical Safari device evidence.

- New suite: **96 passed**, 32 scenarios in each engine, with page-error capture and no retries.
- Existing browser suites: composition 42 passed; finite runtime 54 passed; press 73 passed/2 skipped; integration 34 passed/2 skipped; dynamic 49 passed/2 skipped; support 49 passed/2 skipped. The existing skips concern engine-specific touch/compositor instrumentation; they are not newly skipped parity tests.
- Root unit suite: 1,633 tests in 102 files passed. Root/Web/fixture typechecks, portable-core check and compiled runtime probes accompany the browser checks.
- Actual tarball consumers verify strict NodeNext/Bundler types, direct and bundled/external Vite SSR, real Vite development/production playback, optional Vue lifecycle, and native root/Vue/native declarations plus iOS/Android production JavaScript bundles. The new imperative probe exercises paint, continuous color, a value/element scene, intrinsic size and FLIP together; Vue also runs paint, size and layout.

Browser scenarios cover independent paint takeover; authored image/style restoration; transparent CSS colors and contextual units; elliptical shorthand and nested CSS math; unresolved mapping-color rejection; live source disposal; flex grow/shrink without an initial jump; content-box/min/max/Grid sizing; auto remeasurement; interruption and pause; external dimension takeover; removed targets; changing origins with unrelated playback; reduced motion while paused; FLIP under nested 2D transforms with actual hit geometry and displayed-size continuity during a replacement; insertion/removal/replacement; empty-container teardown; nested scenes, repeats, paused endpoint rewind and partial value takeover; invalid transactions preserving old owners; and value-only scene cleanup.

Presentation is checked separately from internal values and paused seek. A running WAAPI test asserts intermediate rendered colors, border width and corner radius and inspects real KeyframeEffect property names. Visual recording review caught an initial kebab-case/IDL-name error that endpoint-only checks could not detect; the regression would fail on that implementation. The packed consumer also caught content-box border animation changing its own pivot, which must not be mistaken for an external style mutation.

## Recordings

Start with `npm ci` and `npx playwright install chromium firefox webkit`, then:

```sh
npm run web:visual:typecheck
npm run web:visual:test
npm run web:visual
# Open http://127.0.0.1:4287/?demo=paint
# Other demos: ?demo=size, ?demo=layout, ?demo=scene
# Stop the server before automated capture:
node benchmarks/web-visual/record.mjs
```

The recorder starts an isolated local server and uses actual Playwright mouse/keyboard actions. It captures original-time Chromium playback, encodes H.264 MP4, checks full-file decoding and emits review contact sheets. No animation frames are fabricated. Review files and the environment report remain in ignored `benchmarks/web-visual/captures/`.

| Documentation media       | Duration | Shows                                                                                              |
| ------------------------- | -------: | -------------------------------------------------------------------------------------------------- |
| `web-paint-chromium.mp4`  |   8.83 s | Finite paint, independent elliptical corners, held press, interruption, live color/radius input    |
| `web-size-chromium.mp4`   |   8.43 s | Width plus auto height, actual text reflow, pause/resume, reverse, added content and following row |
| `web-layout-chromium.mp4` |   8.80 s | Grid reorder/resize, overlapping interruption, insertion/removal                                   |
| `web-scene-chromium.mp4`  |   9.43 s | Two visual targets and a numeric counter, shared playback, pause, endpoint and backward seek       |

Reviewed native references are reused in all four translated guides: `live-paint-ios`, `size-ios`, `layout-ios` and `seekable-scene-ios`. `decorations-reference-ios` is a 4.5-second excerpt of the existing `decorations.mp4`, with only launch screens removed and original playback speed preserved. The original file is retained. Native clips are references to their existing behavior, not recordings of new Web code. Their captions distinguish iOS simulator evidence and the explicit 0.25× size-demo segment; the older decoration source's device class is not inferred.

## Costs and remaining boundaries

Finite paint has no Jolt per-frame style loop, but the browser can repaint or lay out according to the property. Continuous bindings use JavaScript only on surfaces that need them. Real size probes layout each active frame and must not be presented as compositor-independent. These tests are correctness/lifecycle evidence, not physical-device FPS, heap-retention or universal performance claims.

The existing dedicated 2D HTML surface policy, resource budgets and explicit color/decoration semantics remain documented. Intrinsic-size endpoints cannot be replayed as fixed seekable tracks; FLIP mutates actual layout once and visually scales content. Reversible scenes require explicit finite descriptors, not callbacks or gesture side effects. Native and Web layout engines still apply their own allocation rules.

Mavis main was rechecked at `afac1095e7110c55fe60a745a2827c194667a847`: earlier RC.6 adoption #137/#139/#140/#141/#188 is already closed. New adoption issues are Mavis #191 (choice paint), #192 (Accordion dimensions), #193 (shared direct-child FLIP, distinct from virtualization #185), and #194 (shared scenes with a focused Sheet follow-up). They explicitly depend on a verified candidate and a pinned published release before delivery.
