"""Validate saved allocation-profile samples and regenerate their summary table."""
import hashlib
import json
from pathlib import Path
import statistics
import sys

from physical import pss_kib

root = Path(sys.argv[1])
metadata = json.loads((root/'summary.json').read_text())
assert 'failure' not in metadata
for filename, key in [('collector.py', 'collectorSha256'), ('workload.ts', 'workloadSha256')]:
    assert hashlib.sha256((root/filename).read_bytes()).hexdigest() == metadata[key]
runs = metadata['runs']
repetitions = max(row['repetition'] for row in runs)
assert repetitions >= 2 and len(runs) == repetitions * 2
assert {(r['profile'], r['repetition']) for r in runs} == {
    (profile, repetition) for profile in ('default', 'size') for repetition in range(1, repetitions+1)}
lines = ['# JavaScript allocation profile results', '',
         'Separate fixed JSON workload on physical ASUS ZenFone 3, Android 8.0.0. '
         'Each row is one fresh process; six batches, first excluded. '
         'This is not a cross-framework JavaScript ranking. Recording was off.', '',
         '| Profile | Run | Batch wall time, median (ms) | Batch process CPU, median (ms) | Post-workload PSS (MiB) |',
         '| --- | ---: | ---: | ---: | ---: |']
for row in runs:
    folder = root/f"{row['repetition']}-{row['profile']}"
    report = json.loads((folder/'workload.json').read_text())
    assert report['status'] == 'complete' and report['processId'] == row['processId']
    assert report['rows'] == 4000 and report['iterations'] == 10 and report['warmupBatches'] == 1
    assert len(report['samples']) == 6
    assert ('optimize_for_size' in report['v8Flags']) == (row['profile'] == 'size')
    assert all(sample['checksum'] == report['expectedChecksum'] for sample in report['samples'])
    assert row['medianWallMs'] == statistics.median(s['wallMs'] for s in report['samples'][1:])
    assert row['medianProcessCpuMs'] == statistics.median(s['processCpuMs'] for s in report['samples'][1:])
    assert row['pssAfterMiB'] == pss_kib((folder/'memory-after.txt').read_text())/1024
    assert row['batteryBeforeC'] <= 39 and row['batteryAfterC'] <= 40
    lines.append(f"| {row['profile']} | {row['repetition']} | {row['medianWallMs']:.2f} | {row['medianProcessCpuMs']:.0f} | {row['pssAfterMiB']:.2f} |")
lines += ['', 'The size profile reduced memory but increased elapsed time and process CPU in this workload. '
          'It remains an explicit experiment, not a recommended default. The APKs have identical entries '
          'except the NativeScript runtime configuration. Raw batch reports, source snapshots, build hashes '
          'and pre/post battery records are retained here. Temperature guards do not prove absence of throttling.', '',
          'Revalidate with `python3 benchmarks/comparison/report-js-profile.py RESULTS_DIRECTORY`.']
(root/'README.md').write_text('\n'.join(lines)+'\n')
print('PASS', len(runs), 'fresh-process runs, source hashes, checksums, PSS and recomputed batch medians')
