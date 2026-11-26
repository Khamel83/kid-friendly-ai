# Paused

## Buddy public route (buddy.khamel.com)

- Paused: Nov 26 2026, by the owner ("just pause this").
- What: Buddy is not linked from the kids hub (Khamel83/dada#74 hides "Talk to Buddy"). No route work is in flight.
- Why: the route is dead. buddy.khamel.com DNS points at a retired OCI address, the OCI tunnel has no Buddy ingress, and the app returned 503.
- Restore trigger: the owner decides the Buddy route (public, Cloudflare Access, or hidden).
- Restore action: fix DNS and the tunnel ingress (Infra owns Cloudflare keys), fix the 503, release, then revert the hub pause in Khamel83/dada (set `KIDS_HUB_AI_URL`, see its docs/PAUSED.md).
- Decide by: 2026-12-26. If no route exists by then, the owner decides to keep it hidden or retire Buddy; record that here.
- Tracking: Khamel83/dada#48.
