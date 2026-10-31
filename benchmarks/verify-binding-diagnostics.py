"""Bounded retention and OS-input onset observations. Neither is a photon/heap-leak proof."""
import argparse
import gzip
import importlib.util
import json
import math
from pathlib import Path
from binding_thermal import check_thermal

def module(filename):
    spec = importlib.util.spec_from_file_location(filename, Path(__file__).with_name(filename+'.py'))
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result

input_validator = module('verify-binding-input')

def stats(values):
    assert values and all(math.isfinite(v) for v in values)
    values = sorted(values)
    return dict(n=len(values), min=values[0], p50=values[math.ceil(len(values)*.5)-1],
                p95=values[math.ceil(len(values)*.95)-1], max=values[-1])

def input_latency(report, allow_unavailable_thermal=False):
    base = input_validator.verify(report, allow_unavailable_thermal=allow_unavailable_thermal)
    assert report['recording'] is False and not report.get('error')
    assert len(report['build']['commit']) == 40
    trace = report['touchTrace']
    assert trace['columns'] == ['eventMs', 'dispatchMs', 'action', 'x', 'y']
    assert trace['overflow'] == 0 and trace['clock'] == 'uptime-ms'
    assert trace['delayMs'] == report['inputDelayMs'] and trace['delayMs'] in (0, 40, 200)
    assert trace['workMs'] >= 0 and math.isfinite(trace['workMs'])
    events = trace['events']; assert 10 < len(events) <= 4096
    for e in events:
        assert len(e) == 5 and all(type(v) in (int, float) and math.isfinite(v) for v in e)
        assert e[0] > 0 and e[1] >= e[0] - 1 and e[2] in (0, 1, 2, 3), 'Invalid input clock/action'
    assert all(a[1] <= b[1] and a[0] <= b[0] for a,b in zip(events, events[1:]))
    assert report['native']['before']['timeMs'] <= events[0][1]
    assert events[-1][1] <= report['native']['after']['timeMs'], 'Input outside sampled window'
    gestures = []; current = None
    for e in events:
        if e[2] == 0:
            assert current is None, 'Nested pointer stream'
            current = [e]
        else:
            assert current is not None, 'Input without DOWN'
            current.append(e)
            if e[2] in (1, 3):
                assert e[2] == 1, 'Cancelled input'
                gestures.append(current); current = None
    assert current is None and len(gestures) == 6, 'Missing gesture pair'
    frames = report['native']['frames']; axis = 5 if report['input'] == 'header-native' else 3
    observations = []
    for i, gesture in enumerate(gestures):
        down, up = gesture[0], gesture[-1]
        move = next((e for e in gesture if e[2] == 2 and (e[3] != down[3] or e[4] != down[4])), None)
        assert move, 'No pointer displacement'
        prior = [f for f in frames if f[0] < down[0]][-3:]
        assert len(prior) == 3 and prior[-1][0] - prior[0][0] >= 10, 'Missing pre-input samples'
        stable = max(f[axis] for f in prior) - min(f[axis] for f in prior) <= .02
        first = next((f for f in frames if move[1] <= f[0] <= up[1]+100 and abs(f[axis]-prior[-1][axis]) > .02), None)
        row = dict(gesture=i, downMs=down[0], firstMoveMs=move[0], firstMoveDispatchMs=move[1],
                   preInputStable=stable, baseline=prior[-1][axis], responseMs=first[0] if first else None)
        if first and stable:
            row['eventToPoseMs'] = first[0]-move[0]
            row['dispatchToPoseMs'] = first[0]-move[1]
            assert row['eventToPoseMs'] >= -1 and row['dispatchToPoseMs'] >= 0
        else: row['excludedReason'] = 'pre-input output moving' if not stable else 'no output change within gesture'
        observations.append(row)
    valid = [r for r in observations if 'eventToPoseMs' in r]
    assert len(valid) >= 3, 'Insufficient stable gesture onsets'
    if trace['delayMs']:
        assert min(r['dispatchToPoseMs'] for r in valid) >= trace['delayMs'] - 1, 'Known native delay not observed'
    return dict(**base, delayMs=trace['delayMs'], inputEvents=len(events), probeWorkMs=trace['workMs'],
                deliveryAgeMs=stats([max(0,e[1]-e[0]) for e in events if e[2] == 2]),
                eventToNativePoseMs=stats([r['eventToPoseMs'] for r in valid]),
                dispatchToNativePoseMs=stats([r['dispatchToPoseMs'] for r in valid]), observations=observations)

