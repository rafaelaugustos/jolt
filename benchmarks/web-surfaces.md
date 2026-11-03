# Web particles, surfaces and images

The development batch for #359–#364 extends the public `/web` facade and child motion scopes with `particles`, `confetti`, `blur`, `shape`, `liquid` and `imageEffect`. It is not included in the published RC.9. Native entry points retain their meaning. The native liquid field now re-exports the same implementation from the portable core; its numerical behavior is unchanged.

## Implementation boundaries

- Particles use a decorative Canvas overlay and the runtime scheduler. Live population is bounded to 10,000, backing storage to 4,194,304 pixels, and DPR to 2. Birth positions survive resize. Confetti captures a viewport origin, expires automatically and stays below browser top-layer dialogs.
- Blur uses CSS content/backdrop filters. Unsupported backdrop rendering reports `none`. Existing filters and later application writes survive disposal; material tint is not emulated.
- Shapes reuse the portable SVG parser and compatibility check. Separate fill/stroke paths preserve fill during trim. Morphing uses the context clock and shared transition compiler; retargeting begins from current geometry with a fresh curve.
- Liquid reuses the native periodic field through a 48 × 48 SVG displacement map. Image effects use SVG displacement and noise compositing. The original image keeps its layout, alt text and hit target; filter definitions are in its tree scope. Absolute document fragment URLs also work with a `<base>` element.
- Dissolve uses a decoded HTML image destination and an origin-clean Canvas snapshot. Forward success commits its source; reverse/cancellation keeps the original. Framework applications must synchronize their source model. Unsupported rendering/positioning or reduced motion commits content immediately. Source and size changes cancel finite effects; liquid adapts to size changes.
- Continuous and finite owners share the runtime clock, ownership checks and cleanup. JavaScript schedules rendering; there is no claim of off-thread execution or native-identical pixels. The SVG primitives follow the [Filter Effects specification](https://www.w3.org/TR/filter-effects/).

## Verification

Recorded on macOS using the repository's pinned Playwright toolchain:

- **63 browser checks**: 21 cases in Chromium, Firefox and WebKit. Actual pixel differences and restoration; pointer capture; paused source replacement; base URL/Shadow DOM; reduced motion; hidden time; finite completion; topology rejection; filter preservation; foreign runtime ownership; scoped teardown.
- **515 browser regression checks** across effects, gestures, attachment, orchestration, visual rendering and lifecycle.
- **1,665 unit tests**, native/Web/fixture typechecking, build, portable-core and SSR import boundary checks.
- Actual packed package consumers: Web/Vue strict declarations, direct and bundled SSR, Vite development/production browser playback, and NativeScript iOS/Android production bundles. Nuxt SSR/SSG, hydration, navigation and KeepAlive checks pass.
- `docs:check-media`: 84 guides plus the homepage in four languages; 290 referenced recordings. `docs:build` passes.

## Real recordings

`node benchmarks/web-surfaces/record.mjs OUTPUT_DIRECTORY` records real Chromium input and playback; FFmpeg preserves timing while encoding H.264 MP4. The six new files are in `docs/public/media/web-*-surfaces-chromium.mp4`. The fixture supports pause/resume, alternative destinations, real pointer distortion, reduced motion, clickable controls and scope disposal. Browser capture is not a physical-device performance measurement.

The existing English native reference recordings remain byte-for-byte unchanged: `particles-ios.mp4`, `blur-ios.mp4`, `shapes-ios.mp4`, `liquid-ios.mp4` and `image-effects-ios.mp4`. They were fully decoded without errors and their frame sequences were reviewed again for visible effects, interaction, readable controls and platform labels. They show actual iOS simulator playback. Liquid's separate outer transforms and Android's unchanged-image fallback are described in its guide.

The six new MP4s were also fully decoded and inspected across their complete sequences. The documentation embeds these browser clips and the reviewed native references in English, Portuguese, Spanish and Simplified Chinese. The PR reuses only English recordings as direct playable attachments.

## Reproduce

```sh
npm ci
npm ci --prefix benchmarks/native-app
npm run web:surfaces:typecheck
npm run web:surfaces:test
npm test
npm run typecheck
npm run build
npm run core:check
npm run web:check
npm run package:check
npm run package:nuxt:check
npm run docs:check-media
npm run docs:build
node benchmarks/web-surfaces/record.mjs /tmp/jolt-surfaces-recordings
```

## Mavis follow-ups

Audited Mavis main `db047359bc1f67b6e23655cf35d181c0a6eab57f` (alpha.7, Jolt RC.9), its shared Web/native motion adapters, keyed `MImage` load/error lifecycle and open/closed adoption issues. The existing Web resource scope exposes new factories once its dependency is updated, but portable recipes and loaded image target/model ownership still need explicit integration.

- [Mavis #244](https://github.com/getcortexlabs/mavis-ui/issues/244): opt-in particles/confetti, input pass-through and scoped cleanup.
- [Mavis #245](https://github.com/getcortexlabs/mavis-ui/issues/245): controlled blur with explicit native/Web capabilities.
- [Mavis #246](https://github.com/getcortexlabs/mavis-ui/issues/246): portable shapes/morphs, distinct from closed Web-only `drawPath` adoption #224.
- [Mavis #247](https://github.com/getcortexlabs/mavis-ui/issues/247): loaded MImage pixel effects, application source commit, generation guards and coordination with zoom adoption #235.

These issues depend on this Jolt implementation merging and a containing Jolt version being published before Mavis release. Mavis code remains in its own workstream. General shaders on arbitrary views (#35) and the full parity umbrella (#236) remain open.
