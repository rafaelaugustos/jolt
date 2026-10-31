"""Captured device evidence plus deliberate corruption; no fabricated device results."""
import copy
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parent


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


verify = module('verify-binding-diagnostics')
collector = module('run-binding-budgets')


def read(name):
    return json.loads(gzip.decompress((ROOT / 'results/binding-budgets' / name).read_bytes()))


class Diagnostics(unittest.TestCase):
    def test_captured_retention_and_controls(self):
        for platform in ('android', 'ios'):
            report = read(f'2026-10-30-retention-{platform}.json.gz')
            result = verify.retention(report, platform == 'android')
            self.assertEqual(result['releasedViews'], 960)
            for mutation, change in [
                ('unfinished', lambda r: r.update(completed=False)),
                ('recording', lambda r: r.update(recording=True)),
                ('dirty', lambda r: r['build'].update(dirty=True)),
                ('simulator', lambda r: r['device'].update(physical=False)),
                ('invalid physical flag', lambda r: r['device'].update(physical='true')),
                ('missed retained control', lambda r: r['retention']['retainedControl'].update(alive=0)),
                ('retained released control', lambda r: r['retention']['releasedControl'].update(alive=1)),
                ('missing cycle', lambda r: r['retention']['rounds'].pop()),
                ('retained target', lambda r: r['retention']['rounds'][8]['collected']['heap'].update(alive=1)),
                ('late work', lambda r: r['retention']['rounds'][8]['idle'].update(frameCallbacks=1)),
                ('live node', lambda r: r['retention']['rounds'][8]['live'].update(nodes=1)),
                ('short collection', lambda r: r['retention']['rounds'][8]['collected']['heap'].update(timeMs=0)),
                ('hot collection', lambda r: r['retention']['rounds'][8]['collected']['resources'].update(thermalState=3)),
                ('invalid heap', lambda r: r['retention']['rounds'][8]['collected']['heap'].update({next(iter(result['heap'])): float('nan')})),
            ]:
                with self.subTest(platform=platform, mutation=mutation):
                    bad = copy.deepcopy(report)
                    change(bad)
                    with self.assertRaises(AssertionError):
                        verify.retention(bad, platform == 'android')
            if platform == 'android':
                with self.assertRaises(AssertionError):
                    verify.retention(report)

    def test_captured_input_and_native_delay(self):
        for platform in ('android', 'ios'):
            delay = 40 if platform == 'android' else 200
            for kind in ('drag-js', 'pan-native', 'scroll-js', 'header-native', f'drag-js-delay-{delay}'):
                report = read(f'2026-10-30-latency-{platform}-{kind}.json.gz')
                result = verify.input_latency(report, platform == 'android')
                self.assertEqual(len(result['observations']), 6)
                self.assertGreaterEqual(result['eventToNativePoseMs']['n'], 3)
                if 'delay-' in kind:
                    self.assertGreaterEqual(result['dispatchToNativePoseMs']['min'], delay - 1)
                for mutation, change in [
                    ('overflow', lambda r: r['touchTrace'].update(overflow=1)),
                    ('clock domain', lambda r: r['touchTrace'].update(clock='wall-clock')),
                    ('wrong control', lambda r: r.update(inputDelayMs=5)),
                    ('truncated stream', lambda r: r['touchTrace']['events'].pop()),
                    ('future event', lambda r: r['touchTrace']['events'][0].__setitem__(0, 1e15)),
                    ('unknown action', lambda r: r['touchTrace']['events'][0].__setitem__(2, 8)),
                    ('invalid coordinate', lambda r: r['touchTrace']['events'][0].__setitem__(3, float('nan'))),
                    ('wrong sampling window', lambda r: r['native']['before'].update(timeMs=1e15)),
                    ('late callbacks', lambda r: r['events'][-1]['driver'].update(endCallbacks=999)),
                ]:
                    with self.subTest(platform=platform, kind=kind, mutation=mutation):
                        bad = copy.deepcopy(report)
                        change(bad)
                        with self.assertRaises(AssertionError):
                            verify.input_latency(bad, platform == 'android')
            # Relabel a genuine no-delay report as delayed; it must not pass calibration.
            bad = read(f'2026-10-30-latency-{platform}-drag-js.json.gz')
            bad['inputDelayMs'] = bad['touchTrace']['delayMs'] = delay
            with self.assertRaisesRegex(AssertionError, 'Known native delay not observed'):
                verify.input_latency(bad, platform == 'android')

    def test_control_must_distinguish_baseline(self):
        for platform, delay in [('android', 40), ('ios', 200)]:
            baseline = read(f'2026-10-30-latency-{platform}-drag-js.json.gz')
            delayed = read(f'2026-10-30-latency-{platform}-drag-js-delay-{delay}.json.gz')
            verify.input_control(baseline, delayed, platform == 'android')
        baseline = read('2026-10-30-latency-ios-drag-js.json.gz')
        inconclusive = read('2026-10-30-latency-ios-drag-js-delay-40.json.gz')
        with self.assertRaisesRegex(AssertionError, 'Baseline already exceeds control delay'):
            verify.input_control(baseline, inconclusive)

    def test_resume_preserves_retention_cycles(self):
        complete = read('2026-10-30-retention-android.json.gz')
        for corrupt in (False, True):
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / 'result.json'
                staging = output.with_suffix('.pending.json')
                pending = copy.deepcopy(complete)
                pending['completed'] = False
                pending['retention']['rounds'] = pending['retention']['rounds'][:8]
                original = json.dumps(pending)
                staging.write_text(original)
                candidate = copy.deepcopy(complete)
                if corrupt:
                    candidate['retention']['rounds'][0]['collected']['heap']['alive'] = 1

                def transfer(words, **kwargs):
                    self.assertEqual(words, ('adb', '-s', 'fixture-device', 'shell', 'cat',
                        '/sdcard/Android/data/org.nativescript.jolt.bindings/files/binding-retention.json'))
                    self.assertEqual(staging.read_text(), original)
                    return subprocess.CompletedProcess(words, 0, json.dumps(candidate), '')

                args = ['collector', 'android', 'fixture-device', str(output), '--resume', '--retention']
                with patch('sys.argv', args), patch.object(collector.subprocess, 'run', side_effect=transfer), \
                     patch.object(collector.time, 'sleep'), patch('builtins.print'):
                    if corrupt:
                        with self.assertRaisesRegex(AssertionError, 'Previously collected retention cycles changed'):
                            collector.main()
                        self.assertEqual(staging.read_text(), original)
                        self.assertFalse(output.exists())
                    else:
                        collector.main()
                        self.assertEqual(json.loads(output.read_text()), complete)


if __name__ == '__main__':
    unittest.main()
