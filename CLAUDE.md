# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`esop-pool-calculator` — a Next.js 16 / React 19 app for modelling ESOP pool
sizing and dilution. Package manager is pnpm.

| Task      | Command          |
| --------- | ---------------- |
| Dev       | `pnpm dev`       |
| Build     | `pnpm build`     |
| Lint      | `pnpm lint`      |
| Typecheck | `pnpm typecheck` |
| Test      | `pnpm test`      |
| Coverage  | `pnpm coverage`  |

## gstack

This project uses [gstack](https://github.com/garrytan/gstack) for browsing,
QA, review, and shipping workflows.

### Web browsing

**Use the `/browse` skill from gstack for all web browsing.**

**Never use `mcp__claude-in-chrome__*` tools.** If you reach for a browser —
to QA the running app, check a page, read docs, or pull data from a site —
go through `/browse` instead.

### Available skills

**Planning & product**
- `/office-hours` — YC-style office hours on the product or a decision
- `/autoplan` — run the CEO, design, eng, and DX plan reviews back to back
- `/plan-ceo-review` — founder-mode plan review
- `/plan-eng-review` — eng manager-mode plan review
- `/plan-design-review` — designer's eye plan review
- `/plan-devex-review` — developer experience plan review

**Design**
- `/design-consultation` — propose a full design system with previews
- `/design-shotgun` — generate and compare multiple design variants
- `/design-html` — produce production-quality HTML/CSS
- `/design-review` — visual QA: spacing, hierarchy, inconsistency, AI slop

**Browsing & QA**
- `/browse` — headless browser for QA and dogfooding (the default browser)
- `/connect-chrome` — launch GStack Browser (Chromium + sidebar extension)
- `/setup-browser-cookies` — import real browser cookies into the browse session
- `/qa` — systematically QA the app and fix the bugs found
- `/qa-only` — same sweep, report only, no fixes
- `/benchmark` — performance regression detection

**Review, ship & deploy**
- `/review` — pre-landing PR review
- `/ship` — merge base, test, review, bump VERSION, changelog, commit, push, PR
- `/land-and-deploy` — land and deploy
- `/canary` — post-deploy canary monitoring
- `/setup-deploy` — configure deployment for `/land-and-deploy`
- `/devex-review` — live developer experience audit

**Debugging & docs**
- `/investigate` — systematic debugging with root cause analysis
- `/retro` — weekly engineering retrospective
- `/document-generate` — write missing docs from scratch
- `/document-release` — post-ship documentation update
- `/learn` — manage project learnings

**Safety & tooling**
- `/careful` — guardrails on destructive commands
- `/guard` — full safety mode: destructive warnings + directory-scoped edits
- `/freeze` — restrict edits to one directory for the session
- `/unfreeze` — clear the freeze boundary
- `/cso` — Chief Security Officer mode
- `/codex` — OpenAI Codex CLI wrapper
- `/setup-gbrain` — set up gbrain for this agent
- `/gstack-upgrade` — upgrade gstack to the latest version
