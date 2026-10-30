"""Negative controls for the real native modal observations."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('modal', ROOT/'verify-interactive-modal.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ModalEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.reports = {scenario: json.loads((ROOT/'results/interactive-modal'/f'2026-10-30-{scenario}-ios.json').read_text())
                        for scenario in ('checks', 'lifecycle')}

    def reject(self, change, scenarios=('checks', 'lifecycle')):
        for scenario in scenarios:
            report = copy.deepcopy(self.reports[scenario])
            change(report['events'])
            with self.subTest(scenario=scenario), self.assertRaises(AssertionError):
                module.verify(report, scenario)

    def test_native_captures(self):
        for scenario, report in self.reports.items():
            self.assertEqual(module.verify(report, scenario)['finalNativeResources'], 0)

    def test_duplicate_callback(self):
        self.reject(lambda events: next(e for e in events if e['name']=='callback').update(callbacks=2))

    def test_unmounted_cancelled_modal(self):
        self.reject(lambda events: next(e for e in events if e['name']=='state' and e.get('extra',{}).get('outcome')=='cancelled').update(attached=False))

    def test_cancel_invoked_close_callback(self):
        self.reject(lambda events: next(e for e in events if e['name']=='state' and e.get('extra',{}).get('outcome')=='cancelled').update(callbacks=1,unmounts=1))

    def test_lost_pose(self):
        self.reject(lambda events: next(e for e in events if e['name']=='snapshot').update(transform=[1,0,0,1,0,12]))

    def test_leaked_native_context(self):
        self.reject(lambda events: next(e for e in events if e['name']=='closed-settled').update(active=1))

    def test_leaked_recognizer(self):
        self.reject(lambda events: next(e for e in events if e['name']=='closed-settled').update(recognizers=1))

    def test_wrong_route(self):
        self.reject(lambda events: [e for e in events if e['name']=='snapshot'][1].update(depth=20))

    def test_unreleased_modal(self):
        self.reject(lambda events: next(e for e in events if e['name']=='closed-settled').update(presented=True))

    def test_missing_close(self):
        self.reject(lambda events: events.remove(next(e for e in events if e['name']=='callback')))

    def test_duplicate_early_close(self):
        self.reject(lambda events: next(e for e in events if e['name']=='early-close').update(extra=[True,True]), ('checks',))

    def test_scroll_was_not_delivered(self):
        self.reject(lambda events: [e for e in events if e['name']=='snapshot'][8].update(extra={'scroll':0}), ('checks',))

    def test_disposed_owner_still_recognizes(self):
        self.reject(lambda events: [e for e in events if e['name']=='snapshot'][6].update(recognizers=1), ('checks',))

    def test_nonanimated_owner_starts_gesture(self):
        self.reject(lambda events: [e for e in events if e['name']=='snapshot'][7].update(recognizers=1), ('checks',))

    def test_background_did_not_hold_gesture(self):
        self.reject(lambda events: next(e for e in events if e['name']=='background').update(state='idle'), ('lifecycle',))

    def test_lost_owner_after_resume(self):
        self.reject(lambda events: next(e for e in events if e['name']=='foreground' and e.get('state')=='idle').update(recognizers=0), ('lifecycle',))

    def test_rotation_did_not_happen(self):
        self.reject(lambda events: [e for e in events if e['name']=='snapshot'][1].update(orientation=1), ('lifecycle',))


if __name__ == '__main__':
    unittest.main()
