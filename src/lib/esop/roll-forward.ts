/**
 * ESOP pool engine — the roll forward.
 *
 * ENGINE_SPEC.md section 4.4:
 *
 *   Available_t = Available_(t-1) + TopUp_t - N_t - R_t + Returned_t
 *
 *   Exhaustion = first t where Available_t < 0, interpolated to a month on that
 *   year's grant run rate.
 *
 * This is where sections 4.1, 4.2 and 4.3 finally meet: 4.1 and 4.2 say how
 * many options the plan demands, 4.3 says how many come back, and this file
 * runs the two against a pool balance year by year.
 *
 * The bucket arithmetic underneath it, which every figure here obeys:
 *
 *   FD_t = issued shares + granted outstanding + available pool
 *
 * A top-up adds to the pool and to FD. A grant moves options from the pool to
 * granted, leaving FD alone. A recycled forfeiture moves them back, leaving FD
 * alone. An exercise moves them from granted to issued, leaving FD alone — that
 * is the leg section 4.3 insists on, and it is why exercises show up in paid-up
 * capital without changing the fully diluted count. A forfeiture that is *not*
 * recycled is the only flow that shrinks FD, because those options can never be
 * granted to anyone and counting them as potential shares would be a fiction.
 *
 * One ordering convention, stated once. Grants made during year t are priced
 * off the fully diluted count at the *start* of year t, after that year's
 * top-up. Pricing them off the closing count would be circular: the closing
 * count depends on the year's cancellations, which depend on the grants.
 */

import {
  advanceGrantCohorts,
  advanceHeadcountCohorts,
  cohortPolicy,
  newGrantCohort,
  newHireCohort,
  refreshEligibleByBand,
  type CohortPolicy,
  type CohortYear,
  type GrantCohort,
  type HeadcountCohort,
} from './cohorts';
import { denominatorForYear } from './denominator';
import {
  EsopEngineError,
  requireNonNegative,
  requirePositive,
  requireYearIndex,
} from './errors';
import {
  newHireGrantDemand,
  refreshGrantDemand,
  splitHiresByBand,
  sumOverBands,
} from './grants';
import { BANDS } from './types';
import type {
  AttritionInputs,
  AuthorisedCapitalHeadroom,
  Band,
  CompanyInputs,
  ExerciseInputs,
  GrantPolicyInputs,
  GrowthInputs,
  HiringPlan,
  PoolExhaustion,
  PoolTopUp,
  RollForwardYear,
  VestingSchedule,
} from './types';
import { pricePerShare as pricePerShareOf, valuationAtYear } from './valuation';

const MONTHS_PER_YEAR = 12;

/** Opening cohorts have to agree with the granted total to this relative slack. */
const COHORT_TOTAL_TOLERANCE = 1e-6;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function nonNegative(value: number): number {
  return value > 0 ? value : 0;
}

/* ------------------------------------------------------------------------- *
 * Arguments
 * ------------------------------------------------------------------------- */

export interface RollForwardArgs {
  readonly company: CompanyInputs;
  readonly hiring: HiringPlan;
  readonly growth: GrowthInputs;
  readonly grantPolicy: GrantPolicyInputs;
  readonly attrition: AttritionInputs;
  readonly exercise: ExerciseInputs;
  readonly vesting: VestingSchedule;
  readonly topUps: readonly PoolTopUp[];
  /**
   * The options already granted and outstanding, split into cohorts.
   *
   * Required whenever `company.grantedOutstandingOptions` is above zero. Section
   * 4.3 forbids approximating a cohort, and the engine will not invent a grant
   * year and a band on the founder's behalf. A caller holding only a total can
   * call `approximateOpeningCohortsFromTotal` and own the approximation itself.
   */
  readonly openingCohorts?: readonly GrantCohort[];
  /**
   * Staff already employed at the start of year 0, with their tenure.
   *
   * Left out, refresh demand in the early years comes only from the hires in the
   * plan, which understates it for any company that already has people.
   */
  readonly openingHeadcount?: readonly HeadcountCohort[];
  /**
   * FD_0 override, used by the section 4.5 fixed point to price a candidate
   * pool. Defaults to `company.fullyDilutedShares`.
   */
  readonly fullyDilutedSharesAtStart?: number;
  /** Available_(-1) override, for the same reason. Defaults to the existing pool. */
  readonly openingAvailableOptions?: number;
}

