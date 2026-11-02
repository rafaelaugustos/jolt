# Web gestures and coordinated scroll

Released in RC.9, covering #340–#345 in PR #347. The browser implementation is framework-independent; Mavis adoption is tracked separately in getcortexlabs/mavis-ui#234–#237.

## Execution and ownership

- Element drag release compiles the existing portable native drag solver into finite WAAPI playback. Numeric targets and contact-driven motion use the existing value graph and demand-driven context scheduler. Existing spring-return callers retain their default.
- Gesture geometry, delta allocation, keyed reorder operations and header geometry are portable. Native header/reorder now import the same unchanged rules through compatibility re-exports; native execution paths remain unchanged.
- Input surfaces explicitly own capture/touch-action while declared animated children own visual contributions. Coordinated touch scrolling consumes each delta once; nested RTL offsets retain fractions even when a browser exposes integer scroll positions. Wheel and keyboard scrolling stay browser-owned.
- Zoom, header and reorder use private transform/opacity layers and geometry leases, preserving other motion owners. Source replacement, teardown and stale async completion are guarded. The host owns markup, data, semantics and routing.
- Numeric spring velocity is normalized into the compiled scalar track's units. Video review exposed an amplified pull-to-refresh rebound before this correction; analytical tests and a real pull/error recovery regression now cover it, including zero-distance momentum.

## Reproduce

```sh
npm ci
npm run build
npm run typecheck
npm run web:typecheck
npm run core:check
npm run web:check
npm test
npm run web:gestures:typecheck
npm run web:gestures:test
npm run web:attachment:test
npm run web:orchestration:test
npm ci --prefix benchmarks/native-app
npm run package:check
npm run package:nuxt:check
npm run docs:check-media
npm run docs:build
# Interactive fixture, and English recordings:
npm run web:gestures
node benchmarks/web-gestures/record.mjs
```

## Evidence and limits

Local validation on macOS arm64 / Node 22, 2026-11-02:

- 1,660 unit tests pass, including portable contact/scroll rules, native regressions and absolute-unit spring velocity.
- 53 new browser tests pass across Chromium, Firefox and WebKit. Four explicitly skipped cases are the two CDP trusted-touch tests on non-Chromium engines. All three engines run pointer/keyboard input, RTL/nested scroll, image replacement/error, resize, refresh/title focus, lifecycle and synthetic multi-contact recognition conformance. Synthetic events are not physical touch evidence.
- 111 existing orchestration tests pass after the velocity correction. The attachment suite exercises the new scoped gesture through actual Vue KeepAlive/ref replacement; the existing dynamic suite remains a regression check for RC.8 drag callers.
- Tarball consumers exercise public factories, Web-only imports, SSR, NodeNext/Bundler types, Vite development/production, Vue setup and native production bundles. CI also runs the clean Nuxt consumer and all existing Web suites.
- These are behavioral and cleanup checks. They do not establish physical-device latency, frame-rate guarantees or universal browser acceleration. Input-coordinate and centered image-box contracts are documented in the guide.

## Reviewed recordings

The six new `web-gestures-*-chromium.mp4` recordings show actual browser playback and input at original elapsed time. `record.mjs` uses mouse/keyboard plus browser-trusted CDP touch injection, captures real frames, encodes H.264 and fully decodes each result. All were visually inspected; zoom and refresh were recaptured after the velocity correction. English footage is embedded with translated captions in EN/PT-BR/es/zh-Hans guides and attached directly to the PR.

| Feature                                               | New browser capture                 | Preserved native reference                                         |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| Drag / value / inertia                                | `web-gestures-drag-chromium.mp4`    | `drag-ios.mp4` — iOS simulator                                     |
| Pan / pinch / rotation                                | `web-gestures-gesture-chromium.mp4` | `gesture-composition-ios.mp4` — iOS simulator                      |
| Panel / content handoff                               | `web-gestures-scroll-chromium.mp4`  | `gesture-handoff-ios.mp4` — iOS simulator                          |
| Photo viewer / cancelled dismissal                    | `web-gestures-zoom-chromium.mp4`    | `photo-zoom-ios.mp4` — iOS simulator                               |
| Header / anchored insertion / refresh error and retry | `web-gestures-header-chromium.mp4`  | `scroll-header-refresh-ios.mp4` — physical iPhone 17 Pro, iOS 27.2 |
| Mouse / keyboard / edge reorder                       | `web-gestures-reorder-chromium.mp4` | `reorder-ios.mp4` — iOS simulator                                  |

Native reference files are unchanged, fully decoded and visually reviewed for this batch. Their original native demos and interactions are visible; they do not show the Web implementation. No simulator capture is presented as a physical device. The application integration remains outside this PR; follow-up Mavis issues require a published containing Jolt version before adoption is released.
