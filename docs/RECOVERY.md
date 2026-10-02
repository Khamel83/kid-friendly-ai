# Buddy clean rebuild and private drill

Buddy's OCI system `buddy.service` is active, but its checkout has unpublished staged and unstaged application edits. A clean GitHub SHA is therefore a **recovery candidate**, not a claim of exact production parity. Preserve that checkout.

On a clean machine, check out a reviewed SHA and transfer its tracked files to a disposable directory on Homelab. Do not transfer `.env` files or use the live OCI checkout. On Homelab:

```bash
cd /tmp/buddy-recovery-REVIEWED_SHA
npm ci --no-audit --no-fund
npm run build
bash ops/recovery-probe.sh 43117
```

The probe refuses local env files and an occupied port. It removes provider keys from its child process, binds only `127.0.0.1`, checks the home page and malformed `/api/ask` request, reports `/api/health` with memory and API-key flags, and removes the private process. It starts the private Node process in its own process group and handles `TERM`/`INT` by running the same cleanup before the parent process exits. A 400 response for an empty question proves only input rejection; it is not an AI answer. Inspect the child process and port after the probe. Do not use the probe to route traffic or mark the service recovered.

The 2026-09-29 clean candidate `bb96c4c` built with package lock SHA-256 `1d95e3728e1059c8d4711750181385ce97aced8946f79b158f46a97a9957ad3e` on Homelab. Its private result was home 200, health 503, invalid question 400, with no provider key or provider request. The OCI private health endpoint also returned 503, with its memory check false. The original check used allocated V8 heap (`heapTotal`) as the capacity threshold, although the process had much more room under V8's heap limit. PR #17 corrected the capacity calculation and made the missing-key flag an explicit false instead of an omitted JSON field, but it did not deploy those fixes. Its database and Redis checks are placeholder successes. This does not prove credentials, production parity, downstream AI operation, a public route, or return.

