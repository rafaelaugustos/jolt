"""Negative controls for the captured native gallery text evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('gallery_text', ROOT / 'verify-gallery-text.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GalleryTextTests(unittest.TestCase):
    def setUp(self):
        self.reports = [json.loads((ROOT / 'results/gallery' /
            f'2026-10-30-large-text-{platform}.json').read_text()) for platform in ('ios', 'android')]

    def reject(self, change):
        for original in self.reports:
            report = copy.deepcopy(original)
            samples = [e for e in report['gallery']['events'] if e['event'] == 'text-snapshot']
            change(report, samples)
            with self.subTest(platform=samples[0]['typography']['systemScale']):
                with self.assertRaises(AssertionError):
                    module.verify(report)

    def test_native_captures(self):
        for report in self.reports:
            self.assertEqual(module.verify(report)['sharedReturns'], 2)

    def test_clipped_title(self):
        self.reject(lambda r, s: s[2]['typography']['title'].update(height=10))

    def test_ignored_font_change(self):
        self.reject(lambda r, s: s[2]['typography']['zoom'].update(font=s[0]['typography']['zoom']['font']))

    def test_lost_zoom(self):
        def reset(r, s):
            s[2]['state']['scale'] = s[2]['native']['scale'] = 1
        self.reject(reset)

    def test_covered_photo(self):
        self.reject(lambda r, s: s[2]['layout']['footer'].update(y=s[2]['layout']['viewport']['y']))

    def test_missing_photo_viewport(self):
        self.reject(lambda r, s: s[4]['layout']['viewport'].update(height=0))

    def test_overlapping_buttons(self):
        self.reject(lambda r, s: s[2]['typography']['reset'].update(x=s[2]['typography']['zoom']['x']))

    def test_wrong_font_restoration(self):
        self.reject(lambda r, s: s[6]['typography']['title'].update(font=100))

    def test_missing_landscape_zoom(self):
        def remove(r, s):
            r['gallery']['events'] = [e for e in r['gallery']['events']
                if not (e['event'] == 'settled' and s[3]['time'] < e['time'] < s[4]['time']
                        and abs(e.get('state', {}).get('scale', 0) - 2.5) < .01)]
        self.reject(remove)

    def test_wrong_return_target(self):
        self.reject(lambda r, s: r['collection'].update(key='place-1'))

    def test_duplicate_route_commit(self):
        self.reject(lambda r, s: r['collection'].update(commits=3))

    def test_leaked_native_owner(self):
        self.reject(lambda r, s: r['collection'].update(inputs=1))

    def test_missing_snapshot(self):
        self.reject(lambda r, s: r['gallery']['events'].remove(s[2]))


if __name__ == '__main__':
    unittest.main()
