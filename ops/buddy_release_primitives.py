"""Bounded Buddy OCI release helper.

This helper is Buddy-specific. It prepares one reviewed GitHub SHA as a
root-owned release tree and installs that tree into the existing OCI
``buddy.service`` by changing only the service WorkingDirectory and required
EnvironmentFile drop-in.
"""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import datetime as dt
import errno
import fcntl
import hashlib
import json
import os
import pwd
import re
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Callable, Iterator, Mapping, Sequence

SERVICE_NAME = "buddy.service"
REPO_URL = "git@github.com:Khamel83/kid-friendly-ai.git"
SERVICE_USER = "ubuntu"
SERVICE_UID = 1001
SERVICE_GID = 1001

RELEASE_ROOT = Path("/opt/buddy/releases")
STATE_ROOT = Path("/var/lib/buddy/release-state")
STAGING_ROOT = Path("/var/lib/buddy/release-staging")
RECEIPT_ROOT = Path("/var/lib/buddy/release-receipts")
TRANSACTION_ROOT = RECEIPT_ROOT / "transactions"
LOCK_PATH = STATE_ROOT / "lock"
SOURCE_ENV = Path("/home/ubuntu/github/kid-friendly-ai/.env.local")
RUNTIME_ENV = Path("/etc/buddy/runtime.env")
DROPIN = Path("/etc/systemd/system/buddy.service.d/10-release.conf")
UNIT = Path("/etc/systemd/system/buddy.service")
OLD_WORKING_DIRECTORY = "/home/ubuntu/github/kid-friendly-ai"
LOOPBACK_BASE_URL = "http://127.0.0.1:3000"
KEYLESS_PROBE_PORT = "43117"
EXPECTED_EXEC_PATH = "/usr/bin/npm"
EXPECTED_EXEC_ARGV = ("/usr/bin/npm", "start")
EXPECTED_ENVIRONMENT = {
    "NODE_ENV": "production",
    "PATH": "/home/ubuntu/.npm-global/bin:/usr/bin:/bin",
}

BIN = {
    "bash": "/usr/bin/bash",
    "git": "/usr/bin/git",
    "node": "/usr/bin/node",
    "npm": "/usr/bin/npm",
    "sudo": "/usr/bin/sudo",
    "systemctl": "/usr/bin/systemctl",
}

TIMEOUTS = {
    "git": 180,
    "npm_ci": 300,
    "build": 300,
    "probe": 120,
    "systemctl": 30,
    "health": 90,
}

SOURCE_ENV_KEYS = {
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
    "VERCEL_OIDC_TOKEN",
}
RUNTIME_ENV_KEYS = ("OPENROUTER_API_KEY", "OPENAI_API_KEY", "ELEVENLABS_API_KEY")
SOURCE_ENV_EXAMPLE_PATHS = {".env.example", ".env.docker.example", ".env.local.example"}
SENSITIVE_NAME_TERMS = ("API_KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")
SENSITIVE_NAME_RE = re.compile("(" + "|".join(SENSITIVE_NAME_TERMS) + ")", re.I)
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
TX_ID_RE = re.compile(r"^\d{8}T\d{6}Z\.[0-9a-f]{40}\.[0-9a-f]{32}$")
SAFE_VALUE_RE = re.compile(r"^[A-Za-z0-9_./:@%+=,-]+$")
MAX_ENV_BYTES = 64 * 1024
MAX_HTTP_BODY = 256 * 1024
NONTERMINAL_PHASES = {
    "intent",
    "runtime_env_written",
    "dropin_written",
    "prepared",
}
TERMINAL_PHASES = {
    "installed",
    "rolled_back",
    "rollback_failed",
    "dry_run_complete",
}
PROBE_FIELDS = {"source", "bind", "home", "health", "memory", "api", "invalid_ask", "provider_request"}


class ReleaseError(RuntimeError):
    """A fail-closed release error with no secret material."""


@dataclasses.dataclass(frozen=True)
class ReleaseConfig:
    repo_url: str = REPO_URL
    service_user: str = SERVICE_USER
    service_uid: int = SERVICE_UID
    service_gid: int = SERVICE_GID
    root_uid: int = 0
    root_gid: int = 0
    release_root: Path = RELEASE_ROOT
    state_root: Path = STATE_ROOT
    staging_root: Path = STAGING_ROOT
    receipt_root: Path = RECEIPT_ROOT
    transaction_root: Path = TRANSACTION_ROOT
    lock_path: Path = LOCK_PATH
    source_env: Path = SOURCE_ENV
    runtime_env: Path = RUNTIME_ENV
    dropin: Path = DROPIN
    unit: Path = UNIT
    old_working_directory: str = OLD_WORKING_DIRECTORY
    base_url: str = LOOPBACK_BASE_URL
    probe_port: str = KEYLESS_PROBE_PORT
    trust_anchor: Path = Path("/")


