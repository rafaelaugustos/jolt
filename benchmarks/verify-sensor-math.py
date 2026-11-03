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


def verify(include_web=False):
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
        web_expected = list(expected)
        # Same physical situations, expressed in each platform's native units.
        # Face up at rest: proper +g, gravity -g, linear zero. Translating +X:
        # proper and linear +2 m/s². Free fall: proper zero, linear -g.
        acceleration_cases = [(-1, 9.80665, False, 9.80665),
                              (-1, 9.80665, True, -9.80665),
                              (0, 0, False, 0),
                              (-2 / 9.80665, 2, False, 2),
                              (1, -9.80665, False, -9.80665)]
        for apple, android, gravity, canonical in acceleration_cases:
            flag = 'true' if gravity else 'false'
            c += f'printf("%.12f\\n",JoltSensorAcceleration({apple},{flag}));\n'
            j += f'System.out.println(SensorMath.acceleration({android},{flag}));\n'
            expected.append([canonical])
        c += 'double zero[]={0,0,0,0},bad[]={NAN,0,0,1};printf("%d %d\\n",JoltSensorNormalize(zero),JoltSensorNormalize(bad));return 0;}\n'
        j += 'System.out.println((SensorMath.normalize(new double[]{0,0,0,0})?1:0)+" "+(SensorMath.normalize(new double[]{Double.NaN,0,0,1})?1:0));}}\n'
        expected.append([0, 0])
        (root / 'check.c').write_text(c)
        (root / 'SensorMathCheck.java').write_text(j)
        run(cc, '-I', str(ROOT / 'platforms/ios/src'), str(root / 'check.c'), '-lm', '-o', str(root / 'check'))
        run(javac, '-d', temporary, str(ROOT / 'platforms/android/java/org/rafaelaugusto/jolt/SensorMath.java'), str(root / 'SensorMathCheck.java'))
        outputs = {'ios_math': run(str(root / 'check')), 'android_math': run(java, '-cp', temporary, 'SensorMathCheck')}
        if include_web:
            payload = json.dumps({'rotations': CASES, 'vectors': VECTORS})
            script = "import { rotationValues, interfaceVector } from './dist/web/sensors.js'; const cases = " + payload + "; for (const [q, angle] of cases.rotations) { const length=Math.hypot(...q); const out=rotationValues(q.map(v=>v/length),angle,[0,0,0,1]); console.log([out[0],out[1],out[2],out[6]].join(' ')); } for (const [angle] of cases.vectors) console.log(interfaceVector([3,4,-9],angle).join(' '));"
            outputs['web_math'] = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, check=True, text=True, capture_output=True).stdout
        for platform, output in outputs.items():
            rows = [[float(v) for v in row.split()] for row in output.strip().splitlines()]
            platform_expected = web_expected if platform == 'web_math' else expected
            assert len(rows) == len(platform_expected)
            for i, (got, want) in enumerate(zip(rows, platform_expected)):
                assert len(got) == len(want)
                assert all(abs(a-b) < 1e-9 for a,b in zip(got,want)), (platform,i,got,want)
        print(json.dumps({'casesPerPlatform': {platform: len(output.strip().splitlines()) for platform, output in outputs.items()}, 'platforms': list(outputs), 'passed': True}))


if __name__ == '__main__':
    import sys
    verify(include_web='--web' in sys.argv)
