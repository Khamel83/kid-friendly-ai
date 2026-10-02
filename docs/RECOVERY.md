# Buddy clean rebuild and private drill

Buddy's OCI system `buddy.service` is active, but its checkout has unpublished staged and unstaged application edits. A clean GitHub SHA is therefore a **recovery candidate**, not a claim of exact production parity. Preserve that checkout.

On a clean machine, check out a reviewed SHA and transfer its tracked files to a disposable directory on Homelab. Do not transfer `.env` files or use the live OCI checkout. On Homelab:

```bash
cd /tmp/buddy-recovery-REVIEWED_SHA
npm ci --no-audit --no-fund
npm run build
bash ops/recovery-probe.sh 43117
```

The probe refuses local env files and an occupied port. It removes provider keys from its child process, binds only `127.0.0.1`, checks the home page and malformed `/api/ask` request, reports `/api/health` with memory and API-key flags, and removes the private process. A 400 response for an empty question proves only input rejection; it is not an AI answer. Inspect the child process and port after the probe. Do not use the probe to route traffic or mark the service recovered.

The 2026-09-29 clean candidate `bb96c4c` built with package lock SHA-256 `1d95e3728e1059c8d4711750181385ce97aced8946f79b158f46a97a9957ad3e` on Homelab. Its private result was home 200, health 503, invalid question 400, with no provider key or provider request. The OCI private health endpoint also returned 503, with its memory check false. The original check used allocated V8 heap (`heapTotal`) as the capacity threshold, although the process had much more room under V8's heap limit. PR #17 corrected the capacity calculation and made the missing-key flag an explicit false instead of an omitted JSON field, but it did not deploy those fixes. Its database and Redis checks are placeholder successes. This does not prove credentials, production parity, downstream AI operation, a public route, or return.

The reviewed `a8556fa` source then built on Homelab and returned home 200, health 503 with `memory=true` and `api=false`, and empty-question 400. Cleanup of the loopback process and port passed. [PR #17's exact-head comment](https://github.com/Khamel83/kid-friendly-ai/pull/17#issuecomment-5899495935) is the durable probe record. The 503 now truthfully reflects the deliberately absent provider key.

For a later cold swap, first reconcile and review OCI's unpublished edits. Build that exact release on Homelab, fix and verify private health, provide scoped credentials through the approved secret path, and prove a safe representative operation. Then exercise one active origin, a route switch, client effect, rollback, and return as specified in the [Homelab recovery contract](https://github.com/Khamel83/homelab/blob/main/docs/operations/OCI_HOMELAB_RECOVERY_CONTRACT.md).

The 2026-09-29 OCI patch was inspected without changing the active checkout. Its final app-file SHA-256 prefixes were `1986b521` (`index.tsx`), `03aa9b31` (`ask.ts`), and `1ef15e1a` (`useServiceMode.ts`). The patch removed child-facing cloud restrictions and existing local/TTS controls, called a nonexistent `/api/check-local` route, parsed SSE by network chunk without retaining partial lines, and added an extra CSS brace. The reviewed source candidate retains the restrictions and existing controls. It hardens the already buffered SSE parser for error frames, snapshots current conversation history, and falls back from local to cloud when the local check fails. A passing source build does not identify the running OCI artifact or authorize route/credential changes.

The exact reviewed `16c6f1e` candidate (merged by PR #19 as `cab8cfb`) passed Node 18/20 CI and an isolated Homelab `npm ci`/`next build` from its tracked archive. With no provider key, loopback home returned 200, health returned 503 with `memory=true` and `api=false`, and empty question returned 400. The process, port, and scratch were removed; `buddy-recovery.service` stayed inactive. The private JSON receipt is `/mnt/main-drive/backups/project-state/buddy/recovery-drills/20260929T232428Z.json` (SHA-256 `d6f718166731108c00097f26c40f2598b99226f843a0a5c6662cc6fd3d5ba73a`). OCI remained active at `30ead698` with protected edits and private health 503. This is no provider operation, deployed health fix, or route/return proof.

## Bounded OCI release helper

The protected operator bundle is four colocated files: buddy_oci_release.py,
buddy_release_primitives.py, buddy_release_git.py and buddy_release_state.py.
It accepts fixed Buddy paths only, requires root and serializes through
/var/lib/buddy/release-state/lock. No provider request, external route change
or edit to the mutable production checkout is part of this operator.

Prepare fresh-clones reviewed source as ubuntu using non-login env-i; requested
full SHA must equal fetched default. It sanitizes npm build/probe environment,
forbids runtime env files while allowing reviewed examples/dependency fixtures,
and requires exact-source loopback home200, health503 memory=true/api=false,
empty ask400 and provider_request=none. Root copies with Git metadata retained,
rejects metadata indirection/unsafe ownership, replaces local Git config,
runs isolated full strict fsck and verifies tracked blob hashes/modes/links
against the requested tree independently of the user index. Generated build
outputs remain allowed. Manifest root_verified_sha must match source; artifact
hashes/modes/build identity are recorded. Root publishes immutable0555/0444
release /opt/buddy/releases/SHA after CAS checks. Failed pre-rename work cleans
only the owned root stage; post-rename failure preserves the published release.

Install requires exact runtime-env/drop-in beforeimages (absent or SHA256).
It checks active native service identity, positive PID, fixed fragment/exec/
user/restart/environment, and regular single-link root unit0600/0644; native
unit bytes/mode are never rewritten. Source .env.local must be uid1001:0600,
single-link, with only reviewed project keys plus VERCEL_OIDC_TOKEN. Duplicate,
unknown, multiline or shell values refuse. Only the three project API keys
are projected into root0600 /etc/buddy/runtime.env; Vercel token is omitted.
The root0644 drop-in sets only release WorkingDirectory and EnvironmentFile.
Multiline systemd255 environment entries retain required/optional flags;
installed identity requires exactly the mandatory runtime file.

Private intent and byte-preserving transaction precede mutation; source env,
unit, drop-in, runtime env and service identity are rechecked with CAS.
Only buddy.service restarts. Proxy-disabled loopback checks require home200,
health200 memory=true/api=true and invalid ask400 with positive new PID.
The old503/memory=false baseline is retained as rollback evidence, not health.

Rollback validates transaction hierarchy, beforeimage metadata/bytes and
before-or-planned current identities before stop. It restores exact prior
file presence/bytes, reloads, starts and proves prior identity/PID/baseline.
Failure records rollback_failed and best-effort stops Buddy; restoration is
not claimed. Unknown/nonterminal intent blocks installation. Dry-run writes
no intent. No secret values appear in receipts or output.

From reviewed merged source on OCI:

```bash
sudo python3 ops/buddy_oci_release.py prepare --sha "$source_sha"
sudo python3 ops/buddy_oci_release.py install --sha "$source_sha" \
  --expect-runtime-env-sha256 <absent-or-sha256> \
  --expect-dropin-sha256 <absent-or-sha256>
# Interrupted install: exact basename under fixed private receipt root
sudo python3 ops/buddy_oci_release.py rollback --receipt <receipt-basename>
```

40 focused tests and independent review pass; final-head review/CI and live
installation remain open. Source, runtime, provider operation, fencing,
route, rollback and return are separate acceptance gates.
