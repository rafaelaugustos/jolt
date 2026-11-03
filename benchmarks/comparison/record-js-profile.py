"""Record actual allocation-probe progress separately from all timing collection."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('serial')
parser.add_argument('output', type=Path)
parser.add_argument('--adb-port', type=int, default=5037)
args = parser.parse_args()
prefix = ['adb', '-P', str(args.adb_port), '-s', args.serial]
def adb(*words): return subprocess.check_output([*prefix, *map(str, words)], text=True, timeout=60)
assert adb('shell', 'getprop', 'ro.kernel.qemu').strip() != '1'
assert not subprocess.run([*prefix, 'shell', 'pidof', 'screenrecord'], capture_output=True, text=True).stdout.strip()
package = 'dev.jolt.comparison.jswork'
args.output.parent.mkdir(parents=True, exist_ok=True)
assert not args.output.exists(), 'Preserve the existing recording'
adb('shell', 'am', 'force-stop', package)
adb('shell', 'am', 'start', '-W', '-n', package+'/com.tns.NativeScriptActivity')
pid = int(adb('shell', 'pidof', package).strip())
remote = '/sdcard/jolt-js-profile-record.mp4'
recording_pid = None
with args.output.with_suffix('.log').open('w') as log:
    recorder = subprocess.Popen([*prefix, 'shell', 'screenrecord', '--size', '720x1280',
                                 '--bit-rate', '4000000', '--time-limit', '30', remote], stdout=log, stderr=subprocess.STDOUT)
    try:
        time.sleep(1)
        recording_pid = adb('shell', 'pidof', 'screenrecord').strip()
        assert re.fullmatch(r'\d+', recording_pid)
        time.sleep(11)
    finally:
        if recording_pid: adb('shell', 'kill', '-2', recording_pid)
        recorder.wait(timeout=20)
report = json.loads(adb('shell', 'cat', '/sdcard/Android/data/'+package+'/files/js-work.json'))
assert report['processId'] == pid and report['status'] == 'complete'
assert 'optimize_for_size' not in report['v8Flags'], 'This caption requires the default runtime profile'
adb('pull', remote, args.output)
assert hashlib.sha256(args.output.read_bytes()).hexdigest() == adb('shell', 'sha256sum', remote).split()[0]
installed = adb('shell', 'pm', 'path', package).strip().removeprefix('package:')
metadata = {'deviceFingerprint': adb('shell', 'getprop', 'ro.build.fingerprint').strip(),
            'apkSha256': adb('shell', 'sha256sum', installed).split()[0],
            'videoSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
            'scope': 'Actual native progress; screen recording adds work. Not a primary timing sample.',
            'recordedWorkload': report}
args.output.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n')
adb('shell', 'am', 'force-stop', package)
print('Saved physical allocation-probe recording:', args.output)
