"""Validate and summarize retained native image profile reports. No dependencies.
Usage: python3 benchmarks/image-profile-report.py RESULTS_DIRECTORY
"""
import importlib.util
import json
from pathlib import Path
import sys
spec=importlib.util.spec_from_file_location('measure',Path(__file__).parent/'comparison/android.py')
measure=importlib.util.module_from_spec(spec);spec.loader.exec_module(measure)
folder=Path(sys.argv[1])
result={'scope':'Simulator/emulator draw-callback intervals, not GPU or presentation time. Primary runs without screen recording.', 'platforms':{}}
for platform in ['ios','android']:
    data=json.loads((folder/f'{platform}.json').read_text())
    events=[e for e in data['events'] if e['name']=='finished' and e['run']<=12]
    assert len(events)==12
    assert all(e['textureBytes']==0 and 0<len(e['frameIntervalsMs'])<=512 for event in events for e in event['effects'])
    cancelled=next(e for e in data['events'] if e['name']=='cancelled')
    assert all(e['textureBytes']==0 for e in cancelled['effects'])
    rows=[]
    for label,start,end in [('initial-ripple',1,1),('warm-ripple',2,6),('first-two-dissolves',7,7),('warm-two-dissolves',8,12)]:
        selected=[e for e in events if start<=e['run']<=end];effects=[x for e in selected for x in e['effects']]
        rows.append({'case':label,'runs':len(selected),
            'setupMs':measure.distribution([e['preparationMs'] for e in effects]),
            'drawIntervalMs':measure.distribution([n for e in effects for n in e['frameIntervalsMs']]),
            'maxCombinedOwnedTextureBytes':max(sum(x['peakTextureBytes'] for x in e['effects']) for e in selected),
            'terminalOwnedTextureBytes':0})
    result['platforms'][platform]={'density':data['density'],'imageDips':events[0]['images'][0]['size'],'cases':rows}
(folder/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS 12 finite runs and cancellation per backend, bounded samples and zero terminal texture ownership')
