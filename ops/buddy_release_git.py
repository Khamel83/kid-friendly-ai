"""Git source-copy verification for the Buddy OCI release helper."""

from __future__ import annotations

import contextlib
import errno
import hashlib
import json
import os
import re
import stat
from pathlib import Path
from typing import Iterator, Mapping, Protocol, Sequence


BIN = {
    "git": "/usr/bin/git",
}

TIMEOUTS = {
    "git": 180,
}

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SENSITIVE_NAME_TERMS = ("API_KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")
SENSITIVE_NAME_RE = re.compile("(" + "|".join(SENSITIVE_NAME_TERMS) + ")", re.I)

MINIMAL_GIT_CONFIG = b"""[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = false
\tlogallrefupdates = false
\tsymlinks = true
"""

SOURCE_ENV_EXAMPLE_PATHS = {".env.example", ".env.docker.example", ".env.local.example"}
NEXT_14_VERSION = "14.0.4"
NEXT_ENV_DECLARATION_PATH = "next-env.d.ts"
NEXT_ENV_DECLARATION_MAX_BYTES = 1024
NEXT_14_0_4_NEXT_ENV_D_TS = (
    b'/// <reference types="next" />\n'
    b'/// <reference types="next/image-types/global" />\n'
    b'\n'
    b'// NOTE: This file should not be edited\n'
    b'// see https://nextjs.org/docs/basic-features/typescript for more information.\n'
)


class GitVerificationError(RuntimeError):
    """Git copy verification failed."""


class ReleaseConfigLike(Protocol):
    root_uid: int
    root_gid: int


class RuntimeLike(Protocol):
    config: ReleaseConfigLike

    def run(
        self,
        cmd: Sequence[str],
        *,
        cwd: Path | None = None,
        env: Mapping[str, str] | None = None,
        timeout: int,
    ) -> str:
        ...

    def run_as_service_user(self, cmd: Sequence[str], *, cwd: Path, env: Mapping[str, str], timeout: int) -> str:
        ...


def validate_sha(value: str) -> str:
    if not SHA_RE.fullmatch(value):
        raise GitVerificationError("release SHA must be a lowercase 40-character Git SHA")
    return value


def safe_command(cmd: Sequence[str]) -> str:
    safe_parts: list[str] = []
    for part in cmd:
        if "=" in part and SENSITIVE_NAME_RE.search(part.split("=", 1)[0]):
            key = part.split("=", 1)[0]
            safe_parts.append(f"{key}=<redacted>")
        else:
            safe_parts.append(Path(part).name if part.startswith("/") else part)
    return " ".join(safe_parts)


def env_assignments(env: Mapping[str, str]) -> list[str]:
    return [f"{key}={value}" for key, value in sorted(env.items())]


def sanitized_build_env(user_home: str) -> dict[str, str]:
    leaked = sorted(k for k in os.environ if SENSITIVE_NAME_RE.search(k))
    if leaked:
        raise GitVerificationError("refusing ambient secret-bearing build environment keys")
    return {
        "HOME": user_home,
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "npm_config_audit": "false",
        "npm_config_fund": "false",
    }


def assert_trusted_dir(path: Path, *, uid: int, label: str = "directory", exact_mode: int | None = None) -> None:
    try:
        st = path.lstat()
    except FileNotFoundError as exc:
        raise GitVerificationError(f"{label} is missing: {path}") from exc
    if stat.S_ISLNK(st.st_mode):
        raise GitVerificationError(f"{label} is a symlink: {path}")
    if not stat.S_ISDIR(st.st_mode):
        raise GitVerificationError(f"{label} is not a directory: {path}")
    if st.st_uid != uid:
        raise GitVerificationError(f"{label} uid is {st.st_uid}, expected {uid}: {path}")
    actual_mode = stat.S_IMODE(st.st_mode)
    if exact_mode is not None and actual_mode != exact_mode:
        raise GitVerificationError(f"{label} mode is {oct(actual_mode)}, expected {oct(exact_mode)}: {path}")
    if actual_mode & 0o022:
        raise GitVerificationError(f"{label} is group/world writable: {path}")


