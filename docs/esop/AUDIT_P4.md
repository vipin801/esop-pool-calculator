# AUDIT P4

Adversarial audit of the ESOP pool engine as at commit `0c1e716`, covering everything
built in LOG entries [000] to [004]. Nothing in `src/` was changed by this session.
Seven mutations were applied and reverted; the tree is verified clean at the end.

Date: 2026-08-15 · Branch: `main` · HEAD: `0c1e716`
Baseline: 253 passed / 253 total, `tsc` pass, production build pass.

---

## 1. Repo and log hygiene

### Commits against LOG entries

Ten commits, five log entries. The LOG convention is one entry per *pair*: a feature
commit plus the follow-up commit that backfills its sha.

| Entry | Feature commit | Backfill commit | Covered |
|---|---|---|---|
| [000] | `c407b7c` chore: scaffold repo and set source of truth | `fd4487c` | yes |
| [001] | `ec8a9f0` feat(esop): add the data layer | `2376463` | yes |
| [002] | `4ce9980` feat(esop): add valuation, denominator and grant demand | `7143f63` | yes |
| [003] | `31d126c` feat(esop): add the round schedule and the pool shuffle | `6cee636` | yes |
| [004] | `d4606c8` feat(esop): add cohort tracking, the roll forward and the pool solver | `0c1e716` | yes |

**Commits with no log entry: none.**
**Log entries with no commit: none.**

One defect. `LOG.md:25` states the convention as "Both shas are listed." No entry lists
both. Every entry header carries only the feature sha and the parenthetical "(sha
backfilled by the follow-up commit, also covered by this entry)". The backfill shas above
were recovered from `git log --name-status`, not from the log. The preamble promises
something the entries do not deliver — see defect 10.

### Branches

`git branch -a` returns exactly one line: `* main`. No sibling branches, no detached
work, no stashes (`git stash list` empty). PROJECT.md standing rule 2 holds.

### Log files

`git ls-files` filtered on `log|journal|changelog|history|notes|diary|worklog|devlog|
scratch|todo` returns exactly one path: `docs/esop/LOG.md`. The same search over the
working tree (excluding `node_modules`, `.next`, `.git`) returns the same single file.
No CHANGELOG, no build journal, no second log. PROJECT.md standing rule 3 holds.

### Uncommitted work

`git status --porcelain --untracked-files=all` is empty. `git diff HEAD --stat` is empty.
The untracked `~$op-engine-spec-v2.md` Word lock file recorded as an open item in [004]
is gone. The `.gitignore` still has no `~$*` rule, so it will reappear in `git status`
the next time the root copy of the spec is opened.

### Merge and push

**Not applicable.** `git remote -v` returns nothing; no remote is configured. There is
nothing to push to and nothing to merge from. Standing rule 2's "never leave work on an
unmerged branch" is satisfied vacuously — all work is on `main`.

### One further hygiene note

`esop-engine-spec-v2.md` still sits at the repo root beside `docs/esop/ENGINE_SPEC.md`.
They are byte-identical today — both hash to `aed7eed4db0f097abfb1912a95a689e844677d3b` —
but nothing tests that, so they can drift silently. Open since [000]. There is still no
`CLAUDE.md`, so standing rule 1 depends entirely on the operator remembering it.

---

## 2. Spec conformance

Section by section. File and line refer to `src/lib/esop/`.

### Section 1 — the grant basis fork

| Spec clause | Where | Verdict |
|---|---|---|
| Basis A / Basis B as two conventions | `types.ts:99-111` (discriminated union) | implemented |
| `N_t` under Basis A | `grants.ts:177-205` | implemented |
| `N_t` under Basis B | `grants.ts:208-233` | implemented |
| Fork dispatch | `grants.ts:249-270` | implemented |
| Advisory ranges CXO/VP 0.3-1.5, senior 0.15-0.3, mid 0.05-0.15, junior 0.02-0.1 | `defaults.ts:166-177` | implemented |
| "Basis A pool consumption is completely independent of valuation" | structural: `grants.ts:177-205` takes no price, no denominator, no growth. Proven at `__tests__/grant-basis-invariance.test.ts:111-126` and again through the roll forward at `__tests__/roll-forward.test.ts:288-300` | implemented |
| "Default Basis A for pre-seed and seed, Basis B for Series A and later" | `defaults.ts:136-147`, accessor `defaults.ts:302-303` | **partial** — the table exists; no engine code reads it. There is no assembly point that turns a `Stage` into a preselected basis. |
| "Show the other basis as a comparison line" | `pool-solver.ts:280-301` | implemented, with a documented caller obligation: the comparison grant table must be supplied because the selected union arm carries only its own. |
| "Never silently pick one" | structural (union, no default arm) | implemented |

### Section 2 — denominator by strike policy

| Spec clause | Where | Verdict |
|---|---|---|
| `X_t` from `faceValue \| lastRoundPrice \| discountToFMV` | `denominator.ts:53-86` | implemented |
| notional `D_t = PPS_t` | `denominator.ts:110-111` | implemented |
| realisable `D_t = PPS_t - X_t` | `denominator.ts:113-128` | implemented, with an added guard (`MIN_REALISABLE_SPREAD_FRACTION_OF_PPS`, `denominator.ts:44`) that the spec does not describe — recorded as M8 |
| fair value `D_t = theta_t * PPS_t` | `denominator.ts:130-139` | implemented |
| theta default 0.55 for 4-year life, 60% volatility | `defaults.ts:216-233`, `denominator.ts:33` | implemented as a value |
| "Theta approaches 1 as the strike approaches zero" | nowhere | **missing.** `theta` is a free scalar input, range-checked only (`denominator.ts:131-137`). It is not a function of the strike, the expected life or the volatility. `FairValueAssumptions.expectedLifeYears` and `.volatilityPct` (`types.ts:179-180`) are carried and never read by any engine module. Open since [002]; no model decision covers it. |
| "compute all three value bases" | `denominator.ts:180-211` | implemented |
| "Display notional as the headline, realisable underneath" | nowhere | **missing** (presentation; no UI in scope). Nothing in the returned record expresses ordering or headline status. |
| Face value as the practical floor | `denominator.ts:75`, `denominator.ts:83` | implemented, extended past the spec to every policy — recorded as M9 |

### Section 4.1 — new hire grants

`grants.ts:177-270`. Hires split from the mix at `grants.ts:138-143`; wired into the roll
forward at `roll-forward.ts:454-462`. **Implemented.** Both formulae match the spec term
for term, including `(1+i)^t` (`grants.ts:126-135`).

### Section 4.2 — refresh grants

`grants.ts:277-435`. `Eligible_t` is produced by cohort tracking at `cohorts.ts:640-662`
and wired at `roll-forward.ts:464-476`.

**Implemented under Basis B, divergent under Basis A.** The spec writes `R_t` with a
`/ D_t`, which is Basis B's shape. Under Basis A the implementation applies `pct_b` to
`FD_t` instead (`grants.ts:332-366`). This is deliberate and recorded as M7: applied
literally, the spec formula would make Basis A demand move with the valuation and make
section 1 false. The divergence is correct and documented; it is listed here because the
code does not match the spec's text.

The per-band form the code uses, `sum_b [Eligible_b · rate · size · G_b · (1+i)^t / D_t]`,
is algebraically identical to the spec's `Eligible_t · rate · size · Gbar · (1+i)^t / D_t`
because `Gbar` is defined as the headcount-weighted mean (`grants.ts:319-324`). Verified.

