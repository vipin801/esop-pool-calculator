/** ENGINE_SPEC.md sections 4.1 and 4.2, formula by formula. */

import { describe, expect, it } from 'vitest';

import { DEFAULT_SENIORITY_MIX_PCT } from '../defaults';
import { EsopEngineError } from '../errors';
import {
  compInflationFactor,
  eligibleByBandFromTenures,
  isRefreshEligible,
  newHireGrantDemand,
  refreshGrantDemand,
  seniorityMixSumsTo100,
  splitHiresByBand,
  sumOverBands,
  type ByBand,
  type GrantYear,
} from '../grants';
import type { GrantBasis, RefreshPolicy } from '../types';

const FULLY_DILUTED_SHARES = 10_000_000;
const COMP_INFLATION_PCT_PER_YEAR = 8;

const GRANT_PCT_BY_BAND: ByBand = { leadership: 0.9, senior: 0.225, mid: 0.1, junior: 0.06 };
const GRANT_VALUE_BY_BAND: ByBand = {
  leadership: 8_000_000,
  senior: 2_500_000,
  mid: 1_000_000,
  junior: 300_000,
};

const BASIS_A: GrantBasis = { kind: 'percentOfEquity', grantPctByBand: GRANT_PCT_BY_BAND };
const BASIS_B: GrantBasis = { kind: 'rupeeValue', grantValueByBand: GRANT_VALUE_BY_BAND };

const REFRESH: RefreshPolicy = { ratePct: 25, sizePct: 40, eligibilityMonths: 24 };

const ONE_LEADER: ByBand = { leadership: 1, senior: 0, mid: 0, junior: 0 };

function grantYear(year: number): GrantYear {
  return {
    year,
    fullyDilutedShares: FULLY_DILUTED_SHARES,
    compInflationPctPerYear: COMP_INFLATION_PCT_PER_YEAR,
  };
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsopEngineError) return error.code;
    throw error;
  }
  throw new Error('expected an EsopEngineError, none was thrown');
}

describe('splitting hires across bands', () => {
  it('applies the seniority mix', () => {
    expect(splitHiresByBand(20, DEFAULT_SENIORITY_MIX_PCT)).toEqual({
      leadership: 1,
      senior: 4,
      mid: 9,
      junior: 6,
    });
  });

  it('keeps fractional hires rather than rounding a plan into a different plan', () => {
    const split = splitHiresByBand(15, DEFAULT_SENIORITY_MIX_PCT);

    expect(split.leadership).toBe(0.75);
    expect(sumOverBands(split)).toBeCloseTo(15, 12);
  });

  it('reports a mix that does not add up instead of silently losing hires', () => {
    expect(seniorityMixSumsTo100(DEFAULT_SENIORITY_MIX_PCT)).toBe(true);
    expect(seniorityMixSumsTo100({ leadership: 5, senior: 20, mid: 45, junior: 20 })).toBe(false);

    // Section 4.1 still applies the mix as given; the shortfall is a warning the
    // engine raises, not an exception thrown from here.
    expect(sumOverBands(splitHiresByBand(100, { leadership: 5, senior: 20, mid: 45, junior: 20 })))
      .toBe(90);
  });

  it('refuses a negative headcount', () => {
    expect(codeOf(() => splitHiresByBand(-1, DEFAULT_SENIORITY_MIX_PCT))).toBe('negativeHeadcount');
  });
});

