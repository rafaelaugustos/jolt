# JavaScript allocation profile results

Separate fixed JSON workload on physical ASUS ZenFone 3, Android 8.0.0. Each row is one fresh process; six batches, first excluded. This is not a cross-framework JavaScript ranking. Recording was off.

| Profile | Run | Batch wall time, median (ms) | Batch process CPU, median (ms) | Post-workload PSS (MiB) |
| --- | ---: | ---: | ---: | ---: |
| default | 1 | 421.61 | 426 | 120.57 |
| size | 1 | 592.38 | 743 | 102.51 |
| size | 2 | 591.06 | 742 | 102.06 |
| default | 2 | 417.33 | 420 | 121.15 |

The size profile reduced memory but increased elapsed time and process CPU in this workload. It remains an explicit experiment, not a recommended default. The APKs have identical entries except the NativeScript runtime configuration. Raw batch reports, source snapshots, build hashes and pre/post battery records are retained here. Temperature guards do not prove absence of throttling.

Revalidate with `python3 benchmarks/comparison/report-js-profile.py RESULTS_DIRECTORY`.
