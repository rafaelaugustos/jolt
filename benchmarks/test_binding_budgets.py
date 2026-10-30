"""Offline negative controls against captured native evidence; no device/long CI job."""
import copy
import gzip
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


budgets = load_module('budgets', 'verify-binding-budgets.py')
inputs = load_module('inputs', 'verify-binding-input.py')


def read(name):
    return json.loads(gzip.decompress((ROOT/'results/binding-budgets'/name).read_bytes()))


class BindingBudgets(unittest.TestCase):
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
        for platform in ('ios', 'android'):
            for kind in ('drag-js', 'pan-native', 'scroll-js', 'header-native'):
                report = read(f'2026-10-30-{platform}-{kind}.json.gz')
                self.assertIs(report['recording'], False)
                inputs.verify(report, allow_simulator=platform == 'android')
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
                        with self.assertRaises(AssertionError): inputs.verify(broken, allow_simulator=platform == 'android')


if __name__ == '__main__':
    unittest.main()
