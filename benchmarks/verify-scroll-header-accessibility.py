"""Validate native reader evidence; speech alone cannot prove a title handoff."""
import json
from pathlib import Path
import sys


def verify(platform, demo, reader=None):
    events = demo['events']
    assert events[-1]['name'] == 'disposed', 'Navigation must dispose the composition'
    assert demo['resources'] == {'sources': 0, 'nodes': 0}, 'Native resources remain'
    assert [e['extra'] for e in events if e['name'] == 'tap'] == ['song-36'], 'Wrong recycled row activated'
    assert not any(e['name'] == 'error' for e in events)
    phases = [e for e in events if e['name'] == 'phase']
    assert any(e['state']['offset'] >= e['geometry']['range'] for e in phases), 'No actual collapse'
    assert any(e['state']['phase'] == 'expanded' and abs(e['state']['offset']) < 1 for e in phases[2:]), 'No actual return'
    if platform == 'ios':
        headings = [e for e in events if e['name'] in ('focus-title', 'focus-compact-title')]
        assert [e['name'] for e in headings[:3]] == ['focus-title', 'focus-compact-title', 'focus-title']
        for e in headings:
            compact = e['name'] == 'focus-compact-title'
            current, other = (1, 0) if compact else (0, 1)
            assert e['accessibility'][current]['focused']
            assert e['accessibility'][current]['element'] and not e['accessibility'][current]['hidden']
            assert not e['accessibility'][other]['element'] and e['accessibility'][other]['hidden']
            assert (e['state']['offset'] >= e['geometry']['range'] * e['geometry'].get('focusHandoff', e['geometry']['handoff'])) == compact
            assert e['accessibility'][3]['hidden'] == compact, 'Covered hero descendants must not intercept touch exploration'
        assert sum(e['name'] == 'reader-scroll' for e in events) >= 4
    elif platform == 'android':
        checks = {e['name']: e for e in reader}
        for name, identifier in (
            ('expanded', 'scroll-header-title'),
            ('collapsed', 'scroll-header-compact-title'),
            ('expanded-again', 'scroll-header-title'),
            ('jump-keeps-control-focus', 'scroll-header-jump'),
            ('cover-control', 'scroll-header-top'),
            ('cover-control-returns-focus', 'scroll-header-title'),
        ):
            focused = checks[name]['focus']
            assert focused['id'] == identifier and focused['focused'] and focused['visible']
        assert checks['collapsed']['focus']['heading']
        assert not any(n.get('id') == 'scroll-header-title' and n['visible'] for n in checks['collapsed']['nodes'])
        assert checks['activated-row']['focus']['label'] == 'Play A softer place'
    else:
        raise ValueError('Expected ios or android')
    return {'platform': platform, 'handoff': True, 'recycledRow': 'song-36', 'disposed': True}


if __name__ == '__main__':
    platform, path, *reader_path = sys.argv[1:]
    print(json.dumps(verify(platform, json.loads(Path(path).read_text()),
        json.loads(Path(reader_path[0]).read_text()) if reader_path else None)))
