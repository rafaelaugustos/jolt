# Image renderer boundary and acceptance

The initial #35 renderer is a **static-image backend**, used by the public ripple, distortion and dissolve presets from #115. The maintainer selected simulator/emulator acceptance on 2026-11-03. No physical-device GPU budget or arbitrary live-view shader is claimed.

## Targets and backends

| Target                                                           | Metal / UIKit                     | Android 13+ / AGSL                | Contract                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Decoded raster NativeScript Image                                | Supported when Metal is available | Supported with hardware rendering | Image pixels are rasterized once at the displayed size; finite/native-input uniforms then deform those pixels. |
| Application-created one-time snapshot supplied as an ImageSource | Same static-image path            | Same static-image path            | The application owns capture. Content is frozen until replaced. No automatic view snapshot API.                |
| Refreshed snapshots                                              | No automatic backend              | No automatic backend              | Replacing source terminates the old effect; explicitly create another effect.                                  |
| Live native subtree, text or controls                            | Unsupported                       | Unsupported by this Jolt API      | AGSL/RenderEffect platform capabilities do not imply a Jolt view-filter contract.                              |
| Backdrop sampling/refraction                                     | Unsupported                       | Unsupported                       | Blur and native glass have separate APIs and semantics.                                                        |
| Video, camera, WebView, protected content                        | Unsupported                       | Unsupported                       | No promise to capture, refresh or bypass protected surfaces.                                                   |
| SwiftUI-hosted content                                           | No adapter                        | Not applicable                    | SwiftUI shader modifiers are not UIKit filters.                                                                |

Android's [AGSL documentation](https://developer.android.com/develop/ui/views/graphics/agsl) describes API 33+ RuntimeShader integration with Canvas and View rendering. Jolt uses a hardware overlay drawable because NativeScript's image rasterization path may use a software canvas. It preserves the caller's bitmap, scale mode, touch listener and clickability. It does not install a global RenderEffect or replace a caller-owned one.

