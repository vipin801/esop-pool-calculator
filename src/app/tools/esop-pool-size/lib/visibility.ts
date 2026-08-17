/**
 * How prominently a field is shown, given the founder's own choices so far.
 *
 * Brief §4 defines four tiers. `drivesPool` is also the only tier D7 requires
 * before a result can show — `lib/completeness.ts`'s `requiredFieldPaths` is
 * exactly `visibleFieldPaths(...).filter(v => v.tier === 'drivesPool')`.
 * `minor`/`reportOnly` stay visible and editable but fall back to their seeded
 * default (D6) if the founder never touches them, the same way a `hidden`
 * field's default silently applies today. The brief's own worked example
 * confirms this reading: "A Basis A founder with recycling off sees 12
 * fields" only holds if the leavers-and-recycling fields (attrition, cliff,
 * vesting years, lambda, exercise window — none of them hidden, all of them
 * still real inputs) are optional in that state, not required.
 *
 * `hidden` means what the brief says it means: no term in the equation at
 * all. A field that still moves an output, just not the one currently in
 * focus, is `reportOnly` or `minor`, never `hidden` — see the two corrections
 * below, both found by tracing the actual arithmetic rather than trusting the
 * brief's table by inspection.
 *
 * **Correction 1 — lambda and the exercise window are never `hidden`.** The
 * brief's table puts them at `hidden` when recycling is off. Traced in
 * `src/lib/esop/cohorts.ts`: `lambda` (`exercise.vestedNeverExercisedPct`)
 * splits a leaver's vested options into `vestedLapsed` and `vestedExercised`
 * regardless of `recycleForfeited` — recycling only decides where a *lapsed*
 * option goes (back to the pool, or `cancelledNotRecycled`), not whether
 * lambda has an effect. And per M18, a cancelled-not-recycled option *leaves
 * FD_t*, while an exercised one only moves between buckets and leaves FD_t
 * unchanged — so with recycling off, lambda is exactly what decides how much
 * of FD_t departs the plan each year. Hiding it there would remove a field
 * still setting the answer, which is the brief's own bar for `hidden`. Kept
 * at `minor` when recycling is off, the same tier the brief already gives
 * attrition and the vesting schedule for the identical reason.
 * `exercise.exerciseWindowDays` sits with it at `minor` always, not because
 * it drives anything today — PROJECT.md's carried Defect 8 already notes the
 * engine reads it nowhere — but because tying its visibility to recycling
 * when it does nothing regardless would invent a correlation nobody asked
 * for. Fixing Defect 8 itself is out of scope here.
 *
 * **Correction 2 — strike policy is live only under the realisable basis, not
 * fair value too.** The brief's table lives it under "Basis B and value
 * basis is realisable or fair". Traced in `src/lib/esop/denominator.ts`:
 * `denominatorFor`'s `fairValue` arm is `theta * pricePerShare` and never
 * reads `exercisePrice` — only the `realisable` arm (`pricePerShare -
 * exercisePrice`) does. Changing the strike policy under fair value changes
 * the reported exercise price (a report concern) but not the option count.
 * Fair value's actual live control is theta, added below.
 *
 * **Correction 3 — valuation growth doesn't go `hidden` just because a round
 * is modelled.** The brief's table adds "and no rounds modelled" to
 * valuation growth's live condition. Traced in `src/lib/esop/roll-forward.ts`
 * and `valuation.ts`: `growth.valuationGrowthPctPerYear` feeds `V_t = V_0 *
 * (1+g)^t` for every year of the roll forward unconditionally; `rounds.ts` is
 * a separate, additional one-time dilution report layered on top, not a
 * replacement of the year-by-year path. A round being modelled does not stop
 * growth from pricing every grant.
 */
import type { EsopInputs } from '@/lib/esop';

export type Tier = 'drivesPool' | 'minor' | 'reportOnly' | 'hidden';

function isRupeeValue(inputs: EsopInputs): boolean {
  return inputs.grantPolicy.grantBasis.kind === 'rupeeValue';
}

function isRecycling(inputs: EsopInputs): boolean {
  return inputs.exercise.recycleForfeited;
}

/** No separate `EsopInputs` field for "refresh enabled" — derived from the
 *  rate exactly as "model a round" is derived from `rounds.length > 0`. */
