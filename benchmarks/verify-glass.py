"""Verify boundary snapshots from real glass UI interactions.
Usage: python3 benchmarks/verify-glass.py REPORT.json [REPORT.json ...]
Reports check native state/ownership; reviewed videos check visible fusion.
"""
import copy
import json
from pathlib import Path
import sys


def positions(event):
    return [view['x'] for view in event['views']]


def close(actual, expected, tolerance=.05):
    assert len(actual) == len(expected) == 3
    assert all(a is not None and abs(a-b) < tolerance for a, b in zip(actual, expected)), (actual, expected)


def verify(data):
    events = data['events']
    snapshots = [event for event in events if event['name'] == 'snapshot']
    assert len(snapshots) == 15
    backend = snapshots[0]['views'][0]['backend']
    assert backend in ('liquid-glass', 'blur', 'none')
    assert (data['platform'] == 'android') == (backend == 'none')
    for event in snapshots:
        assert event['group']['spacing'] == 26
        assert event['group']['backend'] == ('liquid-glass' if backend == 'liquid-glass' else 'none')
        effect = event['group']['effect']
        assert ('UIGlassContainerEffect' in (effect or '')) if backend == 'liquid-glass' else effect is None
        for view in event['views']:
            assert view['loaded'] and view['grouped'] and view['contentInside']
            assert view['backend'] == backend
            if backend == 'none': assert view['effect'] is None
            else: assert ('UIGlassEffect' if backend == 'liquid-glass' else 'UIBlurEffect') in view['effect']
            assert view['size']['width'] > 0 and view['size']['height'] > 0
            if backend == 'blur':
                assert abs(view['cornerRadius'] - min(view['size']['width'], view['size']['height']) / 2) < .01
    close(positions(snapshots[0]), [-104, 0, 104])
    for event in snapshots[1:6]:
        close(positions(event), [-78, 0, 78])
        assert event['paused'] and event['resources'] == 3
    widths = [event['group']['width'] for event in snapshots[1:6]]
    assert abs(min(widths)-300) < 1 and max(widths) > 330 and widths[-1] == widths[0]
    rejected = next(event for event in events if event['name'] == 'rejected')
    assert '0..200' in rejected['error']
    close(positions(rejected), [-78, 0, 78])
    for event in snapshots[6:9]:
        close(positions(event), [-52, 0, 52])
        assert event['resources'] == 0
    assert snapshots[7]['touches'] == 1
    interruptions = 0
    for before, after in zip(events, events[1:]):
        if before['name'] == 'before-move' and after['name'] == 'move' and not after['reduced']:
            close(positions(after), positions(before))
            if -103 < positions(before)[0] < -53: interruptions += 1
    assert interruptions > 0
    for event in snapshots[9:11]:
        close(positions(event), [-104, 0, 104])
        assert event['paused'] and event['resources'] == 3
    close(positions(snapshots[11]), [-104, 0, 104])
    assert snapshots[11]['resources'] == 0  # delayed reverse repeat finished
    close(positions(snapshots[12]), [-52, 0, 52])
    assert snapshots[12]['reduced'] and snapshots[12]['resources'] == 0
    close(positions(snapshots[13]), [-104, 0, 104])
    assert snapshots[13]['reduced'] and snapshots[13]['resources'] == 0
    background = next(event for event in events if event['name'] == 'background')
    foreground = next(event for event in events if event['name'] == 'foreground' and event['time'] > background['time'])
    close(positions(foreground), positions(background))
    close(positions(snapshots[-1]), [-52, 0, 52])
    assert snapshots[-1]['resources'] == 0
    last = events[-1]
    assert last['name'] == 'disposed' and last['resources'] == 0 and last['group']['effect'] is None
    for view in last['views']:
        assert not view['loaded'] and view['effect'] is None and view['animations'] in (0, None)
    return dict(platform=data['platform'], backend=backend, checkpoints=len(snapshots),
                midpoint=[-78, 0, 78], resizeWidths=sorted(set(widths)),
                interruptions=interruptions, touches=1, backgroundResumed=True,
                retainedEffects=0, retainedResources=0)


if __name__ == '__main__':
    for filename in sys.argv[1:]:
        data = json.loads(Path(filename).read_text())
        result = verify(data)
        for field, value in [('x', 0), ('grouped', False)]:
            bad = copy.deepcopy(data)
            next(event for event in bad['events'] if event['name'] == 'snapshot' and event['paused'])['views'][0][field] = value
            try: verify(bad)
            except AssertionError: pass
            else: raise AssertionError('Broken native state passed: ' + field)
        result['negativeControls'] = 'rejected missing transform and invalid child ownership'
        print(json.dumps(result))
