"""Verify boundary diagnostics from real OS input; no synthetic app scroll events.
Usage: python3 benchmarks/verify-scroll-header.py audit.json
"""
import json
import math
from pathlib import Path
import sys
r=json.loads(Path(sys.argv[1]).read_text());events=r['events']
def event(name):return next(e for e in events if e['name']==name)
def previous(target):return events[events.index(target)-1]
def close(a,b,tolerance=1):assert abs(a-b)<tolerance,(a,b)
cover=event('cover');before=next(e for e in reversed(events[:events.index(cover)]) if e['name']=='snapshot')
assert cover['geometry']['expanded']>before['geometry']['expanded']+50
close(cover['state']['offset']-before['state']['offset'],cover['geometry']['spacer']-before['geometry']['spacer'])
insert=event('insert')
close(insert['state']['offset']-cover['state']['offset'],insert['geometry']['rowHeight']+insert['geometry']['divider'])
for a,b in [(before,cover),(cover,insert)]:
    common=set(x['key'] for x in a['rows']) & set(x['key'] for x in b['rows'])-{'header'}
    assert common,'No common realized row at anchor boundary'
    for key in common:
        close(next(x['top'] for x in a['rows'] if x['key']==key),next(x['top'] for x in b['rows'] if x['key']==key))
jump=next(e for e in events[events.index(event('jump-request')):] if e['name']=='snapshot')
g=jump['geometry'];close(jump['state']['offset'],g['range']+g['divider']+35*(g['rowHeight']+g['divider']))
assert event('tap')['extra']=='song-35'
assert jump['state']['first']>20 and jump['state']['visible']<15
assert jump['state']['updates']>jump['state']['callbacks']*5
for e in events:
    state=e.get('state');g=e.get('geometry');poses=e.get('poses')
    if not state or not g or not poses or e['name'] not in ['snapshot','cover','insert']:continue
    q=state['offset'];close(poses['header']['y'],-min(q,g['range']))
    close(poses['section']['y'],max(g['minimum'],g['expanded']-q))
    for row in e['rows']:
        if row['key']!='header':close(row['height'],g['rowHeight'])
empty=event('empty');assert empty['state']['total']==1
assert event('short')['state']['total']==3
reduced=event('reduced');assert reduced['poses']['artwork']['scale']==1
assert events[-1]['name']=='disposed',events[-1]
assert r['resources']['sources']==r['resources']['nodes']==0,r['resources']
print('PASS: native geometry, anchored cover/insertion, recycled row tap, programmatic target, reduced motion, short/empty, zero resources')
print('Native updates / semantic callbacks at long scroll:',jump['state']['updates'],jump['state']['callbacks'])
print('Minimum offset:',min(e.get('state',{}).get('minimumOffset',0) for e in events))
