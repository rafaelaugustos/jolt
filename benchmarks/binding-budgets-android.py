"""Real ADB gestures. Explicit serial; never changes device-wide settings."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

APP = 'org.nativescript.jolt.bindings'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('--case', choices=('drag-js', 'pan-native', 'scroll-js', 'header-native'))
    parser.add_argument('--recording', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    def adb(*words):
        return subprocess.check_output(['adb', '-s', args.serial, *words], text=True, timeout=25)

    def tree():
        for _ in range(4):
            try:
                adb('shell', 'uiautomator', 'dump', '/sdcard/jolt-binding-ui.xml')
                return ET.fromstring(adb('shell', 'cat', '/sdcard/jolt-binding-ui.xml'))
            except (subprocess.SubprocessError, ET.ParseError):
                time.sleep(.4)
        raise RuntimeError('Cannot read current UI hierarchy')

    def node(identifier):
        return next(n for n in tree().iter('node') if n.get('content-desc') == identifier or n.get('resource-id') == identifier)

    def rectangle(element):
        return list(map(int, re.findall(r'\d+', element.attrib['bounds'])))

    def tap(identifier):
        x1, y1, x2, y2 = rectangle(node(identifier))
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

    for kind in ([args.case] if args.case else ('drag-js', 'pan-native', 'scroll-js', 'header-native')):
        if (args.output/f'{kind}.json').exists():
            raise SystemExit('Choose a new output directory; evidence is never overwritten.')
        session = f'input-{kind}-{time.time_ns()}'
        adb('shell', 'am', 'force-stop', APP)
        adb('shell', 'am', 'start', '-n', APP+'/com.tns.NativeScriptActivity',
            '--es', 'budget-input', kind, '--es', 'budget-session', session,
            '--es', 'budget-recording', str(args.recording).lower())
        deadline = time.monotonic() + 20
        while True:
            try:
                if node('budget-input-state').get('text') == 'Ready': break
            except (StopIteration, RuntimeError): pass
            if time.monotonic() > deadline: raise RuntimeError('Input workload not ready: '+kind)
            time.sleep(.5)
        bounds = rectangle(node('budget-input-pad'))
        if args.recording: time.sleep(8)
        x1, y1, x2, y2 = bounds
        tap('budget-input-control')
        for _ in range(3):
            if kind in ('drag-js', 'pan-native'):
                a = (int(x1+(x2-x1)*.2), (y1+y2)//2)
                b = (int(x1+(x2-x1)*.8), (y1+y2)//2)
            else:
                a = ((x1+x2)//2, int(y1+(y2-y1)*.8))
                b = ((x1+x2)//2, int(y1+(y2-y1)*.25))
            for start, end in ((a,b),(b,a)):
                adb('shell', 'input', 'swipe', *map(str, (*start,*end,650)))
                time.sleep(.25)
        tap('budget-input-control')
        time.sleep(1)
        text = adb('shell', 'cat', f'/sdcard/Android/data/{APP}/files/binding-input-{kind}.json')
        report = json.loads(text)
        assert report['session'] == session and report['completed'] is True
        (args.output/f'{kind}.json').write_text(text)
        print(f'{kind}: captured', flush=True)


if __name__ == '__main__':
    main()