@dataclasses.dataclass(frozen=True)
class FileImage:
    exists: bool
    sha256: str | None
    mode: int | None
    uid: int | None
    gid: int | None
    size: int | None
    link_count: int | None
    data: bytes | None = dataclasses.field(default=None, repr=False)

    @classmethod
    def absent(cls) -> "FileImage":
        return cls(False, None, None, None, None, None, None)

    @classmethod
    def capture(cls, path: Path, *, include_data: bool = False) -> "FileImage":
        try:
            st = path.lstat()
        except FileNotFoundError:
            return cls.absent()
        if stat.S_ISLNK(st.st_mode):
            raise ReleaseError(f"refusing symlink beforeimage: {path}")
        if not stat.S_ISREG(st.st_mode):
            raise ReleaseError(f"refusing non-regular beforeimage: {path}")
        data = path.read_bytes()
        return cls(
            True,
            hashlib.sha256(data).hexdigest(),
            stat.S_IMODE(st.st_mode),
            st.st_uid,
            st.st_gid,
            st.st_size,
            st.st_nlink,
            data if include_data else None,
        )

    def public(self) -> dict[str, object]:
        return {
            "exists": self.exists,
            "sha256": self.sha256,
            "mode": oct(self.mode) if self.mode is not None else None,
            "uid": self.uid,
            "gid": self.gid,
            "size": self.size,
            "link_count": self.link_count,
        }


