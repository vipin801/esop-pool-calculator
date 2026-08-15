/**
 * ENGINE_SPEC.md section 4.3, whose heading is "required, do not approximate".
 *
 * The test that earns the heading is `a pool-wide average is not the same
 * answer`: it builds two cohorts either side of the vesting clamp, aggregates
 * them at their average age, and shows the aggregate misstating the exercised
 * leg — which is the leg that becomes issued shares and eats authorised
 * capital. Inside the linear part of the vesting curve the two agree exactly,
 * which is precisely why an aggregate looks harmless right up until it isn't.
 */

import { describe, expect, it } from 'vitest';

import {
  MID_YEAR_EXPOSURE_YEARS,
  advanceGrantCohorts,
  attritionExposureYears,
  attritionPctByBand,
  cohortPolicy,
  newGrantCohort,
  openingGrantCohorts,
  refreshEligibleByBand,
  stepGrantCohort,
  vestedFraction,
  type CohortPolicy,
  type GrantCohort,
} from '../cohorts';
import { DEFAULTS, STATUTORY } from '../defaults';
import { isEsopEngineError } from '../errors';
import { solveRecommendedPool } from '../pool-solver';
import { runRollForward } from '../roll-forward';
import { ATTRITION, EXERCISE, VESTING, withArgs } from './fixtures';

const POLICY: CohortPolicy = cohortPolicy({
  vesting: VESTING,
  attrition: ATTRITION,
  exercise: EXERCISE,
});

/**
 * A cohort at an arbitrary age, which the opening-cohort builder cannot express
 * because it only takes whole plan years. Built to be stepped through year 0,
 * where its age is exactly `ageYears`.
 */
function cohortAtAge(args: {
  readonly id: string;
  readonly band: GrantCohort['band'];
  readonly options: number;
  readonly ageYears: number;
}): GrantCohort {
  return {
    id: args.id,
    band: args.band,
    grantYear: null,
    ageYearsAtEndOfYear0: args.ageYears,
    grantedOptions: args.options,
    outstandingOptions: args.options,
    fromNewHires: args.options,
    fromRefresh: 0,
  };
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return isEsopEngineError(error) ? error.code : 'not an EsopEngineError';
  }
  return 'nothing thrown';
}

describe('vestedFraction, spec section 4.3', () => {
  const schedule = { cliffMonths: 12, vestYears: 4 };

  it('is zero before the cliff', () => {
    expect(vestedFraction({ ageYears: 0, ...schedule })).toBe(0);
    expect(vestedFraction({ ageYears: 0.99, ...schedule })).toBe(0);
  });

  it('is still zero at the cliff itself, because the spec starts the ramp there', () => {
    // (age - c/12) is zero at the cliff. The spec vests linearly from the cliff
    // to k; it does not step to 25% on the first anniversary. The spec wins.
    expect(vestedFraction({ ageYears: 1, ...schedule })).toBe(0);
  });

  it('runs linearly from the cliff to the end of vesting', () => {
    expect(vestedFraction({ ageYears: 2, ...schedule })).toBeCloseTo(1 / 3, 12);
    expect(vestedFraction({ ageYears: 3, ...schedule })).toBeCloseTo(2 / 3, 12);
    expect(vestedFraction({ ageYears: 4, ...schedule })).toBe(1);
  });

  it('clamps at one past the end of vesting', () => {
    expect(vestedFraction({ ageYears: 40, ...schedule })).toBe(1);
  });

  it('vests everything in one step when the cliff is the whole schedule', () => {
    expect(vestedFraction({ ageYears: 0.9, cliffMonths: 12, vestYears: 1 })).toBe(0);
    expect(vestedFraction({ ageYears: 1, cliffMonths: 12, vestYears: 1 })).toBe(1);
  });

  it('refuses a cliff that falls after vesting ends', () => {
    expect(codeOf(() => vestedFraction({ ageYears: 1, cliffMonths: 60, vestYears: 4 }))).toBe(
      'invalidVestingSchedule',
    );
  });
});

