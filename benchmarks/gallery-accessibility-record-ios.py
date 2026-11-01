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
    ], stdout=stream, stderr=subprocess.STDOUT, check=True, timeout=360)

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
    str(out / 'gallery-voiceover-ios.mp4'),
], check=True)
for name in ('gallery', 'collection'):
    subprocess.run([
        'xcrun', 'devicectl', 'device', 'copy', 'from', '--device', device,
        '--domain-type', 'appDataContainer', '--domain-identifier', 'org.nativescript.jolt.benchmark',
        '--source', 'Documents/jolt-' + name + '.json', '--destination', str(out / (name + '.json')),
    ], check=True)
evidence = {name: json.loads((out / (name + '.json')).read_text()) for name in ('gallery', 'collection')}
evidence['platform'] = 'Physical iPhone, actual VoiceOver service and XCTest touch input'
(out / 'ios.json').write_text(json.dumps(evidence, indent=2) + '\n')
(out / 'voiceover.txt').write_text('\n'.join(line for line in text.splitlines() if line.startswith('JOLT_')) + '\n')
subprocess.run([sys.executable, str(Path(__file__).with_name('verify-gallery-accessibility.py')), 'ios', str(out / 'ios.json'), str(out / 'voiceover.txt')], check=True)
print('Native VoiceOver recording and verified reports exported:', out)
