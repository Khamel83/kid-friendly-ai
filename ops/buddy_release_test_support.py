import contextlib
import importlib.util
import json
import os
import pwd
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).with_name("buddy_oci_release.py")
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("buddy_oci_release", MODULE_PATH)
buddy = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = buddy
SPEC.loader.exec_module(buddy)
primitives = sys.modules["buddy_release_primitives"]

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
    wd="/old",
    pid=1204,
    active="active",
    substate="running",
    envfiles="",
    dropins="",
    user="ubuntu",
    restart_usec="10s",
    environment="NODE_ENV=production PATH=/home/ubuntu/.npm-global/bin:/usr/bin:/bin",
    fragment_path="/etc/systemd/system/buddy.service",
):
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

def environment_file(path, *, ignore_errors=False):
    return f"{path} (ignore_errors={'yes' if ignore_errors else 'no'})"

def inactive_show(wd="/old"):
    return service_show(wd=wd, pid=0, active="inactive", substate="dead")

def installed_show(config, *, pid=2222):
    return service_show(
        wd=str(config.release_root / GOOD_SHA),
        pid=pid,
        envfiles=environment_file(config.runtime_env),
        dropins=str(config.dropin),
    )

def mkdir(path, mode=0o755):
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(mode)

def write_file(path, data, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data)
    else:
        path.write_bytes(data)
    path.chmod(mode)

@contextlib.contextmanager
def temp_path():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        yield Path(tmp)

@contextlib.contextmanager
def prepare_patches(runtime, fake_run_as_user, home, *extra_patches):
    pw = type("Pw", (), {"pw_uid": os.getuid(), "pw_gid": os.getgid(), "pw_dir": str(home)})()
    with contextlib.ExitStack() as stack:
        stack.enter_context(mock.patch.object(runtime, "run_as_service_user", side_effect=fake_run_as_user))
        stack.enter_context(mock.patch.object(pwd, "getpwnam", return_value=pw))
        stack.enter_context(mock.patch.dict(os.environ, {}, clear=True))
        for patch in extra_patches:
            stack.enter_context(patch)
        yield

def copied_ok():
    return mock.patch.object(primitives, "validate_copied_release_against_git_tree", return_value=GOOD_SHA)

def make_config(root, *, bootstrap=True):
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

def expected_probe():
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

def make_release(config, *, manifest_overrides=None):
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
        root_verified_sha=GOOD_SHA,
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

