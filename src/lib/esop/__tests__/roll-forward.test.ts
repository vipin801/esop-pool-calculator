/**
 * ENGINE_SPEC.md section 4.4.
 *
 *   Available_t = Available_(t-1) + TopUp_t - N_t - R_t + Returned_t
 *   Exhaustion  = first t where Available_t < 0, interpolated to a month.
 *
 * The load-bearing test here is the bucket identity: issued shares plus granted
 * options plus the available pool equals the fully diluted count, every year,
 * under every combination of recycling and exercise. Every flow in section 4.3
 * is a movement between those three buckets, so if the identity holds the flows
 * cannot have leaked or double-counted.
 */

import { describe, expect, it } from 'vitest';

import { openingGrantCohorts } from '../cohorts';
import { isEsopEngineError } from '../errors';
import { runRollForward } from '../roll-forward';
import { BASIS_A, BASIS_B, withArgs } from './fixtures';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return isEsopEngineError(error) ? error.code : 'not an EsopEngineError';
  }
  return 'nothing thrown';
}

describe('the bucket identity', () => {
  const cases = [
    { label: 'Basis A, recycling on', args: withArgs({}) },
    {
      label: 'Basis A, recycling off',
      args: withArgs({ exercise: { recycleForfeited: false } }),
    },
    {
      label: 'Basis B, recycling on',
      args: withArgs({ grantPolicy: { grantBasis: BASIS_B } }),
    },
    {
      label: 'Basis B, recycling off, continuing employees exercising',
      args: withArgs({
        grantPolicy: { grantBasis: BASIS_B },
        exercise: { recycleForfeited: false, continuingEmployeeExercisePctPerYear: 15 },
      }),
    },
    {
      label: 'with a book of existing grants and a top-up',
      args: withArgs({
        company: { grantedOutstandingOptions: 400_000 },
        openingCohorts: openingGrantCohorts([
          { band: 'senior', outstandingOptions: 150_000, ageYearsAtPlanStart: 3 },
          { band: 'mid', outstandingOptions: 250_000, ageYearsAtPlanStart: 1 },
        ]),
        topUps: [{ year: 2, options: 300_000 }],
      }),
    },
  ];

  for (const { label, args } of cases) {
    it(`holds every year: ${label}`, () => {
      for (const year of runRollForward(args).years) {
        expect(
          year.closingIssuedShares + year.closingGrantedOutstanding + year.closingAvailable,
        ).toBeCloseTo(year.fullyDilutedShares, 6);
      }
    });
  }

  it('only lets the fully diluted count shrink when options are cancelled', () => {
    const on = runRollForward(withArgs({}));
    const off = runRollForward(withArgs({ exercise: { recycleForfeited: false } }));

    for (const year of on.years) {
      expect(year.cancelledNotRecycled).toBe(0);
      expect(year.fullyDilutedShares).toBeCloseTo(year.openingFullyDilutedShares, 6);
    }

    const lastOff = off.years.at(-1);
    expect(lastOff?.cancelledNotRecycled).toBeGreaterThan(0);
    expect(off.closingFullyDilutedShares).toBeLessThan(on.closingFullyDilutedShares);
  });
});

describe('the roll forward equation, exactly as section 4.4 writes it', () => {
  it('reconciles opening, top-up, grants and returns into closing, every year', () => {
    const run = runRollForward(withArgs({ topUps: [{ year: 1, options: 200_000 }] }));

    for (const year of run.years) {
      expect(year.closingAvailable).toBeCloseTo(
        year.openingAvailable +
          year.topUp -
          year.newHireGrants -
          year.refreshGrants +
          year.returnedToPool,
        6,
      );
    }
  });

  it('carries each year closing balance into the next year opening balance', () => {
    const run = runRollForward(withArgs({}));

    run.years.forEach((year, index) => {
      if (index === 0) return;
      expect(year.openingAvailable).toBe(run.years[index - 1]?.closingAvailable);
    });
  });
});

