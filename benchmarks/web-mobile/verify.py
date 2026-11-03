"""Validate actual mobile browser session reports, independently of capture commands."""
import json
from pathlib import Path
import sys
for filename in sys.argv[1:]:
    report = json.loads(Path(filename).read_text())
    events = report['events']; names = [e['name'] for e in events]
    assert report['secure'] and report['scope'].startswith('simulator/emulator')
    assert all(name in names for name in ['ready', 'haptic', 'permission', 'keyboard', 'paused', 'resumed', 'disposed'])
    assert any(e.get('keyboard', {}).get('visible') and e['focused'] == 'message' for e in events)
    assert len({e['orientation'] for e in events}) > 1
    disposed = next(e for e in events if e['name'] == 'disposed')
    assert disposed['diagnostics']['disposed']
    assert all(value == 0 for value in disposed['diagnostics']['resources'].values())
    assert disposed['rotation']['status'] == disposed['gravity']['status'] == 'disposed'
    assert names.index('paused') < names.index('resumed') < names.index('disposed')
    print('PASS actual browser keyboard, permission/status, rotation, pause/resume and zero resources:', filename)
