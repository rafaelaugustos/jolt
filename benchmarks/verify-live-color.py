"""Compile production C/Java color interpolation and compare with the portable core.
Run npm run build first. No mock bridge or UI rendering is involved in this check.
"""
import json
import os
from pathlib import Path
import random
import subprocess
import tempfile

root=Path(__file__).resolve().parents[1]
def run(args,**kwargs):
    return subprocess.run(args,check=True,capture_output=True,text=True,timeout=60,**kwargs).stdout
seed=random.Random(297)
rows=[[seed.randrange(2**32),seed.randrange(2**32),seed.uniform(-.2,1.2)] for _ in range(600)]
rows += [[a,b,p] for a,b in [(0x00ff0000,0xff0088ff),(0x408cb5ff,0xffefa26f),(0x00000000,0x00ffffff),(0xffff0000,0xff00ff00)] for p in [0,.1,.25,.5,.75,.9,1]]
data=''.join(f'{a} {b} {p}\n' for a,b,p in rows)
with tempfile.TemporaryDirectory(prefix='jolt-live-color-') as directory:
    p=Path(directory)
    (p/'probe.c').write_text('''#include <stdio.h>
#include "JoltColorMath.h"
int main(void){unsigned a,b;double p;while(scanf("%u%u%lf",&a,&b,&p)==3)printf("%u\\n",JoltColorMix(JoltColorDecode(a),JoltColorDecode(b),p));}
''')
    (p/'ColorProbe.java').write_text('''import java.util.Scanner;
import java.util.Locale;
import org.rafaelaugusto.jolt.ColorMath;
public class ColorProbe {public static void main(String[] args){Scanner s=new Scanner(System.in).useLocale(Locale.US);while(s.hasNextLong()){long a=s.nextLong(),b=s.nextLong();double p=s.nextDouble();System.out.println(ColorMath.mix(new ColorMath.Stop(a),new ColorMath.Stop(b),p));}}}
''')
    jdk=Path(os.environ.get('JAVA_HOME','/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home'))/'bin'
    run(['clang','-std=c11','-O2','-Wall','-Wextra','-Werror','-I',str(root/'platforms/ios/src'),str(p/'probe.c'),'-lm','-o',str(p/'probe')])
    run([str(jdk/'javac'),'-d',str(p),str(root/'platforms/android/java/org/rafaelaugusto/jolt/ColorMath.java'),str(p/'ColorProbe.java')])
    c=list(map(int,run([str(p/'probe')],input=data).split()))
    java=list(map(int,run([str(jdk/'java'),'-cp',str(p),'ColorProbe'],input=data).split()))
    js=json.loads(run(['node','--input-type=module','-e',f"import {{colorMixer}} from {json.dumps((root/'dist/core/color.js').as_uri())}; let data=''; for await (const c of process.stdin) data+=c; console.log(JSON.stringify(JSON.parse(data).map(([a,b,p])=>colorMixer(a,b)(p))));"],input=json.dumps(rows)))
    for i,(a,b,expected) in enumerate(zip(c,java,js)):
        assert a==b==expected,(rows[i],a,b,expected)
    assert c[600+3] != rows[600+3][0], 'Missing interpolation negative control'
    print(json.dumps({'passed':len(rows),'ports':['TypeScript','C','Java'],'coverage':'premultiplied OKLab, alpha, transparent colors, gamut, clamp and exact endpoints'}))
