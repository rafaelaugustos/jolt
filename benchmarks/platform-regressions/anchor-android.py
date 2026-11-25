"""Exercise same-turn anchor transactions on a dedicated Android emulator."""
import argparse
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("serial")
parser.add_argument("output", type=Path)
parser.add_argument("--baseline", action="store_true")
parser.add_argument("--record", action="store_true")
args = parser.parse_args()
if not args.serial.startswith("emulator-"):
    parser.error("Select a dedicated emulator")
args.output.mkdir(parents=True, exist_ok=True)
adb = ["adb", "-s", args.serial]
app = "dev.jolt.nativeci"
report = "files/anchor-regression.json"


def command(*parts):
    return subprocess.check_output([*adb, *parts], text=True)


def history():
    try:
        return json.loads(command("shell", "run-as", app, "cat", report))
    except (subprocess.CalledProcessError, ValueError):
        return []


def wait_for_controls():
    layout = "/data/local/tmp/jolt-anchor-controls.xml"
    for _ in range(40):
        command("shell", "uiautomator", "dump", layout)
        tree = ET.fromstring(command("shell", "cat", layout))
        controls = {
            node.get("text", "").lower(): re.findall(r"\d+", node.get("bounds", ""))
            for node in tree.iter("node")
            if node.get("class") == "android.widget.Button"
        }
        if {"top", "prepend", "refresh"} <= controls.keys() and history():
            return controls
        time.sleep(0.2)
    raise RuntimeError("Anchor fixture did not become ready")


def tap(bounds):
    left, top, right, bottom = map(int, bounds)
    command("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def verify(name, controls):
    previous = len(history())
    tap(controls[name])
    for _ in range(80):
        entries = history()[previous:]
        if entries:
            break
        time.sleep(0.1)
    assert entries and entries[-1]["event"] == name, entries
    sample = entries[-1]
    print(name, sample, flush=True)
    assert sample["commits"] == 1 and abs(sample["live"] - 270) < 1, sample
    scroll_error = abs(sample["snapshot"] - sample["live"])
    card_delta = abs(sample["after"] - sample["before"])
    if args.baseline:
        assert scroll_error > 10 and card_delta > 10, sample
    else:
        assert scroll_error < 1 and card_delta < 1 and abs(sample["final"] - 432) < 1, sample
    if name == "refresh":
        assert sample["accepted"], sample


command("shell", "am", "force-stop", app)
command("shell", "run-as", app, "rm", "-f", report)
command("shell", "am", "start", "-W", "-n", app + "/com.tns.NativeScriptActivity")
controls = wait_for_controls()
recorder = None
remote_video = "/data/local/tmp/jolt-same-turn-anchor.mp4"
try:
    if args.record:
        recorder = subprocess.Popen([*adb, "shell", "screenrecord", "--bit-rate", "5000000", remote_video])
        time.sleep(0.8)
    verify("prepend", controls)
    time.sleep(1.3)
    tap(controls["top"])
    time.sleep(0.7)
    verify("refresh", controls)
    time.sleep(1.3)
finally:
    if recorder:
        command("shell", "pkill", "-2", "screenrecord")
        recorder.wait(timeout=20)
        command("pull", remote_video, str(args.output / "anchor-android.mp4"))

(args.output / "anchor-android.json").write_text(json.dumps(history(), indent=2) + "\n")
