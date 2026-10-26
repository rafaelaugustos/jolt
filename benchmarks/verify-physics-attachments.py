"""Check real native attachment/snap audits and reject a corrupted target choice."""
import copy
import json
import math
from pathlib import Path
import sys

def body(event,name):
 return next(b for b in event['snapshot']['bodies'] if b['id']==name)
def verify(data):
 events=[e for e in data['events'] if 'snapshot' in e]
 snaps=[e for e in events if e['name']=='snapshot']
 assert snaps and snaps[0]['snapshot']['status']=='sleeping', 'initial world did not sleep'
 assert all(e['snapshot']['guides']==1 for e in events if e['name']!='disposed'), 'unexpected native tether resource count'
 releases=set();velocity_affected=False;choices=set()
 for e in snaps:
  w,h=e['size']['width'],e['size']['height'];s=e['snapshot']
  assert s['steps']<=s['frames']*16,'unbounded frame work'
  for i,b in enumerate(s['bodies']):
   p=e['presented'][i];assert p and abs(p['x']-b['x'])<.5 and abs(p['y']-b['y'])<.5,'native presentation drift'
   assert b['radius']-.1<=b['x']<=w-b['radius']+.1 and b['radius']-.1<=b['y']<=h-b['radius']+.1,'escaped bounds'
   assert math.hypot(b['vx'],b['vy'])<=1200.01,'unbounded speed'
  a,b=s['bodies'];assert math.hypot(a['x']-b['x'],a['y']-b['y'])>=a['radius']+b['radius']-.5,'overlap'
  tether=body(e,'tether');anchor=tether['attachment']['anchor']
  assert abs(anchor['y']-h*.14)<.01,'anchor did not follow layout'
  assert abs(tether['attachment']['length']-72)<.01,'resize changed rest length'
  magnet=body(e,'magnet');snap=magnet['snap']
  if snap:
   assert abs(snap['point']['x']-w*(.2+.3*snap['index']))<.01 and abs(snap['point']['y']-h*.78)<.01,'snap target drift after resize'
  if s['status']=='sleeping':
   assert not s['clock'],'sleep retained clock'
   assert abs(tether['x']-anchor['x'])<.3 and abs(tether['y']-(anchor['y']+72+750/180))<.3,'spring did not return to gravity equilibrium'
   assert snap and snap['settled'] and math.hypot(magnet['x']-snap['point']['x'],magnet['y']-snap['point']['y'])<.25,'snap failed to settle'
  release=magnet['release']
  if release:
   key=tuple(release[k] for k in ['x','y','vx','vy'])
   if key not in releases:
    releases.add(key);assert math.hypot(release['vx'],release['vy'])<=1200.01
    def nearest(projection):
     x=release['x']+release['vx']*projection;y=release['y']+release['vy']*projection
     return min(range(3),key=lambda i:math.hypot(x-w*(.2+.3*i),y-h*.78))
    assert snap and snap['index']==nearest(.12),'native release selected the wrong snap target'
    choices.add(snap['index']);velocity_affected |= nearest(.12)!=nearest(0)
 assert len(releases)>=2 and choices=={0,2} and velocity_affected,'missing slow/velocity-aware releases'
 returned=[e for e in snaps if e['snapshot']['dragEnds']==1 and e['snapshot']['status']=='sleeping']
 assert returned,'no settled attachment after real drag'
 arm=next(e for e in events if e['name']=='armed-cancel');cancel=next(e for e in events if e['name']=='cancelled-drag')
 assert cancel['snapshot']['dragStarts']>arm['snapshot']['dragStarts'] and cancel['snapshot']['dragCancels']>arm['snapshot']['dragCancels'],'cancellation did not interrupt a real held body'
 assert cancel['snapshot']['dragEnds']==arm['snapshot']['dragEnds'],'cancel incorrectly counted as release'
 assert body(cancel,'magnet')['snap']['index']==body(arm,'magnet')['snap']['index'],'cancel chose a new dock'
 assert not body(cancel,'magnet')['held'] and body(cancel,'magnet')['release']==body(arm,'magnet')['release'],'cancel replaced release state'
 held=[e for e in snaps if e['snapshot']['status']=='paused' and not e['reduced']]
 assert len(held)>=2 and held[0]['snapshot']['frames']==held[1]['snapshot']['frames'] and held[0]['presented']==held[1]['presented'],'paused world moved'
 reduced=[e for e in events if e['reduced']]
 assert len(reduced)>=4 and len({e['snapshot']['frames'] for e in reduced})==1 and all(not e['snapshot']['clock'] for e in reduced),'Reduce Motion kept stepping'
 assert all(e['presented']==reduced[0]['presented'] for e in reduced),'reduced snap selection moved a view'
 sizes=[e['size']['height'] for e in snaps]
 assert min(sizes)<sizes[0]-20 and abs(sizes[-1]-sizes[0])<1,'resize did not restore original bounds'
 assert any(abs(body(e,'tether')['attachment']['anchor']['x']-e['size']['width']*.32)<.01 for e in snaps),'anchor retarget not exercised'
 bg=next(e for e in events if e['name']=='background');assert not bg['snapshot']['clock'],'background clock active'
 assert snaps[-1]['snapshot']['frames']>bg['snapshot']['frames'],'foreground did not resume'
 last=events[-1];assert last['name']=='disposed' and last['worlds']==0 and last['clocks']==0 and last['resources']==0 and last['snapshot']['guides']==0,'native resources leaked'
 assert last['snapshot']['status']=='disposed' and not last['snapshot']['clock']
 return {'platform':data['platform'],'nativeFrames':last['snapshot']['frames'],'nativeSteps':last['snapshot']['steps'],'nativeProcessingMs':round(last['snapshot']['processingMs'],3),'drags':last['snapshot']['dragStarts'],'releases':last['snapshot']['dragEnds'],'cancels':last['snapshot']['dragCancels'],'releaseChoices':sorted(choices),'velocityAffectedChoice':velocity_affected,'disposedWorlds':last['worlds'],'disposedGuides':last['snapshot']['guides']}

for filename in sys.argv[1:]:
 data=json.loads(Path(filename).read_text());result=verify(data)
 bad=copy.deepcopy(data)
 e=next(e for e in bad['events'] if e['name']=='snapshot' and body(e,'magnet')['release'])
 body(e,'magnet')['snap']['index']=1
 try:verify(bad)
 except AssertionError:pass
 else:raise AssertionError('Negative control accepted a wrong native snap choice')
 result['negativeControl']='rejected corrupted native snap target';print(json.dumps(result))
