## Current release preparation — October 2

Final generated-file source candidate passes52 tests. The exact canonical
Next14.0.4 declaration is checked both after build and after the root copy,
before manifest/publication. Expected presence is preserved; races, unsafe
leaves and unsupported safe-open flags refuse without publishing a release.
Next: final independent/exact-head trusted review and Node CI, then repeat
guarded prepare/install. Existing servicePID1204 and dirty checkout remain.

PR25 merged08ceda61 after trusted PASS on5b417ef8 and Node18/20 CI.
Protected OCI operator capsule /opt/buddy-release-operators/08ceda61a3d670d2e417e409eadf57406857414e
is root0555 with four root0444 modules; relative hash manifest SHAe7bc3f7b.
Prepare's initial source check, npm build and keyless probe passed. Final
source validation refused ignored generated next-env.d.ts; no app release
published. Owned staging is empty, activePID1204/working directory unchanged.
Repair is scoped to that generated declaration; no guard bypass is authorized.
Local repair now fixes the canonical Next 14.0.4 declaration bytes and keeps
the allowance after-build-only. The generated leaf is accepted only as a
regular single-link file under 1024 bytes, opened with no-follow/nonblocking
flags, and rechecked by named leaf identity plus size/mtime before and after a
bounded read. Local unittest/compile/diff checks passed; no fetch, provider,
runtime, secret, commit, push, or deployment action occurred, so source
freshness was verified by parent fetch/default readback at08ceda61. Parent
independently reran49 tests, compilation and diff checks. The new guard has no
runtime effect yet; exact-head review/CI and prepare/install remain open.

PR25 fixes the root-copy handoff race: independent copied Git/tree/blob/mode
verification, full strict fsck, fixed Git config and manifest source binding.
Exact-stage cleanup preserves published releases. Independent review/40 tests
pass. Systemd255 environment flags and native unit modes are preserved.
PR25 exact-head PASS/CI and merge are accepted. The generated-file repair and
OCI app deployment remain open; runtime is unchanged.

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
