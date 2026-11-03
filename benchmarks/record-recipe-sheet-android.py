"""Record the real native sheet recipe. Use the isolated ADB server environment."""
import json,re,subprocess,sys,time,xml.etree.ElementTree as ET
from pathlib import Path
serial=sys.argv[1]; out=Path(sys.argv[2]);out.parent.mkdir(parents=True,exist_ok=True)
adb=['adb','-s',serial]; app='org.nativescript.jolt.benchmark'
def command(*args):return subprocess.check_output(adb+list(args),text=True,timeout=60)
def tap(label):
    command('shell','uiautomator','dump','/sdcard/jolt-sheet-record.xml')
    nodes=ET.fromstring(command('shell','cat','/sdcard/jolt-sheet-record.xml'))
    matches=[n for n in nodes.iter('node') if label in [n.get('text'),n.get('content-desc'),n.get('resource-id')]]
    assert matches,label
    x1,y1,x2,y2=map(int,re.findall(r'\d+',matches[-1].get('bounds')))
    command('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.8)
assert command('shell','getprop','ro.kernel.qemu').strip()=='1'
command('shell','am','force-stop',app)
command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','recipe','sheet');time.sleep(3)
remote='/sdcard/jolt-recipe-sheet.mp4'
record=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','--time-limit','60',remote])
try:
    time.sleep(1);tap('Open sheet');tap('Add content');tap('Recipe message')
    command('shell','input','text','Native%ssheet');time.sleep(2)
    assert 'mInputShown=true' in command('shell','dumpsys','input_method')
    command('shell','input','keyevent','4');time.sleep(1);tap('Close sheet');tap('Open sheet')
    command('shell','input','swipe','540','1900','540','1300','700');time.sleep(2)
finally:
    pids=command('shell','pidof','screenrecord').split()
    for pid in pids:command('shell','kill','-2',pid)
    record.wait(timeout=15)
command('pull',remote,str(out));command('shell','rm',remote)
command('shell','am','force-stop',app)
subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
print('PASS native Android sheet recording: open, dynamic content, keyboard, close/reopen, scroll')