describe('the statutory vesting floor, Rule 12(6)(a)', () => {
  /**
   * AUDIT_P4 defect 4. "Minimum one year between grant and vesting. Block any
   * input below 12 months" is in ENGINE_SPEC.md section 5 and in PROJECT.md,
   * and until now the engine blocked nothing: a cliff of 0 ran end to end and
   * produced a pool number for a scheme that cannot lawfully be adopted.
   *
   * The floor is enforced where a `VestingSchedule` enters the engine, not
   * inside `vestedFraction`. That function is the spec's vesting curve and its
   * guards are the mathematical ones — a negative cliff, a vesting period of
   * zero, a cliff past the end of vesting. The twelve months are law, not maths,
   * and law belongs at the boundary the founder's input crosses.
   */
  const lawful = { vesting: VESTING, attrition: ATTRITION, exercise: EXERCISE };

  it('refuses a cliff below twelve months at the policy boundary', () => {
    for (const cliffMonths of [0, 1, 6, 11, 11.9]) {
      expect(
        codeOf(() => cohortPolicy({ ...lawful, vesting: { ...VESTING, cliffMonths } })),
        `a ${cliffMonths} month cliff was accepted`,
      ).toBe('cliffBelowStatutoryMinimum');
    }
  });

  it('accepts exactly twelve months, which is the floor and the market default', () => {
    expect(STATUTORY.minVestingMonths).toBe(12);
    expect(DEFAULTS.cliffMonths.value).toBe(12);
    expect(cohortPolicy({ ...lawful, vesting: { ...VESTING, cliffMonths: 12 } }).vesting.cliffMonths)
      .toBe(12);
  });

  it('accepts a longer cliff, because the rule is a floor and not a fixed term', () => {
    for (const cliffMonths of [12, 18, 24, 36]) {
      expect(
        cohortPolicy({ ...lawful, vesting: { ...VESTING, cliffMonths } }).vesting.cliffMonths,
      ).toBe(cliffMonths);
    }
  });

  it('refuses it through the roll forward and through the solver, not just the policy', () => {
    const illegal = withArgs({ vesting: { cliffMonths: 6 } });

    expect(codeOf(() => runRollForward(illegal))).toBe('cliffBelowStatutoryMinimum');
    expect(codeOf(() => solveRecommendedPool(illegal))).toBe('cliffBelowStatutoryMinimum');
  });

  it('still refuses a cliff that falls after vesting ends, which is a different failure', () => {
    // A 60 month cliff is lawful and still impossible against a 4 year vest.
    // The two guards answer different questions and carry different codes.
    expect(
      codeOf(() =>
        cohortPolicy({ ...lawful, vesting: { ...VESTING, cliffMonths: 60, vestYears: 4 } }),
      ),
    ).toBe('invalidVestingSchedule');
  });
});

describe('the mid-year convention', () => {
  it('charges a cohort half a year of attrition in its own grant year', () => {
    expect(attritionExposureYears({ grantYear: 3, year: 3 })).toBe(MID_YEAR_EXPOSURE_YEARS);
    expect(MID_YEAR_EXPOSURE_YEARS).toBe(0.5);
  });

  it('charges every later year in full', () => {
    expect(attritionExposureYears({ grantYear: 3, year: 4 })).toBe(1);
    expect(attritionExposureYears({ grantYear: 3, year: 10 })).toBe(1);
  });

  it('charges a cohort carried in from before the plan in full from year 0', () => {
    expect(attritionExposureYears({ grantYear: null, year: 0 })).toBe(1);
  });

  it('halves first-year recycling, which is the error it exists to fix', () => {
    const cohort = newGrantCohort({ year: 0, band: 'mid', fromNewHires: 1000, fromRefresh: 0 });

    const grantYear = stepGrantCohort({ cohort, year: 0, policy: POLICY });
    const laterYear = stepGrantCohort({ cohort, year: 1, policy: POLICY });

    // Nothing has vested in either case, so every leaver forfeits and the whole
    // difference is the exposure. Charging a full year would return 150 options
    // where 75 is right: close to double, exactly as reported of the front end.
    expect(grantYear.entry.returnedToPool).toBeCloseTo(75, 9);
    expect(laterYear.entry.returnedToPool).toBeCloseTo(150, 9);
    expect(laterYear.entry.returnedToPool).toBeCloseTo(grantYear.entry.returnedToPool * 2, 9);
  });
});

