"""Verify native demo lifecycle evidence; never treats explicit input as hardware acceptance."""
import json
import sys
from pathlib import Path

def verify(report):
    events = report['events']
    paused = next(i for i, event in enumerate(events) if event['name'] == 'paused')
    held = next(event for event in events[paused + 1:] if event['name'] == 'snapshot')
    before = next(event for event in reversed(events[:paused]) if event['name'] == 'snapshot')
    after_resume = next(i for i in range(paused + 1, len(events)) if events[i]['name'] == 'resumed')
    moving = next(event for event in events[after_resume + 1:] if event['name'] == 'snapshot')
    expected = ['rotation', 'gravity', 'acceleration', 'linearAcceleration', 'gyroscope', 'magneticField']
    units = ['rad', 'm/s²', 'm/s²', 'm/s²', 'rad/s', 'µT']
    assert [s['kind'] for s in before['sources']] == expected
    assert [s['unit'] for s in before['sources']] == units
    assert before['input'] == held['input'] == moving['input'] == 'explicit-test-input'
    assert events[paused]['active'] == held['active'] == 0
    for a, b, c, d in zip(before['sources'], events[paused]['sources'], held['sources'], moving['sources']):
        assert a['frames'] > 0 and a['status'] == 'replaying', a
        assert b['frames'] == c['frames'] and b['values'] == c['values'], (b, c)
        assert d['frames'] > c['frames'] and d['status'] == 'replaying', (c, d)
    disposed = events[-1]
    assert disposed['name'] == 'disposed'
    assert disposed['active'] == disposed['sourceCount'] == 0, disposed
    assert all(s['status'] == 'disposed' for s in disposed['sources'])
    return {'platform': report['platform'], 'sources': len(expected), 'nativePreviewAndLifecycle': 'passed', 'physicalAcceptance': 'not-established'}

if __name__ == '__main__':
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()))))