### Section 4.3 — cohort tracking

| Spec clause | Where | Verdict |
|---|---|---|
| `age = t - s` | `cohorts.ts:316` | implemented |
| `v = 0` if `age < c/12`; else `clamp((age - c/12)/(k - c/12), 0, 1)` | `cohorts.ts:94-127` | implemented, literally — `v` is 0 *at* the cliff, not 25%. Flagged as an open decision in [004]. |
| `leavers = a_b * O_cohort` | `cohorts.ts:325-327` | implemented |
| unvested forfeited / vested lapsed / vested exercised three-way split | `cohorts.ts:329-331` | implemented |
| recycling switch | `cohorts.ts:338-339` | implemented |
| exercised leg becomes issued shares | `roll-forward.ts:513`, `roll-forward.ts:538` | implemented |
| "Plus exercises by continuing employees, default 0" | `cohorts.ts:335-336` | implemented, but the expression multiplies by the mid-year `exposure`, which contradicts M17 — see defect 5 |
| "required, do not approximate" | `roll-forward.ts:165-198` refuses a granted balance with no cohorts (`missingOpeningCohorts`) and cohorts that do not add up (`openingCohortsMismatch`) | implemented |
| `a_b` band overrides | `cohorts.ts:161-180` | implemented |
| sector overrides | `defaults.ts:322-327` | **partial.** The table exists; `AttritionInputs.sector` is never read by the engine. Deliberate (M16) — the sector is meant to prefill the base rate through `baseAttritionPctForSector`, which nothing calls. |

Two conventions in the code that the spec does not describe, both documented:
mid-year attrition exposure (`cohorts.ts:145-150`, M17) and non-recycled forfeitures
leaving `FD_t` (`roll-forward.ts:514`, M18).

### Section 4.4 — roll forward

`roll-forward.ts:366-571`. The equation `Available_t = Available_(t-1) + TopUp_t - N_t -
R_t + Returned_t` is at `roll-forward.ts:431`, `478`, `511`. Exhaustion interpolation at
`roll-forward.ts:285-315`. **Implemented.**

Not in the spec, and documented: the pricing-count convention (`roll-forward.ts:429-441`,
M19) and `hiresSupported` on `PoolExhaustion` (`types.ts:363`).

### Section 4.5 — recommended pool, fixed point

| Spec clause | Where | Verdict |
|---|---|---|
| `K = (sum_t (N_t + R_t - Returned_t)) * (1 + buffer)` | `pool-solver.ts:167-170` | implemented, with the net consumption floored at zero (`pool-solver.ts:167`), which the spec does not state |
| `pool% = (K - existing) / (FD_0 + max(0, K - existing))` | `pool-solver.ts:173` | implemented |
| iterate from 10% | `defaults.ts:64`, `pool-solver.ts:201` | implemented |
| tolerance 0.01 percentage points | `defaults.ts:65`, `pool-solver.ts:231` | implemented |
| max 25 iterations | `defaults.ts:66`, `pool-solver.ts:205` | implemented |
| return the iteration count | `pool-solver.ts:255-260` | implemented |
| round the displayed figure up to the nearest 0.5% | `pool-solver.ts:66-74`, `defaults.ts:68` | implemented |
| "the fixed point still applies under Basis A" | `pool-solver.ts:83-98` inverts against `FD_0` regardless of basis | implemented |

Not in the spec: the `MAX_POOL_PCT = 99.9` cap and the non-convergence exit
(`pool-solver.ts:52`, `pool-solver.ts:220`), documented as M20. **Divergent detail:** the
reported percentage and the reported option count are taken from different turns of the
crank — see defect 2.

### Section 4.6 — funding round schedule and the pool shuffle

| Spec clause | Where | Verdict |
|---|---|---|
| `T = S_ex / (1 - pi - R/(Vpre+R))` | `rounds.ts:246-255` | implemented |
| `I = T * R/(Vpre+R)` | `rounds.ts:259` | implemented |
| `dP = pi*T - U` | `rounds.ts:209-210` | implemented, unclamped (M14) |
| `investor price = Vpre / (S_ex + pi*T)` | `rounds.ts:261` | implemented |
| "founder dilution attributable to the pool = dP / T" | `rounds.ts:213` | implemented |
| "its cash cost at that round's price per share" | `rounds.ts:226` | implemented, valued at `(Vpre+R)/T` under both conventions per M11 |
| "if the pool is created post-money instead, recompute ... and show the delta" | `rounds.ts:273-292`, `rounds.ts:335-360` | implemented |
| chained schedule | `rounds.ts:386-424` | implemented |

Not in the spec, documented: `founderOwnershipDelta*` (M12), `existingPoolPostRoundPct`
(M13), the three-state `PoolShuffleCapTables` (`types.ts:540-549`).

### Spec with no code behind it

- §2 theta as a function of strike/life/volatility (above).
- §5 compliance rules in their entirety. `ComplianceFlag` (`types.ts:582-590`) and
  `ComplianceInputs` (`types.ts:243-263`) are shapes with no producer. `companyType`,
  `instrument`, `incorporationDate`, `grantsToGroupCompanyEmployees`,
  `anyIndividualGrantAtOrAbove1Pct` and `accountingBasis` are never read by any engine
  module.
- §5 / PROJECT.md "Block any input below 12 months." Not blocked — see defect 4.
- §6 "Vested options never exercised ... **linked to the exercise window input**."
  `exerciseWindowDays` (`types.ts:222`) is never read. Lambda is a free input. Choosing a
  30-day window and a 5-year window produce identical numbers. No model decision covers
  this gap, unlike the equivalent sector gap which has M16.
- §7 output items 3, 6, 8, 9, 10 and 11 have types and no producers:
  `TopUpRequirement`, `CapTableSet`, `EsopExpenseYear`, `ComplianceFlag`,
  `BenchmarkComparison`, `MedianEmployeeValue`. `EsopOutputs` (`types.ts:655-670`) has no
  producer at all.
- §8 guardrail warnings. `EngineWarningId` (`types.ts:643-648`) declares five ids and
  nothing raises any of them, including `solverDidNotConverge`, which the solver now
  genuinely produces, and `notionalValueOverstatesReceipt`, which §8 names explicitly.

### Code the spec does not describe

Beyond the documented M-decisions listed inline above: the provenance system
(`types.ts:740-764`, from PROJECT.md D6 rather than the spec), the typed error surface
(`errors.ts:14-65`, 24 codes), `intentionalZero`, `GrantDemand.basisKind`,
`RollForwardYear`'s two fully-diluted counts, and `seniorityMixSumsTo100`
(`grants.ts:151-153`), which nothing calls.

---

## 3. Defaults and benchmarks against the v2 table

### Spec §6 table, value by value

