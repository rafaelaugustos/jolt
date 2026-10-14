# ProMotion and spring sampling

The iOS driver now supplies a frame-rate preference on iOS 15 and later. It requests a maximum of 120 Hz, capped by the view's screen, with a minimum of 80 Hz or the screen's maximum when lower. A view without a window uses the main screen. Older systems skip the unavailable selector. The iPhone app must also opt in through `CADisableMinimumFrameDurationOnPhone`; see the [setup guide](../../docs/guide/install.md#promotion-on-ios).

This preference controls playback scheduling. The number of sampled keyframes controls how closely their linear interpolation follows the original curve. A 60-sample-per-second curve can still update on every 120 Hz display frame.

## Device check

Checked on October 14, 2026, with an iPhone 17 Pro, iOS 27.2 build `24B5099f`, NativeScript core 9.1.3 and iOS runtime 9.1.0. The app used a native Release build, production bundle, and the Info.plist opt-in. Low Power Mode was off and the thermal state was nominal.

A four-second translation and opacity animation with a reverse repeat completed successfully. Reading the installed animations back from the layer returned `{ minimum: 80, maximum: 120, preferred: 120 }` for both properties. The display reported a 120 Hz maximum.

A separate `CADisplayLink` observer kept its default `{ 0, 0, 0 }` range. It received 240 callbacks with a median interval of 16.669 ms, approximately 60 callbacks per second. This confirms the native preference and completion, but does not verify 120 Hz rendering. An attempted Instruments capture remained waiting for the device and was stopped, so there is no compositor trace. Actual rendering cadence needs a separate capture; the requested rate is not a measured frame-rate guarantee.

Unit tests cover a 60 Hz screen, a view on a different screen, shadow-layer copies, and the absence of the iOS 15 selector. Older-iOS compatibility was tested through the driver shim, not an older physical device.

## Numerical comparison

Run from the repository root:

```sh
npm run build
node benchmarks/spring-sampling.mjs
```

The script compares the current spring samples with a hypothetical 120-sample-per-second representation of the same curve. It checks linear interpolation against the engine's analytical position every 0.1 ms until settlement, preserving endpoints. These are sampled maximum errors in NativeScript DIPs, not mathematical error bounds or measurements of the display. The full parameters and unrounded results are printed as JSON.

| Spring                                                         | Samples now / at 120 | Maximum error now (DIP) | Maximum error at 120 (DIP) |
| :------------------------------------------------------------- | -------------------: | ----------------------: | -------------------------: |
| 300 DIP, duration 600, bounce 0                                |             56 / 111 |                   0.944 |                      0.257 |
| 300 DIP, duration 550, bounce 0.4                              |             61 / 120 |                   1.172 |                      0.316 |
| 300 DIP, duration 200, bounce 0.4                              |              24 / 46 |                   6.788 |                      2.096 |
| 24 DIP, duration 200, bounce 0.4                               |              16 / 31 |                   0.553 |                      0.208 |
| 300 DIP, duration 400, bounce 0.3, initial velocity 3000 DIP/s |              43 / 84 |                   0.719 |                      0.186 |

Fast springs over large distances benefit from denser sampling. Simply doubling the rate nearly doubles the sample count and still leaves a roughly 2 DIP error in the fast 300 DIP case. It also affects the sampled arrival threshold used by sequences if changed in the engine.

Keep the current sampling density for this change. Requesting ProMotion does not require increasing it, and [the startup baseline](./2026-10-14-ios-startup.md) already shows significant preparation cost for large batches. [#61](https://github.com/rafaelaugustos/jolt/issues/61) tracks sampling according to curve error; it is the place to improve fast trajectories without doubling every animation's bridge payload. The current sampler is not a guarantee of subpixel accuracy at either refresh rate.
