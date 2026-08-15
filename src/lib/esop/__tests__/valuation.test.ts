/** ENGINE_SPEC.md section 3: V_t, FD_t, and PPS_t = V_t / FD_t. */

import { describe, expect, it } from 'vitest';

import { EsopEngineError } from '../errors';
import { buildMarketPath, marketYear, pricePerShare, valuationAtYear } from '../valuation';

const POST_MONEY_VALUATION = 500_000_000;
const FULLY_DILUTED_SHARES = 10_000_000;

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsopEngineError) return error.code;
    throw error;
  }
  throw new Error('expected an EsopEngineError, none was thrown');
}

describe('valuation path', () => {
  it('prices year 0 at today’s post-money valuation', () => {
    expect(
      valuationAtYear({ postMoneyValuation: POST_MONEY_VALUATION, growthPctPerYear: 40, year: 0 }),
    ).toBe(POST_MONEY_VALUATION);
  });

  it('compounds annually', () => {
    expect(
      valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: 50, year: 2 }),
    ).toBeCloseTo(225, 9);
  });

  it('stands still at zero growth', () => {
    for (const year of [0, 1, 5]) {
      expect(valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: 0, year })).toBe(100);
    }
  });

  it('shrinks on negative growth', () => {
    expect(valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: -50, year: 2 })).toBe(25);
  });

  it('refuses growth at or below -100%, a valuation at or below zero, and a bad year', () => {
    expect(
      codeOf(() =>
        valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: -100, year: 1 }),
      ),
    ).toBe('nonPositiveGrowthFactor');
    expect(
      codeOf(() => valuationAtYear({ postMoneyValuation: 0, growthPctPerYear: 10, year: 1 })),
    ).toBe('nonPositiveValuation');
    expect(
      codeOf(() => valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: 10, year: -1 })),
    ).toBe('invalidYearIndex');
    expect(
      codeOf(() => valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: 10, year: 1.5 })),
    ).toBe('invalidYearIndex');
  });
});

describe('price per share depends on the fully diluted count', () => {
  it('is the valuation divided by the share count', () => {
    expect(
      pricePerShare({
        valuation: POST_MONEY_VALUATION,
        fullyDilutedShares: FULLY_DILUTED_SHARES,
      }),
    ).toBe(50);
  });

  it('multiplies back to the valuation', () => {
    const pps = pricePerShare({ valuation: 7_777_777, fullyDilutedShares: 3_333 });
    expect(pps * 3_333).toBeCloseTo(7_777_777, 6);
  });

  it('falls as the pool grows the fully diluted count', () => {
    // This is the circularity behind the section 4.5 fixed point: a bigger pool
    // is more shares, which is a lower price per share, which under Basis B is
    // more options per rupee of grant, which is a bigger pool again.
    const beforePool = pricePerShare({
      valuation: POST_MONEY_VALUATION,
      fullyDilutedShares: 10_000_000,
    });
    const afterPool = pricePerShare({
      valuation: POST_MONEY_VALUATION,
      fullyDilutedShares: 11_000_000,
    });

    expect(afterPool).toBeLessThan(beforePool);
  });

  it('halves exactly when the share count doubles', () => {
    expect(
      pricePerShare({ valuation: POST_MONEY_VALUATION, fullyDilutedShares: 20_000_000 }),
    ).toBe(pricePerShare({ valuation: POST_MONEY_VALUATION, fullyDilutedShares: 10_000_000 }) / 2);
  });

  it('refuses a share count at or below zero', () => {
    for (const fullyDilutedShares of [0, -1]) {
      expect(
        codeOf(() => pricePerShare({ valuation: POST_MONEY_VALUATION, fullyDilutedShares })),
      ).toBe('nonPositiveFullyDilutedShares');
    }
  });
});

describe('the market path', () => {
  it('takes one share count per year, because the pool changes it', () => {
    const path = buildMarketPath({
      postMoneyValuation: POST_MONEY_VALUATION,
      growthPctPerYear: 40,
      fullyDilutedSharesByYear: [10_000_000, 10_400_000, 10_900_000],
    });

    expect(path).toHaveLength(3);
    expect(path.map((entry) => entry.year)).toEqual([0, 1, 2]);
    expect(path.map((entry) => entry.fullyDilutedShares)).toEqual([
      10_000_000, 10_400_000, 10_900_000,
    ]);

    for (const entry of path) {
      expect(entry.pricePerShare).toBe(
        marketYear({
          postMoneyValuation: POST_MONEY_VALUATION,
          growthPctPerYear: 40,
          year: entry.year,
          fullyDilutedShares: entry.fullyDilutedShares,
        }).pricePerShare,
      );
    }
  });

  it('can still fall in price while the valuation rises, if the pool grows faster', () => {
    const path = buildMarketPath({
      postMoneyValuation: POST_MONEY_VALUATION,
      growthPctPerYear: 5,
      fullyDilutedSharesByYear: [10_000_000, 20_000_000],
    });

    const [first, second] = path;
    if (first === undefined || second === undefined) throw new Error('path is too short');

    expect(second.valuation).toBeGreaterThan(first.valuation);
    expect(second.pricePerShare).toBeLessThan(first.pricePerShare);
  });

  it('throws rather than returning an unpriced year', () => {
    expect(() =>
      buildMarketPath({
        postMoneyValuation: POST_MONEY_VALUATION,
        growthPctPerYear: 40,
        fullyDilutedSharesByYear: [10_000_000, 0],
      }),
    ).toThrow(EsopEngineError);
  });
});
