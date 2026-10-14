# iOS startup measurements — October 14, 2026

Starting a 50-row `fadeInUp` stagger took about 21 ms; 200 rows took 53–54 ms. Two fresh launches of the same build gave similar medians. Preparation happens synchronously for every row, even though playback is staggered by 30 ms.

## Setup

- Physical iPhone 17 Pro (`iPhone18,1`, model confirmed with `devicectl`), iOS 27.2 build `24B5099f`.
- Jolt `0.1.0-beta.1`, NativeScript core `9.1.3`, iOS runtime `9.1.0`.
- Source commit `344d0ff4156c4f8fe4e86cdc2a4b5c62dee52c71`, clean working tree, Xcode 26.6 build `17F113`.
- Native Release build, development signing, production webpack bundle, no debugger or HMR.
- Nominal thermal state throughout both runs; Low Power Mode and Reduce Motion off. Display reports a maximum of 120 Hz; actual refresh rate was not measured.
- Five warmups and 30 samples per size and phase. Loaded, non-virtualized rows without shadows. Creation, layout, cancellation, and reset are excluded.

Raw reports: [run 1](./iphone-17-pro-run-1.json), [run 2](./iphone-17-pro-run-2.json). `Device.model` reports the generic `iPhone` string; the specific model above comes from the connected device information. See the [harness instructions](../README.md) for timing boundaries and reproduction.

## Uninstrumented call time

All times are milliseconds, from entering `animate()` until it returns its handle.

| Rows | Tracks | Run 1 median | Run 1 p95 | Run 2 median | Run 2 p95 |
| ---: | -----: | -----------: | --------: | -----------: | --------: |
|   50 |    100 |        21.04 |     24.02 |        21.33 |     23.84 |
|  200 |    400 |        53.23 |     69.65 |        53.66 |     72.45 |

Both medians exceed a 16.67 ms interval, and therefore also an 8.33 ms interval. This is enough synchronous main-thread work to warrant optimization. It does not establish a dropped-frame count or measure the eventual animation's frame rate.

## Diagnostic breakdown

These are separate instrumented runs. The wrapper times calls to the real iOS driver's `play()` method; the remainder includes track preparation, native view property writes, scheduling, and instrumentation overhead.

| Rows | Run | Total median | Driver median | Outside driver median |
| ---: | --: | -----------: | ------------: | --------------------: |
|   50 |   1 |        21.76 |         14.58 |                  7.21 |
|   50 |   2 |        21.91 |         14.25 |                  7.30 |
|  200 |   1 |        52.57 |         35.54 |                 17.04 |
|  200 |   2 |        53.65 |         36.22 |                 17.39 |

Driver work accounts for roughly two thirds of the diagnostic totals. Instrumented total medians differ from plain medians by between −1.2% and +3.4%; this is not a calibrated estimate of timer overhead. Independent medians do not necessarily add up. Native array conversion is part of driver time, alongside animation creation, setters, transactions, completion blocks, and layer submission. This measurement does not isolate those operations from one another.

## Repeated work

The untimed inspection pass found the same counts in both runs:

| Rows | Native animations | Native arrays constructed | Values bridged | Key times bridged | Distinct value arrays | Distinct key-time arrays |
| ---: | ----------------: | ------------------------: | -------------: | ----------------: | --------------------: | -----------------------: |
|   50 |               100 |                       200 |          2,650 |             2,650 |                     2 |                        2 |
|  200 |               400 |                       800 |         10,600 |            10,600 |                     2 |                        2 |

There is one layer submission per track in this setup. Each row produces the same opacity and translation samples; only its delay changes. At 200 rows, the driver constructs 800 native arrays containing a total of 21,200 numeric entries, despite there being only two distinct value arrays and two distinct key-time arrays. These are bridge input counts inferred from the driver's construction path, not a native allocation or memory profile.

## Next changes to measure

1. Reuse native value and key-time arrays within a compatible batch. This workload is a good candidate because every row starts with the same values and zero velocity. Interruptions, relative values, and different transitions need separate cache entries or a fallback. Core Animation may still copy data internally; reducing bridge work does not eliminate all native costs.
2. Use native timing functions for simple cubic-bezier tweens. The opacity track is a candidate; the translation is a spring and still needs its sampled trajectory. Preserve the engine's interruption and completion behavior before comparing results.
3. Rerun this harness after each change and then measure frame delivery separately on this phone and an older device.

This PR establishes the baseline and the reproduction path. It does not change the runtime driver or claim an optimization speedup. All four full-stagger completion checks succeeded. A separate simulator run also completed successfully, solely to validate the harness; its timings are excluded here.
