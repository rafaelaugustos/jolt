"""Skip native runners only when every PR change is documentation or a JS unit test."""
import os
from pathlib import Path
import subprocess


def needs_native(paths):
    def lightweight(path):
        return (path.startswith(('docs/', 'test/', '.github/assets/'))
                or path.endswith('.md')
                or path in ('LICENSE', '.github/workflows/docs.yml'))
    return any(not lightweight(path) for path in paths)


def main():
    native = True
    if os.environ.get('EVENT_NAME') == 'pull_request':
        # checkout's synthetic merge commit includes both parents at depth 2.
        # Compare the actual proposed tree to its base, including renamed/deleted paths.
        paths = subprocess.check_output(
            ['git', 'diff', '--no-renames', '--name-only', '-z', 'HEAD^1', 'HEAD'],
            timeout=30).decode().split('\0')
        native = needs_native([path for path in paths if path])
    result = f"native={str(native).lower()}"
    with Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
        output.write(result + '\n')
    print(result, flush=True)
    print('Run all native checks.' if native else 'Documentation/JS tests only; native jobs skipped.', flush=True)


if __name__ == '__main__':
    main()
