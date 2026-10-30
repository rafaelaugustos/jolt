"""Verify the physical iPhone interval matrix using boundary counters, not rendered FPS.

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
    assert report['schemaVersion'] == 1 and report['platform'] == 'ios'
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
        assert start['native']['active'] == int(active), (phase, start['native'])
        matrix = phase.startswith('interval-')
        expected_ids = {'rotation', 'gravity'} if matrix else {'slow', 'fast'}
        assert set(start['sources']) == set(end['sources']) == expected_ids
        expected_sources = 2 if matrix or phase in ('idle', 'slow-only', 'mixed', 'one-slow-binding') else (0 if phase == 'all-disposed' else 1)
        assert start['native']['sources'] == expected_sources
        assert start['native']['nodes'] == (10 if expected_sources == 2 else 7 if expected_sources else 0)
        if not active:
            assert start['native']['clock'] == end['native']['clock'] == 0
        rates = {}
        for name, before in start['sources'].items():
            after = end['sources'][name]
            assert before['kind'] == after['kind'] == ('rotation' if name in ('rotation', 'slow') else 'gravity')
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
                if name in ('rotation', 'slow'):
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
        if matrix or phase in ('mixed', 'one-slow-binding'):
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


if __name__ == '__main__':
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())), indent=2))
