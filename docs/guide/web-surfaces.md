# Web particles, surfaces and image effects

**Available since 0.1.0-rc.10.** Issues #359–#364 add six runtime and scope factories. Importing `/web` remains safe during SSR. Create the runtime after mounting; use decoded, laid-out `HTMLImageElement` targets for image effects. Mavis adoption is tracked separately.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const snow = scope.particles(scene, { source: 'top', angle: 90, rate: 30 })
scope.confetti(button, { count: 80 })
const soft = scope.blur(panel, { radius: 24 })
await soft.animate(0.7, 'smooth')
const line = scope.shape(canvasHost, {
  d: 'M10 10 L90 10 L90 90 L10 90 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#6851c9',
  stroke: '#b9fff1',
})
await line.animate({ d: 'M50 0 L100 50 L50 100 L0 50 Z' })
await photo.decode()
const flow = scope.liquid(photo, { intensity: 0.8 })
flow.pause()
flow.resume()
flow.stop()
await nextPhoto.decode()
const swap = scope.imageEffect(photo, 'dissolve', { to: nextPhoto, paused: true })
swap.progress = 0.4
swap.play()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Ownership and lifecycle {#lifecycle}

All six factories work through `motion.scope()` and `/web/vue` setup scopes. Suspension freezes owned work; resume continues it; disposal releases layers, listeners, scheduler tasks and styles. Hidden-document time is excluded. Invalid options leave the previous owner intact, and another runtime cannot steal the target. Decorative layers never receive input or enter the accessibility tree. Use `scope.use()` for replaceable Vue refs and KeepAlive setup.

Content blur, liquid and image effects share one filter slot per target; starting another replaces the previous owner. Backdrop blur owns a separate slot. Existing CSS filters survive cleanup, and newer application style writes are not overwritten. Apply borders/backgrounds to an outer wrapper when only image pixels should be filtered. These implementations use the shared JavaScript scheduler and browser Canvas/CSS/SVG rendering; they do not promise off-thread playback or native-identical pixels.

## Particles and confetti {#particles}

`particles()` accepts the [native particle options](./particles), using CSS pixels instead of DIPs. Canvas emission is bounded to 10,000 live particles; the backing store is capped at 4,194,304 pixels and DPR 2. Resizing changes new birth positions without moving existing particles. Expired births are skipped after a busy frame. Emission with `duration` ends automatically after the last lifetime.

`confetti()` emits for 200 ms with 2200 ms lifetimes. It captures the target center and uses a fixed viewport overlay outside ancestor clipping. It stays below browser top-layer dialogs and system UI. Its trajectories are random, so native/Web pixels differ. Both return callable cleanup handles with `pause/play`, `suspend/resume`, `dispose`, `finished` and `snapshot()`. Natural expiration resolves `true`; cancellation resolves `false`. Reduced motion suppresses new bursts and clears continuous particles; continuous emission resumes without catching up when motion is enabled.

<Clip name="web-particles-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="web-confetti-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="particles-ios" caption="iOS simulator, English UI: reviewed real native playback and interaction, reused as the native reference. Original timing; this is not a physical-device recording." />

## Controlled blur {#blur}

`blur(target, { amount, radius, mode })` uses a CSS content filter by default. `amount` is 0–1 and `radius` is 1–64 CSS pixels (default 24). `mode: 'backdrop'` uses backdrop-filter when supported; otherwise `snapshot().backend` is `none`. The shared `style` option accepts system/light/dark but does not emulate iOS material tint.

`animate(amount, transition)` retargets the displayed amount and spring velocity. Playback supports pause, seek and boolean completion. `set()` applies immediately, `stop()` holds the current amount, and `dispose()` restores the original filter. Reduced motion applies the destination. The native reference below uses iOS material; Android uses content blur.

<Clip name="web-blur-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="blur-ios" caption="iOS simulator, English UI: reviewed real native playback and interaction, reused as the native reference. Original timing; this is not a physical-device recording." />

## Shapes and morphing {#shape}

`shape()` creates a decorative SVG surface with fill, stroke, viewBox, line cap/join and fill rule. It reuses the native portable path parser. `animate({ d, strokeStart, strokeEnd }, transition)` requires matching normalized commands and subpaths. `set()` accepts a topology change. Trim is clamped to 0–1, applies only to the stroke, and requires one contour for partial drawing.

Playback supports pause, seek, interruption and reduced motion. Retargeting starts from the held geometry with a new curve. `stop()` holds it; `dispose()` removes the surface. The existing `drawPath()` still controls an application-owned SVG geometry element.

<Clip name="web-shape-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="shapes-ios" caption="iOS simulator, English UI: reviewed real native playback and interaction, reused as the native reference. Original timing; this is not a physical-device recording." />

## Liquid images {#liquid}

`liquid(image, { intensity: 0.7, duration: 8000 })` uses the same periodic deformation field as native iOS, encoded as a bounded 48 × 48 SVG displacement map. Intensity is 0–1; duration is a positive cycle time in milliseconds. `pause()`, `resume()` and `stop()` retain their native meanings; Web also exposes play/suspend/dispose and diagnostics.

Reduced motion shows the original image and suspends the clock. Source replacement or detachment disposes the effect; recreate it after the next image loads. Resize updates liquid geometry; finite image effects instead cancel on resize. Android native liquid remains an unchanged-image fallback. Unsupported or unready Web images return a stopped handle with an explicit diagnostic reason.

<Clip name="web-liquid-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="liquid-ios" caption="iOS simulator, English UI: reviewed real native playback and interaction, reused as the native reference. Original timing; this is not a physical-device recording." />

## Ripple, pointer distortion and dissolve {#image}

`imageEffect(image, name, options)` supports `ripple`, `distortion` and `dissolve`. Origin, amplitude (0–64, default 8) and radius (positive, default 96) use local CSS pixels. Finite duration defaults to 650 ms; dissolve seed is an integer 0–65535. Distortion uses real pointer capture and settles after release; it owns touch-action while active and rejects finite seek/reverse. Coordinate conversion supports an axis-aligned scaled image; do not rotate/skew a pointer-distortion target.

Finite handles expose `finished`, `progress`, `pause/play`, `reverse()` and `finish()`. Seeking preserves pause; `finish()` completes at the current direction’s endpoint. Stop/replacement restores the original source and resolves `false`. Forward dissolve commits the decoded `to: HTMLImageElement` source and clears srcset/sizes; reverse completion keeps the original source. A framework must commit the same destination to its application model after success.

Only loaded static raster images with positive layout are supported. The output cap is 4,194,304 physical pixels. Dissolve accepts fill/contain/cover/none/scale-down with percentage object-position. Its destination must be canvas origin-clean; a cross-origin image requires suitable CORS headers. The displacement/dissolve data images require a CSP that permits data images. Unavailable rendering, unsupported destination positioning or reduced motion keeps decorative images unchanged (`false`) but commits dissolve immediately (`true`), even when requested paused. `diagnostics.backend/reason` reports the fallback. Enabling reduced motion during finite playback completes at its directional endpoint. Source, responsive-source or size changes cancel active finite effects. Preserve alt text and application loading/error semantics.

<Clip name="web-image-surfaces-chromium" :width="900" caption="Chromium on macOS, English UI: real clicks demonstrate playback, pause/resume, replacement, reduced motion and disposal at original speed. Browser capture; no physical-device performance claim." />

<Clip name="image-effects-ios" caption="iOS simulator, English UI: reviewed real native playback and interaction, reused as the native reference. Original timing; this is not a physical-device recording." />

## Validation and reproduction

Run `npm run web:surfaces:typecheck` and `npm run web:surfaces:test`. The browser suite checks actual pixel changes, pointer input, completion, ownership, hidden time, source replacement, Shadow DOM/base URLs and cleanup in Chromium, Firefox and WebKit. Capture real browser input with `node benchmarks/web-surfaces/record.mjs`. Native footage is retained from the corresponding feature guides. See the [validation report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-surfaces.md).
