"""Negative controls for the physical reader evidence, not mocked UI behavior."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

root = Path(__file__).parent
spec = importlib.util.spec_from_file_location('verify', root / 'verify-scroll-header-accessibility.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReaderEvidence(unittest.TestCase):
    def setUp(self):
        evidence = root / 'results/scroll-header-accessibility'
        self.ios = json.loads((evidence / 'ios.json').read_text())
        self.android = json.loads((evidence / 'android.json').read_text())
        self.reader = json.loads((evidence / 'talkback.json').read_text())

    def test_recorded_runs(self):
        module.verify('ios', self.ios)
        module.verify('android', self.android, self.reader)

    def test_rejects_false_acceptance(self):
        for platform, source in [('ios', self.ios), ('android', self.android)]:
            for fault in ('wrong-row', 'leak', 'no-disposal', 'no-scroll'):
                data = copy.deepcopy(source)
                if fault == 'wrong-row':
                    next(e for e in data['events'] if e['name'] == 'tap')['extra'] = 'song-13'
                elif fault == 'leak': data['resources']['sources'] = 1
                elif fault == 'no-disposal': data['events'].pop()
                else:
                    for e in data['events']:
                        if e.get('state'): e['state']['offset'] = 0
                with self.subTest(platform=platform, fault=fault), self.assertRaises(AssertionError):
                    module.verify(platform, data, self.reader)

    def test_rejects_speech_without_native_focus(self):
        for field, value in [('focused', False), ('element', False), ('hidden', True)]:
            data = copy.deepcopy(self.ios)
            event = next(e for e in data['events'] if e['name'] == 'focus-compact-title')
            event['accessibility'][1][field] = value
            with self.subTest(field=field), self.assertRaises(AssertionError):
                module.verify('ios', data)
        reader = copy.deepcopy(self.reader)
        next(e for e in reader if e['name'] == 'collapsed')['focus']['id'] = 'scroll-header-title'
        with self.assertRaises(AssertionError):
            module.verify('android', self.android, reader)
        data = copy.deepcopy(self.ios)
        next(e for e in data['events'] if e['name'] == 'focus-compact-title')['accessibility'][3]['hidden'] = False
        with self.assertRaises(AssertionError):
            module.verify('ios', data)


if __name__ == '__main__':
    unittest.main()
