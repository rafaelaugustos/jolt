"""Negative controls for the captured native lifecycle evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('sensor_lifecycle', ROOT/'verify-sensor-lifecycle.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class SensorLifecycleEvidence(unittest.TestCase):
    def test_captures_and_negative_controls(self):
        for platform in ('ios', 'android'):
            report = json.loads((ROOT/f'results/device-sensors/2026-10-29-lifecycle-{platform}.json').read_text())
            self.assertEqual(verifier.verify(report)['backgroundCycles'], 5)
            events = report['events']
            # Use a moving preview cycle, separate from initial hardware availability.
            held = next(i for i, e in enumerate(events) if e['name'] == 'background'
                        and any(p['name'] == 'preview' for p in events[:i]))
            resumed = next(i for i in range(held+1, len(events)) if events[i]['name'] == 'foreground')
            observed = next(i for i in range(resumed+1, len(events)) if events[i]['name'] == 'snapshot')
            paused = next(i for i, e in enumerate(events) if e['name'] == 'foreground' and e['paused'])
            manual = next(i for i in range(paused+1, len(events)) if events[i]['name'] == 'resume')
            playing = next(i for i in range(manual+1, len(events)) if events[i]['name'] == 'snapshot')
            disposed = next(i for i, e in enumerate(events) if e['name'] == 'disposed')
            mutations = {
                'sampling while suspended': lambda r: r['events'][resumed]['rotation'].__setitem__('samples', events[resumed]['rotation']['samples']+1),
                'frames while suspended': lambda r: r['events'][resumed]['gravity'].__setitem__('frames', events[resumed]['gravity']['frames']+1),
                'source pose jump': lambda r: r['events'][resumed]['rotation']['values'].__setitem__(0, .99),
                'native pose jump': lambda r: r['events'][resumed]['card'].__setitem__('x', 20),
                'stalled resume': lambda r: r['events'][observed]['rotation'].__setitem__('frames', events[resumed]['rotation']['frames']),
                'pause lost': lambda r: r['events'][paused].__setitem__('paused', False),
                'manual resume stalled': lambda r: r['events'][playing]['rotation'].__setitem__('frames', events[paused]['rotation']['frames']),
                'hardware retained': lambda r: r['events'][held].__setitem__('active', 1),
                'nodes retained': lambda r: r['events'][disposed].__setitem__('nodes', 1),
                'missing foreground': lambda r: r['events'][resumed].__setitem__('name', 'snapshot'),
                'stale session': lambda r: r.__setitem__('session', events[-1]['time']+1),
                'duplicate observation': lambda r: r['events'][resumed].__setitem__('sequence', events[held]['sequence']),
                'missing reentry': lambda r: [e.__setitem__('instance', 1) for e in r['events']],
            }
            for name, mutate in mutations.items():
                with self.subTest(platform=platform, control=name):
                    invalid = copy.deepcopy(report)
                    mutate(invalid)
                    with self.assertRaises(AssertionError):
                        verifier.verify(invalid)


if __name__ == '__main__':
    unittest.main()
