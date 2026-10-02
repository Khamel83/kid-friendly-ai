#!/usr/bin/env python3
import contextlib
import importlib.util
import json
import os
import pwd
import shutil
import signal
import stat
import subprocess
import sys
import time
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("buddy_oci_release.py")
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("buddy_oci_release", MODULE_PATH)
buddy = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = buddy
SPEC.loader.exec_module(buddy)


GOOD_SHA = "b99eb89680419876345d2d76131e453202455b17"
BASELINE_503_MEMORY_FALSE = {
    "home_status": 200,
    "health_status": 503,
    "invalid_ask_status": 400,
    "memory": False,
    "api": True,
}
POST_INSTALL_200 = {
    "home_status": 200,
    "health_status": 200,
    "invalid_ask_status": 400,
    "memory": True,
    "api": True,
}


def service_show(
    *,
    wd: str = "/old",
    pid: int = 1204,
    active: str = "active",
    substate: str = "running",
    envfiles: str = "",
    dropins: str = "",
    user: str = "ubuntu",
    restart_usec: str = "10s",
    environment: str = "NODE_ENV=production PATH=/home/ubuntu/.npm-global/bin:/usr/bin:/bin",
    fragment_path: str = "/etc/systemd/system/buddy.service",
) -> str:
    return "\n".join(
        [
            f"ActiveState={active}",
            f"SubState={substate}",
            f"WorkingDirectory={wd}",
            "ExecStart={ path=/usr/bin/npm ; argv[]=/usr/bin/npm start ; }",
            f"User={user}",
            f"Environment={environment}",
            f"EnvironmentFiles={envfiles}",
            f"DropInPaths={dropins}",
            "Restart=always",
            f"RestartUSec={restart_usec}",
            f"MainPID={pid}",
            f"FragmentPath={fragment_path}",
        ]
    )


def inactive_show(wd: str = "/old") -> str:
    return service_show(wd=wd, pid=0, active="inactive", substate="dead")


def mkdir(path: Path, mode: int = 0o755) -> None:
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(mode)


def write_file(path: Path, data: str | bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data)
    else:
        path.write_bytes(data)
    path.chmod(mode)


def make_config(root: Path, *, bootstrap: bool = True) -> buddy.ReleaseConfig:
    root = root.resolve()
    for directory in [
        root / "var" / "lib",
        root / "opt",
        root / "etc" / "systemd" / "system",
        root / "home" / "ubuntu" / "github" / "kid-friendly-ai",
    ]:
        mkdir(directory, 0o755)
    config = buddy.ReleaseConfig(
        root_uid=os.getuid(),
        root_gid=os.getgid(),
        service_uid=os.getuid(),
        service_gid=os.getgid(),
        release_root=root / "opt" / "buddy" / "releases",
        state_root=root / "var" / "lib" / "buddy" / "release-state",
        staging_root=root / "var" / "lib" / "buddy" / "release-staging",
        receipt_root=root / "var" / "lib" / "buddy" / "release-receipts",
        transaction_root=root / "var" / "lib" / "buddy" / "release-receipts" / "transactions",
        lock_path=root / "var" / "lib" / "buddy" / "release-state" / "lock",
        source_env=root / "home" / "ubuntu" / "github" / "kid-friendly-ai" / ".env.local",
        runtime_env=root / "etc" / "buddy" / "runtime.env",
        dropin=root / "etc" / "systemd" / "system" / "buddy.service.d" / "10-release.conf",
        unit=root / "etc" / "systemd" / "system" / "buddy.service",
        old_working_directory="/old",
        trust_anchor=root,
    )
    if bootstrap:
        buddy.bootstrap_release_roots(config)
    return config


def expected_probe() -> dict[str, str]:
    return {
        "source": GOOD_SHA,
        "bind": "127.0.0.1",
        "home": "200",
        "health": "503",
        "memory": "true",
        "api": "false",
        "invalid_ask": "400",
        "provider_request": "none",
    }


