"""Verify real iOS lifecycle input recorded by testInteractiveNavigationLifecycle.

Usage: python3 benchmarks/verify-interactive-lifecycle.py audit.json
"""
import json
from pathlib import Path
import sys


def verify(report):
    snapshots, events = report['snapshots'], report['events']

    def after(snapshot, name):
        return next(s for s in snapshots[snapshots.index(snapshot) + 1:] if s['name'] == name)

    def same_route(before, after):
        assert after['page'] == before['page'], 'Current page changed during cancellation'
        assert after['backStack'] == before['backStack'], 'History changed during cancellation'

    def settled(snapshot):
        assert snapshot['nativeActive'] == 0, 'Native transition still active'
        assert snapshot['nativeStack'] == len(snapshot['backStack']) + 1, 'Core/UIKit history mismatch'
        assert snapshot['pages'], 'Missing native page geometry'
        current = next(p for p in snapshot['pages'] if p['identity'] == snapshot['page'])
        assert all(abs(current['bounds'][axis] - snapshot['viewport'][axis]) < 1 for axis in ('width', 'height')), 'Visible page does not fit the viewport'
        for page in snapshot['pages']:
            assert len(page['transform']) == 6, 'Incomplete native transform'
            assert all(abs(a-b) < 0.001 for a, b in zip(page['transform'], [1, 0, 0, 1, 0, 0])), 'Page transform was not restored'

    background = next(s for s in snapshots if s['name'] == 'background')
    foreground = after(background, 'foreground')
    assert background['state'] == 'dragging' and background['nativeActive'] == 1, 'Suspension did not interrupt an active Jolt drag'
    assert any(p['enabled'] and p['state'] == 2 for p in background['pans']), 'Finger was not held at suspension'
    assert foreground['state'] == 'idle' and foreground['recognizers'] == 1, 'Jolt owner was discarded during background unload'
    assert foreground['frameLoaded'], 'Frame did not reload'
    same_route(background, foreground)
    settled(foreground)
    cancelled = after(background, 'event-idle')
    assert events[cancelled['events'] - 1]['outcome'] == 'cancelled'
    assert cancelled['time'] - background['time'] < 1000, 'Cancellation waited for the scheduled finger lift'
    same_route(background, cancelled)
    settled(cancelled)

    resumed_drag = after(foreground, 'event-dragging')
    same_route(background, resumed_drag)
    assert resumed_drag['recognizers'] == 1, 'Subsequent swipe did not use Jolt'
    completed = after(resumed_drag, 'event-idle')
    assert events[completed['events'] - 1]['outcome'] == 'completed'
    assert completed['page'] == background['backStack'][-1]
    assert completed['backStack'] == background['backStack'][:-1]
    settled(completed)
    disposed = after(completed, 'event-disposed')
    assert disposed['recognizers'] == 0

    turned = next(s for s in snapshots if s['name'] == 'device-orientation' and s['deviceOrientation'] in (3, 4) and s['state'] == 'dragging')
    assert any(p['enabled'] and p['state'] == 2 for p in turned['pans']), 'Rotation was not requested during the held drag'
    assert turned['viewport']['height'] > turned['viewport']['width'], 'Expected UIKit to defer the interface rotation'
    landscape = next(s for s in snapshots[snapshots.index(turned):] if s['viewport']['width'] > s['viewport']['height'])
    assert landscape['state'] == 'idle', 'Rotation left an unfinished transition'
    same_route(turned, landscape)
    settled(landscape)
    rotation_cancel = after(turned, 'event-idle')
    assert events[rotation_cancel['events'] - 1]['outcome'] == 'cancelled'
    assert rotation_cancel['time'] <= landscape['time'], 'Interface rotated before the partial return settled'
    rotation_drag = after(landscape, 'event-dragging')
    same_route(turned, rotation_drag)
    rotation_pop = after(rotation_drag, 'event-idle')
    assert events[rotation_pop['events'] - 1]['outcome'] == 'completed'
    assert rotation_pop['page'] == turned['backStack'][-1]

    assert all(s['delegatePreserved'] for s in snapshots), 'Core navigation delegate replaced'
    assert sum(e.get('outcome') == 'completed' for e in events) == 2, 'Expected two Jolt gesture commits'
    assert sum(e.get('outcome') == 'cancelled' for e in events) == 2
    # A fresh push and button-driven return must still complete after both tests.
    assert [e['state'] for e in events[-5:]] == ['animating', 'idle', 'animating', 'idle', 'disposed']
    final = snapshots[-1]
    assert final['state'] == 'disposed' and final['recognizers'] == 0
    assert final['backStack'] == [] and final['page'] == snapshots[0]['page']
    settled(final)
    return {
        'backgroundCancellationMs': cancelled['time'] - background['time'],
        'gestureCommits': 2,
        'gestureCancellations': 2,
        'finalActive': final['nativeActive'],
        'finalRecognizers': final['recognizers'],
    }


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
