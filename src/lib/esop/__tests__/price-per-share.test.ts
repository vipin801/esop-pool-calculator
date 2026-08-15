/**
 * The invariant that let AUDIT_P4 mutation (e) survive.
 *
 * ENGINE_SPEC.md section 3:
 *
 *   FD_t    fully diluted shares at end of year t, INCLUDING UNALLOCATED POOL
 *   PPS_t   V_t / FD_t
 *
 * Removing the unallocated pool from the count that prices year t left all 253
 * tests green while moving the Basis B recommendation from 15% to 12.5%. Nothing
 * in the suite asserted a price per share that `runRollForward` had produced:
 * `valuation.test.ts` prices a share count handed to it by the test, and never
 * asks which count the roll forward hands it.
 *
 * So this file asserts the composition, not just the division. Three levels:
 *
 * 1. A fixture with a fifth of the company sitting in the pool, where V_t / FD_t
 *    is a whole rupee figure and the pool-excluded figure is a different whole
 *    rupee figure, so the two cannot be confused.
 * 2. The same with a top-up, because a top-up enters the count that prices the
 *    year it lands in (M19) and is the other way the pool reaches PPS_t.
 * 3. The universal identity `PPS_t * FD_t = V_t` against the *reported* count,
 *    which is what makes any divergence between the priced count and the
 *    reported count a red test rather than a silent 2.3 percentage points.
 */

import { describe, expect, it } from 'vitest';

import { runRollForward } from '../roll-forward';
import { fullyDilutedShares } from '../valuation';
import { BASIS_B, withArgs } from './fixtures';

/** ₹100 crore against 1,00,00,000 shares, so PPS_0 is exactly ₹100. */
const VALUATION = 1_000_000_000;
const FULLY_DILUTED = 10_000_000;

/** A fifth of the company. Big enough that dropping it is not a rounding error. */
const POOL = 2_000_000;

/**
 * One mid-band hire taking 1% each, ten of them, so year 0 demand is exactly
 * 10,00,000 options and every figure below is a whole number. Basis A, so the
 * grant demand cannot depend on the price and the price is being checked on its
 * own terms rather than through what it bought.
 */
const PLAN = withArgs({
  company: {
    postMoneyValuation: VALUATION,
    fullyDilutedShares: FULLY_DILUTED,
    existingUnallocatedOptions: POOL,
    grantedOutstandingOptions: 0,
  },
  hiring: {
    horizonYears: 3,
    hiresPerYear: [10, 0, 0],
    seniorityMix: { leadership: 0, senior: 0, mid: 100, junior: 0 },
  },
  growth: { valuationGrowthPctPerYear: 0 },
  grantPolicy: {
    grantBasis: {
      kind: 'percentOfEquity',
      grantPctByBand: { leadership: 0, senior: 0, mid: 1, junior: 0 },
    },
    refresh: { ratePct: 0, sizePct: 0, eligibilityMonths: 24 },
  },
  attrition: { baseAnnualPct: 0, byBand: {} },
});

describe('PPS_t is struck on a fully diluted count that includes the unallocated pool', () => {
  const run = runRollForward(PLAN);

  it('prices the company at V_t / FD_t, pool included, in every year', () => {
    // FD_0 = 1,00,00,000, of which 20,00,000 is unallocated pool.
    // V_t = ₹100,00,00,000 in every year, because growth is zero.
    // Nothing is cancelled, because attrition is zero, so FD_t never moves.
    //   PPS_t = 100,00,00,000 / 1,00,00,000 = ₹100
    for (const year of run.years) {
      expect(year.pricePerShare, `year ${year.year}`).toBe(100);
      expect(year.openingFullyDilutedShares, `year ${year.year}`).toBe(FULLY_DILUTED);
    }
  });

  it('is not the figure you get by leaving the pool out, which is the mutation', () => {
    // Excluding the pool would price year 0 at 100,00,00,000 / 80,00,000 = ₹125,
    // and year 1 at 100,00,00,000 / 90,00,000 = ₹111.11 once the year 0 grants
    // have moved 10,00,000 options out of the pool and into granted.
    expect(VALUATION / (FULLY_DILUTED - POOL)).toBe(125);
    expect(run.years[0]?.pricePerShare).not.toBe(125);
    expect(run.years[1]?.pricePerShare).not.toBeCloseTo(
      VALUATION / (FULLY_DILUTED - (POOL - 1_000_000)),
      6,
    );

    // And the pool really is being drawn down, so the two counts genuinely differ
    // in every year rather than happening to coincide.
    expect(run.years[0]?.newHireGrants).toBe(1_000_000);
    expect(run.years[0]?.closingAvailable).toBe(POOL - 1_000_000);
    expect(run.years[2]?.closingAvailable).toBe(POOL - 1_000_000);
  });

  it('takes a top-up into the count that prices the year it lands in', () => {
    const topped = runRollForward({ ...PLAN, topUps: [{ year: 1, options: 1_000_000 }] });

    // Year 0: 1,00,00,000 shares               -> ₹100
    // Year 1: 1,10,00,000 after the top-up     -> ₹90.909090...
    // Year 2: unchanged at 1,10,00,000         -> ₹90.909090...
    expect(topped.years[0]?.pricePerShare).toBe(100);
    expect(topped.years[1]?.openingFullyDilutedShares).toBe(11_000_000);
    expect(topped.years[1]?.pricePerShare).toBeCloseTo(VALUATION / 11_000_000, 9);
    expect(topped.years[2]?.pricePerShare).toBeCloseTo(VALUATION / 11_000_000, 9);
  });
});