| Assumption | Spec v2 | Code | Provenance | Verdict |
|---|---|---|---|---|
| Attrition, base | 15% | `defaults.ts:78` = 15 | estimate | match |
| Attrition, band overrides | "band overrides", no numbers | `defaults.ts:84` `{leadership: 10}` | provisional | match |
| Attrition, sector | IT services 13-15, e-commerce 25-28 | `defaults.ts:90` `{general: 15, itServices: 14, ecommerce: 26.5}` | estimate | match (M1 midpoints; `general` = base rate, which the spec does not name) |
| Vested never exercised | 50% | `defaults.ts:98` = 50 | estimate | match |
| … range | 30-70% | `defaults.ts:104` `{min: 30, max: 70}` | estimate | match |
| … "linked to the exercise window input" | required | not implemented | — | **mismatch** (defect 8) |
| Post-termination exercise window | 90 days default | `defaults.ts:110` = 90 | estimate | match (value only; never read) |
| … options | 30, 90, 365, 1825 | `types.ts:82` | n/a | match |
| Strike policy | face value at seed, last round price at Series A+ | `defaults.ts:155-161` | estimate | match |
| Continuing-employee exercises | 0 pre-liquidity | `defaults.ts:116` = 0, `intentionalZero: true` | estimate | match |
| Benchmark bands, advisory | 5-8 / 8-12 / 12-15 / 15-18 / 15-20 | `benchmarks.ts:33-37` | estimate | match, exactly |
| Benchmark bands, observed | IN A <10, IN B <10, IN growth 7.5-8, US C/D 16-17 | `benchmarks.ts:69-102` | provisional | match, exactly |

### Values the spec names inline

| Value | Spec | Code | Provenance | Verdict |
|---|---|---|---|---|
| `i`, comp inflation | 8% (§3) | `defaults.ts:131` = 8 | estimate | match |
| theta | 0.55 (§2) | `defaults.ts:217` | estimate | match |
| expected life | 4 years (§2) | `defaults.ts:223` | estimate | match |
| volatility | 60% (§2) | `defaults.ts:229` | estimate | match |
| refresh eligibility | 24 months (§4.2) | `defaults.ts:191` | estimate | match |
| Basis A range, low | 0.3 / 0.15 / 0.05 / 0.02 (§1) | `defaults.ts:167` | estimate | match |
| Basis A range, high | 1.5 / 0.3 / 0.15 / 0.1 (§1) | `defaults.ts:173` | estimate | match |
| Basis A point | midpoints (M1) | `defaults.ts:179` `{0.9, 0.225, 0.1, 0.06}` | estimate | match; midpoints verified arithmetically |
| solver start / tol / max / display step | 10 / 0.01 / 25 / 0.5 (§4.5) | `defaults.ts:63-69` | untagged (M3) | match |
| statutory limits | §5 | `defaults.ts:40-56` | untagged (M3) | match, all six |

### Provenance mismatches

Under M2, `estimate` means the spec states the value or it is advisory consensus;
`provisional` means the spec sets no v2 value, or the figure is an unverified dated
observation.

1. **`recycleForfeited: true` is tagged `estimate` (`defaults.ts:122-127`).** The spec sets
   no default for recycling — §4.3 only says "returns to pool if recycling on". The
   justification given is "Most Indian schemes recycle", which is an unsourced market
   claim, not a spec value. It should be `provisional`. This is not cosmetic: the solver
   test at `__tests__/pool-solver.test.ts:111-121` shows recycling off producing a
   strictly larger recommended pool, so this default moves the headline number, and it is
   not on the [001] list of ten to-dos before launch.
2. **`vestYears: 4` is tagged `estimate` (`defaults.ts:242`)**, justified as "the Indian
   market convention". The spec states no vesting length. The "4 year expected life" in
   §2 is the Black-Scholes life behind theta, a different quantity. Borderline; argue
   for `provisional`.
3. **`vestFrequency: 'monthly'` is tagged `estimate` (`defaults.ts:248`)** while its own
   `what` says the spec "does not model a tick". A default the spec does not model is a
   placeholder. Argue for `provisional`.
4. `cliffMonths: 12` (`defaults.ts:236`) and `sector: 'general'` (`defaults.ts:282`) are
   tagged `estimate` on similar reasoning. Both are defensible — 12 is the statutory floor
   and `general` means "no adjustment" — but neither is a spec-stated default.

The ten entries [001] recorded as `provisional` are all still `provisional` and all still
correct: `attritionByBandPct`, `grantValueByBand`, `refreshRatePct`, `refreshSizePct`,
`bufferPct`, `horizonYears`, `hiresPerYear`, `seniorityMixPct`,
`valuationGrowthPctPerYear`, `accountingBasis`.

### No default is silently zero

**Confirmed.** Exactly one numeric leaf across the whole table is zero:
`continuingEmployeeExercisePctPerYear` (`defaults.ts:116-121`), and it carries
`intentionalZero: true`. `__tests__/defaults.test.ts:47-75` enforces this in both
directions and pins the marked set to that single key, so a second silent zero cannot
appear without a red test. One limitation worth knowing: `numericLeaves`
(`__tests__/defaults.test.ts:19-23`) descends exactly one level, so a nested
record-of-records default would escape the check. No such default exists today.

### Neither benchmark track is more authoritative

**Confirmed structurally.** Both tracks use the same `BenchmarkTrack` shape
(`types.ts:722-734`), which carries no rank, weight, authority, priority or default
field. `BenchmarkTrackComparison` (`types.ts:600-606`) likewise. `BENCHMARK_TRACKS`
(`benchmarks.ts:140-143`) is a two-tuple with an explicit comment that declaration order
is not precedence. `__tests__/benchmarks.test.ts:84-103` asserts both tracks have
identical key sets and greps every key name against nine authority words. No engine code
reads either track — nothing consumes them yet, so nothing can prefer one.

One asymmetry worth a decision, not a failure: the advisory track is tagged `estimate`
and the observed track `provisional` (`benchmarks.ts:29`, `benchmarks.ts:66`). Under M2
that is the correct application of the two tiers, but a UI that surfaces provenance will
show the opinion track as more settled than the data track. D5 says neither is presented
as the truth; a "needs verification" badge on only one of them cuts against that.

---

## 4. Mutation testing

Seven mutations, each applied to a single source expression, run against the full suite,
then reverted. `--testTimeout=120000` was passed so that a timeout could not be mistaken
for a genuine catch.

| # | Mutation | Site | Test that caught it | Result |
|---|---|---|---|---|
| a | Remove `(1+i)^t` from Basis B new-hire grant demand | `grants.ts:223` | `grants.test.ts` › 4.1 new hire grants, Basis B › inflates the grant value by (1+i)^t | **caught** (1 file, 1 test) |
| b | Vested fraction ignores the cliff, `v > 0` before it | `cohorts.ts:122-126` | `cohorts.test.ts` › vestedFraction › is zero before the cliff; › is still zero at the cliff itself; › runs linearly from the cliff; › vests everything in one step; › a pool-wide average is not the same answer (×2); › the mid-year convention › halves first-year recycling; `roll-forward.test.ts` › the exercised leg › consumes authorised capital headroom | **caught** (2 files, 8 tests) |
| c | Mid-year convention → full-year exposure in the grant year | `cohorts.ts:149` | `cohorts.test.ts` › the mid-year convention › charges a cohort half a year; › halves first-year recycling; › extreme attrition › empties a cohort over its grant year; `roll-forward.test.ts` › the mid-year convention, at the roll forward level (×2) | **caught** (2 files, 5 tests) |
| d | Force `recycleForfeited` to true regardless of input | `cohorts.ts:285` | `cohorts.test.ts` › recycling › cancels them instead when it is off; `roll-forward.test.ts` › the bucket identity › only lets the fully diluted count shrink when options are cancelled; `pool-solver.test.ts` › recycling (×2), › converges › is answering a real question; `engine-invariants.test.ts` › conservation › never returns an exercised option to the pool | **caught** (4 files, 6 tests) |
| e | **Remove the unallocated pool from `FD_t` in the price-per-share denominator** | `roll-forward.ts:440` | — | **MISSED — suite stayed fully green, 16/16 files, 253/253 tests** |
| f | Create the pool post-money while still labelling it pre-money | `rounds.ts:205-207` | `rounds.test.ts` › the closed form (all 6); › cap tables › runs before, pool, round; › rounds the engine refuses › investor and pool take the whole company; `pool-shuffle.test.ts` (6 tests); `errors.test.ts` › every declared error code | **caught** (3 files, 16 tests) |
| g | Cap table percentages sum to 99 instead of 100 | `rounds.ts:100` | `rounds.test.ts` › cap tables › balances at every stage; › the schedule › balances every cap table; `pool-shuffle.test.ts` › balances every cap table under both conventions | **caught** (2 files, 3 tests) |