def make_tree_writable(root):
    for path in sorted(root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if not path.is_symlink():
            path.chmod(0o755 if path.is_dir() else 0o644)
    root.chmod(0o755)

def git(repo, *args):
    proc = subprocess.run(
        [buddy.BIN["git"], *args],
        cwd=repo,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed: {proc.stderr}")
    return proc.stdout.strip()

def make_git_source(root, *, executable=True, symlink=False):
    repo = root / "repo"
    mkdir(repo, 0o755)
    git(repo, "init")
    git(repo, "config", "user.name", "Test User")
    git(repo, "config", "user.email", "test@example.invalid")
    write_file(repo / "package.json", "{}\n", 0o644)
    write_file(repo / "package-lock.json", '{"lockfileVersion":3}\n', 0o644)
    mkdir(repo / "ops", 0o755)
    write_file(repo / "ops" / "recovery-probe.sh", "#!/usr/bin/env bash\n", 0o755 if executable else 0o644)
    for name in [".env.example", ".env.docker.example", ".env.local.example"]:
        write_file(repo / name, "# example\n", 0o644)
    if symlink:
        (repo / "package-link.json").symlink_to("package.json")
    git(repo, "add", ".")
    git(repo, "commit", "-m", "initial")
    return repo, git(repo, "rev-parse", "HEAD")

def loose_object_path(repo, object_id):
    return repo / ".git" / "objects" / object_id[:2] / object_id[2:]

PREPARE_TRACKED_FILES = [
    "package.json",
    "package-lock.json",
    ".env.example",
    ".env.docker.example",
    ".env.local.example",
    "ops/recovery-probe.sh",
]

def write_prepare_source_tree(source):
    (source / ".git").mkdir(parents=True)
    write_file(source / "package.json", "{}\n", 0o644)
    write_file(source / "package-lock.json", '{"lockfileVersion":3}\n', 0o644)
    for name in [".env.example", ".env.docker.example", ".env.local.example"]:
        write_file(source / name, "# example\n", 0o644)
    mkdir(source / "ops", 0o755)
    write_file(source / "ops" / "recovery-probe.sh", "#!/usr/bin/env bash\n", 0o755)

class PrepareRunAsUser:
    def __init__(
        self,
        *,
        sha=GOOD_SHA,
        source_repo=None,
        status_outputs=None,
        record_calls=None,
        npm_ci=None,
        build=None,
    ):
        self.sha = sha
        self.source_repo = source_repo
        self.status_outputs = list(status_outputs or [])
        self.record_calls = record_calls
        self.npm_ci = npm_ci
        self.build = build

    def __call__(self, cmd, *, cwd, env, timeout):
        if self.record_calls is not None:
            self.record_calls.append((list(cmd), cwd))
        if cmd[:2] == [buddy.BIN["git"], "clone"]:
            source = Path(cmd[-1])
            if self.source_repo is None:
                write_prepare_source_tree(source)
            else:
                shutil.copytree(self.source_repo, source, symlinks=True)
            return ""
        if cmd[:2] == [buddy.BIN["git"], "symbolic-ref"]:
            return "refs/remotes/origin/main"
        if cmd[:2] == [buddy.BIN["git"], "rev-parse"]:
            return self.sha
        if cmd[:2] == [buddy.BIN["git"], "status"]:
            return self.status_outputs.pop(0) if self.status_outputs else ""
        if cmd[:2] == [buddy.BIN["git"], "ls-files"]:
            return "\n".join(PREPARE_TRACKED_FILES)
        if cmd[:2] == [buddy.BIN["npm"], "ci"]:
            if self.npm_ci is not None:
                self.npm_ci(cwd)
            return ""
        if cmd[:3] == [buddy.BIN["npm"], "run", "build"]:
            if self.build is None:
                mkdir(cwd / ".next", 0o755)
                write_file(cwd / ".next" / "BUILD_ID", "build-1\n", 0o644)
            else:
                self.build(cwd)
            return ""
        if cmd[0] == buddy.BIN["bash"]:
            return "source=%s bind=127.0.0.1 home=200 health=503 memory=true api=false invalid_ask=400 provider_request=none\n" % self.sha
        if cmd[:2] == [buddy.BIN["node"], "--version"]:
            return "v22.23.1"
        if cmd[:2] == [buddy.BIN["npm"], "--version"]:
            return "10.9.0"
        return ""

class FakeRuntime(buddy.Runtime):
    def __init__(
        self,
        config,
        *,
        shows=None,
        fail_stop=False,
        stop_failures=None,
    ):
        super().__init__(config, euid=lambda: 0)
        self.shows = list(shows or [service_show()])
        self.calls = []
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

def write_install_fixture(root, *, unit_mode=0o644):
    config = make_config(root)
    make_release(config)
    write_file(config.source_env, "OPENROUTER_API_KEY=sk-test-secret\n", 0o600)
    write_file(config.runtime_env, "OPENROUTER_API_KEY=old\n", 0o600)
    write_file(config.dropin, "[Service]\nWorkingDirectory=/old\n", 0o644)
    write_file(config.unit, "[Service]\nExecStart=/usr/bin/npm start\n", unit_mode)
    return config, FakeRuntime(config)

def install_current(config, runtime: FakeRuntime, *, dry_run=False):
    return buddy.install_release(
        GOOD_SHA,
        expect_runtime_env_sha256=buddy.sha256_file(config.runtime_env),
        expect_dropin_sha256=buddy.sha256_file(config.dropin),
        dry_run=dry_run,
        runtime=runtime,
    )

def create_interrupted_receipt(
    config,
    *,
    phase,
    planned_runtime= b"OPENROUTER_API_KEY=new\n",
    planned_dropin= b"[Service]\nWorkingDirectory=/new\n",
    before_uid_delta= 0,
):
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
