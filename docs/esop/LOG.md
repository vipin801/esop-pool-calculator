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

[001] 2026-08-15 | prompt P2 | branch main | commit ec8a9f0 (sha backfilled by the follow-up commit, also covered by this entry)
Changed: Added the data layer at src/lib/esop: types.ts (full input and output shapes from ENGINE_SPEC.md), defaults.ts (v2 defaults table, every entry provenance-tagged), benchmarks.ts (advisory and observed tracks).
Changed: Added 39 tests across three files. Recorded model decisions M1 to M6 in PROJECT.md. Removed `passWithNoTests` from vitest.config.ts, closing an open item from [000].
Tests: 39 passed / 39 total, tsc pass, build pass
Decisions:
- M1 to M6 recorded in PROJECT.md. The two that will bite hardest later are M2 (what the two provenance tiers actually mean) and M6 (benchmark ladders are not partitions).
- The grant basis and strike policy forks are discriminated unions, not a flag plus two optional bags, so a rupee grant table cannot exist without the basis that gives it meaning.
- `PoolSizing` welds the pool percentage to the grantBasisKind and strikePolicyKind that produced it, so the PROJECT.md prohibition on a naked pool percentage is structural rather than a review-time check.
- `ComplianceFlag.disclaimer` is the literal type 'General information, not legal advice.', so a compliance row without the required wording does not compile.
- Statutory limits and solver parameters were pulled out of the defaults table into `STATUTORY` and `SOLVER` with no provenance tag, per M3.
Open items:
- **The prompt asked for a test that benchmark bands are "ordered and non-overlapping within a track". Non-overlapping is false for the data ENGINE_SPEC.md mandates, in both tracks.** Advisory states Series B as 15-18 and Series C+ as 15-20, which share a floor. Observed states Indian Series A and Series B both as "most below 10%", which makes them identical, and the growth-round average of 7.5-8% sits inside both. The spec wins over code, so the data was not altered and the test expectation was not quietly weakened. Instead each track declares its overlaps as data with a reason, and the test asserts found overlaps equal declared overlaps exactly, so any new overlap still fails loudly. Raised for a decision: leave as is, or restate the ladders as partitions in a future spec revision.
- Ordering is asserted as monotonic in a direction each track declares per geography, not as always-increasing. The observed India ladder decreases with stage, which is the spec's actual finding and the reason both tracks exist. An always-increasing assertion would have contradicted the source.
- `VestingSchedule.frequency` is carried but spec section 4.3 vests linearly after the cliff and models no tick, so the field is presentational until the engine uses it.
- `attritionByBandPct` sets only a leadership override. The spec calls for band overrides but gives no numbers for the other three, so they fall back to the base rate.
- Ten defaults are `provisional`, meaning the spec sets no v2 value: refreshRatePct, refreshSizePct, bufferPct, valuationGrowthPctPerYear, horizonYears, hiresPerYear, seniorityMixPct, grantValueByBand, attritionByBandPct, accountingBasis. Each needs a market check before launch.
- There is no assembled `DEFAULT_INPUTS: EsopInputs`. defaults.ts holds assumptions only; valuation, share count and existing pool are founder-entered, not defaults. Whoever builds the form or the engine will need a seed-input builder.
- No engine and no UI, per prompt scope. `EsopOutputs` is a shape with no producer yet.
