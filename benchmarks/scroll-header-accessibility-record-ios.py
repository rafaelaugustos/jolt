"""Run and export XCTest's native physical-iPhone recording (Xcode/iOS 27).

Usage: python SCRIPT DEVICE_UDID XCODE_PROJECT DERIVED_DATA OUTPUT_DIRECTORY
The output directory must be new. No USB capture or generated frames are used.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

device, project, derived, output = sys.argv[1:]
out = Path(output).resolve()
out.mkdir(parents=True, exist_ok=False)
result = out / 'results.xcresult'
log = out / 'xctest.log'
with log.open('w') as stream:
    subprocess.run([
        'xcodebuild', 'test-without-building', '-project', project,
        '-scheme', 'DocsTests', '-destination', 'platform=iOS,id=' + device,
        '-derivedDataPath', derived, '-parallel-testing-enabled', 'NO',
        '-resultBundlePath', str(result), '-only-testing:DocsTests/DocsTests/testVoiceOver',
    ], stdout=stream, stderr=subprocess.STDOUT, check=True, timeout=240)

subprocess.run([
    'xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(result),
    '--output-path', str(out / 'attachments'), '--filter', '*.mp4',
], check=True)
manifest = json.loads((out / 'attachments/manifest.json').read_text())
videos = [a for test in manifest for a in test['attachments'] if a['deviceId'] == device]
assert len(videos) == 1, 'Expected one native recording from the requested device'
video = videos[0]
text = log.read_text()
start = float(re.search(r'JOLT_RECORD_START ([\d.]+)', text)[1])
stop = float(re.search(r'JOLT_RECORD_STOP ([\d.]+)', text)[1])
offset = start - video['timestamp']
assert offset >= 0 and stop > start
subprocess.run([
    'ffmpeg', '-v', 'error', '-ss', str(offset), '-i', str(out / 'attachments' / video['exportedFileName']),
    '-t', str(stop - start), '-vf', 'fps=30,scale=720:-2', '-c:v', 'libx264',
    '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    str(out / 'scroll-header-voiceover-ios.mp4'),
], check=True)
subprocess.run([
    'xcrun', 'devicectl', 'device', 'copy', 'from', '--device', device,
    '--domain-type', 'appDataContainer', '--domain-identifier', 'org.nativescript.jolt.benchmark',
    '--source', 'Documents/jolt-scroll-header.json', '--destination', str(out / 'demo.json'),
], check=True)
data = json.loads((out / 'demo.json').read_text())
assert data['events'][-1]['name'] == 'disposed'
assert data['resources'] == {'sources': 0, 'nodes': 0}
assert [e for e in data['events'] if e['name'] == 'tap'][-1]['extra'] == 'song-36'
assert any(e['name'] == 'focus-compact-title' for e in data['events'])
assert sum(e['name'] == 'focus-title' for e in data['events']) >= 2
print('VoiceOver traversal, native activation and disposal passed:', out)