def input_control(baseline, delayed, allow_unavailable_thermal=False):
    normal = input_latency(baseline, allow_unavailable_thermal)
    control = input_latency(delayed, allow_unavailable_thermal)
    assert normal['delayMs'] == 0 and control['delayMs'] > 0
    assert baseline['device']['model'] == delayed['device']['model']
    assert baseline['device']['os'] == delayed['device']['os']
    assert baseline['build']['driverSha256'] == delayed['build']['driverSha256']
    assert baseline['input'] == delayed['input'] == 'drag-js'
    # A delay inside existing recognition time can satisfy a lower bound without
    # changing the output. Reject such an inconclusive calibration explicitly.
    floor = control['delayMs'] - 1
    assert normal['dispatchToNativePoseMs']['max'] < floor, 'Baseline already exceeds control delay'
    assert control['dispatchToNativePoseMs']['min'] >= floor
    return dict(delayMs=control['delayMs'], baseline=normal['dispatchToNativePoseMs'],
                delayed=control['dispatchToNativePoseMs'])

def retention(report, allow_unavailable_thermal=False):
    assert report['completed'] is True and not report.get('error') and report['mode'] == 'retention'
    assert report['schema'] == 1 and report['recording'] is False
    assert type(report['device']['physical']) in (bool, int) and report['device']['physical'] == 1
    assert report['build']['dirty'] is False
    assert len(report['build']['commit']) == 40 and report['build']['bundleMode'] == 'production'
    assert report['session'] and report['platform'] in ('Android','iOS')
    check_thermal(report['finalResources'], report['device'], allow_unavailable_thermal)
    data = report['retention']
    for k,v in dict(views=64,properties=3,layers=2,warmups=3,measuredCycles=12).items(): assert data[k] == v
    assert data['retainedControl']['watched'] == data['retainedControl']['alive'] == 1
    assert data['releasedControl']['watched'] == 1 and data['releasedControl']['alive'] == 0
    rounds = data['rounds']; assert [r['cycle'] for r in rounds] == list(range(15))
    keys = ['javaUsedBytes', 'nativeAllocatedBytes'] if report['platform'] == 'Android' else ['mallocInUseBytes', 'mallocBlocksInUse', 'mallocReservedBytes']
    for r in rounds:
        assert r['warmup'] == (r['cycle'] < 3)
        assert math.isfinite(r['startMs']) and r['startMs'] >= 0
        assert r['loaded']['heap']['watched'] == r['loaded']['heap']['alive'] == 64
        assert r['collected']['heap']['watched'] == 64 and r['collected']['heap']['alive'] == 0
        assert r['uncollected']['heap']['watched'] == 64
        assert 0 <= r['uncollected']['heap']['alive'] <= 64
        assert r['live'] == dict(nodes=0,clock=0)
        assert r['idle']['atMs'] - r['disposed']['atMs'] >= 640
        for k in ('activeTracks','pendingFrames','pendingTimers','overflow'): assert r['idle'][k] == 0
        for k in ('plays','frameRequests','frameCallbacks','timerCallbacks','endCallbacks'):
            assert r['idle'][k] == r['disposed'][k], 'Work at rest'
        times = []
        for phase in ('loaded','uncollected','collected'):
            state = r[phase]; times.append(state['heap']['timeMs'])
            check_thermal(state['resources'], report['device'], allow_unavailable_thermal)
            assert state['resources']['memoryBytes'] > 0
            assert all(type(state['heap'][k]) in (int,float) and math.isfinite(state['heap'][k]) and state['heap'][k] > 0 for k in keys)
        assert times == sorted(times) and times[2]-times[1] >= 590
    measured = rounds[3:]
    heap = {}
    for key in keys:
        values = [r['collected']['heap'][key] for r in measured]
        heap[key] = dict(**stats(values), firstToLast=values[-1]-values[0],
                         loaded=stats([r['loaded']['heap'][key] for r in measured]),
                         beforeRequestedGC=stats([r['uncollected']['heap'][key] for r in measured]))
    return dict(platform=report['platform'], cycles=len(rounds), releasedViews=64*len(rounds),
                heap=heap, note='Bounded post-collection process allocators and weak native views; not an unbounded leak proof or total V8/GPU heap.')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('report', type=Path)
    p.add_argument('--allow-unavailable-thermal', action='store_true')
    p.add_argument('--baseline', type=Path, help='Compare a delayed input report against its no-delay capture')
    args=p.parse_args()
    raw = gzip.decompress(args.report.read_bytes()) if args.report.suffix == '.gz' else args.report.read_bytes()
    report=json.loads(raw)
    if args.baseline:
        baseline_raw = gzip.decompress(args.baseline.read_bytes()) if args.baseline.suffix == '.gz' else args.baseline.read_bytes()
        result = input_control(json.loads(baseline_raw), report, args.allow_unavailable_thermal)
    else:
        result = retention(report,args.allow_unavailable_thermal) if report.get('mode')=='retention' else input_latency(report,args.allow_unavailable_thermal)
    print(json.dumps(result,indent=2))
