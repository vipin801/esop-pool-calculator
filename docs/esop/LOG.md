# LOG

Append-only. Newest at the bottom. Never edit or delete a past entry; if something was
wrong, say so in a later entry.

One entry per commit, including commits made by hand. If you find an unlogged commit,
log it before doing anything else.

Ids increment by one and are never reused. Ids are zero-padded to three digits.

This is the only log in the repo. Never create a second one anywhere.

Entry template:

```
[000] YYYY-MM-DD | prompt Pn | branch <name> | commit <sha>
Changed: one or two lines
Tests: n passed / n total, tsc pass|fail, build pass|fail
Decisions: any decision made this session, or none
Open items: anything spotted and deliberately left
```

The `commit <sha>` field names the commit that carries the entry's work. Because a commit
cannot contain its own hash, the sha is backfilled by a small follow-up commit, which the
same entry covers. Both shas are listed.

---

[000] 2026-08-15 | prompt P1 | branch main | commit c407b7c (sha backfilled by the follow-up commit, also covered by this entry)
Changed: Initialised the repo. Scaffolded Next.js 16.3.1 App Router, React 19.2.8, strict TypeScript, pnpm 11.21.0, Vitest 3.2.7, with test/typecheck/build scripts. No UI library, no feature code.
Changed: Added docs/esop/ENGINE_SPEC.md (byte-identical copy of esop-engine-spec-v2.md), docs/esop/PROJECT.md, docs/esop/LOG.md.
Tests: 0 passed / 0 total, tsc pass, build pass
Decisions:
- Confirmed with the founder: Next.js 16 App Router, pnpm, Vitest, its own new repo, route `/tools/esop-pool-size`, branch `main`.
- Locked D1 to D6 in PROJECT.md.
- TypeScript strictness goes past `strict: true`: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `allowJs: false`. A money engine should not silently index past the end of an array.
- `typecheck` runs `next typegen && tsc --noEmit`, because Next generates `LayoutProps` and friends into `.next/types` and a bare `tsc` fails on a clean checkout.
- No UI library added, per prompt. The styling stack is undecided.
Open items:
- The Magic Patterns export at `C:\Users\Vipin\Desktop\How big should your ESOP pool be` is read but not ported. Its input model contradicts the spec in five places, all of which need resolving before any engine code: (1) `GrantBasis = 'fixed' | 'ctc'` is not the spec's Basis A percent-of-equity vs Basis B rupee-value fork, so it violates D1; (2) a single `dpiit: boolean` where D4 requires two toggles; (3) no `strikePolicy` field at all, so D2 has no control; (4) defaults are v1 values, attrition 18% against the spec's 15% and lapse 35% against 50%, and there is no post-termination exercise window; (5) no funding round schedule, so the pool shuffle in spec 4.6, the highest-value output, has no inputs.
- The export is React 18 + Vite + Tailwind 3 + recharts + jspdf + html2canvas. Target is Next.js 16 + React 19. Tailwind v3 vs v4 and the chart library are open choices.
- `passWithNoTests: true` in vitest.config.ts. Remove it the moment the engine has its first test, or the suite will stay green while doing nothing.
- `esop-engine-spec-v2.md` still sits at the repo root next to the canonical copy at docs/esop/ENGINE_SPEC.md. Two copies can drift. Left untouched because the prompt said not to modify it.
- No CLAUDE.md or AGENTS.md. create-next-app generated boilerplate ones and they were removed rather than shipped unread. A short CLAUDE.md pointing every session at docs/esop/PROJECT.md would enforce standing rule 1 automatically.
- `git config user.email` was the placeholder `your@email.com`. Set repo-locally to vipinsharma12233@gmail.com so commits attribute correctly.
- The route `/tools/esop-pool-size` does not exist yet. No feature code was written this session.
