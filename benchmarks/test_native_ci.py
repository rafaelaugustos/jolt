import copy
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("native_ci", pathlib.Path(__file__).with_name("native-ci.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class LaunchDiagnostics(unittest.TestCase):
    def test_keeps_output_and_propagates_launch_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            log = pathlib.Path(directory) / "launch.log"
            with self.assertRaises(subprocess.CalledProcessError) as error:
                probe.logged_command(log, sys.executable, "-c",
                                     "import sys; print('launch rejected', flush=True); sys.exit(7)")
            self.assertEqual(error.exception.returncode, 7)
            self.assertIn("launch rejected", log.read_text())

    def test_keeps_partial_output_and_propagates_timeout(self):
        with tempfile.TemporaryDirectory() as directory:
            log = pathlib.Path(directory) / "launch.log"
            with self.assertRaises(subprocess.TimeoutExpired):
                probe.logged_command(log, sys.executable, "-c",
                                     "import time; print('launch started', flush=True); time.sleep(30)",
                                     timeout=1)
            self.assertIn("launch started", log.read_text())


class ReportValidation(unittest.TestCase):
    def setUp(self):
        self.report = dict(schema=1, runId="fresh", build=dict(commit="head", mode="production"), platform="iOS", injected=False, status="passed", checks=probe.CHECKS, samples=[{}] * 16)

    def validate(self, report, negative=False):
        probe.validate(report, "fresh", "head", "ios", negative)

    def test_accepts_complete_current_run(self):
        self.validate(self.report)

    def test_rejects_stale_or_incomplete_success(self):
        for change in [dict(runId="old"), dict(build=dict(commit="old", mode="production")), dict(build=dict(commit="head", mode="development")), dict(checks=probe.CHECKS[:-1]), dict(platform="Android"), dict(samples=[]), dict(status="running")]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                self.validate({**self.report, **change})

    def test_negative_control_requires_the_intended_native_failure(self):
        report = {**self.report, "injected": True, "status": "failed", "stage": probe.CHECKS[0], "checks": [], "samples": [dict(property="x", actual=60, expected=160)], "error": "Error: x: 60 != 160 ± 3"}
        self.validate(report, True)
        for change in [dict(status="passed"), dict(stage="initial layout"), dict(error="watchdog"), dict(samples=[dict(property="x", actual=0, expected=160)]), dict(checks=[probe.CHECKS[0]])]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                self.validate({**copy.deepcopy(report), **change}, True)


if __name__ == "__main__":
    unittest.main()