describe('the three-way split of a leaver', () => {
  const cohort = cohortAtAge({ id: 'half-vested', band: 'mid', options: 1000, ageYears: 2.5 });
  const { entry } = stepGrantCohort({ cohort, year: 0, policy: POLICY });

  it('splits leavers into forfeited, lapsed and exercised, and nothing else', () => {
    expect(entry.unvestedForfeited + entry.vestedLapsed + entry.vestedExercised).toBeCloseTo(
      entry.leavers,
      9,
    );
  });

  it('splits on the cohort own vested fraction, not on a pool-wide one', () => {
    const v = vestedFraction({ ageYears: 2.5, cliffMonths: 12, vestYears: 4 });
    expect(entry.vestedFraction).toBeCloseTo(v, 12);

    expect(entry.unvestedForfeited).toBeCloseTo(entry.leavers * (1 - v), 9);
    expect(entry.vestedLapsed).toBeCloseTo(entry.leavers * v * 0.5, 9);
    expect(entry.vestedExercised).toBeCloseTo(entry.leavers * v * 0.5, 9);
  });

  it('sends the first two back to the pool and the third to issued shares', () => {
    expect(entry.returnedToPool).toBeCloseTo(entry.unvestedForfeited + entry.vestedLapsed, 9);
    expect(entry.exercised).toBeCloseTo(entry.vestedExercised + entry.continuingExercised, 9);
    expect(entry.cancelledNotRecycled).toBe(0);
  });

  it('takes all three out of the cohort permanently', () => {
    expect(entry.closingOutstanding).toBeCloseTo(
      entry.openingOutstanding - entry.leavers - entry.continuingExercised,
      9,
    );
  });
});

describe('recycling', () => {
  const cohort = cohortAtAge({ id: 'half-vested', band: 'mid', options: 1000, ageYears: 2.5 });

  const off: CohortPolicy = cohortPolicy({
    vesting: VESTING,
    attrition: ATTRITION,
    exercise: { ...EXERCISE, recycleForfeited: false },
  });

  it('returns forfeited and lapsed options to the pool when it is on', () => {
    const { entry } = stepGrantCohort({ cohort, year: 0, policy: POLICY });

    expect(entry.returnedToPool).toBeGreaterThan(0);
    expect(entry.cancelledNotRecycled).toBe(0);
  });

  it('cancels them instead when it is off, and returns nothing', () => {
    const { entry } = stepGrantCohort({ cohort, year: 0, policy: off });

    expect(entry.returnedToPool).toBe(0);
    expect(entry.cancelledNotRecycled).toBeCloseTo(
      entry.unvestedForfeited + entry.vestedLapsed,
      9,
    );
  });

  it('does not touch the exercised leg either way: it never comes back', () => {
    const on = stepGrantCohort({ cohort, year: 0, policy: POLICY }).entry;
    const offEntry = stepGrantCohort({ cohort, year: 0, policy: off }).entry;

    expect(offEntry.vestedExercised).toBeCloseTo(on.vestedExercised, 9);
    expect(offEntry.closingOutstanding).toBeCloseTo(on.closingOutstanding, 9);
  });
});

describe('continuing employees', () => {
  const cohort = cohortAtAge({ id: 'fully-vested', band: 'mid', options: 1000, ageYears: 5 });

  it('exercise nothing pre-liquidity, which is the default', () => {
    const { entry } = stepGrantCohort({ cohort, year: 0, policy: POLICY });

    expect(POLICY.continuingEmployeeExercisePctPerYear).toBe(0);
    expect(entry.continuingExercised).toBe(0);
  });

  it('exercise out of what is left after the leavers, never twice over', () => {
    const withExercises: CohortPolicy = cohortPolicy({
      vesting: VESTING,
      attrition: ATTRITION,
      exercise: { ...EXERCISE, continuingEmployeeExercisePctPerYear: 20 },
    });

    const { entry } = stepGrantCohort({ cohort, year: 0, policy: withExercises });

    expect(entry.continuingExercised).toBeCloseTo((1000 - entry.leavers) * 1 * 0.2, 9);
    expect(entry.leavers + entry.continuingExercised).toBeLessThanOrEqual(1000);
  });

  it('become issued shares, same as an exercise on the way out', () => {
    const withExercises: CohortPolicy = cohortPolicy({
      vesting: VESTING,
      attrition: ATTRITION,
      exercise: { ...EXERCISE, continuingEmployeeExercisePctPerYear: 20 },
    });

    const { entry } = stepGrantCohort({ cohort, year: 0, policy: withExercises });

    expect(entry.exercised).toBeCloseTo(entry.vestedExercised + entry.continuingExercised, 9);
  });
});

