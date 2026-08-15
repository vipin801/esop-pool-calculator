/**
 * The engine throws one error type, carrying one of a closed set of codes.
 *
 * The last test here is the point of the file: every declared code must be
 * reachable from a real engine call, so a code cannot quietly become a comment
 * that no path can produce and no UI will ever have to handle.
 */

import { describe, expect, it } from 'vitest';

import { denominatorFor, exercisePriceAtYear } from '../denominator';
import {
  ESOP_ERROR_CODES,
  EsopEngineError,
  isEsopEngineError,
  type EsopErrorCode,
} from '../errors';
import {
  newHireGrantDemand,
  refreshGrantDemand,
  splitHiresByBand,
  type ByBand,
} from '../grants';
import type { GrantBasis, RefreshPolicy } from '../types';
import { pricePerShare, valuationAtYear } from '../valuation';

const ONE_LEADER: ByBand = { leadership: 1, senior: 0, mid: 0, junior: 0 };

const BASIS_B: GrantBasis = {
  kind: 'rupeeValue',
  grantValueByBand: { leadership: 8_000_000, senior: 0, mid: 0, junior: 0 },
};

const BASIS_A: GrantBasis = {
  kind: 'percentOfEquity',
  grantPctByBand: { leadership: 0.9, senior: 0, mid: 0, junior: 0 },
};

const REFRESH: RefreshPolicy = { ratePct: 25, sizePct: 40, eligibilityMonths: 24 };

const GRANT_YEAR = { year: 0, fullyDilutedShares: 10_000_000, compInflationPctPerYear: 8 };

/** One real engine call per code. */
const REACHES: Readonly<Record<EsopErrorCode, () => unknown>> = {
  nonPositiveValuation: () => pricePerShare({ valuation: 0, fullyDilutedShares: 1 }),
  nonPositiveFullyDilutedShares: () => pricePerShare({ valuation: 1, fullyDilutedShares: 0 }),
  nonPositiveGrowthFactor: () =>
    valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: -100, year: 1 }),
  invalidYearIndex: () =>
    valuationAtYear({ postMoneyValuation: 100, growthPctPerYear: 10, year: -1 }),
  nonPositivePricePerShare: () =>
    denominatorFor({ valueBasis: 'notional', pricePerShare: 0, exercisePrice: 10 }),
  degenerateRealisableSpread: () =>
    denominatorFor({ valueBasis: 'realisable', pricePerShare: 100, exercisePrice: 100 }),
  thetaOutOfRange: () =>
    denominatorFor({ valueBasis: 'fairValue', pricePerShare: 100, exercisePrice: 10, theta: 0 }),
  missingDenominator: () =>
    newHireGrantDemand({ grantBasis: BASIS_B, hiresByBand: ONE_LEADER, grantYear: GRANT_YEAR }),
  nonPositiveDenominator: () =>
    newHireGrantDemand({
      grantBasis: BASIS_B,
      hiresByBand: ONE_LEADER,
      grantYear: GRANT_YEAR,
      denominator: 0,
    }),
  negativeHeadcount: () =>
    splitHiresByBand(-1, { leadership: 5, senior: 20, mid: 45, junior: 30 }),
  invalidMoneyAmount: () =>
    exercisePriceAtYear({
      strikePolicy: { kind: 'faceValue' },
      pricePerShare: 100,
      faceValuePerShare: 0,
    }),
  invalidRefreshPolicy: () =>
    refreshGrantDemand({
      grantBasis: BASIS_A,
      eligibleByBand: ONE_LEADER,
      refresh: { ...REFRESH, ratePct: -1 },
      grantYear: GRANT_YEAR,
    }),
};

describe('EsopEngineError', () => {
  it('is recognisable, named, and carries its code and detail', () => {
    const error = new EsopEngineError('missingDenominator', 'no denominator', { year: 2 });

    expect(error).toBeInstanceOf(Error);
    expect(isEsopEngineError(error)).toBe(true);
    expect(error.name).toBe('EsopEngineError');
    expect(error.code).toBe('missingDenominator');
    expect(error.detail).toEqual({ year: 2 });
  });

  it('is not confused with a plain Error', () => {
    expect(isEsopEngineError(new Error('missingDenominator'))).toBe(false);
    expect(isEsopEngineError('missingDenominator')).toBe(false);
    expect(isEsopEngineError(null)).toBe(false);
  });
});

describe('every declared error code', () => {
  it('is reachable from a real engine call', () => {
    const reached: EsopErrorCode[] = [];

    for (const [code, run] of Object.entries(REACHES) as ReadonlyArray<
      readonly [EsopErrorCode, () => unknown]
    >) {
      let thrown: unknown;
      try {
        run();
      } catch (error) {
        thrown = error;
      }

      expect(isEsopEngineError(thrown), `${code} threw nothing, or threw the wrong type`).toBe(true);
      expect((thrown as EsopEngineError).code, `${code} produced a different code`).toBe(code);
      reached.push(code);
    }

    expect([...reached].sort()).toEqual([...ESOP_ERROR_CODES].sort());
  });
});
