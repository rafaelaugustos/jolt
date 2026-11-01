"""Offline negative controls for the native refresh evidence verifier."""
import copy
import importlib.util
from pathlib import Path
import unittest

module=importlib.util.spec_from_file_location('refresh',Path(__file__).with_name('verify-scroll-header-refresh.py'))
verify=importlib.util.module_from_spec(module);module.loader.exec_module(verify)

class EvidenceTests(unittest.TestCase):
    def test_recorded_platforms_and_negative_controls(self):
        import json
        for platform in ['ios','android']:
            original=json.loads((Path(__file__).parent/'results/scroll-header-refresh'/f'{platform}.json').read_text())
            verify.verify(platform,original)
            def check(e,label):return next(c['event'] for c in e['checks'] if c['label']==label)
            mutations=[
                lambda e:check(e,'short-pull').update(refreshRequests=1),
                lambda e:check(e,'success').update(refreshRequests=2),
                lambda e:check(e,'failure').update(refreshCommits=2),
                lambda e:check(e,'anchored')['rows'].clear(),
                lambda e:check(e,'empty-success')['state'].update(total=1),
                lambda e:check(e,'unload-cancelled').update(refreshCommits=7),
                lambda e:check(e,'background-cancelled')['state'].update(refresh='refreshing'),
                lambda e:e['report']['resources'].update(sources=1),
                lambda e:e['report']['events'][-1].update(refreshCommits=7),
                lambda e:e['checks'].pop(),
            ]
            for mutate in mutations:
                with self.subTest(platform=platform,mutation=mutate):
                    bad=copy.deepcopy(original);mutate(bad)
                    with self.assertRaises(AssertionError):verify.verify(platform,bad)

if __name__=='__main__':unittest.main()
