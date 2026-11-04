"""Private build permissions survive a permissive service-user session umask."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import buddy_release_git as git_helpers
import buddy_release_primitives as release


class ServiceCommandRunner:
    config = SimpleNamespace(service_user='synthetic-only')

    def run(self, cmd, *, cwd, timeout):
        # Model the sudo session's observed 0002 without invoking sudo or touching a service.
        command = cmd[cmd.index('env'):]
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                                preexec_fn=lambda: os.umask(0o002))
        if result.returncode:
            raise AssertionError(result.stderr)
        return result.stdout.strip()


class PrivateBuildUmaskTests(unittest.TestCase):
    def test_service_build_creates_private_git_metadata_before_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            code = "import pathlib;p=pathlib.Path('source/.git');p.mkdir(parents=True);(p/'config').write_text('synthetic')"
            with patch.dict(release.BIN, {'bash': shutil.which('bash')}):
                release.Runtime.run_as_service_user(ServiceCommandRunner(), [sys.executable, '-c', code],
                                                    cwd=root, env={'PATH': os.environ['PATH']}, timeout=5)
            shutil.copytree(root / 'source', root / 'copied')
            git_helpers.assert_trusted_dir(root / 'copied/.git', uid=os.getuid())
            self.assertEqual((root / 'copied/.git').stat().st_mode & 0o777, 0o700)
            self.assertEqual((root / 'copied/.git/config').stat().st_mode & 0o777, 0o600)

    def test_explicitly_unsafe_copied_metadata_still_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            metadata = Path(directory) / '.git'
            metadata.mkdir()
            metadata.chmod(0o775)
            with self.assertRaises(git_helpers.GitVerificationError):
                git_helpers.assert_trusted_dir(metadata, uid=os.getuid())


if __name__ == '__main__':
    unittest.main()
