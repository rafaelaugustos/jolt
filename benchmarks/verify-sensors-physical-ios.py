"""Check hardware-only iPhone and Android lifecycle audits.

Boundary counters measure native commit work, not total CPU, latency or battery.
This does not replace a manual, recorded axis/orientation validation.
"""
import json
import math
import sys
from pathlib import Path


def verify(report):
    assert report['platform'] in ('ios', 'android')
    registrations = 1 if report['platform'] == 'ios' else 2
    events = report['events']
    assert [e['sequence'] for e in events] == list(range(len(events)))
    assert all(e['time'] >= report['session'] for e in events)
    assert all(a['time'] <= b['time'] for a, b in zip(events, events[1:]))
    assert not any(e['name'] == 'preview' for e in events), 'Synthetic input was used'
    instances = sorted({e['instance'] for e in events})
    assert len(instances) == 3, 'Expected three recreated screens'
    windows = []
    backgrounds = paused_backgrounds = 0

    def equal(a, b):
        assert len(a) == len(b)
        assert all(math.isfinite(x) and math.isfinite(y) and abs(x-y) < 1e-6
                   for x, y in zip(a, b)), (a, b)

    for instance in instances:
        trace = [e for e in events if e['instance'] == instance]
        assert trace[0]['name'] == 'baseline' and trace[-1]['name'] == 'disposed'
        for boundary in (trace[0], trace[-1]):
            assert all(boundary[k] == 0 for k in ('active', 'sources', 'nodes', 'clock')), boundary
        loaded = next(e for e in trace if e['name'] == 'loaded')
        assert loaded['sources'] == 2
        snapshots = [e for e in trace if e['name'] == 'snapshot']
        a, b = snapshots[:2]
        seconds = (b['time'] - a['time']) / 1000
        assert seconds >= 5
        assert a['active'] == b['active'] == registrations, 'Hardware subscription must be shared'
        measures = {'instance': instance, 'seconds': seconds}
        for kind in ('rotation', 'gravity'):
            before, after = a[kind], b[kind]
            assert before['available'] and after['available']
            assert before['status'] == after['status'] == 'active'
            assert before['error'] is None and after['error'] is None
            samples = after['samples'] - before['samples']
            frames = after['frames'] - before['frames']
            callbacks = after['callbacks'] - before['callbacks']
            assert samples >= frames > 0
            assert callbacks == 0, 'Steady native binding path called JavaScript'
            assert after['timestamp'] > before['timestamp'] > 0
            assert all(math.isfinite(v) for v in after['values'])
            native_ms = after['processingMs'] - before['processingMs']
            assert native_ms >= 0
            measures[kind] = {
                'requestedIntervalMs': after['interval'], 'samples': samples,
                'commits': frames, 'callbacks': callbacks,
                'samplesPerSecond': samples / seconds, 'commitsPerSecond': frames / seconds,
                'nativeCommitMs': native_ms, 'nativeMsPerCommit': native_ms / frames,
            }
        assert abs(math.sqrt(sum(v*v for v in b['rotation']['values'][3:])) - 1) < 1e-5
        assert abs(math.sqrt(sum(v*v for v in b['gravity']['values'])) - 9.80665) < 0.1
        windows.append(measures)
        shared = next(e for e in trace if e['name'] == 'shared')
        released = next(e for e in trace if e['name'] == 'shared-released')
        assert shared['active'] == released['active'] == registrations
        assert shared['sources'] == released['sources'] + 1
        assert shared['nodes'] == released['nodes'] + 7
        # Physical iOS can deliver additional suspension/activation cycles.
        # Require the scripted minimum and verify every observed pair, including
        # extra cycles; reject missing, duplicated or out-of-order boundaries.
        boundaries = [e['name'] for e in trace if e['name'] in ('background', 'foreground')]
        count = boundaries.count('background')
        assert count >= (2 if instance == instances[0] else 1)
        assert boundaries == ['background', 'foreground'] * count
        for index, held in enumerate(trace):
            if held['name'] != 'background':
                continue
            backgrounds += 1
            after = next(e for e in trace[index+1:] if e['name'] == 'foreground')
            assert after['time'] - held['time'] >= 1000
            assert held['active'] == 0
            for kind in ('rotation', 'gravity'):
                assert held[kind]['samples'] == after[kind]['samples']
                assert held[kind]['frames'] == after[kind]['frames']
                equal(held[kind]['values'], after[kind]['values'])
            for view in ('card', 'shine', 'glow'):
                equal(list(held[view].values()), list(after[view].values()))
            resumed = next(e for e in trace[trace.index(after)+1:] if e['name'] == 'snapshot')
            if held['paused']:
                paused_backgrounds += 1
                assert after['paused'] and resumed['paused']
                assert resumed['active'] == resumed['clock'] == 0
                for kind in ('rotation', 'gravity'):
                    assert resumed[kind]['frames'] == held[kind]['frames']
                    equal(held[kind]['values'], resumed[kind]['values'])
            else:
                assert resumed['active'] == registrations
                for kind in ('rotation', 'gravity'):
                    assert resumed[kind]['status'] == 'active'
                    assert resumed[kind]['frames'] > after[kind]['frames']
        if instance == instances[0]:
            for name in ('pause', 'reduced'):
                held = next(e for e in trace if e['name'] == name)
                still = next(e for e in trace[trace.index(held)+1:] if e['name'] == 'snapshot')
                assert still['active'] == still['clock'] == 0
                for kind in ('rotation', 'gravity'):
                    assert still[kind]['frames'] == held[kind]['frames']
                    equal(held[kind]['values'], still[kind]['values'])
            for name in ('resume', 'motion', 'center'):
                boundary = next(e for e in trace if e['name'] == name)
                playing = next(e for e in trace[trace.index(boundary)+1:] if e['name'] == 'snapshot')
                assert playing['active'] == registrations
                for kind in ('rotation', 'gravity'):
                    assert playing[kind]['status'] == 'active'
                    assert playing[kind]['frames'] > boundary[kind]['frames']
    assert backgrounds >= 4 and paused_backgrounds >= 1
    return {'instances': 3, 'backgroundCycles': backgrounds,
            'pausedBackgroundCycles': paused_backgrounds,
            'finalNativeResources': 0, 'acquisitionWindows': windows}


if __name__ == '__main__':
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())), indent=2))
