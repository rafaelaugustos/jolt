"""Record the installed Jolt Drive app with real idb input on an explicit simulator.

Usage: python3 scripts/record-drive-recipes.py SIMULATOR_UUID OUTPUT_DIR [recipe ...]
Requires idb and the reviewed Jolt Drive build (org.nativescript.joltcar).
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
from contextlib import contextmanager

serial, destination, *requested = sys.argv[1:]
methods = requested or ["cockpit", "atmosphere", "charge-sheet", "cabin"]
output = Path(destination).resolve()
output.mkdir(parents=True, exist_ok=True)
idb = os.environ.get("JOLT_IDB") or shutil.which("idb")
if not idb:
    raise RuntimeError("Set JOLT_IDB to the idb executable")


def command(*args):
    return subprocess.check_output(args, text=True)


def elements():
    return json.loads(command(idb, "ui", "describe-all", "--udid", serial))


def element(label, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        matches = [e for e in elements() if (e.get("AXLabel") or "").startswith(label)]
        if matches:
            return matches[0]
        time.sleep(0.2)
    raise RuntimeError("Missing native control: " + label)


def tap(label, pause=0.9):
    frame = element(label)["frame"]
    command(idb, "ui", "tap", "--udid", serial,
            str(round(frame["x"] + frame["width"] / 2)), str(round(frame["y"] + frame["height"] / 2)))
    time.sleep(pause)


def swipe_handle(distance):
    frame = element("Expand or collapse your cockpit")["frame"]
    x, y = frame["x"] + frame["width"] / 2, frame["y"] + 12
    command(idb, "ui", "swipe", "--udid", serial, "--duration", "1.1",
            str(round(x)), str(round(y)), str(round(x)), str(round(y + distance)))
    time.sleep(1.2)


def expanded(wanted):
    is_open = element("Expand or collapse your cockpit")["frame"]["y"] < 400
    if is_open != wanted:
        tap("Expand or collapse your cockpit", 1.3)


@contextmanager
def record(name):
    path = output / (name + ".mov")
    if path.exists():
        raise RuntimeError("Refusing to overwrite raw capture: " + str(path))
    recorder = subprocess.Popen(
        ["xcrun", "simctl", "io", serial, "recordVideo", "--codec=h264", str(path)],
        stderr=subprocess.PIPE,
    )
    try:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if select.select([recorder.stderr], [], [], 1)[0]:
                if b"Recording started" in recorder.stderr.readline():
                    break
        else:
            raise RuntimeError("Recorder did not start")
        print("Recording " + name, flush=True)
        time.sleep(0.6)
        yield
        time.sleep(1)
    finally:
        recorder.send_signal(signal.SIGINT)
        recorder.communicate(timeout=20)
    if recorder.returncode:
        raise RuntimeError("Capture failed: " + name)
    print("Saved " + name, flush=True)


if any(e.get("AXLabel") == "Close charge plan" for e in elements()):
    tap("Close charge plan", 1.4)
element("Expand or collapse your cockpit", 60)
if "cockpit" in methods:
    expanded(False)
    with record("drive-cockpit-ios"):
        swipe_handle(-400)
        assert element("Expand or collapse your cockpit")["frame"]["y"] < 400
        swipe_handle(400)
        tap("Expand or collapse your cockpit", 1.4)
        tap("Expand or collapse your cockpit", 1.4)

if "atmosphere" in methods:
    expanded(True)
    with record("drive-atmosphere-ios"):
        tap("Glacier atmosphere", 1.2)
        tap("Afterglow atmosphere", 1.2)
        tap("Electric atmosphere", 0.15)
        tap("Glacier atmosphere", 0.15)
        tap("Afterglow atmosphere", 1.2)
        tap("Electric atmosphere", 1.2)

if "charge-sheet" in methods:
    expanded(True)
    with record("drive-charge-sheet-ios"):
        tap("Open charge plan", 1.5)
        tap("Open road, 100 percent", 0.8)
        tap("A little further, 90 percent", 0.8)
        tap("Charge plan", 1.1)
        tap("Close charge plan", 1.4)
        element("Expand or collapse your cockpit")

if "cabin" in methods:
    expanded(False)
    with record("drive-cabin-ios"):
        tap("Climate", 4.5)
        tap("Raise cabin temperature", 0.8)
        tap("Lower cabin temperature", 0.8)
        tap("Climate", 3.5)
        element("Expand or collapse your cockpit")

(output / "capture.json").write_text(json.dumps({
    "simulator": serial,
    "platform": "iPhone 17 Pro simulator, iOS 26.2",
    "app": "org.nativescript.joltcar",
    "language": "English",
    "input": "Real idb accessibility-targeted taps and native drag/release",
    "timing": "Original simctl timestamps; no retiming",
}, indent=2) + "\n")
