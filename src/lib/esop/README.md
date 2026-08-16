# The ESOP pool engine

One import. One function. One shape in, one shape out.

```ts
import { calculateEsopPool, type EsopInputs, type EsopResult } from '@/lib/esop';

const result: EsopResult = calculateEsopPool(inputs);
```

`calculateEsopPool` is **the only function the front end may import**. Everything
else `index.ts` exports is data or a type. `__tests__/public-api.test.ts` keeps
it that way.

Model source of truth: [`docs/esop/ENGINE_SPEC.md`](../../../docs/esop/ENGINE_SPEC.md).
Product source of truth: [`docs/esop/PROJECT.md`](../../../docs/esop/PROJECT.md).
If this file disagrees with either, this file is wrong.

---

## The input contract

`EsopInputs` has no optional field and the engine applies no default of its own.
Leave something out and `tsc` says so, rather than the engine quietly computing
against an assumption the founder never saw. `DEFAULTS` is what a **form** seeds
itself from, in the form, where every value is visible and editable — D6.

| Group | Field | Meaning |
|---|---|---|
| `company` | `stage` | `preSeed` `seed` `seriesA` `seriesB` `seriesCPlus`. Picks the benchmark band. |
| | `companyType` | `private` or `unlistedPublic`. Ordinary vs special resolution. |
| | `postMoneyValuation` | V₀, in rupees. |
| | `fullyDilutedShares` | FD₀, **including** the unallocated pool. |
| | `existingUnallocatedOptions` | The pool authorised and not yet granted. |
| | `grantedOutstandingOptions` | Granted, live, not yet exercised. Needs `openingGrants` to match. |
| | `faceValuePerShare` | Par. The floor on every exercise price. |
| | `authorisedCapitalShares` | Authorised capital, held in shares. |
| | `founderOwnershipPctOfFullyDiluted` | Founders' share of FD₀. Investors are the remainder. |
| `hiring` | `horizonYears` | T. Whole years, at least one. |
| | `hiresPerYear` | Index 0 is the first plan year. Must be at least `horizonYears` long. |
| | `seniorityMix` | Percent per band. Should sum to 100; if it does not, a warning says so and hires are lost. |
| `growth` | `valuationGrowthPctPerYear` | Drives V*ₜ*. Irrelevant under Basis A, decisive under Basis B. |
| `grantPolicy` | `grantBasis` | **The fork.** `percentOfEquity` with `grantPctByBand`, or `rupeeValue` with `grantValueByBand`. |
| | `comparisonGrantBasis` | The other kind, for output item 1. Same kind as `grantBasis` is refused. |
| | `strikePolicy` | `faceValue`, `lastRoundPrice`, or `discountToFMV` with a percent. |
| | `valueBasis` | `notional`, `realisable` or `fairValue`. Inert under Basis A. |
| | `compInflationPctPerYear` | i. Applied to rupee grant values only. |
| | `refresh` | `ratePct`, `sizePct`, `eligibilityMonths`. |
| | `bufferPct` | Headroom on total consumption in the fixed point. |
| | `fairValue` | `theta` in (0, 1], plus the expected life and volatility behind it. |
| `attrition` | `baseAnnualPct`, `byBand`, `sector` | Sector **prefills** the base rate; it never scales it (M16). |
| `exercise` | `exerciseWindowDays` | 30, 90, 365 or 1825. |
| | `vestedNeverExercisedPct` | lambda. Vested options never exercised after exit. |
| | `continuingEmployeeExercisePctPerYear` | Zero pre-liquidity in India. |
| | `recycleForfeited` | Whether forfeited and lapsed options come back to the pool. |
| `vesting` | `cliffMonths` | **Below 12 is refused**, not warned about. Rule 12(6)(a). |
| | `vestYears`, `frequency` | k, and a tick the spec's linear curve does not model. |
| `compliance` | `dpiitRecognised` | Rule 12 promoter exemption. |
| | `imbCertified80IAC` | Perquisite tax deferral. **Never collapse these two into one toggle.** |
| | `incorporationDate` | ISO. The DPIIT exemption runs ten years from it. |
| | `grantsToGroupCompanyEmployees`, `anyIndividualGrantAtOrAbove1Pct` | Separate-resolution triggers. |
| | `accountingBasis` | `indAS102` or `icaiGuidanceNote`. Decides how the expense is valued. |
| | `instrument` | Build the field, expose only `ESOP`. |
| `employeeValue` | `marginalTaxRatePct` | The employee's slab rate, for output item 11. |
| `rounds` | `FundingRound[]` | Year, pre-money, raise, investor-required post-round pool %, and pre- or post-money. Years must strictly increase. |
| `topUps` | `PoolTopUp[]` | Options added to the pool in a given plan year. |
| `openingGrants` | `OpeningGrantCohortInput[]` | Required when `grantedOutstandingOptions` is above zero. Band, options, age at plan start, and optionally the grant-date value. |
| `openingHeadcount` | `OpeningHeadcountInput[]` | Staff already employed, with tenure. Left empty, early refresh demand is understated. |
| `asOfDate` | ISO date | When the answer is struck. The engine never reads a clock. |

---

## What comes back

`EsopResult` covers ENGINE_SPEC.md section 7, items 1 to 11.

**Two series, never merged.** There is no top-level `rollForward` and no
top-level `exhaustion`. The same plan is run twice and both runs come back
labelled:

- `result.recommended` — the plan at the pool section 4.5 solves for. Closes
  every year with options in hand.
- `result.current` — the same plan at the pool the founder holds **today**. An
  empty pool is overdrawn from month zero and supports zero hires.

They disagree by construction. Spec item 2 asks for the exhaustion month of the
*current* pool, so read `result.current.exhaustion`. Item 5's roll forward is
whichever series the screen is about — and the screen has to say which.

| Item | Field |
|---|---|
| 1 | `recommendedPool.selected` and `.comparison` |
| 2 | `current.exhaustion` |
| 3 | `topUpAtNextRound`, and `rounds[n].topUp` |
| 4 | `poolCostToFounders`, and `rounds[n].cost` |
| 5 | `recommended.years` / `current.years` |
| 6 | `capTables.before` / `.after` / `.afterModelledRound` |
| 7 | `recommended.authorisedCapital` |
| 8 | `esopExpense` |
| 9 | `complianceChecks` |
| 10 | `benchmarkComparison` |
| 11 | `medianEmployeeValue` |

Also returned: `grantValueBreakdown` (section 2, per band per year, with the
realisable basis carrying its refusal as data rather than throwing), `solver`,
`warnings`, and `asOfDate`.

---

## Failure

Bad inputs throw `EsopEngineError` with a `code` from `ESOP_ERROR_CODES`, never
`NaN` and never a number that is arithmetically valid and economically absurd.

```ts
try {
  return calculateEsopPool(inputs);
} catch (error) {
  if (isEsopEngineError(error)) return messageFor(error.code, error.detail);
  throw error;
}
```

---

## Three rules a caller has to know

1. **Never print a pool percentage without its grant basis and strike policy.**
   `PoolSizing` carries both, welded on, so the prohibition is structural.
2. **Never present DPIIT recognition as giving the tax deferral.** It needs an
   IMB certificate as well. `medianEmployeeValue.taxDeferralAvailable` is the
   only boolean that reads both, and it is a deferral, not a discount — the tax
   figure does not change when it is true.
3. **Never show both benchmark tracks as one number.** `benchmarkComparison`
   returns both, always, and has no field that could rank them.
