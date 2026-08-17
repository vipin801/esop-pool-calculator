/**
 * How prominently a field is shown, and — the same question, one answer —
 * whether the founder must answer it before a result may show.
 *
 * Four tiers, from D8: `drivesPool`, `minor`, `reportOnly`, `hidden`.
 * `requiredFieldPaths` (lib/completeness.ts) is exactly the `drivesPool`
 * filter over this table, so this file is the only place either question is
 * decided. There is deliberately no second notion of optionality beside it —
 * no per-field `optional` flag, no parallel list of names.
 *
 * **D9 moved the `drivesPool` boundary, and with it what the tier name
 * means.** It used to mean "this field has a term in the pool equation", which
 * made 21 fields mandatory before a number appeared under Basis A and 35 under
 * Basis B — most of them carrying a default the tool already holds: the 15%
 * buffer, 8% comp inflation, the 10/30/40/20 seniority mix, the advisory grant
 * midpoints, 15% attrition, a 12-month cliff. It now means **"no honest
 * default exists for this, so only the founder can supply it"**. A field that
 * still moves the answer but has a defensible default is `minor` — and
 * precisely because it moves the answer it must *show* that default rather
 * than render blank, or it becomes the unmarked default D6 forbids. See
 * `showsSeededDefault` at the bottom of this file.
 *
 * `hidden` means what it has always meant: no term in the equation at all. A
 * field that still moves an output, just not the one currently in focus, is
 * `reportOnly` or `minor`, never `hidden` — see the three corrections below,
 * all found by tracing the actual arithmetic rather than trusting the D8
 * brief's table by inspection.
 *
 * **Correction 1 — lambda and the exercise window are never `hidden`.** The
 * D8 brief's table puts them at `hidden` when recycling is off. Traced in
 * `src/lib/esop/cohorts.ts`: `lambda` (`exercise.vestedNeverExercisedPct`)
 * splits a leaver's vested options into `vestedLapsed` and `vestedExercised`
 * regardless of `recycleForfeited` — recycling only decides where a *lapsed*
 * option goes (back to the pool, or `cancelledNotRecycled`), not whether
 * lambda has an effect. And per M18, a cancelled-not-recycled option *leaves
 * FD_t*, while an exercised one only moves between buckets and leaves FD_t
 * unchanged — so with recycling off, lambda is exactly what decides how much
 * of FD_t departs the plan each year. Hiding it there would remove a field
 * still setting the answer. Under D9 the whole leavers-and-vesting block is
 * `minor` in both states rather than stepping up with the recycle toggle, so
 * this correction now holds unconditionally instead of only in the off state.
 * `exercise.exerciseWindowDays` sits with it, and did before D9 too — not
 * because it drives anything today (PROJECT.md's carried Defect 8 notes the
 * engine reads it nowhere) but because tying its visibility to recycling when
 * it does nothing regardless would invent a correlation nobody asked for.
 *
 * **Correction 2 — strike policy is live only under the realisable basis, not
 * fair value too.** The D8 brief's table lives it under "Basis B and value
 * basis is realisable or fair". Traced in `src/lib/esop/denominator.ts`:
 * `denominatorFor`'s `fairValue` arm is `theta * pricePerShare` and never
 * reads `exercisePrice` — only the `realisable` arm (`pricePerShare -
 * exercisePrice`) does. Changing the strike policy under fair value changes
 * the reported exercise price (a report concern) but not the option count.
 * Fair value's actual live control is theta, below.
 *
 * **Correction 3 — valuation growth doesn't go `hidden` just because a round
 * is modelled.** The D8 brief's table adds "and no rounds modelled" to
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

/** No separate `EsopInputs` field for "refresh enabled" — derived from the
 *  rate exactly as "model a round" is derived from `rounds.length > 0`. */
function isRefreshOn(inputs: EsopInputs): boolean {
  return inputs.grantPolicy.refresh.ratePct > 0;
}

/**
 * D9 §3, the whole of it: the inputs for which no honest default exists, so
 * the founder has to answer them before a number appears. Short and closed by
 * design — every other field in the form has a value the tool can defend
 * showing, which is why the catch-all below is `minor` rather than
 * `drivesPool`.
 *
 * `hiring.hiresPerYear.N` is indexed, so it is matched by prefix rather than
 * listed. Grant basis is here per D1; strike policy is required too, but only
 * where it actually decides the denominator — see `tierFor`'s own case for it
 * and Correction 2. The two Basis B additions (post-money valuation and
 * valuation growth) are conditional and likewise live in `tierFor`.
 */
const REQUIRED_ALWAYS = new Set<string>([
  'company.stage',
  'grantPolicy.grantBasis.kind',
  'company.fullyDilutedShares',
  'company.existingUnallocatedOptions',
  'hiring.horizonYears',
]);

const REQUIRED_PREFIX = 'hiring.hiresPerYear.';

