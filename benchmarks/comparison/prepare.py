"""Prepare pinned Android comparison apps after the root Jolt build.

python3 benchmarks/comparison/prepare.py /absolute/path/to/flutter
Flutter must match scenario.json. Requires Node 22, Android SDK and Java 17+.
Generated projects stay in .local/comparison; this does not publish any package.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
fixture = Path(__file__).resolve().parent
scratch = root/'.local/comparison'
scratch.mkdir(parents=True, exist_ok=True)
flutter = str(Path(sys.argv[1]).resolve())
scenario = json.loads((fixture/'scenario.json').read_text())
version = json.loads(subprocess.check_output([flutter,'--version','--machine'],text=True))
assert version['frameworkRevision'] == scenario['versions']['flutterRevision'], version
(scratch/'flutter-version.json').write_text(json.dumps(version,indent=2)+'\n')

def run(args, cwd=root):
    subprocess.run(args, cwd=cwd, check=True)

dart = scratch/'flutter'
if not (dart/'android').is_dir():
    run([flutter,'create','--platforms=android','--org','dev.jolt.comparison',
         '--project-name','jolt_comparison',str(dart)])
for file in ['lib/main.dart','pubspec.yaml','pubspec.lock']:
    shutil.copy2(fixture/'flutter'/file,dart/file)
shutil.copy2(fixture/'flutter/MainActivity.kt',dart/'android/app/src/main/kotlin/dev/jolt/comparison/jolt_comparison/MainActivity.kt')
wrapper = dart/'android/gradle/wrapper/gradle-wrapper.properties'
wrapper.write_text(wrapper.read_text().replace('gradle-9.3.1-all.zip','gradle-9.3.1-bin.zip'))
run([flutter,'pub','get','--enforce-lockfile'],dart)

react = scratch/'react-native'
if not (react/'android').is_dir():
    run(['npx','--yes','@react-native-community/cli@20.2.0','init','JoltComparison',
         '--version',scenario['versions']['reactNative'],'--directory',str(react),'--skip-install'])
for file in ['App.tsx','babel.config.js','package.json','package-lock.json']:
    shutil.copy2(fixture/'reanimated'/file,react/file)
run(['npm','ci','--no-audit','--no-fund'],react)
run(['npm','ci','--no-audit','--no-fund'],fixture/'jolt')
run(['node','prepare.mjs'],fixture/'jolt')
print('Prepared. Build all three release APKs using benchmarks/comparison.md.')
