# Current Buddy release state — October 3, 00:31 UTC

PR26 is the current generated-file repair; its final exact-head trusted review
remains open. Node18/20 CI passed for26a74a3. Independent production review
passes, and parent `python3 -m unittest discover -s ops -p 'test_buddy*.py' -q`
passes52 tests. This supersedes the earlier49-test candidate: three added
methods cover root-copy mutation, copied presence mismatch and missing safe
open flags. Compilation and diff checks pass.

The exact Next14.0.4 declaration is validated after build and after root copy,
before manifest/publication. Expected presence is preserved; other ignored
files, unsafe leaves, unsupported safe-open flags and replacement races refuse.
The unit test compares independent literal fixture bytes. Separately, parent
executed the installed Next14.0.4 generator on OCI in private disposable scratch
at00:31 UTC:201 output bytes matched SHA9269d492 exactly. Generator source hash
48d0f69a is recorded in [the generator evidence](docs/NEXT_GENERATOR_EVIDENCE.md).
No app files, provider, active service or route changed; scratch was removed.

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
## Recent verified state

- At source commit `8f66a6609dbac0b75ce47d30f55241270e55cfb6`, the repository documents Buddy as active on OCI with Homelab designated as its recovery host under the Homelab OCI application recovery contract.
- Source reconciliation completed in `16c6f1edc6c6e69d85e769708eafc7f7f491b8be` and was merged in `cab8cfb283bef7d8d1bfbff93c8fb98e020fd77b`. It retained the child-facing cloud restrictions and existing local/TTS controls from reviewed main while separately identifying unpublished OCI edits that used an untracked `/api/check-local` route, mishandled partial SSE chunks, and contained an extra CSS brace. Those private edits are not evidence of a release or runtime parity.
- A reviewed keyless Homelab recovery drill is recorded in `c95f0e15a3925a029e9068273b15c10b97f11504` and merged in `aedce674773cc0cac4570b1f513ae231a27529d1`. It proves rebuild and bounded input rejection only; a 503 health result without a provider key is consistent with that probe and is not proof of application parity.
- The reviewed main stream parser buffers partial SSE lines, and the prior health implementation measures usage against the V8 heap limit (`1bc40fa13cdaf7ec4cf7b518bc6250fff7dc6279`).
- Exact source, active runtime, private recovery receipt, scoped credentials, operational/fencing/route/return checks, and downstream behavior remain separate verification gates. `HANDOFF.md` is the current authority for those facts.
<!-- janitor:end:recent -->
