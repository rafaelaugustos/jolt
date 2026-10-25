"""Verify native presentations captured at real OS interaction boundaries."""
import copy
import json
from pathlib import Path
import sys

def verify(report):
    events = report['events']
    def event(name): return next(e for e in events if e['name'] == name)
    def following(target): return next(e for e in events[events.index(target)+1:] if e['name'] == 'snapshot')
    paused = event('pause'); held = following(paused)
    assert .01 < paused['progress'] < .99, 'Pause must interrupt a moving trajectory'
    assert paused['paused'] and held['paused']
    assert paused['progress'] == held['progress']
    assert abs(paused['value'] - held['value']) < 1e-7
    assert abs(held['presented'] - held['value']) < .75, 'Native pause drift'
    assert abs(held['presented'] - event('drop')['presented']) > 2, 'No visible fall'
    resumed = following(event('resume'))
    assert resumed['progress'] > held['progress']
    assert abs(following(event('return'))['presented']) < .75, 'Spring did not return to top'
    landed = next(e for e in events if e['name'] == 'landed' and e['restitution'] == 0)
    assert abs(landed['presented'] - landed['floor']) < .75
    reduced = following(next(e for e in events if e['name'] == 'reduced' and e['reduced']))
    assert reduced['progress'] == 1 and abs(reduced['presented'] - reduced['floor']) < .75
    suspended = event('suspend')
    assert suspended['paused'], 'Background did not suspend the owner'
    foreground = next(e for e in events[events.index(suspended)+1:] if e['name'] == 'foreground')
    assert not foreground['paused']
    assert events[-1]['name'] == 'disposed' and events[-1]['resources'] == 0
    return held['value'], resumed['value']

for file in sys.argv[1:]:
    report = json.loads(Path(file).read_text())
    held, resumed = verify(report)
    wrong = copy.deepcopy(report)
    pause = next(i for i,e in enumerate(wrong['events']) if e['name'] == 'pause')
    next(e for e in wrong['events'][pause+1:] if e['name'] == 'snapshot')['presented'] += 10
    try: verify(wrong)
    except AssertionError: pass
    else: raise AssertionError('Negative control was accepted')
    print('PASS', report['platform'], 'native fall, pause/resume, spring handoff, landing, Reduce Motion, lifecycle and negative control;', 'held=', held, 'resumed=', resumed)
