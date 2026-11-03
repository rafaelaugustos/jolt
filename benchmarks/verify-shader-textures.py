"""Assert native shader reports and summarize measurements (standard library only).
Usage: python3 benchmarks/verify-shader-textures.py RESULTS_DIR
"""
import json, statistics, sys
from pathlib import Path
folder=Path(sys.argv[1]); summary={}
for platform,backend in [('ios','metal'),('android','agsl')]:
 data=json.loads((folder/(platform+'.json')).read_text());events=data['events']
 assert events and not any(e['name'].startswith('error') for e in events)
 assert all(e['diagnostics']['backend'] in ('waiting',backend) for e in events)
 control=next(i for i,e in enumerate(events) if e['name']=='negative-control')
 assert all(e['jsFrameRequests']==0 for e in events[:control]), 'Unexpected JS frame work'
 measured=[e for e in events[:control] if e['name']=='snapshot']
 assert any(e['diagnostics']['nativeParameterWrites']>10 for e in measured)
 assert any(e['jsFrameRequests']>0 for e in events[control:] if e['name']=='snapshot'), 'Observer negative control is ineffective'
 resize=[e for e in events if e['name']=='resized']
 assert len(resize)>=12
 for previous,current in zip(events,events[1:]):
  if previous['name']=='before-resize' and abs(previous['progress']-.5)<1e-6:
   assert current['name']=='resized' and abs(current['progress']-.5)<1e-6
 assert all(e['diagnostics']['textureBytes']>0 for e in resize)
 stopped=[e for e in events if e['name']=='stopped']
 assert stopped and all(e['diagnostics']['textureBytes']==0 and e['nativeNodes']==1 for e in stopped), 'Effect resources still owned after stop'
 summary[platform]={'nativeInputJSFrameRequests':0,'nativeWrites':max(e['diagnostics']['nativeParameterWrites'] for e in measured),
  'observerControlJSFrameRequests':max(e['jsFrameRequests'] for e in events),'resizeEvents':len(resize),
  'terminalTextureBytes':0,'retainedApplicationSpringNodes':1}
 if platform=='ios':
  paused=next(i for i,e in enumerate(events) if e['name']=='video-paused')
  resumed=next(i for i,e in enumerate(events) if e['name']=='video-resumed')
  frozen=events[paused]['diagnostics']
  assert all(e['diagnostics']['videoFrames']==frozen['videoFrames'] and abs(e['diagnostics']['videoTime']-frozen['videoTime'])<.01 for e in events[paused:resumed]), 'Paused video advanced during background/resize'
  assert len([e for e in events if e['name']=='video-replaced'])>=6
  video=[e for e in events if e['diagnostics']['videoFrames']>0]
  final=video[-1]['diagnostics'];assert final['videoFrames']>60 and final['textureBytes']==0
  assert all(e['jsFrameRequests']==0 for e in video)
  intervals=sorted(final['frameIntervalsMs']);assert 0<len(intervals)<=512
  baseline=events[next(i for i,e in enumerate(events) if e['name']=='video-start')-1]['processMemoryBytes']
  summary[platform]['video']={'decodedFrames':final['videoFrames'],'drawCallbacks':final['frames'],
   'drawIntervalMedianMs':statistics.median(intervals),'drawIntervalP95Ms':intervals[int((len(intervals)-1)*.95)],
   'cpuDrawTotalMs':final['renderCpuMs'],'completedMetalGpuTotalMs':final['renderGpuMs'],
   'cpuMsPerDrawCallback':final['renderCpuMs']/final['frames'],
   'processFootprintBeforeVideoBytes':baseline,'maxSampledProcessFootprintBytes':max(e['processMemoryBytes'] for e in video),
   'processFootprintAfterStopBytes':video[-1]['processMemoryBytes'],
   'knownTexturePeakEstimateBytes':final['peakTextureBytes'],'pausedFrameStableAcrossBackgroundAndResize':True,
   'scope':'iOS simulator; draw/encoding and command-buffer times, not presentation latency. Process footprint includes decoder/framework caches; texture peak is an estimate.'}
(folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
