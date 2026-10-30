"""Validate measured workloads, not performance promises. Simulator timings are never budgets."""
import argparse
import gzip
import json
import math
from pathlib import Path


def expected_cases():
    result = {}
    def add(identifier, path, views, properties, layers=0, playback='finite', observe=False):
        result[identifier] = dict(id=identifier, path=path, views=views, properties=properties,
                                  layers=layers, playback=playback, observe=observe)
    for count in (1, 16, 64, 200):
        add(f'value-{count}-x', 'value', count, 1)
    for count in (16, 64, 200):
        add(f'value-{count}-x-scale', 'value', count, 3)
    for path in ('value', 'view'):
        for layers in (2, 4, 8):
            add(f'{path}-16-layers-{layers}', path, 16, 3, layers)
    for path in ('value', 'view'):
        add(f'{path}-64-loop', path, 64, 3, 2, 'loop')
        for views in (1, 16, 64):
            add(f'{path}-{views}-window', path, views, 3, 2, 'window')
    add('value-64-observed', 'value', 64, 3, observe=True)
    return result


CASES = expected_cases()


def finite(number, minimum=0):
    assert type(number) in (float, int) and math.isfinite(number) and number >= minimum, number


def summary(numbers):
    assert numbers
    ordered = sorted(numbers)
    return dict(n=len(numbers), min=ordered[0], p50=ordered[math.ceil(len(numbers)*.5)-1],
                p95=ordered[math.ceil(len(numbers)*.95)-1], max=ordered[-1])


def resources(value):
    for name in ('timeMs', 'cpuMs', 'memoryBytes'):
        finite(value[name])
    assert value['memoryMetric'] in ('phys_footprint', 'rss')
    assert value['thermalState'] == 0 and value['lowPowerMode'] is False


