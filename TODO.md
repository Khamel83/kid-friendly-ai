<!-- janitor:begin:todo -->
# Current work

- [ ] Merge the reviewed source reconciliation, then compare its exact release to the protected OCI running artifact before any active deployment. The OCI patch was preserved by file hash and reviewed: keep cloud-mode restrictions and the existing local/TTS controls; reject its nonexistent `/api/check-local` call, unbuffered SSE parsing, and extra CSS brace. The clean release repairs SSE error handling, current conversation history, and local-to-cloud fallback without resetting `/home/ubuntu/github/kid-friendly-ai`.
- [ ] Deploy and verify the reviewed `/api/health` memory calculation fix on the active app after source parity is resolved. The live OCI endpoint still returns 503; the database and Redis checks are placeholders, not dependency proof.
- [ ] Declare scoped provider credentials on Homelab without copying or printing the OCI secret. Then prove a private, safe representative response with an explicit no-spend or bounded-spend decision.
- [ ] Install the reviewed release as an inactive private Homelab service, then prove route fencing, client path, rollback, and return under the [Homelab recovery contract](https://github.com/Khamel83/homelab/blob/main/docs/operations/OCI_HOMELAB_RECOVERY_CONTRACT.md).

The clean source rebuild and no-provider loopback probe are recorded in [HANDOFF.md](HANDOFF.md); they do not close these gates.
<!-- janitor:end:todo -->
