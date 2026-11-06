# Portable workload measurements

Generated from the committed raw JSON by `python3 benchmarks/portable-summarize.py`. Five measured repetitions per variant/density; one warmup per variant excluded. Cells show median [minimum, maximum], except counts and frame percentiles. CPU/heap counters have different meanings on Android and Chromium: see [method and limitations](portable-foundations.md).

## Physical Android: cost per workload

Process CPU is the delta inside the native probe (setup + 1,200 ms motion for groups/drawing; 900 ms motion + 800 ms observation for activity, with instrumentation). ART values are counter deltas, not total allocations. A decreasing counter makes that variant/density unavailable (all raw samples retained). Even monotonic deltas cover only managed memory. RSS delta is ending minus starting resident memory; GC can make it negative. Updates show each run’s median of five targeted updates, then the five-run summary.

| Workload | Items | Variant   | Setup ms                | Update ms            | CPU ms                     | ART KiB                             | RSS delta MiB       |
| -------- | ----- | --------- | ----------------------- | -------------------- | -------------------------- | ----------------------------------- | ------------------- |
| groups   | 3     | baseline  | 30.53 [25.47, 39.22]    | —                    | 554.00 [485.00, 743.00]    | 156.00 [156.00, 188.00]             | 0.21 [0.12, 0.38]   |
| groups   | 3     | candidate | 24.59 [17.93, 27.89]    | —                    | 589.00 [556.00, 685.00]    | 156.00 [140.03, 156.00]             | 0.15 [0.09, 1.32]   |
| drawing  | 259   | baseline  | 115.68 [113.80, 124.58] | 50.65 [46.90, 53.04] | 930.00 [860.00, 1036.00]   | 332.00 [332.00, 396.00]             | 1.05 [-0.56, 4.18]  |
| drawing  | 259   | candidate | 110.87 [100.77, 152.09] | 21.06 [20.45, 28.95] | 1137.00 [1053.00, 1232.00] | 984.03 [984.00, 1016.00]            | 1.51 [1.36, 1.94]   |
| drawing  | 512   | baseline  | 182.26 [163.71, 188.71] | 44.97 [43.69, 52.24] | 920.00 [890.00, 1039.00]   | Unavailable (1/5 counter decreases) | -0.50 [-6.99, 0.18] |
| drawing  | 512   | candidate | 181.85 [167.99, 187.14] | 17.39 [17.29, 18.64] | 1239.00 [1206.00, 1381.00] | 1588.00 [1588.00, 1700.00]          | 2.69 [1.79, 3.09]   |
| drawing  | 1024  | baseline  | 300.22 [291.29, 306.22] | 46.44 [44.68, 48.44] | 1080.00 [1075.00, 1084.00] | 636.00 [636.00, 636.00]             | -0.26 [-3.04, 1.05] |
| drawing  | 1024  | candidate | 320.90 [304.29, 328.42] | 23.44 [21.81, 24.23] | 1695.00 [1675.00, 1817.00] | Unavailable (1/5 counter decreases) | 4.74 [-10.57, 5.95] |
| activity | 3     | baseline  | 22.80 [17.87, 24.62]    | —                    | 672.00 [623.00, 828.00]    | 192.00 [192.00, 208.00]             | 0.37 [0.05, 0.82]   |
| activity | 3     | candidate | 23.57 [13.90, 26.03]    | —                    | 528.00 [487.00, 612.00]    | 192.00 [176.00, 192.03]             | 0.25 [0.05, 0.36]   |

## Physical Android: scheduling, resources and renderer demand

Frame cells are medians of each run’s p50/p95/p99 native Choreographer timestamp intervals (ms), **not presented-frame timestamps**. First-write skew is between the three native property setters, not GPU presentation. Views include the common fixture host; resource counts are from the measured subtree after completion, before explicit cleanup.

| Workload | Items | Variant   | Interval p50/p95/p99 ms | First-write skew ms | Views during → after | Drawing owners during → after | Render callbacks     | Renderer active ms         |
| -------- | ----- | --------- | ----------------------- | ------------------- | -------------------- | ----------------------------- | -------------------- | -------------------------- |
| groups   | 3     | baseline  | 16.68/16.68/16.70       | 0.18 [0.13, 0.30]   | 5 → 5                | 0 → 0                         | —                    | —                          |
| groups   | 3     | candidate | 16.68/16.69/16.69       | 0.17 [0.12, 0.20]   | 5 → 5                | 0 → 0                         | —                    | —                          |
| drawing  | 259   | baseline  | 16.68/50.02/66.69       | —                   | 10 → 1               | 9 → 0                         | —                    | —                          |
| drawing  | 259   | candidate | 16.68/16.95/33.36       | —                   | 1 → 1                | 1 → 0                         | —                    | —                          |
| drawing  | 512   | baseline  | 16.69/50.02/66.67       | —                   | 17 → 1               | 16 → 0                        | —                    | —                          |
| drawing  | 512   | candidate | 16.69/16.69/33.35       | —                   | 1 → 1                | 1 → 0                         | —                    | —                          |
| drawing  | 1024  | baseline  | 16.68/50.01/50.04       | —                   | 33 → 1               | 32 → 0                        | —                    | —                          |
| drawing  | 1024  | candidate | 16.68/50.01/50.02       | —                   | 1 → 1                | 1 → 0                         | —                    | —                          |
| activity | 3     | baseline  | 16.69/16.69/16.71       | 0.18 [0.10, 0.24]   | 5 → 5                | 0 → 0                         | 79.00 [78.00, 79.00] | 1301.96 [1301.06, 1305.84] |
| activity | 3     | candidate | 16.69/16.69/16.69       | 0.15 [0.11, 0.21]   | 5 → 5                | 0 → 0                         | 54.00 [54.00, 54.00] | 905.39 [896.68, 910.11]    |

