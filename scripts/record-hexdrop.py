"""Capture the pinned Hexdrop app on an explicit, dedicated iOS simulator.

Usage: JOLT_IDB=/path/to/idb python3 scripts/record-hexdrop.py UUID OUTPUT_DIR
Install Hexdrop ebdc02a2652051c982779ea43ba3d76cf99bb538 first.
Uses real idb input and simctl capture at original speed; no generated frames.
"""

import json
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import sys
import time

serial, destination = sys.argv[1:]
output = Path(destination).resolve()
output.mkdir(parents=True, exist_ok=True)
idb = os.environ.get("JOLT_IDB") or shutil.which("idb")
if not idb:
    raise RuntimeError("Set JOLT_IDB to the idb executable")


def command(*args):
    return subprocess.check_output(args, text=True)


def elements():
    return json.loads(command(idb, "ui", "describe-all", "--udid", serial))


def element(label, timeout=20):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            matches = [e for e in elements() if (e.get("AXLabel") or "").startswith(label)]
        except subprocess.CalledProcessError:
            time.sleep(0.5)
            continue
        if matches:
            return matches[0]
        time.sleep(0.2)
    raise RuntimeError("Missing native control: " + label)


def drag(x, y, end_x, end_y):
    command(idb, "ui", "swipe", "--udid", serial, "--duration", "1.2",
            str(round(x)), str(round(y)), str(round(end_x)), str(round(end_y)))


element("Brew potion")
card = element("spells.zip")["frame"]
stage_top = element("YOUR VIAL OF POSSIBILITIES")["frame"]
stage_bottom = element("drop a little magic here")["frame"]
x, y = card["x"] + card["width"] / 2, card["y"] + card["height"] / 2
target_y = (stage_top["y"] + stage_bottom["y"]) / 2
path = output / "hexdrop-native-ios.mov"
if path.exists():
    raise RuntimeError("Refusing to overwrite raw capture")
recorder = subprocess.Popen(
    ["xcrun", "simctl", "io", serial, "recordVideo", "--codec=h264", str(path)],
    stderr=subprocess.PIPE,
)
events = []
try:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if select.select([recorder.stderr], [], [], 1)[0]:
            if b"Recording started" in recorder.stderr.readline():
                break
    else:
        raise RuntimeError("Recorder did not start")
    started = time.monotonic()
    time.sleep(1.5)
    # Stop well below the vial: the rejected card must spring home.
    drag(x, y, x + 65, y - 95)
    time.sleep(2)
    element("Brew potion")
    returned = element("spells.zip")["frame"]
    if abs(returned["x"] - card["x"]) > 2 or abs(returned["y"] - card["y"]) > 2:
        raise RuntimeError("Card did not return to its starting bounds")
    events.append({"event": "outside drop returned", "time": time.monotonic() - started})
    drag(x, y, x, target_y)
    element("Cancel")
    events.append({"event": "accepted drop brewing", "time": time.monotonic() - started})
    element("Potion complete")
    events.append({"event": "potion complete", "time": time.monotonic() - started})
    time.sleep(3)

finally:
    recorder.send_signal(signal.SIGINT)
    recorder.communicate(timeout=20)
if recorder.returncode:
    raise RuntimeError("Capture failed")
(output / "capture.json").write_text(json.dumps({
    "source": "ebdc02a2652051c982779ea43ba3d76cf99bb538",
    "simulator": serial,
    "input": "real idb swipes",
    "audio": False,
    "events": events,
}, indent=2) + "\n")
print(path)
