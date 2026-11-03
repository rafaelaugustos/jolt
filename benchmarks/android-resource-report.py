"""Analyze the app-marked Perfetto intervals and external memory snapshots.
Usage: python3 benchmarks/android-resource-report.py DIRECTORY TRACE_PROCESSOR
TRACE_PROCESSOR is the official executable (or downloaded Python launcher).
"""
from collections import Counter
import csv
import io
import json
from pathlib import Path
import re
import subprocess
import sys

root, processor = Path(sys.argv[1]), sys.argv[2]
tool = [sys.executable, processor] if Path(processor).read_bytes()[:2] == b'#!' else [processor]

def query(trace, sql):
    value = subprocess.check_output(tool + ['query', '--format', 'csv', '--quiet', str(trace), sql], text=True)
    return list(csv.DictReader(io.StringIO(value)))

def memory(path):
    result = Counter()
    name = ''
    for line in path.read_text().splitlines():
        if re.match(r'^[0-9a-f]+-[0-9a-f]+ ', line):
            fields = line.split(maxsplit=5)
            name = fields[5] if len(fields) == 6 else '(anonymous ' + fields[1] + ')'
            if '/data/app/' in name:
                name = name.rsplit('/', 1)[-1]
        elif line.startswith('Pss:'):
            result[name] += int(line.split()[1])
    return result

results = []
for path in sorted(root.glob('*/report.json')):
    report = json.loads(path.read_text())
    assert report['phase'] == 'done'
    mode = report['mode']
    assert re.fullmatch('[a-z-]+', mode)
    trace = path.parent / 'trace.pftrace'
    window = query(trace, f"SELECT ts,dur FROM slice WHERE name='jolt-profile:{mode}'")
    assert len(window) == 1 and int(window[0]['dur']) > 0, window
    losses = query(trace, "SELECT name,value FROM stats WHERE severity='data_loss' AND value>0")
    assert not losses, losses
    threads = query(trace, f"""WITH w AS (
      SELECT ts,dur FROM slice WHERE name='jolt-profile:{mode}'
    ) SELECT t.name,t.tid,
      SUM(MAX(0,MIN(s.ts+s.dur,w.ts+w.dur)-MAX(s.ts,w.ts)))/1e6 AS cpu_ms
    FROM sched_slice s JOIN thread t USING(utid) JOIN process p USING(upid) CROSS JOIN w
    WHERE p.name='org.nativescript.jolt.benchmark' AND s.dur>0
      AND s.ts<w.ts+w.dur AND s.ts+s.dur>w.ts
    GROUP BY t.utid ORDER BY cpu_ms DESC""")
    for row in threads:
        row['cpu_ms'] = float(row['cpu_ms'])
        row['tid'] = int(row['tid'])
    total = sum(row['cpu_ms'] for row in threads)
    before, after = memory(path.parent / 'before-smaps.txt'), memory(path.parent / 'after-smaps.txt')
    results.append({
        'mode': mode, 'build': report['build'], 'window': window[0],
        'processCpuMs': report['end']['cpuMs'] - report['begin']['cpuMs'],
        'mainThreadCpuMs': report['end']['threadCpuMs'] - report['begin']['threadCpuMs'],
        'scheduledCpuMs': total,
        'renderThreadShare': sum(row['cpu_ms'] for row in threads if row['name'] == 'RenderThread') / total if total else None,
        'threads': threads, 'result': report['result'], 'snapshots': report['snapshots'],
        'pssMappingsBeforeKiB': dict(before.most_common()),
        'pssMappingsAfterKiB': dict(after.most_common()),
        'pssMappingDeltaKiB': dict(sorted(((name, after[name] - before[name]) for name in before.keys() | after.keys()), key=lambda x: x[1], reverse=True)),
    })
print(json.dumps({'cases': results, 'limits': [
    'Emulator, release build; profiling results do not establish physical-device performance.',
    'Scheduler occupancy and process/thread CPU clocks are different observations; virtualization adds variation.',
    'Memory snapshots and requested GC are outside playback timing, but part of retention workloads.',
    'Anonymous mappings do not identify individual V8 objects or prove that all growth is cache.',
    'The diagnostic retains WeakRefs until the held checkpoint, then clears its own bookkeeping.',
    'Worker startup is separately measured; the export interval excludes startup and includes its first input read.',
]}, indent=2))
