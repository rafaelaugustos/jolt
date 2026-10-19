"""Real Android gestures against the normal demo. Pass a dedicated ADB serial."""
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
    command("shell", "uiautomator", "dump", "/sdcard/jolt-drag-ui.xml")
    root = ET.fromstring(command("shell", "cat", "/sdcard/jolt-drag-ui.xml"))
    result = {}
    for node in root.iter("node"):
        bounds = tuple(map(int, re.findall(r"-?\d+", node.get("bounds", ""))))
        for name in [node.get("text"), node.get("content-desc")]:
            if name:
                result[name] = bounds
    return result


def center(bounds):
    left, top, right, bottom = bounds
    return (left + right) // 2, (top + bottom) // 2


def tap(name, positions):
    command("shell", "input", "tap", *map(str, center(positions[name])))


def swipe(name, positions, x, y, duration=600):
    start_x, start_y = center(positions[name])
    command("shell", "input", "swipe", *map(str, [start_x, start_y, start_x + round(x * density), start_y + round(y * density), duration]))


def require(name):
    actual = controls()
    assert name in actual, (name, list(actual))
    return actual


def near(actual, expected, tolerance=3):
    assert abs(actual - expected) <= tolerance, (actual, expected)


density = int(re.findall(r"\d+", command("shell", "wm", "density"))[-1]) / 160
command("shell", "am", "force-stop", "org.nativescript.jolt")
command("shell", "am", "start", "-n", "org.nativescript.jolt/com.tns.NativeScriptActivity", "--es", "drag-lab", "true")
time.sleep(1)
positions = require("Drag panel")
initial = positions["Drag panel"]
card_initial = positions["Drag card"]
checks = []

swipe("Drag panel", positions, 0, 130)
positions = require("Panel settled · 140")
near((positions["Drag panel"][1] - initial[1]) / density, 140)
near(positions["Drag panel"][0], initial[0])
checks.append("vertical native gesture snaps to bottom and preserves X")

swipe("Drag panel", positions, 0, -130)
positions = require("Panel settled · 0")
near(positions["Drag panel"][1], initial[1])
checks.append("reverse native gesture snaps to top")

tap("Pause drag", positions)
positions = require("Resume drag")
swipe("Drag panel", positions, 0, 120)
positions = require("Resume drag")
near(positions["Drag panel"][1], initial[1])
checks.append("scope pause detaches real input")
tap("Resume drag", positions)
positions = require("Pause drag")

tap("Motion: system", positions)
positions = require("Motion: reduced")
swipe("Drag panel", positions, 0, 30, 1200)
positions = require("Panel settled · 70")
near((positions["Drag panel"][1] - initial[1]) / density, 70)
checks.append("reduced motion settles middle snap after real input")
tap("Motion: reduced", positions)
positions = require("Motion: system")

swipe("Drag card", positions, 150, 0, 200)
positions = require("Card settled · 90")
near((positions["Drag card"][0] - card_initial[0]) / density, 90)
checks.append("rubberbanded card returns to bounded decay edge")

tap("Unmount drags", positions)
positions = require("Drag examples unmounted")
assert "Drag card" not in positions
tap("Mount drags", positions)
positions = require("Drag panel")
near(positions["Drag panel"][1], initial[1])
swipe("Drag panel", positions, 0, 120)
positions = require("Panel settled · 140")
checks.append("Vue unmount and remount creates working fresh controllers")
print(json.dumps({"status": "passed", "checks": checks}, indent=2))
