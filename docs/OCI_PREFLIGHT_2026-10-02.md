# Buddy OCI release preflight

At 20:18 UTC on October 2, parent readback confirmed the native
`/etc/systemd/system/buddy.service` is a root-owned regular single-link file,
mode `0600`, SHA-256
`5518d51faa8ab70ef2b3c7180b116e3a58781ae528578ed4712cd56ac2dac478`.

The source installer currently permits this existing mode at entry, while its
rollback validates only `0644`. This mismatch blocks deployment until source
validation consistently accepts the existing trusted `0600` file and preserves
its exact metadata through a tested rollback. Do not change the live file mode
to satisfy the helper. A bounded source correction is in progress; require a
new exact-head review after it lands. No release preparation, service restart,
environment projection or route change has occurred.
