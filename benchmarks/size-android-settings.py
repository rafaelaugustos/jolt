"""Native size conformance at normal/large font and system animator scales.
Use only on a dedicated emulator. All modified settings are restored.
Usage: python3 benchmarks/size-android-settings.py SERIAL OUTPUT_DIRECTORY
"""
import json
from pathlib import Path
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
output = Path(directory).resolve()
output.mkdir(parents=True, exist_ok=True)
adb = [str(Path.home() / 'Library/Android/sdk/platform-tools/adb'), '-s', serial]
bundle = 'org.nativescript.jolt.benchmark'

def call(*args):
    return subprocess.check_output(adb + list(args), text=True, stderr=subprocess.DEVNULL).strip()

settings = [('system','font_scale'), ('global','animator_duration_scale'), ('system','accelerometer_rotation'), ('system','user_rotation')]
original = {(namespace,key):call('shell','settings','get',namespace,key) for namespace,key in settings}

def set_value(namespace, key, value):
    call('shell','settings','put',namespace,key,str(value))

def tree():
    call('shell','uiautomator dump /sdcard/jolt-size-settings.xml')
    return call('shell','cat /sdcard/jolt-size-settings.xml')

def launch(extra=''):
    call('shell', "am start -S -n "+bundle+"/com.tns.NativeScriptActivity --es size-lab true "+extra)

try:
    for name, font, scale in [('normal',1,1),('font-1.3',1.3,1),('scale-2',1,2)]:
        set_value('system','font_scale',font)
        set_value('global','animator_duration_scale',scale)
        call('shell','run-as',bundle,'rm','-f','files/jolt-size-checks.json')
        launch("--es tap 'Run size checks' --es every 1500")
        deadline = time.monotonic()+65
        result = None
        while time.monotonic() < deadline:
            try:
                result = json.loads(call('shell','run-as',bundle,'cat','files/jolt-size-checks.json'))
                break
            except (subprocess.CalledProcessError,json.JSONDecodeError):
                time.sleep(0.5)
        assert result is not None, name+' timed out'
        result['settings'] = {'fontScale':font,'animatorDurationScale':scale}
        (output/(name+'.json')).write_text(json.dumps(result,indent=2))
        assert result.get('status') == 'passed' and result['count'] == 20, result
        print('PASS '+name,flush=True)
    set_value('global','animator_duration_scale',0)
    launch('--es tap Expand --es every 1200')
    time.sleep(2)
    xml = tree()
    assert 'Settled · auto × auto' in xml, xml
    (output/'scale-0.xml').write_text(xml)
    print('PASS disabled system animations settle',flush=True)
    set_value('global','animator_duration_scale',1)
    set_value('system','accelerometer_rotation',0)
    set_value('system','user_rotation',0)
    launch('--es tap Expand --es every 1000')
    time.sleep(1.2)
    set_value('system','user_rotation',1)
    time.sleep(1.6)
    landscape = tree()
    set_value('system','user_rotation',0)
    time.sleep(1.6)
    portrait = tree()
    assert 'Settled' in portrait and 'Expand' in portrait, portrait
    (output/'rotation-landscape.xml').write_text(landscape)
    (output/'rotation-portrait.xml').write_text(portrait)
    print('PASS rotation/resume',flush=True)
finally:
    for (namespace,key),value in original.items():
        if value == 'null': call('shell','settings','delete',namespace,key)
        else: set_value(namespace,key,value)
