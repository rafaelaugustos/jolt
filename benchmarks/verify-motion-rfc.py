"""Check actual native poses and real touch boundaries from the Layers demo."""
import json
from pathlib import Path
import sys


def verify(report):
    samples = report['snapshots']
    def at(name): return next(s for s in samples if s['name'] == name)
    for s in samples:
        for prop, tolerance in [('x', 4), ('scale', 0.035)]:
            assert abs(s['actual'][prop] - s['expected'][prop]) < tolerance, (s['name'], prop, s['actual'], s['expected'])
        assert s['frames'] == 0, 'Compiled playback scheduled a JS frame loop'
    before, after = at('held-with-feedback'), at('held-without-feedback')
    assert any(c['layer'] == 'feedback' for c in before['channels'])
    assert not any(c['layer'] == 'feedback' for c in after['channels'])
    assert any(c['layer'] == 'base' for c in after['channels']), 'Stopping shake cancelled the entrance'
    for s in [before, after]:
        assert abs(s['actual']['scale'] / (1.3 + 0.2 * s['baseProgress']) - 0.88) < 0.035, 'Press did not remain held'
    down = next(t for t in report['touches'] if t['action'] == 'down')
    up = next(t for t in report['touches'] if t['action'] in ('up', 'cancel'))
    assert down['time'] < before['time'] < after['time'] < up['time'], 'No real held touch around shake removal'
    released = at('released-to-base')
    assert released['time'] > up['time']
    settled = at('entrance-settled')
    assert abs(settled['actual']['x'] - 24) < 1 and abs(settled['actual']['scale'] - 1.5) < 0.01
    for name in ['common-loop-early', 'common-loop-late', 'before-window', 'after-window']:
        s = at(name)
        assert {'wobble', 'pulse'} <= {c['layer'] for c in s['channels']}, 'One endless channel was lost'
    assert any(p['phase'] == 'loops' and p['property'] == 'x' and p['duration'] == 28800 and p['repeat'] == 'infinite' for p in report['plays'])
    rolls = [p for p in report['plays'] if p['phase'] == 'windows' and p['property'] == 'x' and p['duration'] == 4000]
    if report.get('composition') == 'native':
        assert not rolls, 'Native composition still submitted a window track'
        for name in ['before-window', 'after-window']:
            assert at(name)['live'] == dict(nodes=1, clock=1), 'Native composer missing at ' + name
        assert abs(at('after-window')['actual']['x'] - at('before-window')['actual']['x']) > 0.5, 'Composer stalled across the former window boundary'
        assert at('disposed')['live'] == dict(nodes=0, clock=0), 'Native composer retained'
    else:
        assert len(rolls) >= 2, 'Window did not rebuild'
    final = at('disposed')
    assert report['phase'] == 'disposed' and not final['channels'] and final['active'] == 0
    return {'platform': report['platform'], 'composition': report.get('composition', 'windows'), 'samples': len(samples), 'jsFrameRequests': final['frames'], 'activeAfterCleanup': final['active']}


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
