# Agent instructions

Read `INFRA.md` before infrastructure changes.
<!-- janitor:begin:capability -->
## Shared agent capability: g2k

g2k is the shared remote model-routing and GitHub issue-to-PR capability for
this workspace.

A model may be running locally on the Mac or another machine, but g2k's
provider access, unattended workers, routing, state, and credentials live on
the OCI VM. Local machines are callers or observers, not alternate g2k homes.

Use g2k/OMP when available instead of creating another provider integration.
Use GitHub issues and pull requests for durable work. Do not assume that local
provider credentials, filesystem state, or a local g2k daemon exists. See
`INFRA.md` for the machine-specific access path and boundaries.
<!-- janitor:end:capability -->
<!-- janitor:begin:working-docs -->
## Keep the working docs current

Update these files whenever they become wrong, not on every turn, and commit
them with the work they describe:

- `TODO.md`: when you start, finish, add, or drop a task. Mark finished items
  `[x]` with evidence; strike dropped items with a reason.
- `CONTEXT.md`: when the owner makes a decision or the verified state changes.
- `HANDOFF.md`: before you stop or hand off: what is done, what is in flight,
  the next step, and the commands that recheck it.
- `INFRA.md`: when a host, service, port, credential location, or deploy path
  changes.

Keep one current checkpoint and replace superseded facts. Keep each long
writeup in a dated history/evidence file and link it from the relevant record.
For document-size warnings or compaction, follow the
[working-document contract](https://github.com/Khamel83/docs/blob/main/templates/WORKING_DOCUMENTS.md).
Preserve previous bytes, active decisions and every unresolved task.

A change is not done until it is deployed and verified. If the repository has
a deploy command or automation, run it (or confirm it ran) and check the
result. Registration steps the deploy depends on (for example a consumer list
or catalog entry) are part of the change. Never leave a "remember to run X"
step for the owner; if something truly needs the owner, write it in
`HANDOFF.md` as a blocker with the exact command.

infra owns active repository membership and explicit PR merge exclusions.
Janitor's standing worker merges every PR type after the latest trusted,
non-dismissed OCI reviewer Bot PASS for the exact current commit. A stale,
superseded or contradictory PASS does not qualify. It uses GitHub's normal merge endpoint
and records independent readback. Labels, authors and changed paths do not
restrict eligibility. infra owns improvements to the reviewer and PASS
process. Verify the merged PR and its merge receipt before reporting completion.
<!-- janitor:end:working-docs -->
<!-- janitor:begin:fresh-source -->
## Start from the current remote branch

At the start of repository work, run `git fetch origin` and discover the actual
default branch with `git ls-remote --symref origin HEAD`; do not assume its name.
Start each new branch or
worktree from the fetched `origin/<default>` commit. If fetch fails, report
that source freshness is unknown before starting new changes. Preserve a dirty,
diverged, or active checkout; use a separate worktree for new work instead of
moving its branch or files. Check the fetched source commit again before a
release or a claim that source is current.
<!-- janitor:end:fresh-source -->
<!-- janitor:begin:global-work -->
## Source records for the global work view

This repository owns its work in TODO.md and GitHub issues and pull requests.
The global view reads the default branch and native GitHub records; it does
not own another task list. Keep completed evidence with its source links.
Use stable task IDs when available. Explicit GitHub links identify related
records; matching text alone does not establish a dependency or completion.
A pull request that finishes a TODO line puts `Closes-TODO: <the line's text>`
in its body; a TODO line that gets its own issue or PR carries that full URL.
After merge, Janitor ticks such lines and appends the evidence link.
Development progress and runtime acceptance are separate facts. Missing or
stale source evidence stays unknown. Generated summaries must not become new
copies of the underlying tasks. Janitor distributes this contract; Infra's
catalog defines project membership and lifecycle.
<!-- janitor:end:global-work -->
