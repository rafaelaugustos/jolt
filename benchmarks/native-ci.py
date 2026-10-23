"""Run the real native probe and a negative control; never accept stale results."""

import argparse
from contextlib import contextmanager
import json
import pathlib
import subprocess
import time
import uuid

APP_ID = "dev.jolt.nativeci"
ROOT = pathlib.Path(__file__).resolve().parent.parent
TIMINGS = []


@contextmanager
def phase(name):
    started = time.monotonic()
    result = dict(phase=name, status="failed")
    print(f"START {name}", flush=True)
    try:
        yield
        result["status"] = "passed"
    finally:
        result["seconds"] = round(time.monotonic() - started, 3)
        TIMINGS.append(result)
        print(f"END {name}: {result['status']} ({result['seconds']}s)", flush=True)


CHECKS = [
    "combined native transform and opacity",
    "live intermediate native position",
    "pause holds and resume completes",
    "interruption starts at visible position",
    "one motion value coordinates native bindings",
    "scope disposal cancels native work",
    "unload and reload release the old animation",
    "reduced motion settles spatial animation",
    "live native spring followers and layers",
    "native gesture values and scroll delegate lifecycle",
    "real dimensions in StackLayout and GridLayout",
]


def command(*args, required=True, timeout=60):
    try:
        result = subprocess.run(args, text=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        if required:
            for stream in (getattr(error, "stdout", None), getattr(error, "stderr", None)):
                if stream:
                    print(stream.decode(errors="replace") if isinstance(stream, bytes) else stream, flush=True)
            raise
        return f"Optional diagnostic command failed: {args}: {error}\n"
    if required and result.returncode:
        raise RuntimeError(f"{args}: {result.stdout}\n{result.stderr}")
    return result.stdout


def validate(report, run_id, commit, platform, negative=False):
    assert report.get("schema") == 1, "Unknown report schema"
    assert report.get("runId") == run_id, "Stale report"
    assert report.get("build", {}).get("commit") == commit, "Wrong source commit"
    assert report["build"].get("mode") == "production", "Development JavaScript build"
    assert report.get("platform", "").lower() == platform, "Wrong platform"
    assert report.get("injected") is negative, "Wrong probe mode"
    if negative:
        assert report.get("status") == "failed", "Negative control did not fail"
        assert report.get("stage") == CHECKS[0], "Unrelated negative-control failure"
        assert report.get("checks") == [], "Negative control ran past its assertion"
        samples = report.get("samples", [])
        assert len(samples) == 1, "Missing negative-control sample"
        sample = samples[0]
        assert sample["property"] == "x" and sample["expected"] == 160
        assert abs(sample["actual"] - 60) <= 3, "Probe did not measure native midpoint"
        assert "x:" in report.get("error", ""), "Unexpected failure reason"
    else:
        assert report.get("status") == "passed", report.get("error", report)
        assert report.get("checks") == CHECKS, "Incomplete or reordered native checks"
        assert len(report.get("samples", [])) >= 15, "Missing native measurements"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=["ios", "android"])
    parser.add_argument("--device", required=True, help="Explicit simulator UUID or adb serial")
    parser.add_argument("--app", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "benchmarks/native-app/results")
    parser.add_argument("--boot-timeout", type=int, default=180, help="iOS simulator boot readiness timeout in seconds")
    args = parser.parse_args()
    if args.boot_timeout <= 0:
        parser.error("--boot-timeout must be positive")
    args.output.mkdir(parents=True, exist_ok=True)
    TIMINGS.clear()
    try:
        run(args, parser)
    finally:
        (args.output / "timings.json").write_text(json.dumps(TIMINGS, indent=2) + "\n")


