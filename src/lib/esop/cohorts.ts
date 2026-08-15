/**
 * ESOP pool engine — cohort tracking.
 *
 * ENGINE_SPEC.md section 4.3, whose heading is "required, do not approximate".
 * Every grant cohort is tracked by the year it was granted and the band it went
 * to, because the three things that happen to a leaver's options depend on how
 * far that particular cohort has vested, and a pool-wide average vesting
 * fraction gets that wrong in both directions at once.
 *
 *   age = t - s
 *   v = 0                                        if age < c/12
 *   v = clamp((age - c/12) / (k - c/12), 0, 1)   otherwise
 *   leavers = a_b * O_cohort
 *     unvested forfeited = leavers * (1 - v)      -> pool, if recycling is on
 *     vested lapsed      = leavers * v * lambda   -> pool, if recycling is on
 *     vested exercised   = leavers * v * (1-lambda)
 *                          -> leaves the pool permanently, becomes issued shares
 *
 * The third leg is the one v1 dropped. Those shares are issued: they land in
 * paid-up capital and they eat authorised capital headroom, so an engine that
 * treats every departure as a return to the pool overstates the pool it hands
 * back and understates the share capital the company has to authorise.
 *
 * Two conventions this file adds to the spec's formula, both stated here rather
 * than buried:
 *
 * 1. **Mid-year grants.** Hires and their grants land throughout a year, not on
 *    1 April. A cohort granted across year t has therefore been exposed to
 *    roughly half a year of attrition by the end of year t, not a full year.
 *    Charging it a full year of attrition in its own grant year roughly doubles
 *    first-year recycling, which is exactly the error the front-end build makes.
 *    Every later year is charged in full. See `attritionExposureYears`.
 *
 * 2. **Vesting is measured at `age = t - s`, exactly as the spec writes it**,
 *    and is deliberately *not* shifted by the same half year. The spec is the
 *    model source of truth; the mid-year convention is scoped to the attrition
 *    exposure the prompt named, and nowhere else. Under the default 12 month
 *    cliff the two readings agree anyway in the grant year, because v is zero
 *    either way.
 *
 * Nothing here is stateful. A cohort is advanced by a pure function that takes
 * its opening state and returns its closing state alongside the flows.
 */

import { STATUTORY } from './defaults';
import {
  EsopEngineError,
  requireFinite,
  requireNonNegative,
  requirePercentage,
  requirePositive,
} from './errors';
import { mapBands, type ByBand } from './grants';
import { BANDS, type AttritionInputs, type Band, type ExerciseInputs, type VestingSchedule } from './types';

/* ------------------------------------------------------------------------- *
 * Conventions
 * ------------------------------------------------------------------------- */

/**
 * How much of a year of attrition a cohort granted during that year is exposed
 * to. Grants land throughout the year, so the average cohort member has been
 * around for half of it.
 *
 * This is a modelling convention, not a market estimate, so it carries no
 * provenance tag under model decision M3 — the same reasoning that keeps the
 * solver constants out of the defaults table.
 */
export const MID_YEAR_EXPOSURE_YEARS = 0.5;

/** A full year for every cohort past its own grant year. */
export const FULL_YEAR_EXPOSURE_YEARS = 1;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Turns -0 into 0 and pins away the last-bit residue of an exact cancellation. */
function nonNegative(value: number): number {
  return value > 0 ? value : 0;
}

/* ------------------------------------------------------------------------- *
 * Vesting
 * ------------------------------------------------------------------------- */

/**
 * v, the vested fraction of a cohort at a given age. Spec section 4.3.
 *
 * Note what the spec's formula does at the cliff itself: `(age - c/12)` is zero
 * there, so v is zero. Vesting starts *at* the cliff and runs linearly to k; it
 * does not step to 25% on the first anniversary. That is the spec's model, and
 * the spec wins over both the code and the market convention it differs from.
 */
/**
 * The constraints the *curve* has: a schedule outside these cannot be evaluated
 * at all. Shared by `vestedFraction` and by the boundary guard below, so the
 * two cannot drift apart about what a well-formed schedule is.
 */
function requireVestingShape(cliffMonths: number, vestYears: number): void {
  requireNonNegative(
    cliffMonths,
    'invalidVestingSchedule',
    'The cliff in months cannot be negative.',
  );
  requirePositive(
    vestYears,
    'invalidVestingSchedule',
    'The vesting period in years must be above zero.',
  );

  if (cliffMonths / 12 > vestYears) {
    throw new EsopEngineError(
      'invalidVestingSchedule',
      'The cliff cannot fall after the end of the vesting period. Nothing would ever vest.',
      { cliffMonths, vestYears },
    );
  }
}