describe('the reported count and the priced count are the same count', () => {
  /**
   * `PPS_t * FD_t = V_t` against the count the year actually reports. A price
   * struck on any other count breaks this, whatever that other count is, which
   * is the property that would have caught the mutation without anyone having to
   * guess which term it would drop.
   */
  const cases = [
    { label: 'Basis A, the standard fixture', args: withArgs({}) },
    { label: 'Basis B, the standard fixture', args: withArgs({ grantPolicy: { grantBasis: BASIS_B } }) },
    { label: 'a fifth of the company in the pool', args: PLAN },
    {
      label: 'recycling off, so the count shrinks as options are cancelled',
      args: withArgs({ exercise: { recycleForfeited: false } }),
    },
    {
      label: 'with a top-up mid-plan',
      args: withArgs({ topUps: [{ year: 2, options: 400_000 }] }),
    },
  ];

  for (const { label, args } of cases) {
    it(`reproduces the valuation from the reported count: ${label}`, () => {
      const run = runRollForward(args);
      expect(run.years.length).toBeGreaterThan(0);

      for (const year of run.years) {
        expect(
          year.pricePerShare * year.openingFullyDilutedShares,
          `year ${year.year}`,
        ).toBeCloseTo(year.valuation, 3);
      }
    });
  }

  it('composes the opening count from issued, granted and the pool, every year', () => {
    // M18: FD_t = issued + granted outstanding + available pool. The opening
    // count is that identity taken after the year's top-up and before its
    // cancellations, which is the count M19 prices the year on.
    const args = withArgs({ topUps: [{ year: 2, options: 400_000 }] });
    const run = runRollForward(args);

    run.years.forEach((year, index) => {
      const previous = index === 0 ? undefined : run.years[index - 1];
      const openingIssued =
        previous?.closingIssuedShares ??
        args.company.fullyDilutedShares -
          args.company.existingUnallocatedOptions -
          args.company.grantedOutstandingOptions;
      const openingGranted =
        previous?.closingGrantedOutstanding ?? args.company.grantedOutstandingOptions;

      expect(year.openingFullyDilutedShares, `year ${year.year}`).toBeCloseTo(
        openingIssued + openingGranted + year.openingAvailable + year.topUp,
        6,
      );
    });
  });
});

describe('the fully diluted composition is one function, not one per caller', () => {
  it('adds the three buckets section 3 names', () => {
    expect(
      fullyDilutedShares({
        issuedShares: 8_000_000,
        grantedOutstandingOptions: 500_000,
        unallocatedPoolOptions: 1_500_000,
      }),
    ).toBe(10_000_000);
  });

  it('counts the unallocated pool, which is the whole point of the function', () => {
    const withoutPool = fullyDilutedShares({
      issuedShares: 8_000_000,
      grantedOutstandingOptions: 500_000,
      unallocatedPoolOptions: 0,
    });
    const withPool = fullyDilutedShares({
      issuedShares: 8_000_000,
      grantedOutstandingOptions: 500_000,
      unallocatedPoolOptions: 1_500_000,
    });

    expect(withPool - withoutPool).toBe(1_500_000);
  });

  it('refuses a negative issued or granted count rather than netting it off', () => {
    expect(() =>
      fullyDilutedShares({
        issuedShares: 8_000_000,
        grantedOutstandingOptions: -500_000,
        unallocatedPoolOptions: 1_500_000,
      }),
    ).toThrow(/negative/i);

    expect(() =>
      fullyDilutedShares({
        issuedShares: -1,
        grantedOutstandingOptions: 500_000,
        unallocatedPoolOptions: 1_500_000,
      }),
    ).toThrow(/negative/i);
  });

  it('carries an overdrawn pool, because section 4.4 reads exhaustion off exactly that', () => {
    // The pool term is the one signed bucket. A plan that grants more than the
    // pool holds drives it below zero, and clamping it here would delete the
    // signal the exhaustion month is interpolated from.
    expect(
      fullyDilutedShares({
        issuedShares: 8_000_000,
        grantedOutstandingOptions: 2_500_000,
        unallocatedPoolOptions: -500_000,
      }),
    ).toBe(10_000_000);
  });

  it('is the identity the roll forward reports on an overdrawn year', () => {
    const overdrawn = runRollForward(
      withArgs({ company: { existingUnallocatedOptions: 100_000 } }),
    );
    const year = overdrawn.years[0];
    if (year === undefined) throw new Error('no first year');

    expect(year.closingAvailable).toBeLessThan(0);
    expect(
      fullyDilutedShares({
        issuedShares: year.closingIssuedShares,
        grantedOutstandingOptions: year.closingGrantedOutstanding,
        unallocatedPoolOptions: year.closingAvailable,
      }),
    ).toBeCloseTo(year.fullyDilutedShares, 6);
  });
});
