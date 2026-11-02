# DOM attachment, item identities, horizontal scroll and paused native replacement

Pre-RC.8 verification for #334, #336, #337 and #338, based on merged #335 (`3b8649f`). No package version is published by this change.

## Implementation boundaries

- `/web/vue` adds `createViewportEnterDirective()`. Its document/detached-root observer waits for insertion; no fixed timeout or animation-frame polling. The same connection boundary protects continuous Vue setup and enter transitions. Cancellation/ref/deactivation/unmount release pending work. Imperative mounted-target validation stays strict.
- Web `animateItems()` reconciles explicit key/element pairs through the existing viewport controller. There is one observation group per collection, finite existing runtime playback, per-identity once history and explicit primitive-key eviction. This is neither virtualization nor FLIP.
- Scroll values/links accept x/y. Horizontal offsets increase from logical start in LTR and RTL. ScrollTimeline and forced scheduler preserve endpoints; geometry invalidation and scope/runtime cleanup retain the existing contracts.
- Native motionStates now uses a live participant map and completion barrier. Retiring an old participant ignores its later completion, while a paused replacement remains in the active run until resumed/completed. It does not cancel unrelated ownership.

## Reproduce

```sh
npm ci
npm run build
npm run web:attachment:typecheck
npm run web:attachment:test
npm run package:nuxt:check
# Published RC.7 must reproduce the detached-mounted-target failure:
node scripts/check-nuxt-consumer.mjs --baseline
npm ci --prefix benchmarks/native-app
npm run package:check
npm test
npm run docs:check-media
npm run docs:build
```

The Nuxt script installs the actual tarball into a clean Nuxt 4.6.3/Vue 3.5.44 application, typechecks/builds it, verifies SSR content, then exercises production Chromium, Firefox and WebKit. Its fixture contains nested asynchronous content that mounts while an out-in branch is detached. The RC.7 negative control produces the mounted-target TypeError without hydration mismatch. The candidate passes history, asynchronous page entry, KeepAlive and reduced motion. NodeNext/Bundler, Vite dev/production, direct/bundled SSR and native production JS consumers remain covered by `package:check`; no NativeScript peers enter the Web consumers.

### Independent Nuxt router limit

In Nuxt 4.6.3, navigating to `/slow`, returning to `/` while out-in is pending, then navigating to `/away` can strand an empty page placeholder. The same reproduction fails after replacing Jolt's transition with `{ name: 'test-fade', mode: 'out-in', duration: 300 }` and ordinary CSS opacity enter/leave classes. This is not evidence of a Jolt attachment failure and this PR does not claim to fix the Nuxt router. The successful consumer matrix waits for the async route transition; cancellation of detached enters, stale completion protection and scope disposal are independently tested in `attachment.spec.ts` against real Vue and all three browsers. Retained local production fixtures and failure screenshots are printed by the consumer script. `JOLT_NUXT_REUSE` is a local diagnostic shortcut; CI always creates/builds a fresh tarball consumer.

## Observed results (2026-11-02)

- 63 new browser checks pass across Chromium, Firefox and WebKit; existing Web suites also pass (including their existing skips).
- 1,656 native/core unit checks pass. The added paused-unload-replacement regression fails against the previous native implementation and passes with the live barrier. Repeated replacement, detach-only, post-settlement attachment, unrelated ownership and disposal are covered.
- The real iOS 26.2 simulator and Android API36 emulator run the normal demo with actual XCTest/ADB input. A replacement remains at its initial presented x/y while paused and reaches x=180/y=-14 with `settled=working` after resume. iOS checks read CALayer presentation transforms; Android checks read native translation in DIPs. Model layout frames are not presentation evidence. Production console output may be stripped; Android asserts the native check result exposed by the UI.
- These are correctness checks on simulators/emulators, not physical-device performance measurements.

## Recordings

```sh
node benchmarks/web-attachment/record.mjs
# Uses the successful retained production Nuxt consumer:
node benchmarks/web-attachment/record-nuxt.mjs
# Dedicated device IDs; normal demo installed with JOLT_BENCHMARK=1:
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID /tmp/JoltAttachment testPausedReplacement testHorizontalScroll
python3 benchmarks/paused-replacement-android.py emulator-PORT /tmp/JoltReplacementAndroid
```

English recordings are embedded with translated captions in EN/PT-BR/es/zh-Hans guides. Browser clips show real wheel/pointer/navigation input. Native clips show actual native playback; existing ListView and Vue clips remain references with explicit limits. Footage is H.264 at original elapsed time, fully decoded and visually inspected. PR descriptions reuse only English recordings as playable attachments. The Mavis adoption gap is already tracked in getcortexlabs/mavis-ui#224; the native correction unblocks its #220 validation after merge and pinning a containing package.
