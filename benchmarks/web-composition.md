# Web composition proof (#280)

Decision: use a grouped visual `transform` effect with independent logical browser clocks for the first finite-motion prototype. This proves that the existing portable compiler can drive DOM playback while preserving channel ownership and multiplicative contributions. It does not establish a public Web runtime, general CSS interoperability or Mavis code sharing.

## Reproduce

Use Node 22, `npm ci`, then `npx playwright install chromium firefox webkit`. Run:

```sh
npm run web:proof:typecheck
npm run web:proof:test
npm run web:proof
```

The last command serves the interactive fixture at `http://127.0.0.1:4280`. Stop it before tests or recording, which start their own server. On Linux, Playwright also needs its documented system dependencies (`npx playwright install --with-deps chromium firefox webkit`). The CI job installs them and uploads the JSON report and failure traces.

The browser bundle's import graph is checked by `server.mjs`: only the fixture and `src/core` may enter it; no NativeScript, framework, external imports or platform mocks. Playwright is a development dependency. The native package's peer dependencies and exports are unchanged.

## Strategies compared

The candidate fixture uses actual WAAPI effects and reads computed transforms in all three engines. Results are recorded in [evidence.json](./web-composition/evidence.json).

| Candidate                                                   | Observation                                                                               | Decision for this proof                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Individual `translate` with one replacement effect per axis | At halfway, the second effect yields `0px 25px`, losing the first effect's x contribution | Individual properties alone do not supply axis ownership    |
| Additive `transform` effects                                | Translation followed by rotation gives `(50, 0)`; reversed creation order gives `(0, 50)` | Needs stable ordering across replacement/cleanup before use |
| Additive individual `scale`                                 | Base `1.1` plus the additive `0.96` effect gives `1.056` in every tested engine           | Viable for this case; not rejected as unsupported           |
| Grouped transform with logical clocks                       | Concurrent axes, independent controls, partial replacement and multiplicative layers pass | Chosen bounded representation                               |