def make_release(config: buddy.ReleaseConfig, *, manifest_overrides: dict[str, object] | None = None) -> Path:
    buddy.bootstrap_release_roots(config)
    release = config.release_root / GOOD_SHA
    if release.exists():
        shutil.rmtree(release)
    release.mkdir(parents=True, mode=0o755)
    write_file(release / "package.json", "{}\n", 0o644)
    write_file(release / "package-lock.json", '{"lockfileVersion":3}\n', 0o644)
    for name in [".env.example", ".env.docker.example", ".env.local.example"]:
        write_file(release / name, "# example\n", 0o644)
    mkdir(release / ".next", 0o755)
    write_file(release / ".next" / "BUILD_ID", "build-1\n", 0o644)
    mkdir(release / "node_modules" / "fixture", 0o755)
    write_file(release / "node_modules" / "fixture" / ".env", "fixture=true\n", 0o644)
    buddy.chmod_release_tree(release, uid=config.root_uid, gid=config.root_gid, final_root=False)
    buddy.write_manifest(
        config,
        release,
        sha=GOOD_SHA,
        default_branch="main",
        head_sha=GOOD_SHA,
        node_version="v22.23.1",
        npm_version="10.9.0",
        probe=expected_probe(),
    )
    if manifest_overrides:
        manifest = json.loads((release / "BUDDY_RELEASE_MANIFEST.json").read_text())
        manifest.update(manifest_overrides)
        os.chmod(release / "BUDDY_RELEASE_MANIFEST.json", 0o644)
        write_file(release / "BUDDY_RELEASE_MANIFEST.json", json.dumps(manifest, sort_keys=True) + "\n", 0o444)
    os.chmod(release, 0o555)
    return release


