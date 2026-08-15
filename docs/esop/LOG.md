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

[002] 2026-08-15 | prompt P3 | branch main | commit 4ce9980 (sha backfilled by the follow-up commit, also covered by this entry)
Changed: Added the first engine math at src/lib/esop, covering ENGINE_SPEC.md sections 1, 2, 4.1 and 4.2. errors.ts (`EsopEngineError` with a closed 12-code union, plus input guards), valuation.ts (V_t, PPS_t and the market path), denominator.ts (X_t by strike policy and all three section 2 value bases), grants.ts (new hire demand and refresh demand under both bases).
Changed: Added 74 tests across seven files. Recorded M7 to M10 in PROJECT.md. No React anywhere, enforced by a test rather than by convention.
Tests: 113 passed / 113 total, tsc pass, build pass
Decisions:
- M7 to M10 recorded in PROJECT.md. M7 is the one that changes an answer: section 4.2's refresh formula divides by `D_t`, which is Basis B's shape. Applied literally under Basis A it would drag the valuation into a percent-of-equity plan and section 1 would be false, so refresh mirrors the fork.
- Basis A's independence from valuation is structural, not a promise kept by care. `GrantYear` carries no price per share, and `newHireGrantDemandBasisA` and `refreshGrantDemandBasisA` take no price, no denominator and no growth rate, so a valuation has no route into them. The dispatcher accepts a denominator under Basis A and never reads it; a test passes one and asserts the result reports `denominator: null`.
- The headline test lives in its own file, `grant-basis-invariance.test.ts`, and asserts exact equality rather than closeness, because under Basis A both runs execute identical arithmetic on identical inputs. It also asserts the price per share moved 27-fold over the same path, so the test cannot pass by doing nothing.
- The realisable denominator refuses a degenerate spread with a typed error rather than returning a number (M8). `allDenominatorsForYear` carries that refusal as data, so a UI can price notional and fair value and say why realisable is missing instead of catching an exception.
- Every error code is reachable from a real engine call, asserted in errors.test.ts, so a code cannot rot into a comment that no path produces and no UI handles.
Open items:
- **"Fair value sits between notional and realisable" is not universal, and the UI must not assume it.** It holds only when `X_t > (1 - theta) * PPS_t`, that is, a near-the-money strike, which is the case the spec is talking about. At a face value strike against a high price per share, fair value demand exceeds realisable. Both directions are tested. Someone has to decide how the three lines are ordered on screen at a face value strike.
- Spec section 8 wants a warning when the founder sets the strike at FMV and picks the notional basis. `EngineWarningId` has the id; nothing raises it yet, because no warning surface exists.
- `theta` is an input defaulting to 0.55 and is not derived from `expectedLifeYears` and `volatilityPct`, which `FairValueAssumptions` carries and the engine does not read. Either wire a Black-Scholes to them or drop them.
- `lastRoundPrice` takes `X_t` from the modelled `PPS_t` of the grant year, not from an actual round in `rounds`. When section 4.6 lands, the strike should come from the round schedule, not from the smooth growth path.
- The refresh eligible base is an input, because section 4.3 cohort tracking is what produces it and that is not built. `eligibleByBandFromTenures` is a stopgap for callers holding a roster.
- Hires stay fractional: 15 hires at a 5% leadership mix is 0.75 leadership hires. Correct for demand, wrong for any headcount readout, and rounding it would change the plan rather than describe it.
- A mix that does not sum to 100 silently loses hires by design; `seniorityMixSumsTo100` exists for the caller to raise the existing warning. Nothing calls it yet.
- No fixed point yet (4.5), so nothing closes the loop where `FD_t` contains the pool. valuation.ts takes `FD_t` per year rather than deriving it, for exactly that reason.
- Still open from [000]: `esop-engine-spec-v2.md` sits at the repo root beside the canonical copy at docs/esop/ENGINE_SPEC.md, and there is no CLAUDE.md pointing a session at PROJECT.md.

