# Current checkpoint — 2026-09-29

**Source:** GitHub `origin/main` at `bb96c4c` was the clean rebuild candidate. The live OCI app is Git HEAD `30ead698` plus protected staged and unstaged `ask.ts`, UI, and hook changes. They have not been reconciled; the source release is not identical to the active runtime. The public GitHub deploy job failed before setup in run `36558812433`, so it is no deployment receipt.

**Deployed runtime:** OCI system `buddy.service` remained active. Its private home page returned 200 and health returned 503 (memory check false). On Homelab, a disposable clean `bb96c4c` build returned home 200, health 503, and empty-question 400 on loopback with provider keys removed. The Homelab process and port were removed after the probe. No persistent Homelab service or public route was changed.

**Durable receipt:** This source record and `docs/RECOVERY.md` describe the bounded drill. No scheduled backup is required for the inspected stateless server routes; no deployed app receipt or cold-swap packet exists.

**Downstream effect:** No provider call, AI response, client route change, or failback was tested. No spend was incurred by the probe.

Next: reconcile OCI's protected app edits into a reviewed release without modifying that checkout. Rebuild the exact release and repair the health check. Then install an inactive private Homelab service with scoped credentials, prove a safe operation, and follow the Homelab route/fence/return contract. Recheck with `systemctl show buddy.service -p ActiveState -p WorkingDirectory`, `git -C /home/ubuntu/github/kid-friendly-ai status --short`, and `curl http://127.0.0.1:3000/api/health` on OCI. Do not print credential values.