/**
 * Rule 12(6)(a): a minimum of one year between grant and vesting.
 *
 * ENGINE_SPEC.md section 5 says to block any input below twelve months, and
 * this is where that happens — at the boundary a founder's `VestingSchedule`
 * crosses into the engine, as a typed refusal rather than a warning printed
 * next to a number that was computed anyway. A scheme with a shorter cliff
 * cannot lawfully be adopted, so pricing one produces a pool size for a plan
 * that does not exist.
 *
 * Deliberately not inside `vestedFraction`. That function is the spec's vesting
 * curve, and its guards are the mathematical ones. Twelve months is law, not
 * maths, and the two carry different error codes because a UI has to say
 * different things about them.
 *
 * General information, not legal advice.
 */
export function requireLawfulVestingSchedule(vesting: VestingSchedule): void {
  requireVestingShape(vesting.cliffMonths, vesting.vestYears);

  if (vesting.cliffMonths < STATUTORY.minVestingMonths) {
    throw new EsopEngineError(
      'cliffBelowStatutoryMinimum',
      `Rule 12(6)(a) requires at least ${STATUTORY.minVestingMonths} months between grant and vesting. A scheme with a shorter cliff cannot lawfully be adopted, so the engine will not price one.`,
      { cliffMonths: vesting.cliffMonths, minimumMonths: STATUTORY.minVestingMonths },
    );
  }
}

export function vestedFraction(args: {
  readonly ageYears: number;
  readonly cliffMonths: number;
  readonly vestYears: number;
}): number {
  const { ageYears, cliffMonths, vestYears } = args;

  requireFinite(ageYears, 'invalidVestingSchedule', 'A cohort age in years must be finite.');
  requireVestingShape(cliffMonths, vestYears);

  const cliffYears = cliffMonths / 12;

  if (ageYears < cliffYears) return 0;
  /** Cliff exactly at the end of vesting: the whole grant vests in one step. */
  if (cliffYears === vestYears) return 1;

  return clamp((ageYears - cliffYears) / (vestYears - cliffYears), 0, 1);
}

/** Rule 12(6)(a) sets a floor of 12 months. The UI blocks below it; the engine reports it. */
export function cliffMeetsStatutoryMinimum(vesting: VestingSchedule, minMonths: number): boolean {
  return vesting.cliffMonths >= minMonths;
}

/* ------------------------------------------------------------------------- *
 * Attrition exposure
 * ------------------------------------------------------------------------- */

/**
 * Years of attrition a cohort is exposed to during plan year `year`.
 *
 * Half a year in the cohort's own grant year, a full year after that. Cohorts
 * carried in from before the plan started have a null grant year and are always
 * exposed in full.
 */
export function attritionExposureYears(args: {
  readonly grantYear: number | null;
  readonly year: number;
}): number {
  return args.grantYear === args.year ? MID_YEAR_EXPOSURE_YEARS : FULL_YEAR_EXPOSURE_YEARS;
}

/**
 * a_b. A band override if the founder set one, otherwise the base rate.
 *
 * `AttritionInputs.sector` is deliberately not read here. The sector picks the
 * *base* rate — it is a prefill for `baseAnnualPct`, per `DEFAULT_ATTRITION_BY_SECTOR_PCT`
 * — rather than scaling whatever the founder typed. Multiplying the two would
 * silently overrule a founder who edited the base after picking a sector.
 * Model decision M16.
 */
export function attritionPctByBand(attrition: AttritionInputs): ByBand {
  requirePercentage(
    attrition.baseAnnualPct,
    'invalidAttritionRate',
    'Base annual attrition must sit between 0% and 100%.',
  );

  return mapBands((band) => {
    const override = attrition.byBand[band];
    if (override === undefined) return attrition.baseAnnualPct;

    requirePercentage(
      override,
      'invalidAttritionRate',
      `Annual attrition for ${band} must sit between 0% and 100%.`,
      { band },
    );
    return override;
  });
}

/* ------------------------------------------------------------------------- *
 * Cohort shapes
 * ------------------------------------------------------------------------- */

/**
 * One grant cohort, keyed by grant year and band.
 *
 * `grantYear` is null for options already granted when the plan starts, because
 * those were granted before year 0 and their year index would be negative.
 * `ageYearsAtEndOfYear0` carries their age instead, and is `-grantYear` for
 * every in-plan cohort, so `age at end of year t` is one addition either way.
 */
