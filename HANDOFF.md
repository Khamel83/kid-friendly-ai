# Current checkpoint — 2026-10-02

**Source:** The parent fetched origin and independently verified default `main`
at `b99eb89680419876345d2d76131e453202455b17` before publication. This turn
could not refresh origin from the sandbox (`git fetch origin` could not write
the shared worktree `FETCH_HEAD`; `git ls-remote --symref origin HEAD` could
not resolve `github.com`). The isolated branch preserves the dirty Mac and OCI
checkouts. Exact head `91ba28b6dd543a476ae2797f1b92c53a1f4ac1cc` had CI and
independent review PASS, but trusted PR review blocked at 19:46:35 because the
single 83 KB operator file was truncated by reviewer file coverage. That
coverage blocker is fixed in source only by splitting the privileged operator
source into the CLI plus two colocated helper modules; trusted PR review remains
required.

**Implemented source change:** Preserved the public CLI surface in `ops/buddy_oci_release.py`, re-exported `prepare_release` from `ops/buddy_release_primitives.py`, kept `install_release`/rollback/parser/main in the CLI, and moved systemd/probe/receipt/transaction CAS helpers to `ops/buddy_release_state.py`. The CLI explicitly imports/re-exports the helper names used by tests and operator workflows; script execution as `python3 .../ops/buddy_oci_release.py` resolves sibling modules from the reviewed `ops/` directory. No release behavior, runtime path, provider path, route, or credential handling was intentionally changed.

**Deployed runtime:** Not changed. The known active OCI runtime remains
`buddy.service` from `/home/ubuntu/github/kid-friendly-ai`, with protected
unpublished edits and private health 503. Source publication does not prove
systemd activation, runtime parity or provider effect.

**Durable receipt:** Source-only receipts are this repository diff and local test output. No OCI receipt exists for this branch because the revised helper was not run on OCI.

**Downstream effect:** Not tested. There is no provider operation, AI answer, route fencing, public route, client effect, rollback drill, or return proof from this turn.

**Checks run locally:**

- `python3 -m unittest -v ops/test_buddy_oci_release.py` — 25 tests passed.
- `python3 -m py_compile ops/buddy_oci_release.py ops/buddy_release_primitives.py ops/buddy_release_state.py ops/test_buddy_oci_release.py` — passed.
- `bash -n ops/recovery-probe.sh` — passed.
- `git diff --check` — passed for tracked changes; `git diff --no-index --check /dev/null ops/buddy_oci_release.py` and the same check for `ops/test_buddy_oci_release.py` also passed for the untracked helper/test files.

**Next:** Obtain trusted review at the published final head, merge, then use
the authorized scoped OCI release path. Recheck the protected host first:

```bash
systemctl show buddy.service -p ActiveState -p WorkingDirectory
git -C /home/ubuntu/github/kid-friendly-ai status --short
curl http://127.0.0.1:3000/api/health
```

Then run the helper from reviewed source on OCI only under the documented limits in `docs/RECOVERY.md`: prepare the exact published full SHA, compute exact beforeimage expectations for `/etc/buddy/runtime.env` and `/etc/systemd/system/buddy.service.d/10-release.conf`, perform a dry run if desired, and install only after trusted review/merge. Keep source preparation, runtime health, provider operation, route fencing, downstream client effect, rollback, and return as separate evidence gates.
