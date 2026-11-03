"""Summarize raw audit JSON without discarding outliers. Stdout is JSON.
Usage: python3 benchmarks/android-playback-efficiency-report.py REPORT_JSON_OR_GZ
"""
import gzip
import json
import math
from pathlib import Path
from statistics import median
import sys
path = Path(sys.argv[1])
with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as file:
    report = json.load(file)
assert report['phase'] == 'done', 'An incomplete audit cannot be summarized as a result'
def distribution(values):
    return {'median': median(values), 'min': min(values), 'max': max(values), 'runs': len(values)}
batches = []
for points in [2, 41, 241, 601]:
    for compact in [False, True]:
        rows = [row for row in report['batches'] if row['points'] == points and row['compact'] == compact]
        assert len(rows) == 5
        batches.append({'points': points, 'compact': compact, 'animators': 300, 'evaluations': 36000,
            **{name: distribution([row[name] for row in rows]) for name in ['setupMs', 'setupCpuMs', 'evaluationMs', 'evaluationCpuMs']},
            'retainedJavaDeltaBytes': distribution([row['retained']['javaUsedBytes'] - row['before']['javaUsedBytes'] for row in rows]),
            'retainedPssDeltaKiB': distribution([row['retained']['pssKiB'] - row['before']['pssKiB'] for row in rows]),
            'releasedJavaDeltaBytes': distribution([row['released']['javaUsedBytes'] - row['before']['javaUsedBytes'] for row in rows]),
        })
playback = []
for compact in [False, True]:
    rows = [row for row in report['playback'] if row['compact'] == compact]
    assert len(rows) == 3
    samples = []
    for row in rows:
        frame = row['frames']
        assert not frame['overflow']
        gaps = sorted(b[0] - a[0] for a, b in zip(frame['frames'], frame['frames'][1:]))
        samples.append({'round': row['round'],
            'cpuMs': frame['after']['cpuMs'] - frame['before']['cpuMs'],
            'elapsedMs': frame['after']['timeMs'] - frame['before']['timeMs'],
            'callbackGapMedianMs': median(gaps), 'callbackGapP95Ms': gaps[math.ceil(len(gaps) * .95) - 1],
            'callbackGapMaxMs': max(gaps), 'callbacks': len(frame['frames']),
            'idlePssKiB': row['before']['pssKiB'], 'releasedPssKiB': row['released']['pssKiB'],
            'probeCpuWallMs': frame['probeWorkMs'],
        })
    playback.append({'compact': compact, 'trials': samples,
        'cpuMs': distribution([row['cpuMs'] for row in samples]),
        'maximumCallbackGapMs': distribution([row['callbackGapMaxMs'] for row in samples]),
    })
print(json.dumps({'build': report['build'], 'environment': report['environment'], 'checks': report['checks'],
    'batches': batches, 'playback': playback, 'retention': report['retention'],
    'limits': ['Emulator, release/production; not physical-device evidence.',
      'Native evaluation benchmark excludes drawing and JS/native submission.',
      'GC is requested; heap deltas are retained-memory observations, not allocation counts.',
      'Memory snapshots are outside timing windows; PSS is whole-process memory.',
      'Choreographer gaps are callback opportunities, not presented-frame deadlines.',
      'The old/native reference and compact path share the same updated engine in playback trials.']}, indent=2))