**Six of seven caught. Mutation (e) is an untested invariant.**

### Mutation (e) in detail

The change, at `roll-forward.ts:438-441`:

```
-      fullyDilutedShares: openingFullyDiluted,
+      fullyDilutedShares: openingFullyDiluted - available,
```

`available` at that point is the unallocated pool plus this year's top-up. ENGINE_SPEC.md
§3 defines `FD_t` as "fully diluted shares at end of year t, **including unallocated
pool**", and `valuation.ts:80-84` restates it: "FD_t includes the unallocated pool, so a
bigger pool means a lower price per share for the same valuation." Removing it is exactly
the classic dilution error the fixed point exists to model.

The suite did not notice. What the mutation actually does to the founder-facing answer, on
the repo's own fixture:

| Figure | Clean | Mutated | Change |
|---|---|---|---|
| Recommended pool, Basis B | 14.5231% | 12.2271% | **−2.30 percentage points** |
| Displayed pool, Basis B | **15.0%** | **12.5%** | one half-point step down, then another |
| Recommended options, Basis B | 1,699,207 | 1,393,040 | **−18.0%** |
| Solver iterations | 5 | 2 | — |
| Recommended pool, Basis A | 11.7846% | 11.7846% | unchanged, correctly |

Basis A is untouched because it never consults a price per share — that part of the design
holds. But under Basis B, which is the default from Series A onward, the headline number a
founder reads moves by 2.3 points and the whole suite stays green.

Why nothing catches it:

- `grant-basis-invariance.test.ts` builds its own market path and never calls
  `runRollForward`, so the roll forward's pricing line is outside it.
- `roll-forward.test.ts:302-319` only asserts that a flat-growth Basis B plan consumes
  more than twice a steep-growth one. That inequality survives.
- `pool-solver.test.ts:50-69` re-derives the answer from the roll forward's own totals, so
  it is self-consistent at any price per share.
- The 500-case invariants check finiteness and sign, not value.

**No test anywhere asserts a price per share produced by `runRollForward`.**
`__tests__/valuation.test.ts` tests `pricePerShare` in isolation with a hand-supplied
share count; nothing checks which share count the roll forward hands it.

### Revert verification

Every mutation was reverted immediately after its run. Final state:

```
git status --porcelain --untracked-files=all   ->  (empty)
git diff HEAD --stat                           ->  (empty)
git branch -a                                  ->  * main
git stash list                                 ->  (empty)
```

Every tracked blob under `src/lib/esop` was compared with `git hash-object` against
`git rev-parse HEAD:<path>` — all identical. Suite re-run after the last revert: **253
passed / 253 total**, `tsc` pass, production build pass.

Two disclosures about how the reverts were done:

1. Reverting with `git checkout -- src/lib/esop` under this repo's `core.autocrlf=true`
   rewrote the four touched files (`grants.ts`, `cohorts.ts`, `roll-forward.ts`,
   `rounds.ts`) from LF to CRLF in the working tree. I converted them back to LF, which
   made `git status` report them as modified with an empty content diff, so I restored the
   canonical checkout form. Net effect: those four files now hold CRLF on disk where they
   previously held LF. The committed blobs are byte-identical, `git status` is clean, and
   any future commit is unaffected. No other file was touched.
2. To measure coverage I installed `@vitest/coverage-v8@3.2.7` and then reverted
   `package.json` and `pnpm-lock.yaml` with `git checkout`. The package remains in
   `node_modules`, which is gitignored. Remove it with `pnpm install --frozen-lockfile` if
   you want a pristine tree.

---

## 5. Test quality

### Tests that assert only that something is defined, truthy or not-null

One test qualifies fully:

- `__tests__/defaults.test.ts:110-116` — "covers every stage" asserts only
  `toBeDefined()` on `DEFAULT_GRANT_BASIS_BY_STAGE[stage]` and
  `DEFAULT_STRIKE_POLICY_BY_STAGE[stage]`. Both records are `Readonly<Record<Stage, …>>`,
  so the compiler already guarantees total coverage; the test cannot fail. The test
  immediately below it (`:118-123`) asserts the actual values, which is the useful check.

One assertion qualifies inside an otherwise substantive test:

- `__tests__/benchmarks.test.ts:143` — `expect(trend).toBeDefined()`, followed at `:144`
  by a length check on the note. The pair does real work.

Six `toBeNull()` assertions were reviewed and are **not** weak: `grants.test.ts:305`,
`grant-basis-invariance.test.ts:172`, `pool-solver.test.ts:306` and
`cohorts.test.ts:360` assert the *absence* of a denominator, value basis or grant year,
which is the spec behaviour under Basis A and for opening cohorts. `roll-forward.test.ts:
225-226` asserts a non-exhausted pool reports no month. All four are load-bearing.

### Tests whose expected value is computed by calling the function under test

These pass by construction if the test restates the implementation's arithmetic; they
prove internal consistency, not correctness.

| Test | What it does |
|---|---|
| `pool-solver.test.ts:85-96` | "reports the option count and the percentage from the same run" asserts `poolOptions ≈ bufferedRequirementOptions - 600_000`. That is a literal restatement of `pool-solver.ts:244`. It cannot fail. It also does not check the thing its name implies — see defect 2. |
| `pool-solver.test.ts:50-69` | "reproduces itself when fed back in" re-derives `K` and `pool%` from `solution.rollForward`'s own totals — the same run the solver used. It re-executes the solver's formula on the solver's own output. |
| `pool-solver.test.ts:259-271` | "produces an answer that reproduces itself, on every case" calls `solveRecommendedPool` twice on equal inputs and compares. That is a determinism check, not a fixed-point check; the name overstates it. |
| `grants.test.ts:252-272` | "matches the spec formula" builds `expected` from `demand.eligibleHeadcount` and `demand.averageGrantPerEligible` — two outputs of the function under test — plus `compInflationFactor` from the same module. |
| `grants.test.ts:289-307` | Same pattern for the Basis A refresh arm. |
| `cohorts.test.ts:139-144`, `:161-166` | Sum and difference `entry` fields against other `entry` fields. Bookkeeping checks only. |
| `cohorts.test.ts:146-153` | Computes `v` by calling `vestedFraction`, then asserts `entry.vestedFraction` equals it — a tautology, since `stepGrantCohort` calls `vestedFraction`. The three lines below it do real work. |
| `roll-forward.test.ts:86-100` | Reconciles opening + top-up − grants + returns into closing, all from `RollForwardYear` fields. Would catch a bookkeeping leak; would not catch a wrong `N_t`. |
| `roll-forward.test.ts:148-163` | `authorisedCapital.requiredShares` against `closingIssued + closingGranted + closingAvailable`, both sides from the same result object. |
| `denominator.test.ts:174-192` | Compares `denominatorForYear` against `exercisePriceAtYear` + `denominatorFor`. An equivalence between a composition and its parts. |
| `valuation.test.ts:108-132` | Compares `buildMarketPath` entries against `marketYear`. Same pattern. |
| `engine-invariants.test.ts:187-198` | `returnedToPool` against `unvestedForfeited + vestedLapsed`, both engine outputs. This one does have teeth — it caught mutation (d). |
| `__tests__/cap-table-balance.ts:12-23` | Rows against total, both engine outputs. Also has teeth — it caught mutation (g). |