describe('a pool-wide average is not the same answer', () => {
  // Two cohorts either side of the vesting clamp: one below its cliff, one past
  // the end of vesting. Their average age sits in the linear middle, where an
  // aggregate would put all 200 options.
  const young = cohortAtAge({ id: 'young', band: 'mid', options: 100, ageYears: 0.5 });
  const old = cohortAtAge({ id: 'old', band: 'mid', options: 100, ageYears: 5 });
  const aggregate = cohortAtAge({ id: 'aggregate', band: 'mid', options: 200, ageYears: 2.75 });

  const tracked = advanceGrantCohorts({ cohorts: [young, old], year: 0, policy: POLICY }).totals;
  const approximated = stepGrantCohort({ cohort: aggregate, year: 0, policy: POLICY }).entry;

  it('agrees on how many people leave', () => {
    expect(approximated.leavers).toBeCloseTo(
      young.outstandingOptions * 0.15 + old.outstandingOptions * 0.15,
      9,
    );
  });

  it('disagrees on how many shares get issued, which is the leg that matters', () => {
    expect(tracked.vestedExercised).toBeCloseTo(7.5, 9);
    expect(approximated.vestedExercised).toBeCloseTo(8.75, 9);
    expect(approximated.vestedExercised).toBeGreaterThan(tracked.vestedExercised);
  });

  it('disagrees on how much comes back to the pool', () => {
    expect(tracked.returnedToPool).toBeCloseTo(22.5, 9);
    expect(approximated.returnedToPool).toBeCloseTo(21.25, 9);
  });

  it('agrees exactly inside the linear part of the curve, which is the trap', () => {
    const oneYear = cohortAtAge({ id: 'a', band: 'mid', options: 100, ageYears: 2 });
    const threeYear = cohortAtAge({ id: 'b', band: 'mid', options: 100, ageYears: 3 });
    const middle = cohortAtAge({ id: 'mid', band: 'mid', options: 200, ageYears: 2.5 });

    const split = advanceGrantCohorts({
      cohorts: [oneYear, threeYear],
      year: 0,
      policy: POLICY,
    }).totals;
    const lumped = stepGrantCohort({ cohort: middle, year: 0, policy: POLICY }).entry;

    expect(split.vestedExercised).toBeCloseTo(lumped.vestedExercised, 9);
  });
});

describe('extreme attrition still terminates and stays finite', () => {
  const everyone: CohortPolicy = cohortPolicy({
    vesting: VESTING,
    attrition: { baseAnnualPct: 100, byBand: {}, sector: 'general' },
    exercise: EXERCISE,
  });

  const nobody: CohortPolicy = cohortPolicy({
    vesting: VESTING,
    attrition: { baseAnnualPct: 0, byBand: {}, sector: 'general' },
    exercise: EXERCISE,
  });

  it('empties a cohort over its grant year and the next, at 100%', () => {
    const cohort = newGrantCohort({ year: 0, band: 'mid', fromNewHires: 1000, fromRefresh: 0 });

    const first = stepGrantCohort({ cohort, year: 0, policy: everyone });
    expect(first.entry.leavers).toBeCloseTo(500, 9);
    expect(first.closing.outstandingOptions).toBeCloseTo(500, 9);

    const second = stepGrantCohort({ cohort: first.closing, year: 1, policy: everyone });
    expect(second.closing.outstandingOptions).toBe(0);
    expect(Number.isFinite(second.entry.returnedToPool)).toBe(true);
  });

  it('moves nothing at all, at 0%', () => {
    const cohort = newGrantCohort({ year: 0, band: 'mid', fromNewHires: 1000, fromRefresh: 0 });
    const { closing, entry } = stepGrantCohort({ cohort, year: 4, policy: nobody });

    expect(entry.leavers).toBe(0);
    expect(entry.returnedToPool).toBe(0);
    expect(entry.exercised).toBe(0);
    expect(closing.outstandingOptions).toBe(1000);
  });

  it('refuses an attrition rate above 100%', () => {
    expect(
      codeOf(() => attritionPctByBand({ baseAnnualPct: 140, byBand: {}, sector: 'general' })),
    ).toBe('invalidAttritionRate');
    expect(
      codeOf(() =>
        attritionPctByBand({ baseAnnualPct: 15, byBand: { mid: -2 }, sector: 'general' }),
      ),
    ).toBe('invalidAttritionRate');
  });
});

