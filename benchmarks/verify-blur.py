"""Check native blur reports and optionally real screenshot detail reduction (Pillow).
Usage: python3 benchmarks/verify-blur.py REPORT.json [REPORT.json ...]
Put blur-clear/half/full.png alongside a report to check the screenshots too.
"""
import copy
import json
from pathlib import Path
import sys

def verify(data):
    events=data['events'];snaps=[e for e in events if e['name']=='snapshot']
    assert len(snaps)>=13
    assert snaps[0]['amount']==0
    backend='ios-material' if data['platform']=='ios' else 'android-render-effect'
    for e in snaps:
        assert e['backend']==backend and e['attached'] and e['live']==1
        assert 0<=e['amount']<=1 and abs(e['amount']-e['appliedAmount'])<.001
    midpoint=[e for e in snaps if e['paused'] and abs(e['amount']-.5)<.001]
    assert len(midpoint)>=5
    assert len(set(e['frames'] for e in midpoint))==1, 'paused native clock advanced'
    widths=[e['width'] for e in midpoint]
    assert min(widths)<=241 and max(widths)>300 and abs(widths[-1]-widths[0])<1
    invalid=next(e for e in events if e['name']=='rejected')
    assert '0..1' in invalid['error'] and invalid['amount']==.5
    before=None;interruptions=0
    for e in events:
        if e['name']=='before-change':before=e
        elif e['name']=='change' and before and not e['reduced']:
            assert abs(e['amount']-before['amount'])<.03, 'retarget jumped'
            if .01<before['amount']<.99:interruptions+=1
    assert interruptions>0
    loop=next(i for i,e in enumerate(events) if e['name']=='drift')
    repeated=[e for e in events[loop:] if e['name']=='snapshot']
    assert all(e['paused'] and e['amount']==0 and e['nativeAnimations']==1 for e in repeated[:2])
    assert repeated[0]['frames']==repeated[1]['frames']
    assert repeated[2]['amount']==0 and repeated[2]['nativeAnimations']==0
    reduced=[e for e in snaps if e['reduced']]
    assert [e['amount'] for e in reduced]==[1,0] and all(e['nativeAnimations']==0 for e in reduced)
    background=next(e for e in events if e['name']=='background')
    foreground=next(e for e in events if e['name']=='foreground' and e['time']>background['time'])
    assert abs(background['amount']-foreground['amount'])<.03
    assert snaps[-1]['amount']>background['amount']+.05, 'foreground failed to resume'
    last=events[-1]
    assert last['name']=='disposed' and not last['attached']
    assert all(last[k]==0 for k in ['live','active','resources','appliedAmount','nativeAnimations'])
    return {'platform':data['platform'],'checkpoints':len(snaps),'nativeRetargets':interruptions,
            'midpoint':.5,'pausedFramesStable':True,'resizeWidths':sorted(set(widths)),
            'backgroundResumed':True,'retainedEffects':0}

def pixels(folder):
    from PIL import Image, ImageChops, ImageStat
    scores={}
    for name in ['clear','half','full']:
        image=Image.open(folder/f'blur-{name}.png').convert('L');w,h=image.size
        # A fixed interior region of the postcard, excluding controls and edges.
        image=image.crop((int(w*.15),int(h*.42),int(w*.85),int(h*.66)))
        a=image.crop((1,0,image.width,image.height));b=image.crop((0,0,image.width-1,image.height))
        scores[name]=ImageStat.Stat(ImageChops.difference(a,b)).mean[0]
    assert scores['clear']>scores['half']*3 and scores['half']>scores['full']*1.1, scores
    return {name:round(value,4) for name,value in scores.items()}

for filename in sys.argv[1:]:
    path=Path(filename);data=json.loads(path.read_text());result=verify(data)
    bad=copy.deepcopy(data)
    next(e for e in bad['events'] if e['name']=='snapshot' and e['paused'])['appliedAmount']=0
    try:verify(bad)
    except AssertionError:pass
    else:raise AssertionError('A missing native effect passed the oracle')
    result['negativeControl']='rejected missing applied blur'
    if (path.parent/'blur-clear.png').exists():result['pixelDetail']=pixels(path.parent)
    print(json.dumps(result))