[003] 2026-08-15 | prompt P4 | branch main | commit 31d126c (sha backfilled by the follow-up commit, also covered by this entry)
Changed: Added src/lib/esop/rounds.ts, covering ENGINE_SPEC.md section 4.6: the closed form for T, I, dP and the investor's price; both pool conventions; the cap table at all three stages of a round; the delta between the conventions; and a round schedule that chains each round onto the cap table the last one closed with.
Changed: Extended types.ts with `PreRoundHoldings`, `CapTableTotal`, `PoolShuffleCapTables`, and the fields section 4.6 needs on `PoolShuffleOutcome` and `PoolCostToFounders`. Added five error codes. Added 39 tests across two files plus a shared cap table balance assertion. Recorded M11 to M14.
Tests: 152 passed / 152 total, tsc pass, build pass
Decisions:
- M11 to M14 recorded in PROJECT.md. M11 and M12 are the two that change what a founder reads.
- **The prompt asked for a test that the two pool conventions "produce identical total fully diluted shares but different founder percentages". Those two cannot hold together.** The founders are issued no shares by either convention, so their share count is the same in both and their percentage is that count over the post-round total. Identical totals force identical percentages; different percentages force different totals. This is not a property of the implementation, and no arrangement of the maths can satisfy both. The expectation was not weakened and the model was not bent: `pool-shuffle.test.ts` asserts the strongest true statement in that place, which is that the totals differ, the founder percentages differ, and the founders' share count is unchanged, with a comment giving the reason.
- The two conventions do coincide exactly, totals and percentages alike, in one case: when no new pool is created. That is the same identity as the prompt's second test, seen from the other side, and it is asserted directly. The algebra: `T_postMoney = T_preMoney` if and only if `U = pi*T`, which is `dP = 0`.
- The spec's `dP/T` is the pool's footprint on the post-round company, not the founders' own percentage loss, which is smaller because the existing pool and the granted options are diluted alongside them. Both are returned, named apart, and M12 says which one the UI leads with. On the worked example the spec measure is 0.17 percentage points and ₹8.4 lakh; what the founders actually keep is 1.09 points and ₹54.5 lakh. Leading with the first would understate the headline by six times.
- Valuing pool dilution at `Vpre + R` under both conventions (M11) is what keeps the delta pointing the right way. Marking the post-money pool at the investor's own purchase price, which is the other reading of "at that round's price per share", makes the founder-friendly convention come out ₹15.7 lakh *dearer* and inverts the headline.
- `investorPctOfFullyDiluted` is this round's investor only, not the register. The `investors` cap table row is cumulative, so the two differ from the second round onwards and the spec's `I/T = R/(Vpre+R)` identity is asserted on the former.
- The schedule chains on `round.poolCreation`, the structure actually being offered. The counterfactual is per round and is not carried forward, because a founder who wins that argument once has a different company from then on and the number is meant to be what winning it that once is worth.
Open items:
- **The contradiction above needs a decision.** Either the intended test was "identical totals when no new pool is created", which is implemented and passing, or the intended comparison was something other than the two conventions. Nothing was skipped in the meantime.
- Cap tables carry four rows: founders, investors, granted options, unallocated pool. `CapTableHolder` also has `exercisedShares`, which stays empty until section 4.3 lands. When it does, exercised options become issued shares, join `S_ex`, and need a fifth row, or the cap table will silently understate the issued count.
- `dP` is not clamped and can be negative (M14). Nothing yet warns the founder that a term sheet asking for less pool than they already reserve implies shrinking the reserve, which needs a board decision and is not automatic.
- Shares stay fractional (M14). Every display of a share count needs a rounding rule, and the rounded rows will not always sum to the rounded total. That is a presentation problem to solve once, in one place.
- `existingPoolPostRoundPct` is the right comparison for an investor's demand (M13) and nothing surfaces it yet. It is also spec output item 3, the top-up needed at the next round, which `dP` already gives in shares.
- The round engine takes the pre-round cap table as an input. Nothing yet feeds it from the grant demand in 4.1 and 4.2, because the roll forward (4.4) and the fixed point (4.5) are what connect them.
- Closing an earlier open item from [002]: `lastRoundPrice` still takes `X_t` from the smooth growth path rather than from a round in this schedule. The schedule now exists, so that wiring is available whenever the strike policy is revisited.
