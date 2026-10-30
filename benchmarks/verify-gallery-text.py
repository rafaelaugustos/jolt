"""Check native text/layout and real gallery control/navigation observations."""
import json
from pathlib import Path
import sys


def verify(report):
    events = report['gallery']['events']
    assert not any(e['event'] in ('error', 'route-rejected') for e in events)
    samples = [e for e in events if e['event'] == 'text-snapshot']
    assert len(samples) == 8, len(samples)
    normal, zoomed, enlarged, reset, landscape, portrait, restored, reopened = samples
    previous = 0
    for sample in samples:
        assert sample['time'] > previous
        previous = sample['time']
        assert sample['ready'] and sample['route'] == 'gallery-photo-detail' and sample['depth'] == 1
        assert not sample['state']['pending']
        assert sample['native']['visible'] and sample['native']['alpha'] > .99
        for prop in ('scale', 'x', 'y'):
            assert abs(sample['state'][prop] - sample['native'][prop]) < .02, prop
        root, header, footer, view = [sample['layout'][k] for k in ('root', 'header', 'footer', 'viewport')]
        assert view['width'] > 40 and view['height'] >= 64, ('No usable photo viewport', view)
        assert header['y'] >= -1 and view['y'] >= header['y'] + header['height'] - 1
        assert view['y'] + view['height'] <= footer['y'] + 1, 'Controls cover the photo'
        assert footer['y'] + footer['height'] <= root['height'] + 1
        for name in ('title', 'note', 'close', 'zoom', 'reset', 'move', 'remove'):
            label = sample['typography'][name]
            assert label['width'] > 0 and 0 < label['requiredHeight'] <= label['height'] + 1, (name, label)
            assert not label.get('ellipsized'), (name, label)
            if name not in ('title', 'note'):
                assert label['width'] >= 44 and label['height'] >= 44, (name, 'Small control')
        buttons = [sample['typography'][name] for name in ('zoom', 'reset', 'move', 'remove')]
        for a, b in zip(buttons, buttons[1:]):
            assert a['x'] + a['width'] <= b['x'] + 1, 'Overlapping buttons'
    for sample in (zoomed, enlarged):
        assert abs(sample['state']['scale'] - 2.5) < .01
    for sample in (normal, reset, landscape, portrait, restored, reopened):
        assert abs(sample['state']['scale'] - 1) < .01
    for name in ('title', 'zoom'):
        assert enlarged['typography'][name]['font'] > normal['typography'][name]['font'] + 1
        assert abs(restored['typography'][name]['font'] - normal['typography'][name]['font']) < 1
        assert abs(reopened['typography'][name]['font'] - enlarged['typography'][name]['font']) < 1
    assert normal['typography']['systemScale'] == restored['typography']['systemScale']
    assert enlarged['typography']['systemScale'] != normal['typography']['systemScale']
    assert landscape['viewport']['width'] > portrait['viewport']['width']
    assert landscape['viewport']['height'] < portrait['viewport']['height']
    assert any(e['event'] == 'settled' and reset['time'] < e['time'] < landscape['time']
               and abs(e.get('state', {}).get('scale', 0) - 2.5) < .01 for e in events), 'Landscape zoom did not run'
    assert reopened['typography']['title']['text'] != normal['typography']['title']['text']
    returned = [e for e in events if e['event'] == 'returned']
    assert len(returned) == 2 and all(e['extra']['navigated'] and e['extra']['status'] == 'completed' for e in returned)
    assert len([e for e in events if e['event'] == 'released']) == 2
    final = report['collection']
    assert final['state'] == 'disposed' and final['page'] == 'gallery' and final['depth'] == 0
    assert final['commits'] == 2 and final['index'] == 2 and final['key'] == 'place-3'
    assert final['flights'] == final['inputs'] == final['retained'] == 0
    assert final['tags'] and all(tag['visible'] for tag in final['tags'])
    shared = [e['shared'] for e in final['events'] if e.get('shared') and e.get('outcome') == 'completed']
    assert len(shared) == 2 and all(e['status'] == 'ready' for e in shared)
    return {'snapshots': len(samples), 'sharedReturns': 2, 'finalNativeNavigationResources': 0}


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