describe('4.1 new hire grants, Basis A', () => {
  it('grants a percentage of the fully diluted count', () => {
    const demand = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(0),
    });

    // 1 hire * 0.9% * 10,000,000 shares.
    expect(demand.optionsByBand.leadership).toBe(90_000);
    expect(demand.totalOptions).toBe(90_000);
  });

  it('sums across bands', () => {
    const hiresByBand: ByBand = { leadership: 1, senior: 4, mid: 9, junior: 6 };

    const demand = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand,
      grantYear: grantYear(0),
    });

    const expected =
      ((1 * 0.9 + 4 * 0.225 + 9 * 0.1 + 6 * 0.06) * FULLY_DILUTED_SHARES) / 100;

    expect(demand.totalOptions).toBeCloseTo(expected, 6);
  });

  it('ignores comp inflation and the year, because a percentage is not a rupee value', () => {
    const first = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(0),
    });
    const fifth = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(4),
    });

    expect(fifth.totalOptions).toBe(first.totalOptions);
  });

  it('scales with the fully diluted count', () => {
    const demand = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand: ONE_LEADER,
      grantYear: { ...grantYear(0), fullyDilutedShares: FULLY_DILUTED_SHARES * 2 },
    });

    expect(demand.totalOptions).toBe(180_000);
  });

  it('refuses a fully diluted count at or below zero', () => {
    expect(
      codeOf(() =>
        newHireGrantDemand({
          grantBasis: BASIS_A,
          hiresByBand: ONE_LEADER,
          grantYear: { ...grantYear(0), fullyDilutedShares: 0 },
        }),
      ),
    ).toBe('nonPositiveFullyDilutedShares');
  });
});

describe('4.1 new hire grants, Basis B', () => {
  it('converts the rupee grant at the denominator', () => {
    const demand = newHireGrantDemand({
      grantBasis: BASIS_B,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(0),
      denominator: 1000,
    });

    // ₹80,00,000 at ₹1,000 a share.
    expect(demand.optionsByBand.leadership).toBe(8_000);
    expect(demand.denominator).toBe(1000);
    expect(demand.basisKind).toBe('rupeeValue');
  });

  it('inflates the grant value by (1+i)^t', () => {
    const demand = newHireGrantDemand({
      grantBasis: BASIS_B,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(1),
      denominator: 1000,
    });

    expect(demand.totalOptions).toBeCloseTo(8_640, 9);
    expect(compInflationFactor(COMP_INFLATION_PCT_PER_YEAR, 1)).toBeCloseTo(1.08, 12);
    expect(compInflationFactor(COMP_INFLATION_PCT_PER_YEAR, 0)).toBe(1);
  });

  it('halves the option count when the denominator doubles', () => {
    const cheap = newHireGrantDemand({
      grantBasis: BASIS_B,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(2),
      denominator: 1000,
    });
    const dear = newHireGrantDemand({
      grantBasis: BASIS_B,
      hiresByBand: ONE_LEADER,
      grantYear: grantYear(2),
      denominator: 2000,
    });

    expect(dear.totalOptions).toBe(cheap.totalOptions / 2);
  });

  it('refuses to run without a denominator', () => {
    expect(
      codeOf(() =>
        newHireGrantDemand({
          grantBasis: BASIS_B,
          hiresByBand: ONE_LEADER,
          grantYear: grantYear(0),
        }),
      ),
    ).toBe('missingDenominator');
  });

  it('refuses a denominator at or below zero', () => {
    for (const denominator of [0, -1000]) {
      expect(
        codeOf(() =>
          newHireGrantDemand({
            grantBasis: BASIS_B,
            hiresByBand: ONE_LEADER,
            grantYear: grantYear(0),
            denominator,
          }),
        ),
      ).toBe('nonPositiveDenominator');
    }
  });
});

