#!/usr/bin/env python3
"""Bounded Buddy OCI release CLI.

The public operator entry point stays in this file. The reviewed release helper
also requires the colocated buddy_release_primitives.py and
buddy_release_state.py modules.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Mapping, Sequence

from buddy_release_primitives import (
    BIN,
    EXPECTED_ENVIRONMENT,
    NONTERMINAL_PHASES,
    SERVICE_NAME,
    TERMINAL_PHASES,
    TIMEOUTS,
    FileImage,
    ReleaseConfig,
    ReleaseError,
    Runtime,
    absolute_lexical,
    artifact_digest,
    assert_expected_beforeimage,
    assert_prepare_git_state,
    assert_regular_file,
    assert_trusted_dir,
    assert_trusted_hierarchy,
    assert_trusted_parent_for_create,
    atomic_write,
    atomic_write_config,
    bootstrap_release_roots,
    chmod_release_tree,
    env_assignments,
    env_path_allowed_in_artifact,
    fsync_dir,
    fsync_tree,
    parse_env_bytes,
    parse_env_file,
    parse_probe_output,
    prepare_release,
    path_chain,
    projected_runtime_env,
    read_private_source_env,
    render_runtime_env,
    require_mapping,
    restore_file,
    safe_command,
    sanitized_build_env,
    sha256_bytes,
    sha256_file,
    tree_entries,
    utc_now,
    validate_manifest_schema,
    validate_probe_fields,
    validate_release_tree,
    validate_sha,
    validate_source_env_policy,
    write_manifest,
)
from buddy_release_state import (
    assert_after_install_identity,
    assert_after_rollback_identity,
    assert_current_image,
    assert_current_is_before_or_planned,
    assert_current_public,
    assert_no_nonterminal_receipts,
    assert_peer_service_unchanged,
    assert_pre_mutation_state,
    assert_preserved_service_shape,
    assert_prior_service_identity,
    copy_beforeimage_bytes,
    create_transaction,
    current_public_image,
    dropin_content,
    extract_systemd_paths,
    load_receipt,
    parse_environment,
    parse_exec_start,
    parse_main_pid,
    parse_public_mode,
    parse_systemctl_show,
    planned_public_image,
    probe_degraded_baseline,
    probe_loopback_health,
    probe_post_install,
    probe_rollback_baseline,
    proxy_disabled_opener,
    read_http_json,
    read_http_status,
    read_service_identity,
    read_tx_image,
    receipt_path_for,
    scrub_for_receipt,
    validate_public_file_image,
    validate_receipt_name,
    validate_tx_file_name,
    validate_tx_id,
    write_json_file,
    write_receipt,
)

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