export interface GrantCohort {
  readonly id: string;
  readonly band: Band;
  /** s. Null for grants made before the plan started. */
  readonly grantYear: number | null;
  /** age at the end of year t is this plus t. */
  readonly ageYearsAtEndOfYear0: number;
  /** What was granted, ever. Never changes. */
  readonly grantedOptions: number;
  /** Still live: not forfeited, not lapsed, not exercised. */
  readonly outstandingOptions: number;
  /** Composition. Same year and band behave identically, so they share a cohort. */
  readonly fromNewHires: number;
  readonly fromRefresh: number;
  /**
   * Fair value per option at grant, carried only by opening cohorts whose
   * caller supplied one via `OpeningGrantCohortInput.grantDateValuePerOption`.
   * `undefined` and `0` are distinct states, not interchangeable — see that
   * field's comment — and this one preserves the distinction through every
   * year the roll forward advances the cohort, because `stepGrantCohort`
   * closes each year with `{ ...cohort, outstandingOptions: closingOutstanding }`,
   * which carries every other field, including this one, forward untouched.
   */
  readonly grantDateValuePerOption?: number;
}

/** One cohort's year: the vested fraction, the three-way split, and the closing state. */
export interface CohortYear {
  readonly year: number;
  readonly cohortId: string;
  readonly band: Band;
  readonly grantYear: number | null;
  readonly ageYears: number;
  readonly vestedFraction: number;
  readonly attritionExposureYears: number;
  readonly openingOutstanding: number;
  readonly leavers: number;
  /** The three legs. They sum to `leavers`, exactly. */
  readonly unvestedForfeited: number;
  readonly vestedLapsed: number;
  readonly vestedExercised: number;
  /** Exercises by employees who have not left. Zero pre-liquidity by default. */
  readonly continuingExercised: number;
  /** Forfeited plus lapsed, but only when recycling is on. */
  readonly returnedToPool: number;
  /** Forfeited plus lapsed when recycling is off: gone, and not re-grantable. */
  readonly cancelledNotRecycled: number;
  /** Exercised on exit plus exercised in service. Becomes issued shares. */
  readonly exercised: number;
  readonly closingOutstanding: number;
  readonly closingVested: number;
}

/** The flows across every cohort in one year. */
export interface CohortYearTotals {
  readonly unvestedForfeited: number;
  readonly vestedLapsed: number;
  readonly vestedExercised: number;
  readonly continuingExercised: number;
  readonly returnedToPool: number;
  readonly cancelledNotRecycled: number;
  readonly exercised: number;
  readonly closingOutstanding: number;
  readonly closingVested: number;
}

/** Everything section 4.3 needs about how options behave, gathered once. */
export interface CohortPolicy {
  readonly vesting: VestingSchedule;
  /** a_b. */
  readonly attritionPctByBand: ByBand;
  /** lambda. Share of a leaver's *vested* options that are never exercised. */
  readonly vestedNeverExercisedPct: number;
  /** Exercises by continuing employees, as a share of their vested holding per year. */
  readonly continuingEmployeeExercisePctPerYear: number;
  readonly recycleForfeited: boolean;
}

export function cohortPolicy(args: {
  readonly vesting: VestingSchedule;
  readonly attrition: AttritionInputs;
  readonly exercise: ExerciseInputs;
}): CohortPolicy {
  const { vesting, attrition, exercise } = args;

  /** Every path into section 4.3 comes through here, so the floor is checked once. */
  requireLawfulVestingSchedule(vesting);

  requirePercentage(
    exercise.vestedNeverExercisedPct,
    'invalidExercisePolicy',
    'Lambda, the share of vested options never exercised after exit, must sit between 0% and 100%.',
  );
  requirePercentage(
    exercise.continuingEmployeeExercisePctPerYear,
    'invalidExercisePolicy',
    'The continuing-employee exercise rate must sit between 0% and 100% a year.',
  );

  return {
    vesting,
    attritionPctByBand: attritionPctByBand(attrition),
    vestedNeverExercisedPct: exercise.vestedNeverExercisedPct,
    continuingEmployeeExercisePctPerYear: exercise.continuingEmployeeExercisePctPerYear,
    recycleForfeited: exercise.recycleForfeited,
  };
}

/* ------------------------------------------------------------------------- *
 * The cohort step
 * ------------------------------------------------------------------------- */

