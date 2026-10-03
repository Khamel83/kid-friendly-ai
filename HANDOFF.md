# Current checkpoint — October 2

Final generated-file source candidate passes52 tests. The exact canonical
Next14.0.4 declaration is checked both after build and after the root copy,
before manifest/publication. Expected presence is preserved; races, unsafe
leaves and unsupported safe-open flags refuse without publishing a release.
Next: final independent/exact-head trusted review and Node CI, then repeat
guarded prepare/install. Existing servicePID1204 and dirty checkout remain.

PR25 merged08ceda61 after exact5b417ef8 PASS/Node CI. Four modules installed
root-readonly under /opt/buddy-release-operators/08ceda61a3d670d2e417e409eadf57406857414e;
hash manifest SHAe7bc3f7b independently checks. Guarded prepare passed build/
keyless probe but refused generated ignored next-env.d.ts before publication.
Owned staging is empty and activePID1204/working directory unchanged. Next:
review narrow generated-file guard repair, then exact merged-source prepare
and CAS install. Earlier final-review-pending text below describes PR25.
Generated-file guard repair is now local only: Next 14.0.4 canonical
next-env.d.ts bytes match the real five-line generator output, allowance stays
after-build-only, other ignored output still refuses, and FIFO/replacement/
mutation cases fail closed without unbounded reads. Verification: `python3 -m
unittest discover -s ops -p 'test_buddy*.py' -v` ran 49 tests OK;
`python3 -m py_compile ops/buddy_release_git.py
ops/buddy_release_test_support.py ops/test_buddy_release_prepare.py
ops/test_buddy_oci_release.py` passed; `git diff --check --
ops/buddy_release_git.py ops/buddy_release_test_support.py
ops/test_buddy_release_prepare.py` passed. No fetch/network/provider/runtime/
secret/commit/push/deploy was performed by the worker. Parent fetched and
verified default08ceda61 and independently reran49 tests/compile/diff. Next:
exact-head review/CI for this narrow repair, then guarded prepare/install.

PR25 source repairs pass40 tests and independent adversarial review. Root
verifies copied Git/tree/blob/mode identity independently of the user index,
uses full strict fsck and binds root_verified_sha in the manifest. Cleanup
removes only its exact unpublished stage; post-rename failure preserves the
release. Systemd255 environment-file flags survive receipt/rollback checks.
Include four production files: buddy_oci_release.py, buddy_release_primitives.py,
buddy_release_git.py, buddy_release_state.py. Final-head trusted PASS/Node CI
and OCI deployment remain open; protected dirty checkouts and service unchanged.

Recheck: python3 -m unittest discover -s ops -p 'test_buddy*.py' -v.
Next: reviewed merge, exact fetched-source prepare, then guarded install with
beforeimage expectations. [Operator contract](docs/RECOVERY.md#bounded-oci-release-helper).

## Historical September 29 checkpoint

# Current checkpoint — 2026-09-29

**Source:** Buddy [PR #19](https://github.com/Khamel83/kid-friendly-ai/pull/19) merged as `cab8cfb` after exact-head Janitor PASS and Node 18/20 CI PASS on `16c6f1e`. The candidate preserves child-facing cloud restrictions and local/TTS controls, and repairs SSE errors, current history, and local-to-cloud fallback. The final protected OCI app-file SHA-256 prefixes are index `1986b521`, ask `03aa9b31`, mode `1ef15e1a`; no OCI file was reset. Current OCI active checkout remains `30ead698` with staged/unstaged edits, so this reviewed source is not proven identical to the running artifact.

**Deployed runtime:** OCI system `buddy.service` was active at `30ead698` on the 2026-09-29 recheck; private health remained 503. An exact `16c6f1e` tracked-source archive built on Homelab with package lock SHA-256 `1d95e372…`; keyless loopback probe gave home 200, health 503 (`memory=true`, `api=false`), and empty-question 400. Probe process, port, and scratch were removed; Homelab recovery unit stayed inactive. No production route or active OCI runtime changed.

**Durable receipt:** Private Homelab `/mnt/main-drive/backups/project-state/buddy/recovery-drills/20260929T232428Z.json`, SHA-256 `d6f718166731108c00097f26c40f2598b99226f843a0a5c6662cc6fd3d5ba73a`, records the isolated probe. No scheduled backup is required for the inspected stateless server routes; no active deployment or cold-swap packet exists.

**Downstream effect:** No provider call, AI response, client route change, or failback was tested. No spend was incurred by the probe.

**Checks:** Focused SSE tests 2/2, changed-file ESLint, production build, exact-head Janitor review, and Node 18/20 CI passed. Repository-wide lint/type checks still fail in unrelated pre-existing files (`ContentUpdates.tsx`, `disabled-tests/*.ts`); CI treats those two checks as nonblocking. The keyless probe made no provider request and did not prove an AI answer.

Next: establish exact running-artifact/source parity without discarding the protected OCI patch; then deploy the reviewed health fix to the active service. Install a persistent inactive Homelab release with scoped provider credentials, verify a bounded real operation, and prove route fencing and return under the Homelab recovery contract. Recheck OCI with `systemctl show buddy.service -p ActiveState -p WorkingDirectory`, `git -C /home/ubuntu/github/kid-friendly-ai status --short`, and `curl http://127.0.0.1:3000/api/health` without printing credentials.