describe('4.2 refresh grants, on the eligible base', () => {
  const eligibleByBand: ByBand = { leadership: 2, senior: 8, mid: 18, junior: 12 };

  it('counts an employee as eligible at exactly the eligibility tenure', () => {
    expect(isRefreshEligible(24, REFRESH)).toBe(true);
    expect(isRefreshEligible(23.9, REFRESH)).toBe(false);
    expect(isRefreshEligible(60, REFRESH)).toBe(true);
  });

  it('builds the eligible base from tenures', () => {
    const eligible = eligibleByBandFromTenures(
      [
        { band: 'leadership', tenureMonths: 36 },
        { band: 'leadership', tenureMonths: 12 },
        { band: 'mid', tenureMonths: 24 },
        { band: 'mid', tenureMonths: 25 },
        { band: 'junior', tenureMonths: 6 },
      ],
      REFRESH,
    );

    expect(eligible).toEqual({ leadership: 1, senior: 0, mid: 2, junior: 0 });
  });

  it('matches the spec formula R_t = Eligible * rate * size * Gbar * (1+i)^t / D_t', () => {
    const denominator = 1250;
    const demand = refreshGrantDemand({
      grantBasis: BASIS_B,
      eligibleByBand,
      refresh: REFRESH,
      grantYear: grantYear(3),
      denominator,
    });

    const expected =
      (demand.eligibleHeadcount *
        (REFRESH.ratePct / 100) *
        (REFRESH.sizePct / 100) *
        demand.averageGrantPerEligible *
        compInflationFactor(COMP_INFLATION_PCT_PER_YEAR, 3)) /
      denominator;

    expect(demand.eligibleHeadcount).toBe(40);
    expect(Math.abs(demand.totalOptions - expected) / expected).toBeLessThan(1e-12);
  });

  it('weights Gbar by the eligible headcount in each band', () => {
    const demand = refreshGrantDemand({
      grantBasis: BASIS_B,
      eligibleByBand,
      refresh: REFRESH,
      grantYear: grantYear(0),
      denominator: 1000,
    });

    const expected =
      (2 * 8_000_000 + 8 * 2_500_000 + 18 * 1_000_000 + 12 * 300_000) / 40;

    expect(demand.averageGrantPerEligible).toBeCloseTo(expected, 6);
  });

  it('mirrors the grant basis fork, so Basis A refresh is a percentage of FD_t', () => {
    const demand = refreshGrantDemand({
      grantBasis: BASIS_A,
      eligibleByBand,
      refresh: REFRESH,
      grantYear: grantYear(3),
    });

    const expected =
      (demand.eligibleHeadcount *
        (REFRESH.ratePct / 100) *
        (REFRESH.sizePct / 100) *
        demand.averageGrantPerEligible *
        FULLY_DILUTED_SHARES) /
      100;

    expect(demand.denominator).toBeNull();
    expect(Math.abs(demand.totalOptions - expected) / expected).toBeLessThan(1e-12);
  });

  it('scales with the eligible base and stops at zero when nobody qualifies', () => {
    const single = refreshGrantDemand({
      grantBasis: BASIS_B,
      eligibleByBand,
      refresh: REFRESH,
      grantYear: grantYear(0),
      denominator: 1000,
    });
    const doubled = refreshGrantDemand({
      grantBasis: BASIS_B,
      eligibleByBand: {
        leadership: 4,
        senior: 16,
        mid: 36,
        junior: 24,
      },
      refresh: REFRESH,
      grantYear: grantYear(0),
      denominator: 1000,
    });
    const nobody = refreshGrantDemand({
      grantBasis: BASIS_B,
      eligibleByBand: { leadership: 0, senior: 0, mid: 0, junior: 0 },
      refresh: REFRESH,
      grantYear: grantYear(0),
      denominator: 1000,
    });

    expect(doubled.totalOptions).toBeCloseTo(single.totalOptions * 2, 6);
    expect(nobody.totalOptions).toBe(0);
    expect(nobody.averageGrantPerEligible).toBe(0);
  });

  it('refuses a negative refresh rate or size', () => {
    expect(
      codeOf(() =>
        refreshGrantDemand({
          grantBasis: BASIS_A,
          eligibleByBand,
          refresh: { ...REFRESH, ratePct: -25 },
          grantYear: grantYear(0),
        }),
      ),
    ).toBe('invalidRefreshPolicy');

    expect(
      codeOf(() =>
        refreshGrantDemand({
          grantBasis: BASIS_A,
          eligibleByBand,
          refresh: { ...REFRESH, sizePct: -40 },
          grantYear: grantYear(0),
        }),
      ),
    ).toBe('invalidRefreshPolicy');
  });
});