describe('the exercised leg', () => {
  const args = withArgs({
    exercise: { continuingEmployeeExercisePctPerYear: 10 },
    hiring: { horizonYears: 6, hiresPerYear: [15, 25, 35, 40, 45, 45] },
    company: { existingUnallocatedOptions: 3_000_000 },
  });

  it('leaves the pool permanently rather than returning to it', () => {
    const run = runRollForward(args);
    const exercised = run.years.reduce((sum, year) => sum + year.exercisedShares, 0);

    expect(exercised).toBeGreaterThan(0);
    for (const year of run.years) {
      expect(year.returnedToPool).toBeCloseTo(year.unvestedForfeited + year.vestedLapsed, 6);
    }
  });

  it('flows into issued shares and paid-up capital', () => {
    const run = runRollForward(args);

    run.years.forEach((year, index) => {
      const previous = index === 0 ? undefined : run.years[index - 1];
      const openingIssued =
        previous?.closingIssuedShares ??
        args.company.fullyDilutedShares -
          args.company.existingUnallocatedOptions -
          args.company.grantedOutstandingOptions;

      expect(year.closingIssuedShares).toBeCloseTo(openingIssued + year.exercisedShares, 6);
      expect(year.closingPaidUpCapitalRupees).toBeCloseTo(
        year.closingIssuedShares * args.company.faceValuePerShare,
        6,
      );
    });
  });

  it('consumes authorised capital headroom, and says by how much in rupees', () => {
    const tight = runRollForward(
      withArgs({ company: { authorisedCapitalShares: 10_000_000 } }, args),
    );

    expect(tight.authorisedCapital.requiredShares).toBeCloseTo(
      tight.closingIssuedShares + tight.closingGrantedOutstanding + tight.closingAvailable,
      6,
    );
    expect(tight.authorisedCapital.sufficient).toBe(false);
    expect(tight.authorisedCapital.shortfallShares).toBeGreaterThan(0);
    expect(tight.authorisedCapital.increaseRequiredRupees).toBeCloseTo(
      tight.authorisedCapital.shortfallShares * args.company.faceValuePerShare,
      6,
    );
  });

  it('is zero by default, because nobody exercises pre-liquidity in India', () => {
    const run = runRollForward(withArgs({}));

    for (const year of run.years) {
      expect(year.continuingEmployeeExercised).toBe(0);
    }
  });
});

describe('exhaustion', () => {
  it('is month 0 for a pool with nothing in it, and it supports no hires', () => {
    const run = runRollForward(withArgs({ company: { existingUnallocatedOptions: 0 } }));

    expect(run.exhaustion.exhausted).toBe(true);
    expect(run.exhaustion.yearIndex).toBe(0);
    expect(run.exhaustion.monthIndex).toBe(0);
    expect(run.exhaustion.hiresSupported).toBe(0);
  });

  it('interpolates to a month on that year grant run rate', () => {
    // 4 leadership hires at 1% of a 10,000,000 share company is 400,000 options
    // in year 0, against a 200,000 option pool. Half a year, so month 6.
    const run = runRollForward(
      withArgs({
        company: { existingUnallocatedOptions: 200_000 },
        hiring: {
          horizonYears: 1,
          hiresPerYear: [4],
          seniorityMix: { leadership: 100, senior: 0, mid: 0, junior: 0 },
        },
        grantPolicy: {
          grantBasis: {
            kind: 'percentOfEquity',
            grantPctByBand: { leadership: 1, senior: 0, mid: 0, junior: 0 },
          },
        },
      }),
    );

    expect(run.years[0]?.newHireGrants).toBeCloseTo(400_000, 6);
    expect(run.exhaustion.monthIndex).toBeCloseTo(6, 9);
    expect(run.exhaustion.hiresSupported).toBeCloseTo(2, 9);
  });

  it('never reports a month outside the year it found the deficit in', () => {
    const run = runRollForward(withArgs({ company: { existingUnallocatedOptions: 1_100_000 } }));
    const year = run.exhaustion.yearIndex;

    expect(run.exhaustion.exhausted).toBe(true);
    if (year === null) throw new Error('expected an exhaustion year');
    expect(run.exhaustion.monthIndex).toBeGreaterThanOrEqual(year * 12);
    expect(run.exhaustion.monthIndex).toBeLessThan((year + 1) * 12);
  });

  it('reports the whole plan when the pool never runs out', () => {
    const run = runRollForward(
      withArgs({ company: { existingUnallocatedOptions: 5_000_000 } }),
    );

    expect(run.exhaustion.exhausted).toBe(false);
    expect(run.exhaustion.monthIndex).toBeNull();
    expect(run.exhaustion.yearIndex).toBeNull();
    expect(run.exhaustion.hiresSupported).toBe(115);
  });

  it('is pushed out by a top-up, not swallowed by it', () => {
    const without = runRollForward(withArgs({ company: { existingUnallocatedOptions: 700_000 } }));
    const withTopUp = runRollForward(
      withArgs({
        company: { existingUnallocatedOptions: 700_000 },
        topUps: [{ year: 1, options: 600_000 }],
      }),
    );

    expect(without.exhaustion.exhausted).toBe(true);
    expect(withTopUp.exhaustion.monthIndex ?? Infinity).toBeGreaterThan(
      without.exhaustion.monthIndex ?? 0,
    );
  });
});

