import copy
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
import subprocess
import contextlib
import io

spec = importlib.util.spec_from_file_location("native_ci", pathlib.Path(__file__).with_name("native-ci.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


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


class BoundedCommands(unittest.TestCase):
    def test_timeout_keeps_partial_boot_output_and_failure(self):
        output = io.StringIO()
        failure = subprocess.TimeoutExpired(['simctl'], 3, output=b'Waiting for SpringBoard')
        probe.TIMINGS.clear()
        with patch.object(probe.subprocess, 'run', side_effect=failure), contextlib.redirect_stdout(output):
            with self.assertRaises(subprocess.TimeoutExpired), probe.phase('simulator-ready'):
                probe.command('simctl', timeout=3)
        self.assertIn('Waiting for SpringBoard', output.getvalue())
        self.assertEqual(probe.TIMINGS[-1]['status'], 'failed')

    def test_optional_diagnostics_cannot_mask_probe_failure(self):
        failure = subprocess.TimeoutExpired(['simctl'], 10)
        with patch.object(probe.subprocess, 'run', side_effect=failure):
            result = probe.command('simctl', required=False, timeout=10)
        self.assertIn('Optional diagnostic command failed', result)


if __name__ == "__main__":
    unittest.main()
