"""Negative controls for the physical interval/consumer matrix."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('intervals', ROOT / 'verify-sensor-intervals.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SensorIntervals(unittest.TestCase):
    def setUp(self):
        self.report = json.loads((ROOT / 'results/device-sensors/2026-10-29-intervals-ios.json').read_text())

    def test_real_capture(self):
        summary = module.verify(self.report)
        self.assertEqual(list(summary), module.PHASES)
        self.assertEqual(summary['all-disposed']['activeSubscriptions'], 0)

    @staticmethod
    def edge(report, phase, name='window-end'):
        return next(e for e in report['events'] if e['phase'] == phase and e['name'] == name)

    @classmethod
    def inflate_samples(cls, report, phase, sources):
        a, b = cls.edge(report, phase, 'window-start'), cls.edge(report, phase)
        for source in sources:
            b['sources'][source]['samples'] = a['sources'][source]['samples'] + 400

    def test_corruptions(self):
        cases = [
            ('unfinished run', lambda r: r.update(status='running')),
            ('simulated device', lambda r: r['device'].update(simulator=True)),
            ('stale session', lambda r: r.update(session=r['events'][-1]['time']+1)),
            ('missing phase', lambda r: self.edge(r, 'mixed').update(phase='unexpected')),
            ('wrong request', lambda r: self.edge(r, 'interval-33')['sources']['rotation'].update(requested=16)),
            ('preview input', lambda r: self.edge(r, 'mixed')['sources']['slow'].update(status='replaying')),
            ('JS callback', lambda r: self.edge(r, 'mixed')['sources']['fast'].update(callbacks=100)),
            ('separate hardware subscriptions', lambda r: self.edge(r, 'mixed')['native'].update(active=2)),
            ('unshared delivery', lambda r: self.edge(r, 'mixed')['sources']['slow'].update(samples=99999)),
            ('interval request ignored', lambda r: self.inflate_samples(r, 'interval-33', ('rotation', 'gravity'))),
            ('fast removal ignored', lambda r: self.inflate_samples(r, 'fast-removed', ('slow',))),
            ('slow consumer overcommits', lambda r: self.edge(r, 'mixed')['sources']['slow'].update(frames=99999)),
            ('one detach stops remaining consumer', lambda r: self.edge(r, 'one-slow-binding')['sources']['slow'].update(status='idle')),
            ('unbound source still samples', lambda r: self.edge(r, 'idle')['sources']['fast'].update(samples=1)),
            ('last detach still commits', lambda r: self.edge(r, 'last-binding-removed')['sources']['slow'].update(frames=99999)),
            ('clock retained while idle', lambda r: self.edge(r, 'last-binding-removed')['native'].update(clock=1)),
            ('reattachment stalled', lambda r: self.edge(r, 'reattached')['sources']['slow'].update(status='idle')),
            ('source retained', lambda r: r['events'][-1]['native'].update(sources=1)),
            ('nodes retained', lambda r: r['events'][-1]['native'].update(nodes=7)),
            ('window too short', lambda r: self.edge(r, 'mixed').update(monotonicMs=self.edge(r, 'mixed', 'window-start')['monotonicMs']+100)),
            ('invalid gravity', lambda r: self.edge(r, 'interval-16')['sources']['gravity'].update(values=[0, 0, 1])),
            ('invalid quaternion', lambda r: self.edge(r, 'mixed')['sources']['slow'].update(values=[0]*7)),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                bad = copy.deepcopy(self.report)
                mutate(bad)
                with self.assertRaises(AssertionError):
                    module.verify(bad)


class AndroidSensorIntervals(SensorIntervals):
    def setUp(self):
        self.report = json.loads((ROOT / 'results/device-sensors/2026-10-30-intervals-android.json').read_text())


if __name__ == '__main__':
    unittest.main()
