"""Verify the physical interval matrix using boundary counters, not rendered FPS.

Rates are compared within one run: hardware cadence is not an exact API promise.
"""
import json
import math
import sys
from pathlib import Path

PHASES = ['interval-auto', 'interval-16', 'interval-33', 'interval-100',
          'idle', 'slow-only', 'mixed', 'one-slow-binding', 'fast-removed',
          'last-binding-removed', 'reattached', 'all-disposed']
STOPPED = {'idle', 'last-binding-removed', 'all-disposed'}


def verify(report):
    assert report['schemaVersion'] == 1 and report['platform'] in ('ios', 'android')
    ios = report['platform'] == 'ios'
    assert report['status'] == 'completed' and report['failure'] is None
    assert report['device']['simulator'] is False
    assert report['device']['model'] and report['device']['os']
    assert report['device']['displayMaximumFPS'] >= 60
    events = report['events']
    assert [e['sequence'] for e in events] == list(range(len(events)))
    assert all(e['time'] >= report['session'] for e in events)
    assert all(a['monotonicMs'] <= b['monotonicMs'] for a, b in zip(events, events[1:]))
    assert events[0]['name'] == 'baseline' and events[-1]['name'] == 'route-disposed'
    assert [e['phase'] for e in events if e['name'] == 'window-start'] == PHASES
    assert [e['phase'] for e in events if e['name'] == 'window-end'] == PHASES
    assert all(e['name'] in ('baseline', 'configured', 'window-start', 'window-end',
                            'disposed', 'complete', 'route-disposed') for e in events)
    for event in events:
        assert set(event['native']) == {'active', 'sources', 'nodes', 'clock'}
        assert all(isinstance(v, int) and v >= 0 for v in event['native'].values())
        if event['name'] in ('baseline', 'disposed', 'complete', 'route-disposed'):
            assert all(v == 0 for v in event['native'].values()), event

    summary = {}
    for phase in PHASES:
        start = next(e for e in events if e['name'] == 'window-start' and e['phase'] == phase)
        end = next(e for e in events if e['name'] == 'window-end' and e['phase'] == phase)
        assert end['sequence'] == start['sequence'] + 1, 'Mutation during measurement'
        seconds = (end['monotonicMs'] - start['monotonicMs']) / 1000
        assert seconds >= (1.9 if phase in STOPPED else 3.9)
        for key in ('active', 'sources', 'nodes'):
            assert start['native'][key] == end['native'][key], ('Resources changed inside window', phase, key)
        active = phase not in STOPPED
        matrix = phase.startswith('interval-')
        assert start['native']['active'] == (2 if active and matrix and not ios else int(active)), (phase, start['native'])
        expected_ids = {'rotation', 'gravity'} if matrix else {'slow', 'fast'}
        assert set(start['sources']) == set(end['sources']) == expected_ids
        expected_sources = 2 if matrix or phase in ('idle', 'slow-only', 'mixed', 'one-slow-binding') else (0 if phase == 'all-disposed' else 1)
        assert start['native']['sources'] == expected_sources
        assert start['native']['nodes'] == ((10 if matrix or ios else 14) if expected_sources == 2 else 7 if expected_sources else 0)
        if not active:
            assert start['native']['clock'] == end['native']['clock'] == 0
        rates = {}
        for name, before in start['sources'].items():
            after = end['sources'][name]
            kind = 'rotation' if name in ('rotation', 'slow') or (name == 'fast' and not ios) else 'gravity'
            assert before['kind'] == after['kind'] == kind
            assert before['requested'] == after['requested']
            requested = ('auto' if phase == 'interval-auto' else int(phase.split('-')[1])) if matrix else (100 if name == 'slow' else 16)
            assert after['requested'] == requested
            interval = 1000 / report['device']['displayMaximumFPS'] if requested == 'auto' else requested
            assert abs(before['interval'] - interval) < 1e-6 and abs(after['interval'] - interval) < 1e-6
            assert before['available'] and after['available']
            assert before['error'] is None and after['error'] is None
            assert before['bindings'] == after['bindings']
            if matrix:
                bindings = ['card'] if name == 'rotation' else ['glow']
            elif name == 'slow':
                bindings = [] if phase in STOPPED else ['card', 'shine'] if phase in ('slow-only', 'mixed') else ['card']
            else:
                bindings = ['glow'] if phase in ('mixed', 'one-slow-binding') else []
            assert after['bindings'] == bindings, (phase, name, after['bindings'])
            disposed = phase == 'all-disposed' or (name == 'fast' and phase in ('fast-removed', 'last-binding-removed', 'reattached'))
            expected_status = 'disposed' if disposed else 'active' if bindings else 'idle'
            assert before['status'] == after['status'] == expected_status, (phase, name, before['status'], after['status'])
            samples = after['samples'] - before['samples']
            commits = after['frames'] - before['frames']
            callbacks = after['callbacks'] - before['callbacks']
            assert callbacks == 0, ('JS callbacks inside steady window', phase, name)
            assert all(math.isfinite(v) for v in after['values'])
            if bindings:
                # One pending sample from immediately before the boundary can
                # commit inside the window. There is only one coalescing slot.
                assert before['samples'] >= before['frames']
                assert after['samples'] >= after['frames']
                assert samples > 0 and 0 < commits <= samples + 1
                assert after['timestamp'] > before['timestamp'] > 0
                # Source commits respect their own interval even when acquisition is faster.
                assert commits <= seconds * 1000 / (interval - 0.5) + 2
                if kind == 'rotation':
                    assert abs(math.sqrt(sum(v*v for v in after['values'][3:])) - 1) < 1e-5
                else:
                    assert abs(math.sqrt(sum(v*v for v in after['values'])) - 9.80665) < .1
            else:
                assert samples == commits == 0, ('Work without a consumer', phase, name)
                assert before['timestamp'] == after['timestamp']
                assert before['values'] == after['values']
            rates[name] = {'samples': samples, 'commits': commits, 'callbacks': callbacks,
                           'samplesPerSecond': samples / seconds, 'commitsPerSecond': commits / seconds}
        summary[phase] = {'seconds': seconds, 'activeSubscriptions': start['native']['active'], 'rates': rates}
        if (matrix and ios) or phase in ('mixed', 'one-slow-binding'):
            a, b = rates.values()
            assert abs(a['samples'] - b['samples']) <= 1, ('Sources did not share delivery', phase)

    def sample(phase, source):
        return summary[phase]['rates'][source]['samplesPerSecond']

    # Broad, within-device comparisons catch ignored rate requests without promising
    # an exact hardware Hz value or requiring a particular display refresh rate.
    slow = sample('interval-100', 'rotation')
    medium = sample('interval-33', 'rotation')
    fast = sample('interval-16', 'rotation')
    auto = sample('interval-auto', 'rotation')
    assert medium > slow * 1.5 and fast > medium * 1.2
    assert auto >= fast * .75
    baseline = sample('slow-only', 'slow')
    mixed = sample('mixed', 'slow')
    assert mixed > baseline * 2, 'Fast consumer did not raise shared acquisition'
    assert .75 < sample('one-slow-binding', 'slow') / mixed < 1.35
    for phase in ('fast-removed', 'reattached'):
        assert .5 < sample(phase, 'slow') / baseline < 1.5, ('Slow acquisition was not restored', phase)
        assert sample(phase, 'slow') < mixed * .65
    for phase in ('mixed', 'one-slow-binding'):
        rates = summary[phase]['rates']
        assert rates['slow']['commitsPerSecond'] < rates['fast']['commitsPerSecond'] * .5
    return summary


