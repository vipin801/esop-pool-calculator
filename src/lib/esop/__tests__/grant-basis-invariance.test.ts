/**
 * The most important test in this repo.
 *
 * ENGINE_SPEC.md section 1: "under Basis A, pool consumption is completely
 * independent of valuation. Valuation growth changes nothing about how big the
 * pool must be. Under Basis B, valuation growth is the single largest driver."
 *
 * Everything else the tool says is downstream of that sentence being true in
 * the code. If Basis A ever starts moving with the valuation, the tool is
 * telling a founder that a fundraise changed how many options their hiring plan
 * consumes, which it did not, and the product decision D1 becomes a lie.
 *
 * So: the same plan, priced at 0% growth and at 200% growth, must demand the
 * same options to the last bit under Basis A, and strictly fewer options under
 * Basis B.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  DEFAULT_SENIORITY_MIX_PCT,
} from '../defaults';
import { denominatorForYear } from '../denominator';
import { newHireGrantDemand, refreshGrantDemand, splitHiresByBand } from '../grants';
import { VALUE_BASES, type GrantBasis, type RefreshPolicy, type StrikePolicy, type ValueBasis } from '../types';
import { marketYear } from '../valuation';

const POST_MONEY_VALUATION = 500_000_000;
const FACE_VALUE_PER_SHARE = 10;
const COMP_INFLATION_PCT_PER_YEAR = 8;

const REFRESH: RefreshPolicy = { ratePct: 25, sizePct: 40, eligibilityMonths: 24 };

/** Face value, so the realisable spread is defined and every basis can be priced. */
const STRIKE_POLICY: StrikePolicy = { kind: 'faceValue' };

const BASIS_A: GrantBasis = {
  kind: 'percentOfEquity',
  grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND,
};

const BASIS_B: GrantBasis = {
  kind: 'rupeeValue',
  grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND,
};

/**
 * Four plan years. FD_t rises as the pool is granted and exercised; it never
 * moves with the valuation, which is precisely why Basis A cannot either.
 */
const PLAN = [
  { fullyDilutedShares: 10_000_000, hires: 15, eligibleEmployees: 0 },
  { fullyDilutedShares: 10_400_000, hires: 25, eligibleEmployees: 0 },
  { fullyDilutedShares: 10_900_000, hires: 35, eligibleEmployees: 13 },
  { fullyDilutedShares: 11_500_000, hires: 40, eligibleEmployees: 34 },
] as const;

/** New hire plus refresh demand across the whole horizon. */
function totalOptionsDemanded(args: {
  readonly grantBasis: GrantBasis;
  readonly growthPctPerYear: number;
  readonly valueBasis: ValueBasis;
}): number {
  const { grantBasis, growthPctPerYear, valueBasis } = args;

  let total = 0;

  for (const [year, step] of PLAN.entries()) {
    const market = marketYear({
      postMoneyValuation: POST_MONEY_VALUATION,
      growthPctPerYear,
      year,
      fullyDilutedShares: step.fullyDilutedShares,
    });

    const denominator = denominatorForYear({
      valueBasis,
      strikePolicy: STRIKE_POLICY,
      pricePerShare: market.pricePerShare,
      faceValuePerShare: FACE_VALUE_PER_SHARE,
    });

    const grantYear = {
      year,
      fullyDilutedShares: step.fullyDilutedShares,
      compInflationPctPerYear: COMP_INFLATION_PCT_PER_YEAR,
    };

    total += newHireGrantDemand({
      grantBasis,
      hiresByBand: splitHiresByBand(step.hires, DEFAULT_SENIORITY_MIX_PCT),
      grantYear,
      denominator,
    }).totalOptions;

    total += refreshGrantDemand({
      grantBasis,
      eligibleByBand: splitHiresByBand(step.eligibleEmployees, DEFAULT_SENIORITY_MIX_PCT),
      refresh: REFRESH,
      grantYear,
      denominator,
    }).totalOptions;
  }

  return total;
}

