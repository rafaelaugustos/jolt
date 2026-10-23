"""Check demo-owned evidence after navigating away during real OS input."""
import json
from pathlib import Path
import subprocess


def verify_navigation(platform, device):
    bundle = 'org.nativescript.jolt.benchmark'
    if platform == 'ios':
        container = subprocess.check_output(
            ['xcrun', 'simctl', 'get_app_container', device, bundle, 'data'], text=True).strip()
        report = json.loads((Path(container)/'Documents/gesture-navigation.json').read_text())
    else:
        report = json.loads(subprocess.check_output(
            ['adb', '-s', device, 'shell', 'run-as', bundle, 'cat', 'files/gesture-navigation.json'], text=True))
    assert report['activeAtNavigation'] is True, report
    assert report['cancellations'] == 1 and report['endings'] == 0, report
    assert report['disposed'] is True, report
    assert report['remainingNodes'] == report['baselineNodes'], report
    print('PASS navigation during active gesture: '+json.dumps(report), flush=True)


if __name__ == '__main__':
    import sys
    verify_navigation(*sys.argv[1:])
