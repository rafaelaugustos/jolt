"""Verify native text sizing and scroll anchors after actual OS font-size changes."""
import json
from pathlib import Path
import sys


def verify(report):
    events = report['events']
    assert events[-1]['name'] == 'disposed'
    assert report['resources'] == {'sources': 0, 'nodes': 0}
    assert sum(e['name'] == 'ready' for e in events) == 1, 'Screen was recreated'
    assert not any(e['name'] == 'error' for e in events)
    snapshots = [e for e in events if e['name'] == 'snapshot']
    assert len(snapshots) == 8, len(snapshots)
    normal_top, normal, large, long, top, dragged, jumped, restored = snapshots
    for event in snapshots:
        assert event['ready']
        if isinstance(event['typography']['systemScale'], str):
            assert event['host']['clips'] is True, 'Native header viewport is not clipped'
        g = event['geometry']
        assert g['expanded'] > g['minimum'] > 0
        assert g['section'] > 0
        for name in ('title', 'compactTitle'):
            label = event['typography'][name]
            assert label['width'] > 0 and label['height'] > 0
            assert 0 < label['requiredHeight'] <= label['height'] + 1, (name, label)
            assert not label.get('ellipsized'), (name, label)
        assert event['state']['visible'] < 20 and event['state']['total'] == 81
        for row in event['rows']:
            if row['key'] != 'header':
                assert abs(row['height'] - g['rowHeight']) < 1

    def anchor(event):
        pinned = event['geometry']['minimum'] + event['geometry']['section']
        rows = [r for r in event['rows'] if r['key'] != 'header' and r['top'] + r['height'] > pinned + 1]
        assert rows
        row = min(rows, key=lambda r: r['top'])
        return row['key'], row['top'] - pinned

    for before, after in ((normal, large), (large, long), (jumped, restored)):
        a, b = anchor(before), anchor(after)
        assert a[0] == b[0], ('Anchor item changed', a, b)
        assert abs(a[1] - b[1]) < 1, ('Anchor moved relative to pinned edge', a, b)
    assert anchor(normal)[0] == anchor(jumped)[0] == 'song-36'
    assert abs(anchor(normal)[1]) < 1 and abs(anchor(jumped)[1]) < 1, 'Inexact native jump'
    assert normal['typography']['systemScale'] == restored['typography']['systemScale']
    assert large['typography']['systemScale'] != normal['typography']['systemScale']
    for name in ('title', 'compactTitle'):
        # Android applies nonlinear SP scaling: large headings grow less than
        # small text. Require actual native growth without assuming a multiplier.
        assert large['typography'][name]['font'] > normal['typography'][name]['font'] + 1
        assert abs(restored['typography'][name]['font'] - normal['typography'][name]['font']) < 1
    assert long['typography']['compactTitle']['text'] != large['typography']['compactTitle']['text']
    assert long['geometry']['minimum'] > large['geometry']['minimum'] + 10
    assert normal_top['state']['offset'] < 1 and top['state']['offset'] < 1
    assert dragged['state']['offset'] > 0
    assert any(e['name'] == 'tap' and e['extra'] == 'song-36' for e in events)
    return { 'snapshots': len(snapshots), 'anchors': [anchor(e) for e in (normal, large, long, jumped, restored)],
             'compactHeights': [e['geometry']['minimum'] for e in (normal, large, long, restored)] }


if __name__ == '__main__':
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())), indent=2))
