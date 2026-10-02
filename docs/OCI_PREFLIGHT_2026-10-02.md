# Buddy OCI release preflight

On October 2, parent readback confirmed the native
`/etc/systemd/system/buddy.service` is a root-owned regular single-link file,
mode `0600`, SHA-256
`5518d51faa8ab70ef2b3c7180b116e3a58781ae528578ed4712cd56ac2dac478`.

The initial source installer permitted this mode at entry while rollback
validated only `0644`. The corrected source now validates exactly root-owned,
single-link `0600` or `0644` before intent and uses the same policy during
rollback. All 28 tests pass, including successful `0600` install and induced
post-write rollback with exact native metadata preserved. Independent review
also checked `0644` restoration. The native unit is never rewritten.

Ordinary parser variables were renamed to keep their non-secret expressions
visible through the existing reviewer redactor; its global secret rules remain
unchanged and synthetic secrets still redact. Every final file patch fits the
48,000-byte limit and the complete diff fits 180,000 bytes. Require a new
trusted final-head review. No release preparation, service restart, environment
projection or route change has occurred.