def assert_regular_file(path: Path, *, uid: int, mode: int | None, label: str, single_link: bool = False) -> None:
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode):
        raise GitVerificationError(f"{label} is a symlink: {path}")
    if not stat.S_ISREG(st.st_mode):
        raise GitVerificationError(f"{label} is not a regular file: {path}")
    if st.st_uid != uid:
        raise GitVerificationError(f"{label} uid is {st.st_uid}, expected {uid}: {path}")
    actual_mode = stat.S_IMODE(st.st_mode)
    if mode is not None and actual_mode != mode:
        raise GitVerificationError(f"{label} mode is {oct(actual_mode)}, expected {oct(mode)}: {path}")
    if actual_mode & 0o022:
        raise GitVerificationError(f"{label} is group/world writable: {path}")
    if single_link and st.st_nlink != 1:
        raise GitVerificationError(f"{label} must be single-link: {path}")


def fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def fsync_parent(path: Path) -> None:
    fsync_dir(path.parent)


def git_blob_id(data: bytes) -> str:
    payload = b"blob " + str(len(data)).encode() + b"\0" + data
    return hashlib.sha1(payload).hexdigest()


def chmod_tree_for_cleanup(root: Path) -> None:
    try:
        root_st = root.lstat()
    except FileNotFoundError:
        return
    if stat.S_ISLNK(root_st.st_mode):
        return
    for current, dirnames, filenames in os.walk(root, topdown=False, followlinks=False):
        current_path = Path(current)
        for name in filenames:
            path = current_path / name
            with contextlib.suppress(FileNotFoundError):
                st = path.lstat()
                if not stat.S_ISLNK(st.st_mode):
                    os.chmod(path, 0o600)
        for name in dirnames:
            path = current_path / name
            with contextlib.suppress(FileNotFoundError):
                st = path.lstat()
                if not stat.S_ISLNK(st.st_mode):
                    os.chmod(path, 0o700)
        with contextlib.suppress(FileNotFoundError):
            st = current_path.lstat()
            if not stat.S_ISLNK(st.st_mode):
                os.chmod(current_path, 0o700)


def write_minimal_git_config(config_path: Path, *, uid: int, gid: int) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(config_path, flags, 0o644)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise GitVerificationError("copied Git config is not a regular file")
        if st.st_nlink != 1:
            raise GitVerificationError("copied Git config must be single-link")
        try:
            os.fchown(fd, uid, gid)
        except PermissionError:
            if os.geteuid() == 0:
                raise
        os.fchmod(fd, 0o644)
        os.write(fd, MINIMAL_GIT_CONFIG)
        os.fsync(fd)
    finally:
        os.close(fd)
    assert_regular_file(config_path, uid=uid, mode=0o644, label="copied Git config", single_link=True)
    if config_path.read_bytes() != MINIMAL_GIT_CONFIG:
        raise GitVerificationError("copied Git config was not replaced with the minimal trusted config")
    fsync_parent(config_path)


def validate_copied_git_metadata_entry(path: Path, *, git_dir: Path, uid: int) -> bool:
    rel = path.relative_to(git_dir).as_posix()
    if rel in {"commondir", "gitdir", "worktree", "objects/info/alternates"}:
        raise GitVerificationError("copied Git repository uses unsupported metadata indirection")
    st = path.lstat()
    if stat.S_ISLNK(st.st_mode):
        raise GitVerificationError(f"copied Git metadata is a symlink: {rel}")
    if st.st_uid != uid:
        raise GitVerificationError(f"copied Git metadata uid is {st.st_uid}, expected {uid}: {rel}")
    actual_mode = stat.S_IMODE(st.st_mode)
    if actual_mode & 0o022:
        raise GitVerificationError(f"copied Git metadata is group/world writable: {rel}")
    if stat.S_ISDIR(st.st_mode):
        return True
    if stat.S_ISREG(st.st_mode):
        if st.st_nlink != 1:
            raise GitVerificationError(f"copied Git metadata must be single-link: {rel}")
        return False
    raise GitVerificationError(f"copied Git metadata is not a regular file or directory: {rel}")


def validate_copied_git_metadata(git_dir: Path, *, uid: int, gid: int) -> None:
    assert_trusted_dir(git_dir, uid=uid, label="copied Git directory")
    stack = [git_dir]
    while stack:
        current = stack.pop()
        for entry in current.iterdir():
            if validate_copied_git_metadata_entry(entry, git_dir=git_dir, uid=uid):
                stack.append(entry)
    assert_trusted_dir(git_dir / "objects", uid=uid, label="copied Git object directory")
    write_minimal_git_config(git_dir / "config", uid=uid, gid=gid)


