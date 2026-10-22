"""Validate observation, native composition and real app background/resume.
Usage: python3 benchmarks/value-consumers-android.py SERIAL OUTPUT_JSON
Requires the normal benchmark demo (debuggable Android APK for run-as).
"""
import json
from pathlib import Path
import shlex
import subprocess
import sys
import time

serial, destination = sys.argv[1:]
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'

def shell(*args):
    return subprocess.check_output(adb + ['shell', shlex.join(args)], text=True, timeout=30)

def result():
    try:
        return json.loads(shell('run-as', package, 'cat', 'files/jolt-value-consumers.json'))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return {}

shell('am', 'force-stop', package)
shell('run-as', package, 'rm', '-f', 'files/jolt-value-consumers.json')
shell('am', 'start', '-n', package + '/com.tns.NativeScriptActivity', '--es', 'playground', 'true',
      '--es', 'section', 'value observers', '--es', 'value-observer-checks', 'true')
backgrounded = False
deadline = time.monotonic() + 90
while time.monotonic() < deadline:
    report = result()
    status = report.get('status', '')
    if status == 'Background check ready' and not backgrounded:
        shell('input', 'keyevent', '3')
        shell('sleep', '2')
        shell('am', 'start', '-n', package + '/com.tns.NativeScriptActivity')
        backgrounded = True
    if status.startswith(('Passed', 'Failed')):
        Path(destination).write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
        assert status == 'Passed value consumer checks', status
        break
    time.sleep(.5)
else:
    raise RuntimeError('Native check timed out: ' + str(result()))
