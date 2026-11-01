"""Verify native refresh evidence. Usage: python3 SCRIPT android|ios REPORT.json
The iOS host maps JOLT_CHECK markers to ordered native snapshots.
"""
import json
from pathlib import Path
import sys

LABELS=['initial','short-pull','loading','success','failure','retry','scrolled-loading','anchored','reduced-loading','reduced-success','short-success','empty-success','unload-cancelled','background-cancelled']

def verify(platform, evidence):
    checks={c['label']:c['event'] for c in evidence['checks']}
    assert set(checks)==set(LABELS), 'Missing test checkpoints'
    events=evidence['report']['events']
    def state(name):return checks[name]['state']
    def counts(name,requests,commits):
        e=checks[name]
        assert (e['refreshRequests'],e['refreshCommits'])==(requests,commits),(name,e['refreshRequests'],e['refreshCommits'])
    counts('initial',0,0);counts('short-pull',0,0)
    counts('loading',1,0)
    assert state('loading')['refresh']=='refreshing'
    counts('success',1,1);counts('failure',2,1);counts('retry',3,2)
    for name in ['short-pull','success','failure','retry']:
        assert state(name)['refresh']=='idle',name
        assert abs(state(name)['offset'])<1,(name,state(name)['offset'])
    assert any(e['name']=='refresh-error' for e in events),'Failure path absent'
    counts('scrolled-loading',4,2);counts('anchored',4,3)
    assert state('scrolled-loading')['refresh']=='refreshing'
    assert state('scrolled-loading')['offset']>200
    before=next(e for e in events if e['name']=='refresh-before-commit' and e['extra']==4)
    after=checks['anchored']
    common=set(r['key'] for r in before['rows']) & set(r['key'] for r in after['rows'])-{'header'}
    assert common,'No common keyed rows'
    for key in common:
        top=lambda e:next(r['top'] for r in e['rows'] if r['key']==key)
        assert abs(top(before)-top(after))<1,(key,top(before),top(after))
    counts('reduced-loading',5,3)
    assert state('reduced-loading')['refresh']=='refreshing'
    counts('reduced-success',5,4);counts('short-success',6,5);counts('empty-success',7,6)
    assert state('short-success')['total']==4
    assert state('empty-success')['total']==2
    counts('unload-cancelled',8,6);counts('background-cancelled',9,6)
    for name in ['reduced-success','short-success','empty-success','unload-cancelled','background-cancelled']:
        assert checks[name]['ready'] and state(name)['refresh']=='idle',name
        assert abs(state(name)['offset'])<1,(name,state(name)['offset'])
    disposed=next(e for e in events if e['name']=='disposed')
    assert disposed['refreshRequests']==10 and disposed['refreshCommits']==6
    assert evidence['report']['resources']=={'sources':0,'nodes':0}
    assert not any(e['name']=='error' for e in events)
    assert events[-1]['refreshCommits']==6,'Late response mutated disposed data'
    assert len([e for e in events if e['name']=='refresh-cancelled'])==3,'Cancellation results missing'
    print('PASS:',platform,'short pull, one refresh, error/retry, current keyed anchor, reduced motion, short/empty, unload/background/disposal cancellation and zero native resources')

if __name__=='__main__':verify(sys.argv[1],json.loads(Path(sys.argv[2]).read_text()))
