/**
 * ENGINE_SPEC.md section 2, at the level a founder sees it: how many options a
 * fixed rupee promise buys under each of the three value bases.
 *
 * The ordering here is the argument for showing realisable underneath notional.
 * A notional promise buys the fewest options, so an offer letter quoting a
 * notional value is quoting the smallest grant that satisfies the number.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_GRANT_VALUE_BY_BAND, DEFAULT_SENIORITY_MIX_PCT } from '../defaults';
import { DEFAULT_THETA, allDenominatorsForYear, denominatorForYear } from '../denominator';
import { EsopEngineError, isEsopEngineError } from '../errors';
import { newHireGrantDemand, splitHiresByBand } from '../grants';
import type { GrantBasis, StrikePolicy, ValueBasis } from '../types';
import { pricePerShare } from '../valuation';

const POST_MONEY_VALUATION = 10_000_000_000;
const FULLY_DILUTED_SHARES = 10_000_000;
const FACE_VALUE_PER_SHARE = 10;

/** ₹1,000 a share, so every figure below can be checked by hand. */
const PPS = pricePerShare({
  valuation: POST_MONEY_VALUATION,
  fullyDilutedShares: FULLY_DILUTED_SHARES,
});

const BASIS_B: GrantBasis = {
  kind: 'rupeeValue',
  grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND,
};

const HIRES = splitHiresByBand(25, DEFAULT_SENIORITY_MIX_PCT);

const GRANT_YEAR = {
  year: 2,
  fullyDilutedShares: FULLY_DILUTED_SHARES,
  compInflationPctPerYear: 8,
};

function optionsDemanded(args: {
  readonly valueBasis: ValueBasis;
  readonly strikePolicy: StrikePolicy;
  readonly theta?: number;
}): number {
  return newHireGrantDemand({
    grantBasis: BASIS_B,
    hiresByBand: HIRES,
    grantYear: GRANT_YEAR,
    denominator: denominatorForYear({
      valueBasis: args.valueBasis,
      strikePolicy: args.strikePolicy,
      pricePerShare: PPS,
      faceValuePerShare: FACE_VALUE_PER_SHARE,
      theta: args.theta,
    }),
  }).totalOptions;
}

describe('the price per share these tests are built on', () => {
  it('is ₹1,000', () => {
    expect(PPS).toBe(1000);
  });
});

describe('realisable against notional', () => {
  it('demands strictly more options whenever the strike is above zero', () => {
    const strikePolicies: readonly StrikePolicy[] = [
      { kind: 'faceValue' },
      { kind: 'discountToFMV', discountPct: 10 },
      { kind: 'discountToFMV', discountPct: 50 },
      { kind: 'discountToFMV', discountPct: 90 },
    ];

    for (const strikePolicy of strikePolicies) {
      const notional = optionsDemanded({ valueBasis: 'notional', strikePolicy });
      const realisable = optionsDemanded({ valueBasis: 'realisable', strikePolicy });

      expect(realisable, `${strikePolicy.kind} did not widen the grant`).toBeGreaterThan(notional);
    }
  });

  it('widens the gap as the strike rises towards the money', () => {
    const atFaceValue = optionsDemanded({
      valueBasis: 'realisable',
      strikePolicy: { kind: 'faceValue' },
    });
    const nearTheMoney = optionsDemanded({
      valueBasis: 'realisable',
      strikePolicy: { kind: 'discountToFMV', discountPct: 10 },
    });

    expect(nearTheMoney).toBeGreaterThan(atFaceValue);
  });
});

