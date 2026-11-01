"""Check actual reader focus against the stable key, native pose and route outcome."""
import json
import re
from pathlib import Path
import sys


def verify(platform, evidence, reader=None, large_text=False):
    gallery, collection = evidence['gallery'], evidence['collection']
    events = gallery['events']
    assert not any(e['event'] in ('error', 'route-rejected') for e in events)
    returned = [e for e in events if e['event'] == 'returned']
    released = [e for e in events if e['event'] == 'released']
    assert len(returned) == len(released) == 4, 'Expected four actual close operations'
    assert [e['key'] for e in returned] == ['place-1'] * 3 + ['place-2']
    for e in released:
        assert abs(e['extra']['pose']['scale'] - 1) < .02, 'Close must reset zoom before dismissal'
    assert [e['extra'] for e in returned] == [
        {'status': 'completed', 'navigated': True},
        {'status': 'completed', 'navigated': True},
        {'status': 'unavailable', 'navigated': True, 'reason': 'missing-target'},
        {'status': 'unavailable', 'navigated': True, 'reason': 'reduced-motion'},
    ], 'Moved items must complete their shared return; fallbacks must be explicit'
    settled = [e for e in events if e['event'] == 'settled' and e.get('native')]
    assert any(abs(e['state']['scale'] - 2.5) < .02 and e['time'] < released[0]['time'] for e in settled), 'No actual zoom before close'
    assert any(abs(e['state']['scale'] - 1) < .02 and e['time'] < released[0]['time'] for e in settled), 'No actual reset'
    assert any(e['key'] == 'place-2' and abs(e['state']['scale'] - 2.5) < .02 for e in settled), 'Reduced Motion must preserve zoom'
    for e in settled:
        assert abs(e['native']['scale'] - e['state']['scale']) < .02, 'Model/native zoom disagree'
        assert e['native']['visible'] and e['native']['alpha'] > .99
    assert collection['commits'] == 4 and collection['depth'] == 0 and collection['page'] == 'gallery'
    assert collection['state'] == 'disposed'
    assert collection['flights'] == collection['inputs'] == collection['retained'] == 0, 'Native navigation resources remain'
    assert all(t['visible'] for t in collection['tags']), 'A thumbnail remained hidden'
    snapshots = [s for s in collection['snapshots'] if s.get('state') == 'disposed']
    for key, index in [('place-1', 0), ('place-1', 59), ('place-1', -1), ('place-2', 1)]:
        assert any(s['key'] == key and s['index'] == index and (index == -1 or s.get('resolvedTag') == 'collection:' + key) for s in snapshots), ('Missing current-key resolution', key, index)
    expected = [('collection-place-1', 0), ('collection-place-1', 59), ('collection-heading', -1), ('collection-place-2', 1)]
    for i, (identifier, index) in enumerate(expected):
        end = released[i + 1]['time'] if i + 1 < len(released) else float('inf')
        assert any(e['id'] == identifier and e['index'] == index and returned[i]['time'] <= e['time'] < end for e in collection['focusEvents']), ('No native focus after return settled', identifier, index)
    if platform == 'android':
        checks = {c['name']: c for c in reader}
        for name, identifier in [('thumbnail', 'collection-place-1'), ('second-thumbnail', 'collection-place-2'), ('first-thumbnail-again', 'collection-place-1'), ('returned', 'collection-place-1'), ('moved-return', 'collection-place-1'), ('removed-return', 'collection-heading'), ('reduced-return', 'collection-place-2')]:
            focus = checks[name]['focus']
            assert focus.get('id') == identifier and focus['focused'] and focus['visible'], ('Wrong actual reader focus', name)
        assert checks['removed-return']['focus']['heading']
    elif platform == 'ios':
        for marker in ['opened', 'returned', 'moved-return', 'removed-return', 'reduced-return']:
            assert 'JOLT_CHECK ' + marker in reader, ('Missing VoiceOver checkpoint', marker)
        for speech in ['Open Cala Serena Button', 'Open Quiet dunes Button', 'Cala Serena Heading', 'Zoom in Button', 'Reset view Button', 'Keep a little wonder. Heading']:
            assert speech in reader, ('Missing actual VoiceOver speech', speech)
    else:
        raise ValueError('Expected ios or android')
    if large_text:
        verify_large_text(platform, evidence, reader)
    return {'platform': platform, 'returns': 4, 'movedIndex': 59, 'deletedFallback': 'collection-heading', 'nativeResources': 0}


