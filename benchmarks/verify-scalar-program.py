#!/usr/bin/env python3
"""Compile production scalar evaluators; compare them with the TS/Swift fixture oracle.
Needs macOS + clang + JDK and an org.json runtime jar (--json-jar or Gradle cache).
"""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'packages/swiftui/Tests/JoltCoreTests/Fixtures/scalar-vectors.json'
parser = argparse.ArgumentParser()
parser.add_argument('--json-jar', type=Path)
args = parser.parse_args()
jar = args.json_jar or next((Path.home() / '.gradle/caches/modules-2/files-2.1/org.json/json').glob('*/*/*.jar'), None)
if jar is None:
    parser.error('Provide --json-jar pointing to an org.json runtime jar (android.jar contains stubs).')
with tempfile.TemporaryDirectory(prefix='jolt-scalar-') as temporary:
    output = Path(temporary)
    subprocess.run(['clang', '-fobjc-arc', '-framework', 'Foundation', '-I', str(ROOT/'platforms/ios/src'), str(ROOT/'platforms/ios/src/JoltScalarProgram.m'), str(ROOT/'benchmarks/scalar-program/probe.m'), '-o', str(output/'probe')], check=True)
    subprocess.run(['javac', '-cp', str(jar), '-d', temporary, str(ROOT/'platforms/android/java/org/rafaelaugusto/jolt/ScalarProgram.java'), str(ROOT/'benchmarks/scalar-program/Probe.java')], check=True)
    for name, command in [('iOS kernel (macOS host)', [str(output/'probe'), str(FIXTURES)]), ('Android kernel (JVM host)', ['java', '-cp', os.pathsep.join([temporary,str(jar)]), 'org.rafaelaugusto.jolt.Probe', str(FIXTURES)])]:
        samples = subprocess.check_output(command, text=True).strip().splitlines()
        fixtures = json.loads(FIXTURES.read_text())
        assert len(samples) == len(fixtures)
        for fixture, sample in zip(fixtures,samples):
            value, velocity = map(float, sample.split(','))
            for key, actual in [('value',value),('velocity',velocity)]:
                expected=fixture['expected'][key]
                assert math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9), (name,fixture['name'],key,actual,expected)
        print(f'{name}: {len(fixtures)} shared vectors passed')
