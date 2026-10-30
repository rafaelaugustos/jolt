"""Offline negative controls against captured native evidence; no device/long CI job."""
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


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


budgets = load_module('budgets', 'verify-binding-budgets.py')
inputs = load_module('inputs', 'verify-binding-input.py')
collector = load_module('collector', 'run-binding-budgets.py')


def read(name):
    return json.loads(gzip.decompress((ROOT/'results/binding-budgets'/name).read_bytes()))


class BindingBudgets(unittest.TestCase):
    def test_native_keyframes_and_art_counters(self):
        report = read('2026-10-30-android-bulk-smoke.json.gz')
        budgets.verify(report, case='value-1-x', allow_unavailable_thermal=True)
        for mutation in ('missing', 'value', 'unit', 'order', 'finite', 'rejection', 'counter'):
            changed = copy.deepcopy(report)
            checks = changed['keyframeChecks']
            if mutation == 'missing': checks['samples'].pop()
            elif mutation == 'value': checks['samples'][0]['actual'] += .1
            elif mutation == 'unit': checks['samples'][0]['unit'] = 4
            elif mutation == 'order': checks['samples'].reverse()
            elif mutation == 'finite': checks['samples'][0]['actual'] = float('nan')
            elif mutation == 'rejection': checks['rejectedMismatchedArrays'] = False
            else:
                changed['cases'][0]['trials'][0]['native']['after']['art']['art.gc.bytes-allocated'] = '0'
            with self.subTest(mutation=mutation), self.assertRaises(AssertionError):
                budgets.verify(changed, case='value-1-x', allow_unavailable_thermal=True)
        stale = read('2026-10-30-android-bulk-stale-metadata.json.gz')
        self.assertEqual(stale['error'], 'Error: Missing native KeyframeFactory')
        with self.assertRaises(AssertionError):
            budgets.verify(stale, case='value-1-x', allow_unavailable_thermal=True)

    def test_resume_preserves_evidence_without_relaunch(self):
        complete = read('2026-10-30-physical-android.json.gz')
        pending = dict(complete, completed=False, cases=complete['cases'][:18])
        for corrupt_prior_case in (False, True):
            with self.subTest(corrupt_prior_case=corrupt_prior_case), tempfile.TemporaryDirectory() as directory:
                output = Path(directory)/'result.json'
                staging = output.with_suffix('.pending.json')
                original = json.dumps(pending)
                staging.write_text(original)
                stale = dict(complete, session='another-session')
                candidate = copy.deepcopy(complete)
                if corrupt_prior_case:
                    candidate['cases'][0]['preparation'][0]['startMs'] += 1
                replies = iter(['{', json.dumps(stale), json.dumps(candidate)])
                def transfer(words, **kwargs):
                    # Any relaunch, stop, or device mutation fails this test.
                    self.assertEqual(words, ('adb', '-s', 'fixture-device', 'shell', 'cat',
                        '/sdcard/Android/data/org.nativescript.jolt.bindings/files/binding-budgets.json'))
                    self.assertEqual(staging.read_text(), original)
                    return subprocess.CompletedProcess(words, 0, next(replies), '')
                args = ['collector', 'android', 'fixture-device', str(output), '--resume']
                with patch('sys.argv', args), patch.object(collector.subprocess, 'run', side_effect=transfer), \
                     patch.object(collector.time, 'sleep'), patch('builtins.print'):
                    if corrupt_prior_case:
                        with self.assertRaisesRegex(AssertionError, 'Previously collected workloads changed'):
                            collector.main()
                        self.assertEqual(staging.read_text(), original)
                        self.assertFalse(output.exists())
                    else:
                        collector.main()
                        self.assertEqual(json.loads(output.read_text()), complete)
                        self.assertFalse(staging.exists())

    def test_unavailable_thermal_is_not_nominal(self):
        # Modified fixture for the missing-telemetry path, never saved as device evidence.
        report = read('2026-10-30-android.json.gz')
        case = 'value-1-x'
        report['selected'] = [case]
        report['cases'] = [e for e in report['cases'] if e['workload']['id'] == case]
        report['device'].update(apiLevel=26, thermalStatusAvailable=False)
        report['thermalPolicy'] = 'unavailable-android-pre29'
        entry = report['cases'][0]
        boundaries = [entry['before'], entry['afterUnmount'], report['finalResources']]
        boundaries += [t['native'][edge] for t in entry['trials'] for edge in ('before', 'after')]
        for edge in boundaries: edge['thermalState'] = None
        with self.assertRaisesRegex(AssertionError, 'not nominal-temperature acceptance'):
            budgets.verify(report, allow_simulator=True, case=case)
        self.assertEqual(budgets.verify(report, allow_simulator=True, case=case,
                                       allow_unavailable_thermal=True)['thermalStatus'], 'unavailable')
        for name, mutate in [
            ('new Android API', lambda r: r['device'].update(apiLevel=29)),
            ('missing API', lambda r: r['device'].pop('apiLevel')),
            ('claimed available', lambda r: r['device'].update(thermalStatusAvailable=True)),
            ('unknown reported as nominal', lambda r: r['cases'][0]['before'].update(thermalState=0)),
            ('overheating', lambda r: r['cases'][0]['before'].update(thermalState=2)),
            ('power saving', lambda r: r['cases'][0]['before'].update(lowPowerMode=True)),
            ('iOS override', lambda r: r.update(platform='iOS')),
        ]:
            with self.subTest(name=name):
                bad = copy.deepcopy(report); mutate(bad)
                with self.assertRaises(AssertionError):
                    budgets.verify(bad, allow_simulator=True, case=case, allow_unavailable_thermal=True)

    def test_captured_matrices(self):
        phone = read('2026-10-30-ios.json.gz')
        self.assertIs(phone['recording'], False)
        self.assertEqual(len(budgets.verify(phone)['cases']), 22)
        self.assertTrue(budgets.audit(phone)['accepted'])
        emulator = read('2026-10-30-android.json.gz')
        self.assertIs(emulator['recording'], False)
        # Preserve the overload, do not loosen the ceiling or replace its slow trial.
        result = budgets.audit(emulator, allow_simulator=True)
        self.assertFalse(result['accepted'])
        self.assertEqual(len(result['passed']), 21)
        self.assertEqual(result['failed'], {
            'view-16-layers-8': 'Measurement exceeded 30-second acceptance ceiling',
        })
        with self.assertRaisesRegex(AssertionError, 'Physical hardware required'):
            budgets.verify(emulator)
        with self.assertRaisesRegex(AssertionError, '30-second acceptance ceiling'):
            budgets.verify(emulator, allow_simulator=True)
        incomplete = dict(phone, completed=False)
        with self.assertRaises(AssertionError): budgets.audit(incomplete)

    def test_physical_android_keeps_sparse_windows(self):
        report = read('2026-10-30-physical-android.json.gz')
        self.assertIs(report['device']['physical'], True)
        self.assertIs(report['recording'], False)
        with self.assertRaisesRegex(AssertionError, 'not nominal-temperature acceptance'):
            budgets.verify(report)
        result = budgets.audit(report, allow_unavailable_thermal=True)
        self.assertFalse(result['accepted'])
        self.assertEqual(result['thermalPolicy'], 'unavailable-android-pre29')
        self.assertEqual(len(result['passed']), 20)
        self.assertEqual(result['failed'], {
            'value-16-layers-2': 'Insufficient memory samples in native window',
            'view-16-layers-8': 'Insufficient memory samples in native window',
        })
        self.assertEqual(sum(len(e['trials']) for e in report['cases']), 66)
        for entry in report['cases']:
            for trial in entry['trials']:
                self.assertEqual(trial['remainingBindings'], 0)
                self.assertEqual(trial['remainingChannels'], 0)
                self.assertEqual(trial['nativeLive'], dict(nodes=0, clock=0))
                self.assertTrue(all(trial['idle'][k] == 0 for k in ('activeTracks', 'pendingFrames', 'pendingTimers')))

    def test_matrix_negative_controls(self):
        report = read('2026-10-30-ios.json.gz')
        case = 'value-1-window'
        report['selected'] = [case]
        report['cases'] = [entry for entry in report['cases'] if entry['workload']['id'] == case]
        def trial(r): return r['cases'][0]['trials'][0]
        cases = [
            ('unfinished', lambda r: r.update(completed=False)),
            ('error', lambda r: r.update(error='interrupted')),
            ('emulator', lambda r: r['device'].update(physical=False)),
            ('invalid device flag', lambda r: r['device'].update(physical='true')),
            ('debug bundle', lambda r: r['build'].update(bundleMode='development')),
            ('uncommitted build', lambda r: r['build'].update(dirty=True)),
            ('wrong selected case', lambda r: r.update(selected=['value-16-x'])),
            ('missing trial', lambda r: r['cases'][0]['trials'].pop()),
            ('changed workload', lambda r: r['cases'][0]['workload'].update(views=100)),
            ('missing warm preparation', lambda r: r['cases'][0]['preparation'].pop()),
            ('invalid timing', lambda r: r['cases'][0]['preparation'][0].update(startMs=float('nan'))),
            ('missing binding', lambda r: trial(r).update(bound=0)),
            ('retained binding', lambda r: trial(r).update(remainingBindings=1)),
            ('retained clock', lambda r: trial(r)['nativeLive'].update(clock=1)),
            ('retained track', lambda r: trial(r)['idle'].update(activeTracks=1)),
            ('late frame', lambda r: trial(r)['idle'].update(frameCallbacks=5)),
            ('observer on native-only playback', lambda r: trial(r).update(observations=100)),
            ('truncated frame buffer', lambda r: trial(r)['native'].update(overflow=1)),
            ('no native frames', lambda r: trial(r)['native'].update(frames=[])),
            ('missing frame column', lambda r: trial(r)['native']['frames'][0].pop()),
            ('nonmonotonic time', lambda r: trial(r)['native']['frames'][1].__setitem__(0, 0)),
            ('nonfinite frame', lambda r: trial(r)['native']['frames'][0].__setitem__(3, float('nan'))),
            ('identity scale baseline', lambda r: [f.__setitem__(4, 1) for f in trial(r)['native']['frames']]),
            ('static view', lambda r: [f.__setitem__(3, 24) for f in trial(r)['native']['frames']]),
            ('overheated', lambda r: trial(r)['native']['after'].update(thermalState=2)),
            ('power saving', lambda r: trial(r)['native']['before'].update(lowPowerMode=True)),
            ('CPU went backwards', lambda r: trial(r)['native']['after'].update(cpuMs=0)),
            ('missing peak', lambda r: trial(r)['native'].update(sampledPeakMemoryBytes=0)),
            ('presented-FPS overclaim', lambda r: trial(r)['native'].update(frameMetric='presented-fps')),
            ('missing submissions', lambda r: trial(r).update(plays=[])),
            ('missing boundary work', lambda r: trial(r).update(timerWork=[])),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                broken = copy.deepcopy(report); mutate(broken)
                with self.assertRaises(AssertionError): budgets.verify(broken, case=case)

    def test_real_input_and_negative_controls(self):
        for platform in ('ios', 'android', 'physical-android'):
            for kind in ('drag-js', 'pan-native', 'scroll-js', 'header-native'):
                report = read(f'2026-10-30-{platform}-{kind}.json.gz')
                self.assertIs(report['recording'], False)
                options = dict(allow_simulator=platform == 'android',
                               allow_unavailable_thermal=platform == 'physical-android')
                if platform == 'physical-android':
                    self.assertIs(report['device']['physical'], True)
                    with self.assertRaisesRegex(AssertionError, 'not nominal-temperature acceptance'):
                        inputs.verify(report)
                inputs.verify(report, **options)
                cases = [
                    ('unfinished', lambda r: r.update(completed=False)),
                    ('missing event', lambda r: r['events'].pop()),
                    ('backgrounded', lambda r: r['events'][1].update(suspensions=1)),
                    ('native nodes retained', lambda r: r['events'][-1]['live'].update(nodes=1)),
                    ('pending timer', lambda r: r['events'][-1]['driver'].update(pendingTimers=1)),
                    ('late callbacks', lambda r: r['events'][-1]['driver'].update(endCallbacks=999)),
                    ('no sampled movement', lambda r: [f.__setitem__(5 if kind == 'header-native' else 3, 0) for f in r['native']['frames']]),
                    ('truncated buffer', lambda r: r['native'].update(overflow=1)),
                ]
                for name, mutate in cases:
                    with self.subTest(platform=platform, kind=kind, failure=name):
                        broken = copy.deepcopy(report); mutate(broken)
                        with self.assertRaises(AssertionError): inputs.verify(broken, **options)


if __name__ == '__main__':
    unittest.main()
