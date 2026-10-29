"""Verify boundary diagnostics from real OS input; no synthetic app scroll events.
Usage: python3 benchmarks/verify-scroll-header.py audit.json
       python3 benchmarks/verify-scroll-header.py disposed.json --lifecycle reentry.json
"""
import json
import math
from pathlib import Path
import sys
r=json.loads(Path(sys.argv[1]).read_text());events=r['events']
def event(name):return next(e for e in events if e['name']==name)
def previous(target):return events[events.index(target)-1]
def close(a,b,tolerance=1):assert abs(a-b)<tolerance,(a,b)
def same_rows(a,b):
    common=set(x['key'] for x in a['rows']) & set(x['key'] for x in b['rows'])-{'header'}
    assert common,'No common realized row at anchor boundary'
    for key in common:
        close(next(x['top'] for x in a['rows'] if x['key']==key),next(x['top'] for x in b['rows'] if x['key']==key))
def verify_reload_rotation():
    before,after=event('reload-before'),event('reload-after')
    assert after['ready'], 'Native scroll source did not reattach after a pending layout was cancelled'
    close(after['state']['offset'],before['state']['offset'])
    same_rows(before,after)
    landscape=next(e for e in events if e.get('viewport',{}).get('width',0)>before['viewport']['width'])
    close(landscape['geometry']['expanded'],landscape['headerHeight'])
    assert landscape['ready']
    close(landscape['state']['offset']-after['state']['offset'],landscape['geometry']['spacer']-after['geometry']['spacer'])
    same_rows(after,landscape)
    portrait=next(e for e in events[events.index(landscape)+1:] if e.get('viewport',{}).get('width')==before['viewport']['width'] and e['name']=='snapshot')
    assert portrait['ready']
    close(portrait['state']['offset'],before['state']['offset'])
    same_rows(before,portrait)
assert not any(e['name']=='error' for e in events),events
if len(sys.argv)>2 and sys.argv[2]=='--lifecycle':
    verify_reload_rotation()
    assert events[-1]['name']=='disposed'
    assert r['resources']['sources']==r['resources']['nodes']==0,r['resources']
    leaving=event('leaving')
    if 'decelerating' in leaving:
        assert leaving['decelerating'], 'iOS navigation did not interrupt deceleration'
    fresh=json.loads(Path(sys.argv[3]).read_text())
    snapshot=next(e for e in reversed(fresh['events']) if e['name']=='snapshot')
    assert snapshot['ready'] and snapshot['state']['offset']>0
    assert fresh['resources']['sources']==fresh['resources']['nodes']==1,fresh['resources']
    print('PASS: anchored reload/rotation, fling navigation cleanup and one active source on reentry')
    sys.exit(0)
cover=event('cover');before=next(e for e in reversed(events[:events.index(cover)]) if e['name']=='snapshot')
assert cover['geometry']['expanded']>before['geometry']['expanded']+50
close(cover['state']['offset']-before['state']['offset'],cover['geometry']['spacer']-before['geometry']['spacer'])
insert=event('insert')
close(insert['state']['offset']-cover['state']['offset'],insert['geometry']['rowHeight']+insert['geometry']['divider'])
for a,b in [(before,cover),(cover,insert)]:
    same_rows(a,b)
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
if any(e['name']=='reload-before' for e in events): verify_reload_rotation()
assert events[-1]['name']=='disposed',events[-1]
assert r['resources']['sources']==r['resources']['nodes']==0,r['resources']
print('PASS: native geometry, anchored cover/insertion/reload/rotation, recycled row tap, programmatic target, reduced motion, short/empty, zero resources')
print('Native updates / semantic callbacks at long scroll:',jump['state']['updates'],jump['state']['callbacks'])
print('Minimum offset:',min(e.get('state',{}).get('minimumOffset',0) for e in events))
