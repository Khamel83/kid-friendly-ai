# Current checkpoint — 2026-09-29

**Source:** Buddy [PR #19](https://github.com/Khamel83/kid-friendly-ai/pull/19) merged as `cab8cfb` after exact-head Janitor PASS and Node 18/20 CI PASS on `16c6f1e`. The candidate preserves child-facing cloud restrictions and local/TTS controls, and repairs SSE errors, current history, and local-to-cloud fallback. The final protected OCI app-file SHA-256 prefixes are index `1986b521`, ask `03aa9b31`, mode `1ef15e1a`; no OCI file was reset. Current OCI active checkout remains `30ead698` with staged/unstaged edits, so this reviewed source is not proven identical to the running artifact.

**Deployed runtime:** OCI system `buddy.service` was active at `30ead698` on the 2026-09-29 recheck; private health remained 503. An exact `16c6f1e` tracked-source archive built on Homelab with package lock SHA-256 `1d95e372…`; keyless loopback probe gave home 200, health 503 (`memory=true`, `api=false`), and empty-question 400. Probe process, port, and scratch were removed; Homelab recovery unit stayed inactive. No production route or active OCI runtime changed.

**Durable receipt:** Private Homelab `/mnt/main-drive/backups/project-state/buddy/recovery-drills/20260929T232428Z.json`, SHA-256 `d6f718166731108c00097f26c40f2598b99226f843a0a5c6662cc6fd3d5ba73a`, records the isolated probe. No scheduled backup is required for the inspected stateless server routes; no active deployment or cold-swap packet exists.

**Downstream effect:** No provider call, AI response, client route change, or failback was tested. No spend was incurred by the probe.

**Checks:** Focused SSE tests 2/2, changed-file ESLint, production build, exact-head Janitor review, and Node 18/20 CI passed. Repository-wide lint/type checks still fail in unrelated pre-existing files (`ContentUpdates.tsx`, `disabled-tests/*.ts`); CI treats those two checks as nonblocking. The keyless probe made no provider request and did not prove an AI answer.

Next: establish exact running-artifact/source parity without discarding the protected OCI patch; then deploy the reviewed health fix to the active service. Install a persistent inactive Homelab release with scoped provider credentials, verify a bounded real operation, and prove route fencing and return under the Homelab recovery contract. Recheck OCI with `systemctl show buddy.service -p ActiveState -p WorkingDirectory`, `git -C /home/ubuntu/github/kid-friendly-ai status --short`, and `curl http://127.0.0.1:3000/api/health` without printing credentials.