function isRefreshOn(inputs: EsopInputs): boolean {
  return inputs.grantPolicy.refresh.ratePct > 0;
}

/** Fields with no conditional rule below are always on screen at full
 *  emphasis: stage, grant basis, fully diluted shares, existing pool, every
 *  hiring-plan and grant-per-band field, buffer, and the three toggle-touch
 *  paths (`exercise.recycleForfeited`, `grantPolicy.refresh.enabled`,
 *  `rounds.enabled`). */
const DEFAULT_TIER: Tier = 'drivesPool';

/** Section 07: never drives the recommended pool, always visible. Round
 *  sub-fields join this set too — `pool-solver.ts` never reads `rounds`, so a
 *  modelled round changes the round-cost and top-up outputs, never the
 *  headline pool percentage. */
const ALWAYS_REPORT_ONLY = new Set<string>([
  'company.founderOwnershipPctOfFullyDiluted',
  'company.authorisedCapitalShares',
  'company.faceValuePerShare',
  'company.companyType',
  'compliance.dpiitRecognised',
  'compliance.imbCertified80IAC',
  'compliance.incorporationDate',
  'compliance.grantsToGroupCompanyEmployees',
  'compliance.anyIndividualGrantAtOrAbove1Pct',
  'compliance.accountingBasis',
  'employeeValue.marginalTaxRatePct',
  'exercise.continuingEmployeeExercisePctPerYear',
  'rounds.0.year',
  'rounds.0.preMoneyValuation',
  'rounds.0.raiseAmount',
  'rounds.0.investorRequiredPostRoundPoolPct',
  'rounds.0.poolCreation',
]);

/** Section 05's fields that step down to `minor` — never `hidden` — when
 *  recycling is off. See Correction 1 above for lambda and the window. */
const LEAVERS_TIED_TO_RECYCLING = new Set<string>([
  'attrition.sector',
  'attrition.baseAnnualPct',
  'attrition.byBand.leadership',
  'vesting.cliffMonths',
  'vesting.vestYears',
  'vesting.frequency',
  'exercise.vestedNeverExercisedPct',
]);

export function tierFor(path: string, inputs: EsopInputs): Tier {
  const basisB = isRupeeValue(inputs);
  const { valueBasis } = inputs.grantPolicy;

  switch (path) {
    case 'company.postMoneyValuation':
      return basisB ? 'drivesPool' : 'reportOnly';

    case 'company.grantedOutstandingOptions':
    case 'openingGrants.0.band':
    case 'openingGrants.0.ageYearsAtPlanStart':
      return isRecycling(inputs) || isRefreshOn(inputs) ? 'drivesPool' : 'reportOnly';

    case 'growth.valuationGrowthPctPerYear':
    case 'grantPolicy.compInflationPctPerYear':
    case 'grantPolicy.valueBasis':
      return basisB ? 'drivesPool' : 'hidden';

    case 'grantPolicy.strikePolicy.kind':
    case 'grantPolicy.strikePolicy.discountPct':
      return basisB && valueBasis === 'realisable' ? 'drivesPool' : 'reportOnly';

    case 'grantPolicy.fairValue.theta':
      return basisB && valueBasis === 'fairValue' ? 'drivesPool' : 'hidden';

    case 'grantPolicy.refresh.ratePct':
    case 'grantPolicy.refresh.sizePct':
      return isRefreshOn(inputs) ? 'drivesPool' : 'hidden';

    case 'exercise.exerciseWindowDays':
      return 'minor';

    default:
      if (LEAVERS_TIED_TO_RECYCLING.has(path)) {
        return isRecycling(inputs) ? 'drivesPool' : 'minor';
      }
      if (ALWAYS_REPORT_ONLY.has(path)) {
        return 'reportOnly';
      }
      return DEFAULT_TIER;
  }
}

/** Ergonomic per-render helpers, the same shape `makeTouchHelpers` (touched.ts)
 *  already gives cards for the touched/required pair. */
export function makeVisibilityHelpers(inputs: EsopInputs) {
  return {
    tier: (path: string) => tierFor(path, inputs),
    isHidden: (path: string) => tierFor(path, inputs) === 'hidden',
    isReportOnly: (path: string) => tierFor(path, inputs) === 'reportOnly',
  };
}
