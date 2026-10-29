"""Verify fresh native observations across actual Home/foreground and route reentry.

Usage: python3 benchmarks/verify-sensor-lifecycle.py REPORT.json
Synthetic sensor input proves lifecycle/continuity, not physical acquisition accuracy.
"""
import json
import math
import sys
from pathlib import Path


def verify(report):
    events = report['events']
    assert report['platform'] in ('ios', 'android')
    assert len(events) > 20
    assert [e['sequence'] for e in events] == list(range(len(events)))
    assert all(e['time'] >= report['session'] for e in events)
    assert all(a['time'] <= b['time'] for a, b in zip(events, events[1:]))
    instances = sorted({e['instance'] for e in events})
    assert len(instances) == 3, ('expected three actual screen instances', instances)
    backgrounds = 0
    paused_backgrounds = 0

    def equal(a, b, context):
        assert len(a) == len(b)
        assert all(math.isfinite(x) and math.isfinite(y) and abs(x-y) < 1e-6
                   for x, y in zip(a, b)), (context, a, b)

    for instance in instances:
        trace = [e for e in events if e['instance'] == instance]
        assert trace[0]['name'] == 'baseline'
        assert trace[-1]['name'] == 'disposed'
        assert sum(e['name'] == 'loaded' for e in trace) == 1
        assert sum(e['name'] == 'disposed' for e in trace) == 1
        for boundary in (trace[0], trace[-1]):
            assert all(boundary[key] == 0 for key in ('active', 'sources', 'nodes', 'clock')), boundary
        loaded = next(e for e in trace if e['name'] == 'loaded')
        assert loaded['sources'] == 2
        assert loaded['nodes'] > 10
        preview = next(i for i, e in enumerate(trace) if e['name'] == 'preview')
        moving = next(e for e in trace[preview+1:] if e['name'] == 'snapshot')
        assert moving['rotation']['status'] == moving['gravity']['status'] == 'replaying'
        assert moving['rotation']['frames'] > 20
        assert any(abs(v) > .03 for v in moving['rotation']['values'][:3])
        assert moving['card'] != loaded['card'], ('native card did not move', instance)
        assert moving['shine'] != loaded['shine'], ('native highlight did not move', instance)
        assert len([e for e in trace if e['name'] == 'background']) == len(
            [e for e in trace if e['name'] == 'foreground'])
        assert sum(e['name'] == 'background' for e in trace) == (3 if instance == instances[0] else 1)
        for index, held in enumerate(trace):
            if held['name'] != 'background':
                continue
            backgrounds += 1
            assert held['active'] == 0, ('hardware still registered in background', held)
            after = next(e for e in trace[index+1:] if e['name'] == 'foreground')
            assert after['time'] - held['time'] >= 800, ('background interval missing', held, after)
            for kind in ('rotation', 'gravity'):
                assert after[kind]['samples'] == held[kind]['samples'], ('samples during suspension', kind, held, after)
                assert after[kind]['frames'] == held[kind]['frames'], ('frames during suspension', kind, held, after)
                equal(held[kind]['values'], after[kind]['values'], 'resume source continuity')
                assert after[kind]['error'] is None
            for view in ('card', 'shine', 'glow'):
                assert held[view] is not None and after[view] is not None
                equal(list(held[view].values()), list(after[view].values()), 'native pose continuity')
            resumed_index = trace.index(after)
            resumed = next(e for e in trace[resumed_index+1:] if e['name'] == 'snapshot')
            assert resumed['time'] > after['time']
            if index < preview:
                # The first cycle uses the platform sensor subscription, before
                # test playback. iOS Simulator correctly reports unavailable.
                available = [resumed[k]['available'] for k in ('rotation', 'gravity')]
                assert resumed['active'] == (sum(available) if report['platform'] == 'android' else int(any(available)))
                for kind in ('rotation', 'gravity'):
                    if resumed[kind]['available']:
                        assert resumed[kind]['status'] == 'active'
                        assert resumed[kind]['frames'] > after[kind]['frames']
                    else:
                        assert resumed[kind]['status'] == 'unavailable'
                        assert resumed[kind]['frames'] == after[kind]['frames'] == 0
            elif held['paused']:
                paused_backgrounds += 1
                assert after['paused'] and resumed['paused']
                assert resumed['active'] == resumed['clock'] == 0
                for kind in ('rotation', 'gravity'):
                    assert resumed[kind]['frames'] == held[kind]['frames']
                    equal(held[kind]['values'], resumed[kind]['values'], 'explicit pause survived foreground')
                manual = next(i for i in range(resumed_index+1, len(trace)) if trace[i]['name'] == 'resume')
                playing = next(e for e in trace[manual+1:] if e['name'] == 'snapshot')
                assert not playing['paused']
                for kind in ('rotation', 'gravity'):
                    assert playing[kind]['status'] == 'replaying'
                    assert playing[kind]['frames'] > resumed[kind]['frames'], 'explicit resume did not restart'
            else:
                assert not after['paused'] and not resumed['paused']
                for kind in ('rotation', 'gravity'):
                    assert resumed[kind]['frames'] > after[kind]['frames'], ('source did not resume', resumed)
                    assert resumed[kind]['status'] == 'replaying'
                assert resumed['card'] != after['card'], ('native binding did not resume', resumed)
        disposed = trace[-1]
        assert disposed['rotation']['status'] == disposed['gravity']['status'] == 'disposed'
    assert backgrounds == 5 and paused_backgrounds == 1, (backgrounds, paused_backgrounds)
    assert events[-1]['name'] == 'disposed'
    return {'platform': report['platform'], 'instances': len(instances),
            'backgroundCycles': backgrounds, 'finalNativeResources': 0}


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