/**
 * Section 07: never drives the recommended pool, always visible, and always
 * blank until touched — these are facts about the founder's company (an
 * incorporation date, a founder ownership percentage, whether an IMB
 * certificate exists), not modelling assumptions with a spec default, so
 * D9 §5's show-the-default rule deliberately does not reach them. Round
 * sub-fields join the set for the same two reasons: `pool-solver.ts` never
 * reads `rounds`, and `FundingRoundCard`'s seeded round is an invented
 * example that must not be presented as an assumption the tool is making.
 */
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

/**
 * Everything not named above or in `tierFor`'s switch. `minor`, not
 * `drivesPool`: `EsopInputs` is total (M33) and `buildSeedInputs` supplies
 * every field from `DEFAULTS`, so there is always a value to show, and D9 §3's
 * required list is the closed one. The trade is a fail-open — a genuinely
 * company-specific field added later and not added to `REQUIRED_ALWAYS` would
 * default to optional — which is why `visibility.test.ts` pins the required
 * set path by path in three states rather than only spot-checking tiers.
 */
const DEFAULT_TIER: Tier = 'minor';

export function tierFor(path: string, inputs: EsopInputs): Tier {
  const basisB = isRupeeValue(inputs);
  const { valueBasis } = inputs.grantPolicy;

  switch (path) {
    case 'company.postMoneyValuation':
      return basisB ? 'drivesPool' : 'reportOnly';

    /** ENGINE_SPEC §1 makes growth the largest single driver under Basis B, so
     *  a made-up figure here is silently wrong rather than merely approximate
     *  — D9 §3 keeps it required for that reason and not because it lacks a
     *  default (`DEFAULTS.valuationGrowthPctPerYear` is 40, provisional). */
    case 'growth.valuationGrowthPctPerYear':
      return basisB ? 'drivesPool' : 'hidden';

    /** Company-specific in the same way fully diluted shares and the existing
     *  pool are, so it stays required wherever it is live: M21 has the engine
     *  refuse (`missingOpeningCohorts`) rather than invent a grant year and a
     *  band, and a wrong figure here misstates paid-up capital. */
    case 'company.grantedOutstandingOptions':
    case 'openingGrants.0.band':
    case 'openingGrants.0.ageYearsAtPlanStart':
      return inputs.exercise.recycleForfeited || isRefreshOn(inputs) ? 'drivesPool' : 'reportOnly';

    /** D2, and never downgraded: required where it decides the denominator,
     *  visible and on screen everywhere else. Correction 2 above is why the
     *  live condition is realisable alone. */
    case 'grantPolicy.strikePolicy.kind':
    case 'grantPolicy.strikePolicy.discountPct':
      return basisB && valueBasis === 'realisable' ? 'drivesPool' : 'reportOnly';

    /** Reached only by a founder who has deliberately chosen the fair value
     *  basis, so requiring it costs nobody on the default path — and theta
     *  scales the option count outright (0.55 against 1 is close to 2x), which
     *  is the silently-wrong-rather-than-approximate test D9 §3 applies to
     *  valuation growth. Domain (0, 1] per M30. */
    case 'grantPolicy.fairValue.theta':
      return basisB && valueBasis === 'fairValue' ? 'drivesPool' : 'hidden';

    /** Optional under D9 §4, and no term in the equation at all under Basis A
     *  — a rupee grant is what comp inflation inflates and what a value basis
     *  converts. */
    case 'grantPolicy.compInflationPctPerYear':
    case 'grantPolicy.valueBasis':
      return basisB ? 'minor' : 'hidden';

    /** The refresh toggle is optional under D9 §4 and defaults to on, so its
     *  two sub-fields must be optional too: leaving them required would make
     *  a default the founder never chose demand two fields. */
    case 'grantPolicy.refresh.ratePct':
    case 'grantPolicy.refresh.sizePct':
      return isRefreshOn(inputs) ? 'minor' : 'hidden';

    default:
      if (REQUIRED_ALWAYS.has(path) || path.startsWith(REQUIRED_PREFIX)) {
        return 'drivesPool';
      }
      if (ALWAYS_REPORT_ONLY.has(path)) {
        return 'reportOnly';
      }
      return DEFAULT_TIER;
  }
}

/**
 * D9 §5. A `minor` field renders the value the engine is actually using
 * instead of an empty box, carrying the `EstimateMarker` its label already
 * has, so a founder can see what is being assumed on their behalf without
 * clicking anything. A blank field that silently contributes 15% to the answer
 * is exactly the unmarked default D6 forbids, and making the field optional is
 * what created the risk.
 *
 * Scoped to `minor` and to nothing else. `drivesPool` keeps D7's blank start
 * unchanged — that is the whole mechanism by which those fields are required.
 * `reportOnly` keeps it too, deliberately: those are company facts with
 * example seeds (an incorporation date three years ago, 55% founder
 * ownership, a ₹300 crore pre-money round), and pre-filling one would invent
 * a fact rather than disclose an assumption.
 */
export function showsSeededDefault(path: string, inputs: EsopInputs): boolean {
  return tierFor(path, inputs) === 'minor';
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
