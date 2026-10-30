"""Negative controls against observations captured from the native demo."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('scroll_text', ROOT / 'verify-scroll-header-text.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ScrollHeaderTextTests(unittest.TestCase):
    def setUp(self):
        self.reports = [json.loads((ROOT / 'results/scroll-header' /
            f'2026-10-29-large-text-{platform}.json').read_text()) for platform in ('ios', 'android')]

    def reject(self, change):
        for original in self.reports:
            report = copy.deepcopy(original)
            snapshots = [e for e in report['events'] if e['name'] == 'snapshot']
            change(report, snapshots)
            with self.subTest(platform=snapshots[0]['typography']['systemScale']):
                with self.assertRaises(AssertionError):
                    module.verify(report)

    def test_native_captures(self):
        for report in self.reports:
            self.assertEqual(module.verify(report)['snapshots'], 8)

    def test_clipped_title(self):
        self.reject(lambda r, s: s[3]['typography']['title'].update(height=10))

    def test_ellipsized_compact_title(self):
        self.reject(lambda r, s: s[3]['typography']['compactTitle'].update(ellipsized=True))

    def test_ignored_font_change(self):
        self.reject(lambda r, s: s[2]['typography']['title'].update(font=s[1]['typography']['title']['font']))

    def test_wrong_font_restoration(self):
        self.reject(lambda r, s: s[7]['typography']['compactTitle'].update(font=100))

    def test_covered_anchor(self):
        self.reject(lambda r, s: s[3]['geometry'].update(minimum=s[3]['geometry']['minimum'] + 12))

    def test_inexact_jump(self):
        def shift(r, s):
            for event in (s[6], s[7]):
                for row in event['rows']:
                    row['top'] += 8
        self.reject(shift)

    def test_missing_gesture(self):
        self.reject(lambda r, s: s[5]['state'].update(offset=0))

    def test_wrong_recycled_tap(self):
        def wrong_tap(r, s):
            for event in r['events']:
                if event['name'] == 'tap':
                    event['extra'] = 'song-35'
        self.reject(wrong_tap)

    def test_recreated_screen(self):
        self.reject(lambda r, s: r['events'].insert(0, {'name': 'ready'}))

    def test_leaked_source(self):
        self.reject(lambda r, s: r['resources'].update(sources=1))

    def test_missing_snapshot(self):
        self.reject(lambda r, s: r['events'].remove(s[2]))

    def test_unclipped_ios_viewport(self):
        report = self.reports[0]
        next(e for e in report['events'] if e['name'] == 'snapshot')['host']['clips'] = False
        with self.assertRaises(AssertionError):
            module.verify(report)


if __name__ == '__main__':
    unittest.main()
