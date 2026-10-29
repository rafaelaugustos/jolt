"""Verify recorded Android gallery lifecycle observations; no fake driver values."""
import json
from pathlib import Path
import sys


def verify(report):
    observations = report['observations']
    samples = {item['check']: item['event'] for item in observations}
    assert len(samples) == 11, 'Missing lifecycle observations'
    previous = 0
    for name, sample in samples.items():
        assert sample['time'] > previous, (name, 'Stale observation')
        previous = sample['time']
        assert sample['ready'] and sample['route'] == 'gallery-photo-detail'
        assert sample['depth'] == 1 and not sample['state']['pending']
        assert sample['viewport']['height'] > 0
        assert sample['native']['visible'] and sample['native']['alpha'] > .99
        for prop in ['scale', 'x', 'y']:
            assert abs(sample['state'][prop] - sample['native'][prop]) < .02, (name, prop)
    portrait, landscape = samples['zoomed portrait'], samples['zoomed landscape']
    assert landscape['viewport']['width'] > portrait['viewport']['width']
    assert landscape['viewport']['height'] < portrait['viewport']['height']
    for sample in [portrait, landscape]:
        assert abs(sample['state']['scale'] - 2.5) < .01
    assert abs(samples['pan after rotation']['state']['y'] - landscape['state']['y']) > 1
    assert abs(samples['portrait restored']['viewport']['width'] - portrait['viewport']['width']) < 1
    assert samples['pinch and pan after resume']['state']['scale'] > 1.1
    cancelled = samples['dismissal cancelled after resume']['state']
    assert abs(cancelled['y']) < 1 and abs(cancelled['scale'] - 1) < .01
    events = report['gallery']['events']
    suspended = next(e for e in events if e['event'] == 'suspended')
    resumed = next(e for e in events if e['event'] == 'resumed')
    assert suspended['time'] < resumed['time'] <= samples['resumed']['time']
    assert resumed['depth'] == suspended['depth'] == 1
    assert len([e for e in events if e['event'] == 'released']) == 4
    assert len([e for e in events if e['event'] == 'ordinary-return']) == 1
    returned = [e for e in events if e['event'] == 'returned']
    assert len(returned) == 3 and all(e['extra']['navigated'] and e['extra']['status'] == 'completed' for e in returned)
    unloaded = [e for e in events if e['event'] == 'unloaded']
    assert len(unloaded) >= 4 and all(not e['ready'] for e in unloaded)
    assert not any(e['event'] in ['error', 'route-rejected'] for e in events)
    final = report['collection']
    assert final['state'] == 'disposed' and final['page'] == 'gallery' and final['depth'] == 0
    assert final['commits'] == 3
    assert len([e for e in final['events'] if e.get('outcome') == 'completed' and e.get('shared', {}).get('status') == 'ready']) == 3
    assert final['flights'] == final['inputs'] == final['retained'] == 0
    assert final['tags'] and all(tag['visible'] for tag in final['tags'])
    return {'observations': len(samples), 'returns': 4, 'finalNativeNavigationResources': 0}


if __name__ == '__main__':
    print('PASS:', json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
