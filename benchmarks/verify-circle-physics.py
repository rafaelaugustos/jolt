"""Verify boundary snapshots from real XCTest/ADB input, including a negative control."""
import copy
import json
import math
from pathlib import Path
import sys

def verify(data):
 events=data['events'];snapshots=[e for e in events if e['name']=='snapshot']
 assert snapshots, 'missing native snapshots'
 assert any(e['snapshot']['status']=='sleeping' and not e['snapshot']['clock'] for e in snapshots), 'world never slept'
 assert max(e['snapshot']['dragStarts'] for e in snapshots)>=1, 'missing real drag'
 assert max(e['snapshot']['dragEnds'] for e in snapshots)>=1, 'missing release'
 assert max(e['snapshot']['dragMoves'] for e in snapshots)>=2, 'missing pointer movement'
 first=snapshots[0]['snapshot'];drag=next(e['snapshot'] for e in snapshots if e['snapshot']['dragEnds'])
 assert drag['contacts']>first['contacts'], 'no contact resolution after drag'
 assert any(math.hypot(b['vx'],b['vy'])>5 for b in drag['bodies']), 'release did not continue moving'
 holds=[e['snapshot'] for e in snapshots if e['snapshot']['status']=='paused' and not e['reduced']]
 assert len(holds)>=2 and holds[0]['frames']==holds[1]['frames'] and holds[0]['bodies']==holds[1]['bodies'], 'pause changed the scene'
 assert all(not h['clock'] for h in holds), 'paused clock still active'
 reduced=[e for e in events if e['reduced']]
 assert len(reduced)>=3 and len({e['snapshot']['frames'] for e in reduced})==1, 'reduced motion kept stepping'
 assert all(not e['snapshot']['clock'] for e in reduced), 'reduced clock still active'
 for e in snapshots:
  s=e['snapshot'];w,h=e['size']['width'],e['size']['height']
  assert s['steps']<=16*s['frames'], 'unbounded frame work'
  for i,b in enumerate(s['bodies']):
   assert b['radius']-.1<=b['x']<=w-b['radius']+.1 and b['radius']-.1<=b['y']<=h-b['radius']+.1, 'escaped bounds'
   assert math.hypot(b['vx'],b['vy'])<=1200.01, 'speed exceeded contract'
   actual=e['presented'][i];assert actual, 'missing native presentation'
   assert abs(actual['x']-b['x'])<.5 and abs(actual['y']-b['y'])<.5, 'native view differs from physics'
   for other in s['bodies'][i+1:]:
    assert math.hypot(b['x']-other['x'],b['y']-other['y'])>=b['radius']+other['radius']-.5, 'unresolved overlap'
 assert len({round(e['size']['height']) for e in snapshots})>1, 'resize not exercised'
 bg=next(e for e in events if e['name']=='background')
 assert not bg['snapshot']['clock'], 'background clock active'
 assert snapshots[-1]['snapshot']['frames']>bg['snapshot']['frames'], 'foreground did not resume'
 last=events[-1];assert last['name']=='disposed' and last['worlds']==0 and last['clocks']==0 and last['resources']==0, 'native world leaked'
 assert last['snapshot']['status']=='disposed' and not last['snapshot']['clock']
 return {'platform':data['platform'],'nativeFrames':last['snapshot']['frames'],'nativeSteps':last['snapshot']['steps'],'nativeProcessingMs':round(last['snapshot']['processingMs'],3),'nativeDragStarts':last['snapshot']['dragStarts'],'nativeDragEnds':last['snapshot']['dragEnds'],'disposedWorlds':last['worlds']}

for filename in sys.argv[1:]:
 data=json.loads(Path(filename).read_text());result=verify(data)
 bad=copy.deepcopy(data)
 for e in bad['events']:
  if e['name']=='snapshot':e['presented'][0]['x']+=10;break
 try:verify(bad)
 except AssertionError:pass
 else:raise AssertionError('Negative control accepted an incorrect native view')
 result['negativeControl']='rejected 10-DIP native presentation error'
 print(json.dumps(result))