export interface RollForwardResult {
  readonly years: readonly RollForwardYear[];
  readonly exhaustion: PoolExhaustion;
  /** sum_t N_t. */
  readonly totalNewHireGrants: number;
  /** sum_t R_t. */
  readonly totalRefreshGrants: number;
  /** sum_t (N_t + R_t). Never negative. */
  readonly totalGrossConsumptionOptions: number;
  /** sum_t Returned_t. Zero when recycling is off. Never negative. */
  readonly totalReturnedToPool: number;
  readonly totalExercisedShares: number;
  readonly totalCancelledNotRecycled: number;
  readonly closingAvailable: number;
  readonly closingIssuedShares: number;
  readonly closingGrantedOutstanding: number;
  readonly closingFullyDilutedShares: number;
  readonly authorisedCapital: AuthorisedCapitalHeadroom;
  /** Every cohort's final state, for anything that wants to look inside. */
  readonly cohorts: readonly GrantCohort[];
  /** Every cohort's every year, for the same reason. */
  readonly cohortYears: readonly CohortYear[];
}

/* ------------------------------------------------------------------------- *
 * Opening state
 * ------------------------------------------------------------------------- */

function requireHorizon(horizonYears: number): void {
  if (!Number.isInteger(horizonYears) || horizonYears < 1) {
    throw new EsopEngineError(
      'invalidHorizon',
      'The planning horizon must be a whole number of years, at least one.',
      { horizonYears },
    );
  }
}

/** The cohorts have to account for exactly the options the company says are out. */
function resolveOpeningCohorts(
  company: CompanyInputs,
  openingCohorts: readonly GrantCohort[] | undefined,
): readonly GrantCohort[] {
  requireNonNegative(
    company.grantedOutstandingOptions,
    'negativeShareCount',
    'Granted and outstanding options cannot be negative.',
  );

  if (openingCohorts === undefined || openingCohorts.length === 0) {
    if (company.grantedOutstandingOptions > 0) {
      throw new EsopEngineError(
        'missingOpeningCohorts',
        'Options are already granted and outstanding, but no cohorts were supplied for them. Section 4.3 tracks grants by year and band, and an option granted three years ago behaves nothing like one granted last month when its holder resigns.',
        { grantedOutstandingOptions: company.grantedOutstandingOptions },
      );
    }
    return [];
  }

  const total = openingCohorts.reduce((sum, cohort) => sum + cohort.outstandingOptions, 0);
  const slack = Math.max(company.grantedOutstandingOptions, total, 1) * COHORT_TOTAL_TOLERANCE;

  if (Math.abs(total - company.grantedOutstandingOptions) > slack) {
    throw new EsopEngineError(
      'openingCohortsMismatch',
      'The opening cohorts do not add up to the granted and outstanding options. The difference would land in issued shares and misstate paid-up capital.',
      { cohortTotal: total, grantedOutstandingOptions: company.grantedOutstandingOptions },
    );
  }

  return openingCohorts;
}

/**
 * Issued shares at the start of year 0.
 *
 * FD_0 is the whole picture, so what is actually issued is FD_0 less the pool
 * that has not been granted and the options that have been granted but not yet
 * exercised. A company whose pool and grants together exceed its fully diluted
 * count has mistyped one of the three.
 */
function openingIssuedShares(args: {
  readonly fullyDilutedShares: number;
  readonly available: number;
  readonly granted: number;
}): number {
  const issued = args.fullyDilutedShares - args.available - args.granted;

  if (issued < 0) {
    throw new EsopEngineError(
      'negativeShareCount',
      'The unallocated pool and the granted options together exceed the fully diluted share count, which would leave the company with negative issued shares.',
      { ...args, issued },
    );
  }

  return issued;
}

/* ------------------------------------------------------------------------- *
 * Authorised capital, spec output item 7
 * ------------------------------------------------------------------------- */