def run(args, parser):
    commit = command("git", "-C", str(ROOT), "rev-parse", "HEAD").strip()
    device = args.device
    ios = args.platform == "ios"
    if not ios and not device.startswith("emulator-"):
        parser.error("Native CI only supports Android emulators")
    if ios:
        devices = json.loads(command("xcrun", "simctl", "list", "devices", "available", "--json"))
        assert any(d["udid"] == device for ds in devices["devices"].values() for d in ds), "Unknown simulator"
    if args.app is None:
        pattern = "ios/build/Release-iphonesimulator/*.app" if ios else "android/app/build/outputs/apk/debug/*.apk"
        candidates = list((ROOT / "benchmarks/native-app/platforms").glob(pattern))
        assert len(candidates) == 1, f"Expected one built app, found {candidates}"
        args.app = candidates[0]
    if ios:
        with phase("simulator-ready"):
            command("xcrun", "simctl", "boot", device, required=False, timeout=20)
            command("xcrun", "simctl", "bootstatus", device, "-b", timeout=args.boot_timeout)
        with phase("install"):
            command("xcrun", "simctl", "install", device, str(args.app), timeout=120)
        container = pathlib.Path(command("xcrun", "simctl", "get_app_container", device, APP_ID, "data").strip())

        def read(name):
            path = container / "Documents" / name
            return path.read_text() if path.exists() else ""
    else:
        with phase("install"):
            command("adb", "-s", device, "install", "-r", str(args.app))
        for setting in ("window_animation_scale", "transition_animation_scale", "animator_duration_scale"):
            command("adb", "-s", device, "shell", "settings", "put", "global", setting, "1")

        def read(name):
            return command("adb", "-s", device, "shell", "run-as", APP_ID, "cat", f"files/{name}", required=False)

    try:
        for negative in (False, True):
            name = "negative-control" if negative else "baseline"
            with phase(name):
                run_id = str(uuid.uuid4())
                if ios:
                    command("xcrun", "simctl", "terminate", device, APP_ID, required=False, timeout=10)
                    launch = ["xcrun", "simctl", "launch", device, APP_ID, f"--run={run_id}"]
                    if negative:
                        launch.append("--inject-failure")
                else:
                    command("adb", "-s", device, "shell", "am", "force-stop", APP_ID)
                    launch = ["adb", "-s", device, "shell", "am", "start", "-n", f"{APP_ID}/com.tns.NativeScriptActivity", "--es", "run", run_id, "--ez", "inject-failure", str(negative).lower()]
                print(f"Running {args.platform} {name}: {run_id}", flush=True)
                with phase(name + "-launch"):
                    command(*launch)
                deadline = time.monotonic() + 120
                report = None
                while time.monotonic() < deadline:
                    raw = read("jolt-native-ci.json")
                    try:
                        candidate = json.loads(raw)
                    except json.JSONDecodeError:
                        candidate = {}
                    if candidate.get("runId") == run_id:
                        report = candidate
                        (args.output / f"{name}.json").write_text(raw)
                        if report.get("status") in ("passed", "failed"):
                            break
                    time.sleep(1)
                assert report and report.get("status") != "running", f"Probe timed out: {report}"
                validate(report, run_id, commit, args.platform, negative)
                if not negative:
                    sizes = read("jolt-size-checks.json")
                    (args.output / "sizes.json").write_text(sizes)
                print(f"PASS {name}", flush=True)
    finally:
        if ios:
            command("xcrun", "simctl", "io", device, "screenshot", str(args.output / "screen.png"), required=False, timeout=10)
            logs = command("xcrun", "simctl", "spawn", device, "log", "show", "--last", "2m", "--style", "compact", "--predicate", 'process == "nativeapp"', required=False, timeout=10)
            command("xcrun", "simctl", "terminate", device, APP_ID, required=False, timeout=10)
        else:
            logs = command("adb", "-s", device, "logcat", "-d", "-t", "3000", required=False, timeout=10)
            with (args.output / "screen.png").open("wb") as screenshot:
                try:
                    subprocess.run(["adb", "-s", device, "exec-out", "screencap", "-p"], stdout=screenshot, timeout=10)
                except (OSError, subprocess.TimeoutExpired) as error:
                    logs += f"\nOptional screenshot failed: {error}\n"
            command("adb", "-s", device, "shell", "am", "force-stop", APP_ID, required=False, timeout=10)
        (args.output / "native.log").write_text(logs)


if __name__ == "__main__":
    main()
