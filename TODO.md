<!-- janitor:begin:todo -->
# Current work

- [x] Prepare guarded Buddy-only release source: root copied-tree verification,
  manifest binding, exact failed-stage cleanup, native unit modes and
  systemd255 environment-file flags.40 tests/independent review pass.
- [ ] Obtain final-head trusted PASS/Node18/20 CI, merge and run reviewed OCI
  prepare/install; protected dirty checkout remains untouched.

- [x] Reconcile the protected OCI app edits in reviewed source without resetting the active checkout: [PR #19](https://github.com/Khamel83/kid-friendly-ai/pull/19) merged as `cab8cfb` after exact-head review and Node 18/20 CI. The keyless exact-source Homelab drill passed home 200, memory=true, and invalid ask 400; health 503 reflects deliberately absent provider credentials. See [HANDOFF.md](HANDOFF.md).
- [ ] Compare the exact reviewed release to the OCI running artifact and preserve the staged/unstaged patch before any active deployment. A Git HEAD alone is not parity evidence.
- [ ] Deploy and verify the reviewed `/api/health` memory calculation fix on the active app after source parity is resolved. The live OCI endpoint still returns 503; the database and Redis checks are placeholders, not dependency proof.
- [ ] Declare scoped provider credentials on Homelab without copying or printing the OCI secret. Then prove a private, safe representative response with an explicit no-spend or bounded-spend decision.
- [ ] Install the reviewed release as an inactive private Homelab service, then prove route fencing, client path, rollback, and return under the [Homelab recovery contract](https://github.com/Khamel83/homelab/blob/main/docs/operations/OCI_HOMELAB_RECOVERY_CONTRACT.md).

The clean source rebuild and no-provider loopback probe are recorded in [HANDOFF.md](HANDOFF.md); they do not close these gates.
<!-- janitor:end:todo -->
