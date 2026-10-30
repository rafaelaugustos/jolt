"""Check manually held physical poses and explicitly injected native-service failures.

The human poses are coarse sign/unit checks, not metrology or fusion calibration.
"""
import json
import math
import sys
from pathlib import Path

POSES = ['face-up', 'portrait', 'landscape-left', 'landscape-right', 'portrait-return']

def verify(report):
    assert report['schemaVersion'] == 1
    assert report['mode'] in ('recovery-only', 'manual-poses-and-recovery')
    assert report['platform'] in ('ios', 'android') and report['input']=='real-hardware'
    assert report['failureMode']=='demo-only-service-dropout'
    assert report['device']['physical'] is True
    events=report['events']
    assert [e['sequence'] for e in events]==list(range(len(events)))
    assert all(e['time']>=report['session'] for e in events)
    assert all(a['time']<=b['time'] for a,b in zip(events,events[1:]))
    poses=[] if report.get('mode')=='recovery-only' else POSES
    names=['baseline']+poses+['before-dropout','no-data','error-held','recovered']
    if report['platform']=='ios': names+=['injected-access-failure','access-recovered']
    assert [e['name'] for e in events]==names+['disposed']
    by={e['name']:e for e in events}
    for name in ('baseline','disposed'):
        assert all(v==0 for v in by[name]['native'].values()),name
    expected={kind+'-'+coordinates for kind in ('rotation','gravity') for coordinates in ('interface','device')}
    active=1 if report['platform']=='ios' else 2
    for name in poses+['before-dropout','recovered']+(['access-recovered'] if report['platform']=='ios' else []):
        e=by[name]
        assert e['native']['active']==active and e['native']['sources']==4
        assert set(e['sources'])==expected
        for key,s in e['sources'].items():
            assert s['available'] and s['status']=='active' and s['error'] is None,(name,key,s)
            assert s['samples']>=s['frames']>0 and s['timestamp']>0
            assert all(math.isfinite(v) for v in s['values'])
            values=s['values'][3:] if key.startswith('rotation') else s['values']
            target=1 if key.startswith('rotation') else 9.80665
            assert abs(math.sqrt(sum(v*v for v in values))-target)<(.001 if target==1 else .4)
    for name in poses:
        e=by[name]
        g=e['sources']['gravity-interface']['values']
        axis=2 if name=='face-up' else 1
        assert g[axis]<-8.5,(name,'gravity must point down in the visible screen',g)
        assert all(abs(g[i])<2.5 for i in range(3) if i!=axis),(name,'hold the requested pose',g)
        d=e['sources']['gravity-device']['values']
        radians=math.radians(e['orientation']); c,s=math.cos(radians),math.sin(radians)
        mapped=[c*d[0]+s*d[1],-s*d[0]+c*d[1],d[2]]
        assert max(abs(a-b) for a,b in zip(mapped,g))<.4,(name,'coordinate remapping')
        qd=e['sources']['rotation-device']['values'][3:]
        qi=e['sources']['rotation-interface']['values'][3:]
        expected_q=[c*qd[0]+s*qd[1],-s*qd[0]+c*qd[1],qd[2],qd[3]]
        assert abs(sum(a*b for a,b in zip(expected_q,qi)))>.995,(name,'quaternion basis')
    if poses:
        assert by['portrait']['orientation']==by['portrait-return']['orientation']==0
        assert {by['landscape-left']['orientation'],by['landscape-right']['orientation']}=={90,270}
    held,still=by['no-data'],by['error-held']
    assert held['time']-by['before-dropout']['time']>=3000
    assert still['time']-held['time']>=900
    for event in (held,still):
        assert event['native']['active']==event['native']['clock']==0
        assert set(event['sources']) == expected
        for source in event['sources'].values():
            assert source['status']=='error' and source['error']=='no-data'
    for key in expected:
        a,b=held['sources'][key],still['sources'][key]
        assert all(a[field]==b[field] for field in ('values','samples','frames','callbacks','timestamp'))
        recovered=by['recovered']['sources'][key]
        assert recovered['frames']>b['frames'] and recovered['timestamp']>b['timestamp']
    if report['platform']=='ios':
        failure=by['injected-access-failure']
        assert failure['native']['active']==failure['native']['clock']==0
        assert set(failure['sources']) == expected
        for key,source in failure['sources'].items():
            assert source['status']=='error' and source['error']=='demo-injected-access-failure'
            assert by['access-recovered']['sources'][key]['frames']>source['frames']
    return {'physicalPoses':len(poses),'orientations':[by[n]['orientation'] for n in poses],
            'nativeRecovery':True,'finalResources':0}

if __name__=='__main__':
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())),indent=2))