The last two show the distinction that matters: a self-referential assertion is only
worthless when the two sides come from the same expression. When they come from different
code paths that must agree, it is a real invariant.

### Golden fixtures generated by the engine rather than derived independently

I re-derived every hard-coded numeric expectation in the round tests from the spec's
closed form and they all check out, so none of them is an engine-generated golden in the
dangerous sense:

- `rounds.test.ts:69,74,77,78,84,101,102` — `12,307,692.3077 = 8,000,000/0.65`;
  `6.875 = 0.15 − 1,000,000/T`; `40.625 = 400,000,000/9,846,153.85`;
  `34,375,000 = 0.06875 × 500,000,000`. All hand-derivable.
- `pool-shuffle.test.ts:76,77,179,195,196,198,208,209` — `52.8125 = 6.5e6/12,307,692.31`;
  post-money `T = (8e6 + 2.25e6)/0.85 = 12,058,823.53`, giving `53.9024`, `18.6585`,
  `6.7073`, `0.1677`, `1.0899` and `5,449,695`. All hand-derivable; I checked each.
- `roll-forward.test.ts:263,273-275` — `229,500` and `15,525` are recomputed inside the
  test from the mix and the band percentages rather than pasted.
- `cohorts.test.ts:259,260,265,266` — `7.5 / 8.75 / 22.5 / 21.25` all fall out of
  `v = 0`, `v = 1` and `v = (2.75 − 1)/3` by hand.

Two thresholds **are** calibrated from the implementation, and the file says so:

- `pool-solver.test.ts:245` — `expect(worst).toBeLessThanOrEqual(12)`, with a comment
  stating "The observed worst case is 7". A number read off a run.
- `pool-solver.test.ts:256` — `expect(withAPool.length).toBeGreaterThan(150)`. Likewise.

Both are legitimate regression guards and both are disclosed. They are listed here for
completeness, not as defects.

One weak golden: `roll-forward.test.ts:430` asserts
`closingIssuedShares >= 8_900_000` against an exactly computable 8,900,000. An inequality
where an equality was available.

### Engine module line coverage

Measured with `@vitest/coverage-v8@3.2.7`, scoped to `src/lib/esop/**/*.ts` excluding
`__tests__`.

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|--------
All files        |   97.39 |    97.82 |   95.29 |   97.39
 benchmarks.ts   |     100 |      100 |     100 |     100
 cohorts.ts      |   87.13 |      100 |   82.35 |   87.13
 defaults.ts     |   99.15 |      100 |       0 |   99.15
 denominator.ts  |   98.05 |    95.23 |     100 |   98.05
 errors.ts       |   97.64 |    92.85 |     100 |   97.64
 grants.ts       |     100 |      100 |     100 |     100
 pool-solver.ts  |     100 |    94.73 |     100 |     100
 roll-forward.ts |   99.68 |    96.72 |     100 |   99.68
 rounds.ts       |     100 |      100 |     100 |     100
 types.ts        |     100 |      100 |     100 |     100
 valuation.ts    |     100 |      100 |     100 |     100