/**
 * Authorised capital must cover issued capital plus the pool. The spec wants the
 * share shortfall and the rupee increase, and explicitly not a fee estimate,
 * because stamp duty and ROC fees vary by state.
 */
export function authorisedCapitalHeadroom(args: {
  readonly authorisedShares: number;
  readonly issuedShares: number;
  readonly grantedOutstanding: number;
  readonly availablePool: number;
  readonly faceValuePerShare: number;
}): AuthorisedCapitalHeadroom {
  const { authorisedShares, issuedShares, grantedOutstanding, availablePool, faceValuePerShare } =
    args;

  requireNonNegative(
    authorisedShares,
    'negativeShareCount',
    'Authorised capital cannot be a negative number of shares.',
  );
  requirePositive(
    faceValuePerShare,
    'invalidMoneyAmount',
    'Face value per share must be above zero to price an increase in authorised capital.',
  );

  const requiredShares = issuedShares + grantedOutstanding + nonNegative(availablePool);
  const shortfallShares = nonNegative(requiredShares - authorisedShares);

  return {
    authorisedShares,
    requiredShares,
    shortfallShares,
    increaseRequiredRupees: shortfallShares * faceValuePerShare,
    sufficient: shortfallShares === 0,
  };
}

/* ------------------------------------------------------------------------- *
 * Exhaustion
 * ------------------------------------------------------------------------- */

/**
 * The first year the balance goes below zero, interpolated to a month on that
 * year's grant run rate, per section 4.4.
 *
 * The run rate is that year's grants, N_t + R_t, spread evenly over twelve
 * months. Returns are not netted off it: a founder asking when the pool runs
 * out is asking when they can no longer make an offer, and a forfeiture that
 * arrives in November does not fund a grant made in March.
 *
 * A pool with nothing in it exhausts at month 0. That is the honest answer, not
 * a missing one, and it is the reason `monthIndex` is nullable on the shape
 * rather than zero-means-never.
 */
function exhaustionFrom(
  years: readonly RollForwardYear[],
  hiresPerYear: readonly number[],
): PoolExhaustion {
  const totalHires = years.reduce((sum, year) => sum + year.hires, 0);

  for (const year of years) {
    if (year.closingAvailable >= 0) continue;

    const openingWithTopUp = year.openingAvailable + year.topUp;
    const grantRunRate = year.newHireGrants + year.refreshGrants;
    const monthsIntoYear =
      grantRunRate > 0
        ? clamp((openingWithTopUp / grantRunRate) * MONTHS_PER_YEAR, 0, MONTHS_PER_YEAR)
        : 0;

    const completedHires = years
      .filter((earlier) => earlier.year < year.year)
      .reduce((sum, earlier) => sum + earlier.hires, 0);
    const partYearHires = (hiresPerYear[year.year] ?? 0) * (monthsIntoYear / MONTHS_PER_YEAR);

    return {
      exhausted: true,
      yearIndex: year.year,
      monthIndex: year.year * MONTHS_PER_YEAR + monthsIntoYear,
      hiresSupported: completedHires + partYearHires,
    };
  }

  return { exhausted: false, yearIndex: null, monthIndex: null, hiresSupported: totalHires };
}

/* ------------------------------------------------------------------------- *
 * The roll forward
 * ------------------------------------------------------------------------- */

/**
 * Every top-up is checked once, up front, rather than in the year it lands. A
 * top-up scheduled for year -1 or for a year past the horizon would otherwise
 * be silently dropped instead of raising.
 */
function requireTopUps(topUps: readonly PoolTopUp[]): void {
  for (const topUp of topUps) {
    requireYearIndex(topUp.year);
    requireNonNegative(topUp.options, 'negativeShareCount', 'A pool top-up cannot be negative.', {
      year: topUp.year,
    });
  }
}

function topUpForYear(topUps: readonly PoolTopUp[], year: number): number {
  return topUps.reduce((sum, topUp) => (topUp.year === year ? sum + topUp.options : sum), 0);
}

