# LLM Overview — kid-friendly-ai
*Updated: 2026-05-10 07:35 UTC | Tier: standard | Auto-updated: daily cron*

## What This Is
A safe, interactive, and educational AI companion designed specifically for children aged 6-12. Built with modern web technologies and child-friendly interfaces.

## Current State
*Status: 🟢 active from local git history*

**Active work:**
- 451988c chore: bootstrap LLM-OVERVIEW files 2026-05-10
- 30ead69 fix: click-to-talk toggle + voice card styles + silence auto-stop
- f690640 feat: add dual-mode AI — local (Mac Mini) + free cloud (OpenRouter)
- a155268 feat: improve Space & Emoji games with more questions and better UX
- 064f923 Add Space Explorer and Emoji Detective games to make it less boring
- 941f9bb feat: remove TTS, add icons, update prompt for age 7

**Known issues:**
- No known issue found in recent commit subjects or local TODO/BLOCKERS docs.

**Recent changes (7 days):**
- `451988c chore: bootstrap LLM-OVERVIEW files 2026-05-10`

## Architecture
- Stack marker: Node/JavaScript
- Stack marker: Docker Compose service
- Stack marker: Vercel deployment
- Stack marker: systemd service
- Top-level entry: `__tests__/`
- Top-level entry: `API_REFERENCE.md`
- Top-level entry: `ARCHITECTURE.md`
- Top-level entry: `aws/`
- Top-level entry: `buddy.service`
- Top-level entry: `CONTRIBUTING.md`
- Top-level entry: `deploy-docker.sh`
- Top-level entry: `deploy.sh`

## Key Commands
- `npm run dev  # next dev`
- `npm run build  # next build`
- `npm run start  # next start`
- `npm run lint  # next lint`
- `npm run lint:fix  # next lint --fix`
- `npm run type-check  # tsc --noEmit`
- `npm run format  # prettier --write .`
- `npm run format:check  # prettier --check .`
- `npm run test  # jest`
- `npm run test:watch  # jest --watch`

## Dependencies
- **Runs on:** Not declared in local repo evidence.
- **Calls out to:** See repo docs and config files.
- **Called by:** Not declared in local repo evidence.
- **Env vars required:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VERCEL_URL`, `NODE_ENV`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`

## Critical Rules
- Preserve repo-local instructions in `AGENTS.md`, `CLAUDE.md`, or README when present.
- Do not infer behavior from the repository name alone; verify against local docs and source.

## Gotchas
- Generated from local evidence only: git history, top-level structure, README/CLAUDE/AGENTS/docs, and env examples.
