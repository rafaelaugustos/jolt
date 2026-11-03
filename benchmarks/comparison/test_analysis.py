import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import hashlib
import tempfile
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('comparison', Path(__file__).with_name('android.py'))
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)

class TraceTransfer(unittest.TestCase):
    def test_retries_a_truncated_successful_transfer(self):
        payload=b'complete trace bytes'
        expected=hashlib.sha256(payload).hexdigest()+'  /remote/trace\n'
        with tempfile.TemporaryDirectory() as directory:
            destination=Path(directory)/'trace'
            copies=iter([payload[:4],payload])
            def pull(*args,**kwargs):
                destination.write_bytes(next(copies))
                return SimpleNamespace(returncode=0,stdout='transfer complete')
            with patch.object(comparison.subprocess,'check_output',return_value=expected), patch.object(comparison.subprocess,'run',side_effect=pull) as run:
                comparison.retrieve_trace('test-device','/remote/trace',destination)
            self.assertEqual(run.call_count,2)
            self.assertEqual(destination.read_bytes(),payload)

    def test_never_accepts_repeated_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            destination=Path(directory)/'trace'
            destination.write_bytes(b'truncated')
            with patch.object(comparison.subprocess,'check_output',return_value='expected /remote/trace'), patch.object(comparison.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout='')) as run:
                with self.assertRaises(AssertionError):
                    comparison.retrieve_trace('test-device','/remote/trace',destination)
            self.assertEqual(run.call_count,3)

class DiagnosticSelection(unittest.TestCase):
    def test_rejects_typo_duplicate_and_static_motion_instead_of_mislabeling_a_run(self):
        for values in (['diagnostic-drivr=native'], ['diagnostic-driver=static'],
                       ['diagnostic-start=vsync', 'diagnostic-start=immediate'],
                       ['diagnostic-tile'], ['diagnostic-layer=auto']):
            with self.subTest(values=values), self.assertRaises(ValueError):
                comparison.diagnostic_intents(values)

    def test_preserves_explicit_controls(self):
        self.assertEqual(comparison.diagnostic_intents(['diagnostic-driver=native', 'diagnostic-tile=layout']),
                         {'diagnostic-driver':'native', 'diagnostic-tile':'layout'})

class PresentationAnalysis(unittest.TestCase):
    def test_pairs_actual_fences_without_inventing_missing_presentation_or_latency(self):
        def row(name, frame, ts, layer='app'):
            return {'name':name,'frame_number':str(frame),'ts':str(ts),'layer_name':layer}
        events = [row('Queue',1,1_000_000),row('PresentFenceSignaled',1,20_000_000),
            row('PresentFenceSignaled',1,20_000_000), # duplicate packet
            row('Queue',2,21_000_000), # no fence: not a presented frame
            row('PresentFenceSignaled',3,60_000_000), # queue outside the window
            row('Queue',4,80_000_000),row('PresentFenceSignaled',4,70_000_000), # invalid latency
            row('PresentFenceSignaled',5,9223372036854775807), # unsignaled fence
            row('PresentFenceSignaled',1,30_000_000,'other')]
        result=comparison.analyze_presentations(events)
        self.assertEqual(result['layer'],'app')
        self.assertEqual(result['presentedFrames'],3)
        self.assertEqual(result['presentationGapMs']['max'],40)
        self.assertEqual(result['queueToPresentMs']['n'],1)
        self.assertEqual(result['queueToPresentMs']['p50'],19)

    def test_no_fences_is_failure_not_zero_latency(self):
        with self.assertRaises(AssertionError): comparison.analyze_presentations([])
        self.assertIsNone(comparison.distribution([])['p50'])

class HostAcceptance(unittest.TestCase):
    def test_rejects_heavy_compilation_even_before_load_average_rises(self):
        with patch.object(comparison.os,'getloadavg',return_value=(2,2,2)), patch.object(comparison.os,'cpu_count',return_value=16), patch.object(comparison.subprocess,'check_output',return_value='PCPU COMM\n500 /toolchain/clang\n'):
            result=comparison.host_observation()
        self.assertFalse(result['quiet'])
        self.assertEqual(result['busyCompilers'][0]['command'],'clang')

    def test_allows_emulator_load_but_compilation_still_rejects(self):
        with patch.object(comparison.os,'getloadavg',return_value=(20,20,20)), patch.object(comparison.os,'cpu_count',return_value=16):
            with patch.object(comparison.subprocess,'check_output',return_value='PCPU COMM\n'):
                self.assertTrue(comparison.host_observation(during_window=True)['quiet'])
            with patch.object(comparison.subprocess,'check_output',return_value='PCPU COMM\n500 /toolchain/clang\n'):
                self.assertFalse(comparison.host_observation(during_window=True)['quiet'])

    def test_rejects_extreme_non_compiler_contention_during_playback(self):
        with patch.object(comparison.os,'getloadavg',return_value=(82,82,82)), patch.object(comparison.os,'cpu_count',return_value=16), patch.object(comparison.subprocess,'check_output',return_value='PCPU COMM\n'):
            result=comparison.host_observation(during_window=True)
        self.assertFalse(result['quiet'])
        self.assertEqual(result['loadAverageLimit'],32)

    def test_rejects_high_load_and_accepts_idle_host(self):
        with patch.object(comparison.os,'cpu_count',return_value=16), patch.object(comparison.subprocess,'check_output',return_value='PCPU COMM\n80 /toolchain/clang\n'):
            with patch.object(comparison.os,'getloadavg',return_value=(20,20,20)):
                self.assertFalse(comparison.host_observation()['quiet'])
            with patch.object(comparison.os,'getloadavg',return_value=(4,4,4)):
                self.assertTrue(comparison.host_observation()['quiet'])

if __name__=='__main__': unittest.main()
