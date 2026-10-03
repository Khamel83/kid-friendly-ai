# Current Buddy release state — October 3, 00:31 UTC

PR26 is the current generated-file repair; its final exact-head trusted review
remains open. Node18/20 CI passed for26a74a3, but current local source now
includes post-review fixes for the generated-file guard. Local
`python3 -m unittest discover -s ops -p 'test_buddy*.py' -q` passes54 tests,
and `python3 -m py_compile ops/buddy_release_git.py
ops/test_buddy_release_prepare.py ops/buddy_release_test_support.py` passes.
The latest two regressions cover dependency-location mismatch refusal and
multi-chunk short reads; earlier added methods cover root-copy mutation, copied
presence mismatch and missing safe open flags. Diff check passes.

The exact Next14.0.4 declaration is validated after build and after root copy,
before manifest/publication. The guard now requires Next14.0.4 in dependencies
in both package.json and the package-lock root; devDependencies are not accepted
as fallback. Expected presence is preserved; other ignored files, unsafe leaves,
unsupported safe-open flags and replacement races refuse. The unit test compares
independent literal fixture bytes. Separately, parent executed the installed
Next14.0.4 generator on OCI in private disposable scratch at00:31 UTC:201 output
bytes matched SHA9269d492 exactly. Generator source hash48d0f69a is recorded in
[the generator evidence](docs/NEXT_GENERATOR_EVIDENCE.md). No app files,
provider, active service or route changed; scratch was removed.

Historical PR25 is accepted: merge08ceda61 after exact5b417ef8 trusted PASS
and Node18/20 CI, with the four-module root-readonly operator installed under
/opt/buddy-release-operators/08ceda61a3d670d2e417e409eadf57406857414e/ops/.
Its hash manifest SHAe7bc3f7b matches all four modules. Prepare passed build and
keyless probe, then refused generated next-env.d.ts before publication.
Owned staging is empty; activePID1204 and the protected dirty checkout remain.
Those PR25 gates do not imply PR26 review, merged source or app installation.

Next: trusted PASS and CI for the final PR26 head, merge, stage all four exact
merged production modules, run guarded prepare and independently verify its
manifest/probe, then CAS install and check Buddy-only runtime/health.
[Operator contract](docs/RECOVERY.md#bounded-oci-release-helper).

## Recovery ownership

OCI is Buddy's active host. Homelab is its recovery host under the Homelab OCI application recovery contract. A Git SHA does not identify the running app when the deployment checkout has unpublished edits. A clean Homelab rebuild is a candidate until source parity, private health, scoped credentials, an operation, fencing, route, and return are independently verified. The inspected server API routes have no durable server state; browser preferences are client local storage.

The 2026-09-29 source reconciliation keeps the child-facing cloud restrictions and existing local/TTS controls from reviewed main. OCI's unpublished replacement used an `/api/check-local` route absent from the tracked API routes, parsed each network chunk as if it were an entire SSE line, and introduced an extra CSS brace. These edits are preserved privately for comparison; they are not a release or evidence of active runtime parity. The reviewed main stream parser already buffers partial SSE lines and the prior health fix uses the V8 heap limit.

A keyless, disposable Homelab build/probe proves rebuild and bounded input rejection only. Its health status can correctly be 503 when no provider key is present. Keep exact source, active runtime, private receipt, and downstream answer as separate evidence gates; see `HANDOFF.md` for current commit and runtime facts.

<!-- janitor:begin:recent -->
## Recent

- **4dcb3a4b6dfa8f5e2735c78c6ebedde2dabd6da0 — generated declaration validation:** PR #26 validates an exact Next.js `14.0.4` declaration in both `package.json` and the `package-lock.json` root after build and guarded root copy, before manifest or publication. The guard refuses dependency-location mismatches, missing expected files, unsafe leaves, unsupported safe-open flags, replacement races, and short reads. Local documented checks pass 54 Buddy tests, Python compilation, and diff validation; CI passed for `26a74a3`, but exact-head trusted review for the current PR #26 source remains open.
- **Generated-file evidence:** A private disposable OCI scratch run at 00:31 UTC produced 201 output bytes matching SHA-256 `9269d492…`; generator source hash `48d0f69a…` is recorded in `docs/NEXT_GENERATOR_EVIDENCE.md`. The scratch was removed, and no app files, provider, active service, or route changed.
- **08ceda61a3d670d2e417e409eadf57406857414e — accepted release operator:** PR #25 merged after exact-head trusted PASS and Node 18/20 CI. Four read-only operator modules are installed under `/opt/buddy-release-operators/08ceda61a3d670d2e417e409eadf57406857414e/ops/`; its manifest hash `e7bc3f7b…` matches all four modules. Prepare passed build and keyless probe, then refused generated `next-env.d.ts` before publication. Owned staging was empty; active PID 1204 and the protected dirty checkout remain. This does not establish PR #26 review, merged source, or app installation.
- **Release gate:** PR #26 still needs exact-head trusted PASS and CI, merge, staging of all four exact merged production modules, guarded prepare, independent manifest/probe verification, CAS installation, and Buddy-only runtime and health checks.
- **Recovery and runtime boundary:** OCI is Buddy's active host; Homelab is its recovery host. A Git SHA alone does not identify running app state because the OCI deployment checkout has unpublished edits. Those private edits are not release evidence or proof of active-runtime parity. Exact source, active runtime, private receipt, and downstream behavior remain separate verification gates.
<!-- janitor:end:recent -->