/**
 * D_t, or null under Basis A.
 *
 * Basis A never reaches this function, which is the point. Asking for the
 * denominator under a percent-of-equity plan would let a degenerate realisable
 * spread throw an error at a founder whose answer does not depend on the price
 * per share at all.
 */
function denominatorForBasis(args: {
  readonly grantPolicy: GrantPolicyInputs;
  readonly pricePerShare: number;
  readonly faceValuePerShare: number;
}): number | null {
  const { grantPolicy, pricePerShare, faceValuePerShare } = args;

  if (grantPolicy.grantBasis.kind === 'percentOfEquity') return null;

  return denominatorForYear({
    valueBasis: grantPolicy.valueBasis,
    strikePolicy: grantPolicy.strikePolicy,
    pricePerShare,
    faceValuePerShare,
    theta: grantPolicy.fairValue.theta,
  });
}

/** Section 4.4, year by year, with sections 4.1, 4.2 and 4.3 running inside it. */
export function runRollForward(args: RollForwardArgs): RollForwardResult {
  const {
    company,
    hiring,
    growth,
    grantPolicy,
    attrition,
    exercise,
    vesting,
    topUps,
    openingCohorts,
    openingHeadcount,
    fullyDilutedSharesAtStart,
    openingAvailableOptions,
  } = args;

  requireHorizon(hiring.horizonYears);
  requireTopUps(topUps);
  requireNonNegative(
    company.existingUnallocatedOptions,
    'negativeShareCount',
    'The existing unallocated pool cannot be negative.',
  );
  requireNonNegative(
    grantPolicy.bufferPct,
    'invalidMoneyAmount',
    'The pool buffer cannot be a negative percentage.',
  );

  const policy: CohortPolicy = cohortPolicy({ vesting, attrition, exercise });

  let grantCohorts: readonly GrantCohort[] = resolveOpeningCohorts(company, openingCohorts);
  let headcountCohorts: readonly HeadcountCohort[] = openingHeadcount ?? [];

  const startFullyDiluted = fullyDilutedSharesAtStart ?? company.fullyDilutedShares;
  requirePositive(
    startFullyDiluted,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero to roll a pool forward.',
  );

  let available = openingAvailableOptions ?? company.existingUnallocatedOptions;
  requireNonNegative(
    available,
    'negativeShareCount',
    'The opening pool cannot be a negative number of options.',
  );

  let granted = grantCohorts.reduce((sum, cohort) => sum + cohort.outstandingOptions, 0);
  let issued = openingIssuedShares({
    fullyDilutedShares: startFullyDiluted,
    available,
    granted,
  });
  let fullyDiluted = startFullyDiluted;

  const years: RollForwardYear[] = [];
  const cohortYears: CohortYear[] = [];

  for (let year = 0; year < hiring.horizonYears; year += 1) {
    const openingAvailable = available;
    const topUp = topUpForYear(topUps, year);

    /** The top-up is authorised at the start of the year, so it prices the year. */
    const openingFullyDiluted = fullyDiluted + topUp;
    available = openingAvailable + topUp;

    const valuation = valuationAtYear({
      postMoneyValuation: company.postMoneyValuation,
      growthPctPerYear: growth.valuationGrowthPctPerYear,
      year,
    });
    const pricePerShare = pricePerShareOf({
      valuation,
      fullyDilutedShares: openingFullyDiluted,
    });
    const denominator = denominatorForBasis({
      grantPolicy,
      pricePerShare,
      faceValuePerShare: company.faceValuePerShare,
    });

    const grantYear = {
      year,
      fullyDilutedShares: openingFullyDiluted,
      compInflationPctPerYear: grantPolicy.compInflationPctPerYear,
    };

    /* --- 4.1 New hire grants --- */
    const hires = hiring.hiresPerYear[year] ?? 0;
    const hiresByBand = splitHiresByBand(hires, hiring.seniorityMix);
    const newHires = newHireGrantDemand({
      grantBasis: grantPolicy.grantBasis,
      hiresByBand,
      grantYear,
      ...(denominator === null ? {} : { denominator }),
    });

    /* --- 4.2 Refresh grants, on the base 4.3 keeps --- */
    const eligibleByBand = refreshEligibleByBand({
      cohorts: headcountCohorts,
      year,
      eligibilityMonths: grantPolicy.refresh.eligibilityMonths,
    });
    const refresh = refreshGrantDemand({
      grantBasis: grantPolicy.grantBasis,
      eligibleByBand,
      refresh: grantPolicy.refresh,
      grantYear,
      ...(denominator === null ? {} : { denominator }),
    });

    available -= newHires.totalOptions + refresh.totalOptions;

    /* --- 4.3 Cohorts: this year's grants join, then everything ages a year --- */
    const bornThisYear = BANDS.map((band: Band) =>
      newGrantCohort({
        year,
        band,
        fromNewHires: newHires.optionsByBand[band],
        fromRefresh: refresh.optionsByBand[band],
      }),
    ).filter((cohort) => cohort.grantedOptions > 0);

    const hireCohorts = BANDS.map((band: Band) =>
      newHireCohort({ year, band, headcount: hiresByBand[band] }),
    ).filter((cohort) => cohort.headcount > 0);

    const advancedGrants = advanceGrantCohorts({
      cohorts: [...grantCohorts, ...bornThisYear],
      year,
      policy,
    });
    grantCohorts = advancedGrants.cohorts;
    cohortYears.push(...advancedGrants.entries);
    const flows = advancedGrants.totals;

    const advancedHeadcount = advanceHeadcountCohorts({
      cohorts: [...headcountCohorts, ...hireCohorts],
      year,
      policy,
    });
    headcountCohorts = advancedHeadcount.cohorts;

    /* --- Back into the buckets --- */
    available += flows.returnedToPool;
    granted = flows.closingOutstanding;
    issued += flows.exercised;
    fullyDiluted = openingFullyDiluted - flows.cancelledNotRecycled;

    years.push({
      year,
      openingAvailable,
      topUp,
      newHireGrants: newHires.totalOptions,
      refreshGrants: refresh.totalOptions,
      returnedToPool: flows.returnedToPool,
      unvestedForfeited: flows.unvestedForfeited,
      vestedLapsed: flows.vestedLapsed,
      vestedExercised: flows.vestedExercised,
      continuingEmployeeExercised: flows.continuingExercised,
      exercisedShares: flows.exercised,
      cancelledNotRecycled: flows.cancelledNotRecycled,
      closingAvailable: available,
      fullyDilutedShares: fullyDiluted,
      openingFullyDilutedShares: openingFullyDiluted,
      valuation,
      pricePerShare,
      denominator,
      closingGrantedOutstanding: granted,
      closingVestedOutstanding: flows.closingVested,
      closingIssuedShares: issued,
      closingPaidUpCapitalRupees: issued * company.faceValuePerShare,
      hires,
      closingHeadcount: advancedHeadcount.closingHeadcount,
      refreshEligibleHeadcount: sumOverBands(eligibleByBand),
    });
  }

  const totalNewHireGrants = years.reduce((sum, year) => sum + year.newHireGrants, 0);
  const totalRefreshGrants = years.reduce((sum, year) => sum + year.refreshGrants, 0);

  return {
    years,
    exhaustion: exhaustionFrom(years, hiring.hiresPerYear),
    totalNewHireGrants,
    totalRefreshGrants,
    totalGrossConsumptionOptions: totalNewHireGrants + totalRefreshGrants,
    totalReturnedToPool: years.reduce((sum, year) => sum + year.returnedToPool, 0),
    totalExercisedShares: years.reduce((sum, year) => sum + year.exercisedShares, 0),
    totalCancelledNotRecycled: years.reduce((sum, year) => sum + year.cancelledNotRecycled, 0),
    closingAvailable: available,
    closingIssuedShares: issued,
    closingGrantedOutstanding: granted,
    closingFullyDilutedShares: fullyDiluted,
    authorisedCapital: authorisedCapitalHeadroom({
      authorisedShares: company.authorisedCapitalShares,
      issuedShares: issued,
      grantedOutstanding: granted,
      availablePool: available,
      faceValuePerShare: company.faceValuePerShare,
    }),
    cohorts: grantCohorts,
    cohortYears,
  };
}