describe('the mid-year convention, at the roll forward level', () => {
  // 15 hires on a 5/20/45/30 mix against 0.9/0.225/0.1/0.06 of a 10,000,000
  // share company. Worked out by hand so the test is checking the engine rather
  // than restating it.
  const GRANTS_BY_BAND = {
    leadership: ((15 * 5) / 100) * 0.009 * 10_000_000,
    senior: ((15 * 20) / 100) * 0.00225 * 10_000_000,
    mid: ((15 * 45) / 100) * 0.001 * 10_000_000,
    junior: ((15 * 30) / 100) * 0.0006 * 10_000_000,
  } as const;

  const ATTRITION_BY_BAND = { leadership: 0.1, senior: 0.15, mid: 0.15, junior: 0.15 } as const;

  it('returns half a year of the first cohort attrition in its grant year', () => {
    const first = runRollForward(withArgs({})).years[0];
    if (first === undefined) throw new Error('no first year');

    expect(first.newHireGrants).toBeCloseTo(229_500, 6);

    // Nothing has vested in year 0, so every leaver forfeits and everything
    // forfeited comes straight back. Half a year each, per the convention.
    const halfYear =
      GRANTS_BY_BAND.leadership * ATTRITION_BY_BAND.leadership * 0.5 +
      GRANTS_BY_BAND.senior * ATTRITION_BY_BAND.senior * 0.5 +
      GRANTS_BY_BAND.mid * ATTRITION_BY_BAND.mid * 0.5 +
      GRANTS_BY_BAND.junior * ATTRITION_BY_BAND.junior * 0.5;

    expect(halfYear).toBeCloseTo(15_525, 6);
    expect(first.returnedToPool).toBeCloseTo(15_525, 6);
    expect(first.unvestedForfeited).toBeCloseTo(15_525, 6);
    expect(first.vestedExercised).toBe(0);
    expect(first.vestedLapsed).toBe(0);
  });

  it('would return close to double without it, which is the front end bug', () => {
    const first = runRollForward(withArgs({})).years[0];

    expect(first?.returnedToPool).toBeLessThan(31_050 * 0.51);
    expect(first?.returnedToPool).toBeGreaterThan(31_050 * 0.49);
  });
});

describe('grant basis invariance survives the roll forward', () => {
  it('leaves a percent-of-equity plan untouched by the valuation path', () => {
    const flat = runRollForward(withArgs({ growth: { valuationGrowthPctPerYear: 0 } }));
    const steep = runRollForward(withArgs({ growth: { valuationGrowthPctPerYear: 200 } }));

    expect(flat.years[3]?.pricePerShare).not.toBeCloseTo(steep.years[3]?.pricePerShare ?? 0, 6);

    flat.years.forEach((year, index) => {
      expect(year.newHireGrants).toBe(steep.years[index]?.newHireGrants);
      expect(year.refreshGrants).toBe(steep.years[index]?.refreshGrants);
      expect(year.closingAvailable).toBe(steep.years[index]?.closingAvailable);
    });
  });

  it('moves a rupee-value plan a great deal', () => {
    const flat = runRollForward(
      withArgs({
        grantPolicy: { grantBasis: BASIS_B },
        growth: { valuationGrowthPctPerYear: 0 },
      }),
    );
    const steep = runRollForward(
      withArgs({
        grantPolicy: { grantBasis: BASIS_B },
        growth: { valuationGrowthPctPerYear: 200 },
      }),
    );

    expect(flat.totalGrossConsumptionOptions).toBeGreaterThan(
      steep.totalGrossConsumptionOptions * 2,
    );
  });

  it('reports no denominator under Basis A and one under Basis B', () => {
    const a = runRollForward(withArgs({ grantPolicy: { grantBasis: BASIS_A } }));
    const b = runRollForward(withArgs({ grantPolicy: { grantBasis: BASIS_B } }));

    expect(a.years.every((year) => year.denominator === null)).toBe(true);
    expect(b.years.every((year) => (year.denominator ?? 0) > 0)).toBe(true);
  });
});

describe('refresh grants come off the base section 4.3 keeps', () => {
  it('grant nothing until somebody has been there long enough', () => {
    const run = runRollForward(
      withArgs({ hiring: { horizonYears: 5, hiresPerYear: [15, 25, 35, 40, 45] } }),
    );

    expect(run.years[0]?.refreshEligibleHeadcount).toBe(0);
    expect(run.years[1]?.refreshEligibleHeadcount).toBe(0);
    expect(run.years[0]?.refreshGrants).toBe(0);
    expect(run.years[2]?.refreshEligibleHeadcount).toBeGreaterThan(0);
    expect(run.years[2]?.refreshGrants).toBeGreaterThan(0);
  });

  it('count the survivors, not the hires', () => {
    const run = runRollForward(
      withArgs({ hiring: { horizonYears: 3, hiresPerYear: [100, 0, 0] } }),
    );

    // 100 hired mid-year 0, so half a year of attrition then a full year each
    // for years 1 and 2. Fewer than 100 are still there to be refreshed.
    expect(run.years[2]?.refreshEligibleHeadcount).toBeGreaterThan(0);
    expect(run.years[2]?.refreshEligibleHeadcount).toBeLessThan(100);
  });

  it('include staff who were already there when the plan started', () => {
    const without = runRollForward(withArgs({}));
    const with_ = runRollForward(
      withArgs({
        openingHeadcount: [
          { band: 'senior', hireYear: null, tenureYearsAtMidYear0: 3.5, headcount: 20 },
        ],
      }),
    );

    expect(without.years[0]?.refreshGrants).toBe(0);
    expect(with_.years[0]?.refreshGrants).toBeGreaterThan(0);
  });
});

