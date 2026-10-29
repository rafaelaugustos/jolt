"""Negative controls for the captured hardware-only iPhone audit."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('physical', ROOT / 'verify-sensors-physical-ios.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PhysicalSensors(unittest.TestCase):
    def setUp(self):
        self.report = json.loads((ROOT / 'results/device-sensors/2026-10-29-physical-ios.json').read_text())

    def test_captured_trace(self):
        result = module.verify(self.report)
        self.assertEqual(result['instances'], 3)
        self.assertEqual(result['backgroundCycles'], 5)
        self.assertEqual(result['finalNativeResources'], 0)

    def test_corruption_is_rejected(self):
        cases = [
            ('wrong platform', lambda r: r.update(platform='android')),
            ('stale report', lambda r: r.update(session=r['events'][-1]['time']+1)),
            ('synthetic preview', lambda r: r['events'][3].update(name='preview')),
            ('missing hardware', lambda r: self.second(r)['rotation'].update(available=False)),
            ('stalled acquisition', lambda r: self.second(r)['rotation'].update(samples=0)),
            ('JS callbacks', lambda r: self.second(r)['rotation'].update(callbacks=100)),
            ('invalid gravity', lambda r: self.second(r)['gravity'].update(values=[0, 0, 1])),
            ('invalid quaternion', lambda r: self.second(r)['rotation'].update(values=[0]*7)),
            ('hardware retained', lambda r: r['events'][-1].update(active=1)),
            ('nodes retained', lambda r: r['events'][-1].update(nodes=1)),
            ('duplicated boundary', lambda r: self.named(r, 'foreground').update(name='background')),
            ('background sampling', lambda r: self.named(r, 'foreground')['rotation'].update(samples=99999)),
            ('resume pose jump', lambda r: self.named(r, 'foreground')['card'].update(m11=42)),
            ('pause lost', lambda r: self.named(r, 'pause')['rotation'].update(frames=99999)),
            ('Reduce Motion ignored', lambda r: self.named(r, 'reduced')['gravity'].update(frames=99999)),
            ('lost shared subscription', lambda r: self.named(r, 'shared').update(active=2)),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                corrupted = copy.deepcopy(self.report)
                mutate(corrupted)
                with self.assertRaises(AssertionError):
                    module.verify(corrupted)

    @staticmethod
    def second(report):
        return [e for e in report['events'] if e['name'] == 'snapshot'][1]

    @staticmethod
    def named(report, name):
        return next(e for e in report['events'] if e['name'] == name)


if __name__ == '__main__':
    unittest.main()
