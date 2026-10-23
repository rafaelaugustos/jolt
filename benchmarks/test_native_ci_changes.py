import importlib.util
from pathlib import Path
import unittest
import os
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location('changes', Path(__file__).with_name('native-ci-changes.py'))
changes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(changes)


class NativeScope(unittest.TestCase):
    def test_documentation_and_unit_tests_do_not_allocate_native_runners(self):
        self.assertFalse(changes.needs_native(['README.md', 'docs/guide/gestures.md', 'docs/public/media/demo.mp4', 'test/gestures.spec.ts']))

    def test_native_inputs_and_unknown_files_always_run(self):
        for path in ['src/index.ts', 'platforms/ios/src/JoltLiveSpring.m',
                     'platforms/android/include.gradle', 'packages/native/package.json',
                     'benchmarks/test_native_ci.py', 'benchmarks/native-app/package-lock.json',
                     'package.json', 'package-lock.json', 'tsconfig.build.json',
                     '.github/workflows/native-ci.yml', 'new-build-input']:
            with self.subTest(path=path):
                self.assertTrue(changes.needs_native(['docs/index.md', path]))

    def test_rename_from_source_to_documentation_still_runs(self):
        self.assertTrue(changes.needs_native(['src/old.ts', 'docs/old.md']))

    def test_real_merge_diff_and_manual_dispatch(self):
        script = Path(__file__).with_name('native-ci-changes.py').resolve()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def git(*args):
                subprocess.run(['git', '-C', directory, *args], check=True, capture_output=True)

            git('init', '-b', 'main')
            git('config', 'user.name', 'CI test')
            git('config', 'user.email', 'ci@example.invalid')
            (root/'README.md').write_text('base')
            git('add', '.')
            git('commit', '-m', 'base')
            git('switch', '-c', 'docs')
            (root/'README.md').write_text('docs update')
            git('commit', '-am', 'docs')
            git('switch', 'main')
            git('merge', '--no-ff', 'docs', '-m', 'merge docs')
            output = root/'result'

            def classify(event):
                output.write_text('')
                subprocess.run(['python3', str(script)], cwd=root, check=True,
                               env={**os.environ, 'EVENT_NAME': event, 'GITHUB_OUTPUT': str(output)},
                               capture_output=True)
                return output.read_text().strip()

            self.assertEqual(classify('pull_request'), 'native=false')
            self.assertEqual(classify('workflow_dispatch'), 'native=true')
            (root/'src').mkdir()
            git('mv', 'README.md', 'src/driver.ts')
            git('commit', '-m', 'source moved from docs')
            self.assertEqual(classify('pull_request'), 'native=true')


if __name__ == '__main__':
    unittest.main()
