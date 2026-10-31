## Current source-status correction — October 31, 2026

[PR #26](https://github.com/Khamel83/kid-friendly-ai/pull/26) merged as `4dcb3a4b6dfa8f5e2735c78c6ebedde2dabd6da0`. Its final head `8f56b0c8642b96e447708428b107f2f96005d592` received the [trusted OCI reviewer Bot PASS](https://github.com/Khamel83/kid-friendly-ai/pull/26#pullrequestreview-5398202479) and passed [Node 18/20 CI](https://github.com/Khamel83/kid-friendly-ai/actions/runs/37083390156). Generated-file guard source review and merge are no longer pending; exact-source preparation, installation and runtime acceptance remain separate, unresolved gates.

[PR #39](https://github.com/Khamel83/kid-friendly-ai/pull/39) merged as `a360de8a8dbd5543011aafa9203a4848d0228f6b`. Its final head `88dc3460c058a89cb9b2af7a70bbb6f2536d07c1` received the [trusted OCI reviewer Bot PASS](https://github.com/Khamel83/kid-friendly-ai/pull/39#pullrequestreview-5553164046) and passed [Node 18/20 CI](https://github.com/Khamel83/kid-friendly-ai/actions/runs/38959502201). Vercel adapter publication, source review and merge are no longer pending. Both PR deployment jobs were skipped; these checks do not establish a production release or deployed health.

This corrects only the two source statuses. Earlier dated checkpoints below remain historical evidence; their pending PR #26/#39 source steps are superseded by this correction, not current instructions. All unchecked acceptance tasks remain open. Preserve the protected staged/unstaged owner patch and independently establish installed-artifact parity, private health, scoped credentials, explicit no-spend or bounded-spend approval, a private representative answer, inactive recovery installation, cold-swap evidence, fencing, client path, rollback and return. No runtime, credential, provider, route or deployment action was performed by this correction.

## Current repository-plan checkpoint — October 11, 2026

The owner requested one owning plan for every open TODO, issue and PR. [docs/REPO_PLAN.md](docs/REPO_PLAN.md) maps 5 unchecked source references and 2 open native records observed from `9c473aa42697b8ff5f92a9bc900e953d605262c0`. G2K is the executor; coordinator34 tracks project-owned acceptance. Previous source prose below is retained as dated evidence, not refreshed runtime attestation.

This source proposal requires trusted exact-head review, native CI and normal merge before audit35 is closed or finite sequencing is applied. Source, installation, ordinary receipt and downstream effect remain separate. Next: verify this PR’s current head and accepted native merge, then update the existing coordinator; resolve the explicitly listed next review/receipt/decision in plan order. No busy worker, host service, access policy or retry state was changed.

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
- Reconciled all open work into owning repository plan ([#36](https://github.com/Khamel83/kid-friendly-ai/pull/36), `f7c1752ea3f6a264fef8bba334c3bfc580cd3398`).
- Mapped 5 unchecked source references and 2 open native records to [docs/REPO_PLAN.md](docs/REPO_PLAN.md) and coordinator [issue #34](https://github.com/Khamel83/kid-friendly-ai/issues/34).
- Validated generated Next declaration through guarded release copy ([#26](https://github.com/Khamel83/kid-friendly-ai/pull/26), `4dcb3a4b6dfa8f5e2735c78c6ebedde2dabd6da0`).
<!-- janitor:end:recent -->

## Vercel release adapter checkpoint — October 16, 2026

The candidate is based on exact `main` `1402c0b14945636aa1f8b5d09bdc715e46c3c963`. It replaces the unavailable `vercel/action@v1` with Vercel CLI `64.4.0`, using the official production pull/build/prebuilt-deploy flow, and makes the release checkout explicit at `${{ github.sha }}`. The `production` environment, main-only condition, existing `secrets.VERCEL_TOKEN` and `vars.VERCEL_ORG_ID`/`vars.VERCEL_PROJECT_ID` names, and missing-configuration fallback remain in place. `actionlint`, YAML parsing, extracted deployment-shell syntax, the empty-token guard, and the pinned CLI version check passed. No credential, app source, or runtime was changed.

Next: publish and review the normal PR; then verify native CI, merge, the exact main release run, and the deployed health surface. The current GitHub configuration exposes no Vercel secret or variable names through the read-only Actions metadata, so a live release remains an owner/configuration gate.
## Fleet CI cancellation - source checkpoint (October 16, 2026)

`.github/workflows/ci-cd.yml` has a prepared source change on `feat/fleet-ci-cancellation-20261016` that coalesces superseded pull-request runs and leaves main, manual, release, and scheduled runs non-canceling. Native CI, review, and normal merge remain pending; no runtime change is claimed.
