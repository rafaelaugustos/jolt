# Android total CPU, PSS and report workers

This follows the [sampled playback audit](android-playback-efficiency.md) and [#65](https://github.com/rafaelaugustos/jolt/issues/65). The order is deliberate: attribute the remaining process cost, then move a measured, suitable application task off the UI thread. It does not introduce a RenderThread backend or move arbitrary application JavaScript automatically.

The new production behavior is confined to the demo's audit tooling. Its report writer now accumulates records, parses native frame JSON, serializes the growing report and writes its files in a NativeScript worker. Each write must be acknowledged before the next one is submitted. The UI runtime retains animation control and sends each record once. The worker terminates on completion, error, timeout, cancellation or screen disposal. This avoids an unbounded message queue and repeated transmission of the full report.

## Method and scope

The profiled release APK comes from clean commit `a75a9205a43be0d0387beb4f563f48aa9c92e425`, source SHA-256 `bb0b6b966da946199bf72c171a243950893e3b1d7b306b520dac196fa3d35d5a`. It uses NativeScript Core 9.1.3, Android runtime 9.1.1, webpack 5.101.3 and NativeScript webpack 5.0.38. The dedicated Android 15 / API 35 ARM64 emulator uses SwiftShader, 60 Hz and Animator scale 1×. There was no physical Android device available. Other host development remains a source of variation; no build or recording was launched during playback measurement windows.

Each case starts a fresh release process. `android-resource-profile.py` records external Perfetto scheduler activity, `dumpsys meminfo`, and `/proc/PID/smaps` when permitted. The app places an async trace marker around the exact work window and reads process/thread CPU clocks at its boundaries. `android-resource-report.py` clips scheduled intervals to that marker and rejects missing markers or reported trace data loss. Scheduler occupancy and CPU clocks are separate observations; their numbers need not match under virtualization.

- **Idle / playback:** 12 seconds without JS frame callbacks. Playback is the same native 0→160→0 DIP loop used by the earlier audit. A separate probe case estimates the observer cost.
- **Retention / discard:** four batches of 250 actual Jolt animations, stopped immediately. One case keeps all public handles; another drops them. A third extends discard to 20 batches / 5,000 animations. WeakRefs target the actual tracks handed to the native driver. Two requested JS/Java collections and event-loop turns precede each snapshot. The diagnostic retains its WeakRef bookkeeping until `held`, then clears it. GC requests do not guarantee immediate collection.
- **Report / worker:** six exports of the same **actual completed audit**, with 100 ms between writes. The input is read/parsed once and the complete JSON is serialized and written on each export. Both include the first read in the process/thread CPU window. Worker startup is measured separately and excluded from the export window; the worker's first request time includes its initial read. The main path's per-export durations exclude its earlier initial read, so compare the enclosing CPU windows rather than those individual request durations. Both paths write the same external output file.
- **Compile:** four batches of 250 actual spring-track compilations, without native playback. This checks whether ordinary curve preparation is the first offload target.

The main/worker export order is reversed in the second of three runs. Playback is repeated three times. Retention and compilation are diagnostic single runs, not confidence intervals. Raw traces, snapshots, per-case build identities and summaries are retained with the results; failed exploratory instrumentation is not pooled into final results.

## Findings

Three clean-process repetitions (median, with observed range):

| Six complete exports                                   |                UI thread |              Worker |
| ------------------------------------------------------ | -----------------------: | ------------------: |
| Main-thread CPU                                        | 104.45 ms (94.36–114.09) | 1.88 ms (1.69–2.49) |
| Total process CPU during export window                 |         130 ms (119–141) |    130 ms (122–153) |
| PSS before workload                                    |               92,234 KiB |          92,893 KiB |
| PSS after exports, worker still alive where applicable |              106,980 KiB |         123,563 KiB |
| PSS at quiet checkpoint, worker terminated             |              107,132 KiB |         115,384 KiB |

Worker startup took 17.21–21.27 ms (median 20.05 ms), before the export window. Its ready runtime added 3,906–4,186 KiB over its own baseline. These are checkpoint snapshots, not continuously measured peaks. The worker reduced main-thread CPU by about **98%** for this task. Total CPU ranges overlap with identical medians; **no total-CPU reduction is established**. Memory is higher in the worker case, including after termination at the measured quiet checkpoint. The optimization is responsive UI and bounded report ownership, not a PSS saving.

The three 12-second playback windows used 3,548 / 3,815 / 5,592 ms of process CPU, with 136.69–286.07 ms on the main thread. RenderThread accounted for **89.38–92.86%** of the app's scheduled CPU in those exact trace windows. Idle used 14 ms of process CPU and 0.56 ms of main-thread CPU. The separate native-probe case used 4,014 ms of process CPU, 189.53 ms of main-thread CPU and 35.20 ms of measured probe work over 689 callbacks. This single observer check is not an overhead correction. RenderThread activity and SwiftShader make this emulator unsuitable for drawing conclusions about physical GPU efficiency.

With 1,000 stopped handles retained, PSS rose from 92,965 to 108,941 KiB at `held`, and remained 109,109 KiB at `quiet`. Dropping all handles during the corresponding workload gave 92,991 → 108,718 → 108,822 KiB. In the 5,000-animation discard run, PSS rose mostly in the first batches: 92,470 before, 107,877 after 250 animations, 109,745 after 1,500, 110,388 after 5,000 and 110,400 at quiet. This approaches a plateau in this finite test; it is not proof of bounded memory over every long-running application scenario.

Compiling 1,000 real spring tracks produced 64,388 sampled points and used 26.07 ms of main-thread CPU across four batches. Batch wall times were 10.30 / 6.79 / 4.43 / 4.60 ms. This does not justify creating a worker per ordinary animation; the much larger repeated report was selected as the concrete offload target.

[Run 1 summary](results/resource-profile/2026-11-03-run-1-summary.json), [run 2 summary](results/resource-profile/2026-11-03-run-2-summary.json), [run 3 summary](results/resource-profile/2026-11-03-run-3-summary.json), and [APK/input identity](results/resource-profile/2026-11-03-build.json). The corresponding `.tar.gz` files retain every trace, raw memory snapshot, report, full mapping summary and Perfetto configuration. The exact [input audit](results/resource-profile/2026-11-03-export-input.json.gz) is retained for reproduction.

The baseline includes code pages, Java heap, native allocator pages, stacks and private anonymous mappings. For example, the retention case began with 25,080 KiB of code PSS, 19,996 KiB of native-heap PSS and 32,532 KiB of private-other PSS. These categories are not JS heap size. The largest before/after mapping changes were anonymous writable pages (+10,020 KiB), APK pages (+4,608 KiB) and the primary native allocator (+1,410 KiB). The discard case had similar changes (+9,940 / +4,608 / +1,470 KiB).

That evidence narrows the investigation but does not identify every anonymous allocation as a V8 object, classify all growth as cache, or prove absence of other leaks. Requested collection made all tracked animation tracks collectable at the `held` checkpoint, even with 1,000 public handles retained. At intermediate snapshots the most recent 250 tracks were still alive; collection was not immediate. PSS remained elevated after handles and diagnostic WeakRefs were dropped. A physical-device allocation/heap profile is still required for object-level attribution and long-session validation.

The native View property update still needs the UI thread. RenderThread CPU dominance in this emulator does not mean `ObjectAnimator` has become independent of that thread. Moving expensive report work to a worker addresses a demonstrated source of blocking, while the earlier intentional 300 ms main-thread block remains a negative control.

## Reproduce

Build/install the normal release demo as described in [android-playback-efficiency.md](android-playback-efficiency.md). Use a dedicated explicit device ID. Root is optional and only enables `smaps`; ordinary production devices may deny it. Perfetto availability/permissions also depend on the device.

```sh
# First create a real report (or use the retained complete report):
python3 benchmarks/android-playback-efficiency.py YOUR_SERIAL /tmp/jolt-audit
adb -s YOUR_SERIAL push /tmp/jolt-audit/report.json \
  /sdcard/Android/data/org.nativescript.jolt.benchmark/files/profile-input.json

python3 benchmarks/android-resource-profile.py YOUR_SERIAL /tmp/jolt-resources-1 \
  idle playback report report-worker retention retention-drop retention-cycles compile
python3 benchmarks/android-resource-profile.py YOUR_SERIAL /tmp/jolt-resources-2 \
  report-worker report playback playback-probe
python3 benchmarks/android-resource-profile.py YOUR_SERIAL /tmp/jolt-resources-3 \
  playback report report-worker

# Official Perfetto trace_processor executable or Python launcher:
python3 benchmarks/android-resource-report.py /tmp/jolt-resources-1 /path/to/trace_processor \
  > /tmp/jolt-resources-1/summary.json

# Separate run, with real touches and no performance profiler:
python3 benchmarks/report-export-record-android.py YOUR_SERIAL \
  /tmp/jolt-audit/report.json /tmp/jolt-export/report-export.mp4
```

The English export scene launches with `--es report-export true`; Portuguese UI uses `--es lang pt`. Its **20 consecutive exports** deliberately make blocking visible. This visual workload differs from the six spaced exports used for profiling and must not be presented as the cost of one normal save. Worker startup is shown before motion starts. The recorder verifies the exported JSON equals the complete input, native worker/main thread IDs differ, a completed worker thread disappears and cancellation is not replaced by a late success.

The reviewed English H.264 recording `report-export-android.mp4` keeps the first 11 seconds of source footage at the original timestamps; only the idle tail is removed. The full file decodes without errors. Frames across the entire published clip were inspected: the UI export pauses the native block, the worker export allows movement, the results remain readable, and the third attempt is cancelled during worker startup. The recorded UI/worker batch showed 305.51 / 26.55 ms maximum native callback gaps and 0 / 192.67 px of native movement during work. These are visual-run diagnostics, separate from the six-export profiles. The [UI](results/resource-profile/2026-11-03-export-video-main.json), [worker](results/resource-profile/2026-11-03-export-video-worker.json) and [cancellation/termination](results/resource-profile/2026-11-03-export-video-cancel.json) records are retained.

The recording is embedded in EN/PT/ES/ZH guides with emulator captions, preserving the earlier native playback and busy-JavaScript recordings. PR attachments use the English recording only.

## Complete streaming audit validation

The [complete raw audit](results/resource-profile/2026-11-03-streamed-audit.json.gz) and [summary](results/resource-profile/2026-11-03-streamed-audit-summary.json) validate the new writer on the same clean release build. All **240,280 native comparisons** matched exactly, all **40 microbenchmark batches** and **six 30-second playback runs** completed, and all native frame samples were retained without overflow. The worker started in 23.17 ms on native thread 10254; the UI runtime used thread 10221. The recorder separately verified full JSON equality after real worker export, completion-thread termination and no late success after startup cancellation. Unit tests cover bounded in-flight writes, startup/write cancellation, stale replies, worker errors and timeouts.

This validation keeps its results separate from the earlier non-streaming audit: an idle report worker and its accumulated history change whole-process memory residency. It is not a new controlled total-PSS comparison.

References: [NativeScript worker isolation and lifecycle](https://docs.nativescript.org/guide/multithreading), [Android memory measurement](https://developer.android.com/tools/dumpsys#meminfo), and [Perfetto Trace Processor](https://perfetto.dev/docs/analysis/trace-processor).

## Integration on current main

The follow-up branch is based on main `86ba72b`, after #387 and #392 merged. The measured engine, Android curve factory, diagnostic and worker sources are unchanged from the profiled build. Release compilation and real native UI/worker export, output equality, completed-thread termination and cancellation were revalidated on clean commit `dafc1d6`; the [integration record](results/resource-profile/2026-11-03-main-integration.json) retains the APK identity and results. The current base also passed 1,691 tests in 112 files, library build, typechecks, portable-core, format, documentation media and documentation build checks.

This is a behavior/integration check, not another controlled profile. Its observed callback gaps were larger than in the published visual run, so it does not strengthen a smooth-frame or total-performance claim. Earlier measurements retain their original build identity and are not pooled with this new APK.

## Português

Primeiro foi investigado o custo total; depois foi movida a exportação real dos relatórios para um worker. A thread da UI mantém o controle das animações. O worker acumula os registros, interpreta as amostras, serializa e grava os arquivos, com uma mensagem pendente por vez e encerramento em sucesso, erro, cancelamento ou saída da tela.

O objetivo comprovável é liberar a thread principal durante essa tarefa. O worker possui outro runtime e aumenta o consumo de memória enquanto está ativo; sua inicialização também custa tempo. Esses dados de emulador não comprovam redução da CPU total, do PSS ou melhora de FPS no aplicativo inteiro. Eles também não tornam a reprodução do Android imune a bloqueios da thread principal.

Os testes de retenção mostram tracks coletáveis mesmo com handles encerrados ainda guardados, mas o PSS continua elevado. As regiões anônimas e as páginas do APK explicam categorias do crescimento, sem identificar todos os objetos responsáveis. A comparação em aparelhos físicos e a investigação de alocações em sessões longas continuam necessárias.
