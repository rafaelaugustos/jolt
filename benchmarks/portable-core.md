# Portable motion boundary — #236, first delivery

`src/core/` contains the existing curve solvers, easing identity registry, adaptive sampler, transition resolution and numeric track compiler. It also contains the generic `Driver<Target>` contract, playback interfaces/clock and a factory for per-context property revision tokens. Native modules re-export the moved implementations so existing imports and function identity remain intact. `src/track.ts` resolves native configuration before calling that same compiler; `src/engine.ts` uses the portable ownership registry and clock.

The compiler takes resolved numeric keyframes, a transition, incoming velocity and explicit `{ timeScale, reducedMotion }` settings. It does not read views, start frames, select a platform driver or consult global configuration. A track retains its offsets, values, duration, delay, repeats, arrival, sampling diagnostics and `valueAt`/`velocityAt` functions. These are the data required to preserve interruption and playback semantics in another driver.

Opacity and 2D transforms are the initial cross-platform target. The compiler also retains existing numeric color, decoration, 3D rotation, gravity and drag-release calculations so native behavior stays on a single implementation. Their presence in the core does not promise those rendering capabilities on another platform. Native target validation, color parsing, property reads/writes, platform driver selection, native live springs and gestures stay outside the boundary.

## Verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run core:check
npm run benchmark:typecheck
npm run docs:check-media
npm run docs:build
```

`test/fixtures/portable-motion-baseline.json` was captured from the original source at `eb95982bc30a06c0bce727316b2f0dcc1faa6ef2`, before using the extracted compiler. The capture used an isolated copy of that commit's `src/`, the inputs in `portable-motion-cases.ts`, the native test shims and the serializer in `describe-track.mjs`. It is a compatibility reference, not a snapshot to regenerate from the refactored code to make a test pass.

The 38 cases cover the sampler benchmark curves plus both translation axes, both scales, rotation, delay, repeat/reverse, seeded random pauses, endless repeats, zero duration, repeated keyframe times, whole-track easing, decay/snap, drag edge recovery, gravity, incoming velocity at different time scales, reduced motion and native color/decoration paths. Both the native boundary and direct core compilation must match. The fixture stores timing, endpoint, arrival, diagnostics and position/velocity probes at boundaries; a SHA-256 digest covers **every** sampled offset/value pair. Floating-point observations are rounded to ten significant digits to ignore insignificant platform math noise. Existing sampler error-bound and lifecycle tests remain in place.

The isolated consumer check:

- Compiles the core with only ECMAScript libraries and no ambient platform types.
- Audits the runtime module graph for imports outside `src/core/`.
- Packs only `dist/core/` as a private test package and installs its tarball offline into a temporary consumer with no dependencies or repository aliases.
- Compiles that package's actual declaration files with `skipLibCheck: false`, using a plain object as the driver target.
- Imports and compiles opacity and 2D transforms with platform and scheduling globals trapped; exercises clock control and independent ownership registries.

The regular native CI continues to build production bundles and measure actual iOS/Android presentation, with its existing negative control. This refactor introduces no visual feature or changed visible behavior; existing recordings are preserved.

## Remaining work in #236

This is an **internal** boundary. There is no public `/core` or `/web` export and no change to the package's required NativeScript peer. The clean consumer test proves that the extracted artifacts are independent; it does not prove a web-only install of the current public package. Packaging and native peer installation must be decided and tested before publishing a web entry.

The native runtime still has its existing global driver/configuration and view lifecycle. A web runtime must own its own driver, settings and registries. The ownership factory enables that separation but does not by itself make the full native engine portable. DOM transform composition, WAAPI playback, interruption handoff, browser clocks, cleanup, SSR-safe web installation and browser conformance remain for the next delivery. Framework adapters and Mavis integration follow that backend. Keep #236 open.
