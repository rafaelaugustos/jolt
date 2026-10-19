"""Drive the normal Android playground with real taps. Pass a reserved ADB serial."""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

adb = ["adb", "-s", sys.argv[1]]


def command(*args):
    return subprocess.check_output(adb + list(args), text=True)


def controls():
    command("shell", "uiautomator", "dump", "/sdcard/jolt-motion-ui.xml")
    tree = ET.fromstring(command("shell", "cat", "/sdcard/jolt-motion-ui.xml"))
    result = {}
    for node in tree.iter("node"):
        if node.get("text"):
            left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
            result[node.get("text")] = ((left + right) // 2, (top + bottom) // 2)
    return result


def tap(label, positions):
    command("shell", "input", "tap", *map(str, positions[label]))


def require(text):
    actual = controls()
    if text not in actual:
        raise AssertionError((text, list(actual)))
    return actual


positions = require("idle · settled")
checks = []
tap("Upload", positions)
time.sleep(.1)
tap("Cancel", positions)
positions = require("idle · settled")
checks.append("upload interrupted by cancel")
tap("Retry", positions)
time.sleep(.1)
tap("Success", positions)
positions = require("success · settled")
checks.append("retry interrupted by success")
tap("Error", positions)
positions = require("error · settled")
checks.append("error state")
tap("Upload", positions)
tap("Pause scope", positions)
time.sleep(1.3)
positions = require("Resume scope")
if "sending · settled" in positions:
    raise AssertionError("State finished while scope was suspended")
checks.append("scope suspension holds transition")
tap("Resume scope", positions)
positions = require("sending · settled")
checks.append("scope resume finishes transition")
tap("Cancel", positions)
positions = require("idle · settled")
tap("Upload", positions)
tap("Unmount card", positions)
positions = require("Mount card")
if "Your next big idea" in positions:
    raise AssertionError("Vue card did not unmount")
checks.append("actual Vue unmount during playback")
tap("Mount card", positions)
positions = require("idle · settled")
tap("Retry", positions)
positions = require("sending · settled")
checks.append("remount creates usable new scope")
print(json.dumps({"status": "passed", "checks": checks}, indent=2))
