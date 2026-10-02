#!/usr/bin/env python3
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
SECRET_KEY_RE = re.compile(r"(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)", re.I)
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
        if "=" in part and SECRET_KEY_RE.search(part.split("=", 1)[0]):
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
    leaked = sorted(k for k in os.environ if SECRET_KEY_RE.search(k))
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
    for token in output.split():
        if "=" not in token:
            raise ReleaseError("keyless recovery probe emitted malformed output")
        key, value = token.split("=", 1)
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


def dropin_content(release_dir: Path, runtime_env: Path) -> bytes:
    return (
        "[Service]\n"
        f"WorkingDirectory={release_dir}\n"
        f"EnvironmentFile={runtime_env}\n"
    ).encode()


def parse_systemctl_show(raw: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in raw.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    return values


def parse_exec_start(raw: str) -> tuple[str, tuple[str, ...]]:
    path_match = re.search(r"(?:^|\s)path=([^ ;]+)", raw)
    if not path_match or "argv[]=" not in raw:
        raise ReleaseError("buddy.service ExecStart shape is unsupported")
    argv_raw = raw.split("argv[]=", 1)[1].split(" ;", 1)[0].strip()
    try:
        argv = tuple(shlex.split(argv_raw))
    except ValueError as exc:
        raise ReleaseError("buddy.service ExecStart argv is unsupported") from exc
    return path_match.group(1), argv


def parse_environment(raw: str) -> dict[str, str]:
    if not raw:
        values: dict[str, str] = {}
    else:
        try:
            tokens = shlex.split(raw)
        except ValueError as exc:
            raise ReleaseError("buddy.service environment is unsupported") from exc
        values = {}
        for token in tokens:
            if "=" not in token:
                raise ReleaseError("buddy.service environment is unsupported")
            key, value = token.split("=", 1)
            if key not in EXPECTED_ENVIRONMENT:
                if SECRET_KEY_RE.search(key):
                    raise ReleaseError("buddy.service environment contains unsupported secret-bearing keys")
                raise ReleaseError("buddy.service environment identity changed")
            values[key] = value
    if values != EXPECTED_ENVIRONMENT:
        raise ReleaseError("buddy.service environment identity changed")
    return values


def parse_main_pid(value: str | None) -> int:
    try:
        return int(value or "0")
    except ValueError as exc:
        raise ReleaseError("buddy.service MainPID is invalid") from exc


def extract_systemd_paths(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    paths: list[str] = []
    for item in raw.split():
        if item.startswith("("):
            continue
        paths.append(item)
    return tuple(paths)


def read_service_identity(runtime: Runtime) -> dict[str, object]:
    props = [
        "ActiveState",
        "SubState",
        "WorkingDirectory",
        "ExecStart",
        "User",
        "Environment",
        "EnvironmentFiles",
        "DropInPaths",
        "Restart",
        "RestartUSec",
        "MainPID",
        "FragmentPath",
    ]
    raw = runtime.systemctl(["show", *[item for prop in props for item in ("-p", prop)]], service=SERVICE_NAME)
    values = parse_systemctl_show(raw)
    exec_path, exec_argv = parse_exec_start(values.get("ExecStart", ""))
    environment = parse_environment(values.get("Environment", ""))
    return {
        "ActiveState": values.get("ActiveState", ""),
        "SubState": values.get("SubState", ""),
        "WorkingDirectory": values.get("WorkingDirectory", ""),
        "ExecStartPath": exec_path,
        "ExecStartArgv": list(exec_argv),
        "User": values.get("User", ""),
        "Environment": environment,
        "EnvironmentFiles": list(extract_systemd_paths(values.get("EnvironmentFiles"))),
        "DropInPaths": list(extract_systemd_paths(values.get("DropInPaths"))),
        "Restart": values.get("Restart", ""),
        "RestartUSec": values.get("RestartUSec", ""),
        "MainPID": parse_main_pid(values.get("MainPID")),
        "FragmentPath": values.get("FragmentPath", ""),
    }


def assert_prior_service_identity(runtime: Runtime, identity: Mapping[str, object]) -> None:
    config = runtime.config
    if identity.get("ActiveState") != "active" or identity.get("SubState") != "running":
        raise ReleaseError("buddy.service must be active/running before install")
    if int(identity.get("MainPID", 0)) <= 0:
        raise ReleaseError("buddy.service prior MainPID is not positive")
    if identity.get("WorkingDirectory") != config.old_working_directory:
        raise ReleaseError("buddy.service prior WorkingDirectory is not the expected mutable checkout")
    if identity.get("User") != config.service_user:
        raise ReleaseError("buddy.service prior User is not ubuntu")
    if identity.get("ExecStartPath") != EXPECTED_EXEC_PATH or tuple(identity.get("ExecStartArgv", ())) != EXPECTED_EXEC_ARGV:
        raise ReleaseError("buddy.service prior ExecStart is not the expected npm start")
    if identity.get("Environment") != EXPECTED_ENVIRONMENT:
        raise ReleaseError("buddy.service prior environment identity changed")
    if identity.get("Restart") != "always" or identity.get("RestartUSec") != "10s":
        raise ReleaseError("buddy.service prior restart policy changed")
    if identity.get("FragmentPath") != str(config.unit):
        raise ReleaseError("buddy.service prior FragmentPath is not the configured native unit")
    if identity.get("EnvironmentFiles") != [] or identity.get("DropInPaths") != []:
        raise ReleaseError("buddy.service prior drop-in or environment file binding changed")


def assert_preserved_service_shape(before: Mapping[str, object], after: Mapping[str, object]) -> None:
    for key in ("ExecStartPath", "ExecStartArgv", "User", "Environment", "Restart", "RestartUSec", "FragmentPath"):
        if before.get(key) != after.get(key):
            raise ReleaseError(f"buddy.service peer property changed during install: {key}")


def assert_peer_service_unchanged(before: Mapping[str, object], after: Mapping[str, object], *, require_old_wd: bool = True) -> None:
    assert_preserved_service_shape(before, after)
    if require_old_wd and after.get("WorkingDirectory") != before.get("WorkingDirectory"):
        raise ReleaseError("buddy.service WorkingDirectory changed during install")


def assert_after_install_identity(before: Mapping[str, object], after: Mapping[str, object], *, config: ReleaseConfig, sha: str) -> None:
    if after.get("ActiveState") != "active" or after.get("SubState") != "running":
        raise ReleaseError("buddy.service did not become active/running")
    if int(after.get("MainPID", 0)) <= 0 or int(after.get("MainPID", 0)) == int(before.get("MainPID", 0)):
        raise ReleaseError("buddy.service did not restart with a new positive MainPID")
    if after.get("WorkingDirectory") != str(config.release_root / sha):
        raise ReleaseError("buddy.service did not publish the requested release")
    if after.get("EnvironmentFiles") != [str(config.runtime_env)]:
        raise ReleaseError("buddy.service did not bind the expected runtime env file")
    if after.get("DropInPaths") != [str(config.dropin)]:
        raise ReleaseError("buddy.service did not load the expected release drop-in")
    assert_preserved_service_shape(before, after)


def assert_after_rollback_identity(before: Mapping[str, object], after: Mapping[str, object]) -> None:
    if after.get("ActiveState") != "active" or after.get("SubState") != "running":
        raise ReleaseError("buddy.service is not active/running after rollback")
    if int(after.get("MainPID", 0)) <= 0:
        raise ReleaseError("buddy.service rollback MainPID is not positive")
    for key in ("WorkingDirectory", "EnvironmentFiles", "DropInPaths"):
        if after.get(key) != before.get(key):
            raise ReleaseError(f"buddy.service rollback {key} mismatch")
    assert_preserved_service_shape(before, after)


def proxy_disabled_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def read_http_json(url: str, *, timeout: float) -> tuple[int, dict[str, object] | None]:
    request = urllib.request.Request(url)
    opener = proxy_disabled_opener()
    try:
        with opener.open(request, timeout=timeout) as response:
            data = response.read(MAX_HTTP_BODY + 1)
            if len(data) > MAX_HTTP_BODY:
                raise ReleaseError("health response body too large")
            return response.status, json.loads(data.decode() or "{}")
    except urllib.error.HTTPError as exc:
        data = exc.read(MAX_HTTP_BODY + 1)
        if len(data) > MAX_HTTP_BODY:
            raise ReleaseError("health response body too large")
        try:
            body = json.loads(data.decode() or "{}")
        except json.JSONDecodeError:
            body = None
        return exc.code, body


def read_http_status(url: str, *, timeout: float, method: str = "GET", data: bytes | None = None) -> int:
    request = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    opener = proxy_disabled_opener()
    try:
        with opener.open(request, timeout=timeout) as response:
            data_read = response.read(MAX_HTTP_BODY + 1)
            if len(data_read) > MAX_HTTP_BODY:
                raise ReleaseError("health response body too large")
            return response.status
    except urllib.error.HTTPError as exc:
        data_read = exc.read(MAX_HTTP_BODY + 1)
        if len(data_read) > MAX_HTTP_BODY:
            raise ReleaseError("health response body too large")
        return exc.code


def probe_loopback_health(
    *,
    base_url: str = LOOPBACK_BASE_URL,
    expect_api: bool | None,
    deadline_seconds: int = TIMEOUTS["health"],
    allow_memory_false: bool = False,
    expected_health_status: int | None = None,
    expected_memory: bool | None = None,
) -> dict[str, object]:
    deadline = time.monotonic() + deadline_seconds
    last: dict[str, object] = {}
    expected_status = expected_health_status
    if expected_status is None:
        expected_status = 200 if expect_api is True else 503 if expect_api is False else None
    while time.monotonic() < deadline:
        try:
            home = read_http_status(f"{base_url}/", timeout=3)
            health_status, health_body = read_http_json(f"{base_url}/api/health", timeout=3)
            invalid = read_http_status(
                f"{base_url}/api/ask",
                timeout=3,
                method="POST",
                data=b'{"question":""}',
            )
            checks = (health_body or {}).get("checks", {})
            last = {
                "home_status": home,
                "health_status": health_status,
                "invalid_ask_status": invalid,
                "memory": checks.get("memory") if isinstance(checks, dict) else None,
                "api": checks.get("api") if isinstance(checks, dict) else None,
            }
            api_ok = expect_api is None or last["api"] is expect_api
            memory_ok = last["memory"] is expected_memory if expected_memory is not None else (last["memory"] is True or (allow_memory_false and last["memory"] is False))
            status_ok = expected_status is None or health_status == expected_status
            if home == 200 and invalid == 400 and memory_ok and api_ok and status_ok:
                return last
        except Exception as exc:
            last = {"error": type(exc).__name__}
        time.sleep(2)
    raise ReleaseError(f"Buddy health did not reach required bounded state: {last}")


def probe_degraded_baseline(runtime: Runtime, *, deadline_seconds: int = 15) -> dict[str, object]:
    return probe_loopback_health(
        base_url=runtime.config.base_url,
        expect_api=None,
        deadline_seconds=deadline_seconds,
        allow_memory_false=True,
    )


def probe_post_install(runtime: Runtime) -> dict[str, object]:
    return probe_loopback_health(
        base_url=runtime.config.base_url,
        expect_api=True,
        deadline_seconds=TIMEOUTS["health"],
        expected_health_status=200,
        expected_memory=True,
    )


def probe_rollback_baseline(runtime: Runtime, before_health: Mapping[str, object]) -> dict[str, object]:
    expected_status = before_health.get("health_status")
    expected_memory = before_health.get("memory")
    status_int = int(expected_status) if isinstance(expected_status, int) else None
    memory_bool = expected_memory if isinstance(expected_memory, bool) else None
    return probe_loopback_health(
        base_url=runtime.config.base_url,
        expect_api=before_health.get("api") if isinstance(before_health.get("api"), bool) else None,
        deadline_seconds=30,
        allow_memory_false=True,
        expected_health_status=status_int,
        expected_memory=memory_bool,
    )


def scrub_for_receipt(value: object) -> object:
    if isinstance(value, Mapping):
        return {str(k): scrub_for_receipt(v) for k, v in value.items()}
    if isinstance(value, list):
        return [scrub_for_receipt(item) for item in value]
    return value


def write_json_file(config: ReleaseConfig, path: Path, payload: Mapping[str, object], *, mode: int = 0o600) -> None:
    atomic_write_config(config, path, json.dumps(scrub_for_receipt(payload), indent=2, sort_keys=True).encode() + b"\n", mode=mode)


def write_receipt(config: ReleaseConfig, path: Path, payload: Mapping[str, object]) -> None:
    if path.exists() or path.is_symlink():
        assert_regular_file(path, uid=config.root_uid, mode=0o600, label="release receipt", single_link=True)
        try:
            existing = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            raise ReleaseError("existing receipt is malformed") from exc
        if existing.get("phase") in TERMINAL_PHASES:
            raise ReleaseError("refusing to overwrite terminal receipt")
    write_json_file(config, path, payload, mode=0o600)


def copy_beforeimage_bytes(path: Path, tx_dir: Path, name: str, image: FileImage) -> str | None:
    if not image.exists:
        return None
    if image.data is None:
        raise ReleaseError("missing private beforeimage bytes")
    target = tx_dir / name
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(image.data)
            fh.flush()
            os.fsync(fh.fileno())
    except Exception:
        with contextlib.suppress(FileNotFoundError):
            target.unlink()
        raise
    return target.name


def create_transaction(config: ReleaseConfig, sha: str) -> tuple[str, Path]:
    tx_id = f"{utc_now().replace(':', '').replace('-', '')}.{sha}.{uuid.uuid4().hex}"
    validate_tx_id(tx_id)
    tx_dir = config.transaction_root / tx_id
    tx_dir.mkdir(mode=0o700)
    fsync_dir(config.transaction_root)
    return tx_id, tx_dir


def validate_tx_id(tx_id: str) -> str:
    if not TX_ID_RE.fullmatch(tx_id):
        raise ReleaseError("transaction id is malformed")
    return tx_id


def receipt_path_for(config: ReleaseConfig, tx_id: str) -> Path:
    validate_tx_id(tx_id)
    return config.receipt_root / f"{tx_id}.json"


def validate_receipt_name(receipt_name: str) -> str:
    if "/" in receipt_name or receipt_name in {"", ".", ".."} or not receipt_name.endswith(".json"):
        raise ReleaseError("rollback receipt must be a fixed receipt basename")
    validate_tx_id(receipt_name.removesuffix(".json"))
    return receipt_name


def load_receipt(config: ReleaseConfig, receipt_name: str) -> tuple[Path, dict[str, object]]:
    receipt_name = validate_receipt_name(receipt_name)
    receipt_path = config.receipt_root / receipt_name
    assert_regular_file(receipt_path, uid=config.root_uid, mode=0o600, label="release receipt", single_link=True)
    data = json.loads(receipt_path.read_text())
    if not isinstance(data, dict):
        raise ReleaseError("release receipt is malformed")
    tx_id = data.get("transaction_id")
    if tx_id != receipt_name.removesuffix(".json"):
        raise ReleaseError("release receipt transaction id mismatch")
    return receipt_path, data


def assert_no_nonterminal_receipts(config: ReleaseConfig) -> None:
    if not config.receipt_root.exists():
        return
    for path in sorted(config.receipt_root.glob("*.json")):
        if path.is_symlink():
            raise ReleaseError("release receipt is a symlink")
        assert_regular_file(path, uid=config.root_uid, mode=0o600, label="release receipt", single_link=True)
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            raise ReleaseError("release receipt is malformed") from exc
        if not isinstance(data, Mapping):
            raise ReleaseError("release receipt is malformed")
        phase = data.get("phase")
        if phase not in NONTERMINAL_PHASES | TERMINAL_PHASES:
            raise ReleaseError("release receipt has unknown phase")
        if phase in NONTERMINAL_PHASES:
            raise ReleaseError("prior nonterminal release intent exists")


def assert_current_image(path: Path, expected: FileImage, *, label: str) -> None:
    current = FileImage.capture(path)
    if current.public() != expected.public():
        raise ReleaseError(f"{label} changed since beforeimage capture")


def planned_public_image(data: bytes, *, mode: int, uid: int, gid: int) -> dict[str, object]:
    return {
        "exists": True,
        "sha256": sha256_bytes(data),
        "mode": oct(mode),
        "uid": uid,
        "gid": gid,
        "size": len(data),
        "link_count": 1,
    }


def current_public_image(path: Path) -> dict[str, object]:
    return FileImage.capture(path).public()


def assert_current_public(path: Path, expected: Mapping[str, object], *, label: str) -> None:
    if current_public_image(path) != dict(expected):
        raise ReleaseError(f"{label} readback mismatch")


def assert_current_is_before_or_planned(path: Path, before: FileImage, planned: Mapping[str, object] | None, *, label: str) -> None:
    current = current_public_image(path)
    allowed = [before.public()]
    if planned is not None:
        allowed.append(dict(planned))
    if current not in allowed:
        raise ReleaseError(f"{label} changed outside this transaction; refusing rollback overwrite")


def validate_tx_file_name(name: str | None) -> str:
    if not name or "/" in name or name in {".", ".."}:
        raise ReleaseError("private beforeimage file name is malformed")
    if name not in {"runtime.env.before", "10-release.conf.before", "buddy.service.before"}:
        raise ReleaseError("private beforeimage file name is unexpected")
    return name


def parse_public_mode(value: object) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"0o[0-7]{3,4}", value):
        raise ReleaseError("beforeimage mode is malformed")
    return int(value, 8)


def validate_public_file_image(
    public: Mapping[str, object],
    *,
    label: str,
    uid: int,
    gid: int,
    allowed_modes: set[int],
    required: bool = False,
) -> None:
    expected_keys = {"exists", "sha256", "mode", "uid", "gid", "size", "link_count"}
    if set(public) != expected_keys:
        raise ReleaseError(f"{label} beforeimage schema is malformed")
    if public.get("exists") is False:
        if required:
            raise ReleaseError(f"{label} beforeimage must exist")
        for key in ("sha256", "mode", "uid", "gid", "size", "link_count"):
            if public.get(key) is not None:
                raise ReleaseError(f"{label} absent beforeimage metadata is malformed")
        return
    if public.get("exists") is not True:
        raise ReleaseError(f"{label} beforeimage exists flag is malformed")
    if not isinstance(public.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", str(public.get("sha256"))):
        raise ReleaseError(f"{label} beforeimage sha256 is malformed")
    mode = parse_public_mode(public.get("mode"))
    if mode not in allowed_modes:
        raise ReleaseError(f"{label} beforeimage mode is not allowed")
    if public.get("uid") != uid or public.get("gid") != gid:
        raise ReleaseError(f"{label} beforeimage ownership is not allowed")
    size = public.get("size")
    if not isinstance(size, int) or size < 0 or size > MAX_ENV_BYTES:
        raise ReleaseError(f"{label} beforeimage size is malformed")
    if public.get("link_count") != 1:
        raise ReleaseError(f"{label} beforeimage link count is not allowed")


def read_tx_image(
    tx_dir: Path,
    name: str | None,
    public: Mapping[str, object],
    *,
    uid: int,
    gid: int,
    allowed_modes: set[int],
    label: str,
    required: bool = False,
) -> FileImage:
    validate_public_file_image(public, label=label, uid=uid, gid=gid, allowed_modes=allowed_modes, required=required)
    if not bool(public["exists"]):
        if name is not None:
            raise ReleaseError("absent beforeimage must not name a private file")
        return FileImage.absent()
    name = validate_tx_file_name(name)
    path = tx_dir / name
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            raise ReleaseError("private beforeimage file is a symlink") from exc
        raise
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != uid or stat.S_IMODE(st.st_mode) != 0o600 or st.st_nlink != 1:
            raise ReleaseError("private beforeimage file identity is unsafe")
        chunks: list[bytes] = []
        remaining = int(public["size"]) + 1
        while remaining > 0:
            chunk = os.read(fd, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
    finally:
        os.close(fd)
    expected_size = int(public["size"])
    expected_sha = str(public["sha256"])
    if len(data) != expected_size or sha256_bytes(data) != expected_sha:
        raise ReleaseError("private beforeimage bytes do not match receipt")
    return FileImage(
        True,
        expected_sha,
        parse_public_mode(public["mode"]),
        int(public["uid"]),
        int(public["gid"]),
        expected_size,
        int(public["link_count"]),
        data,
    )


def assert_pre_mutation_state(
    runtime: Runtime,
    *,
    prior_identity: Mapping[str, object],
    source_env_image: FileImage,
    before_runtime: FileImage,
    before_dropin: FileImage,
    unit_image: FileImage,
) -> None:
    assert_current_image(runtime.config.source_env, source_env_image, label="source env")
    assert_current_image(runtime.config.runtime_env, before_runtime, label="runtime env")
    assert_current_image(runtime.config.dropin, before_dropin, label="drop-in")
    assert_current_image(runtime.config.unit, unit_image, label="native unit")
    current_identity = read_service_identity(runtime)
    assert_prior_service_identity(runtime, current_identity)
    assert_peer_service_unchanged(prior_identity, current_identity)


def assert_between_write_state(
    runtime: Runtime,
    *,
    prior_identity: Mapping[str, object],
    source_env_image: FileImage,
    unit_image: FileImage,
) -> None:
    assert_current_image(runtime.config.source_env, source_env_image, label="source env")
    assert_current_image(runtime.config.unit, unit_image, label="native unit")
    current_identity = read_service_identity(runtime)
    assert_prior_service_identity(runtime, current_identity)
    assert_peer_service_unchanged(prior_identity, current_identity)


def install_release(
    sha: str,
    *,
    expect_runtime_env_sha256: str,
    expect_dropin_sha256: str,
    dry_run: bool,
    runtime: Runtime,
) -> dict[str, object]:
    runtime.require_root()
    sha = validate_sha(sha)
    config = runtime.config
    with runtime.lock():
        assert_no_nonterminal_receipts(config)
        validate_release_tree(config.release_root / sha, config=config, sha=sha)
        assert_regular_file(config.unit, uid=config.root_uid, mode=None, label="native buddy.service unit")
        parsed_env, source_env_image = read_private_source_env(config.source_env, uid=config.service_uid)
        runtime_values = projected_runtime_env(parsed_env)
        runtime_data = render_runtime_env(runtime_values)
        dropin_data = dropin_content(config.release_root / sha, config.runtime_env)
        before_runtime = assert_expected_beforeimage(config.runtime_env, expect_runtime_env_sha256)
        before_dropin = assert_expected_beforeimage(config.dropin, expect_dropin_sha256)
        unit_image = FileImage.capture(config.unit, include_data=True)
        prior_identity = read_service_identity(runtime)
        assert_prior_service_identity(runtime, prior_identity)
        prior_health = probe_degraded_baseline(runtime, deadline_seconds=15)

        dry_result = {
            "status": "dry_run_complete",
            "source_sha": sha,
            "release": str(config.release_root / sha),
            "before": {
                "runtime_env": before_runtime.public(),
                "dropin": before_dropin.public(),
                "unit": unit_image.public(),
                "systemd": dict(prior_identity),
                "health": prior_health,
            },
            "planned": {
                "runtime_env": planned_public_image(runtime_data, mode=0o600, uid=config.root_uid, gid=config.root_gid),
            "dropin": planned_public_image(dropin_data, mode=0o644, uid=config.root_uid, gid=config.root_gid),
            },
            "provider_operation": "not_attempted",
            "route_change": "not_attempted",
        }
        if dry_run:
            return dry_result

        tx_id, tx_dir = create_transaction(config, sha)
        runtime_before_name = copy_beforeimage_bytes(config.runtime_env, tx_dir, "runtime.env.before", before_runtime)
        dropin_before_name = copy_beforeimage_bytes(config.dropin, tx_dir, "10-release.conf.before", before_dropin)
        unit_before_name = copy_beforeimage_bytes(config.unit, tx_dir, "buddy.service.before", unit_image)
        fsync_dir(tx_dir)
        receipt_path = receipt_path_for(config, tx_id)
        receipt: dict[str, object] = {
            "project": "buddy",
            "service": SERVICE_NAME,
            "source_sha": sha,
            "release_dir": str(config.release_root / sha),
            "transaction_id": tx_id,
            "phase": "intent",
            "started_at": utc_now(),
            "before": {
                "runtime_env": before_runtime.public(),
                "dropin": before_dropin.public(),
                "unit": unit_image.public(),
                "systemd": dict(prior_identity),
                "health": prior_health,
            },
            "planned": {
                "runtime_env": planned_public_image(runtime_data, mode=0o600, uid=config.root_uid, gid=config.root_gid),
                "dropin": planned_public_image(dropin_data, mode=0o644, uid=config.root_uid, gid=config.root_gid),
            },
            "private_beforeimage_files": {
                "runtime_env": runtime_before_name,
                "dropin": dropin_before_name,
                "unit": unit_before_name,
            },
            "projected_env_keys": sorted(runtime_values),
            "provider_operation": "not_attempted",
            "route_change": "not_attempted",
        }
        write_receipt(config, receipt_path, receipt)

        try:
            assert_pre_mutation_state(
                runtime,
                prior_identity=prior_identity,
                source_env_image=source_env_image,
                before_runtime=before_runtime,
                before_dropin=before_dropin,
                unit_image=unit_image,
            )
            atomic_write_config(config, config.runtime_env, runtime_data, mode=0o600)
            installed_runtime = FileImage.capture(config.runtime_env)
            assert_current_public(config.runtime_env, receipt["planned"]["runtime_env"], label="runtime env")
            receipt["phase"] = "runtime_env_written"
            receipt["mutation_images"] = {"runtime_env": installed_runtime.public()}
            write_receipt(config, receipt_path, receipt)
            assert_between_write_state(
                runtime,
                prior_identity=prior_identity,
                source_env_image=source_env_image,
                unit_image=unit_image,
            )
            assert_current_public(config.runtime_env, receipt["planned"]["runtime_env"], label="runtime env")
            assert_current_image(config.dropin, before_dropin, label="drop-in")
            atomic_write_config(config, config.dropin, dropin_data, mode=0o644)
            installed_dropin = FileImage.capture(config.dropin)
            assert_current_public(config.dropin, receipt["planned"]["dropin"], label="drop-in")
            assert_between_write_state(
                runtime,
                prior_identity=prior_identity,
                source_env_image=source_env_image,
                unit_image=unit_image,
            )
            receipt["mutation_images"] = {"runtime_env": installed_runtime.public(), "dropin": installed_dropin.public()}
            receipt["phase"] = "dropin_written"
            write_receipt(config, receipt_path, receipt)
            runtime.systemctl(["daemon-reload"])
            runtime.systemctl(["restart"], service=SERVICE_NAME)
            after_identity = read_service_identity(runtime)
            assert_after_install_identity(prior_identity, after_identity, config=config, sha=sha)
            assert_current_public(config.runtime_env, receipt["planned"]["runtime_env"], label="runtime env")
            assert_current_public(config.dropin, receipt["planned"]["dropin"], label="drop-in")
            assert_current_image(config.unit, unit_image, label="native unit")
            health = probe_post_install(runtime)
            receipt.update(
                {
                    "phase": "installed",
                    "completed_at": utc_now(),
                    "installed_images": {
                        "runtime_env": installed_runtime.public(),
                        "dropin": installed_dropin.public(),
                    },
                    "after": {
                        "runtime_env": FileImage.capture(config.runtime_env).public(),
                        "dropin": FileImage.capture(config.dropin).public(),
                        "unit": FileImage.capture(config.unit).public(),
                        "systemd": after_identity,
                        "health": health,
                    },
                }
            )
            write_receipt(config, receipt_path, receipt)
            return {"status": "installed", "receipt": str(receipt_path)}
        except Exception as exc:
            receipt["failure"] = {"type": type(exc).__name__}
            if receipt.get("phase") == "intent" and "mutation_images" not in receipt:
                receipt["phase"] = "rollback_failed"
                receipt["rollback_failure"] = {"type": "pre_mutation_refusal"}
            else:
                try:
                    rollback_result = rollback_from_receipt(receipt_path.name, runtime=runtime, active_receipt=receipt, stop_first=True)
                    receipt.update(rollback_result["receipt_update"])
                except Exception as rollback_exc:
                    receipt["phase"] = "rollback_failed"
                    receipt["rollback_failure"] = {"type": type(rollback_exc).__name__}
            try:
                write_receipt(config, receipt_path, receipt)
            except ReleaseError:
                existing = json.loads(receipt_path.read_text())
                if existing.get("phase") not in TERMINAL_PHASES:
                    raise
            raise


def rollback_from_receipt(
    receipt_name: str,
    *,
    runtime: Runtime,
    active_receipt: dict[str, object] | None = None,
    stop_first: bool = True,
) -> dict[str, object]:
    runtime.require_root()
    config = runtime.config
    bootstrap_release_roots(config)
    receipt_path: Path | None = None
    receipt: dict[str, object] | None = active_receipt
    try:
        if active_receipt is None:
            receipt_path, receipt = load_receipt(config, receipt_name)
        else:
            validate_receipt_name(receipt_name)
            receipt_path = config.receipt_root / receipt_name
            if str(active_receipt.get("transaction_id")) != receipt_name.removesuffix(".json"):
                raise ReleaseError("release receipt transaction id mismatch")
        assert receipt is not None
        result = _rollback_loaded_receipt(receipt_path, receipt, runtime=runtime, stop_first=stop_first)
        if active_receipt is None:
            terminal = dict(receipt)
            terminal.update(result)
            write_receipt(config, receipt_path, terminal)
        else:
            active_receipt.update(result)
        return {"status": "rolled_back", "receipt": str(receipt_path), "receipt_update": result}
    except Exception as exc:
        if receipt_path is not None and receipt is not None and receipt.get("phase") not in TERMINAL_PHASES:
            receipt["phase"] = "rollback_failed"
            receipt["rollback_failure"] = {"type": type(exc).__name__}
            with contextlib.suppress(Exception):
                write_receipt(config, receipt_path, receipt)
        raise


def read_bounded_service_state(runtime: Runtime) -> dict[str, object]:
    try:
        raw = runtime.systemctl(["show", "-p", "ActiveState", "-p", "SubState", "-p", "MainPID"], service=SERVICE_NAME, timeout=5)
        values = parse_systemctl_show(raw)
        return {
            "ActiveState": values.get("ActiveState", "unknown"),
            "SubState": values.get("SubState", "unknown"),
            "MainPID": parse_main_pid(values.get("MainPID")),
        }
    except Exception as exc:
        return {"state": "unknown", "error": type(exc).__name__}


def stop_buddy_fail_closed(runtime: Runtime) -> dict[str, object]:
    result: dict[str, object] = {"stop_attempted": True}
    try:
        runtime.systemctl(["stop"], service=SERVICE_NAME)
    except Exception as exc:
        result["stop_error"] = {"type": type(exc).__name__}
        result["final_state"] = read_bounded_service_state(runtime)
        return result
    else:
        result["stop_error"] = None
    deadline = time.monotonic() + 5
    final_state: dict[str, object] = {"state": "unknown"}
    while time.monotonic() < deadline:
        final_state = read_bounded_service_state(runtime)
        if final_state.get("ActiveState") == "inactive" and int(final_state.get("MainPID", -1)) == 0:
            break
        time.sleep(0.2)
    result["final_state"] = final_state
    return result


def _rollback_loaded_receipt(
    receipt_path: Path,
    receipt: dict[str, object],
    *,
    runtime: Runtime,
    stop_first: bool,
) -> dict[str, object]:
    config = runtime.config
    if receipt.get("phase") not in NONTERMINAL_PHASES:
        raise ReleaseError("only interrupted nonterminal receipts can be rolled back")
    tx_id = validate_tx_id(str(receipt["transaction_id"]))
    if receipt_path.name != f"{tx_id}.json":
        raise ReleaseError("release receipt transaction id mismatch")
    if receipt.get("project") != "buddy" or receipt.get("service") != SERVICE_NAME:
        raise ReleaseError("release receipt project or service mismatch")
    sha = validate_sha(str(receipt.get("source_sha")))
    if receipt.get("release_dir") != str(config.release_root / sha):
        raise ReleaseError("release receipt release path mismatch")
    tx_dir = config.transaction_root / tx_id
    assert_trusted_dir(tx_dir, uid=config.root_uid, label="transaction directory", exact_mode=0o700)
    before = require_mapping(receipt.get("before"), "receipt beforeimages")
    names = require_mapping(receipt.get("private_beforeimage_files"), "receipt private beforeimage files")
    planned = receipt.get("planned", {})
    planned_map = planned if isinstance(planned, Mapping) else {}
    runtime_before = read_tx_image(
        tx_dir,
        names.get("runtime_env"),
        require_mapping(before.get("runtime_env"), "runtime env beforeimage"),
        uid=config.root_uid,
        gid=config.root_gid,
        allowed_modes={0o600},
        label="runtime env",
    )
    dropin_before = read_tx_image(
        tx_dir,
        names.get("dropin"),
        require_mapping(before.get("dropin"), "drop-in beforeimage"),
        uid=config.root_uid,
        gid=config.root_gid,
        allowed_modes={0o644},
        label="drop-in",
    )
    unit_before = read_tx_image(
        tx_dir,
        names.get("unit"),
        require_mapping(before.get("unit"), "unit beforeimage"),
        uid=config.root_uid,
        gid=config.root_gid,
        allowed_modes={0o644},
        label="native unit",
        required=True,
    )
    prior_identity = dict(require_mapping(before.get("systemd"), "systemd beforeimage"))
    assert_prior_service_identity(runtime, prior_identity)
    prior_health = require_mapping(before.get("health"), "health beforeimage")

    current_unit = FileImage.capture(config.unit)
    if current_unit.public() != unit_before.public():
        raise ReleaseError("native unit changed; refusing rollback overwrite")
    current_identity = read_service_identity(runtime)
    assert_preserved_service_shape(prior_identity, current_identity)
    allowed_wd = {prior_identity.get("WorkingDirectory"), receipt.get("release_dir")}
    if current_identity.get("WorkingDirectory") not in allowed_wd:
        raise ReleaseError("buddy.service WorkingDirectory changed outside this transaction")
    allowed_envfiles = {
        tuple(prior_identity.get("EnvironmentFiles", [])),
        (str(config.runtime_env),),
    }
    allowed_dropins = {
        tuple(prior_identity.get("DropInPaths", [])),
        (str(config.dropin),),
    }
    if tuple(current_identity.get("EnvironmentFiles", [])) not in allowed_envfiles:
        raise ReleaseError("buddy.service EnvironmentFiles changed outside this transaction")
    if tuple(current_identity.get("DropInPaths", [])) not in allowed_dropins:
        raise ReleaseError("buddy.service DropInPaths changed outside this transaction")
    assert_current_is_before_or_planned(
        config.dropin,
        dropin_before,
        planned_map.get("dropin") if isinstance(planned_map, Mapping) else None,
        label="drop-in",
    )
    assert_current_is_before_or_planned(
        config.runtime_env,
        runtime_before,
        planned_map.get("runtime_env") if isinstance(planned_map, Mapping) else None,
        label="runtime env",
    )

    stopped_for_rollback = False
    try:
        if stop_first:
            runtime.systemctl(["stop"], service=SERVICE_NAME)
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                state = read_service_identity(runtime)
                if state.get("ActiveState") == "inactive" and int(state.get("MainPID", 0)) == 0:
                    stopped_for_rollback = True
                    break
                time.sleep(1)
            else:
                raise ReleaseError("buddy.service did not become inactive with PID 0 before rollback")

        restore_file(config, config.dropin, dropin_before)
        assert_current_public(config.dropin, dropin_before.public(), label="drop-in")
        restore_file(config, config.runtime_env, runtime_before)
        assert_current_public(config.runtime_env, runtime_before.public(), label="runtime env")
        assert_current_public(config.unit, unit_before.public(), label="native unit")
        runtime.systemctl(["daemon-reload"])
        runtime.systemctl(["start"], service=SERVICE_NAME)
        after_identity = read_service_identity(runtime)
        assert_after_rollback_identity(prior_identity, after_identity)
        after_health = probe_rollback_baseline(runtime, prior_health)
    except Exception:
        if stopped_for_rollback:
            receipt["rollback_fail_closed"] = stop_buddy_fail_closed(runtime)
        raise
    return {
        "phase": "rolled_back",
        "rolled_back_at": utc_now(),
        "rollback_after": {
            "runtime_env": FileImage.capture(config.runtime_env).public(),
            "dropin": FileImage.capture(config.dropin).public(),
            "unit": FileImage.capture(config.unit).public(),
            "systemd": after_identity,
            "health": after_health,
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare, install, or roll back the fixed Buddy OCI release path")
    sub = parser.add_subparsers(dest="command", required=True)

    prepare = sub.add_parser("prepare", help="fresh-clone, build, keyless-probe, and publish a root-owned release tree")
    prepare.add_argument("--sha", required=True)

    install = sub.add_parser("install", help="install an existing fixed-path release tree into buddy.service")
    install.add_argument("--sha", required=True)
    install.add_argument("--expect-runtime-env-sha256", required=True)
    install.add_argument("--expect-dropin-sha256", required=True)
    install.add_argument("--dry-run", action="store_true")

    rollback = sub.add_parser("rollback", help="roll back an interrupted fixed receipt from disk")
    rollback.add_argument("--receipt", required=True, help="receipt basename under /var/lib/buddy/release-receipts")
    return parser


def main(argv: Sequence[str] | None = None, *, runtime: Runtime | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    runtime = runtime or Runtime()
    try:
        runtime.require_root()
        if args.command == "prepare":
            result = prepare_release(args.sha, runtime)
        elif args.command == "install":
            result = install_release(
                args.sha,
                expect_runtime_env_sha256=args.expect_runtime_env_sha256,
                expect_dropin_sha256=args.expect_dropin_sha256,
                dry_run=args.dry_run,
                runtime=runtime,
            )
        elif args.command == "rollback":
            with runtime.lock():
                result = rollback_from_receipt(args.receipt, runtime=runtime)
        else:  # pragma: no cover - argparse prevents this
            raise ReleaseError("unknown command")
    except ReleaseError as exc:
        print(f"buddy release error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