def make_tree_writable(root: Path) -> None:
    for path in sorted(root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if not path.is_symlink():
            path.chmod(0o755 if path.is_dir() else 0o644)
    root.chmod(0o755)


class FakeRuntime(buddy.Runtime):
    def __init__(
        self,
        config: buddy.ReleaseConfig,
        *,
        shows: list[str] | None = None,
        fail_stop: bool = False,
        stop_failures: list[bool] | None = None,
    ) -> None:
        super().__init__(config, euid=lambda: 0)
        self.shows = list(shows or [service_show()])
        self.calls: list[list[str]] = []
        self.stop_failures = list(stop_failures if stop_failures is not None else ([True] if fail_stop else []))

    def run(self, cmd, *, cwd=None, env=None, timeout):
        self.calls.append(list(cmd))
        if Path(cmd[0]).name == "systemctl":
            if "show" in cmd:
                raw = self.shows.pop(0) if self.shows else service_show()
                return raw.replace("FragmentPath=/etc/systemd/system/buddy.service", f"FragmentPath={self.config.unit}")
            if "stop" in cmd and self.stop_failures and self.stop_failures.pop(0):
                raise buddy.ReleaseError("simulated stop failure")
            return ""
        return ""


def write_install_fixture(root: Path) -> tuple[buddy.ReleaseConfig, FakeRuntime]:
    config = make_config(root)
    make_release(config)
    write_file(config.source_env, "OPENROUTER_API_KEY=sk-test-secret\n", 0o600)
    write_file(config.runtime_env, "OPENROUTER_API_KEY=old\n", 0o600)
    write_file(config.dropin, "[Service]\nWorkingDirectory=/old\n", 0o644)
    write_file(config.unit, "[Service]\nExecStart=/usr/bin/npm start\n", 0o644)
    return config, FakeRuntime(config)


def create_interrupted_receipt(
    config: buddy.ReleaseConfig,
    *,
    phase: str,
    planned_runtime: bytes = b"OPENROUTER_API_KEY=new\n",
    planned_dropin: bytes = b"[Service]\nWorkingDirectory=/new\n",
    before_uid_delta: int = 0,
) -> Path:
    before_runtime = buddy.FileImage.capture(config.runtime_env, include_data=True)
    before_dropin = buddy.FileImage.capture(config.dropin, include_data=True)
    before_unit = buddy.FileImage.capture(config.unit, include_data=True)
    tx_id, tx_dir = buddy.create_transaction(config, GOOD_SHA)
    names = {
        "runtime_env": buddy.copy_beforeimage_bytes(config.runtime_env, tx_dir, "runtime.env.before", before_runtime),
        "dropin": buddy.copy_beforeimage_bytes(config.dropin, tx_dir, "10-release.conf.before", before_dropin),
        "unit": buddy.copy_beforeimage_bytes(config.unit, tx_dir, "buddy.service.before", before_unit),
    }
    before_runtime_public = before_runtime.public()
    if before_uid_delta:
        before_runtime_public["uid"] = int(before_runtime_public["uid"]) + before_uid_delta
    receipt = {
        "project": "buddy",
        "service": buddy.SERVICE_NAME,
        "source_sha": GOOD_SHA,
        "phase": phase,
        "transaction_id": tx_id,
        "release_dir": str(config.release_root / GOOD_SHA),
        "before": {
            "runtime_env": before_runtime_public,
            "dropin": before_dropin.public(),
            "unit": before_unit.public(),
            "systemd": buddy.read_service_identity(FakeRuntime(config, shows=[service_show()])),
            "health": BASELINE_503_MEMORY_FALSE,
        },
        "planned": {
            "runtime_env": buddy.planned_public_image(planned_runtime, mode=0o600, uid=config.root_uid, gid=config.root_gid),
            "dropin": buddy.planned_public_image(planned_dropin, mode=0o644, uid=config.root_uid, gid=config.root_gid),
        },
        "private_beforeimage_files": names,
    }
    receipt_path = buddy.receipt_path_for(config, tx_id)
    buddy.write_receipt(config, receipt_path, receipt)
    return receipt_path


class RuntimeCommandTests(unittest.TestCase):
    def test_timeout_terminates_own_child_process_group(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            pid_file = Path(tmp) / "child.pid"
            child_code = (
                "import time\n"
                "time.sleep(60)\n"
            )
            parent_code = (
                "import subprocess, sys, time\n"
                f"p = subprocess.Popen([sys.executable, '-c', {child_code!r}])\n"
                f"open({str(pid_file)!r}, 'w').write(str(p.pid))\n"
                "time.sleep(60)\n"
            )
            runtime = buddy.Runtime(euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "timed out"):
                runtime.run([sys.executable, "-c", parent_code], timeout=1)
            deadline = time.monotonic() + 5
            while not pid_file.exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(pid_file.exists())
            child_pid = int(pid_file.read_text())
            try:
                while time.monotonic() < deadline:
                    try:
                        os.kill(child_pid, 0)
                    except ProcessLookupError:
                        break
                    time.sleep(0.1)
                else:
                    self.fail(f"child process remained after timeout: {child_pid}")
            finally:
                with contextlib.suppress(ProcessLookupError):
                    os.kill(child_pid, signal.SIGKILL)


class FilesystemTrustTests(unittest.TestCase):
    def test_bootstrap_creates_private_state_and_lock_outside_1777_run_lock(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            root = Path(tmp)
            mkdir(root / "run" / "lock", 0o1777)
            config = make_config(root, bootstrap=False)
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with runtime.lock():
                pass
            for directory in [config.state_root, config.staging_root, config.receipt_root, config.transaction_root]:
                st = directory.lstat()
                self.assertEqual(stat.S_IMODE(st.st_mode), 0o700)
                self.assertEqual(st.st_uid, config.root_uid)
            lock_st = config.lock_path.lstat()
            self.assertEqual(stat.S_IMODE(lock_st.st_mode), 0o600)
            self.assertEqual(lock_st.st_nlink, 1)
            self.assertFalse((root / "run" / "lock" / "buddy-oci-release.lock").exists())

    def test_symlinked_trusted_ancestor_is_refused_before_resolution(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            root = Path(tmp)
            make_config(root, bootstrap=False)
            target = root / "opt" / "root-owned-target"
            mkdir(target, 0o755)
            (root / "var" / "lib" / "buddy").symlink_to(target)
            config = make_config(root, bootstrap=False)
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "symlink"):
                with runtime.lock():
                    pass


class SourceAndManifestTests(unittest.TestCase):
    def test_env_policy_allows_only_reviewed_examples_and_dependency_fixtures(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            source = Path(tmp) / "source"
            mkdir(source)
            for name in [".env.example", ".env.docker.example", ".env.local.example"]:
                write_file(source / name, "# example\n", 0o644)
            mkdir(source / "node_modules" / "pkg")
            write_file(source / "node_modules" / "pkg" / ".env", "fixture=true\n", 0o644)
            buddy.validate_source_env_policy(source)
            write_file(source / ".env.production.local", "OPENROUTER_API_KEY=secret\n", 0o600)
            with self.assertRaisesRegex(buddy.ReleaseError, "local env"):
                buddy.validate_source_env_policy(source)
            (source / ".env.production.local").unlink()
            write_file(source / ".env.other.example", "# arbitrary\n", 0o644)
            with self.assertRaisesRegex(buddy.ReleaseError, "local env"):
                buddy.validate_source_env_policy(source)

    def test_prepare_flow_uses_user_build_stage_then_root_publication_with_examples(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config = make_config(Path(tmp))
            calls: list[tuple[list[str], Path]] = []

            def fake_run_as_user(cmd, *, cwd, env, timeout):
                calls.append((list(cmd), cwd))
                if cmd[:2] == [buddy.BIN["git"], "clone"]:
                    source = Path(cmd[-1])
                    (source / ".git").mkdir(parents=True)
                    write_file(source / "package.json", "{}\n", 0o644)
                    write_file(source / "package-lock.json", '{"lockfileVersion":3}\n', 0o644)
                    for name in [".env.example", ".env.docker.example", ".env.local.example"]:
                        write_file(source / name, "# example\n", 0o644)
                    mkdir(source / "ops", 0o755)
                    write_file(source / "ops" / "recovery-probe.sh", "#!/usr/bin/env bash\n", 0o755)
                    return ""
                if cmd[:2] == [buddy.BIN["git"], "symbolic-ref"]:
                    return "refs/remotes/origin/main"
                if cmd[:2] == [buddy.BIN["git"], "rev-parse"] and cmd[-1] == "origin/main":
                    return GOOD_SHA
                if cmd[:2] == [buddy.BIN["git"], "rev-parse"]:
                    return GOOD_SHA
                if cmd[:2] == [buddy.BIN["git"], "status"]:
                    return ""
                if cmd[:2] == [buddy.BIN["git"], "ls-files"]:
                    return "\n".join(["package.json", "package-lock.json", ".env.example", ".env.docker.example", ".env.local.example", "ops/recovery-probe.sh"])
                if cmd[:2] == [buddy.BIN["npm"], "ci"]:
                    mkdir(cwd / "node_modules" / "fixture", 0o755)
                    write_file(cwd / "node_modules" / "fixture" / ".env", "fixture=true\n", 0o644)
                    return ""
                if cmd[:3] == [buddy.BIN["npm"], "run", "build"]:
                    mkdir(cwd / ".next", 0o755)
                    write_file(cwd / ".next" / "BUILD_ID", "build-1\n", 0o644)
                    return ""
                if cmd[0] == buddy.BIN["bash"]:
                    return "source=%s bind=127.0.0.1 home=200 health=503 memory=true api=false invalid_ask=400 provider_request=none\n" % GOOD_SHA
                if cmd[:2] == [buddy.BIN["node"], "--version"]:
                    return "v22.23.1"
                if cmd[:2] == [buddy.BIN["npm"], "--version"]:
                    return "10.9.0"
                return ""

            runtime = buddy.Runtime(config, euid=lambda: 0)
            pw = type("Pw", (), {"pw_uid": os.getuid(), "pw_gid": os.getgid(), "pw_dir": str(Path(tmp))})()
            with mock.patch.object(runtime, "run_as_service_user", side_effect=fake_run_as_user), \
                mock.patch.object(pwd, "getpwnam", return_value=pw), \
                mock.patch.dict(os.environ, {}, clear=True):
                result = buddy.prepare_release(GOOD_SHA, runtime)
            release = Path(result["release"])
            self.assertEqual(stat.S_IMODE(release.lstat().st_mode), 0o555)
            self.assertEqual(stat.S_IMODE((release / ".env.example").lstat().st_mode), 0o444)
            manifest = json.loads((release / "BUDDY_RELEASE_MANIFEST.json").read_text())
            self.assertEqual(manifest["build"]["build_id"], "build-1")
            self.assertIn(".env.local.example", manifest["artifact_entries"])
            self.assertIn("node_modules/fixture/.env", manifest["artifact_entries"])
            npm_cwds = [cwd for cmd, cwd in calls if cmd[:2] == [buddy.BIN["npm"], "ci"]]
            self.assertTrue(npm_cwds)
            self.assertFalse(str(npm_cwds[0]).startswith(str(config.staging_root)))

    def test_prepare_rejects_tracked_mutation_after_fake_build(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config = make_config(Path(tmp))
            status_calls = 0

            def fake_run_as_user(cmd, *, cwd, env, timeout):
                nonlocal status_calls
                if cmd[:2] == [buddy.BIN["git"], "clone"]:
                    source = Path(cmd[-1])
                    (source / ".git").mkdir(parents=True)
                    write_file(source / "package.json", "{}\n", 0o644)
                    write_file(source / "package-lock.json", '{"lockfileVersion":3}\n', 0o644)
                    for name in [".env.example", ".env.docker.example", ".env.local.example"]:
                        write_file(source / name, "# example\n", 0o644)
                    mkdir(source / "ops", 0o755)
                    write_file(source / "ops" / "recovery-probe.sh", "#!/usr/bin/env bash\n", 0o755)
                    return ""
                if cmd[:2] == [buddy.BIN["git"], "symbolic-ref"]:
                    return "refs/remotes/origin/main"
                if cmd[:2] == [buddy.BIN["git"], "rev-parse"]:
                    return GOOD_SHA
                if cmd[:2] == [buddy.BIN["git"], "status"]:
                    status_calls += 1
                    return "" if status_calls == 1 else " M package.json\n!! .next/\n!! node_modules/\n"
                if cmd[:2] == [buddy.BIN["git"], "ls-files"]:
                    return "\n".join(["package.json", "package-lock.json", ".env.example", ".env.docker.example", ".env.local.example", "ops/recovery-probe.sh"])
                if cmd[:2] == [buddy.BIN["npm"], "ci"]:
                    mkdir(cwd / "node_modules" / "fixture", 0o755)
                    return ""
                if cmd[:3] == [buddy.BIN["npm"], "run", "build"]:
                    write_file(cwd / "package.json", '{"changed":true}\n', 0o644)
                    mkdir(cwd / ".next", 0o755)
                    write_file(cwd / ".next" / "BUILD_ID", "build-1\n", 0o644)
                    return ""
                if cmd[0] == buddy.BIN["bash"]:
                    return "source=%s bind=127.0.0.1 home=200 health=503 memory=true api=false invalid_ask=400 provider_request=none\n" % GOOD_SHA
                if cmd[:2] == [buddy.BIN["node"], "--version"]:
                    return "v22.23.1"
                if cmd[:2] == [buddy.BIN["npm"], "--version"]:
                    return "10.9.0"
                return ""

            runtime = buddy.Runtime(config, euid=lambda: 0)
            pw = type("Pw", (), {"pw_uid": os.getuid(), "pw_gid": os.getgid(), "pw_dir": str(Path(tmp))})()
            with mock.patch.object(runtime, "run_as_service_user", side_effect=fake_run_as_user), \
                mock.patch.object(pwd, "getpwnam", return_value=pw), \
                mock.patch.dict(os.environ, {}, clear=True):
                with self.assertRaisesRegex(buddy.ReleaseError, "source checkout changed"):
                    buddy.prepare_release(GOOD_SHA, runtime)
            self.assertEqual(list(config.release_root.glob(GOOD_SHA)), [])

    def test_sanitized_build_env_rejects_secret_bearing_ambient_environment(self) -> None:
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-secret"}, clear=True):
            with self.assertRaisesRegex(buddy.ReleaseError, "secret-bearing"):
                buddy.sanitized_build_env("/home/ubuntu")

    def test_manifest_requires_probe_and_detects_tamper(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config = make_config(Path(tmp))
            release = make_release(config)
            buddy.validate_release_tree(release, config=config, sha=GOOD_SHA)
            os.chmod(release, 0o755)
            manifest_path = release / "BUDDY_RELEASE_MANIFEST.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["probe"] = {"completed": False, "fields": expected_probe()}
            os.chmod(manifest_path, 0o644)
            write_file(manifest_path, json.dumps(manifest) + "\n", 0o444)
            os.chmod(release, 0o555)
            with self.assertRaisesRegex(buddy.ReleaseError, "probe"):
                buddy.validate_release_tree(release, config=config, sha=GOOD_SHA)
            os.chmod(release, 0o755)
            make_tree_writable(release)
            shutil.rmtree(release)
            release = make_release(config)
            os.chmod(release / "package-lock.json", 0o644)
            write_file(release / "package-lock.json", '{"changed":true}\n', 0o444)
            with self.assertRaisesRegex(buddy.ReleaseError, "digest|entries"):
                buddy.validate_release_tree(release, config=config, sha=GOOD_SHA)

    def test_probe_parser_rejects_duplicates_unknown_and_source_mismatch(self) -> None:
        good = "source=%s bind=127.0.0.1 home=200 health=503 memory=true api=false invalid_ask=400 provider_request=none" % GOOD_SHA
        self.assertEqual(buddy.parse_probe_output(good, sha=GOOD_SHA)["source"], GOOD_SHA)
        for output in [
            good + " home=200",
            good + " surprise=yes",
            good.replace(GOOD_SHA, "archive"),
        ]:
            with self.subTest(output=output):
                with self.assertRaises(buddy.ReleaseError):
                    buddy.parse_probe_output(output, sha=GOOD_SHA)


class SystemdIdentityTests(unittest.TestCase):
    def test_actual_restart_usec_and_sanitized_environment_identity(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config = make_config(Path(tmp))
            runtime = FakeRuntime(config, shows=[service_show()])
            identity = buddy.read_service_identity(runtime)
            buddy.assert_prior_service_identity(runtime, identity)
            self.assertNotIn("ExecStart", identity)
            self.assertEqual(identity["RestartUSec"], "10s")
            self.assertEqual(identity["Environment"], buddy.EXPECTED_ENVIRONMENT)
            raw_secret_show = service_show(environment="NODE_ENV=production PATH=/home/ubuntu/.npm-global/bin:/usr/bin:/bin OPENAI_API_KEY=sk-secret")
            with self.assertRaisesRegex(buddy.ReleaseError, "unsupported secret-bearing") as ctx:
                buddy.read_service_identity(FakeRuntime(config, shows=[raw_secret_show]))
            self.assertNotIn("sk-secret", str(ctx.exception))

    def test_prior_identity_requires_configured_fragment_path(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config = make_config(Path(tmp))
            identity = buddy.read_service_identity(FakeRuntime(config, shows=[service_show(fragment_path="/tmp/other.service")]))
            with self.assertRaisesRegex(buddy.ReleaseError, "FragmentPath"):
                buddy.assert_prior_service_identity(FakeRuntime(config), identity)


class InstallRollbackTests(unittest.TestCase):
    def test_install_accepts_current_503_memory_false_baseline_and_requires_new_pid(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            runtime.shows = [
                service_show(),
                service_show(),
                service_show(),
                service_show(),
                service_show(
                    wd=str(config.release_root / GOOD_SHA),
                    pid=2222,
                    envfiles=str(config.runtime_env),
                    dropins=str(config.dropin),
                ),
            ]
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE), \
                mock.patch.object(buddy, "probe_post_install", return_value=POST_INSTALL_200):
                result = buddy.install_release(
                    GOOD_SHA,
                    expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
                    expect_dropin_sha256=buddy.sha256_file(config.dropin),
                    dry_run=False,
                    runtime=runtime,
                )
            receipt = json.loads(Path(result["receipt"]).read_text())
            self.assertEqual(receipt["phase"], "installed")
            self.assertFalse(receipt["before"]["health"]["memory"])
            self.assertEqual(receipt["after"]["systemd"]["MainPID"], 2222)
            self.assertNotIn("sk-test-secret", Path(result["receipt"]).read_text())

    def test_dry_run_leaves_no_receipt_or_transaction(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                result = buddy.install_release(
                    GOOD_SHA,
                    expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
                    expect_dropin_sha256=buddy.sha256_file(config.dropin),
                    dry_run=True,
                    runtime=runtime,
                )
            self.assertEqual(result["status"], "dry_run_complete")
            self.assertEqual(list(config.receipt_root.glob("*.json")), [])
            self.assertEqual(list(config.transaction_root.iterdir()), [])

    def test_prior_nonterminal_intent_blocks_new_install(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="intent")
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaisesRegex(buddy.ReleaseError, "prior nonterminal"):
                    buddy.install_release(
                        GOOD_SHA,
                        expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
                        expect_dropin_sha256=buddy.sha256_file(config.dropin),
                        dry_run=False,
                        runtime=runtime,
                    )
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "intent")

    def test_unknown_receipt_phase_blocks_new_install(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="intent")
            receipt = json.loads(receipt_path.read_text())
            receipt["phase"] = "mystery"
            buddy.write_receipt(config, receipt_path, receipt)
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaisesRegex(buddy.ReleaseError, "unknown phase"):
                    buddy.install_release(
                        GOOD_SHA,
                        expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
                        expect_dropin_sha256=buddy.sha256_file(config.dropin),
                        dry_run=False,
                        runtime=runtime,
                    )

    def test_effective_identity_drift_before_mutation_does_not_stop_service(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            runtime.shows = [service_show(), service_show(user="other")]
            original_runtime = config.runtime_env.read_text()
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaises(buddy.ReleaseError):
                    buddy.install_release(
                        GOOD_SHA,
                        expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
                        expect_dropin_sha256=buddy.sha256_file(config.dropin),
                        dry_run=False,
                        runtime=runtime,
                    )
            self.assertEqual(config.runtime_env.read_text(), original_runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))

    def test_disk_only_rollback_after_runtime_env_write_restores_before_files(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [service_show(), inactive_show(), service_show(pid=1300)]
            with mock.patch.object(buddy, "probe_rollback_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                result = buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertEqual(result["status"], "rolled_back")
            self.assertEqual(config.runtime_env.read_text(), "OPENROUTER_API_KEY=old\n")
            self.assertEqual(config.dropin.read_text(), "[Service]\nWorkingDirectory=/old\n")

    def test_disk_only_rollback_after_dropin_write_restores_before_files(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="dropin_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            write_file(config.dropin, "[Service]\nWorkingDirectory=/new\n", 0o644)
            runtime.shows = [
                service_show(wd=str(config.release_root / GOOD_SHA)),
                inactive_show(wd=str(config.release_root / GOOD_SHA)),
                service_show(pid=1301),
            ]
            with mock.patch.object(buddy, "probe_rollback_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                result = buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertEqual(result["status"], "rolled_back")
            self.assertEqual(config.runtime_env.read_text(), "OPENROUTER_API_KEY=old\n")
            self.assertEqual(config.dropin.read_text(), "[Service]\nWorkingDirectory=/old\n")

    def test_corrupt_beforeimage_fails_before_stop_and_marks_rollback_failed(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            tx_id = receipt_path.name.removesuffix(".json")
            write_file(config.transaction_root / tx_id / "runtime.env.before", "corrupt\n", 0o600)
            with self.assertRaisesRegex(buddy.ReleaseError, "beforeimage bytes"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "rollback_failed")

    def test_corrupt_beforeimage_metadata_fails_before_stop(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            receipt = json.loads(receipt_path.read_text())
            receipt["before"]["runtime_env"]["mode"] = "0o777"
            buddy.write_receipt(config, receipt_path, receipt)
            with self.assertRaisesRegex(buddy.ReleaseError, "mode"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "rollback_failed")

    def test_unknown_peer_file_change_is_preserved_before_stop(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=peer\n", 0o600)
            with self.assertRaisesRegex(buddy.ReleaseError, "outside this transaction"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertEqual(config.runtime_env.read_text(), "OPENROUTER_API_KEY=peer\n")
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))

    def test_rollback_readback_mismatch_fails_after_restore_attempt(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [service_show(), inactive_show(), inactive_show()]
            real_restore = buddy.restore_file

            def corrupt_runtime_restore(config_arg, path, image):
                real_restore(config_arg, path, image)
                if path == config.runtime_env:
                    write_file(path, "corrupt\n", 0o600)

            with mock.patch.object(buddy, "restore_file", side_effect=corrupt_runtime_restore):
                with self.assertRaisesRegex(buddy.ReleaseError, "readback mismatch"):
                    buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            receipt = json.loads(receipt_path.read_text())
            self.assertEqual(receipt["phase"], "rollback_failed")
            self.assertEqual(receipt["rollback_fail_closed"]["final_state"]["ActiveState"], "inactive")

    def test_rollback_requires_positive_pid_after_start(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [service_show(), inactive_show(), service_show(pid=0), inactive_show()]
            with self.assertRaisesRegex(buddy.ReleaseError, "MainPID"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            receipt = json.loads(receipt_path.read_text())
            self.assertEqual(receipt["phase"], "rollback_failed")
            self.assertEqual(receipt["rollback_fail_closed"]["final_state"]["MainPID"], 0)

    def test_rollback_wrong_started_identity_stops_and_records_final_state(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [
                service_show(),
                inactive_show(),
                service_show(wd="/wrong", pid=1302),
                inactive_show(),
            ]
            with self.assertRaisesRegex(buddy.ReleaseError, "WorkingDirectory"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            receipt = json.loads(receipt_path.read_text())
            self.assertEqual(receipt["phase"], "rollback_failed")
            self.assertEqual(receipt["rollback_fail_closed"]["stop_error"], None)
            self.assertEqual(receipt["rollback_fail_closed"]["final_state"]["ActiveState"], "inactive")

    def test_rollback_fail_closed_stop_failure_is_recorded(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            config, runtime = write_install_fixture(Path(tmp))
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.stop_failures = [False, True]
            runtime.shows = [
                service_show(),
                inactive_show(),
                service_show(wd="/wrong", pid=1303),
                service_show(wd="/wrong", pid=1303),
            ]
            with self.assertRaisesRegex(buddy.ReleaseError, "WorkingDirectory"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            receipt = json.loads(receipt_path.read_text())
            self.assertEqual(receipt["phase"], "rollback_failed")
            self.assertEqual(receipt["rollback_fail_closed"]["stop_error"]["type"], "ReleaseError")
            self.assertEqual(receipt["rollback_fail_closed"]["final_state"]["MainPID"], 1303)


if __name__ == "__main__":
    unittest.main()