class Runtime:
    def __init__(
        self,
        config: ReleaseConfig = ReleaseConfig(),
        *,
        runner: Callable[..., subprocess.CompletedProcess[str]] | None = None,
        euid: Callable[[], int] = os.geteuid,
    ) -> None:
        self.config = config
        self._runner = runner
        self._euid = euid

    def require_root(self) -> None:
        if self._euid() != 0:
            raise ReleaseError("must run as root before changing Buddy release state")

    def run(
        self,
        cmd: Sequence[str],
        *,
        cwd: Path | None = None,
        env: Mapping[str, str] | None = None,
        timeout: int,
    ) -> str:
        if self._runner is None:
            return self._run_subprocess(cmd, cwd=cwd, env=env, timeout=timeout)
        try:
            proc = self._runner(
                list(cmd),
                cwd=str(cwd) if cwd else None,
                env=dict(env) if env is not None else None,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise ReleaseError(f"command timed out after {timeout}s: {safe_command(cmd)}") from exc
        if proc.returncode != 0:
            raise ReleaseError(f"command failed ({proc.returncode}): {safe_command(cmd)}")
        return (proc.stdout or "").strip()

    def _run_subprocess(
        self,
        cmd: Sequence[str],
        *,
        cwd: Path | None,
        env: Mapping[str, str] | None,
        timeout: int,
    ) -> str:
        proc = subprocess.Popen(
            list(cmd),
            cwd=str(cwd) if cwd else None,
            env=dict(env) if env is not None else None,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        try:
            stdout, _stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate()
            raise ReleaseError(f"command timed out after {timeout}s: {safe_command(cmd)}") from exc
        if proc.returncode != 0:
            raise ReleaseError(f"command failed ({proc.returncode}): {safe_command(cmd)}")
        return (stdout or "").strip()

    def run_as_service_user(self, cmd: Sequence[str], *, cwd: Path, env: Mapping[str, str], timeout: int) -> str:
        full_cmd = [
            BIN["sudo"],
            "-n",
            "-H",
            "-u",
            self.config.service_user,
            "env",
            "-i",
            *env_assignments(env),
            *cmd,
        ]
        return self.run(full_cmd, cwd=cwd, timeout=timeout)

    def systemctl(self, args: Sequence[str], *, service: str | None = None, timeout: int = TIMEOUTS["systemctl"]) -> str:
        if service is not None and service != SERVICE_NAME:
            raise ReleaseError(f"refusing to operate on service {service}; expected {SERVICE_NAME}")
        cmd = [BIN["systemctl"], *args]
        if service is not None:
            cmd.append(service)
        return self.run(cmd, timeout=timeout)

    @contextlib.contextmanager
    def lock(self) -> Iterator[None]:
        bootstrap_release_roots(self.config)
        assert_trusted_parent_for_create(
            self.config.lock_path,
            uid=self.config.root_uid,
            trust_anchor=self.config.trust_anchor,
            exact_parent_mode=0o700,
        )
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
        fd = os.open(self.config.lock_path, flags, 0o600)
        try:
            st = os.fstat(fd)
            if (
                not stat.S_ISREG(st.st_mode)
                or st.st_uid != self.config.root_uid
                or stat.S_IMODE(st.st_mode) != 0o600
                or st.st_nlink != 1
            ):
                raise ReleaseError("release lock has unsafe ownership or mode")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise ReleaseError("release lock is busy") from exc
            os.ftruncate(fd, 0)
            os.write(fd, f"{os.getpid()}\n".encode())
            os.fsync(fd)
            yield
        finally:
            try:
                fcntl.flock(fd, fcntl.LOCK_UN)
            finally:
                os.close(fd)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def safe_command(cmd: Sequence[str]) -> str:
    safe_parts: list[str] = []
    for part in cmd:
        if "=" in part and SENSITIVE_NAME_RE.search(part.split("=", 1)[0]):
            key = part.split("=", 1)[0]
            safe_parts.append(f"{key}=<redacted>")
        else:
            safe_parts.append(Path(part).name if part.startswith("/") else part)
    return " ".join(safe_parts)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def env_assignments(env: Mapping[str, str]) -> list[str]:
    return [f"{key}={value}" for key, value in sorted(env.items())]


def validate_sha(value: str) -> str:
    if not SHA_RE.fullmatch(value):
        raise ReleaseError("release SHA must be a lowercase 40-character Git SHA")
    return value


def sanitized_build_env(user_home: str) -> dict[str, str]:
    leaked = sorted(k for k in os.environ if SENSITIVE_NAME_RE.search(k))
    if leaked:
        raise ReleaseError("refusing ambient secret-bearing build environment keys")
    return {
        "HOME": user_home,
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "npm_config_audit": "false",
        "npm_config_fund": "false",
    }


def absolute_lexical(path: Path) -> Path:
    if not path.is_absolute():
        raise ReleaseError(f"path must be absolute: {path}")
    if ".." in path.parts:
        raise ReleaseError(f"path must not contain parent traversal: {path}")
    return Path(os.path.abspath(os.fspath(path)))


def assert_trusted_dir(path: Path, *, uid: int, label: str = "directory", exact_mode: int | None = None) -> None:
    try:
        st = path.lstat()
    except FileNotFoundError as exc:
        raise ReleaseError(f"{label} is missing: {path}") from exc
    if stat.S_ISLNK(st.st_mode):
        raise ReleaseError(f"{label} is a symlink: {path}")
    if not stat.S_ISDIR(st.st_mode):
        raise ReleaseError(f"{label} is not a directory: {path}")
    if st.st_uid != uid:
        raise ReleaseError(f"{label} uid is {st.st_uid}, expected {uid}: {path}")
    actual_mode = stat.S_IMODE(st.st_mode)
    if exact_mode is not None and actual_mode != exact_mode:
        raise ReleaseError(f"{label} mode is {oct(actual_mode)}, expected {oct(exact_mode)}: {path}")
    if actual_mode & 0o022:
        raise ReleaseError(f"{label} is group/world writable: {path}")


def path_chain(anchor: Path, target: Path) -> list[Path]:
    anchor = absolute_lexical(anchor)
    target_abs = absolute_lexical(target)
    try:
        common = os.path.commonpath([str(anchor), str(target_abs)])
    except ValueError as exc:
        raise ReleaseError(f"path {target} is outside trust anchor {anchor}") from exc
    if common != str(anchor):
        raise ReleaseError(f"path {target} is outside trust anchor {anchor}")
    chain = [anchor]
    relative = target_abs.relative_to(anchor)
    current = anchor
    for part in relative.parts:
        current = current / part
        chain.append(current)
    return chain


def assert_trusted_hierarchy(path: Path, *, uid: int, trust_anchor: Path) -> None:
    for entry in path_chain(trust_anchor, path):
        assert_trusted_dir(entry, uid=uid, label="trusted hierarchy")


def assert_trusted_parent_for_create(path: Path, *, uid: int, trust_anchor: Path, exact_parent_mode: int | None = None) -> None:
    assert_trusted_hierarchy(path.parent, uid=uid, trust_anchor=trust_anchor)
    if exact_parent_mode is not None:
        assert_trusted_dir(path.parent, uid=uid, label="trusted parent", exact_mode=exact_parent_mode)
    if path.exists() or path.is_symlink():
        st = path.lstat()
        if stat.S_ISLNK(st.st_mode):
            raise ReleaseError(f"target is a symlink: {path}")


def ensure_trusted_dir(path: Path, *, mode: int, uid: int, gid: int, trust_anchor: Path, exact_mode: bool = False) -> None:
    if path.exists() or path.is_symlink():
        assert_trusted_dir(path, uid=uid, label="trusted directory", exact_mode=mode if exact_mode else None)
        return
    assert_trusted_hierarchy(path.parent, uid=uid, trust_anchor=trust_anchor)
    path.mkdir(mode=mode)
    os.chmod(path, mode)
    try:
        os.chown(path, uid, gid)
    except PermissionError:
        if os.geteuid() == 0:
            raise
    fsync_dir(path.parent)
    assert_trusted_dir(path, uid=uid, label="trusted directory", exact_mode=mode if exact_mode else None)


def bootstrap_release_roots(config: ReleaseConfig) -> None:
    """Create only the fixed Buddy-owned roots from already trusted system parents."""
    for base in (
        config.trust_anchor,
        config.trust_anchor / "var",
        config.trust_anchor / "var" / "lib",
        config.trust_anchor / "opt",
        config.trust_anchor / "etc",
        config.trust_anchor / "etc" / "systemd",
        config.trust_anchor / "etc" / "systemd" / "system",
    ):
        if base.exists() or base.is_symlink():
            assert_trusted_dir(base, uid=config.root_uid, label="bootstrap parent")
    for directory in (
        config.state_root.parent,
        config.state_root,
        config.staging_root,
        config.receipt_root,
        config.transaction_root,
    ):
        ensure_trusted_dir(
            directory,
            mode=0o700,
            uid=config.root_uid,
            gid=config.root_gid,
            trust_anchor=config.trust_anchor,
            exact_mode=True,
        )
    for directory in (
        config.release_root.parent,
        config.release_root,
        config.runtime_env.parent,
        config.dropin.parent,
    ):
        ensure_trusted_dir(
            directory,
            mode=0o755,
            uid=config.root_uid,
            gid=config.root_gid,
            trust_anchor=config.trust_anchor,
        )


def assert_regular_file(path: Path, *, uid: int, mode: int | None, label: str, single_link: bool = False) -> None:
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode):
        raise ReleaseError(f"{label} is a symlink: {path}")
    if not stat.S_ISREG(st.st_mode):
        raise ReleaseError(f"{label} is not a regular file: {path}")
    if st.st_uid != uid:
        raise ReleaseError(f"{label} uid is {st.st_uid}, expected {uid}: {path}")
    actual_mode = stat.S_IMODE(st.st_mode)
    if mode is not None and actual_mode != mode:
        raise ReleaseError(f"{label} mode is {oct(actual_mode)}, expected {oct(mode)}: {path}")
    if actual_mode & 0o022:
        raise ReleaseError(f"{label} is group/world writable: {path}")
    if single_link and st.st_nlink != 1:
        raise ReleaseError(f"{label} must be single-link: {path}")


def read_private_source_env(path: Path, *, uid: int) -> tuple[dict[str, str], FileImage]:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
    except FileNotFoundError as exc:
        raise ReleaseError("missing source env file") from exc
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            raise ReleaseError("source env file is a symlink") from exc
        raise
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise ReleaseError("source env file is not regular")
        if st.st_uid != uid or stat.S_IMODE(st.st_mode) != 0o600 or st.st_nlink != 1:
            raise ReleaseError("source env file must be single-link exact-owner mode 0600")
        if st.st_size > MAX_ENV_BYTES:
            raise ReleaseError("source env file is too large")
        raw = os.read(fd, MAX_ENV_BYTES + 1)
        if len(raw) > MAX_ENV_BYTES:
            raise ReleaseError("source env file is too large")
        image = FileImage(True, sha256_bytes(raw), stat.S_IMODE(st.st_mode), st.st_uid, st.st_gid, st.st_size, st.st_nlink)
    finally:
        os.close(fd)
    return parse_env_bytes(raw), image


def parse_env_bytes(raw: bytes, *, allowed_keys: set[str] = SOURCE_ENV_KEYS) -> dict[str, str]:
    if b"\x00" in raw:
        raise ReleaseError("env file contains NUL bytes")
    try:
        lines = raw.decode("utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ReleaseError("env file must be UTF-8") from exc
    values: dict[str, str] = {}
    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if line.endswith("\\"):
            raise ReleaseError(f"line {lineno}: multiline continuations are forbidden")
        if stripped.startswith("export "):
            raise ReleaseError(f"line {lineno}: shell export syntax is forbidden")
        match = re.fullmatch(r"([A-Z0-9_]+)=(.*)", line)
        if not match:
            raise ReleaseError(f"line {lineno}: expected KEY=value")
        key, raw_value = match.groups()
        if key not in allowed_keys:
            raise ReleaseError(f"line {lineno}: unknown key {key}")
        if key in values:
            raise ReleaseError(f"line {lineno}: duplicate key {key}")
        if any(token in raw_value for token in ("`", "$(", "${", ";", "&&", "||", "<", ">")):
            raise ReleaseError(f"line {lineno}: shell syntax is forbidden")
        if len(raw_value) >= 2 and raw_value[0] == raw_value[-1] and raw_value[0] in {"'", '"'}:
            value = raw_value[1:-1]
            if "\n" in value or "\r" in value or "\\" in value:
                raise ReleaseError(f"line {lineno}: escaped or multiline quoted values are forbidden")
        else:
            if raw_value != raw_value.strip() or any(ch.isspace() for ch in raw_value):
                raise ReleaseError(f"line {lineno}: unquoted whitespace is forbidden")
            if "#" in raw_value or '"' in raw_value or "'" in raw_value:
                raise ReleaseError(f"line {lineno}: ambiguous unquoted value is forbidden")
            value = raw_value
        if value == "":
            raise ReleaseError(f"line {lineno}: empty values are forbidden")
        values[key] = value
    return values


def parse_env_file(path: Path, *, allowed_keys: set[str] = SOURCE_ENV_KEYS) -> dict[str, str]:
    raw = path.read_bytes()
    if len(raw) > MAX_ENV_BYTES:
        raise ReleaseError("env file is too large")
    return parse_env_bytes(raw, allowed_keys=allowed_keys)


def projected_runtime_env(values: Mapping[str, str]) -> dict[str, str]:
    projected = {key: values[key] for key in RUNTIME_ENV_KEYS if key in values}
    if not (projected.get("OPENROUTER_API_KEY") or projected.get("OPENAI_API_KEY")):
        raise ReleaseError("runtime env must include OPENROUTER_API_KEY or OPENAI_API_KEY")
    for key, value in projected.items():
        if not SAFE_VALUE_RE.fullmatch(value):
            raise ReleaseError(f"{key} contains unsupported characters")
    return projected


def render_runtime_env(values: Mapping[str, str]) -> bytes:
    return "".join(f"{key}={values[key]}\n" for key in RUNTIME_ENV_KEYS if key in values).encode()


def assert_expected_beforeimage(path: Path, expected: str) -> FileImage:
    image = FileImage.capture(path, include_data=True)
    if expected == "absent":
        if image.exists:
            raise ReleaseError("beforeimage expected absent but file exists")
    elif re.fullmatch(r"[0-9a-f]{64}", expected):
        if not image.exists or image.sha256 != expected:
            raise ReleaseError("beforeimage digest mismatch")
    else:
        raise ReleaseError("beforeimage expectation must be 'absent' or a sha256 hex digest")
    return image


def atomic_write_config(config: ReleaseConfig, path: Path, data: bytes, *, mode: int) -> None:
    assert_trusted_parent_for_create(path, uid=config.root_uid, trust_anchor=config.trust_anchor)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, mode)
        try:
            os.chown(tmp, config.root_uid, config.root_gid)
        except PermissionError:
            if os.geteuid() == 0:
                raise
        os.replace(tmp, path)
        fsync_dir(path.parent)
    except Exception:
        with contextlib.suppress(FileNotFoundError):
            tmp.unlink()
        raise


def atomic_write(path: Path, data: bytes, *, mode: int = 0o600, uid: int | None = 0, gid: int | None = 0) -> None:
    config = ReleaseConfig(root_uid=uid if uid is not None else os.getuid(), trust_anchor=Path("/"))
    atomic_write_config(config, path, data, mode=mode)


def fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def fsync_tree(root: Path) -> None:
    for path in sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_symlink():
            continue
        if path.is_file():
            fd = os.open(path, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        elif path.is_dir():
            fsync_dir(path)
    fsync_dir(root)


def restore_file(config: ReleaseConfig, path: Path, image: FileImage) -> None:
    if image.exists:
        if image.data is None:
            raise ReleaseError("cannot restore file without private beforeimage bytes")
        atomic_write_config(config, path, image.data, mode=image.mode or 0o600)
    else:
        if path.exists() or path.is_symlink():
            path.unlink()
            fsync_dir(path.parent)


def env_path_allowed_in_artifact(rel: str) -> bool:
    path = Path(rel)
    if rel in SOURCE_ENV_EXAMPLE_PATHS:
        return True
    if path.parts and path.parts[0] == "node_modules":
        return True
    return not path.name.startswith(".env")


def tree_entries(root: Path, *, uid: int, include_manifest: bool = False) -> dict[str, dict[str, object]]:
    entries: dict[str, dict[str, object]] = {}
    base = root.resolve()
    for path in sorted(root.rglob("*"), key=lambda p: p.relative_to(root).as_posix()):
        rel = path.relative_to(root).as_posix()
        if rel == "BUDDY_RELEASE_MANIFEST.json" and not include_manifest:
            continue
        if not env_path_allowed_in_artifact(rel):
            raise ReleaseError(f"release contains forbidden env file: {rel}")
        st = path.lstat()
        mode = stat.S_IMODE(st.st_mode)
        if stat.S_ISLNK(st.st_mode):
            target = os.readlink(path)
            resolved = path.resolve()
            if os.path.commonpath([str(base), str(resolved)]) != str(base):
                raise ReleaseError(f"release symlink escapes release root: {rel}")
            entries[rel] = {"type": "symlink", "mode": oct(mode), "target": target}
        elif stat.S_ISDIR(st.st_mode):
            if st.st_uid != uid or mode != 0o555:
                raise ReleaseError(f"release directory is not root-owned read-only: {rel}")
            entries[rel] = {"type": "dir", "mode": oct(mode)}
        elif stat.S_ISREG(st.st_mode):
            executable = bool(mode & 0o111)
            expected_mode = 0o555 if executable else 0o444
            if st.st_uid != uid or mode != expected_mode:
                raise ReleaseError(f"release file is not root-owned read-only: {rel}")
            entries[rel] = {"type": "file", "mode": oct(mode), "sha256": sha256_file(path), "size": st.st_size}
        else:
            raise ReleaseError(f"release contains unsupported file type: {rel}")
    return entries


def artifact_digest(entries: Mapping[str, Mapping[str, object]]) -> str:
    raw = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    return sha256_bytes(raw)


def require_mapping(value: object, label: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ReleaseError(f"{label} is missing or invalid")
    return value


def validate_probe_fields(fields: Mapping[str, object], *, sha: str, keyless: bool = True) -> dict[str, str]:
    if set(fields) != PROBE_FIELDS:
        raise ReleaseError("keyless recovery probe fields are incomplete or unexpected")
    values = {str(key): str(value) for key, value in fields.items()}
    expected = {
        "source": sha,
        "bind": "127.0.0.1",
        "home": "200",
        "health": "503" if keyless else "200",
        "memory": "true",
        "api": "false" if keyless else "true",
        "invalid_ask": "400",
        "provider_request": "none",
    }
    if values != expected:
        raise ReleaseError("keyless recovery probe did not match expected bounded result")
    return values


def validate_manifest_schema(data: Mapping[str, object], release_dir: Path, *, config: ReleaseConfig, sha: str) -> None:
    if data.get("project") != "buddy" or data.get("source_sha") != sha or data.get("complete") is not True:
        raise ReleaseError("release manifest does not match the requested complete source SHA")
    source = require_mapping(data.get("source"), "manifest source proof")
    if source.get("sha") != sha or source.get("default_sha") != sha or source.get("head_sha") != sha or source.get("status_clean") is not True:
        raise ReleaseError("release manifest source proof is incomplete")
    build = require_mapping(data.get("build"), "manifest build proof")
    build_id_path = release_dir / ".next" / "BUILD_ID"
    assert_regular_file(build_id_path, uid=config.root_uid, mode=0o444, label="Next BUILD_ID")
    if build.get("package_lock_sha256") != sha256_file(release_dir / "package-lock.json"):
        raise ReleaseError("release manifest lockfile digest mismatch")
    if build.get("build_id") != build_id_path.read_text().strip():
        raise ReleaseError("release manifest BUILD_ID mismatch")
    if not build.get("node_version") or not build.get("npm_version") or build.get("npm_ci") is not True or build.get("npm_run_build") is not True:
        raise ReleaseError("release manifest build proof is incomplete")
    probe = require_mapping(data.get("probe"), "manifest probe proof")
    if probe.get("completed") is not True:
        raise ReleaseError("release manifest probe proof is incomplete")
    validate_probe_fields(require_mapping(probe.get("fields"), "manifest probe fields"), sha=sha, keyless=True)


def validate_release_tree(release_dir: Path, *, config: ReleaseConfig | None = None, sha: str, uid: int | None = None, exact_path: bool = True) -> dict[str, object]:
    config = config or ReleaseConfig(root_uid=uid if uid is not None else 0, release_root=release_dir.parent, trust_anchor=release_dir.parent.parent)
    validate_sha(sha)
    expected = config.release_root / sha
    if exact_path and release_dir != expected:
        raise ReleaseError(f"release path must be {expected}")
    assert_trusted_hierarchy(config.release_root.parent, uid=config.root_uid, trust_anchor=config.trust_anchor)
    assert_trusted_dir(config.release_root, uid=config.root_uid, label="release path")
    assert_trusted_dir(release_dir, uid=config.root_uid, label="release path", exact_mode=0o555)
    manifest = release_dir / "BUDDY_RELEASE_MANIFEST.json"
    assert_regular_file(manifest, uid=config.root_uid, mode=0o444, label="release manifest")
    try:
        data = json.loads(manifest.read_text())
    except json.JSONDecodeError as exc:
        raise ReleaseError("release manifest is not valid JSON") from exc
    validate_manifest_schema(data, release_dir, config=config, sha=sha)
    entries = tree_entries(release_dir, uid=config.root_uid)
    if data.get("artifact_entries") != entries:
        raise ReleaseError("release artifact entries changed after attestation")
    if data.get("artifact_digest") != artifact_digest(entries):
        raise ReleaseError("release artifact digest changed after attestation")
    return data


def iter_source_policy_paths(source_dir: Path) -> Iterator[Path]:
    for current_root, dirnames, filenames in os.walk(source_dir):
        rel_root = Path(current_root).relative_to(source_dir)
        dirnames[:] = [
            name
            for name in dirnames
            if not any(part in {".git", "node_modules", ".next"} for part in (rel_root / name).parts)
        ]
        for filename in filenames:
            yield rel_root / filename if rel_root != Path(".") else Path(filename)


def validate_source_env_policy(source_dir: Path, tracked_paths: Sequence[str] | None = None) -> None:
    paths = [Path(item) for item in tracked_paths] if tracked_paths is not None else list(iter_source_policy_paths(source_dir))
    for rel_path in paths:
        rel = rel_path.as_posix()
        if rel_path.name.startswith(".env") and rel not in SOURCE_ENV_EXAMPLE_PATHS:
            raise ReleaseError(f"refusing source with local env file: {rel}")


def assert_prepare_git_state(
    runtime: Runtime,
    source: Path,
    *,
    env: Mapping[str, str],
    sha: str,
    default_branch: str,
    allow_build_outputs: bool,
) -> str:
    default_ref = runtime.run_as_service_user([BIN["git"], "symbolic-ref", "refs/remotes/origin/HEAD"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if default_ref.rsplit("/", 1)[-1] != default_branch:
        raise ReleaseError("fetched default branch changed during prepare")
    default_sha = runtime.run_as_service_user([BIN["git"], "rev-parse", f"origin/{default_branch}"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if default_sha != sha:
        raise ReleaseError("requested SHA is no longer the fetched default branch")
    head_sha = runtime.run_as_service_user([BIN["git"], "rev-parse", "HEAD"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if head_sha != sha:
        raise ReleaseError("checked-out source SHA changed during prepare")
    status = runtime.run_as_service_user(
        [BIN["git"], "status", "--porcelain", "--ignored=matching", "--untracked-files=all"],
        cwd=source,
        env=env,
        timeout=TIMEOUTS["git"],
    )
    unexpected: list[str] = []
    for line in status.splitlines():
        if len(line) < 4:
            unexpected.append(line)
            continue
        code = line[:2]
        rel = line[3:]
        if allow_build_outputs and code == "!!" and (rel == ".next/" or rel.startswith(".next/") or rel == "node_modules/" or rel.startswith("node_modules/")):
            continue
        unexpected.append(line)
    if unexpected:
        raise ReleaseError("source checkout changed during prepare")
    return head_sha


def chmod_release_tree(root: Path, *, uid: int, gid: int, final_root: bool = True) -> None:
    for path in sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_symlink():
            continue
        st = path.stat()
        mode = 0o555 if stat.S_ISDIR(st.st_mode) or stat.S_IMODE(st.st_mode) & 0o111 else 0o444
        try:
            os.chown(path, uid, gid)
        except PermissionError:
            if os.geteuid() == 0:
                raise
        os.chmod(path, mode)
    try:
        os.chown(root, uid, gid)
    except PermissionError:
        if os.geteuid() == 0:
            raise
    os.chmod(root, 0o555 if final_root else 0o755)


def write_manifest(
    config: ReleaseConfig,
    source_dir: Path,
    *,
    sha: str,
    default_branch: str,
    head_sha: str,
    node_version: str,
    npm_version: str,
    probe: Mapping[str, object],
) -> None:
    entries = tree_entries(source_dir, uid=config.root_uid)
    build_id = (source_dir / ".next" / "BUILD_ID").read_text().strip()
    manifest = {
        "project": "buddy",
        "source_sha": sha,
        "source_remote": config.repo_url,
        "source": {
            "sha": sha,
            "remote": config.repo_url,
            "default_branch": default_branch,
            "default_sha": sha,
            "head_sha": head_sha,
            "status_clean": True,
        },
        "build": {
            "package_lock_sha256": sha256_file(source_dir / "package-lock.json"),
            "build_id": build_id,
            "node_version": node_version,
            "npm_version": npm_version,
            "npm_ci": True,
            "npm_run_build": True,
        },
        "probe": {
            "completed": True,
            "fields": dict(probe),
        },
        "artifact_digest": artifact_digest(entries),
        "artifact_entries": entries,
        "complete": True,
        "created_at": utc_now(),
        "secrets_embedded": False,
    }
    atomic_write_config(
        config,
        source_dir / "BUDDY_RELEASE_MANIFEST.json",
        json.dumps(manifest, indent=2, sort_keys=True).encode() + b"\n",
        mode=0o444,
    )


def parse_probe_output(output: str, *, sha: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for field_assignment in output.split():
        if "=" not in field_assignment:
            raise ReleaseError("keyless recovery probe emitted malformed output")
        key, value = field_assignment.split("=", 1)
        if key not in PROBE_FIELDS:
            raise ReleaseError("keyless recovery probe emitted an unexpected field")
        if key in fields:
            raise ReleaseError("keyless recovery probe emitted a duplicate field")
        fields[key] = value
    return validate_probe_fields(fields, sha=sha, keyless=True)


def prepare_release(sha: str, runtime: Runtime) -> dict[str, object]:
    runtime.require_root()
    sha = validate_sha(sha)
    config = runtime.config
    with runtime.lock():
        user_info = pwd.getpwnam(config.service_user)
        release_dir = config.release_root / sha
        if release_dir.exists() or release_dir.is_symlink():
            raise ReleaseError(f"release already exists: {release_dir}")

        user_stage = Path(tempfile.mkdtemp(prefix=f"buddy-build-{sha}."))
        os.chmod(user_stage, 0o700)
        try:
            os.chown(user_stage, user_info.pw_uid, user_info.pw_gid)
        except PermissionError:
            if os.geteuid() == 0:
                raise
        source = user_stage / "source"
        root_stage = config.staging_root / f"{sha}.{uuid.uuid4().hex}.root"
        env = sanitized_build_env(user_info.pw_dir)
        try:
            runtime.run_as_service_user([BIN["git"], "clone", "--no-checkout", config.repo_url, str(source)], cwd=user_stage, env=env, timeout=TIMEOUTS["git"])
            runtime.run_as_service_user([BIN["git"], "fetch", "--prune", "origin"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            runtime.run_as_service_user([BIN["git"], "remote", "set-head", "origin", "-a"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            default_ref = runtime.run_as_service_user([BIN["git"], "symbolic-ref", "refs/remotes/origin/HEAD"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            default_branch = default_ref.rsplit("/", 1)[-1]
            runtime.run_as_service_user([BIN["git"], "fetch", "origin", default_branch], cwd=source, env=env, timeout=TIMEOUTS["git"])
            runtime.run_as_service_user([BIN["git"], "checkout", "--detach", sha], cwd=source, env=env, timeout=TIMEOUTS["git"])
            runtime.run_as_service_user([BIN["git"], "merge-base", "--is-ancestor", sha, f"origin/{default_branch}"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            actual = assert_prepare_git_state(runtime, source, env=env, sha=sha, default_branch=default_branch, allow_build_outputs=False)
            tracked = runtime.run_as_service_user([BIN["git"], "ls-files"], cwd=source, env=env, timeout=TIMEOUTS["git"]).splitlines()
            validate_source_env_policy(source, tracked_paths=tracked)
            runtime.run_as_service_user([BIN["npm"], "ci", "--no-audit", "--no-fund"], cwd=source, env=env, timeout=TIMEOUTS["npm_ci"])
            validate_source_env_policy(source, tracked_paths=tracked)
            runtime.run_as_service_user([BIN["npm"], "run", "build"], cwd=source, env=env, timeout=TIMEOUTS["build"])
            validate_source_env_policy(source, tracked_paths=tracked)
            probe_script = source / "ops" / "recovery-probe.sh"
            if not probe_script.exists():
                raise ReleaseError("keyless recovery probe is absent from reviewed source")
            probe_output = runtime.run_as_service_user([BIN["bash"], str(probe_script), config.probe_port], cwd=source, env=env, timeout=TIMEOUTS["probe"])
            probe = parse_probe_output(probe_output, sha=sha)
            node_version = runtime.run_as_service_user([BIN["node"], "--version"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            npm_version = runtime.run_as_service_user([BIN["npm"], "--version"], cwd=source, env=env, timeout=TIMEOUTS["git"])
            actual = assert_prepare_git_state(runtime, source, env=env, sha=sha, default_branch=default_branch, allow_build_outputs=True)
            shutil.rmtree(source / ".git")
            root_stage.mkdir(mode=0o700)
            fsync_dir(config.staging_root)
            staged_release = root_stage / "release"
            shutil.copytree(source, staged_release, symlinks=True)
            chmod_release_tree(staged_release, uid=config.root_uid, gid=config.root_gid, final_root=False)
            write_manifest(
                config,
                staged_release,
                sha=sha,
                default_branch=default_branch,
                head_sha=actual,
                node_version=node_version,
                npm_version=npm_version,
                probe=probe,
            )
            os.chmod(staged_release, 0o555)
            validate_release_tree(staged_release, config=config, sha=sha, exact_path=False)
            fsync_tree(staged_release)
            os.chmod(staged_release, 0o755)
            if release_dir.exists() or release_dir.is_symlink():
                raise ReleaseError(f"release already exists: {release_dir}")
            os.rename(staged_release, release_dir)
            os.chmod(release_dir, 0o555)
            fsync_dir(config.release_root)
            with contextlib.suppress(OSError):
                root_stage.rmdir()
            manifest = validate_release_tree(release_dir, config=config, sha=sha)
        finally:
            with contextlib.suppress(FileNotFoundError):
                shutil.rmtree(user_stage)
        return {"status": "prepared", "release": str(release_dir), "source_sha": sha, "artifact_digest": manifest["artifact_digest"]}
