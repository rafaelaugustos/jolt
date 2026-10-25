#!/usr/bin/env python3
"""Compile and exercise the actual C/Java sensor math against canonical physical poses."""
import json
import math
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CASES = [
    ([0, 0, 0, 1], 0, [0, 0, 0]),
    ([math.sqrt(.5), 0, 0, math.sqrt(.5)], 0, [math.pi / 2, 0, 0]),
    ([0, math.sin(.3), 0, math.cos(.3)], 0, [0, .6, 0]),
    ([0, 0, math.sin(.4), math.cos(.4)], 0, [0, 0, .8]),
    ([math.sin(.2), 0, 0, math.cos(.2)], 90, [0, -.4, 0]),
    ([0, math.sin(.2), 0, math.cos(.2)], 90, [.4, 0, 0]),
    ([math.sin(.2), 0, 0, math.cos(.2)], 180, [-.4, 0, 0]),
    ([math.sin(.2), 0, 0, math.cos(.2)], 270, [0, .4, 0]),
    ([0, -2 * math.sin(.3), 0, -2 * math.cos(.3)], 0, [0, .6, 0]),
]
VECTORS = [(0, [3, 4, -9]), (90, [4, -3, -9]), (180, [-3, -4, -9]), (270, [-4, 3, -9])]


def run(*args):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=30).stdout


def verify():
    cc = shutil.which('cc') or shutil.which('clang')
    javac = shutil.which('javac')
    java = shutil.which('java')
    if not all([cc, javac, java]):
        raise RuntimeError('Install a C compiler and JDK to run native sensor math checks.')
    with tempfile.TemporaryDirectory(prefix='jolt-sensor-math-') as temporary:
        root = pathlib.Path(temporary)
        c = '#include <stdio.h>\n#include "JoltSensorMath.h"\nint main(void) {\n'
        j = 'import org.rafaelaugusto.jolt.SensorMath;\npublic class SensorMathCheck { public static void main(String[] args) {\n'
        expected = []
        for q, angle, euler in CASES:
            literals = ','.join(repr(v) for v in q)
            c += f'{{double q[]={{{literals}}},p[]={{0,0,0,1}},o[7];JoltSensorNormalize(q);JoltSensorRotation(q,{angle},p,o);printf("%.12f %.12f %.12f %.12f\\n",o[0],o[1],o[2],o[6]);}}\n'
            j += f'{{double[] q={{{literals}}},p={{0,0,0,1}};SensorMath.normalize(q);double[] o=SensorMath.rotation(q,{angle},p);System.out.println(o[0]+" "+o[1]+" "+o[2]+" "+o[6]);}}\n'
            expected.append(euler + [abs(q[3]) / math.sqrt(sum(v*v for v in q))])
        for angle, vector in VECTORS:
            c += f'{{double v[]={{3,4,-9}},o[3];JoltSensorVector(v,{angle},o);printf("%.12f %.12f %.12f\\n",o[0],o[1],o[2]);}}\n'
            j += f'{{double[] o=SensorMath.vector(new double[]{{3,4,-9}},{angle});System.out.println(o[0]+" "+o[1]+" "+o[2]);}}\n'
            expected.append(vector)
        c += 'double zero[]={0,0,0,0},bad[]={NAN,0,0,1};printf("%d %d\\n",JoltSensorNormalize(zero),JoltSensorNormalize(bad));return 0;}\n'
        j += 'System.out.println((SensorMath.normalize(new double[]{0,0,0,0})?1:0)+" "+(SensorMath.normalize(new double[]{Double.NaN,0,0,1})?1:0));}}\n'
        expected.append([0, 0])
        (root / 'check.c').write_text(c)
        (root / 'SensorMathCheck.java').write_text(j)
        run(cc, '-I', str(ROOT / 'platforms/ios/src'), str(root / 'check.c'), '-lm', '-o', str(root / 'check'))
        run(javac, '-d', temporary, str(ROOT / 'platforms/android/java/org/rafaelaugusto/jolt/SensorMath.java'), str(root / 'SensorMathCheck.java'))
        outputs = {'ios_math': run(str(root / 'check')), 'android_math': run(java, '-cp', temporary, 'SensorMathCheck')}
        for platform, output in outputs.items():
            rows = [[float(v) for v in row.split()] for row in output.strip().splitlines()]
            assert len(rows) == len(expected)
            for i, (got, want) in enumerate(zip(rows, expected)):
                assert len(got) == len(want)
                assert all(abs(a-b) < 1e-9 for a,b in zip(got,want)), (platform,i,got,want)
        print(json.dumps({'casesPerPlatform': len(expected), 'platforms': list(outputs), 'passed': True}))


if __name__ == '__main__':
    verify()
