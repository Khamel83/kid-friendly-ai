import json
import os
import shutil
import stat
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from buddy_release_test_support import *

class SourceAndManifestTests(unittest.TestCase):
    def test_next14_declaration_constant_matches_actual_generator_output_literal(self):
        real_next14_output = (
            b'/// <reference types="next" />\n'
            b'/// <reference types="next/image-types/global" />\n'
            b'\n'
            b'// NOTE: This file should not be edited\n'
            b'// see https://nextjs.org/docs/basic-features/typescript for more information.\n'
        )

        self.assertEqual(primitives.release_git.NEXT_14_0_4_NEXT_ENV_D_TS, real_next14_output)
        self.assertEqual(NEXT_14_0_4_NEXT_ENV_D_TS, real_next14_output)

    def test_env_policy_allows_only_reviewed_examples_and_dependency_fixtures(self):
        with temp_path() as tmp:
            source = tmp / "source"
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

    def test_prepare_flow_uses_user_build_stage_then_root_publication_with_examples(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            calls = []

            def install_fixture_env(cwd):
                mkdir(cwd / "node_modules" / "fixture", 0o755)
                write_file(cwd / "node_modules" / "fixture" / ".env", "fixture=true\n", 0o644)

            fake_run_as_user = PrepareRunAsUser(record_calls=calls, npm_ci=install_fixture_env)

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                tmp,
                copied_ok(),
            ):
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

    def test_prepare_rejects_tracked_mutation_after_fake_build(self):
        with temp_path() as tmp:
            config = make_config(tmp)

            def install_fixture(cwd):
                mkdir(cwd / "node_modules" / "fixture", 0o755)

            def mutate_package_during_build(cwd):
                write_file(cwd / "package.json", '{"changed":true}\n', 0o644)
                mkdir(cwd / ".next", 0o755)
                write_file(cwd / ".next" / "BUILD_ID", "build-1\n", 0o644)

            fake_run_as_user = PrepareRunAsUser(
                status_outputs=["", " M package.json\n!! .next/\n!! node_modules/\n"],
                npm_ci=install_fixture,
                build=mutate_package_during_build,
            )

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                tmp,
                copied_ok(),
            ):
                with self.assertRaisesRegex(buddy.ReleaseError, "source checkout changed"):
                    buddy.prepare_release(GOOD_SHA, runtime)
            self.assertEqual(list(config.release_root.glob(GOOD_SHA)), [])

    def test_prepare_git_state_accepts_real_ignored_next_env_after_build_only(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            write_file(source / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}
            runtime = GitStateRuntime()

            with self.assertRaisesRegex(buddy.ReleaseError, "source checkout changed"):
                primitives.assert_prepare_git_state(
                    runtime,
                    source,
                    env=env,
                    sha=sha,
                    default_branch="main",
                    allow_build_outputs=False,
                )
            self.assertEqual(
                primitives.assert_prepare_git_state(
                    runtime,
                    source,
                    env=env,
                    sha=sha,
                    default_branch="main",
                    allow_build_outputs=True,
                ),
                sha,
            )

    def test_prepare_git_state_accepts_absent_next_env_after_build(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}

            self.assertEqual(
                primitives.assert_prepare_git_state(
                    GitStateRuntime(),
                    source,
                    env=env,
                    sha=sha,
                    default_branch="main",
                    allow_build_outputs=True,
                ),
                sha,
            )

    def test_prepare_git_state_rejects_malformed_ignored_next_env(self):
        cases = [
            b"declare const anything: string;\n",
            b"OPENAI_API_KEY=sk-test\n",
            NEXT_14_0_4_NEXT_ENV_D_TS + b"declare const extra: string;\n",
        ]
        for data in cases:
            with self.subTest(data=data[:24]):
                with temp_path() as tmp:
                    source, sha = make_git_state_source(tmp)
                    write_file(source / "next-env.d.ts", data, 0o644)
                    env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}

                    with self.assertRaisesRegex(buddy.ReleaseError, "next-env\\.d\\.ts"):
                        primitives.assert_prepare_git_state(
                            GitStateRuntime(),
                            source,
                            env=env,
                            sha=sha,
                            default_branch="main",
                            allow_build_outputs=True,
                        )

    def test_prepare_git_state_opens_next_env_with_nofollow_nonblock(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            generated = source / "next-env.d.ts"
            write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}
            seen_flags = []
            real_open = os.open

            def capture_open(path, flags, *args, **kwargs):
                if Path(path) == generated:
                    seen_flags.append(flags)
                return real_open(path, flags, *args, **kwargs)

            with mock.patch.object(primitives.os, "open", side_effect=capture_open):
                self.assertEqual(
                    primitives.assert_prepare_git_state(
                        GitStateRuntime(),
                        source,
                        env=env,
                        sha=sha,
                        default_branch="main",
                        allow_build_outputs=True,
                    ),
                    sha,
                )
            self.assertEqual(len(seen_flags), 1)
            self.assertTrue(seen_flags[0] & getattr(os, "O_NOFOLLOW", 0))
            self.assertTrue(seen_flags[0] & getattr(os, "O_NONBLOCK", 0))

    def test_prepare_git_state_fails_closed_without_required_next_env_open_flags(self):
        for flag_name in ["O_NOFOLLOW", "O_NONBLOCK"]:
            with self.subTest(flag_name=flag_name):
                with temp_path() as tmp:
                    source, sha = make_git_state_source(tmp)
                    write_file(source / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
                    env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}

                    with mock.patch.object(primitives.release_git.os, flag_name, 0):
                        with self.assertRaisesRegex(buddy.ReleaseError, flag_name):
                            primitives.assert_prepare_git_state(
                                GitStateRuntime(),
                                source,
                                env=env,
                                sha=sha,
                                default_branch="main",
                                allow_build_outputs=True,
                            )

    def test_prepare_git_state_rejects_unsafe_ignored_next_env_file_types(self):
        cases = ["symlink", "hardlink", "fifo", "oversized"]
        for case in cases:
            with self.subTest(case=case):
                with temp_path() as tmp:
                    source, sha = make_git_state_source(tmp)
                    generated = source / "next-env.d.ts"
                    if case == "symlink":
                        generated.symlink_to("package.json")
                        pattern = "symlink"
                    elif case == "hardlink":
                        os.link(source / "package.json", generated)
                        pattern = "single-link"
                    elif case == "fifo":
                        os.mkfifo(generated, 0o600)
                        pattern = "regular file"
                    else:
                        write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS + (b"x" * 4096), 0o644)
                        pattern = "too large"
                    env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}

                    with self.assertRaisesRegex(buddy.ReleaseError, pattern):
                        primitives.assert_prepare_git_state(
                            GitStateRuntime(),
                            source,
                            env=env,
                            sha=sha,
                            default_branch="main",
                            allow_build_outputs=True,
                        )

    def test_prepare_git_state_rejects_replaced_next_env_leaf_during_safe_open(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            generated = source / "next-env.d.ts"
            write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}
            real_open = os.open
            replaced = False

            def replace_before_open(path, flags, *args, **kwargs):
                nonlocal replaced
                if Path(path) == generated and not replaced:
                    replaced = True
                    generated.rename(source / "next-env.d.ts.old")
                    write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
                return real_open(path, flags, *args, **kwargs)

            with mock.patch.object(primitives.os, "open", side_effect=replace_before_open):
                with self.assertRaisesRegex(buddy.ReleaseError, "changed during safe read"):
                    primitives.assert_prepare_git_state(
                        GitStateRuntime(),
                        source,
                        env=env,
                        sha=sha,
                        default_branch="main",
                        allow_build_outputs=True,
                    )

    def test_prepare_git_state_rejects_mutated_next_env_leaf_during_safe_read(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            generated = source / "next-env.d.ts"
            write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}
            real_read = os.read
            target = generated.lstat()
            mutated = False

            def mutate_after_read(fd, length):
                nonlocal mutated
                data = real_read(fd, length)
                fd_state = os.fstat(fd)
                if not mutated and (fd_state.st_dev, fd_state.st_ino) == (target.st_dev, target.st_ino):
                    mutated = True
                    write_file(generated, NEXT_14_0_4_NEXT_ENV_D_TS + b"// changed\n", 0o644)
                return data

            with mock.patch.object(primitives.os, "read", side_effect=mutate_after_read):
                with self.assertRaisesRegex(buddy.ReleaseError, "changed during safe read"):
                    primitives.assert_prepare_git_state(
                        GitStateRuntime(),
                        source,
                        env=env,
                        sha=sha,
                        default_branch="main",
                        allow_build_outputs=True,
                    )

    def test_prepare_git_state_rejects_unrelated_ignored_build_artifact(self):
        with temp_path() as tmp:
            source, sha = make_git_state_source(tmp)
            write_file(source / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            mkdir(source / "out", 0o755)
            write_file(source / "out" / "index.html", "<html></html>\n", 0o644)
            env = {"HOME": str(tmp), "PATH": "/usr/bin:/bin"}

            with self.assertRaisesRegex(buddy.ReleaseError, "source checkout changed"):
                primitives.assert_prepare_git_state(
                    GitStateRuntime(),
                    source,
                    env=env,
                    sha=sha,
                    default_branch="main",
                    allow_build_outputs=True,
                )

    def test_root_verified_copy_rejects_tracked_mutation_independent_of_index(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            repo, sha = make_git_source(root)
            copied = root / "copied"
            shutil.copytree(repo, copied, symlinks=True)
            git(copied, "update-index", "--assume-unchanged", "package.json")
            write_file(copied / "package.json", '{"changed":true}\n', 0o644)
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "tracked source file does not match requested Git tree"):
                primitives.validate_copied_release_against_git_tree(copied, sha=sha, runtime=runtime)

    def test_root_verified_copy_accepts_generated_outputs_and_checks_blob_modes(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            repo, sha = make_git_source(root, symlink=True)
            copied = root / "copied"
            shutil.copytree(repo, copied, symlinks=True)
            mkdir(copied / ".next", 0o755)
            write_file(copied / ".next" / "BUILD_ID", "build-1\n", 0o644)
            mkdir(copied / "node_modules" / "fixture", 0o755)
            write_file(copied / "node_modules" / "fixture" / ".env", "fixture=true\n", 0o644)
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with mock.patch.object(runtime, "run", wraps=runtime.run) as run_mock:
                self.assertEqual(primitives.validate_copied_release_against_git_tree(copied, sha=sha, runtime=runtime), sha)
            self.assertEqual((copied / ".git" / "config").read_bytes(), primitives.MINIMAL_GIT_CONFIG)
            fsck_calls = [call.args[0] for call in run_mock.call_args_list if "fsck" in call.args[0]]
            self.assertEqual(len(fsck_calls), 1)
            self.assertIn("--full", fsck_calls[0])
            self.assertNotIn("--connectivity-only", fsck_calls[0])
            os.chmod(copied / "ops" / "recovery-probe.sh", 0o644)
            with self.assertRaisesRegex(buddy.ReleaseError, "tracked source mode"):
                primitives.validate_copied_release_against_git_tree(copied, sha=sha, runtime=runtime)

    def test_root_verified_copy_rejects_pack_symlink_before_git(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            repo, sha = make_git_source(root)
            copied = root / "copied"
            shutil.copytree(repo, copied, symlinks=True)
            shutil.rmtree(copied / ".git" / "objects" / "pack")
            (copied / ".git" / "objects" / "pack").symlink_to(root)

            def fail_if_git_runs(*args, **kwargs):
                raise AssertionError("Git must not run before copied metadata is validated")

            runtime = buddy.Runtime(config, runner=fail_if_git_runs, euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "symlink"):
                primitives.validate_copied_release_against_git_tree(copied, sha=sha, runtime=runtime)

    def test_root_verified_copy_replaces_hostile_fsck_config_and_rejects_corrupt_tree(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            repo, sha = make_git_source(root)
            tree_id = git(repo, "rev-parse", f"{sha}^{{tree}}")
            copied = root / "copied"
            shutil.copytree(repo, copied, symlinks=True)
            write_file(copied / ".git" / "fsck.skip", tree_id + "\n", 0o644)
            write_file(
                copied / ".git" / "config",
                "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n"
                "[fsck]\n\tskipList = .git/fsck.skip\n",
                0o644,
            )
            tree_object = loose_object_path(copied, tree_id)
            tree_object.chmod(0o644)
            tree_object.write_bytes(b"not a valid git object")
            runtime = buddy.Runtime(config, euid=lambda: 0)
            with self.assertRaisesRegex(buddy.ReleaseError, "command failed"):
                primitives.validate_copied_release_against_git_tree(copied, sha=sha, runtime=runtime)
            self.assertEqual((copied / ".git" / "config").read_bytes(), primitives.MINIMAL_GIT_CONFIG)

    def test_prepare_rejects_mutation_during_root_copy_without_publishing_release(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            source_repo, sha = make_git_source(root)

            def install_fixture(cwd):
                mkdir(cwd / "node_modules" / "fixture", 0o755)

            fake_run_as_user = PrepareRunAsUser(sha=sha, source_repo=source_repo, npm_ci=install_fixture)

            real_copytree = shutil.copytree

            def mutating_copytree(src, dst, *args, **kwargs):
                result = real_copytree(src, dst, *args, **kwargs)
                if Path(dst).name == "release":
                    write_file(Path(dst) / "package.json", '{"changed":true}\n', 0o644)
                return result

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                root,
                mock.patch.object(shutil, "copytree", side_effect=mutating_copytree),
            ):
                with self.assertRaisesRegex(buddy.ReleaseError, "tracked source file does not match requested Git tree"):
                    buddy.prepare_release(sha, runtime)
            self.assertFalse((config.release_root / sha).exists())
            self.assertEqual(list(config.staging_root.glob(f"{sha}.*.root")), [])

    def test_prepare_rejects_next_env_mutation_during_root_copy_without_publication(self):
        with temp_path() as tmp:
            root = tmp
            config = make_config(root)
            active_app = config.source_env.parent
            write_file(active_app / "active-app-marker.txt", "untouched\n", 0o644)
            source_repo, _old_sha = make_git_state_source(root)
            mkdir(source_repo / "ops", 0o755)
            write_file(source_repo / "ops" / "recovery-probe.sh", "#!/usr/bin/env bash\n", 0o755)
            git(source_repo, "add", ".")
            git(source_repo, "commit", "-m", "add probe")
            sha = git(source_repo, "rev-parse", "HEAD")
            git(source_repo, "update-ref", "refs/remotes/origin/main", sha)

            def build_next14_output(cwd):
                mkdir(cwd / ".next", 0o755)
                write_file(cwd / ".next" / "BUILD_ID", "build-1\n", 0o644)
                write_file(cwd / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)

            fake_run_as_user = PrepareRunAsUser(sha=sha, source_repo=source_repo, build=build_next14_output)
            real_copytree = shutil.copytree

            def mutating_copytree(src, dst, *args, **kwargs):
                result = real_copytree(src, dst, *args, **kwargs)
                if Path(dst).name == "release":
                    write_file(Path(dst) / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS + b"// changed\n", 0o644)
                return result

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                root,
                mock.patch.object(shutil, "copytree", side_effect=mutating_copytree),
            ):
                with self.assertRaisesRegex(buddy.ReleaseError, "next-env\\.d\\.ts"):
                    buddy.prepare_release(sha, runtime)
            self.assertFalse((config.release_root / sha).exists())
            self.assertEqual(list(config.staging_root.glob(f"{sha}.*.root")), [])
            self.assertEqual((active_app / "active-app-marker.txt").read_text(), "untouched\n")

    def test_copied_next_env_presence_must_match_source_expectation(self):
        with temp_path() as tmp:
            source, _sha = make_git_state_source(tmp)
            copied = tmp / "copied"
            shutil.copytree(source, copied, symlinks=True)
            write_file(copied / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)

            with self.assertRaisesRegex(buddy.ReleaseError, "unexpected"):
                primitives.assert_copied_generated_next_env_declaration(copied, expected_present=False)

        with temp_path() as tmp:
            source, _sha = make_git_state_source(tmp)
            write_file(source / "next-env.d.ts", NEXT_14_0_4_NEXT_ENV_D_TS, 0o644)
            copied = tmp / "copied"
            shutil.copytree(source, copied, symlinks=True)
            (copied / "next-env.d.ts").unlink()

            with self.assertRaisesRegex(buddy.ReleaseError, "missing"):
                primitives.assert_copied_generated_next_env_declaration(copied, expected_present=True)

    def test_prepare_prerename_failure_cleans_only_exact_root_stage(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            sibling = config.staging_root / f"{GOOD_SHA}.keep.root"
            mkdir(sibling, 0o700)
            write_file(sibling / "keep", "safe\n", 0o600)
            fake_run_as_user = PrepareRunAsUser()

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                tmp,
                copied_ok(),
                mock.patch.object(primitives, "write_manifest", side_effect=buddy.ReleaseError("manifest boom")),
            ):
                with self.assertRaisesRegex(buddy.ReleaseError, "manifest boom"):
                    buddy.prepare_release(GOOD_SHA, runtime)
            self.assertTrue((sibling / "keep").exists())
            self.assertFalse((config.release_root / GOOD_SHA).exists())
            self.assertEqual(sorted(path.name for path in config.staging_root.iterdir()), [sibling.name])

    def test_prepare_cleanup_failure_message_is_bounded(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            fake_run_as_user = PrepareRunAsUser()

            real_rmtree = shutil.rmtree

            def failing_root_stage_rmtree(path, *args, **kwargs):
                if Path(path).name.endswith(".root"):
                    raise OSError("cleanup sensitive value")
                return real_rmtree(path, *args, **kwargs)

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                tmp,
                copied_ok(),
                mock.patch.object(primitives, "write_manifest", side_effect=buddy.ReleaseError("primary sensitive value")),
                mock.patch.object(shutil, "rmtree", side_effect=failing_root_stage_rmtree),
            ):
                with self.assertRaises(buddy.ReleaseError) as caught:
                    buddy.prepare_release(GOOD_SHA, runtime)
            message = str(caught.exception)
            self.assertIn("prepare failed during root_stage", message)
            self.assertIn("primary=ReleaseError cleanup=OSError", message)
            self.assertNotIn("primary sensitive value", message)
            self.assertNotIn("cleanup sensitive value", message)

    def test_prepare_postrename_failure_preserves_release_and_cleans_empty_stage(self):
        with temp_path() as tmp:
            config = make_config(tmp)
            fake_run_as_user = PrepareRunAsUser()

            validate_calls = 0

            def validate_release_once_then_fail(*args, **kwargs):
                nonlocal validate_calls
                validate_calls += 1
                if validate_calls == 1:
                    return {"artifact_digest": "stage"}
                raise buddy.ReleaseError("postrename validation failed")

            runtime = buddy.Runtime(config, euid=lambda: 0)
            with prepare_patches(
                runtime,
                fake_run_as_user,
                tmp,
                copied_ok(),
                mock.patch.object(primitives, "validate_release_tree", side_effect=validate_release_once_then_fail),
            ):
                with self.assertRaisesRegex(buddy.ReleaseError, "postrename validation failed"):
                    buddy.prepare_release(GOOD_SHA, runtime)
            self.assertTrue((config.release_root / GOOD_SHA).exists())
            self.assertEqual(list(config.staging_root.glob(f"{GOOD_SHA}.*.root")), [])

    def test_sanitized_build_env_rejects_secret_bearing_ambient_environment(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-secret"}, clear=True):
            with self.assertRaisesRegex(buddy.ReleaseError, "secret-bearing"):
                buddy.sanitized_build_env("/home/ubuntu")

    def test_manifest_requires_probe_and_detects_tamper(self):
        with temp_path() as tmp:
            config = make_config(tmp)
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

    def test_probe_parser_rejects_duplicates_unknown_and_source_mismatch(self):
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