def isolated_git_env() -> dict[str, str]:
    return {
        "GIT_ASKPASS": "/bin/false",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_NO_REPLACE_OBJECTS": "1",
        "GIT_OPTIONAL_LOCKS": "0",
        "GIT_TERMINAL_PROMPT": "0",
        "HOME": "/nonexistent",
        "PATH": "/usr/bin:/bin",
        "SSH_ASKPASS": "/bin/false",
        "XDG_CONFIG_HOME": "/nonexistent",
    }


def isolated_git_cmd(*args: str) -> list[str]:
    return [
        BIN["git"],
        "--no-optional-locks",
        "-c",
        "credential.helper=",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "diff.external=",
        *args,
    ]


def run_isolated_git(runtime: RuntimeLike, repo: Path, *args: str) -> str:
    return runtime.run(
        isolated_git_cmd(*args),
        cwd=repo,
        env=isolated_git_env(),
        timeout=TIMEOUTS["git"],
    )


def parse_ls_tree(output: str) -> list[tuple[str, str, str, str]]:
    entries: list[tuple[str, str, str, str]] = []
    for raw_entry in output.split("\0"):
        if not raw_entry:
            continue
        try:
            meta, rel = raw_entry.split("\t", 1)
            mode, kind, object_id = meta.split(" ", 2)
        except ValueError as exc:
            raise GitVerificationError("Git tree listing is malformed") from exc
        rel_path = Path(rel)
        if rel_path.is_absolute() or ".." in rel_path.parts or rel == "":
            raise GitVerificationError("Git tree contains an unsafe path")
        entries.append((mode, kind, object_id, rel))
    return entries


def validate_copied_release_against_git_tree(release_dir: Path, *, sha: str, runtime: RuntimeLike) -> str:
    sha = validate_sha(sha)
    git_dir = release_dir / ".git"
    validate_copied_git_metadata(git_dir, uid=runtime.config.root_uid, gid=runtime.config.root_gid)
    actual = run_isolated_git(runtime, release_dir, "rev-parse", f"{sha}^{{commit}}")
    if actual != sha:
        raise GitVerificationError("copied Git repository does not contain the requested commit")
    run_isolated_git(runtime, release_dir, "fsck", "--strict", "--full", "--no-progress", sha)
    tree_output = run_isolated_git(runtime, release_dir, "ls-tree", "-rz", "-r", "--full-tree", sha)
    for expected_mode, kind, expected_object, rel in parse_ls_tree(tree_output):
        path = release_dir / rel
        if kind != "blob":
            raise GitVerificationError("release source tree contains unsupported non-blob entry")
        try:
            st = path.lstat()
        except FileNotFoundError as exc:
            raise GitVerificationError("tracked source file is missing from copied release") from exc
        if expected_mode == "120000":
            if not stat.S_ISLNK(st.st_mode):
                raise GitVerificationError("tracked source mode does not match requested Git tree")
            actual_object = git_blob_id(os.readlink(path).encode())
        elif expected_mode in {"100644", "100755"}:
            if not stat.S_ISREG(st.st_mode):
                raise GitVerificationError("tracked source mode does not match requested Git tree")
            executable = bool(stat.S_IMODE(st.st_mode) & 0o111)
            if executable != (expected_mode == "100755"):
                raise GitVerificationError("tracked source mode does not match requested Git tree")
            actual_object = git_blob_id(path.read_bytes())
        else:
            raise GitVerificationError("release source tree contains unsupported tracked mode")
        if actual_object != expected_object:
            raise GitVerificationError("tracked source file does not match requested Git tree")
    return actual


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
            raise GitVerificationError(f"refusing source with local env file: {rel}")


def load_json_file(path: Path, *, label: str) -> object:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise GitVerificationError(f"generated next-env.d.ts requires {label}") from exc
    except json.JSONDecodeError as exc:
        raise GitVerificationError(f"generated next-env.d.ts requires valid {label}") from exc