def verify(report, allow_simulator=False, case=None, allow_dirty=False):
    assert report['schema'] == 1 and report['completed'] is True and not report.get('error')
    assert report['session'] and report['startedAt']
    assert report['platform'] in ('iOS', 'Android')
    assert report['device']['physical'] is True or allow_simulator, 'Physical hardware required for acceptance'
    assert report['device']['model'] and report['device']['os'] and report['device']['osBuild']
    finite(report['device']['maximumRefreshHz'], 1)
    assert report['build']['bundleMode'] == 'production'
    assert report['build']['dirty'] is False or allow_dirty, 'Build a committed source snapshot'
    assert len(report['build']['commit']) == 40
    assert report['build']['jolt'] and report['build']['core'] and report['build']['runtime']
    if report['platform'] == 'iOS':
        assert report['device']['reduceMotion'] is False
    else:
        assert report['device']['animatorScale'] == 1
    expected = [case] if case else list(CASES)
    assert report['selected'] == expected
    assert [entry['workload']['id'] for entry in report['cases']] == expected, 'Missing/duplicate workload'
    assert report['settings'] == dict(warmups=2, preparations=7, trials=3, finiteDurationMs=1800,
        finiteWindowMs=2200, endlessWindowMs=8800, idleWindowMs=600, baseX=24, baseScale=1.25)
    result = {}
    for entry in report['cases']:
        item = entry['workload']
        assert item == CASES[item['id']], 'Workload changed'
        resources(entry['before']); resources(entry['afterUnmount'])
        prep = entry['preparation']
        assert len(prep) == 8 and prep[0]['kind'] == 'first-use-in-process'
        assert all(p['kind'] == 'warm' for p in prep[1:])
        for sample in prep:
            finite(sample['bindMs']); finite(sample['startMs'])
        assert [trial['trial'] for trial in entry['trials']] == [0, 1, 2]
        trial_summaries = []
        for trial in entry['trials']:
            assert trial['bound'] == (item['views'] * item['properties'] if item['path'] == 'value' else 0)
            assert trial['remainingBindings'] == trial['remainingChannels'] == 0
            assert trial['nativeLive'] == dict(nodes=0, clock=0)
            checkpoints = [trial[key] for key in ('afterStart', 'playbackEnd', 'afterDispose', 'idle')]
            assert all(a['atMs'] <= b['atMs'] for a, b in zip(checkpoints, checkpoints[1:]))
            for point in checkpoints:
                assert point['overflow'] == 0
                for key, value in point.items():
                    finite(value)
            assert trial['idle']['atMs'] - trial['afterDispose']['atMs'] >= 590
            for key in ('activeTracks', 'pendingFrames', 'pendingTimers'):
                assert trial['idle'][key] == 0, ('Retained work', key)
            for key in ('frameCallbacks', 'frameRequests', 'plays', 'timerCallbacks', 'endCallbacks'):
                assert trial['idle'][key] == trial['afterDispose'][key], ('Work at rest', key)
            if item['observe']:
                assert trial['observations'] > 5 and trial['playbackEnd']['frameCallbacks'] > 5
            else:
                assert trial['observations'] == trial['playbackEnd']['frameCallbacks'] == 0
            if item['playback'] == 'finite':
                assert trial['completed'] and all(value is True for value in trial['completed'])
            native = trial['native']
            assert native['overflow'] == 0
            resources(native['before']); resources(native['after'])
            start, end = native['before']['timeMs'], native['after']['timeMs']
            duration = end - start
            assert duration >= (2190 if item['playback'] == 'finite' else 8790)
            assert duration < 30000, 'Interrupted or unbounded measurement'
            assert native['after']['cpuMs'] >= native['before']['cpuMs']
            finite(native['probeWorkMs'])
            assert native['probeWorkMs'] < duration
            assert native['memorySamples'] >= 4
            assert native['sampledPeakMemoryBytes'] >= max(native[edge]['memoryBytes'] for edge in ('before', 'after'))
            metric = 'display-link' if report['platform'] == 'iOS' else 'choreographer'
            assert native['frameMetric'] == metric + '-opportunities-not-presented-frames'
            assert native['columns'] == ['callbackMs', 'timestampMs', 'targetMs', 'xDip', 'scaleX', 'yDip']
            frames = native['frames']
            assert 5 < len(frames) <= 4096
            for row in frames:
                assert len(row) == 6
                for n in row: finite(n, -1e12)
                assert start <= row[0] <= end and row[2] > row[1]
            assert all(a[0] < b[0] and a[1] < b[1] for a, b in zip(frames, frames[1:])), 'Nonmonotonic callbacks'
            assert max(f[3] for f in frames) - min(f[3] for f in frames) > 1, 'No visible native movement'
            assert all(f[4] > 1.05 for f in frames), 'Lost non-unit scale baseline'
            if item['properties'] == 3:
                assert max(f[4] for f in frames) - min(f[4] for f in frames) > .01
            plays, timers, endings = trial['plays'], trial['timerWork'], trial['endWork']
            assert len(plays) == trial['idle']['plays'] and len(timers) == trial['idle']['timerCallbacks']
            assert len(endings) == trial['idle']['endCallbacks']
            for play in plays:
                for key in ('atMs', 'costMs', 'values', 'times', 'durationMs'): finite(play[key])
                assert play['property'] in ('x', 'scaleX', 'scaleY')
                assert play['values'] == play['times'] and play['values'] >= 2
            for timer in timers:
                for key in ('atMs', 'requestedMs', 'costMs'): finite(timer[key])
            for ending in endings:
                for key in ('atMs', 'costMs'): finite(ending[key])
            boundaries = [p for p in plays if trial['afterStart']['atMs'] < p['atMs'] < trial['playbackEnd']['atMs']]
            if item['playback'] == 'loop':
                assert not boundaries, 'Common loop unexpectedly rebuilt'
            if item['playback'] == 'window':
                assert len(boundaries) >= item['views'] * item['properties'] * 2, 'Window boundaries were not exercised'
                if item['path'] == 'value': assert any(t['requestedMs'] >= 3900 for t in timers)
                else: assert len(endings) >= item['views'] * item['properties'] * 2
            cpu = native['after']['cpuMs'] - native['before']['cpuMs']
            trial_summaries.append(dict(cpuMs=cpu, cpuCorePercent=cpu/duration*100,
                windowMs=duration, nativeProbeWorkMs=native['probeWorkMs'],
                callbackGapMs=summary([b[0]-a[0] for a,b in zip(frames,frames[1:])]),
                advertisedIntervalMs=summary([f[2]-f[1] for f in frames]),
                sampledPeakMiB=native['sampledPeakMemoryBytes']/1024**2,
                nativeTrackSubmissions=len(plays), submittedValues=sum(p['values'] for p in plays),
                boundaryTrackSubmissions=len(boundaries),
                boundaryCallbackMs=summary([t['costMs'] for t in timers if t['requestedMs'] >= 3900])
                    if any(t['requestedMs'] >= 3900 for t in timers) else None,
                nativeCompletionCallbackMs=summary([e['costMs'] for e in endings]) if endings else None))
        result[item['id']] = dict(firstUse=prep[0], warmBindMs=summary([p['bindMs'] for p in prep[1:]]),
            warmStartMs=summary([p['startMs'] for p in prep[1:]]), trials=trial_summaries)
    resources(report['finalResources'])
    return dict(physical=report['device']['physical'], recording=report['recording'],
                note='Callback cadence is not presented FPS; submitted values are not measured allocations.', cases=result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('--allow-simulator', action='store_true')
    parser.add_argument('--allow-dirty', action='store_true')
    parser.add_argument('--case', choices=list(CASES))
    args = parser.parse_args()
    data = gzip.decompress(args.report.read_bytes()) if args.report.suffix == '.gz' else args.report.read_bytes()
    print(json.dumps(verify(json.loads(data), args.allow_simulator, args.case, args.allow_dirty), indent=2))
