"""Validate and summarize raw emulator measurements; never relabel proxy metrics."""
import json
from pathlib import Path
from statistics import median

root = Path(__file__).with_name('evidence')

def percentile(values, fraction):
    values = sorted(values)
    return values[int((len(values) - 1) * fraction)]

def native(run):
    data = run['native']
    assert data['overflow'] == 0 and len(data['frames']) > 30
    assert data['frameMetric'] == 'choreographer-opportunities-not-presented-frames'
    intervals = [b[1] - a[1] for a, b in zip(data['frames'], data['frames'][1:])]
    allocated = int(data['after']['art']['art.gc.bytes-allocated']) - int(data['before']['art']['art.gc.bytes-allocated'])
    assert allocated >= 0, 'Invalid/reset ART counter is not an allocation result'
    return {
        'repetition': run['repetition'],
        'cpuMs': data['after']['cpuMs'] - data['before']['cpuMs'],
        'durationMs': data['after']['timeMs'] - data['before']['timeMs'],
        'artAllocatedBytes': allocated,
        'callbackCount': len(data['frames']),
        'callbackIntervalP50Ms': percentile(intervals, .5),
        'callbackIntervalP95Ms': percentile(intervals, .95),
        'callbackIntervalP99Ms': percentile(intervals, .99),
        'callbackIntervalMaxMs': max(intervals),
        'probeWorkMs': data['probeWorkMs'],
        'rssDeltaBytes': data['after']['memoryBytes'] - data['before']['memoryBytes'],
        **({'setterBurstMs': sum(run['setters']), 'preparationMs': sum(run['preparation'])} if 'setters' in run else {}),
    }

def aggregate(runs):
    return {'median': {key: median(run[key] for run in runs) for key in runs[0] if key != 'repetition'}, 'runs': runs}

inspector = json.loads((root / 'inspection-android-emulator.json').read_text())
combined = json.loads((root / 'combined-android-emulator.json').read_text())
for report, count in [(inspector, 12), (combined, 6)]:
    assert report['complete'] and len(report['runs']) == count
    assert report['environment']['physical'] is False
assert {run['repetition'] for run in combined['runs']} == {-1, 0, 1, 2, 3, 4}
for run in combined['runs']:
    assert len(run['phases']) == 3
    for phase in run['phases']:
        assert len(phase['values']) == 16
        assert all(abs(value - phase['expected']) < .1 for value in phase['values'])
summary = {
    'platform': 'Android API 36 arm64 emulator',
    'physicalHardware': False,
    'limitations': 'Exploratory emulator costs, not physical performance. Choreographer intervals are callback opportunities, not presented frames. ART counters exclude V8/native/GPU allocations. RSS is not PSS. No screen recording or simultaneous native test during collection.',
    'inspector': {},
    'combined16Views': aggregate([native(run) for run in combined['runs'] if run['repetition'] >= 0]),
}
for enabled in [False, True]:
    runs = [run for run in inspector['runs'] if run['repetition'] >= 0 and run['enabled'] == enabled]
    assert len(runs) == 5
    summary['inspector']['on' if enabled else 'off'] = aggregate([native(run) for run in runs])
(root / 'metrics-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
for label, result in [*summary['inspector'].items(), ('combined16Views', summary['combined16Views'])]:
    print(label, json.dumps(result['median']))