def mapping_value(data: object, key: str) -> object:
    if isinstance(data, Mapping):
        return data.get(key)
    return None


def source_has_locked_next14_declaration_inputs(source: Path) -> bool:
    package_json = load_json_file(source / "package.json", label="package.json")
    dependencies = mapping_value(package_json, "dependencies")
    dev_dependencies = mapping_value(package_json, "devDependencies")
    declared_next = None
    if isinstance(dependencies, Mapping):
        declared_next = dependencies.get("next")
    if declared_next is None and isinstance(dev_dependencies, Mapping):
        declared_next = dev_dependencies.get("next")

    package_lock = load_json_file(source / "package-lock.json", label="package-lock.json")
    packages = mapping_value(package_lock, "packages")
    root_lock = mapping_value(packages, "") if isinstance(packages, Mapping) else None
    root_dependencies = mapping_value(root_lock, "dependencies")
    locked_next = root_dependencies.get("next") if isinstance(root_dependencies, Mapping) else None
    next_package = mapping_value(packages, "node_modules/next") if isinstance(packages, Mapping) else None
    locked_next_version = mapping_value(next_package, "version")

    tsconfig = load_json_file(source / "tsconfig.json", label="tsconfig.json")
    include = mapping_value(tsconfig, "include")
    includes_next_env = isinstance(include, list) and NEXT_ENV_DECLARATION_PATH in include
    return (
        declared_next == NEXT_14_VERSION
        and locked_next == NEXT_14_VERSION
        and locked_next_version == NEXT_14_VERSION
        and includes_next_env
    )


def next_env_leaf_state(st: os.stat_result) -> tuple[int, int, int, int]:
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns)


def assert_safe_next_env_leaf(st: os.stat_result) -> None:
    if stat.S_ISLNK(st.st_mode):
        raise GitVerificationError("generated next-env.d.ts is a symlink")
    if not stat.S_ISREG(st.st_mode):
        raise GitVerificationError("generated next-env.d.ts is not a regular file")
    if st.st_nlink != 1:
        raise GitVerificationError("generated next-env.d.ts must be single-link")
    if st.st_size > NEXT_ENV_DECLARATION_MAX_BYTES:
        raise GitVerificationError("generated next-env.d.ts is too large")


def assert_same_next_env_leaf(expected: os.stat_result, actual: os.stat_result) -> None:
    if next_env_leaf_state(expected) != next_env_leaf_state(actual):
        raise GitVerificationError("generated next-env.d.ts changed during safe read")


def validate_generated_next_env_declaration(source: Path) -> None:
    if not source_has_locked_next14_declaration_inputs(source):
        raise GitVerificationError("generated next-env.d.ts is not from the locked Next 14.0.4 source")
    path = source / NEXT_ENV_DECLARATION_PATH
    try:
        before_name = path.lstat()
    except FileNotFoundError as exc:
        raise GitVerificationError("generated next-env.d.ts is missing") from exc
    assert_safe_next_env_leaf(before_name)
    flags = os.O_RDONLY | required_open_flag("O_NOFOLLOW") | required_open_flag("O_NONBLOCK")
    try:
        fd = os.open(path, flags)
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            raise GitVerificationError("generated next-env.d.ts is a symlink") from exc
        raise GitVerificationError("generated next-env.d.ts cannot be opened safely") from exc
    try:
        before_fd = os.fstat(fd)
        assert_safe_next_env_leaf(before_fd)
        assert_same_next_env_leaf(before_name, before_fd)
        data = os.read(fd, NEXT_ENV_DECLARATION_MAX_BYTES + 1)
        after_fd = os.fstat(fd)
        assert_safe_next_env_leaf(after_fd)
        assert_same_next_env_leaf(before_fd, after_fd)
        try:
            after_name = path.lstat()
        except FileNotFoundError as exc:
            raise GitVerificationError("generated next-env.d.ts changed during safe read") from exc
        assert_safe_next_env_leaf(after_name)
        assert_same_next_env_leaf(before_fd, after_name)
    finally:
        os.close(fd)
    if len(data) > NEXT_ENV_DECLARATION_MAX_BYTES:
        raise GitVerificationError("generated next-env.d.ts is too large")
    if data != NEXT_14_0_4_NEXT_ENV_D_TS:
        raise GitVerificationError("generated next-env.d.ts does not match the Next 14.0.4 canonical declaration")