```

**Engine line coverage: 97.39%.**

Uncovered lines, all of them:

| Lines | What | Note |
|---|---|---|
| `cohorts.ts:131-132` | `cliffMeetsStatutoryMinimum` | never called by engine or test — see defect 4 |
| `cohorts.ts:522-538` | `approximateOpeningCohortsFromTotal` | the M21 escape hatch, wholly untested |
| `cohorts.ts:586-609` | `openingHeadcountCohorts` | wholly untested; the roll-forward tests and the fuzz generator both build `HeadcountCohort` literals by hand, so this constructor's `+ MID_YEAR_EXPOSURE_YEARS` tenure convention has never been executed |
| `defaults.ts:326-327` | `baseAttritionPctForSector` | the M16 form hook, untested |
| `denominator.ts:202-203` | non-`EsopEngineError` rethrow | defensive, effectively unreachable |
| `errors.ts:149-150` | `requireFinite` throw path | no input in any test makes a checked value non-finite |
| `roll-forward.ts:299` | exhaustion when the grant run rate is zero | reachable only with a negative carry-in; untested |

Coverage is high, but as mutation (e) shows, executed is not the same as asserted:
`roll-forward.ts:438-441` is 100% covered and 0% tested.

---

## 6. Hand reconciliation

### Case 1 — one hire, one band, zero attrition, zero growth, zero refresh, one year, Basis B notional

Inputs. `FD_0` = 1,00,00,000 shares. `V_0` = ₹1,000 crore. One leadership hire in year 0,
mix 100% leadership. `G_leadership` = ₹80,00,000. `i` = 8% (inert at `t = 0`). `g` = 0%.
Refresh rate 0%. Attrition 0%. Horizon 1 year. Strike face value ₹10. Value basis
notional. Buffer 0%. Existing unallocated pool 0.

**The roll forward, by hand.**

```
PPS_0 = V_0 / FD_0        = 10,00,00,00,000 / 1,00,00,000  = ₹1,000
D_0   = PPS_0                                              = ₹1,000   (notional)
(1+i)^0                                                    = 1
N_0   = H · G · (1+i)^0 / D_0 = 1 × 80,00,000 × 1 / 1,000  = 8,000 options
R_0   = 0    (refresh rate 0, and nobody has 24 months' tenure in year 0)
Returned_0 = 0    (attrition 0, so no leavers, so nothing forfeits or lapses)
Available_0 = 0 + 0 − 8,000 − 0 + 0                        = −8,000
```

**Engine output.** `pricePerShare` 1000 · `denominator` 1000 · `newHireGrants` **8000** ·
`refreshGrants` 0 · `returnedToPool` 0 · `closingAvailable` −8000.

**Exact match on every figure.**

**The fixed point, by hand.** Let `p` be the pool percentage and `n = FD_0 · p/(100 − p)`
the options it materialises (`pool-solver.ts:97`). The roll forward then prices at
`FD_0 + n`, so

```
PPS = V / (FD_0 + n)
N   = G / PPS = G · (FD_0 + n) / V
K   = N                       (buffer 0)
p'  = 100 · (K − 0) / (FD_0 + K)
```

At a fixed point the pool the model asks for equals the pool it was priced at, `n = N`:

```
N (V − G) = G · FD_0
N = G · FD_0 / (V − G)
  = 80,00,000 × 1,00,00,000 / (10,00,00,00,000 − 80,00,000)
  = 8 × 10^13 / 9,99,20,00,000
  = 8,006.405124…  options
```

and the percentage collapses to a clean identity, because `FD_0 + N = FD_0 · V/(V − G)`:

```
p = 100 · N / (FD_0 + N) = 100 · G / V
  = 100 × 80,00,000 / 10,00,00,00,000
  = 0.08000000 %
```

**Engine output.** `poolPctOfFullyDiluted` = **0.08000704857834721 %** ·
`poolOptions` = **8,006.405688888889** · `displayPoolPctOfFullyDiluted` = 0.5 ·
`iterations` 2 · `converged` true.

**The hand figure and the engine figure differ.**

| | Hand | Engine | Difference |
|---|---|---|---|
| Pool % | 0.08000000 | 0.08000705 | +7.05 × 10⁻⁶ percentage points |
| Pool options | 8,006.405124 | 8,006.405689 | +0.00056 options |

This is not an arithmetic error, and I am not going to inflate it into one. It is the
spec's own convergence tolerance: §4.5 sets 0.01 percentage points, the solver stops when
two consecutive iterates move less than that (`pool-solver.ts:231`), and it stopped after
the second turn with a residual 1,400 times smaller than the tolerance allows. Every
figure in the roll forward — the part with no iteration in it — matches to the last bit.

What the difference *does* expose is a real inconsistency, and it is the reason the
percentage and the option count disagree with each other rather than both being slightly
off in the same direction. `poolOptions` is recomputed from the final run
(`pool-solver.ts:238-244`) and lands on the true fixed point to seven significant figures:
`100 × 8,006.4057 / (1,00,00,000 + 8,006.4057) = 0.08000001 %`. `poolPctOfFullyDiluted`
is the last loop iterate (`pool-solver.ts:251`) and is 0.08000705%. The two fields of the
same `PoolSizing` object describe two different pools. See defect 2.

### Case 2 — one pool shuffle, round numbers

Inputs. Founders 70,00,000 · earlier investors 15,00,000 · granted options 5,00,000 ·
unallocated pool 10,00,000. So `S_ex` = 90,00,000 and `FD` = 1,00,00,000.
Round: `Vpre` = ₹90 crore, `R` = ₹10 crore, post-money ₹100 crore,
`r = R/(Vpre+R)` = 0.10, `pi` = 20%.

**Pre-money pool, by hand.**

```
T   = S_ex / (1 − pi − r) = 90,00,000 / (1 − 0.20 − 0.10) = 90,00,000 / 0.70
    = 1,28,57,142.857143
I   = T · r  = 0.10 × T                                    = 12,85,714.285714
piT = 0.20 × T                                             = 25,71,428.571429
dP  = piT − U = 25,71,428.571429 − 10,00,000               = 15,71,428.571429
investor PPS = Vpre/(S_ex + piT) = 90,00,00,000 / 1,15,71,428.571429
             = 700/9                                       = ₹77.777778
post-round PPS = (Vpre+R)/T = 100,00,00,000 × 0.70 / 90,00,000
             = 700/9                                       = ₹77.777778   (equal, as it must be)
dP/T = pi − U/T = 0.20 − 10,00,000 × 0.70/90,00,000 = 0.20 − 7/90 = 11/90
     = 12.222222 percentage points
cost = (11/90) × 100,00,00,000                             = ₹12,22,22,222.22
founder % = 70,00,000/T = 70,00,000 × 0.70/90,00,000 = 4.9/9 = 54.444444 %
investor % = I/T = r                                       = 10.000000 %
```

**Post-money pool, by hand.**

```
investor PPS = Vpre/(S_ex + U) = 90,00,00,000 / 1,00,00,000 = ₹90.000000
I   = R / 90 = 10,00,00,000/90                              = 11,11,111.111111
T   = (S_ex + I)/(1 − pi) = (90,00,000 + 11,11,111.111111)/0.80
    = 9,10,00,000/7.2                                       = 1,26,38,888.888889
piT = 0.20 × T                                              = 25,27,777.777778
dP  = 25,27,777.777778 − 10,00,000                          = 15,27,777.777778
dP/T = 0.20 − 10,00,000 × 7.2/9,10,00,000 = 0.20 − 7.2/91 = 11/91
     = 12.087912 percentage points
founder % = 70,00,000 × 7.2/9,10,00,000 = 50.4/91           = 55.384615 %
```

**The two deltas, by hand.**

```
spec dP/T delta      = 11/90 − 11/91 = 11/8190 = 0.001343101
                     = 0.134310 percentage points
                     = ₹13,43,101.34  at ₹100 crore post-money
founder-ownership delta = 50.4/91 − 4.9/9 = 7.7/819 = 0.009401709
                     = 0.940171 percentage points
                     = ₹94,01,709.40
```

**Engine output, side by side.**

| Figure | Hand | Engine | Match |
|---|---|---|---|
| pre `T` | 1,28,57,142.857143 | 12857142.857142856 | yes |
| pre `I` | 12,85,714.285714 | 1285714.2857142857 | yes |
| pre `pi·T` | 25,71,428.571429 | 2571428.5714285714 | yes |
| pre `dP` | 15,71,428.571429 | 1571428.5714285714 | yes |
| pre investor PPS | 77.777778 | 77.77777777777779 | yes |
| pre post-round PPS | 77.777778 | 77.77777777777779 | yes |
| pre `dP/T` | 12.222222 | 12.222222222222221 | yes |
| pre cost | 12,22,22,222.22 | 122222222.22222222 | yes |
| pre founder % | 54.444444 | 54.44444444444445 | yes |
| pre investor % | 10.000000 | 10 | yes |
| post investor PPS | 90.000000 | 90 | yes |
| post `I` | 11,11,111.111111 | 1111111.111111111 | yes |
| post `T` | 1,26,38,888.888889 | 12638888.88888889 | yes |
| post `dP` | 15,27,777.777778 | 1527777.777778 | yes |
| post `dP/T` | 12.087912 | 12.087912087912088 | yes |
| post founder % | 55.384615 | 55.38461538461538 | yes |
| `deltaPctPoints` | 0.134310 | 0.13431013431013383 | yes |
| `deltaRupees` | 13,43,101.34 | 1343101.3431013376 | yes |
| `founderOwnershipDeltaPctPoints` | 0.940171 | 0.9401709401709297 | yes |
| `founderOwnershipDeltaRupees` | 94,01,709.40 | 9401709.401709298 | yes |

**All twenty figures match to floating-point precision.** The round engine is the
strongest part of this codebase.

---

## 7. Edge behaviour, run rather than read

All of the following were executed against the engine in this session.

### Zero pool

`existingUnallocatedOptions: 0`, under both grant bases:

```
{"exhausted":true,"yearIndex":0,"monthIndex":0,"hiresSupported":0}
```

**Confirmed.** Zero hires supported, exhaustion at month 0, not a positive month. The
`monthIndex > 0` failure mode would come from `roll-forward.ts:296-299` if the run rate
were mishandled; it is not.

### 0% and 100% attrition

| Attrition | Roll forward | Solver | Wall clock |
|---|---|---|---|
| 0% | 4 years, `totalReturnedToPool` 0 | 16.16985% in 5 iterations, converged | 4 ms |
| 100% | 4 years, `totalReturnedToPool` 14,53,500 | 0% in 2 iterations, converged | 1 ms |

**Both terminate.** The 0% case correctly produces a larger pool than the 15% baseline
(nothing ever comes back); the 100% case correctly produces none (churn returns more than
the plan consumes). Neither spins, neither throws, neither produces a non-finite number.

### The solver's non-convergence path

Reachable from a real input — fifty leadership hires a year at 20% of the company each:

```
{"iterations":2,"converged":false,"tolerancePctPoints":0.01,"maxIterations":25}
poolPctOfFullyDiluted = 97.83940773844927
```

**Not dead code, and it is tested** (`pool-solver.test.ts:205-219`). Two things about it
are worth flagging rather than passing.

First, LOG [004] line 120 states this case "comes back at 10% flagged rather than at 99.9%
pretending." It comes back at **97.84%**. The entry describes behaviour the engine does
not have, and 97.84% is barely distinguishable from the 99.9% the entry says it avoids.
See defect 3.

Second, the test that covers this path asserts only `converged === false`, finite,
`>= 0` and `< 100` — so nothing pins the returned value, and nothing would notice if it
became 99.89%.

### Fuzz, 500 valid random inputs

I ran a fresh fuzz — seeds 90,001 to 90,500, disjoint from the repo's own 1–500 — through
`runRollForward`, `solveRecommendedPool`, and additionally through `shuffleRound`,
`poolCostToFounders` and `runRoundSchedule`, which the repo's own fuzz never touches. Every
numeric leaf of every returned object was walked recursively.

```
FUZZ rounds exercised: 500 of 500
FUZZ problems: 0
```

**No NaN, no Infinity, no negative share count on any output field**, across roll forward,
solver and round engine. The only fields permitted to go negative were the two documented
deficit fields, the year-axis offsets, and the round engine's `dP`-derived measures that
M14 explicitly allows to be negative.

Note for the record: the repo's own 500-case fuzz (`engine-invariants.test.ts`) covers
`roll-forward.ts` and `pool-solver.ts` only. `rounds.ts` has no property or fuzz coverage
in the repo at all — see defect 11.

---

## 8. Boundaries

### Framework isolation

`grep -rnE "from '(react|react-dom|next|next/)" src/lib/esop/` → **no matches.**
`__tests__/purity.test.ts:42-54` enforces this on every file in the directory with a
regex over all import specifiers, plus `:56-64` for `'use client'` / `'use server'`
directives, plus `:36-40` that every file is `.ts` and therefore cannot render.
**PASS.** No React, no Next, no UI library anywhere under `src/lib/esop`.

### `any` in types.ts

`grep -rnE ':\s*any\b|<any>|as any|any\[\]|Array<any>' src/lib/esop/` → **no matches** in
`types.ts` or anywhere else in the engine. The only occurrences of the string "any" are
two English words in comments (`types.ts:7`, `types.ts:708`). `tsconfig.json` runs past
`strict: true` with `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch` and `allowJs: false`, and `npm run typecheck` passes.
**PASS.**

### PROJECT.md prohibitions, one by one

| # | Prohibition | Result |
|---|---|---|
| 1 | Never state or imply DPIIT recognition alone gives the perquisite tax deferral | **PASS.** Every mention of DPIIT in `src/` is the Rule 12 promoter exemption (`defaults.ts:45-48`, `types.ts:244-256`). `types.ts:623` reads "True only when `dpiitRecognised` AND `imbCertified80IAC`. Never DPIIT alone." Caveat: `MedianEmployeeValue.taxDeferralAvailable` has no producer, so nothing computes it either way. |
| 2 | Never cite Section 192(1C) as current | **PASS.** One occurrence in `src/` — `defaults.ts:53`, reading "Up from 48 under the **superseded** Section 192(1C)". `taxDeferralWindowMonths` is 60, not 48 (`defaults.ts:55`), asserted at `defaults.test.ts:140`. |
| 3 | Never state a private company needs a special resolution | **PASS.** One occurrence in `src/` — `types.ts:57`, "Drives ordinary vs special resolution", a neutral comment on the `CompanyType` discriminator. No code claims either way. Caveat: `companyType` is never read, so the correct rule is not implemented either. |
| 4 | Never present the Corporate Laws (Amendment) Bill 2026 as law | **PASS.** `types.ts:68-73` says it "is not law". `INSTRUMENTS` carries `RSU` and `SAR`; `EXPOSED_INSTRUMENTS` (`types.ts:76`) is `['ESOP']` alone, asserted at `types.test.ts:123-126`. |
| 5 | Never present advisory benchmark ranges as data | **PASS.** `ADVISORY_TRACK.provenance` is `estimate` and its caveat reads "Advisory consensus, **never data**" (`benchmarks.ts:29-31`), asserted at `benchmarks.test.ts:79-81`. `Provenance` has no `sourced` tier, enforced by a type-level equality at `types.test.ts:38` and at runtime at `defaults.test.ts:33-37`. |
| 6 | Never output a pool percentage without the grant basis and strike policy visible | **PASS**, structurally. `PoolSizing` (`types.ts:333-342`) welds `grantBasisKind`, `strikePolicyKind` and `valueBasis` to the percentage, asserted at `pool-solver.test.ts:292-308`. Two boundary cases worth knowing: `roundPoolPctForDisplay` (`pool-solver.ts:66`) is exported and returns a bare number, and `existingPoolPostRoundPct` (`rounds.ts:160`) returns a bare pool percentage — but that one is a round-mechanics figure that does not depend on the grant basis or strike policy at all. No UI exists to check against. |
| 7 | Never let a compliance row appear without "General information, not legal advice." | **PASS**, structurally and vacuously. `ComplianceFlag.disclaimer` is the literal type `'General information, not legal advice.'` (`types.ts:575-589`), so a row without it will not compile; asserted at `types.test.ts:45-47` and `:138-142`. Vacuous because nothing constructs a `ComplianceFlag` anywhere. |

---

## Verdict

**YELLOW.**

The maths is right where it has been built. Twenty of twenty hand-derived pool-shuffle
figures reconcile exactly; the simplest Basis B grant reconciles exactly; a 500-case fuzz
over the roll forward, the solver *and* the round engine produces no NaN, no Infinity and
no negative share count; six of seven deliberate breakages go red. The bucket identity,
the grant-basis invariance and the cohort tracking are all genuinely defended.

It is not green because one deliberate breakage of a spec-stated definition changed the
headline number by 2.3 percentage points and the entire suite stayed green, because the
one output object a founder actually reads disagrees with itself, and because a recorded
model decision in LOG.md describes behaviour the engine does not have. None of those is
fatal, and none of them is the kind of thing that fixes itself.

It is not red because nothing currently computes a wrong answer. Defect 1 is a hole in the
tests, not in the code. Defect 2 is bounded by the spec's own tolerance. The engine as
committed is arithmetically sound as far as I can verify it.

### Defects, most severe first

1. **`FD_t` in the price-per-share denominator is completely untested.**
   `roll-forward.ts:438-441`. Removing the unallocated pool from the count that prices
   `PPS_t` — a direct contradiction of ENGINE_SPEC.md §3 and of the comment at
   `valuation.ts:80-84` — leaves all 253 tests passing while moving the Basis B recommended
   pool from 14.5231% to 12.2271% (displayed: 15% to 12.5%) and the option count from
   1,699,207 to 1,393,040. No test anywhere asserts a price per share produced by
   `runRollForward`. **Severity: high.** This is the whole circularity the §4.5 fixed point
   exists for, and it is protected by nothing.

2. **`PoolSizing.poolPctOfFullyDiluted` and `PoolSizing.poolOptions` describe different
   pools.** `pool-solver.ts:238-254`. The percentage is the last loop iterate; the option
   count is recomputed from the final run at that iterate. On the Case 1 hand
   reconciliation the option count is the true fixed point to seven significant figures
   while the percentage is high by 7.05 × 10⁻⁶ points; on the standard fixture the gap is
   0.0012 points; over 500 random cases the worst gap is 0.00489 points. The source comment
   at `pool-solver.ts:29-31` explicitly promises "the option count, the roll forward and the
   percentage cannot disagree with one another." They can. No display flip occurred in 500
   cases, but the half-point rounding at `pool-solver.ts:73` makes one possible.
   **Severity: medium.** The fix is one line — derive the reported percentage from
   `poolOptions` — plus a test that asserts the two agree.

3. **LOG [004] records behaviour the engine does not have.** `docs/esop/LOG.md:120` states
   the runaway plan "comes back at 10% flagged rather than at 99.9% pretending." Measured:
   **97.839%**, flagged. The log is append-only, so this needs a correcting entry rather
   than an edit. The covering test (`pool-solver.test.ts:212-219`) asserts only `< 100`, so
   nothing pins the value. **Severity: medium**, because the log is the decision record and
   a wrong one is worse than a missing one.

4. **The statutory 12-month cliff is never enforced.** ENGINE_SPEC.md §5 and PROJECT.md:
   "Block any input below 12 months." Verified by running: `cliffMonths: 1` and
   `cliffMonths: 0` both pass through `runRollForward` and `solveRecommendedPool` end to
   end with no error and no warning. `cliffMeetsStatutoryMinimum` (`cohorts.ts:130-132`)
   exists, returns `false` correctly, is called by nothing, and has 0% coverage.
   `EngineWarningId.cliffBelowStatutoryMinimum` (`types.ts:645`) is never raised. The fuzz
   generator draws `cliffMonths` from `[12, 18, 24]` only, so it never explores the
   illegal range. **Severity: medium.**

5. **The mid-year exposure factor is applied to continuing-employee exercises, contradicting
   M17, and is untested.** `cohorts.ts:335-336` multiplies the continuing-exercise rate by
   `exposure`. M17 states the convention "is scoped to attrition exposure and to nothing
   else." The branch is unobservable in every existing test — a grant-year cohort has
   `v = 0` under any cliff of a month or more, so the factor always multiplies zero — which
   is why nothing caught the inconsistency. Harmless in practice for legal schedules;
   becomes live the moment defect 4 lets a sub-12-month cliff through.
   **Severity: medium-low.**

6. **The 500-case invariant test runs at 62% of the default timeout.**
   `engine-invariants.test.ts:95` takes ~3.1 s against vitest's 5 s default;
   `vitest.config.ts` sets no `testTimeout`. Enabling V8 coverage was enough to push it
   over and turn the suite red for a reason unrelated to the engine. A slower CI box will
   do the same. **Severity: medium-low.** One line in `vitest.config.ts`.

7. **`DEFAULTS.horizonYears` and `DEFAULTS.hiresPerYear` disagree.** `defaults.ts:256-267`:
   horizon 4, five entries `[15, 25, 35, 40, 45]`. Anything seeding a form from `DEFAULTS`
   silently drops year 5's 45 hires (`roll-forward.ts:425`). No test asserts the two agree.
   **Severity: low.**

8. **`exerciseWindowDays` is carried and never read, so the spec's link between the exercise
   window and lambda does not exist.** ENGINE_SPEC.md §6 says lambda is "linked to the
   exercise window input" and calls the window a differentiator. 30 days and 5 years produce
   identical numbers. Unlike the equivalent sector gap, which M16 covers deliberately, no
   model decision records this one. Same class: `FairValueAssumptions.expectedLifeYears`
   and `.volatilityPct` are unread, so theta is a free scalar rather than a function of the
   strike. **Severity: low**, but it is a founder-facing control with no effect.

9. **Provenance tagging is inconsistent with M2 in at least one load-bearing place.**
   `recycleForfeited: true` (`defaults.ts:122-127`) is tagged `estimate` on the strength of
   "Most Indian schemes recycle", which is a market claim, not a spec value. It should be
   `provisional` and on the pre-launch to-do list — recycling off produces a strictly larger
   recommended pool. `vestYears`, `vestFrequency`, `cliffMonths` and `sector` sit on the
   same line. **Severity: low.**

10. **The LOG template promises two shas per entry and every entry carries one.**
    `docs/esop/LOG.md:25` — "Both shas are listed." No entry lists the backfill sha. Recovering
    the pairing requires `git log --name-status`. **Severity: low.**

11. **The repo's fuzz never touches `rounds.ts`.** `engine-invariants.test.ts:27` covers
    `runRollForward` and `solveRecommendedPool` only. I ran 500 fresh cases through
    `shuffleRound`, `poolCostToFounders` and `runRoundSchedule` and found nothing, but
    nothing in the repo would. **Severity: low.**

12. **Untested exported surface.** `approximateOpeningCohortsFromTotal` (`cohorts.ts:518-538`),
    `openingHeadcountCohorts` (`cohorts.ts:585-609`), `baseAttritionPctForSector`
    (`defaults.ts:325-327`), `cliffMeetsStatutoryMinimum` (`cohorts.ts:130-132`),
    `seniorityMixSumsTo100`'s caller (none), and the zero-run-rate exhaustion branch
    (`roll-forward.ts:299`) all have 0% coverage. `openingHeadcountCohorts` is the one that
    matters: the roll-forward tests and the fuzz generator both hand-build
    `HeadcountCohort` literals, so its `+ MID_YEAR_EXPOSURE_YEARS` tenure convention has
    never been executed. **Severity: low.**

13. **Weak tests.** `defaults.test.ts:110-116` asserts only `toBeDefined()` on two records
    the type system already makes total. `pool-solver.test.ts:85-96` restates
    `pool-solver.ts:244` and cannot fail. `pool-solver.test.ts:259-271` is named as a
    fixed-point check and is a determinism check. `roll-forward.test.ts:430` uses `>=
    8_900_000` where the exact value is computable. Full list in section 5.
    **Severity: low.**

### What I would fix first

**Defect 1**, and not by patching anything — by adding the test that should already exist:
assert `RollForwardYear.pricePerShare` against a hand-computed `V_t / FD_t` on a fixture
whose unallocated pool is a material share of the count, under Basis B, for at least two
years of the horizon. That single assertion turns mutation (e) red and closes the largest
hole in the suite. While in that file, add the assertion that
`openingFullyDilutedShares` equals `closingIssuedShares + closingGrantedOutstanding +
closingAvailable` *before* cancellations, which pins M19's pricing convention the same way
the bucket identity pins M18's.

**Defect 2** second, because it is a one-line change with a real test behind it and it is
the number on the front of the report.

**Defect 3** third: a correcting LOG entry costs nothing and the log is the only durable
record of why this engine is shaped the way it is.

---

*No source file and no test was modified by this session. Every mutation was reverted and
verified against `git hash-object`. The tree is clean, the suite is green at 253/253,
`tsc` passes and the production build passes. This report needs its own LOG entry when it
is committed.*