The reviewed `a8556fa` source then built on Homelab and returned home 200, health 503 with `memory=true` and `api=false`, and empty-question 400. Cleanup of the loopback process and port passed. [PR #17's exact-head comment](https://github.com/Khamel83/kid-friendly-ai/pull/17#issuecomment-5899495935) is the durable probe record. The 503 now truthfully reflects the deliberately absent provider key.

For a later cold swap, first reconcile and review OCI's unpublished edits. Build that exact release on Homelab, fix and verify private health, provide scoped credentials through the approved secret path, and prove a safe representative operation. Then exercise one active origin, a route switch, client effect, rollback, and return as specified in the [Homelab recovery contract](https://github.com/Khamel83/homelab/blob/main/docs/operations/OCI_HOMELAB_RECOVERY_CONTRACT.md).

The 2026-09-29 OCI patch was inspected without changing the active checkout. Its final app-file SHA-256 prefixes were `1986b521` (`index.tsx`), `03aa9b31` (`ask.ts`), and `1ef15e1a` (`useServiceMode.ts`). The patch removed child-facing cloud restrictions and existing local/TTS controls, called a nonexistent `/api/check-local` route, parsed SSE by network chunk without retaining partial lines, and added an extra CSS brace. The reviewed source candidate retains the restrictions and existing controls. It hardens the already buffered SSE parser for error frames, snapshots current conversation history, and falls back from local to cloud when the local check fails. A passing source build does not identify the running OCI artifact or authorize route/credential changes.

The exact reviewed `16c6f1e` candidate (merged by PR #19 as `cab8cfb`) passed Node 18/20 CI and an isolated Homelab `npm ci`/`next build` from its tracked archive. With no provider key, loopback home returned 200, health returned 503 with `memory=true` and `api=false`, and empty question returned 400. The process, port, and scratch were removed; `buddy-recovery.service` stayed inactive. The private JSON receipt is `/mnt/main-drive/backups/project-state/buddy/recovery-drills/20260929T232428Z.json` (SHA-256 `d6f718166731108c00097f26c40f2598b99226f843a0a5c6662cc6fd3d5ba73a`). OCI remained active at `30ead698` with protected edits and private health 503. This is no provider operation, deployed health fix, or route/return proof.

## Bounded OCI release helper

`ops/buddy_oci_release.py` is the Buddy-specific CLI operator for the reviewed OCI release path. It imports only the colocated reviewed helper modules `ops/buddy_release_primitives.py` and `ops/buddy_release_state.py`; those three files together are the privileged operator source. They are not a generic deploy framework and must not be used for Vercel, Docker, Homelab route switches, or provider canaries.

The revised `prepare` command is source-pending until parent review/publication. When it is reviewed and run on the OCI host as root, it fresh-clones the approved repository as `ubuntu` with non-login `sudo -n -H -u ubuntu env -i`, discovers the fetched default branch, requires the requested full SHA to equal that fetched default, runs `npm ci` and `npm run build` with a sanitized build environment, allows only the tracked root examples `.env.example`, `.env.docker.example`, and `.env.local.example` while forbidding runtime or arbitrary source `.env*` files, invokes the reviewed built-stage `ops/recovery-probe.sh`, and requires exactly `source=<FULL_SHA>`, `bind=127.0.0.1`, home 200, health 503, `memory=true`, `api=false`, empty ask 400, and `provider_request=none` before publication. Dependency fixtures under `node_modules` are treated as dependency bytes, not source runtime env. After build and probe, it rechecks fetched default branch, default SHA, checked-out `HEAD`, and porcelain status before the root copy; tracked drift or unexpected untracked files fail closed, while the expected ignored `.next/` and `node_modules/` build outputs are allowed. It writes `BUDDY_RELEASE_MANIFEST.json` with source, lockfile, `.next/BUILD_ID`, node/npm, completed probe, file hashes, modes, symlink targets, and an artifact digest, then publishes a root-owned release at `/opt/buddy/releases/<FULL_SHA>` with directories mode `0555` and regular files mode `0444` or executable `0555`. It does not overwrite an existing release.

```bash
# Set source_sha to the reviewed merged current default, including this helper.
sudo python3 ops/buddy_oci_release.py prepare --sha "$source_sha"
```

The `install` command installs only an already prepared `/opt/buddy/releases/<FULL_SHA>` into the existing `buddy.service`. Before it mutates anything, the operator must supply exact beforeimage expectations for `/etc/buddy/runtime.env` and the Buddy drop-in. Use `absent` for a missing file or a SHA-256 digest for an existing file. `--dry-run` performs terminal inspection only and leaves no blocking intent receipt.

```bash
sudo sha256sum /etc/buddy/runtime.env /etc/systemd/system/buddy.service.d/10-release.conf 2>/dev/null || true
sudo python3 ops/buddy_oci_release.py install \
  --sha "$source_sha" \
  --expect-runtime-env-sha256 <absent-or-sha256> \
  --expect-dropin-sha256 <absent-or-sha256>
```

Install behavior is intentionally narrow and fixed-path only:

- It has no CLI overrides for repository, user, release root, staging root, source env, runtime env, drop-in, unit, receipt root, or base URL.
- It requires euid 0 before mutation and uses the fixed root-private lock `/var/lib/buddy/release-state/lock`; `/run/lock` is not part of the release state.
- It bootstraps only the named Buddy roots from already trusted root-owned parents, with private state/staging/receipt directories mode `0700`.
- It validates the native `/etc/systemd/system/buddy.service` is a root-owned regular single-link file with exact mode `0600` or `0644`, the prior active/running service identity, positive `MainPID`, expected old `WorkingDirectory`, exact `FragmentPath=/etc/systemd/system/buddy.service`, normalized exact `ExecStart=/usr/bin/npm start`, `User=ubuntu`, expected `NODE_ENV` and `PATH`, `Restart=always`, actual `RestartUSec=10s`, no prior drop-ins or environment files, and sanitized effective identity before writes.
- It validates `/home/ubuntu/github/kid-friendly-ai/.env.local` is a regular, single-link uid `1001` mode `0600` file and rechecks its CAS before mutation.
- It accepts only `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and `VERCEL_OIDC_TOKEN` in that source file; duplicate keys, unknown keys, shell syntax, multiline values, and ambiguous unquoted values fail closed.
- It writes only `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, and `ELEVENLABS_API_KEY` to root-owned mode `0600` `/etc/buddy/runtime.env`; `VERCEL_OIDC_TOKEN` is deliberately omitted.
- It writes a scoped root-owned mode `0644` systemd drop-in with only `WorkingDirectory=/opt/buddy/releases/<FULL_SHA>` and `EnvironmentFile=/etc/buddy/runtime.env`.
- It operates only on `buddy.service`, refuses a new install while a prior nonterminal intent or unknown receipt phase exists, records an intent receipt before mutation under `/var/lib/buddy/release-receipts/`, persists private beforeimage bytes under `/var/lib/buddy/release-receipts/transactions/`, validates fixed-path public beforeimage metadata before stop (`runtime.env` absent or root `0600`, drop-in absent or root `0644`, native unit root `0600` or `0644`), preserves the native unit's exact bytes and mode without rewriting it, and records planned file digests without secret bytes.
- It captures the bounded old loopback baseline before writes; the verified old health 503 with `memory=false` is an accepted baseline and is not a refusal condition.
- It restarts Buddy only after CAS rechecking the source env, runtime env, drop-in, native unit, and preserved effective service identity before and between writes, then waits on fixed proxy-disabled `http://127.0.0.1:3000` checks for home 200, `/api/health` 200 with `memory=true` and `api=true`, and empty `/api/ask` 400.
- On failure after mutation it validates receipt and transaction hierarchy, verifies private beforeimage bytes and bounded public metadata, checks current files and effective service identity as before-or-planned before stopping, stops only `buddy.service`, verifies inactive with PID 0, restores exact prior drop-in/runtime-env presence and bytes, reloads systemd, starts the old service, proves prior `WorkingDirectory` and preserved properties with a positive PID, accepts the bounded old health baseline, and records `rolled_back` or `rollback_failed`. If restoration, start, identity proof, or health proof fails after the rollback stop succeeded, `rollback_failed` intentionally leaves Buddy fail-closed by best-effort stopping only `buddy.service` and recording bounded final `ActiveState`, `SubState`, and `MainPID`, or explicit unknown state if that read fails; it does not claim restoration.
- If an install is interrupted after the intent receipt, run `sudo python3 ops/buddy_oci_release.py rollback --receipt <receipt-basename>` from reviewed source. The rollback command reads only the fixed receipt root, restores from private beforeimage files, and writes an immutable terminal receipt.

The helper never prints credential values, never performs a provider request, never changes external routes, and never touches the protected mutable OCI checkout. Source preparation, runtime health, provider operation, route fencing, downstream client effect, rollback, and return remain separate gates.