## Browser scheduling and structure

RAF interval p95 is the median of each run’s p95 callback interval, not display presentation. DOM counts include fixture descendants; batch SVG intentionally retains one path per item. Zero owned effect nodes remained after disposal in every measured run.

| Engine   | Workload | Items | Variant   | Setup ms             | Update ms         | RAF p95 ms           | DOM nodes | First-write skew ms |
| -------- | -------- | ----- | --------- | -------------------- | ----------------- | -------------------- | --------- | ------------------- |
| chromium | groups   | 3     | baseline  | 0.20 [0.20, 0.50]    | —                 | 16.80 [16.70, 16.80] | 3         | 0.00 [0.00, 0.10]   |
| chromium | groups   | 3     | candidate | 0.20 [0.10, 0.30]    | —                 | 16.70 [16.70, 16.80] | 3         | 0.00 [0.00, 0.00]   |
| chromium | drawing  | 259   | baseline  | 6.30 [5.80, 7.70]    | 1.60 [1.50, 1.80] | 16.70 [16.70, 16.80] | 45        | —                   |
| chromium | drawing  | 259   | candidate | 2.40 [1.80, 4.90]    | 0.70 [0.60, 0.80] | 16.70 [16.70, 16.80] | 261       | —                   |
| chromium | drawing  | 512   | baseline  | 11.50 [9.80, 14.50]  | 1.60 [1.50, 1.60] | 16.70 [16.70, 16.80] | 80        | —                   |
| chromium | drawing  | 512   | candidate | 4.20 [3.70, 4.40]    | 0.80 [0.80, 0.90] | 16.70 [16.70, 16.80] | 514       | —                   |
| chromium | drawing  | 1024  | baseline  | 22.70 [19.10, 26.90] | 1.50 [1.30, 1.70] | 16.70 [16.70, 16.80] | 160       | —                   |
| chromium | drawing  | 1024  | candidate | 7.00 [6.30, 7.50]    | 1.40 [1.10, 1.50] | 16.70 [16.70, 16.80] | 1026      | —                   |
| chromium | activity | 3     | baseline  | 0.20 [0.20, 0.30]    | —                 | 16.70 [16.70, 16.80] | 3         | 0.00 [0.00, 0.00]   |
| chromium | activity | 3     | candidate | 0.20 [0.20, 0.20]    | —                 | 16.80 [16.70, 16.80] | 3         | 0.00 [0.00, 0.00]   |
| firefox  | groups   | 3     | baseline  | 2.00 [0.00, 2.00]    | —                 | 9.12 [9.08, 9.18]    | 3         | 5.00 [0.00, 13.00]  |
| firefox  | groups   | 3     | candidate | 0.00 [0.00, 1.00]    | —                 | 9.14 [8.98, 9.22]    | 3         | 0.00 [0.00, 0.00]   |
| firefox  | drawing  | 259   | baseline  | 9.00 [8.00, 10.00]   | 2.00 [2.00, 2.00] | 9.20 [9.10, 9.26]    | 45        | —                   |
| firefox  | drawing  | 259   | candidate | 3.00 [3.00, 4.00]    | 1.00 [1.00, 2.00] | 9.24 [9.08, 9.28]    | 261       | —                   |
| firefox  | drawing  | 512   | baseline  | 24.00 [19.00, 32.00] | 3.00 [2.00, 4.00] | 9.10 [8.90, 16.66]   | 80        | —                   |
| firefox  | drawing  | 512   | candidate | 11.00 [5.00, 31.00]  | 2.00 [2.00, 3.00] | 9.32 [9.10, 16.64]   | 514       | —                   |
| firefox  | drawing  | 1024  | baseline  | 31.00 [28.00, 35.00] | 2.00 [2.00, 3.00] | 9.12 [8.84, 9.22]    | 160       | —                   |
| firefox  | drawing  | 1024  | candidate | 12.00 [9.00, 14.00]  | 2.00 [2.00, 3.00] | 9.06 [8.96, 9.24]    | 1026      | —                   |
| firefox  | activity | 3     | baseline  | 0.00 [0.00, 1.00]    | —                 | 9.02 [8.94, 9.20]    | 3         | 0.00 [0.00, 0.00]   |
| firefox  | activity | 3     | candidate | 0.00 [0.00, 1.00]    | —                 | 9.14 [8.96, 9.18]    | 3         | 0.00 [0.00, 0.00]   |
| webkit   | groups   | 3     | baseline  | 0.00 [0.00, 1.00]    | —                 | 18.00 [18.00, 18.00] | 3         | 0.00 [0.00, 11.00]  |
| webkit   | groups   | 3     | candidate | 0.00 [0.00, 1.00]    | —                 | 18.00 [18.00, 18.00] | 3         | 0.00 [0.00, 0.00]   |
| webkit   | drawing  | 259   | baseline  | 6.00 [6.00, 7.00]    | 1.00 [1.00, 1.00] | 18.00 [18.00, 18.00] | 45        | —                   |
| webkit   | drawing  | 259   | candidate | 2.00 [1.00, 2.00]    | 1.00 [0.00, 1.00] | 18.00 [18.00, 18.00] | 261       | —                   |
| webkit   | drawing  | 512   | baseline  | 11.00 [10.00, 11.00] | 1.00 [1.00, 1.00] | 18.00 [18.00, 18.00] | 80        | —                   |
| webkit   | drawing  | 512   | candidate | 3.00 [3.00, 4.00]    | 1.00 [1.00, 1.00] | 18.00 [18.00, 18.00] | 514       | —                   |
| webkit   | drawing  | 1024  | baseline  | 21.00 [20.00, 40.00] | 1.00 [1.00, 2.00] | 18.00 [18.00, 18.00] | 160       | —                   |
| webkit   | drawing  | 1024  | candidate | 7.00 [6.00, 8.00]    | 1.00 [1.00, 2.00] | 18.00 [18.00, 18.00] | 1026      | —                   |
| webkit   | activity | 3     | baseline  | 0.00 [0.00, 1.00]    | —                 | 18.00 [18.00, 18.00] | 3         | 0.00 [0.00, 0.00]   |
| webkit   | activity | 3     | candidate | 0.00 [0.00, 1.00]    | —                 | 18.00 [18.00, 18.00] | 3         | 0.00 [0.00, 0.00]   |