describe('extremes terminate and stay finite', () => {
  const everyoneLeaves = withArgs({
    attrition: { baseAnnualPct: 100, byBand: {} },
  });
  const nobodyLeaves = withArgs({ attrition: { baseAnnualPct: 0, byBand: {} } });

  it('at 100% attrition', () => {
    const run = runRollForward(everyoneLeaves);

    expect(run.years).toHaveLength(4);
    for (const year of run.years) {
      expect(Number.isFinite(year.closingAvailable)).toBe(true);
      expect(year.closingGrantedOutstanding).toBeGreaterThanOrEqual(0);
    }
    // Everyone granted in year t has gone by the end of year t+1, so the book
    // never carries more than the tail of the current year cohort.
    expect(run.years.at(-1)?.closingGrantedOutstanding).toBeGreaterThanOrEqual(0);
  });

  it('at 0% attrition, where nothing ever comes back', () => {
    const run = runRollForward(nobodyLeaves);

    expect(run.totalReturnedToPool).toBe(0);
    expect(run.totalExercisedShares).toBe(0);
    expect(run.closingGrantedOutstanding).toBeCloseTo(run.totalGrossConsumptionOptions, 6);
  });
});

describe('opening grants have to be described, not guessed at', () => {
  it('refuses a granted balance with no cohorts behind it', () => {
    expect(
      codeOf(() => runRollForward(withArgs({ company: { grantedOutstandingOptions: 500_000 } }))),
    ).toBe('missingOpeningCohorts');
  });

  it('refuses cohorts that do not add up to the granted balance', () => {
    expect(
      codeOf(() =>
        runRollForward(
          withArgs({
            company: { grantedOutstandingOptions: 500_000 },
            openingCohorts: openingGrantCohorts([
              { band: 'mid', outstandingOptions: 400_000, ageYearsAtPlanStart: 2 },
            ]),
          }),
        ),
      ),
    ).toBe('openingCohortsMismatch');
  });

  it('accepts cohorts that do, and puts the rest into issued shares', () => {
    const run = runRollForward(
      withArgs({
        company: { grantedOutstandingOptions: 500_000 },
        openingCohorts: openingGrantCohorts([
          { band: 'mid', outstandingOptions: 500_000, ageYearsAtPlanStart: 2 },
        ]),
      }),
    );

    // 10,000,000 fully diluted, 600,000 unallocated, 500,000 granted.
    expect(run.years[0]?.closingIssuedShares).toBeGreaterThanOrEqual(8_900_000);
  });

  it('refuses a pool and a grant book that together exceed the company', () => {
    expect(
      codeOf(() =>
        runRollForward(
          withArgs({
            company: { fullyDilutedShares: 1_000_000, grantedOutstandingOptions: 900_000 },
            openingCohorts: openingGrantCohorts([
              { band: 'mid', outstandingOptions: 900_000, ageYearsAtPlanStart: 1 },
            ]),
          }),
        ),
      ),
    ).toBe('negativeShareCount');
  });
});

describe('input guards', () => {
  it('refuses a horizon that is not a whole number of years', () => {
    expect(codeOf(() => runRollForward(withArgs({ hiring: { horizonYears: 0 } })))).toBe(
      'invalidHorizon',
    );
    expect(codeOf(() => runRollForward(withArgs({ hiring: { horizonYears: 2.5 } })))).toBe(
      'invalidHorizon',
    );
  });

  it('refuses a top-up scheduled before the plan starts', () => {
    expect(codeOf(() => runRollForward(withArgs({ topUps: [{ year: -1, options: 10 }] })))).toBe(
      'invalidYearIndex',
    );
  });

  it('hires nobody in a year the plan does not reach', () => {
    const run = runRollForward(
      withArgs({ hiring: { horizonYears: 6, hiresPerYear: [15, 25, 35, 40] } }),
    );

    expect(run.years[4]?.hires).toBe(0);
    expect(run.years[5]?.newHireGrants).toBe(0);
  });
});
