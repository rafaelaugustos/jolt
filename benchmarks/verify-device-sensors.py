"""Verify native snapshots around real OS input. These snapshots are not physical sensor evidence."""
import json
import sys
from pathlib import Path
r=json.loads(Path(sys.argv[1]).read_text());events=r['events']
def event(name):return next(e for e in events if e['name']==name)
def following(target):return next(e for e in events[events.index(target)+1:] if e['name']=='snapshot')
def close(a,b):return all(abs(x-y)<1e-7 for x,y in zip(a,b))
first=event('preview');moving=following(first)
assert moving['rotation']['frames']>20
assert moving['rotation']['frames']>moving['rotation']['callbacks']*10
assert any(abs(v)>.02 for v in moving['rotation']['values'][:3]), moving
assert any(abs(v)>.2 for v in moving['gravity']['values']),moving
assert moving['shine']['x']!=0,moving
assert moving['card']!=event('loaded')['card'],moving
paused=next(e for e in events[events.index(first)+1:] if e['name']=='pause');held=following(paused)
for kind in ['rotation','gravity']:
    assert held[kind]['frames']==paused[kind]['frames']
    assert close(held[kind]['values'],paused[kind]['values'])
assert held['active']==held['clock']==0
resumed=following(next(e for e in events[events.index(paused)+1:] if e['name']=='resume'))
assert resumed['rotation']['frames']>held['rotation']['frames'],resumed
reduced=event('reduced');still=following(reduced)
for kind in ['rotation','gravity']:assert still[kind]['frames']==reduced[kind]['frames']
assert still['active']==still['clock']==0
assert events[-1]['name']=='disposed'
assert events[-1]['active']==events[-1]['sources']==events[-1]['nodes']==0,events[-1]
shared=event('shared'); released=event('shared-released')
assert shared['sources']==released['sources']+1
assert shared['nodes']==released['nodes']+7
assert shared['active']==released['active']
if r['platform']=='android':assert shared['active']==2
# A synchronous JS task shares the UI thread here: native display work may stall too.
if any(e['name']=='busy-start' for e in events):
    a,b=event('busy-start'),event('busy-end')
    print('Native frames during blocked UI thread:',b['rotation']['frames']-a['rotation']['frames'])
print('PASS',r['platform'],'native bindings, coalescing, pause/resume, Reduce Motion, disposal')
print('Samples / frames / boundary callbacks:',moving['rotation']['samples'],moving['rotation']['frames'],moving['rotation']['callbacks'])