describe('Basis A, percent of equity', () => {
  it('changes total options demanded by exactly zero when growth goes from 0% to 200%', () => {
    const flat = totalOptionsDemanded({
      grantBasis: BASIS_A,
      growthPctPerYear: 0,
      valueBasis: 'notional',
    });
    const explosive = totalOptionsDemanded({
      grantBasis: BASIS_A,
      growthPctPerYear: 200,
      valueBasis: 'notional',
    });

    expect(explosive - flat).toBe(0);
    expect(explosive).toBe(flat);
    expect(flat).toBeGreaterThan(0);
  });

  it('is not a vacuous test: the price per share moves 27-fold over the same path', () => {
    const lastYear = PLAN[3];

    const flat = marketYear({
      postMoneyValuation: POST_MONEY_VALUATION,
      growthPctPerYear: 0,
      year: 3,
      fullyDilutedShares: lastYear.fullyDilutedShares,
    });
    const explosive = marketYear({
      postMoneyValuation: POST_MONEY_VALUATION,
      growthPctPerYear: 200,
      year: 3,
      fullyDilutedShares: lastYear.fullyDilutedShares,
    });

    expect(explosive.pricePerShare / flat.pricePerShare).toBeCloseTo(27, 9);
  });

  it('holds under every value basis, because none of them is ever consulted', () => {
    for (const valueBasis of VALUE_BASES) {
      const flat = totalOptionsDemanded({ grantBasis: BASIS_A, growthPctPerYear: 0, valueBasis });
      const explosive = totalOptionsDemanded({
        grantBasis: BASIS_A,
        growthPctPerYear: 200,
        valueBasis,
      });

      expect(explosive, `${valueBasis} leaked a valuation into Basis A`).toBe(flat);
    }
  });

  it('reports no denominator, because Basis A has none', () => {
    const demand = newHireGrantDemand({
      grantBasis: BASIS_A,
      hiresByBand: splitHiresByBand(15, DEFAULT_SENIORITY_MIX_PCT),
      grantYear: {
        year: 0,
        fullyDilutedShares: 10_000_000,
        compInflationPctPerYear: COMP_INFLATION_PCT_PER_YEAR,
      },
      denominator: 42,
    });

    expect(demand.denominator).toBeNull();
    expect(demand.basisKind).toBe('percentOfEquity');
  });
});

describe('Basis B, rupee value, notional', () => {
  it('demands strictly fewer options when the growth rate doubles', () => {
    const base = totalOptionsDemanded({
      grantBasis: BASIS_B,
      growthPctPerYear: 40,
      valueBasis: 'notional',
    });
    const doubled = totalOptionsDemanded({
      grantBasis: BASIS_B,
      growthPctPerYear: 80,
      valueBasis: 'notional',
    });

    expect(doubled).toBeLessThan(base);
  });

  it('does so at every growth rate, not just one lucky pair', () => {
    for (const growthPctPerYear of [10, 25, 40, 60]) {
      const base = totalOptionsDemanded({
        grantBasis: BASIS_B,
        growthPctPerYear,
        valueBasis: 'notional',
      });
      const doubled = totalOptionsDemanded({
        grantBasis: BASIS_B,
        growthPctPerYear: growthPctPerYear * 2,
        valueBasis: 'notional',
      });

      expect(doubled, `doubling ${growthPctPerYear}% did not reduce demand`).toBeLessThan(base);
    }
  });

  it('leaves year 0 untouched, so the whole reduction sits in the later years', () => {
    const hiresByBand = splitHiresByBand(15, DEFAULT_SENIORITY_MIX_PCT);
    const grantYear = {
      year: 0,
      fullyDilutedShares: 10_000_000,
      compInflationPctPerYear: COMP_INFLATION_PCT_PER_YEAR,
    };

    const demandAt = (growthPctPerYear: number): number =>
      newHireGrantDemand({
        grantBasis: BASIS_B,
        hiresByBand,
        grantYear,
        denominator: denominatorForYear({
          valueBasis: 'notional',
          strikePolicy: STRIKE_POLICY,
          pricePerShare: marketYear({
            postMoneyValuation: POST_MONEY_VALUATION,
            growthPctPerYear,
            year: 0,
            fullyDilutedShares: 10_000_000,
          }).pricePerShare,
          faceValuePerShare: FACE_VALUE_PER_SHARE,
        }),
      }).totalOptions;

    expect(demandAt(80)).toBe(demandAt(40));
  });
});
