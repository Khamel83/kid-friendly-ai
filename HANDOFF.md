# Current checkpoint — 2026-10-02

**Source:** The parent fetched origin and independently verified default `main`
at `b99eb89680419876345d2d76131e453202455b17` again before publishing the
module split. The isolated branch preserves the dirty Mac and OCI checkouts.
Worker sandbox freshness failures were independently resolved by the parent
fetch/readback before publication.
Independent review verified all 91 prior function/class bodies are unchanged;
the prior exact head `91ba28b6dd543a476ae2797f1b92c53a1f4ac1cc` had CI and
independent review PASS, but trusted PR review blocked at 19:46:35 because the
single 83 KB operator file was truncated by reviewer file coverage. That
coverage blocker is fixed in source only by splitting the privileged operator
source into the CLI plus two colocated helper modules. A parent OCI preflight
then found the native `/etc/systemd/system/buddy.service` is root-owned,
regular, single-link mode `0600`; the source now accepts exactly native unit
mode `0600` or `0644`, records its exact beforeimage, preserves it through
rollback, and rejects unsafe modes before intent/stop/write. Trusted PR review
at the new final head remains required.
The trusted `04d0e10` review also identified redacted ordinary parser
identifiers. Their clearer assignment names preserve behavior and expose the
complete control flow; the existing redactor still removes synthetic secrets.
No global reviewer policy was changed. Parent validation passed all 28 tests
and measured the final diff below both review coverage limits.

**Implemented source change:** Preserved the public CLI surface in `ops/buddy_oci_release.py`, re-exported `prepare_release` from `ops/buddy_release_primitives.py`, kept `install_release`/rollback/parser/main in the CLI, and moved systemd/probe/receipt/transaction CAS helpers to `ops/buddy_release_state.py`. The CLI explicitly imports/re-exports the helper names used by tests and operator workflows; script execution as `python3 .../ops/buddy_oci_release.py` resolves sibling modules from the reviewed `ops/` directory. This turn also fixed the native unit mode policy so install validates `0600`/`0644` before intent, rollback uses the same allowed set, and receipts/CAS preserve the native unit without rewriting it. No runtime path, provider path, route, credential handling, or live unit permissions were changed.

**Deployed runtime:** Not changed. The known active OCI runtime remains
`buddy.service` from `/home/ubuntu/github/kid-friendly-ai`, with protected
unpublished edits and private health 503. Source publication does not prove
systemd activation, runtime parity or provider effect.

**Durable receipt:** Source-only receipts are this repository diff and local test output. No OCI receipt exists for this branch because the revised helper was not run on OCI.

**Downstream effect:** Not tested. There is no provider operation, AI answer, route fencing, public route, client effect, rollback drill, or return proof from this turn.

**Checks run locally:**

- `python3 -m unittest -v ops/test_buddy_oci_release.py` — 28 tests passed.
- `python3 -m py_compile ops/buddy_oci_release.py ops/buddy_release_primitives.py ops/buddy_release_state.py ops/test_buddy_oci_release.py` — passed.
- `python3 ops/buddy_oci_release.py --help` and `python3 ops/buddy_oci_release.py install --help` — passed.
- `bash -n ops/recovery-probe.sh` — passed.
- `git diff --check` — passed; the owned patch files remain below 48,000 bytes each.

**Next:** Obtain trusted review at the published final head, merge, then use
the authorized scoped OCI release path. Recheck the protected host first:

```bash
systemctl show buddy.service -p ActiveState -p WorkingDirectory
git -C /home/ubuntu/github/kid-friendly-ai status --short
curl http://127.0.0.1:3000/api/health
```

Then run the helper from reviewed source on OCI only under the documented limits in `docs/RECOVERY.md`: prepare the exact published full SHA, compute exact beforeimage expectations for `/etc/buddy/runtime.env` and `/etc/systemd/system/buddy.service.d/10-release.conf`, perform a dry run if desired, and install only after trusted review/merge. Keep source preparation, runtime health, provider operation, route fencing, downstream client effect, rollback, and return as separate evidence gates.