def required_open_flag(name: str) -> int:
    value = getattr(os, name, None)
    if not isinstance(value, int) or value == 0:
        raise GitVerificationError(f"generated next-env.d.ts requires {name} support")
    return value


def generated_next_env_declaration_present(source: Path) -> bool:
    try:
        (source / NEXT_ENV_DECLARATION_PATH).lstat()
    except FileNotFoundError:
        return False
    return True


def assert_copied_generated_next_env_declaration(copied_release: Path, *, expected_present: bool) -> None:
    actual_present = generated_next_env_declaration_present(copied_release)
    if actual_present != expected_present:
        state = "missing" if expected_present else "unexpected"
        raise GitVerificationError(f"generated next-env.d.ts is {state} in the root-copied release")
    if actual_present:
        validate_generated_next_env_declaration(copied_release)


def source_has_untracked_next_env_declaration(runtime: RuntimeLike, source: Path, env: Mapping[str, str]) -> bool:
    try:
        (source / NEXT_ENV_DECLARATION_PATH).lstat()
    except FileNotFoundError:
        return False
    tracked = runtime.run_as_service_user(
        [BIN["git"], "ls-files", "--cached", "--", NEXT_ENV_DECLARATION_PATH],
        cwd=source,
        env=env,
        timeout=TIMEOUTS["git"],
    )
    return NEXT_ENV_DECLARATION_PATH not in tracked.splitlines()


def inspect_prepare_git_state(
    runtime: RuntimeLike,
    source: Path,
    *,
    env: Mapping[str, str],
    sha: str,
    default_branch: str,
    allow_build_outputs: bool,
) -> tuple[str, bool]:
    default_ref = runtime.run_as_service_user([BIN["git"], "symbolic-ref", "refs/remotes/origin/HEAD"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if default_ref.rsplit("/", 1)[-1] != default_branch:
        raise GitVerificationError("fetched default branch changed during prepare")
    default_sha = runtime.run_as_service_user([BIN["git"], "rev-parse", f"origin/{default_branch}"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if default_sha != sha:
        raise GitVerificationError("requested SHA is no longer the fetched default branch")
    head_sha = runtime.run_as_service_user([BIN["git"], "rev-parse", "HEAD"], cwd=source, env=env, timeout=TIMEOUTS["git"])
    if head_sha != sha:
        raise GitVerificationError("checked-out source SHA changed during prepare")
    status = runtime.run_as_service_user(
        [BIN["git"], "status", "--porcelain", "--ignored=matching", "--untracked-files=all"],
        cwd=source,
        env=env,
        timeout=TIMEOUTS["git"],
    )
    unexpected: list[str] = []
    next_env_status_seen = False
    next_env_declaration_present = False
    for line in status.splitlines():
        if len(line) < 4:
            unexpected.append(line)
            continue
        code = line[:2]
        rel = line[3:]
        if allow_build_outputs and code == "!!" and (rel == ".next/" or rel.startswith(".next/") or rel == "node_modules/" or rel.startswith("node_modules/")):
            continue
        if allow_build_outputs and code == "!!" and rel == NEXT_ENV_DECLARATION_PATH:
            next_env_status_seen = True
            next_env_declaration_present = True
            validate_generated_next_env_declaration(source)
            continue
        unexpected.append(line)
    if not next_env_status_seen and source_has_untracked_next_env_declaration(runtime, source, env):
        next_env_declaration_present = True
        if allow_build_outputs:
            validate_generated_next_env_declaration(source)
        else:
            unexpected.append(f"?? {NEXT_ENV_DECLARATION_PATH}")
    if unexpected:
        raise GitVerificationError("source checkout changed during prepare")
    return head_sha, next_env_declaration_present


def assert_prepare_git_state(
    runtime: RuntimeLike,
    source: Path,
    *,
    env: Mapping[str, str],
    sha: str,
    default_branch: str,
    allow_build_outputs: bool,
) -> str:
    head_sha, _next_env_declaration_present = inspect_prepare_git_state(
        runtime,
        source,
        env=env,
        sha=sha,
        default_branch=default_branch,
        allow_build_outputs=allow_build_outputs,
    )
    return head_sha