describe('band overrides', () => {
  it('take the override where there is one and the base rate everywhere else', () => {
    const rates = attritionPctByBand(ATTRITION);

    expect(rates.leadership).toBe(10);
    expect(rates.senior).toBe(15);
    expect(rates.mid).toBe(15);
    expect(rates.junior).toBe(15);
  });

  it('give two bands with the same age different outcomes', () => {
    const leader = cohortAtAge({ id: 'lead', band: 'leadership', options: 1000, ageYears: 3 });
    const junior = cohortAtAge({ id: 'junior', band: 'junior', options: 1000, ageYears: 3 });

    const leadEntry = stepGrantCohort({ cohort: leader, year: 0, policy: POLICY }).entry;
    const juniorEntry = stepGrantCohort({ cohort: junior, year: 0, policy: POLICY }).entry;

    expect(leadEntry.leavers).toBeCloseTo(100, 9);
    expect(juniorEntry.leavers).toBeCloseTo(150, 9);
  });
});

describe('opening cohorts', () => {
  it('age from the start of the plan, not from year zero of the world', () => {
    const [cohort] = openingGrantCohorts([
      { band: 'senior', outstandingOptions: 50_000, ageYearsAtPlanStart: 2 },
    ]);

    expect(cohort?.grantYear).toBeNull();
    // Two years old when the plan starts, three by the end of its first year.
    expect(cohort?.ageYearsAtEndOfYear0).toBe(3);
  });

  it('are exposed to a full year of attrition in year 0', () => {
    const [cohort] = openingGrantCohorts([
      { band: 'mid', outstandingOptions: 1000, ageYearsAtPlanStart: 2 },
    ]);
    if (cohort === undefined) throw new Error('no cohort built');

    expect(stepGrantCohort({ cohort, year: 0, policy: POLICY }).entry.leavers).toBeCloseTo(150, 9);
  });
});

describe('the refresh eligible base', () => {
  it('counts tenure at the middle of the year, where the grants are made', () => {
    const hires = [
      { band: 'mid' as const, hireYear: 0, tenureYearsAtMidYear0: 0, headcount: 10 },
      { band: 'senior' as const, hireYear: 1, tenureYearsAtMidYear0: -1, headcount: 4 },
    ];

    // 24 month eligibility: a year 0 hire qualifies in year 2, a year 1 hire in year 3.
    expect(refreshEligibleByBand({ cohorts: hires, year: 1, eligibilityMonths: 24 }).mid).toBe(0);
    expect(refreshEligibleByBand({ cohorts: hires, year: 2, eligibilityMonths: 24 }).mid).toBe(10);
    expect(refreshEligibleByBand({ cohorts: hires, year: 2, eligibilityMonths: 24 }).senior).toBe(
      0,
    );
    expect(refreshEligibleByBand({ cohorts: hires, year: 3, eligibilityMonths: 24 }).senior).toBe(
      4,
    );
  });
});

describe('a cohort is one row per year and band', () => {
  it('merges the year new hire grants and refresh grants, and says what is in it', () => {
    const cohort = newGrantCohort({ year: 2, band: 'senior', fromNewHires: 800, fromRefresh: 200 });

    expect(cohort.id).toBe('y2:senior');
    expect(cohort.grantedOptions).toBe(1000);
    expect(cohort.fromNewHires).toBe(800);
    expect(cohort.fromRefresh).toBe(200);
  });

  it('behaves identically whether the two are merged or kept apart', () => {
    const merged = newGrantCohort({ year: 2, band: 'senior', fromNewHires: 800, fromRefresh: 200 });
    const apart = [
      newGrantCohort({ year: 2, band: 'senior', fromNewHires: 800, fromRefresh: 0 }),
      newGrantCohort({ year: 2, band: 'senior', fromNewHires: 0, fromRefresh: 200 }),
    ];

    // Year 5: the cohort is three years old, so the vested legs are non-zero
    // and the comparison is doing work rather than comparing two zeroes.
    const one = stepGrantCohort({ cohort: merged, year: 5, policy: POLICY }).entry;
    const two = advanceGrantCohorts({ cohorts: apart, year: 5, policy: POLICY }).totals;

    expect(one.vestedExercised).toBeGreaterThan(0);
    expect(two.vestedExercised).toBeCloseTo(one.vestedExercised, 9);
    expect(two.returnedToPool).toBeCloseTo(one.returnedToPool, 9);
    expect(two.closingOutstanding).toBeCloseTo(one.closingOutstanding, 9);
  });
});