## Browser renderer demand

A small application-owned RAF renderer uses a 1,300 ms guessed stop timer in baseline and actual 900 ms playback completion in candidate. Both wait another 800 ms. This is a policy comparison; baseline could also use completion manually. Actual WebGL uniforms and idle stopping are separately verified by browser acceptance tests and recordings.

| Engine   | Variant   | Render callbacks        | Renderer active ms         |
| -------- | --------- | ----------------------- | -------------------------- |
| chromium | baseline  | 80.00 [80.00, 80.00]    | 1301.20 [1300.60, 1301.80] |
| chromium | candidate | 58.00 [58.00, 59.00]    | 900.50 [900.00, 901.40]    |
| firefox  | baseline  | 158.00 [157.00, 159.00] | 1302.00 [1300.00, 1308.00] |
| firefox  | candidate | 112.00 [111.00, 116.00] | 910.00 [901.00, 938.00]    |
| webkit   | baseline  | 80.00 [80.00, 80.00]    | 1300.00 [1300.00, 1301.00] |
| webkit   | candidate | 58.00 [57.00, 58.00]    | 901.00 [900.00, 901.00]    |

## Chromium main-thread counters

`TaskDuration` is browser main-thread task time (ms), not whole-browser CPU. `JSHeapUsedSize` delta is observed JS heap (KiB), not allocation volume, PSS or total memory; GC can make deltas negative. Other engines expose no equivalent counters in this runner.

| Workload | Items | Variant   | Main-thread tasks ms | JS heap delta KiB            |
| -------- | ----- | --------- | -------------------- | ---------------------------- |
| groups   | 3     | baseline  | 19.01 [16.88, 19.97] | 310.20 [-1028.78, 455.10]    |
| groups   | 3     | candidate | 19.07 [17.98, 20.27] | 265.18 [247.42, 288.92]      |
| drawing  | 259   | baseline  | 29.50 [28.58, 33.47] | 1113.92 [-4964.18, 1267.77]  |
| drawing  | 259   | candidate | 24.18 [22.24, 28.76] | -422.98 [-877.83, 970.83]    |
| drawing  | 512   | baseline  | 35.84 [33.57, 39.25] | -507.57 [-775.88, 2760.91]   |
| drawing  | 512   | candidate | 29.03 [27.31, 31.80] | 2653.75 [-3369.27, 3085.15]  |
| drawing  | 1024  | baseline  | 46.30 [38.69, 52.57] | -2239.29 [-5790.88, 2732.62] |
| drawing  | 1024  | candidate | 34.19 [32.22, 40.58] | 2414.44 [-5164.60, 4725.58]  |
| activity | 3     | baseline  | 21.47 [20.80, 24.44] | 222.77 [210.02, 231.03]      |
| activity | 3     | candidate | 22.08 [20.92, 24.99] | 214.21 [-893.43, 228.73]     |