On iOS, a [MetalKit MTKView](https://developer.apple.com/documentation/metalkit/mtkview) sits inside the original UIImageView. A cached Metal pipeline implements the three pixel effects. Core Image built-in filters do not supply the same gesture-driven displacement and deterministic reversible dissolve contract; the dedicated surface keeps that contract explicit. The existing SpriteKit warp (`liquid`) remains available for its mesh deformation use case. SwiftUI layerEffect would require hosted SwiftUI content and is not an implementation shortcut for arbitrary UIKit subtrees.

## Inputs, mapping and work

The TypeScript API accepts target-local DIP origin/radius/amplitude, duration in milliseconds, normalized progress [0,1], a deterministic seed and a decoded destination image. There is no public arbitrary shader-source, color-uniform or generic shader-graph API. Metal converts DIPs using screen scale; Android converts through display density. Native drag coordinates are relative to the image and are converted before updating displacement. Pixel deformation does not alter hit geometry.

Both backends rasterize into the displayed bounds, preserving stretch/aspect mode and transparent areas. Android accounts for source rotation, padding and inner border radii; iOS draws UIImage through UIKit into premultiplied RGBA and uses the view's clipping. Samples clamp to the texture edge. The initial implementation uses ordinary 8-bit color, not an HDR/wide-gamut equivalence guarantee. Android's identity/restoration checks cover all four stretch modes, rounded clipping, transparent source/destination content and source replacement. They allow the documented small raster-filtering tolerance in `android-image-tests/README.md`.

Preparation includes rasterization/upload and backend creation; input images are decoded before measurement. Metal compiles/caches the process pipeline on first use. Android creates a RuntimeShader for each effect and the platform controls driver caches; a process restart does not prove a cold GPU driver cache. Metal encodes one render pass per effect draw. Android supplies one overlay shader draw; these are implementation counts, not a measured count of every compositor/GPU pass. Neither backend runs an application JavaScript callback per frame. Native drawing and Android view scheduling can still stall with UI-thread work.

## Ownership, cleanup and bounds

Each image has one image-effect owner; replacement stops the previous owner. Ordinary transforms/opacity remain on the original view. The temporary rendering surface is nonsemantic and keeps accessibility on the original image. Distortion observes actual native gestures and restores prior input state. Completion, cancellation, disposal, source/stretch/tint/border/padding/size changes release the old renderer. Backgrounding pauses it; foregrounding resumes only if the user had not paused it. The motion scope can adopt the animation handle.

The per-effect output cap is 4,194,304 physical pixels. Source decoding is application-owned and not capped by this output guard. Metal texture accounting is output pixels × 4 × one/two images; Android adds an alpha placeholder to source/destination raster allocations. `textureBytes` drops to zero when Jolt relinquishes ownership. `peakTextureBytes` excludes staging buffers, drawables, compositor allocations and driver caches; it is not process/GPU peak memory. GPU retirement can be asynchronous. Concurrent images multiply the budget: this acceptance measures one ripple and two concurrent dissolves, not an unlimited-surface performance guarantee. There is no hidden global concurrency queue.

Unsupported renderer/OS/target, failed preparation and reduced motion use the documented stable fallback: decorative effects keep the original image and resolve false; dissolve commits its destination immediately and resolves true, including a requested paused transition. Diagnostics distinguish fallback, reason and available native error detail. Paused/reversed finite effects preserve their pixels; live distortion rejects progress seeking and settles from native input instead.

## Repeatable measurements and evidence

`demo/src/recipes/image-profile.ts` creates two 160×220 DIP images with decoded raster inputs. Native taps run one initial ripple plus five warm repeats, then six pairs of concurrent dissolves, then cancellation. `preparationMs` uses the setup boundary; `frameIntervalsMs` stores the last 512 active native draw-callback intervals in a fixed-size native ring. There is no bridge call or allocation per frame. These intervals are **not GPU time or presentation time**. They exclude paused gaps and must not be compared with SurfaceFlinger presentation metrics from the cross-stack scenario.

Build the current package and native demo. Use `testImageMeasurements` in `benchmarks/docs-record-ios.py` for iOS without recording, or `python3 benchmarks/image-profile-android.py SERIAL OUTPUT` for Android. Keep other builds/recordings/input workflows idle. Raw reports retain every sample, image geometry, density and terminal owned bytes. The separate `testImageProfile` recording demonstrates actual pixels and cancellation, and is not the primary timing run. Device/build details and summary measurements are retained in `results/image-renderer/`.

Functional evidence also includes 27 real Android image interaction checks, actual iOS effect gestures and the completed gallery navigation/cleanup runs. This acceptance cannot establish physical GPU throughput, thermal behavior or physical display latency. Broader live-view rendering remains a separate target with its own capture, interaction and resource contract.

### Recorded baseline — 2026-11-03

These are single-emulator baselines. Setup medians and draw percentiles aggregate the stated runs; compare neither backend as a hardware ranking. iOS uses 480×660 output pixels per image; Android uses 420×578 pixels (160×220 DIPs at each platform density).

| Backend / case                | Runs | Setup p50 / p95 (ms) | Draw p50 / p95 / p99 (ms) | Peak combined owned bytes | Terminal owned bytes |
| ----------------------------- | ---: | -------------------: | ------------------------: | ------------------------: | -------------------: |
| ios / initial-ripple          |    1 |        52.00 / 52.00 |     16.67 / 17.27 / 34.09 |                 1,267,200 |                    0 |
| ios / warm-ripple             |    5 |          4.00 / 5.00 |     16.67 / 16.71 / 16.73 |                 1,267,200 |                    0 |
| ios / first-two-dissolves     |    1 |          7.00 / 7.90 |     16.67 / 16.75 / 16.82 |                 5,068,800 |                    0 |
| ios / warm-two-dissolves      |    5 |         8.00 / 10.55 |     16.67 / 16.77 / 17.28 |                 5,068,800 |                    0 |
| android / initial-ripple      |    1 |        29.00 / 29.00 |     16.70 / 20.42 / 74.53 |                 1,213,800 |                    0 |
| android / warm-ripple         |    5 |          1.00 / 1.80 |     16.67 / 17.48 / 18.16 |                 1,213,800 |                    0 |
| android / first-two-dissolves |    1 |          2.00 / 2.00 |     16.69 / 17.45 / 18.49 |                 4,369,680 |                    0 |
| android / warm-two-dissolves  |    5 |          2.00 / 3.55 |     16.67 / 17.42 / 18.47 |                 4,369,680 |                    0 |

The first ripple starts in a fresh app process; later dissolves reuse the process pipeline/cache. These are not cold driver-cache measurements. Reproduce the summary with `python3 benchmarks/image-profile-report.py benchmarks/results/image-renderer`. The 4K sample ring per effect is separate from texture accounting. Android process PSS before/after is retained alongside the reports; it includes NativeScript, decoded sources, UI and caches, so a delta is not a texture leak measurement.
