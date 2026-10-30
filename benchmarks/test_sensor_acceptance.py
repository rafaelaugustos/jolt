"""Negative controls for physical recovery and process-cost evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name+'.py'))
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


recovery = module('verify-sensor-acceptance')
intervals = module('verify-sensor-intervals')


class PhysicalAcceptance(unittest.TestCase):
    def captures(self, kind):
        for platform in ('ios', 'android'):
            yield json.loads((ROOT / f'results/device-sensors/2026-10-30-{kind}-{platform}.json').read_text())

    @staticmethod
    def event(report, name):
        return next(e for e in report['events'] if e['name'] == name)

    def test_recovery(self):
        cases = [
            ('simulator', lambda r: r['device'].update(physical=False)),
            ('preview input', lambda r: r.update(input='synthetic')),
            ('poses claimed without evidence', lambda r: r.update(mode='manual-poses-and-recovery')),
            ('failure not surfaced', lambda r: self.event(r, 'no-data')['sources']['gravity-device'].update(status='active')),
            ('failure retains clock', lambda r: self.event(r, 'error-held')['native'].update(clock=1)),
            ('continued samples', lambda r: self.event(r, 'error-held')['sources']['rotation-interface'].update(samples=99999)),
            ('held value changed', lambda r: self.event(r, 'error-held')['sources']['gravity-device'].update(values=[0, 0, 0])),
            ('recovery stalled', lambda r: self.event(r, 'recovered')['sources']['rotation-device'].update(frames=0)),
            ('recovery invalid', lambda r: self.event(r, 'recovered')['sources']['rotation-device'].update(values=[0]*7)),
            ('missing failed source', lambda r: self.event(r, 'no-data')['sources'].pop('gravity-device')),
            ('early watchdog observation', lambda r: self.event(r, 'no-data').update(time=self.event(r, 'before-dropout')['time']+100)),
            ('source retained', lambda r: self.event(r, 'disposed')['native'].update(sources=1)),
        ]
        for report in self.captures('recovery'):
            self.assertEqual(recovery.verify(report)['physicalPoses'], 0)
            variants = cases + ([('access failure ignored', lambda r: self.event(r, 'injected-access-failure')['sources']['rotation-device'].update(error=None))] if report['platform']=='ios' else [])
            for name, mutate in variants:
                with self.subTest(platform=report['platform'], corruption=name):
                    bad = copy.deepcopy(report)
                    mutate(bad)
                    with self.assertRaises(AssertionError): recovery.verify(bad)

    def test_profiles(self):
        cases = [
            ('missing window', lambda r: r['profiles'].pop()),
            ('negative CPU', lambda r: r['profiles'][0]['recording']['after'].update(cpuMs=0)),
            ('wrong memory metric', lambda r: r['profiles'][0]['recording']['after'].update(memoryMetric='heap')),
            ('missing memory samples', lambda r: r['profiles'][0]['recording'].update(memorySamples=0)),
            ('invalid peak', lambda r: r['profiles'][0]['recording'].update(sampledPeakMemoryBytes=0)),
            ('truncated trace', lambda r: r['profiles'][0]['recording'].update(overflow=1)),
            ('presented FPS claim', lambda r: r['profiles'][0]['recording'].update(frameMetric='presented-frames')),
            ('invalid timestamp', lambda r: r['profiles'][0]['recording']['frames'][0].__setitem__(0, float('nan'))),
            ('reordered callbacks', lambda r: r['profiles'][0]['recording']['frames'].reverse()),
            ('probe exceeds window', lambda r: r['profiles'][0]['recording'].update(probeWorkMs=10000)),
        ]
        for report in self.captures('intervals'):
            self.assertEqual(list(intervals.verify_profiles(report)), intervals.PHASES)
            for name, mutate in cases:
                with self.subTest(platform=report['platform'], corruption=name):
                    bad = copy.deepcopy(report)
                    mutate(bad)
                    with self.assertRaises(AssertionError): intervals.verify_profiles(bad)


if __name__ == '__main__':
    unittest.main()