/**
 * Advance one cohort through one year.
 *
 * The order inside the year is: work out how far the cohort has vested, take
 * the leavers out of the opening balance and split them three ways, then let
 * whoever is left exercise whatever their vested holding allows. Leavers cannot
 * also be continuing employees, which is why the second step works on the
 * balance after the first.
 */
export function stepGrantCohort(args: {
  readonly cohort: GrantCohort;
  readonly year: number;
  readonly policy: CohortPolicy;
}): { readonly closing: GrantCohort; readonly entry: CohortYear } {
  const { cohort, year, policy } = args;

  requireNonNegative(
    cohort.outstandingOptions,
    'negativeShareCount',
    'A cohort cannot hold a negative number of outstanding options.',
    { cohortId: cohort.id },
  );

  const ageYears = cohort.ageYearsAtEndOfYear0 + year;
  const v = vestedFraction({
    ageYears,
    cliffMonths: policy.vesting.cliffMonths,
    vestYears: policy.vesting.vestYears,
  });
  const exposure = attritionExposureYears({ grantYear: cohort.grantYear, year });

  const opening = cohort.outstandingOptions;
  const attritionRate = (policy.attritionPctByBand[cohort.band] / 100) * exposure;
  const leavers = opening * attritionRate;

  const lambda = policy.vestedNeverExercisedPct / 100;
  const unvestedForfeited = leavers * (1 - v);
  const vestedLapsed = leavers * v * lambda;
  const vestedExercised = leavers * v * (1 - lambda);

  const afterLeavers = nonNegative(opening - leavers);
  const vestedAfterLeavers = afterLeavers * v;
  const continuingExercised =
    vestedAfterLeavers * (policy.continuingEmployeeExercisePctPerYear / 100) * exposure;

  const returnedToPool = policy.recycleForfeited ? unvestedForfeited + vestedLapsed : 0;
  const cancelledNotRecycled = policy.recycleForfeited ? 0 : unvestedForfeited + vestedLapsed;
  const exercised = vestedExercised + continuingExercised;

  const closingOutstanding = nonNegative(afterLeavers - continuingExercised);
  const closingVested = nonNegative(vestedAfterLeavers - continuingExercised);

  return {
    closing: { ...cohort, outstandingOptions: closingOutstanding },
    entry: {
      year,
      cohortId: cohort.id,
      band: cohort.band,
      grantYear: cohort.grantYear,
      ageYears,
      vestedFraction: v,
      attritionExposureYears: exposure,
      openingOutstanding: opening,
      leavers,
      unvestedForfeited,
      vestedLapsed,
      vestedExercised,
      continuingExercised,
      returnedToPool,
      cancelledNotRecycled,
      exercised,
      closingOutstanding,
      closingVested,
    },
  };
}

const EMPTY_TOTALS: CohortYearTotals = {
  unvestedForfeited: 0,
  vestedLapsed: 0,
  vestedExercised: 0,
  continuingExercised: 0,
  returnedToPool: 0,
  cancelledNotRecycled: 0,
  exercised: 0,
  closingOutstanding: 0,
  closingVested: 0,
};

function addEntry(totals: CohortYearTotals, entry: CohortYear): CohortYearTotals {
  return {
    unvestedForfeited: totals.unvestedForfeited + entry.unvestedForfeited,
    vestedLapsed: totals.vestedLapsed + entry.vestedLapsed,
    vestedExercised: totals.vestedExercised + entry.vestedExercised,
    continuingExercised: totals.continuingExercised + entry.continuingExercised,
    returnedToPool: totals.returnedToPool + entry.returnedToPool,
    cancelledNotRecycled: totals.cancelledNotRecycled + entry.cancelledNotRecycled,
    exercised: totals.exercised + entry.exercised,
    closingOutstanding: totals.closingOutstanding + entry.closingOutstanding,
    closingVested: totals.closingVested + entry.closingVested,
  };
}

/** Advance every cohort through one year, and total the flows. */
export function advanceGrantCohorts(args: {
  readonly cohorts: readonly GrantCohort[];
  readonly year: number;
  readonly policy: CohortPolicy;
}): {
  readonly cohorts: readonly GrantCohort[];
  readonly entries: readonly CohortYear[];
  readonly totals: CohortYearTotals;
} {
  const { cohorts, year, policy } = args;

  const closing: GrantCohort[] = [];
  const entries: CohortYear[] = [];
  let totals = EMPTY_TOTALS;

  for (const cohort of cohorts) {
    const stepped = stepGrantCohort({ cohort, year, policy });
    closing.push(stepped.closing);
    entries.push(stepped.entry);
    totals = addEntry(totals, stepped.entry);
  }

  return { cohorts: closing, entries, totals };
}

