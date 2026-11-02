# Web visual effects verification

Development work for #352–#357, after RC.9. The experimental runtime and child scopes expose gradient, shimmer, loader, reveal/conceal, animateText and rollTo; `/web/vue` owns them through `useWebMotion().use()`.

## Evidence and execution boundary

On 2026-11-02, the effects suite passed 63 checks: 21 scenarios each in Chromium, Firefox and WebKit. It covers independent gradient channels and live binding ownership, preserving custom stops, reduced-motion geometry, background composition, shimmer/loader lifecycle, authored clipping, visible-circle reversal, Unicode/RTL shaping, original Text identity, rapid rolling replacement with bounded flattened fragments, application writes, detached targets and Vue ref replacement/KeepAlive disposal. Native effects retain their existing APIs; shared pure gradient and rolling-diff helpers are reused across backends.

Gradients and authored-clip masks use the existing shared scheduler. Loading, text and ordinary circular clipping use WAAPI; no claim of universal compositor acceleration follows. Gradients have fixed 2–8 colors. Text effects require a plain-text leaf of at most 256 graphemes, positive axis-aligned transforms and no rich/editable content. Rolling replacement is bounded to 2048 visible fragments. Temporary layers are inert and aria-hidden; the application owns busy state, labels and focus before conceal.

The packed consumer test installs the actual tarball and invokes all six scoped public APIs in development/production browser builds. Strict NodeNext/Bundler declarations, SSR import/bundling, Vue lifecycle and native resolver builds pass without adding public export subpaths. The existing Nuxt production consumer also passes hydration, route and KeepAlive checks in all three engines.

## Reproduce

Use Node 22 and install Playwright's Chromium, Firefox and WebKit.

```sh
npm ci
npm run build
npm run core:check
npm run web:effects:typecheck
npm run web:effects:test
npm ci --prefix benchmarks/native-app
npm run package:check
npm run package:nuxt:check
node benchmarks/web-effects/record.mjs
```

The browser fixture serves only the portable/Web/Vue graph at port 4297. The recorder injects actual clicks, captures Chromium at normal speed and trims only its initial setup second. The five MP4s show gradients, loading, circular reveal, text and rolling; reduced motion and disposal are visible. No animation frames are synthesized.

The six `web-native-*-ios.mp4` references were captured from the normal English Vue demo with `testVisualParityReferences` in `benchmarks/docs-ios-ui.swift`: iPhone 17 simulator, iOS 26.0, release build, actual XCTest taps. They demonstrate the existing native effects corresponding to the new browser implementations. The browser clips demonstrate the new Web backend. These are correctness references, not physical-device or frame-rate benchmarks.

All thirteen new clips (including the two retained-scroll recordings) were decoded fully with ffmpeg, checked for H.264/duration with ffprobe and reviewed across their frames. The four documentation locales reuse the reviewed English UI recordings with translated captions. PR attachments use those English recordings only.

## Mavis follow-up

Mavis main `087209b` (PR #238) and all 202 open/closed issues were inspected. Existing solid-paint bindings, MSkeleton pulse, MButton loading text and height-based MReveal do not expose these six capabilities. Adoption is tracked separately for gradients, loading resources, text/rolling recipes and circular reveal. The native MScreen dependencies in Mavis #236/#237 remain pending until Jolt #348/#349 are merged and published. Development tarballs do not establish publication, and no Mavis implementation is included here.
