"""Verify actual pointer-spring interactions, presentation and native teardown."""
import copy
import json
import math
from pathlib import Path
import sys


def body(event, name):
    return next(b for b in event['snapshot']['bodies'] if b['id'] == name)


def verify(data):
    events = [e for e in data['events'] if 'snapshot' in e]
    snapshots = [e for e in events if e['name'] == 'snapshot']
    assert snapshots[0]['snapshot']['status'] == 'sleeping', 'initial world did not sleep'
    held = []
    for e in events:
        s = e['snapshot']
        assert s['steps'] <= s['frames'] * 16, 'unbounded native stepping'
        assert s['guides'] == (0 if e['name'] == 'disposed' else 3), 'tether resource count'
        if e['name'] == 'disposed':
            continue
        w, h = e['size']['width'], e['size']['height']
        for i, b in enumerate(s['bodies']):
            p = e['presented'][i]
            assert p and abs(p['x'] - b['x']) < .5 and abs(p['y'] - b['y']) < .5, 'presentation drift'
            assert b['radius'] - .1 <= b['x'] <= w - b['radius'] + .1, 'horizontal bounds'
            assert b['radius'] - .1 <= b['y'] <= h - b['radius'] + .1, 'vertical bounds'
            assert math.hypot(b['vx'], b['vy']) <= 1200.01, 'speed cap'
            assert b['held'] == (b['pointer'] is not None), 'pointer ownership mismatch'
            if b['pointer']:
                anchor = b['pointer']['anchor']
                assert 0 <= anchor['x'] <= w and 0 <= anchor['y'] <= h, 'pointer anchor bounds'
                assert not b['snap'], 'resting snap competes with pointer'
                held.append((e, b))
        a, b = s['bodies']
        assert math.hypot(a['x'] - b['x'], a['y'] - b['y']) >= a['radius'] + b['radius'] - .5, 'body overlap'
        anchor = a['attachment']['anchor']
        assert abs(anchor['x'] - w * .5) < .01 and abs(anchor['y'] - h * .14) < .01, 'pointer mutated resting anchor'
    assert len(held) >= 6 and {b['id'] for _, b in held} == {'tether', 'magnet'}, 'missing real held samples'
    gaps = [math.hypot(b['x'] - b['pointer']['anchor']['x'], b['y'] - b['pointer']['anchor']['y']) for _, b in held]
    assert max(gaps) > 30, 'body follows pointer kinematically'
    assert len({round(b['pointer']['anchor']['x']) for _, b in held}) >= 3, 'pointer did not move'
    assert any(e['snapshot']['contacts'] > 0 for e, _ in held), 'no collision while spring-held'
    returned = [e for e in snapshots if e['snapshot']['status'] == 'sleeping' and e['snapshot']['dragEnds'] >= 1]
    assert returned, 'no settled return after release'
    for e in returned:
        a = body(e, 'tether'); anchor = a['attachment']['anchor']
        assert abs(a['x'] - anchor['x']) < .3 and abs(a['y'] - anchor['y'] - 72 - 750 / 180) < .3, 'resting spring did not return'
    release = next(body(e, 'magnet') for e in snapshots if body(e, 'magnet')['release'])
    r = release['release']; e = next(e for e in snapshots if body(e, 'magnet')['release'])
    w, h = e['size']['width'], e['size']['height']
    nearest = min(range(3), key=lambda i: math.hypot(r['x'] + r['vx'] * .12 - w * (.2 + .3 * i), r['y'] + r['vy'] * .12 - h * .78))
    assert release['snap']['index'] == nearest, 'snap ignores body release velocity'
    arm = next(e for e in events if e['name'] == 'armed-cancel')
    cancel = next(e for e in events if e['name'] == 'cancelled-drag')
    assert cancel['snapshot']['dragStarts'] > arm['snapshot']['dragStarts'], 'cancel did not catch a real gesture'
    assert cancel['snapshot']['dragCancels'] > arm['snapshot']['dragCancels'], 'native cancellation missing'
    assert cancel['snapshot']['dragEnds'] == arm['snapshot']['dragEnds'], 'cancel counted as release'
    a, b = body(arm, 'magnet'), body(cancel, 'magnet')
    assert not b['held'] and b['pointer'] is None and b['vx'] == b['vy'] == 0, 'cancel retained pointer momentum'
    assert b['snap']['index'] == a['snap']['index'] and b['release'] == a['release'], 'cancel changed release/dock'
    paused = [e for e in snapshots if e['snapshot']['status'] == 'paused' and not e['reduced']]
    assert len(paused) >= 2 and paused[0]['snapshot']['frames'] == paused[1]['snapshot']['frames'] and paused[0]['presented'] == paused[1]['presented'], 'paused world moved'
    reduced = [e for e in events if e['reduced']]
    assert len(reduced) >= 3 and len({e['snapshot']['frames'] for e in reduced}) == 1, 'Reduce Motion kept stepping'
    assert all(not e['snapshot']['clock'] and e['presented'] == reduced[0]['presented'] for e in reduced), 'reduced world moved'
    heights = [e['size']['height'] for e in snapshots]
    assert min(heights) < heights[0] - 20 and abs(heights[-1] - heights[0]) < 1, 'missing resize restoration'
    bg = next(e for e in events if e['name'] == 'background')
    assert not bg['snapshot']['clock'] and snapshots[-1]['snapshot']['frames'] > bg['snapshot']['frames'], 'background/resume failed'
    last = events[-1]
    assert last['name'] == 'disposed' and last['worlds'] == last['clocks'] == last['resources'] == last['snapshot']['guides'] == 0, 'native resources leaked'
    assert not last['snapshot']['clock'] and all(not b['held'] and b['pointer'] is None for b in last['snapshot']['bodies'])
    return {'platform': data['platform'], 'heldSamples': len(held), 'maxPointerGap': round(max(gaps), 2), 'frames': last['snapshot']['frames'], 'contacts': last['snapshot']['contacts'], 'drags': last['snapshot']['dragStarts'], 'releases': last['snapshot']['dragEnds'], 'cancels': last['snapshot']['dragCancels'], 'remainingResources': 0}


for filename in sys.argv[1:]:
    data = json.loads(Path(filename).read_text())
    result = verify(data)
    for mutation in ['kinematic', 'stale-pointer']:
        bad = copy.deepcopy(data)
        if mutation == 'kinematic':
            for e in bad['events']:
                for b in e.get('snapshot', {}).get('bodies', []):
                    if b.get('pointer'):
                        b['pointer']['anchor'] = {'x': b['x'], 'y': b['y']}
        else:
            e = next(e for e in bad['events'] if e['name'] == 'cancelled-drag')
            body(e, 'magnet')['pointer'] = {'anchor': {'x': 100, 'y': 100}}
        try:
            verify(bad)
        except AssertionError:
            pass
        else:
            raise AssertionError('Negative control accepted ' + mutation)
    print(json.dumps({**result, 'negativeControls': 'rejected kinematic movement and stale pointer ownership'}))