/**
 * A cohort for the options granted in year `year` to band `band`.
 *
 * New hire grants and refresh grants made in the same year to the same band are
 * one cohort, not two. That is not the aggregation section 4.3 forbids: they
 * share a grant year, a band, a vesting schedule and an attrition rate, so
 * splitting them would produce two rows that move identically. What each
 * contributed is carried on the cohort so the composition is still readable.
 */
export function newGrantCohort(args: {
  readonly year: number;
  readonly band: Band;
  readonly fromNewHires: number;
  readonly fromRefresh: number;
}): GrantCohort {
  const { year, band, fromNewHires, fromRefresh } = args;

  requireNonNegative(fromNewHires, 'negativeShareCount', 'A new hire grant cannot be negative.', {
    band,
    year,
  });
  requireNonNegative(fromRefresh, 'negativeShareCount', 'A refresh grant cannot be negative.', {
    band,
    year,
  });

  const granted = fromNewHires + fromRefresh;

  return {
    id: `y${year}:${band}`,
    band,
    grantYear: year,
    ageYearsAtEndOfYear0: -year,
    grantedOptions: granted,
    outstandingOptions: granted,
    fromNewHires,
    fromRefresh,
  };
}

/**
 * Options already granted and outstanding when the plan starts.
 *
 * `ageYearsAtPlanStart` is how long ago they were granted, measured at the start
 * of year 0. It is the one thing a founder has to tell us that a total on its
 * own cannot: an option granted three years ago and one granted last month
 * behave nothing alike when their holder resigns.
 */
export interface OpeningGrantCohortInput {
  readonly band: Band;
  readonly outstandingOptions: number;
  readonly ageYearsAtPlanStart: number;
  /** Optional: what was originally granted, if some has already gone. */
  readonly grantedOptions?: number;
  /**
   * Fair value per option at this cohort's original grant date, for the Ind AS
   * 102 estimate in compliance.ts. Optional, and `undefined` is not the same
   * input as `0`.
   *
   * Leave it unsupplied and the cohort is excluded from the expense estimate,
   * because the engine holds no price per share from before the plan started
   * to value it at and would otherwise have to guess one. Supply it — including
   * as exactly `0`, a scheme adopted at a price equal to par, say — and the
   * cohort is amortised over its remaining vesting like any other, at the value
   * given. The two states report differently: `EsopExpenseSchedule` keeps
   * `excludedOpeningOptions` and `includedOpeningOptions` apart rather than
   * merging them, because "we don't know" and "we know, and it was nothing"
   * are different facts that happen to net to the same rupee total.
   */
  readonly grantDateValuePerOption?: number;
}

export function openingGrantCohorts(
  inputs: readonly OpeningGrantCohortInput[],
): readonly GrantCohort[] {
  return inputs.map((input, index) => {
    requireNonNegative(
      input.outstandingOptions,
      'negativeShareCount',
      'An opening cohort cannot hold a negative number of options.',
      { index },
    );
    requireNonNegative(
      input.ageYearsAtPlanStart,
      'invalidVestingSchedule',
      'An opening cohort was granted before the plan started, so its age cannot be negative.',
      { index },
    );

    return {
      id: `opening#${index}:${input.band}`,
      band: input.band,
      grantYear: null,
      /** A full plan year elapses between the start of year 0 and its end. */
      ageYearsAtEndOfYear0: input.ageYearsAtPlanStart + 1,
      grantedOptions: input.grantedOptions ?? input.outstandingOptions,
      outstandingOptions: input.outstandingOptions,
      fromNewHires: input.outstandingOptions,
      fromRefresh: 0,
      grantDateValuePerOption: input.grantDateValuePerOption,
    };
  });
}

/**
 * The aggregate escape hatch, named so it cannot be taken by accident.
 *
 * A caller holding only a total and a mix — which is every caller who has not
 * uploaded a grant register — can build cohorts from it here. The result is an
 * approximation and the function name says so; section 4.3's prohibition is on
 * the engine quietly making this assumption on the caller's behalf, not on the
 * caller making it knowingly.
 */
