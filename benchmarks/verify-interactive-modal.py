"""Check actual Core/Vue modal ownership, lifecycle and native resource traces."""
import json
from pathlib import Path
import sys


def verify(report, scenario):
    events = report['events']
    assert events and all(a['time'] <= b['time'] for a, b in zip(events, events[1:]))
    expected = 9 if scenario == 'checks' else 2
    callbacks = [e for e in events if e['name'] == 'callback']
    settled = [e for e in events if e['name'] == 'closed-settled']
    assert len(callbacks) == len(settled) == expected
    for index, e in enumerate(callbacks, 1):
        assert e['callbacks'] == e['unmounts'] == index
        assert not e['attached'] and not e['presented'] and e['active'] == 0
    for index, e in enumerate(settled, 1):
        assert e['callbacks'] == e['unmounts'] == index
        assert e['state'] == 'disposed' and e['active'] == e['recognizers'] == 0
        assert not e['attached'] and not e['presented']
    samples = [e for e in events if e['name'] == 'snapshot']
    assert len(samples) == (10 if scenario == 'checks' else 3)
    for e in samples:
        assert e['attached'] and e['presented'] and e['active'] == 0
        assert e['callbacks'] == e['unmounts']
        assert len(e['transform']) == 6
        assert all(abs(a-b) < .001 for a, b in zip(e['transform'], [1, 0, 0, 1, 0, 0]))
        assert e['page'] == samples[0]['page'] and e['depth'] == samples[0]['depth']
    states = [e for e in events if e['name'] == 'state']
    cancelled = [e for e in states if e.get('extra', {}).get('outcome') == 'cancelled']
    for e in cancelled:
        assert e['state'] == 'idle' and e['attached'] and e['presented']
        assert e['active'] == 0 and e['callbacks'] == e['unmounts']
        before = [x for x in states if x['time'] <= e['time'] and x['extra']['state'] == 'dragging'][-1]
        assert before['callbacks'] == e['callbacks'], 'Cancellation invoked close callback'
    drags = [e for e in states if e['extra']['state'] == 'dragging']
    releases = [e for e in states if 'release' in e.get('extra', {})]
    assert all(0 <= e['extra']['release']['progress'] <= 1 for e in releases)
    if scenario == 'checks':
        assert len(drags) == 5 and len(cancelled) == 4
        assert [e['callbacks'] for e in samples] == [0, 0, 1, 2, 3, 5, 6, 7, 8, 8]
        assert [e['recognizers'] for e in samples] == [1, 1, 1, 1, 0, 1, 0, 0, 1, 1]
        assert [e['state'] for e in samples] == ['idle']*4 + ['disposed', 'idle', 'disposed'] + ['idle']*3
        for name in ('early-close', 'close-twice'):
            values = [e['extra'] for e in events if e['name'] == name]
            assert values == [[True, False]], (name, values)
        assert samples[8]['extra']['scroll'] > 10
        assert samples[9]['extra']['scroll'] < samples[8]['extra']['scroll']
        assert [e.get('extra') for e in callbacks] == ['core', 'first', None, 'core', 'early', 'button', 'core', 'button', 'button']
    elif scenario == 'lifecycle':
        background = next(e for e in events if e['name'] == 'background')
        assert background['state'] == 'dragging' and background['active'] == 1
        assert background['callbacks'] == background['unmounts'] == 0
        foreground = next(e for e in events if e['name'] == 'foreground' and e['time'] > background['time'])
        assert foreground['state'] == 'idle' and foreground['attached'] and foreground['recognizers'] == 1
        assert foreground['callbacks'] == 0 and foreground['active'] == 0
        assert len(cancelled) == 3 and len(drags) == 4
        assert all(e['callbacks'] == 0 for e in samples)
        assert [e['orientation'] for e in samples] == [1, 3, 1]
    else:
        raise ValueError(scenario)
    return {'scenario': scenario, 'callbacks': expected, 'cancellations': len(cancelled), 'finalNativeResources': 0}


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()), sys.argv[2])))
