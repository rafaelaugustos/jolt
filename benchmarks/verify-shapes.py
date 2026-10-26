"""Verify real native shape reports, including a corrupted-native-geometry negative control."""
import copy
import json
from pathlib import Path
import re
import sys

PLAY = [34,24,54,36,54,64,34,76,54,36,78,50,78,50,54,64]
PAUSE = [34,26,46,26,46,74,34,74,60,26,72,26,72,74,60,74]
def surface(event, name):
    return next(s for s in event['surfaces'] if s['id'] == name)
def points(s):
    return [float(n) for n in re.findall(r'[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?', s['d'], re.I)]
def near(a, b, tolerance=.05):
    assert len(a) == len(b) and all(abs(x-y) <= tolerance for x,y in zip(a,b)), (a,b)
def pose(event):
    return [[s['strokeStart'], s['strokeEnd'], *points(s)] for s in event['surfaces']]
def verify(data):
    events = data['events']; snaps = [e for e in events if e['name'] == 'snapshot']
    assert snaps and all(s['attached'] for s in snaps[0]['surfaces'])
    assert all(e['layers'] == 4 for e in snaps), 'unexpected native surface count'
    for e in snaps:
        for s in e['surfaces']:
            assert 0 <= s['strokeStart'] <= 1 and 0 <= s['strokeEnd'] <= 1
            assert s['bounds'] and all(abs(v) < 1000 for v in s['bounds'])
        s = surface(e, 'symbol'); p = points(s)
        near(s['bounds'], [min(p[::2]), min(p[1::2]), max(p[::2])-min(p[::2]), max(p[1::2])-min(p[1::2])])
    midpoint = [e for e in snaps if e['paused'] and abs(surface(e,'check')['strokeEnd']-.5)<.01]
    assert len(midpoint) >= 5, 'missing paused/invalid/resize checkpoints'
    for e in midpoint:
        near(points(surface(e,'symbol')), [(a+b)/2 for a,b in zip(PLAY,PAUSE)])
        near(surface(e,'symbol')['bounds'], [34,25,41,50])
        for name in ['check','ring','line']:
            assert abs(surface(e,name)['strokeEnd']-.5)<.01
        for a,b in zip(pose(e),pose(midpoint[0])): near(a,b,.0001)
    widths = [surface(e,'symbol')['size']['width'] for e in midpoint]
    assert min(widths) <= 101 and max(widths) >= 149 and abs(widths[-1]-widths[0])<1, 'resize round trip missing'
    rejected = next(e for e in events if e['name'] == 'rejected')
    assert 'matching normalized' in rejected['error']
    for a,b in zip(pose(rejected),pose(midpoint[0])): near(a,b,.0001)
    before = None; interruptions = 0
    for e in events:
        if e['name'] == 'before-morph': before = e
        if e['name'] == 'morph' and before and not e['reduced']:
            a = points(surface(before,'symbol')); b = points(surface(e,'symbol'))
            near(a,b,.5)
            if any(abs(x-y)>.1 for x,y in zip(a,PLAY)) and any(abs(x-y)>.1 for x,y in zip(a,PAUSE)):
                interruptions += 1
    assert interruptions >= 1, 'no interruption of an in-flight native morph'
    loop_index = next(i for i,e in enumerate(events) if e['name'] == 'loop')
    loop_snaps = [e for e in events[loop_index:] if e['name'] == 'snapshot' and not e['reduced']]
    assert len(loop_snaps) >= 3
    for e in loop_snaps[:2]:
        assert e['paused'] and surface(e,'ring')['nativeAnimations']>0
        assert abs(surface(e,'ring')['strokeEnd'])<.01, 'paused delay advanced'
    assert surface(loop_snaps[2],'ring')['nativeAnimations']==0 and abs(surface(loop_snaps[2],'ring')['strokeEnd'])<.01, 'reverse repeat did not return'
    reduced = next(e for e in snaps if e['reduced'])
    assert all(s['nativeAnimations']==0 for s in reduced['surfaces'])
    assert all(surface(reduced,name)['strokeEnd']==1 for name in ['check','ring','line'])
    near(points(surface(reduced,'symbol')),PLAY)
    background = next(e for e in events if e['name']=='background')
    foreground = next(e for e in events if e['name']=='foreground' and e['time']>background['time'])
    near([surface(background,'check')['strokeEnd']], [surface(foreground,'check')['strokeEnd']], .03)
    assert surface(snaps[-1],'check')['strokeEnd'] > surface(background,'check')['strokeEnd'] + .05, 'background unload lost continuation'
    last = events[-1]
    assert last['name']=='disposed' and last['layers']==0 and last['resources']==0
    assert all(not s['attached'] and s['nativeAnimations']==0 for s in last['surfaces']), 'retained native shape playback'
    return {'platform':data['platform'], 'surfaces':4, 'checkpoints':len(snaps), 'nativeMorphInterruptions':interruptions, 'midpointNativeBounds':[34,25,41,50], 'resizeWidths':sorted(set(widths)), 'backgroundUnloadResumed':True, 'retainedSurfaces':last['layers']}

assert len(sys.argv)>1, 'Pass iOS/Android JSON report paths.'
for filename in sys.argv[1:]:
    data = json.loads(Path(filename).read_text()); result = verify(data)
    bad = copy.deepcopy(data)
    e = next(e for e in bad['events'] if e['name']=='snapshot' and e['paused'])
    surface(e,'symbol')['bounds'][0] += 5
    try: verify(bad)
    except AssertionError: pass
    else: raise AssertionError('Corrupted native geometry passed the oracle')
    result['negativeControl'] = 'rejected corrupted native geometry'
    print(json.dumps(result))
