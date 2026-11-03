"""Validate a complete physical collection and report run-level medians and ranges."""
import hashlib
import gzip
import json
from pathlib import Path
import statistics
import sys

from physical import analyze_probe, pss_kib

root = Path(sys.argv[1])
metadata = json.loads((root/'metadata.json').read_text())
identity = metadata['identity']
expected = {(app,phase,repetition) for app in identity['selectedApps']
            for phase in identity['selectedPhases'] for repetition in range(1,identity['repetitions']+1)}
runs = metadata['runs']
assert len(runs) == len(expected) and {(r['app'],r['phase'],r['repetition']) for r in runs} == expected
for filename,key in [('collector.py','collectorSha256'),('probe.c','probeSourceSha256')]:
    assert hashlib.sha256((root/filename).read_bytes()).hexdigest() == identity[key]
for run in runs:
    folder = root/f"{run['repetition']}-{run['phase']}-{run['app']}"
    assert json.loads((folder/'summary.json').read_text()) == run
    raw = folder/'probe.txt'
    payload = raw.read_bytes() if raw.exists() else gzip.decompress((folder/'probe.txt.gz').read_bytes())
    assert hashlib.sha256(payload).hexdigest() == run['probeOutputSha256']
    derived = analyze_probe(payload.decode())
    for key,value in derived.items(): assert run[key] == value, (folder,key)
    assert pss_kib((folder/'memory-before.txt').read_text()) == run['pssBeforeKiB']
    assert pss_kib((folder/'memory-after.txt').read_text()) == run['pssAfterKiB']
    assert run['batteryBeforeC'] <= 39 and run['batteryAfterC'] <= 40

def spread(values):
    return {'n':len(values),'median':statistics.median(values),'min':min(values),'max':max(values)}

rows = []
for phase in identity['selectedPhases']:
    for app in identity['selectedApps']:
        selected = [r for r in runs if (r['app'],r['phase']) == (app,phase)]
        row = {'app':app,'phase':phase,'runs':len(selected)}
        for key in ('cpuSecondsPer30Seconds','windowSeconds','batteryBeforeC','batteryAfterC','presentedFrames'):
            row[key] = spread([r[key] for r in selected])
        row['pssAfterMiB'] = spread([r['pssAfterKiB']/1024 for r in selected])
        row['pssBeforeMiB'] = spread([r['pssBeforeKiB']/1024 for r in selected])
        for key in ('presentationGapMs','frameReadyToPresentMs'):
            row[key] = {stat:spread([r[key][stat] for r in selected]) for stat in ('p50','p95','p99','max')}
        rows.append(row)
failures = [str(p.relative_to(root)) for p in sorted(root.glob('incomplete/*/failure.json'))]
result = {'scope':metadata['scope'],'identity':identity,'aggregation':'Median and range of run-level statistics; no pooled frame percentile.',
          'rows':rows,'failedAttempts':failures,'temperatureGuard':metadata['temperatureGuard'],'method':metadata['method']}
(root/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
def cell(value): return f"{value['median']:.2f} ({value['min']:.2f}–{value['max']:.2f})"
device = identity['device']
lines = ['# Physical Android results','',
         f"{device['ro.product.manufacturer']} {device['ro.product.model']}, Android {device['ro.build.version.release']}. Release APKs; {identity['repetitions']} runs per stack/phase, {identity['windowSeconds']} seconds each, five seconds of warmup. Screen recording was off. Values are **median (minimum–maximum)** of run-level statistics.",'',
         '| Phase | App | CPU seconds / 30 s | Pre-run PSS (MiB) | Post-run PSS (MiB) | Presentation gap p95 (ms) | Maximum presentation gap (ms) | Frame-ready→present p50 (ms) |',
         '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for row in rows:
    lines.append('| '+' | '.join([row['phase'],row['app'],cell(row['cpuSecondsPer30Seconds']),cell(row['pssBeforeMiB']),cell(row['pssAfterMiB']),
                                  cell(row['presentationGapMs']['p95']),cell(row['presentationGapMs']['max']),cell(row['frameReadyToPresentMs']['p50'])])+' |')
lines += ['', 'CPU comes from process user+system counters with the device’s reported clock-tick resolution and is normalized by the measured interval. PSS includes the whole process and graphics allocations. SurfaceFlinger actual-present fences establish cadence; frame-ready→present is **not** queue→present, touch-to-pixel, or physical panel scanout. Do not combine these latency numbers with the emulator Perfetto table.', '',
          'The native probe schedules inputs on the phone and polls presentation history every 500 ms. Every adjacent poll must overlap the previous history; missing history fails validation. Observer work runs outside the measured process but can affect device scheduling. Battery temperature guards and cooldown do not prove the absence of thermal throttling. This is one older physical device, not an Android-wide ranking.', '',
          'The app-runtime and UI-thread block phases have different meanings across stacks. NativeScript application JS shares the Android UI thread; Reanimated application JS is separate from UI worklets.', '',
          f"Failed/incomplete attempts with a retained failure record: {len(failures)}. These are not successful timing samples. See `incomplete/` and `summary.json` for their evidence.", '',
          'Raw probe output, process dumps, device/build identities, collector/probe source, per-run summaries and SHA-256 integrity checks are retained alongside this report. Reproduce with `python3 benchmarks/comparison/report-physical.py RESULTS_DIRECTORY`.']
(root/'README.md').write_text('\n'.join(lines)+'\n')
print('PASS',len(runs),'complete physical runs, source/output integrity, CPU/PSS and presentation-history validation')
