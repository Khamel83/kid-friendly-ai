# Buddy infrastructure

- OCI currently runs the production `buddy.service` from `/home/ubuntu/github/kid-friendly-ai` on the system systemd manager. The checkout has protected unpublished app edits, so its `30ead698` Git HEAD alone is not a release identity.
- Homelab is the recovery host. The [private rebuild procedure](docs/RECOVERY.md) uses a clean reviewed Git SHA, an isolated directory, no provider key, and a loopback port. This is a drill, not a public deployment.
- The app has no server-side database or durable file state in the inspected API routes. Browser preferences use client local storage. Verify this again if routes change.
- Production provider configuration is local to its host. Do not print or copy credential values into this repository or a recovery receipt.
- The public route, active OCI writer, and failback remain unchanged until the Homelab recovery contract's service gates pass.