describe('fair value against the other two', () => {
  /**
   * Fair value sits between notional and realisable exactly when
   * X_t > (1 - theta) * PPS_t, which is the near-the-money strike the spec is
   * talking about when it calls fair value "the only honest basis when the
   * strike is set at the last round price". A 10% discount to FMV satisfies it
   * for every theta above 0.1.
   */
  const strikePolicy: StrikePolicy = { kind: 'discountToFMV', discountPct: 10 };

  it('sits between them for theta between 0.5 and 1', () => {
    const notional = optionsDemanded({ valueBasis: 'notional', strikePolicy });
    const realisable = optionsDemanded({ valueBasis: 'realisable', strikePolicy });

    for (const theta of [0.5, 0.55, 0.75, 0.9, 1]) {
      const fairValue = optionsDemanded({ valueBasis: 'fairValue', strikePolicy, theta });

      expect(fairValue, `theta ${theta} fell below notional`).toBeGreaterThanOrEqual(notional);
      expect(fairValue, `theta ${theta} rose above realisable`).toBeLessThan(realisable);
    }
  });

  it('is strictly above notional for every theta below 1, and equal to it at theta 1', () => {
    const notional = optionsDemanded({ valueBasis: 'notional', strikePolicy });

    for (const theta of [0.5, 0.55, 0.75, 0.9]) {
      expect(optionsDemanded({ valueBasis: 'fairValue', strikePolicy, theta })).toBeGreaterThan(
        notional,
      );
    }

    expect(optionsDemanded({ valueBasis: 'fairValue', strikePolicy, theta: 1 })).toBe(notional);
  });

  it('defaults theta to 0.55', () => {
    expect(DEFAULT_THETA).toBe(0.55);

    expect(optionsDemanded({ valueBasis: 'fairValue', strikePolicy })).toBe(
      optionsDemanded({ valueBasis: 'fairValue', strikePolicy, theta: 0.55 }),
    );
  });

  it('rises above realisable at a face value strike, which is not a contradiction', () => {
    // At ₹10 against a ₹1,000 share the realisable spread is nearly the whole
    // price, so realisable demand collapses towards notional while fair value
    // stays at 1/theta of it. Betweenness is a near-the-money property, not a
    // universal one, and asserting otherwise would be asserting something false.
    const faceValue: StrikePolicy = { kind: 'faceValue' };

    const realisable = optionsDemanded({ valueBasis: 'realisable', strikePolicy: faceValue });
    const fairValue = optionsDemanded({ valueBasis: 'fairValue', strikePolicy: faceValue });

    expect(fairValue).toBeGreaterThan(realisable);
    expect(FACE_VALUE_PER_SHARE).toBeLessThan((1 - DEFAULT_THETA) * PPS);
  });
});

describe('a strike set at the last round price', () => {
  const lastRoundPrice: StrikePolicy = { kind: 'lastRoundPrice' };

  it('raises a typed error under the realisable basis rather than dividing by nothing', () => {
    let thrown: unknown;
    try {
      optionsDemanded({ valueBasis: 'realisable', strikePolicy: lastRoundPrice });
    } catch (error) {
      thrown = error;
    }

    expect(isEsopEngineError(thrown)).toBe(true);
    expect((thrown as EsopEngineError).code).toBe('degenerateRealisableSpread');
    expect((thrown as EsopEngineError).detail).toMatchObject({
      pricePerShare: PPS,
      exercisePrice: PPS,
      spread: 0,
    });
  });

  it('raises the same error just inside the guard, and prices just outside it', () => {
    // The guard is a fraction of PPS, so a strike a hair below the money is
    // still refused, and one far enough below is priced normally.
    const justInside: StrikePolicy = { kind: 'discountToFMV', discountPct: 1e-7 };
    const justOutside: StrikePolicy = { kind: 'discountToFMV', discountPct: 1e-3 };

    expect(() => optionsDemanded({ valueBasis: 'realisable', strikePolicy: justInside })).toThrow(
      EsopEngineError,
    );
    expect(optionsDemanded({ valueBasis: 'realisable', strikePolicy: justOutside })).toBeGreaterThan(
      0,
    );
  });

  it('still prices notional and fair value, and says why realisable is missing', () => {
    const outcomes = allDenominatorsForYear({
      strikePolicy: lastRoundPrice,
      pricePerShare: PPS,
      faceValuePerShare: FACE_VALUE_PER_SHARE,
    });

    expect(outcomes.notional.ok).toBe(true);
    expect(outcomes.fairValue.ok).toBe(true);
    expect(outcomes.realisable.ok).toBe(false);

    if (outcomes.realisable.ok) throw new Error('realisable should not price at the money');
    expect(outcomes.realisable.error.code).toBe('degenerateRealisableSpread');
    expect(outcomes.realisable.error.message).toContain('fair value');
  });
});