export function approximateOpeningCohortsFromTotal(args: {
  readonly outstandingOptions: number;
  readonly mixPctByBand: ByBand;
  readonly averageAgeYears: number;
}): readonly GrantCohort[] {
  const { outstandingOptions, mixPctByBand, averageAgeYears } = args;

  requireNonNegative(
    outstandingOptions,
    'negativeShareCount',
    'Granted and outstanding options cannot be negative.',
  );

  return openingGrantCohorts(
    BANDS.map((band) => ({
      band,
      outstandingOptions: (outstandingOptions * mixPctByBand[band]) / 100,
      ageYearsAtPlanStart: averageAgeYears,
    })),
  );
}

/* ------------------------------------------------------------------------- *
 * Headcount cohorts — what the refresh eligible base is made of
 * ------------------------------------------------------------------------- */

/**
 * People, tracked the same way options are, because section 4.2's `Eligible_t`
 * is a headcount and section 4.3 is the only thing that knows how it decays.
 *
 * `tenureYearsAtMidYear0` is tenure at the middle of plan year 0, so that
 * tenure at the middle of year t is one addition. Grants are made mid-year, so
 * the middle of the year is where eligibility should be tested.
 */
export interface HeadcountCohort {
  readonly band: Band;
  /** The plan year they were hired in. Null for staff already there at year 0. */
  readonly hireYear: number | null;
  readonly tenureYearsAtMidYear0: number;
  readonly headcount: number;
}

export function newHireCohort(args: {
  readonly year: number;
  readonly band: Band;
  readonly headcount: number;
}): HeadcountCohort {
  requireNonNegative(args.headcount, 'negativeHeadcount', 'Hires in a year cannot be negative.', {
    band: args.band,
    year: args.year,
  });

  return {
    band: args.band,
    hireYear: args.year,
    tenureYearsAtMidYear0: -args.year,
    headcount: args.headcount,
  };
}

/** Staff already employed when the plan starts, with their tenure at that point. */
export interface OpeningHeadcountInput {
  readonly band: Band;
  readonly headcount: number;
  readonly tenureYearsAtPlanStart: number;
}

export function openingHeadcountCohorts(
  inputs: readonly OpeningHeadcountInput[],
): readonly HeadcountCohort[] {
  return inputs.map((input) => {
    requireNonNegative(
      input.headcount,
      'negativeHeadcount',
      'Opening headcount cannot be negative.',
      { band: input.band },
    );
    requireNonNegative(
      input.tenureYearsAtPlanStart,
      'negativeHeadcount',
      'Opening tenure cannot be negative.',
      { band: input.band },
    );

    return {
      band: input.band,
      hireYear: null,
      tenureYearsAtMidYear0: input.tenureYearsAtPlanStart + MID_YEAR_EXPOSURE_YEARS,
      headcount: input.headcount,
    };
  });
}

/** The same attrition, on the same mid-year exposure, applied to people. */
export function advanceHeadcountCohorts(args: {
  readonly cohorts: readonly HeadcountCohort[];
  readonly year: number;
  readonly policy: CohortPolicy;
}): { readonly cohorts: readonly HeadcountCohort[]; readonly closingHeadcount: number } {
  const { cohorts, year, policy } = args;

  let closingHeadcount = 0;
  const closing = cohorts.map((cohort) => {
    const exposure = attritionExposureYears({ grantYear: cohort.hireYear, year });
    const rate = (policy.attritionPctByBand[cohort.band] / 100) * exposure;
    const headcount = nonNegative(cohort.headcount - cohort.headcount * rate);
    closingHeadcount += headcount;

    return { ...cohort, headcount };
  });

  return { cohorts: closing, closingHeadcount };
}

/**
 * Eligible_t, per band. Spec section 4.2: employees whose tenure has reached the
 * refresh eligibility threshold, measured at the middle of year t, where the
 * grants are actually made.
 *
 * The headcount used is the opening headcount for year t. Employees who leave
 * during year t are not refreshed on their way out.
 */
export function refreshEligibleByBand(args: {
  readonly cohorts: readonly HeadcountCohort[];
  readonly year: number;
  readonly eligibilityMonths: number;
}): ByBand {
  const { cohorts, year, eligibilityMonths } = args;

  requireNonNegative(
    eligibilityMonths,
    'invalidRefreshPolicy',
    'Refresh eligibility in months cannot be negative.',
  );

  const eligible = cohorts.filter(
    (cohort) => (cohort.tenureYearsAtMidYear0 + year) * 12 >= eligibilityMonths,
  );

  return mapBands((band) =>
    eligible
      .filter((cohort) => cohort.band === band)
      .reduce((total, cohort) => total + cohort.headcount, 0),
  );
}