def verify_large_text(platform, evidence, reader):
    expected = 'UICTContentSizeCategoryAccessibilityM' if platform == 'ios' else 2
    assert evidence['textConfiguration']['requested'] == expected
    samples = [e for e in evidence['gallery']['events'] if e['event'] == 'settled' and e.get('native')]
    assert {e['key'] for e in samples} == {'place-1', 'place-2'}
    for sample in samples:
        typography = sample['typography']
        assert typography['systemScale'] == expected, 'Reader run did not use enlarged system text'
        assert typography['title']['font'] > 28 and typography['zoom']['font'] >= 21, 'Native labels did not enlarge'
        root, header, footer, view = [sample['layout'][k] for k in ('root', 'header', 'footer', 'viewport')]
        assert view['width'] > 40 and view['height'] >= 64, 'No usable photo viewport'
        assert header['y'] >= -1 and view['y'] >= header['y'] + header['height'] - 1
        assert view['y'] + view['height'] <= footer['y'] + 1, 'Controls cover the photo'
        assert footer['y'] + footer['height'] <= root['height'] + 1
        for name in ('title', 'note', 'close', 'zoom', 'reset', 'move', 'remove'):
            label = typography[name]
            assert label['width'] > 0 and 0 < label['requiredHeight'] <= label['height'] + 1, ('Clipped enlarged text', name)
            assert not label.get('ellipsized'), name
            if name not in ('title', 'note'):
                assert label['width'] >= 44 and label['height'] >= 44, ('Small control', name)
        buttons = [typography[name] for name in ('zoom', 'reset', 'move', 'remove')]
        assert all(a['x'] + a['width'] <= b['x'] + 1 for a, b in zip(buttons, buttons[1:])), 'Overlapping controls'
    if platform == 'ios':
        initial = re.search(r'JOLT_TEXT_INITIAL position=([\d.]+)% largerSizes=(true|false)', reader)
        restored = re.search(r'JOLT_TEXT_RESTORED position=([\d.]+)% largerSizes=(true|false)', reader)
        assert initial and restored and initial.groups() == restored.groups(), 'System text settings were not restored'
        assert re.search(r'JOLT_TEXT_LARGE position=[\d.]+% largerSizes=1', reader), 'Accessibility text sizes were not enabled'
        for control, count in [('zoom', 3), ('reset', 1), ('move', 1), ('remove', 1)]:
            assert reader.count('JOLT_READER_CONTROL gallery-' + control) == count, ('Missing actual reader traversal', control)
    else:
        configuration = evidence['textConfiguration']
        assert configuration['initialFont'] == configuration['restoredFont'] and configuration['readerSettingsRestored'], 'Settings were not restored'
        checks = {c['name']: c for c in reader}
        assert checks['title']['focus']['heading'], 'Title must remain a heading'
        controls = [c for c in reader if c['name'] in ('gallery-zoom', 'gallery-reset', 'gallery-move', 'gallery-remove')]
        assert [c['name'] for c in controls] == ['gallery-zoom', 'gallery-reset', 'gallery-zoom', 'gallery-move', 'gallery-remove', 'gallery-zoom']
        for control in controls:
            node = control['focus']
            assert node['focused'] and node['visible'] and node['id'] == control['name']
            left, top, right, bottom = node['bounds']
            assert right > left and bottom > top, ('Empty reader target', control['name'])


if __name__ == '__main__':
    large_text = sys.argv[-1] == "--large-text"
    platform, path, reader_path = sys.argv[1:-1] if large_text else sys.argv[1:]
    reader = Path(reader_path).read_text()
    print(json.dumps(verify(platform, json.loads(Path(path).read_text()), json.loads(reader) if platform == 'android' else reader, large_text)))
