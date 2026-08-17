# ESOP Pool Calculator

Product source of truth. Read this first, every session, before anything else.

Route: `/tools/esop-pool-size` on incentiv.finance
Branch: `main`
Stack: Next.js 16 (App Router), React 19, TypeScript strict, pnpm, Vitest
Model source of truth: [ENGINE_SPEC.md](./ENGINE_SPEC.md)
Log: [LOG.md](./LOG.md)

---

## What this is

A tool that tells an Indian startup founder how big their ESOP pool should be, sized against their hiring plan rather than a rule of thumb, and how long an existing pool will last. It lives at `/tools/esop-pool-size` on incentiv.finance/tools, next to the ESOP Tax Calculator and the Funding Round Simulator. Results are free and ungated. The detailed report is gated on name and work email, and the CTA pitches Tabulate.

## The one job

A founder gets a defensible pool number in under 90 seconds and under 12 interactions, and understands what drove it.

## Locked product decisions

Numbered D1, D2, D3… Never renumber. Never delete. If a decision is reversed, add a new one that supersedes it and mark the old one superseded.

| # | Decision | Locked |
|---|---|---|
| D1 | Grant basis is a visible founder-facing control, not an internal assumption. Percent-of-equity or rupee-value. It decides whether valuation growth affects the answer at all. | 2026-08-15 |
| D2 | Strike price policy is a visible control. Face value or last round price. It decides the denominator. | 2026-08-15 |
| D3 | Results are never gated. Only the report download is. | 2026-08-15 |
| D4 | Two separate compliance toggles: DPIIT recognition and IMB certification under Section 80-IAC. Never one. | 2026-08-15 |
| D5 | Two benchmark tracks are always shown together: advisory consensus and observed India data. Neither is presented as the truth. | 2026-08-15 |
| D6 | Every default is an editable estimate, marked as such in the UI, and never presented as sourced data. | 2026-08-15 |

## Locked model decisions

The math lives in [ENGINE_SPEC.md](./ENGINE_SPEC.md) and is not restated here. If code or UI copy ever disagrees with the spec, the code changes, not the spec.

This section records only decisions the spec leaves open, as they get made. Numbered M1, M2, M3… Never renumber.

