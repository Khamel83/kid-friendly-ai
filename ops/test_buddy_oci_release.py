import contextlib
import json
import os
import signal
import stat
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from buddy_release_test_support import *

class RuntimeCommandTests(unittest.TestCase):
    def test_timeout_terminates_own_child_process_group(self):
        with temp_path() as tmp:
            pid_file = tmp / "child.pid"
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
    def test_bootstrap_creates_private_state_and_lock_outside_1777_run_lock(self):
        with temp_path() as tmp:
            root = tmp
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

    def test_symlinked_trusted_ancestor_is_refused_before_resolution(self):
        with temp_path() as tmp:
            root = tmp
            make_config(root, bootstrap=False)
            target = root / "opt" / "root-owned-target"
            mkdir(target, 0o755)
            (root / "var" / "lib" / "buddy").symlink_to(target)
            config = make_config(root, bootstrap=False)
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "symlink"):
                with runtime.lock():
                    pass

class SystemdIdentityTests(unittest.TestCase):
    def test_environment_files_parser_preserves_required_and_optional_annotations(self):
        raw = "\n".join(
            [
                "ActiveState=active",
                "EnvironmentFiles=/home/ubuntu/.config/janitor/github-pr-reviewer.env (ignore_errors=no)",
                "/home/ubuntu/.local/state/janitor/github-pr-reviewer/revision.env (ignore_errors=yes)",
                "DropInPaths=/etc/systemd/system/example.service.d/10-release.conf",
            ]
        )
        values = buddy.parse_systemctl_show(raw)
        self.assertEqual(
            buddy.parse_environment_files(values["EnvironmentFiles"]),
            [
                {
                    "path": "/home/ubuntu/.config/janitor/github-pr-reviewer.env",
                    "ignore_errors": False,
                },
                {
                    "path": "/home/ubuntu/.local/state/janitor/github-pr-reviewer/revision.env",
                    "ignore_errors": True,
                },
            ],
        )
        self.assertEqual(
            buddy.extract_systemd_paths(values["DropInPaths"]),
            ("/etc/systemd/system/example.service.d/10-release.conf",),
        )
        with temp_path() as tmp:
            config = make_config(tmp)
            identity = buddy.read_service_identity(
                FakeRuntime(config, shows=[service_show(envfiles=values["EnvironmentFiles"])])
            )
            self.assertEqual(identity["EnvironmentFiles"], buddy.parse_environment_files(values["EnvironmentFiles"]))

    def test_environment_files_parser_rejects_unannotated_malformed_or_unknown_annotations(self):
        bad_values = [
            "/etc/buddy/runtime.env",
            "/etc/buddy/runtime.env (ignore_errors=maybe)",
            "/etc/buddy/runtime.env (required=no)",
            "/etc/buddy/runtime.env (ignore_errors=no) extra",
            "/etc/buddy/runtime.env (ignore_errors=no",
        ]
        for raw in bad_values:
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(buddy.ReleaseError, "EnvironmentFiles"):
                    buddy.parse_environment_files(raw)

    def test_actual_restart_usec_and_sanitized_environment_identity(self):
        with temp_path() as tmp:
            config = make_config(tmp)
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

    def test_prior_identity_requires_configured_fragment_path(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            identity = buddy.read_service_identity(FakeRuntime(config, shows=[service_show(fragment_path="/tmp/other.service")]))
            with self.assertRaisesRegex(buddy.ReleaseError, "FragmentPath"):
                buddy.assert_prior_service_identity(FakeRuntime(config), identity)

    def test_install_identity_requires_one_required_runtime_environment_file(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            prior = buddy.read_service_identity(FakeRuntime(config, shows=[service_show()]))
            after = dict(prior)
            after.update(
                {
                    "WorkingDirectory": str(config.release_root / GOOD_SHA),
                    "MainPID": prior["MainPID"] + 1,
                    "EnvironmentFiles": [{"path": str(config.runtime_env), "ignore_errors": False}],
                    "DropInPaths": [str(config.dropin)],
                }
            )
            buddy.assert_after_install_identity(prior, after, config=config, sha=GOOD_SHA)
            for envfiles in [
                [{"path": str(config.runtime_env), "ignore_errors": True}],
                [
                    {"path": str(config.runtime_env), "ignore_errors": False},
                    {"path": "/tmp/extra.env", "ignore_errors": True},
                ],
            ]:
                with self.subTest(envfiles=envfiles):
                    changed = dict(after)
                    changed["EnvironmentFiles"] = envfiles
                    with self.assertRaisesRegex(buddy.ReleaseError, "runtime env"):
                        buddy.assert_after_install_identity(prior, changed, config=config, sha=GOOD_SHA)

class InstallRollbackTests(unittest.TestCase):
    def test_install_accepts_current_503_memory_false_baseline_and_requires_new_pid(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            runtime.shows = [
                service_show(),
                service_show(),
                service_show(),
                service_show(),
                installed_show(config, pid=2222),
            ]
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE), \
                mock.patch.object(buddy, "probe_post_install", return_value=POST_INSTALL_200):
                result = install_current(config, runtime)
            receipt = json.loads(Path(result["receipt"]).read_text())
            self.assertEqual(receipt["phase"], "installed")
            self.assertFalse(receipt["before"]["health"]["memory"])
            self.assertEqual(receipt["after"]["systemd"]["MainPID"], 2222)
            self.assertEqual(
                receipt["after"]["systemd"]["EnvironmentFiles"],
                [{"path": str(config.runtime_env), "ignore_errors": False}],
            )
            self.assertEqual(
                json.loads(json.dumps(receipt))["after"]["systemd"]["EnvironmentFiles"],
                receipt["after"]["systemd"]["EnvironmentFiles"],
            )
            self.assertNotIn("sk-test-secret", Path(result["receipt"]).read_text())

    def test_install_accepts_native_unit_mode_0600_and_preserves_it_in_receipt(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp, unit_mode=0o600)
            runtime.shows = [
                service_show(),
                service_show(),
                service_show(),
                service_show(),
                installed_show(config, pid=2223),
            ]
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE), \
                mock.patch.object(buddy, "probe_post_install", return_value=POST_INSTALL_200):
                result = install_current(config, runtime)
            receipt = json.loads(Path(result["receipt"]).read_text())
            self.assertEqual(receipt["before"]["unit"]["mode"], "0o600")
            self.assertEqual(receipt["after"]["unit"]["mode"], "0o600")
            self.assertEqual(stat.S_IMODE(config.unit.lstat().st_mode), 0o600)

    def test_post_write_install_failure_rolls_back_with_native_unit_0600_unchanged(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp, unit_mode=0o600)
            original_runtime = config.runtime_env.read_bytes()
            original_dropin = config.dropin.read_bytes()
            original_unit = config.unit.read_bytes()
            original_unit_mode = stat.S_IMODE(config.unit.lstat().st_mode)
            runtime.shows = [
                service_show(),
                service_show(),
                service_show(),
                service_show(),
                installed_show(config, pid=2224),
                installed_show(config, pid=2224),
                inactive_show(wd=str(config.release_root / GOOD_SHA)),
                service_show(pid=1304),
            ]
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE), \
                mock.patch.object(buddy, "probe_post_install", side_effect=buddy.ReleaseError("simulated post-write failure")), \
                mock.patch.object(buddy, "probe_rollback_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaisesRegex(buddy.ReleaseError, "simulated post-write failure"):
                    install_current(config, runtime)
            receipts = list(config.receipt_root.glob("*.json"))
            self.assertEqual(len(receipts), 1)
            receipt = json.loads(receipts[0].read_text())
            self.assertEqual(receipt["phase"], "rolled_back")
            self.assertEqual(receipt["rollback_after"]["unit"]["mode"], "0o600")
            self.assertEqual(config.runtime_env.read_bytes(), original_runtime)
            self.assertEqual(config.dropin.read_bytes(), original_dropin)
            self.assertEqual(config.unit.read_bytes(), original_unit)
            self.assertEqual(stat.S_IMODE(config.unit.lstat().st_mode), original_unit_mode)

    def test_unsafe_native_unit_mode_rejects_before_intent_stop_or_write(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp, unit_mode=0o664)
            original_runtime = config.runtime_env.read_text()
            original_dropin = config.dropin.read_text()
            with self.assertRaisesRegex(buddy.ReleaseError, "native unit beforeimage mode is not allowed"):
                install_current(config, runtime)
            self.assertEqual(config.runtime_env.read_text(), original_runtime)
            self.assertEqual(config.dropin.read_text(), original_dropin)
            self.assertEqual(list(config.receipt_root.glob("*.json")), [])
            self.assertEqual(list(config.transaction_root.iterdir()), [])
            self.assertEqual(runtime.calls, [])

    def test_dry_run_leaves_no_receipt_or_transaction(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                result = install_current(config, runtime, dry_run=True)
            self.assertEqual(result["status"], "dry_run_complete")
            self.assertEqual(list(config.receipt_root.glob("*.json")), [])
            self.assertEqual(list(config.transaction_root.iterdir()), [])

    def test_prior_nonterminal_intent_blocks_new_install(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="intent")
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaisesRegex(buddy.ReleaseError, "prior nonterminal"):
                    install_current(config, runtime)
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "intent")

    def test_unknown_receipt_phase_blocks_new_install(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="intent")
            receipt = json.loads(receipt_path.read_text())
            receipt["phase"] = "mystery"
            buddy.write_receipt(config, receipt_path, receipt)
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaisesRegex(buddy.ReleaseError, "unknown phase"):
                    install_current(config, runtime)

    def test_effective_identity_drift_before_mutation_does_not_stop_service(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            runtime.shows = [service_show(), service_show(user="other")]
            original_runtime = config.runtime_env.read_text()
            with mock.patch.object(buddy, "probe_degraded_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                with self.assertRaises(buddy.ReleaseError):
                    install_current(config, runtime)
            self.assertEqual(config.runtime_env.read_text(), original_runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))

    def test_disk_only_rollback_after_runtime_env_write_restores_before_files(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [service_show(), inactive_show(), service_show(pid=1300)]
            with mock.patch.object(buddy, "probe_rollback_baseline", return_value=BASELINE_503_MEMORY_FALSE):
                result = buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertEqual(result["status"], "rolled_back")
            self.assertEqual(config.runtime_env.read_text(), "OPENROUTER_API_KEY=old\n")
            self.assertEqual(config.dropin.read_text(), "[Service]\nWorkingDirectory=/old\n")

    def test_disk_only_rollback_after_dropin_write_restores_before_files(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
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

    def test_corrupt_beforeimage_fails_before_stop_and_marks_rollback_failed(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            tx_id = receipt_path.name.removesuffix(".json")
            write_file(config.transaction_root / tx_id / "runtime.env.before", "corrupt\n", 0o600)
            with self.assertRaisesRegex(buddy.ReleaseError, "beforeimage bytes"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "rollback_failed")

    def test_corrupt_beforeimage_metadata_fails_before_stop(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            receipt = json.loads(receipt_path.read_text())
            receipt["before"]["runtime_env"]["mode"] = "0o777"
            buddy.write_receipt(config, receipt_path, receipt)
            with self.assertRaisesRegex(buddy.ReleaseError, "mode"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))
            self.assertEqual(json.loads(receipt_path.read_text())["phase"], "rollback_failed")

    def test_unknown_peer_file_change_is_preserved_before_stop(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=peer\n", 0o600)
            with self.assertRaisesRegex(buddy.ReleaseError, "outside this transaction"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertEqual(config.runtime_env.read_text(), "OPENROUTER_API_KEY=peer\n")
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))

    def test_rollback_rejects_runtime_env_optional_flag_mismatch_before_stop(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="dropin_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            write_file(config.dropin, "[Service]\nWorkingDirectory=/new\n", 0o644)
            runtime.shows = [
                service_show(
                    wd=str(config.release_root / GOOD_SHA),
                    envfiles=environment_file(config.runtime_env, ignore_errors=True),
                    dropins=str(config.dropin),
                ),
            ]
            with self.assertRaisesRegex(buddy.ReleaseError, "EnvironmentFiles changed"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            self.assertFalse(any(call[1:2] == ["stop"] for call in runtime.calls))

    def test_rollback_readback_mismatch_fails_after_restore_attempt(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
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

    def test_rollback_requires_positive_pid_after_start(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
            receipt_path = create_interrupted_receipt(config, phase="runtime_env_written")
            write_file(config.runtime_env, "OPENROUTER_API_KEY=new\n", 0o600)
            runtime.shows = [service_show(), inactive_show(), service_show(pid=0), inactive_show()]
            with self.assertRaisesRegex(buddy.ReleaseError, "MainPID"):
                buddy.rollback_from_receipt(receipt_path.name, runtime=runtime)
            receipt = json.loads(receipt_path.read_text())
            self.assertEqual(receipt["phase"], "rollback_failed")
            self.assertEqual(receipt["rollback_fail_closed"]["final_state"]["MainPID"], 0)

    def test_rollback_wrong_started_identity_stops_and_records_final_state(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
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

    def test_rollback_fail_closed_stop_failure_is_recorded(self):
        with temp_path() as tmp:
            config, runtime = write_install_fixture(tmp)
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
