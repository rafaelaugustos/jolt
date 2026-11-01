"""Reject false acceptance of recorded native gallery reader runs."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

root = Path(__file__).parent
spec = importlib.util.spec_from_file_location('verify_gallery_reader', root / 'verify-gallery-accessibility.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GalleryReaderEvidence(unittest.TestCase):
    def setUp(self):
        folder = root / 'results/gallery-accessibility'
        self.evidence = {p: json.loads((folder / (p + '.json')).read_text()) for p in ['ios', 'android']}
        self.readers = {'ios': (folder / 'voiceover.txt').read_text(), 'android': json.loads((folder / 'talkback.json').read_text())}

    def test_recorded_runs(self):
        for platform in self.evidence:
            module.verify(platform, self.evidence[platform], self.readers[platform])

    def test_rejects_incomplete_or_incorrect_navigation(self):
        for platform, original in self.evidence.items():
            for fault in ['duplicate-commit', 'leak', 'hidden-cell', 'wrong-key', 'moved-fallback', 'no-reduced-motion', 'model-only-zoom', 'missing-reset', 'missing-native-focus', 'wrong-recycled-index']:
                data = copy.deepcopy(original)
                collection, events = data['collection'], data['gallery']['events']
                returns = [e for e in events if e['event'] == 'returned']
                if fault == 'duplicate-commit': collection['commits'] = 5
                elif fault == 'leak': collection['flights'] = 1
                elif fault == 'hidden-cell': collection['tags'][0]['visible'] = False
                elif fault == 'wrong-key': returns[1]['key'] = 'place-2'
                elif fault == 'moved-fallback': returns[1]['extra'] = {'status': 'unavailable', 'navigated': True, 'reason': 'geometry-changed'}
                elif fault == 'no-reduced-motion': returns[-1]['extra'] = {'status': 'completed', 'navigated': True}
                elif fault == 'model-only-zoom':
                    for e in events:
                        if e['event'] == 'settled' and e.get('native'): e['native']['scale'] = 1
                elif fault == 'missing-reset':
                    first_release = next(e['time'] for e in events if e['event'] == 'released')
                    data['gallery']['events'] = [e for e in events if not (e['event'] == 'settled' and e['time'] < first_release and abs(e['state']['scale'] - 1) < .02)]
                elif fault == 'missing-native-focus': collection['focusEvents'] = []
                elif fault == 'wrong-recycled-index':
                    for e in collection['focusEvents']:
                        if e['index'] == 59: e['index'] = 0
                with self.subTest(platform=platform, fault=fault), self.assertRaises(AssertionError):
                    module.verify(platform, data, self.readers[platform])

    def test_rejects_reader_evidence_for_a_different_target(self):
        reader = copy.deepcopy(self.readers['android'])
        next(e for e in reader if e['name'] == 'moved-return')['focus']['id'] = 'collection-place-2'
        with self.assertRaises(AssertionError): module.verify('android', self.evidence['android'], reader)
        reader = self.readers['ios'].replace('JOLT_CHECK moved-return', 'JOLT_CHECK unrelated')
        with self.assertRaises(AssertionError): module.verify('ios', self.evidence['ios'], reader)


if __name__ == '__main__': unittest.main()