| # | Decision | Made |
|---|---|---|
| M1 | Where the spec gives a range and the form needs a point, the default is the midpoint of that range, tagged `estimate`. Applies to the Basis A grant percentages and the sector attrition overrides. | 2026-08-15 |
| M2 | Provenance has exactly two tiers. `estimate` means the spec states the value or it is advisory consensus. `provisional` means the spec sets no v2 value and this is a placeholder, or the figure is a dated third-party observation we have not verified. Every `provisional` is a to-do before launch. | 2026-08-15 |
| M3 | Statutory limits and the fixed-point solver parameters carry no provenance tag. They are law and algorithm respectively, not estimates, and tagging them would be a category error under D6. They live in `STATUTORY` and `SOLVER`, outside the defaults table. | 2026-08-15 |
| M4 | The band vocabulary is leadership, senior, mid, junior, mapping to the spec's CXO-or-VP, senior IC, mid IC, junior. | 2026-08-15 |
| M5 | `exerciseWindowDays` is a closed union of the four options the spec names: 30, 90, 365, 1825. A founder cannot enter an arbitrary window until we decide to open it. | 2026-08-15 |
| M6 | Neither benchmark ladder is a partition, so overlapping bands are carried as data, not forbidden. Each track declares its stage trend and its known overlaps, and the tests assert the found overlaps equal the declared ones exactly. The advisory ladder overlaps at Series B against Series C+; the observed India ladder overlaps at three pairs, because "below 10%" is a ceiling and not a band. | 2026-08-15 |
| M7 | Section 4.2 writes the refresh formula in Basis B terms, dividing by `D_t`. Applied literally under Basis A it would make Basis A demand move with the valuation and section 1 would be false. So refresh mirrors the fork: a percentage of `FD_t` under Basis A, rupees over `D_t` under Basis B. `Gbar` is the headcount-weighted mean grant across the eligible base, in whichever unit the basis uses. | 2026-08-15 |
| M8 | The realisable spread is guarded at `1e-6` of `PPS_t`. At or below it the engine raises a typed error instead of returning a near-infinite option count. It is an algorithm constant, not an estimate, so it carries no provenance tag, per M3. It says nothing about whether a thin spread is sensible; it only refuses to divide by nothing. | 2026-08-15 |
| M9 | `X_t` is the modelled `PPS_t` of the grant year under `lastRoundPrice`, and `PPS_t * (1 - discount)` under `discountToFMV`. Face value is applied as a floor to every policy, not just the discount case, because shares cannot be issued below par. | 2026-08-15 |
| M10 | Year indices are zero-based. Year 0 is the first plan year, priced at today's post-money valuation, so `(1+i)^0` leaves the first year's grant values uninflated and `V_0` is the price the first hires are granted at. | 2026-08-15 |
| M11 | A percentage point of pool dilution is valued at the round's post-money valuation, `Vpre + R`, under both pool conventions. Under `preMoney` that is identically `dP * investorPricePerShare`, exactly as section 4.6 words it, because `(Vpre+R)/T` is the investor's price there. Under `postMoney` the investor buys before the pool exists, so their purchase price is above the post-pool marked price, and valuing that pool at the purchase price would make the founder-friendly convention look dearer and flip the sign of the delta. | 2026-08-15 |
| M12 | The engine reports two deltas for a round, and they are not interchangeable. `deltaPctPoints` and `deltaRupees` are the spec's `dP/T` measure, pre-money minus post-money: the difference in the pool's footprint on the company. `founderOwnershipDeltaPctPoints` and `founderOwnershipDeltaRupees` are the founders' own post-round percentage difference, which is the larger number, because a post-money pool is partly borne by the incoming investor and a pre-money one is not. The founder-facing headline is the second. | 2026-08-15 |
| M13 | `pi` is a post-round percentage, so an investor's pool demand is compared against where the existing pool lands after the round, never against its pre-round percentage. A pool at 11.1% pre-round lands at 8.9% after a 20% round without a single new option being reserved. `existingPoolPostRoundPct` is that number. | 2026-08-15 |
| M14 | The round engine neither rounds shares to whole numbers nor clamps `dP` at zero. The closed form holds exactly in fractions and only approximately in integers, so rounding would break the identities the tests check it against; rounding is a presentation decision. A negative `dP`, where the investor wants a smaller pool than the company already reserves, is a real term sheet outcome and is reported as it comes. | 2026-08-15 |
| M15 | The value basis is a founder-facing control on `GrantPolicyInputs`, alongside the grant basis and the strike policy, not an argument passed at the call site. The same ₹25 lakh promise buys a very different option count against `PPS_t` than against `PPS_t - X_t`, so it decides the answer in the same way D1 and D2 do. It is inert under Basis A, and `PoolSizing.valueBasis` is null there rather than carrying a value nothing read. Default `notional`. | 2026-08-15 |
| M16 | The sector prefills the base attrition rate; it does not scale it. `attritionPctByBand` reads `byBand[b] ?? baseAnnualPct` and never touches `AttritionInputs.sector`, so a founder who picks e-commerce and then types 20% gets 20%. Multiplying a founder-entered base by a default sector multiple would silently overrule the edit. `baseAttritionPctForSector` exists for the form to call on a sector change. | 2026-08-15 |
| M17 | The mid-year convention is scoped to attrition exposure and to nothing else. A cohort granted across year t is charged half a year of attrition in year t and a full year after, because grants land throughout the year. Vesting still reads `age = t - s` exactly as section 4.3 writes it, unshifted, because the spec is the model source of truth and the convention was adopted to fix a named error in the exposure, not to rewrite the vesting curve. Under the default 12 month cliff the two readings agree in the grant year anyway, since v is zero either way. | 2026-08-15 |
| M18 | `FD_t = issued shares + granted outstanding + available pool`, and options forfeited under a non-recycling scheme leave it. Fully diluted counts shares that can still come into existence, and an option that can never be granted to anyone cannot. Every other flow in section 4.3 moves options between the three buckets and leaves FD alone, which is why an exercise raises paid-up capital without changing the fully diluted count. A test asserts the identity on every year of every generated case. | 2026-08-15 |
| M19 | Grants made during year t are priced off the fully diluted count at the *start* of year t, after that year's top-up. Pricing them off the closing count is circular under M18: the closing count depends on the year's cancellations, which depend on the grants. `RollForwardYear` reports both counts and says which one `PPS_t` was struck on. The two are identical whenever recycling is on. | 2026-08-15 |
| M20 | The fixed point clamps its iterate at both ends, for different reasons and with different meanings. Below zero it clamps to zero and keeps going, because the spec's unclamped numerator turns "the existing pool already covers the plan" into a negative percentage and zero is what that means. Above 99.9% it stops, flagged non-converged, leaving the last in-range value: clamping to the cap and reporting convergence would present 99.9% as an answer rather than as a failure. | 2026-08-15 |
| M21 | Options already granted when the plan starts must be supplied as cohorts. The engine raises `missingOpeningCohorts` rather than inventing a grant year and a band, and `openingCohortsMismatch` when the cohorts do not add up to `grantedOutstandingOptions`, because the difference would land in issued shares and misstate paid-up capital. `approximateOpeningCohortsFromTotal` exists for a caller holding only a total; section 4.3's prohibition is on the engine making that assumption silently, not on a caller making it knowingly. | 2026-08-15 |
| M22 | `FD_t` is composed in exactly one place: `fullyDilutedShares` in valuation.ts, from issued shares, granted outstanding and the unallocated pool. The roll forward builds the count that prices year t through it, and the round engine builds its cap table total through it, so "does the fully diluted count include the unallocated pool" has one answer rather than one per caller. It had two before, and in the roll forward it had none — the count was evolved year on year and section 3's composition was written down nowhere, which is how AUDIT_P4's mutation (e) dropped the pool from the price denominator without a single test noticing. The pool term is signed, unlike the other two: section 4.4 reads exhaustion off an overdrawn pool, so `FD_t` must be able to express a deficit and clamping it inside the composition would delete the signal. The *closing* count stays an evolution of the opening count less cancellations, deliberately, so M18's bucket identity remains a property a test can catch a leaked flow with rather than an identity true by construction. | 2026-08-15 |
| M23 | `PoolSizing` reports one pool in two units, and which unit leads depends on whether the solver converged. **On convergence the option count leads**: it is `K - existingUnallocated` from the single final run, and `poolPctOfFullyDiluted` is that count over `FD_0 + that count`, which is section 4.5's own formula, so the two cannot drift. **On non-convergence the level leads**, because there is no converged state — the requirement and the level disagree, which is what non-convergence means — so the percentage is the last iterate that was finite and in range, per M20, and the option count is the options at exactly that level. Either way the two fields describe the same pool; before this they were a loop iterate paired with a figure from a different turn, and disagreed by up to 0.00489 percentage points. The engine does not substitute a sentinel on non-convergence: `converged: false` says the number is a stopping point rather than an answer, and a founder gets a figure and a warning instead of a blank screen. `fullyDilutedSharesAtYear0` is `FD_0 + poolOptions` in both cases. `existingPoolIsEnough` is claimable only on a converged run, because a zero level is not the same statement as a zero requirement. The returned roll forward is priced at the converged iterate, which sits within the spec's 0.01 point tolerance of the reported answer rather than exactly on it; on a non-converged run it is priced at exactly the reported level. | 2026-08-15 |
| M24 | The Rule 12(6)(a) twelve-month vesting floor is **enforced**, not reported. `requireLawfulVestingSchedule` refuses a shorter cliff with a typed `cliffBelowStatutoryMinimum` at every boundary a founder's `VestingSchedule` crosses — `cohortPolicy`, and therefore the roll forward and the solver, plus the compliance checks and the expense schedule. It is deliberately *not* inside `vestedFraction`: that function is the spec's vesting curve and its guards are the mathematical ones, a negative cliff or a cliff past the end of vesting, which keep the separate `invalidVestingSchedule` code because a UI has to say different things about a schedule that cannot be evaluated and one that cannot be adopted. The consequence is that the compliance row for the vesting floor can only ever report `pass`: it describes a value the engine has already guaranteed is legal, rather than describing a rule the engine ignores. | 2026-08-15 |
| M25 | A compliance row carries `status` (`pass`, `warn`, `blocked`), a one-line `finding` for what is true of this company, a one-line `action` for what to do about it, and the statutory reference. `finding` and `action` are separate because a report has to lay them out apart. `status` answers "is anything wrong", not "is there work to do", so the mandatory-but-routine rows pass and carry their work in `action`. The check ids are a closed union and the checks are built as a `Record<ComplianceCheckId, ComplianceCheck>`, so dropping a rule from section 5 is a `tsc` error rather than a silently shorter report — no runtime guard, because a guard no real call can reach is the rot `ESOP_ERROR_CODES` exists to prevent. The tax deferral is a three-state `TaxDeferralStatus`, never a boolean, and `isTaxDeferralAvailable` is the only place the two flags are read together. The checks take `asOfDate` as an input and never read a clock, because the DPIIT exemption expires on a specific day and an engine that reads the system clock cannot be tested at that boundary. This supersedes the unused `ComplianceFlag`/`ComplianceSeverity` shapes, which are removed rather than left beside it. | 2026-08-15 |
| M26 | The Ind AS 102 estimate is written as a cumulative catch-up, not as a per-year charge: `cumulative_t = value × expected_t × elapsed_t`, where `expected` is the grant less unvested forfeitures to date and `elapsed` is straight line over the vesting period. Both of the spec's lapse rules then fall out of the base rather than being special-cased — an option forfeited before vesting leaves `expected`, so its expense reverses; an option that lapses after vesting never touches `expected`, so its expense stands and is not reversed through P&L. The period charge splits exactly into an amortisation term and a reversal term and the tests assert the identity. Options granted before year 0 are excluded and the excluded count is returned, because their grant-date value depends on a price per share from before the plan starts that the engine does not hold, and valuing them at a price they were not granted at would be worse than omitting them. `accountingBasis` finally decides something: Ind AS 102 uses `theta × PPS`, the ICAI Guidance Note basis uses the intrinsic spread at grant, which is frequently zero at a face value strike. | 2026-08-15 |
| M27 | **The `instrument` compliance row is deliberate and must not be removed as noise.** It is the eighth row, it was not in the P5 prompt's list of seven, and it looks redundant from the inside: the tool exposes only ESOP, so the row reads `pass` for every founder who ever uses the form. That is exactly why it is there. Its job is to say out loud that options are the only instrument the engine models and that RSUs and SARs are **not** recognised under Section 62(1)(b) today — the Corporate Laws (Amendment) Bill 2026 would recognise them and is not in force. A founder who has read about the Bill, or an adviser who has, needs the tool to answer that question rather than to be silent on it, and silence on a pending law reads as assent. The row also carries the PROJECT.md prohibition against presenting the Bill as law into executable form, and `INSTRUMENTS` already carries RSU and SAR so the state is constructible even though `EXPOSED_INSTRUMENTS` does not offer it. Delete this row only when the Bill is enacted and the engine models the instruments, and then replace it rather than drop it. | 2026-08-15 |
| M28 | `EngineWarningId` is a closed array, `ENGINE_WARNING_IDS`, mirroring `ESOP_ERROR_CODES` and `COMPLIANCE_CHECK_IDS`: the type is derived from the array rather than hand-written beside it, so a member cannot exist in the type and nowhere at runtime. `cliffBelowStatutoryMinimum` was removed from it: section 5's twelve-month floor is enforced, not warned about, by `requireLawfulVestingSchedule` throwing an `EsopErrorCode` of the same name — a different union — before any engine call exists that a warning about the same state could attach to. Four members remain, none of them with a producer yet: `notionalValueOverstatesReceipt`, `authorisedCapitalShortfall`, `solverDidNotConverge`, `seniorityMixDoesNotSumTo100`. | 2026-08-15 |
| M29 | `OpeningGrantCohortInput.grantDateValuePerOption` is optional and **three-state, not two, on purpose**: unsupplied excludes the cohort from the Ind AS 102 estimate, because the engine holds no price per share from before the plan started to value it at; supplied — including as exactly `0` — includes it, amortised over its remaining vesting at the value given. `undefined` and `0` collapse to the same rupee contribution today, which is exactly why they cannot be allowed to collapse in the type or the running counts: `EsopExpenseSchedule` keeps `excludedOpeningOptions` and `includedOpeningOptions` as two fields rather than one, so "we don't know" and "we know, and it was nothing" stay distinguishable the moment a real opening cohort with a genuinely zero grant-date value arrives. `esopExpenseSchedule` amortises an included opening cohort on the same `expected`/`elapsed` machinery as an in-plan cohort, sharing one loop rather than two: both are keyed by a `start` plan-year and an `elapsedOffset`, where an in-plan cohort starts at its own grant year with offset 1 (a full recognition period credited to the grant year itself, a P&L convention, not the vesting-curve age M17 already keeps separate), and an opening cohort starts at year 0 with offset `ageYearsAtEndOfYear0` — reusing the exact age arithmetic `stepGrantCohort` already uses for vesting, rather than inventing a second age convention for expense alone. | 2026-08-15 |
| M30 | Theta-scaled fair value, `theta * PPS_t`, is computed in exactly one place: `thetaScaledFairValue` in denominator.ts. Section 2's fair value basis (`denominatorFor`'s `fairValue` case) and the Ind AS 102 expense estimate (`perOptionValue`'s `indAS102` branch, compliance.ts) both call it; neither repeats the expression or writes its own guard. **The domain is `(0, 1]`**, the stricter of the two guards that existed before this — `denominatorFor` already enforced it, the expense path only rejected theta below zero, so `theta = 0` and `theta = 1.5` used to pass one call site and not the other for identical arithmetic. `(0, 1]` is the spec's own reading: section 2 calls theta "the Black-Scholes value ratio" and states it "approaches 1 as the strike approaches zero", which only reads as a ceiling if 1 is the top of theta's range, and a ratio at or below zero prices an option at nothing or less, which is not a fair value Ind AS 102 lets a company book. `esopExpenseSchedule` no longer guards theta unconditionally at its own top: the guard now fires only where theta is actually multiplied, inside `thetaScaledFairValue`, called only from the `indAS102` branch — so an `icaiGuidanceNote` company, which never reads theta, is no longer refused for a theta value it does not use. This is the M22 pattern again: one quantity, one function, one guard, both callers reduced to calling it. | 2026-08-15 |
| M31 | **The engine runs the plan twice and labels both runs, and `EsopResult` has no top-level `rollForward`, `exhaustion` or `authorisedCapital` for a caller to reach for.** `recommended` is the plan at the pool section 4.5 solves for; `current` is the same plan at the pool the founder holds today. They disagree by construction — at the recommended pool every year closes with options in hand, at an empty pool the same plan is overdrawn from month zero — and merging them is the exact failure LOG [020] reconciles in the front-end build, where a 6.5% headline sat above a table showing a closing balance of zero in every year and a "pool % of FD" column that was neither pool nor percentage of the pool but cumulative consumption. Making the mistake unrepresentable is stronger than documenting it: a component has to write `result.current.exhaustion`, and the moment it types that it has decided which question it is answering. Spec item 2 asks for the exhaustion month of the *current* pool, so that is where it lives; item 5's roll forward is whichever series the screen is about. Asserted at the type level in types.test.ts and at runtime in calculate.test.ts. | 2026-08-16 |
| M32 | `src/lib/esop/index.ts` is the frozen public surface and `calculateEsopPool` is the only engine computation it exports. Everything else out of it is data (`DEFAULTS`, the benchmark tracks, the enumerations) or a type or an error helper. `public-api.test.ts` pins the export list name by name and asserts that twenty-six named internals — `runRollForward`, `solveRecommendedPool`, `runRoundSchedule`, `esopExpenseSchedule` among them — cannot be reached through the barrel. This is not tidiness. `runRollForward` in a component is precisely how a screen prints a runway from one pool under a headline solved at another, which is M31's failure arriving by a different door. Adding an export must fail the test; a freeze that only fails when someone remembers it is not a freeze. | 2026-08-16 |
| M33 | `EsopInputs` is total: no optional field, and the engine applies no default of its own. A caller who leaves something out gets a `tsc` error rather than a number computed against an assumption they never saw, and `DEFAULTS` is what a *form* seeds itself from, in the form, where D6's "editable estimate, marked as such" can actually be satisfied. Two consequences worth naming. `comparisonGrantBasis` is an input rather than something derived, because `GrantBasis` is a union and the selected arm carries only its own grant table — a percent-of-equity plan does not hold the rupee figures output item 1 needs — and filling it from `DEFAULTS` inside the engine would put a founder-facing number somewhere the founder cannot see it; a comparison basis of the same kind as the selected one is refused rather than silently printing the same figure twice. And `asOfDate` is an input for the same reason the compliance checks already took one: the DPIIT exemption expires on a specific day and an engine that reads the system clock cannot be tested at that boundary. | 2026-08-16 |
| M34 | All three cap tables in output item 6 are struck at **year 0**: the register today, the register once the recommended pool is reserved, and the modelled round applied to the second. Not at the round's own plan year, because `PreRoundHoldings` has four buckets and none of them is exercised shares — the [003] open item — so a round struck at year 2 would have to fold two years of exercises into the investor row and misstate the register. Three tables on one basis is also the comparison a founder is actually making. When the fifth bucket lands, this decision is the one to revisit. | 2026-08-16 |
| M35 | Output item 11's median employee is the band the 50th percentile of the seniority mix falls in, walking from the most senior band down, over the mix normalised by its own sum — so a mix that does not add to 100 still has a median, because losing hires is a separate warning and not a reason to refuse to name a band. A mix that is entirely zero has no median and the field is null. **`taxDeferralAvailable` never changes a rupee.** The deferral moves *when* the perquisite tax falls, not whether it falls, so `perquisiteTaxRupees` and `realisableValueRupees` are identical whether or not it is available and only the flag moves. Netting a deferral off a tax figure would be the PROJECT.md prohibition one step removed — it would show DPIIT-plus-IMB as a discount — and a test asserts the two figures are unchanged. | 2026-08-16 |
| M36 | `GrantValueBreakdown` is a union on the grant basis, and section 2's refusals are carried as data. Under Basis A a grant is a percentage of `FD_t` and there is no denominator to pick, so the shape carries one option count and no value bases; reporting three identical ones would invent a choice the founder does not have, which is M15's "inert under Basis A" made structural. Under Basis B all three bases are computed, and each comes back as a `ValueBasisOutcome` that is either priced or refused with the error code and message that refused it. The refusal is the common case, not the edge: at the Series A default of a last-round-price strike the realisable spread is zero, which is exactly what the spec means when it calls fair value "the only honest basis when the strike is set at the last round price". A UI has to be able to show two bases and say why the third is missing. | 2026-08-16 |

## Compliance facts, current as at August 2026

Scheme approval: Section 62(1)(b) Companies Act 2013 with Rule 12 of the Companies (Share Capital and Debentures) Rules 2014. **Private companies pass an ordinary resolution** under the MCA exemption notification of 5 June 2015. Unlisted public companies pass a special resolution. MGT-14 within 30 days.

Separate resolution required for: grants to employees of a holding, subsidiary or associate company, and grants to an identified employee in any one year equal to or above 1% of issued capital (excluding outstanding warrants and conversions) at the time of grant.

Vesting: minimum one year between grant and vesting, Rule 12(6)(a). Block any input below 12 months.

Eligibility: permanent employees in or outside India, and directors other than independent directors. Excluded: promoters and the promoter group, and directors holding more than 10% directly or indirectly. DPIIT-recognised startups are exempt from those exclusions for 10 years from incorporation, per GSR 127(E) dated 19 February 2019.

Authorised capital: must cover issued capital plus the pool at scheme adoption. If short, increase under Section 61(1)(a) by ordinary resolution, after checking the AoA has an enabling clause (if not, amend the AoA by special resolution under Section 14 with its own MGT-14), then file SH-7 within 30 days. Stamp duty and ROC fees vary by state, so quote the share shortfall and the rupee increase needed, not a fee estimate.

Allotment on exercise: PAS-3 within 30 days. Maintain the option register in SH-6. Rule 12(9) disclosures in the Directors' Report.

**Tax, and this is where v1 was wrong.** The Income Tax Act 2025 took effect 1 April 2026. Perquisite at exercise is (FMV minus exercise price) times shares, taxed at slab. The deferral now sits at Section 392(3) read with Section 289(3), succeeding Section 192(1C) of the 1961 Act. It requires the employer to be an eligible startup under Section 140 (successor to Section 80-IAC), which needs **DPIIT recognition plus an Inter-Ministerial Board certificate**. DPIIT recognition alone does not qualify: roughly 4,000 of about 1.97 lakh DPIIT-recognised startups hold IMB certification. The window is 60 months from the end of the tax year of allotment for shares allotted on or after 1 April 2026, up from 48. Triggers are window expiry, sale of shares, or cessation of employment, whichever is earliest. Rate is locked to the year of allotment.

The tool therefore needs two separate toggles, not one: `dpiitRecognised` (drives the Rule 12 promoter exemption) and `imbCertified80IAC` (drives the tax deferral). Collapsing them into one DPIIT toggle is the error.

Accounting: Ind AS 102 fair value, or the ICAI Guidance Note intrinsic value basis for companies not on Ind AS. Expense amortised over the vesting period. Unvested lapses reverse the expense; expense on vested-but-lapsed options is not reversed through P&L. Show estimated annual ESOP expense in the report, because it surfaces in diligence and founders are routinely blindsided by it.

Pending, not law: the Corporate Laws (Amendment) Bill 2026 was introduced in the Lok Sabha on 23 March 2026 and referred to a Joint Parliamentary Committee, whose report was tabled in early August 2026 backing the Bill. It would recognise RSUs and SARs under Section 62(1)(b) and liberalise buybacks. Build an `instrument` field now (ESOP, RSU, SAR) but expose only ESOP, and do not present the Bill as law anywhere in the UI or report.

**These facts must be re-verified before any public launch, and re-checked every quarter after.**

## Prohibitions

- Never state or imply that DPIIT recognition alone gives the perquisite tax deferral. It requires DPIIT plus IMB certification under Section 140 of the Income Tax Act 2025, successor to Section 80-IAC.
- Never cite Section 192(1C) as current. It is Section 392(3) read with Section 289(3) from 1 April 2026, and the window is 60 months, not 48.
- Never state that a private company needs a special resolution to approve an ESOP scheme. It is an ordinary resolution under the MCA exemption notification of 5 June 2015.
- Never present the Corporate Laws (Amendment) Bill 2026 as law. It was referred to a Joint Parliamentary Committee whose report was tabled in August 2026. It is not in force.
- Never present advisory benchmark ranges as data.
- Never output a pool percentage without the grant basis and strike policy that produced it being visible on the same screen.
- Never let a compliance row appear without "General information, not legal advice."

## Copy conventions

Indian digit grouping throughout, with a lakh or crore readout on every money field. Sentence case. Active voice. No copy block over 25 words in the primary column. "Pool to create" when the founder holds nothing, "Top-up needed" only when they hold something.

## Scope boundary

This tool answers how big, how long, and how many hires. The Funding Round Simulator answers who dilutes across instruments. Cross-link, never rebuild.

## Standing rules for every session

1. Read PROJECT.md and LOG.md before writing any code.
2. One branch, `main`. Never open a sibling branch. Never leave work on an unmerged branch at the end of a session.
3. One canonical log at `docs/esop/LOG.md`. Never create a second log file anywhere.
4. Every commit gets a log entry, including commits made by hand. If you find an unlogged commit, log it before doing anything else.
5. End every session green: tests pass, `tsc` passes, production build passes. If you cannot, stop and say so rather than lowering a test expectation.
6. Never change a test expectation to make a test pass. Change the code, or raise the discrepancy.
7. Stay in the scope of the current prompt. Note anything else you spot in LOG.md under Open items and leave it.

## Open items

Findings from [AUDIT_P4.md](./AUDIT_P4.md) that are **not** fixed. Defects 1, 2 and 3 and
both chores were closed in LOG [006] to [010]; defect 4 in [012]. These are the rest,
carried deliberately. Each has a file and line reference in the audit.

- **Defect 5.** The mid-year exposure factor is applied to continuing-employee exercises, which contradicts M17's "scoped to attrition exposure and to nothing else". Now permanently unobservable rather than merely unobservable today: a grant-year cohort has `v = 0` under any lawful cliff, and since [012] an unlawful cliff cannot reach the engine at all. Worth correcting for what the code says rather than for what it computes.
- **Defect 7.** `DEFAULTS.horizonYears` is 4 and `DEFAULTS.hiresPerYear` has five entries. Anything seeding a form from `DEFAULTS` silently drops the fifth year.
- **Defect 8, now more urgent than it was.** `exerciseWindowDays` is carried and never read, so spec section 6's "linked to the exercise window input" does not exist: 30 days and 5 years produce identical numbers. Same class as `FairValueAssumptions.expectedLifeYears` and `.volatilityPct`, which leave `theta` a free scalar rather than a function of the strike, and as `VestingSchedule.frequency`, which the spec's linear curve does not model. **Since [020] these are not internal dead fields but published input controls**: `EsopInputs` is the front end's contract, so a founder can move any of the four on a form and watch every number stay exactly where it was. Tolerable as internals; not tolerable as inputs.
- **Defect 9.** `recycleForfeited` is tagged `estimate` where M2 argues for `provisional`, and it moves the headline number. `vestYears`, `vestFrequency`, `cliffMonths` and `sector` sit on the same line.
- **Defect 10.** The LOG template promises "Both shas are listed" and every entry carries one. The convention is unachievable as written — a backfill commit cannot contain its own hash either — so it needs restating rather than complying with.
- **Defect 11.** `rounds.ts` has no property or fuzz coverage in the repo. The audit ran 500 cases through it by hand and found nothing; nothing in the suite would.
- **Defect 12.** Untested exported surface: `approximateOpeningCohortsFromTotal` and the zero-run-rate exhaustion branch remain. `cliffMeetsStatutoryMinimum` came off this list in [012]; `openingHeadcountCohorts` and `baseAttritionPctForSector` came off in [020], where the assembler calls the first and the public surface exports the second.
- **Defect 13.** Weak tests, listed in full in the audit's section 5. `pool-solver.test.ts` "reproduces itself when fed back in" became an exact tautology in [007] and needs replacing with a genuine fixed-point check.
- No coverage threshold is set, and [015] made this explicit and tested: it stays unset until P9 decides whether to have one, deliberately, so it does not decay from "we decided not to" into "we forgot to".
- Carried from [000]: `esop-engine-spec-v2.md` sits at the repo root beside the canonical copy at `docs/esop/ENGINE_SPEC.md`, byte-identical today with nothing testing that it stays so; and there is still no `CLAUDE.md` pointing a session at this file.

Raised in [012], the compliance session; closed where noted:

- Closed in [017]: the Ind AS 102 schedule used to exclude every opening cohort's options unconditionally. `OpeningGrantCohortInput.grantDateValuePerOption` now lets a caller supply a grant-date value, including exactly `0`, so a cohort with a known value is amortised rather than excluded. A cohort with no supplied value is still excluded, correctly, since the engine holds no price per share from before the plan started to value it at otherwise.
- Closed in [020]: spec output items 3, 6, 10 and 11 have producers, and `EsopOutputs` is replaced by `EsopResult`, which has one. `isTaxDeferralAvailable` has a consumer — item 11's `taxDeferralAvailable` — and it is a timing flag, never a discount, per M35.
- Closed in [020]: the compliance checks read the roll forward's own `AuthorisedCapitalHeadroom`, from the recommended run, rather than one a caller assembled separately.

Divergence-risk map, walked once against the whole engine at the end of the session above and
not previously written down anywhere durable — it lived only in that session's reply, which is
why it is recorded here now rather than assumed to survive. Three findings; one closed.

- **Closed in [019]: theta-scaled fair value, `theta * PPS_t`.** Was written independently in denominator.ts and compliance.ts with guards that had drifted apart — `theta = 0` and `theta = 1.5` passed one call site and not the other. Consolidated into `thetaScaledFairValue` in denominator.ts; both callers use it; recorded as M30.
- **`postRoundPricePerShare` (rounds.ts:224) and `investorPricePerShare` (rounds.ts:274) under `preMoney`.** Not duplicated by accident: two different arithmetic paths, proven algebraically equal by the closed form and asserted equal by a test (`toBeCloseTo(..., 9)`), not by sharing code. Latent, not live — nothing is wrong today — but a future edit to either formula in isolation would silently break the identity until the suite is run. **P6 constraint:** if the assembler needs "the round's price per share" as one value, read one of the two, do not average or re-derive a third expression for it.
- **`FD_0` fallback, `fullyDilutedSharesAtStart ?? company.fullyDilutedShares`, written three times.** `pool-solver.ts:157` and `:192`, `roll-forward.ts:404`. Low risk — a one-line null-coalescing fallback, not an arithmetic formula that can drift — but the same rule stated three times rather than once. **P6 constraint:** if the assembler needs FD_0, read it off whichever result object already resolved it (`RollForwardResult` or `RecommendedPoolSolution`) rather than re-applying the fallback a fourth time.

Both remaining items are deliberately **not** touched by [019] — closing them was out of scope for
that session and would have widened it past the one thing that had to close before the assembler.
[020] obeys both as constraints rather than closing them: the assembler reads a round's price per
share off the outcome instead of re-deriving it, and reads `FD_0` off the run that already resolved
it instead of applying the fallback a fourth time.

Raised in [020], the assembler session:

- **The recommended series is priced at the solver's converged iterate, not at the reported answer.**
  Measured on the golden fixture: `sizing.poolOptions` is 701,021.03 against a run opening pool of
  701,028.09, a gap of **7.06 options on 1.07 crore** — inside section 4.5's 0.01 point tolerance,
  exactly as M23 states, and now pinned by a golden test so it cannot widen unnoticed. Both figures
  are returned rather than one hidden. Closing it needs an extra settle pass or a tighter internal
  tolerance than the spec mandates. Raised in [007]; sized here; not fixed.
- **`PreRoundHoldings` has four buckets and none of them is exercised shares**, carried from [003].
  This is why M34 strikes all three cap tables at year 0. The fix is a fifth bucket and a fifth cap
  table row, and it changes `rounds.test.ts`'s "carries the four rows in a fixed order".
- **There is still no seed-input builder**, from [001]. `EsopInputs` is total by design (M33) and
  `DEFAULTS` is exported, so a form can assemble one — but every form that does will make the same
  twenty decisions, and defect 7 above is waiting for the first one that reads `DEFAULTS.horizonYears`
  and `DEFAULTS.hiresPerYear` together. The assembler refuses the opposite mistake, a hiring plan
  shorter than its horizon, with `invalidHorizon`; it does not touch the defaults table.
- **[004]'s vesting-curve question is now worth a number.** The spec puts `v` at zero on the cliff
  date where Indian practice puts 25%, and on the golden fixture at the front-end build's own
  assumptions that difference is part of what moves year 1 returns from 22,627 to 12,128. It still
  needs the decision [004] asked for: restate section 4.3's formula, or accept it and say so in the
  report. Nothing was changed — the spec is the model source of truth and it was followed.

Raised in [023], the information-architecture and QA session. No engine change; `src/lib/esop`
was not opened.

- **The result object fits a 1440px and a 1024px viewport, and does not fit 768 or 375.** Measured:
  the card runs 138→862 at 1440 and 138→894 at 1024, against a 900px viewport. Below `lg` the grid
  collapses to one column and the input rail stacks *above* the result, so the answer is a scroll
  away — the pinned `MobileSummaryBar` carries the pool percentage, the grant basis and the strike
  policy, and a "Jump to your result" link sits at the top of the rail. **Reordering was considered
  and rejected**: putting the result first in the DOM fixes the narrow case and breaks the wide one,
  where focus order would then run right-to-left across the two columns. One of the two has to give
  and the desktop focus order was judged the more valuable. Revisit if the tool's traffic turns out
  to be mostly phones.
- **The interaction count is 10 at the default horizon and 11 at any other.** Stage, valuation,
  fully diluted shares, existing pool, four hires-per-year fields, grant basis, strike policy —
  everything else is a seeded estimate under D6. Changing the horizon costs one more interaction
  and no more, because `HiringCard` fills the added years from the founder's own last entry rather
  than from the defaults table. Under the 12 the one job names, with one to spare. It has no test:
  counting interactions needs a rendered tree and this suite runs in `node`.
- **`prefers-reduced-motion` is verified from the source, not from a run.** `usePrefersReducedMotion`
  reads the query through `useSyncExternalStore` and every Recharts series binds
  `isAnimationActive`, both asserted in `ui-quality.test.ts`. Nothing exercises the reduced-motion
  branch in a real browser, because the preview pane exposes no way to emulate the setting.
- **Grid lines are deliberately below the 3:1 non-text contrast floor**, at 1.44:1 light and 1.58:1
  dark. WCAG 1.4.11 covers graphics "required to understand the content" and a grid line is not:
  the axis ticks carry the values and every chart ships a screen-reader data table. A 3:1 grid turns
  a 284px chart into a cage. Written down because the contrast test excludes it by name and a later
  reader should see the exclusion was a decision.
- **The report's chart capture now depends on an off-screen tree.** Tabs unmount three of the four
  charts, so `ReportCharts` mounts all four at a fixed 880px for the length of a download and
  `captureChart` is pointed at that rather than at the screen. Verified end to end: the generated
  PDF carries four `/Subtype /Image` objects. The cost is four extra Recharts trees during a
  download and a 400ms paint race in `EsopPoolSizeClient`.
- **`ScenarioStrip` still runs two live `calculateEsopPool` calls per render**, carried from [021].
  It is now inside a tab, so it only runs while the Overview tab is open — cheaper by accident, not
  by design, and it will cost again the moment the input rail grows slower fields.
