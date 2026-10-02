# Current checkpoint — 2026-10-02

**Source:** The parent fetched origin and independently verified default `main`
at `b99eb89680419876345d2d76131e453202455b17` before publication. The isolated
branch preserves the dirty Mac and OCI checkouts. Independent review of the
four final corrections passed; trusted PR review remains required.

**Implemented source change:** Revised `ops/buddy_oci_release.py`, `ops/recovery-probe.sh`, `ops/test_buddy_oci_release.py`, and narrow `docs/RECOVERY.md` helper text after parent/independent review found deterministic production blockers. The helper is fixed to Buddy paths/service/user/loopback only, requires euid 0 before mutation, bootstraps only named trusted roots, locks under `/var/lib/buddy/release-state/lock`, builds in a user stage before root-owned publication, allows only the three reviewed root env examples plus dependency fixtures, requires source/build/probe manifest proof, rechecks source `HEAD`/default/status after build and probe before root copy, uses bounded process-group timeout cleanup, validates actual `RestartUSec=10s`, exact native-unit `FragmentPath`, and sanitized effective systemd identity, accepts the verified old 503/memory=false baseline, records private beforeimage transactions before mutation, refuses stale nonterminal or unknown-phase receipts, validates beforeimage metadata before stop, and rolls back interrupted installs from disk with pre-stop validation plus fail-closed final-state recording on rollback failure.

**Deployed runtime:** Not changed. The known active OCI runtime remains
`buddy.service` from `/home/ubuntu/github/kid-friendly-ai`, with protected
unpublished edits and private health 503. Source publication does not prove
systemd activation, runtime parity or provider effect.

**Durable receipt:** Source-only receipts are this repository diff and local test output. No OCI receipt exists for this branch because the revised helper was not run on OCI.

**Downstream effect:** Not tested. There is no provider operation, AI answer, route fencing, public route, client effect, rollback drill, or return proof from this turn.

**Checks run locally:**

- `python3 -m unittest -v ops/test_buddy_oci_release.py` — 25 tests passed.
- `python3 -m py_compile ops/buddy_oci_release.py ops/test_buddy_oci_release.py` — passed.
- `bash -n ops/recovery-probe.sh` — passed.
- `git diff --check` — passed for tracked changes; `git diff --no-index --check /dev/null ops/buddy_oci_release.py` and the same check for `ops/test_buddy_oci_release.py` also passed for the untracked helper/test files.

**Next:** Obtain trusted review at the published final head, merge, then use
the authorized scoped OCI release path. Recheck the protected host first:

```bash
systemctl show buddy.service -p ActiveState -p WorkingDirectory
git -C /home/ubuntu/github/kid-friendly-ai status --short
curl http://127.0.0.1:3000/api/health
```

Then run the helper from reviewed source on OCI only under the documented limits in `docs/RECOVERY.md`: prepare the exact published full SHA, compute exact beforeimage expectations for `/etc/buddy/runtime.env` and `/etc/systemd/system/buddy.service.d/10-release.conf`, perform a dry run if desired, and install only after review. Keep source preparation, runtime health, provider operation, route fencing, downstream client effect, rollback, and return as separate evidence gates.
