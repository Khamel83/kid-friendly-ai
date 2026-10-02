## Current release preparation — October 2

PR25 fixes the root-copy handoff race: independent copied Git/tree/blob/mode
verification, full strict fsck, fixed Git config and manifest source binding.
Exact-stage cleanup preserves published releases. Independent review/40 tests
pass. Systemd255 environment flags and native unit modes are preserved.
Final-head PASS/CI and OCI deployment remain open; runtime is unchanged.

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