These observations are consistent with the [Web Animations effect-composition model](https://www.w3.org/TR/web-animations-1/#effect-composition). They do not rule out a future hybrid or an additive backend with an explicit stable order. The choice prioritizes predictable ownership and baseline composition; no comparative preparation-cost or compositor-performance claim has been measured.

## Representation and contract

Each logical channel owns a core `Track`, an ownership token and a targetless WAAPI clock on the element's document timeline. One rendered WAAPI effect combines the surface's channels. Replacing x does not restart y or scale's clocks. A logical handle is therefore not a rendered `Animation`.

Rebuild only at a start, control operation, replacement or completion. Compose the compiler's piecewise-linear `times`/`values`, including its final settlement bridge. Reuse the existing adaptive sampler with mandatory source knots to approximate products of changing scale curves. Translation and rotation contributions add; scales multiply. Keep the analytical `valueAt`/`velocityAt` source model for interruptions, instead of deriving velocity from CSS matrices. The proof contains no second spring solver and does not change native live springs.

The grouped effect uses a matching transform-function list and linear interpolation. Per-channel clocks preserve pause/seek/delay observations and completion. Cancellation resolves `finished` as false; completion resolves it as true. Old callbacks cannot commit over a replacement or a newly created surface. Cleanup restores original inline CSS only while the surface still owns its last write. Existing native ownership contracts remain unchanged.

No generic `Driver` signature change is required by this evidence: an opaque per-track handle can address a logical slot behind a composed target. The fixture is not yet a full implementation of that driver. Production batching, failure rollback, public completion/cancellation semantics and all configuration paths still need integration in #281. In particular, callers should dispose this experimental surface if its composition-budget guard throws.

## CSS and scope

The fixed matrix order is `B × T(x, y) × R(rotate) × S(scaleX, scaleY)` around the original CSS `transform-origin`. `B` is the captured static 2D computed transform, so an existing rotation/skew changes the coordinate basis of subsequent movement. Values use CSS pixels, degrees and dimensionless scale factors. A noncentral origin and a translated/rotated/skewed baseline are checked against transformed corners.

The surface must be mounted and have a transformable box. Only one experimental owner is allowed per element. Individual CSS `translate`, `rotate`, `scale`, 3D matrices, existing animations/transitions and inline important transforms are rejected. Inline/class/origin/individual-property changes are detected at operations and completion. Arbitrary stylesheet, variable, layout or externally added animation changes are not continuously tracked: dispose/recreate before changing the baseline. This is an explicit integration constraint, not transparent coexistence with arbitrary application CSS.

Supported: `x`, `y`, `rotate`, `scaleX`, `scaleY`; base and press contributions; two endpoints; finite positive tracks up to 15 seconds without repeats. The composition guard rejects adaptive fallback or more than 6,001 union keyframes. `timeScale: 1` and reduced motion disabled are explicit experimental inputs, not production accessibility policy. Opacity, public keyframes/presets/stagger, preferences, visibility recovery, bindings, framework lifecycle and packaging remain follow-up work. The fixture's buttons apply/release a contribution; pointer/keyboard press recognition is #283.

## Results and their limits

Local run on 2026-11-01: macOS/Darwin 25.6.0 arm64, Playwright 1.64.1. All **42 checks** passed (14 per engine). WebKit here means Playwright's build, not certification of every installed Safari/iOS release.

| Browser  | Version      | Maximum compiled-effect x error (CSS px) | Maximum compiled-effect scale error |
| -------- | ------------ | ---------------------------------------- | ----------------------------------- |
| Chromium | 156.0.8078.4 | 0.127644                                 | 0.000931050                         |
| Firefox  | 157.0        | 0.124686                                 | 0.000928785                         |
| WebKit   | 27.2         | 0.127244                                 | 0.000932050                         |

The compiled-effect test samples the **same already compiled effect** at 39 explicit local times before comparing against the independent source clocks; it does not rebuild the measured effect at every sample. A second 39-point check isolates the compiler/source approximation at paused logical times. Assertions allow less than 0.3 CSS px for x and 0.002 for scale. Composition sampler tolerances are 0.05 px, 0.0002 scale and 0.02 degrees, in addition to the source tracks' approximation. These finite observations are not a universal error bound for arbitrary products or amplitudes.

Retargeting separately checks exact source-position continuity, inherited source velocity within 0.5 units/second, and the aligned presentation handoff within 0.3 px. Different-duration y/scale clocks remain unchanged. Settled scale is checked at `1.1`, `1.056`, `1.152` and `1.2`; disposal and natural completion leave no target animations. Other checks cover delay, pause/resume, stale callbacks after replacing the surface, CSS conflicts and preservation of external styles.

A separate real-time playback test observes movement over 150 ms with no style mutations or compositor rebuilds. This supports the absence of library style writes per frame; it does not prove GPU execution, dropped-frame rates, busy-main-thread resilience or absence of browser work.

### Live style reads are not an exact timeline probe

An exploratory comparison inside `requestAnimationFrame` found WebKit live computed style ahead of the source read at the cached timeline tick. One run observed x `28.727461` while the source at `86 ms` was `27.018385` (velocity `544.457761 px/s`); both the logical and rendered effects exposed `currentTime = 86 ms`. The maximum difference was **1.709076 px**, exceeding the deliberately attempted 0.3 px assertion. Another run saw 0.676915 px. Chromium/Firefox passed that attempt; this is not a cross-browser live-error guarantee.

WebKit documents a live, uncached time path for accelerated computed-style queries in its [animation implementation change](https://results.webkit.org/commit?id=306375%40main&repository_id=webkit). That is consistent with this observation, not proof of the exact cause in every build. The regression suite consequently measures curve accuracy at explicit local times and checks autonomous playback separately. **Live event-time interruption/presentation synchronization remains a #281/#285 validation requirement**, including high velocity and busy-main-thread cases. The prototype does not claim a 0.3 px handoff bound at arbitrary live event times.

To investigate that observation, start x/base scale/press springs in the fixture, then in each `requestAnimationFrame` compare `proof.model()` with `proof.presented()` and retain `proof.read('x')`, the rendered animation's `currentTime` and `document.timeline.currentTime`. Do not increase the numerical-curve tolerance to hide a timing discrepancy.

## Reviewed footage

With ffmpeg on PATH and the fixture server stopped:

```sh
node benchmarks/web-composition/record.mjs
ffmpeg -v error -i docs/public/media/web-composition-chromium.mp4 -f null -
```

The recording uses real Playwright clicks and browser video at 920 × 740, with unchanged playback timing, then converts to H.264. It shows x/y, x replacement, app scale, held press, a changed base and release. [recording.json](./web-composition/recording.json) records browser/OS, source hashes, video hash and final computed values. The clip was decoded and visually reviewed through representative frames, including the changed scale and continued y movement.

The guide in all four locales includes that browser clip plus the existing reviewed English native Layers clips: **iOS simulator** and **Android emulator**, accurately labeled as native composition references. Native production behavior and those recordings are unchanged. They do not claim the same application function runs on both platforms; that proof belongs to Mavis #102. Attach these same English recordings as playable videos to the PR.

## Next work

#281 integrates the finite-motion runtime and validates event-time clocks. #282 handles public Web packaging/SSR. #283 supplies press input semantics. #284 supplies the optional Vue adapter. Mavis #101/#32 share recipes and migrate press/reveal; Mavis #102 proves an application-authored shared animation with an experimental reference. Stable portable references, React and broader capabilities remain outside this slice.
