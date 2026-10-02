"""Systemd identity, probe, receipt, and transaction helpers for Buddy releases."""

from __future__ import annotations

import contextlib
import errno
import json
import os
import re
import shlex
import stat
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Mapping

from buddy_release_primitives import (
    EXPECTED_ENVIRONMENT,
    EXPECTED_EXEC_ARGV,
    EXPECTED_EXEC_PATH,
    LOOPBACK_BASE_URL,
    MAX_ENV_BYTES,
    MAX_HTTP_BODY,
    NONTERMINAL_PHASES,
    SENSITIVE_NAME_RE,
    SERVICE_NAME,
    TERMINAL_PHASES,
    TIMEOUTS,
    TX_ID_RE,
    ReleaseConfig,
    ReleaseError,
    FileImage,
    Runtime,
    assert_regular_file,
    assert_trusted_dir,
    atomic_write_config,
    fsync_dir,
    require_mapping,
    sha256_bytes,
    utc_now,
    validate_sha,
)

def dropin_content(release_dir: Path, runtime_env: Path) -> bytes:
    return (
        "[Service]\n"
        f"WorkingDirectory={release_dir}\n"
        f"EnvironmentFile={runtime_env}\n"
    ).encode()


def parse_systemctl_show(raw: str) -> dict[str, str]:
    values: dict[str, str] = {}
    current_key: str | None = None
    for line in raw.splitlines():
        if re.match(r"^[A-Za-z][A-Za-z0-9]*=", line):
            key, value = line.split("=", 1)
            values[key] = value
            current_key = key
        elif current_key == "EnvironmentFiles":
            values[current_key] = f"{values[current_key]}\n{line}" if values[current_key] else line
    return values


def parse_environment_files(raw: str | None) -> list[dict[str, object]]:
    if not raw:
        return []
    entries: list[dict[str, object]] = []
    for line in raw.splitlines():
        match = re.fullmatch(r"(?P<path>/\S*) \(ignore_errors=(?P<ignore_errors>yes|no)\)", line)
        if not match:
            raise ReleaseError("buddy.service EnvironmentFiles entry is unsupported")
        entries.append(
            {
                "path": match.group("path"),
                "ignore_errors": match.group("ignore_errors") == "yes",
            }
        )
    return entries


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
            assignments = shlex.split(raw)
        except ValueError as exc:
            raise ReleaseError("buddy.service environment is unsupported") from exc
        values = {}
        for assignment in assignments:
            if "=" not in assignment:
                raise ReleaseError("buddy.service environment is unsupported")
            key, value = assignment.split("=", 1)
            if key not in EXPECTED_ENVIRONMENT:
                if SENSITIVE_NAME_RE.search(key):
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


def required_environment_file(path: Path) -> dict[str, object]:
    return {"path": str(path), "ignore_errors": False}


def environment_file_identity(entries: object) -> tuple[tuple[str, bool], ...]:
    if not isinstance(entries, list):
        raise ReleaseError("buddy.service EnvironmentFiles shape is unsupported")
    normalized: list[tuple[str, bool]] = []
    for entry in entries:
        if not isinstance(entry, Mapping):
            raise ReleaseError("buddy.service EnvironmentFiles shape is unsupported")
        if (
            set(entry) != {"path", "ignore_errors"}
            or not isinstance(entry.get("path"), str)
            or not isinstance(entry.get("ignore_errors"), bool)
        ):
            raise ReleaseError("buddy.service EnvironmentFiles shape is unsupported")
        normalized.append((entry["path"], entry["ignore_errors"]))
    return tuple(normalized)


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
        "EnvironmentFiles": parse_environment_files(values.get("EnvironmentFiles")),
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
    if after.get("EnvironmentFiles") != [required_environment_file(config.runtime_env)]:
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
