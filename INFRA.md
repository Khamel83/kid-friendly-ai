# Buddy infrastructure

OCI's reviewed release operator is installed under
`/opt/buddy-release-operators/08ceda61a3d670d2e417e409eadf57406857414e/ops/`:
four root0444 modules in root0555 directories, relative hash manifest
SHA256 `e7bc3f7bb0cedd088abc26f9a9db2572bcd27f3c6ab616679eb4207c45695051`.
Prepare refused before app publication; active `buddy.service` is unchanged.

- OCI currently runs the production `buddy.service` from `/home/ubuntu/github/kid-friendly-ai` on the system systemd manager. The checkout has protected unpublished app edits, so its `30ead698` Git HEAD alone is not a release identity.
- Four reviewed modules (CLI, primitives, Git and state) prepare outside the
  mutable checkout. Fixed paths: `/opt/buddy/releases/<SHA>`, state/lock under
  `/var/lib/buddy/release-state/`, staging under `/var/lib/buddy/release-staging/`,
  `/etc/buddy/runtime.env`, `/etc/systemd/system/buddy.service.d/10-release.conf`,
  receipts under `/var/lib/buddy/release-receipts/` and private beforeimages in
  its `transactions/` directory. Operator install is accepted; app install is open.
- Homelab is the recovery host. The [private rebuild procedure](docs/RECOVERY.md) uses a clean reviewed Git SHA, an isolated directory, no provider key, and a loopback port. This is a drill, not a public deployment.
- The app has no server-side database or durable file state in the inspected API routes. Browser preferences use client local storage. Verify this again if routes change.
- Production provider configuration is local to its host. Do not print or copy credential values into this repository or a recovery receipt.
- The public route, active OCI writer, and failback remain unchanged until the Homelab recovery contract's service gates pass.