def verify_profiles(report):
    """Validate process cost observations, without treating callbacks as presentation."""
    verify(report)
    assert [p['phase'] for p in report['profiles']] == PHASES
    summary = {}
    for profile in report['profiles']:
        phase, record = profile['phase'], profile['recording']
        before, after = record['before'], record['after']
        metric = 'phys_footprint' if report['platform'] == 'ios' else 'rss'
        for edge in (before, after):
            assert edge['memoryMetric'] == metric
            for key in ('timeMs', 'cpuMs', 'memoryBytes'):
                assert math.isfinite(edge[key]) and edge[key] >= 0
            assert edge['memoryBytes'] > 0
            assert isinstance(edge['lowPowerMode'], bool)
            assert edge['thermalState'] is None or isinstance(edge['thermalState'], int)
        duration = after['timeMs'] - before['timeMs']
        assert (1900 if phase in STOPPED else 3900) <= duration < 10000
        assert after['cpuMs'] >= before['cpuMs']
        assert math.isfinite(record['probeWorkMs']) and 0 <= record['probeWorkMs'] < duration
        assert record['memorySamples'] >= (4 if phase in STOPPED else 8)
        assert record['sampledPeakMemoryBytes'] >= max(before['memoryBytes'], after['memoryBytes'])
        assert record['overflow'] == 0
        prefix = 'display-link' if report['platform'] == 'ios' else 'choreographer'
        assert record['frameMetric'] == prefix + '-opportunities-not-presented-frames'
        assert record['columns'] == ['callbackMs', 'timestampMs', 'targetMs', 'xDip', 'scaleX', 'yDip']
        frames = record['frames']
        assert 5 < len(frames) <= 4096
        for row in frames:
            assert len(row) == 6 and all(math.isfinite(v) for v in row)
            assert before['timeMs'] <= row[0] <= after['timeMs']
            assert row[2] > row[1]
        assert all(a[0] < b[0] and a[1] <= b[1] for a, b in zip(frames, frames[1:]))
        summary[phase] = {'seconds': duration / 1000, 'processCpuMs': after['cpuMs'] - before['cpuMs'],
                          'sampledPeakMiB': record['sampledPeakMemoryBytes'] / 2**20,
                          'displayCallbacks': len(frames), 'probeWorkMs': record['probeWorkMs']}
    return summary


if __name__ == '__main__':
    check = verify_profiles if '--profiles' in sys.argv[2:] else verify
    print(json.dumps(check(json.loads(Path(sys.argv[1]).read_text())), indent=2))
