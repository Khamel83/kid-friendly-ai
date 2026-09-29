# Buddy clean rebuild and private drill

Buddy's OCI system `buddy.service` is active, but its checkout has unpublished staged and unstaged application edits. A clean GitHub SHA is therefore a **recovery candidate**, not a claim of exact production parity. Preserve that checkout.

On a clean machine, check out a reviewed SHA and transfer its tracked files to a disposable directory on Homelab. Do not transfer `.env` files or use the live OCI checkout. On Homelab:

```bash
cd /tmp/buddy-recovery-REVIEWED_SHA
npm ci --no-audit --no-fund
npm run build
bash ops/recovery-probe.sh 43117
```

The probe refuses local env files and an occupied port. It removes provider keys from its child process, binds only `127.0.0.1`, checks the home page and malformed `/api/ask` request, reports `/api/health`, and removes the private process. A 400 response for an empty question proves only input rejection; it is not an AI answer. Inspect the child process and port after the probe. Do not use the probe to route traffic or mark the service recovered.

The 2026-09-29 clean candidate `bb96c4c` built with package lock SHA-256 `1d95e3728e1059c8d4711750181385ce97aced8946f79b158f46a97a9957ad3e` on Homelab. Its private result was home 200, health 503, invalid question 400, with no provider key or provider request. The OCI private health endpoint also returned 503, with its memory check false. Its database and Redis checks are placeholder successes. This does not prove credentials, production parity, downstream AI operation, a public route, or return.

For a later cold swap, first reconcile and review OCI's unpublished edits. Build that exact release on Homelab, fix and verify private health, provide scoped credentials through the approved secret path, and prove a safe representative operation. Then exercise one active origin, a route switch, client effect, rollback, and return as specified in the [Homelab recovery contract](https://github.com/Khamel83/homelab/blob/main/docs/operations/OCI_HOMELAB_RECOVERY_CONTRACT.md).
