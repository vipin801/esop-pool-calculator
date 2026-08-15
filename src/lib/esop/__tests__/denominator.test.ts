/** ENGINE_SPEC.md section 2, unit level: X_t from the strike policy, then D_t. */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THETA,
  MIN_REALISABLE_SPREAD_FRACTION_OF_PPS,
  allDenominatorsForYear,
  denominatorFor,
  denominatorForYear,
  exercisePriceAtYear,
} from '../denominator';
import { EsopEngineError } from '../errors';
import type { StrikePolicy } from '../types';

const PPS = 1000;
const FACE_VALUE = 10;

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsopEngineError) return error.code;
    throw error;
  }
  throw new Error('expected an EsopEngineError, none was thrown');
}

describe('exercise price by strike policy', () => {
  it('takes face value at the face value pole', () => {
    expect(
      exercisePriceAtYear({
        strikePolicy: { kind: 'faceValue' },
        pricePerShare: PPS,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(FACE_VALUE);
  });

  it('takes the modelled price per share at the last round price pole', () => {
    expect(
      exercisePriceAtYear({
        strikePolicy: { kind: 'lastRoundPrice' },
        pricePerShare: PPS,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(PPS);
  });

  it('discounts FMV by the stated percentage', () => {
    expect(
      exercisePriceAtYear({
        strikePolicy: { kind: 'discountToFMV', discountPct: 20 },
        pricePerShare: PPS,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(800);
  });

  it('never goes below face value, because shares cannot be issued below par', () => {
    expect(
      exercisePriceAtYear({
        strikePolicy: { kind: 'discountToFMV', discountPct: 99.9 },
        pricePerShare: 50,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(FACE_VALUE);

    expect(
      exercisePriceAtYear({
        strikePolicy: { kind: 'lastRoundPrice' },
        pricePerShare: 4,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(FACE_VALUE);
  });

  it('refuses a face value of zero', () => {
    expect(
      codeOf(() =>
        exercisePriceAtYear({
          strikePolicy: { kind: 'faceValue' },
          pricePerShare: PPS,
          faceValuePerShare: 0,
        }),
      ),
    ).toBe('invalidMoneyAmount');
  });
});

describe('the three denominators', () => {
  it('divides by the price per share under the notional basis', () => {
    expect(denominatorFor({ valueBasis: 'notional', pricePerShare: PPS, exercisePrice: 250 })).toBe(
      PPS,
    );
  });

  it('divides by the spread under the realisable basis', () => {
    expect(
      denominatorFor({ valueBasis: 'realisable', pricePerShare: PPS, exercisePrice: 250 }),
    ).toBe(750);
  });

  it('divides by theta times the price per share under the fair value basis', () => {
    expect(
      denominatorFor({ valueBasis: 'fairValue', pricePerShare: PPS, exercisePrice: 250 }),
    ).toBe(550);

    expect(
      denominatorFor({
        valueBasis: 'fairValue',
        pricePerShare: PPS,
        exercisePrice: 250,
        theta: 0.8,
      }),
    ).toBe(800);
  });

  it('defaults theta to 0.55 for a 4 year life at 60% volatility', () => {
    expect(DEFAULT_THETA).toBe(0.55);
  });

  it('refuses a theta outside (0, 1]', () => {
    for (const theta of [0, -0.2, 1.5, Number.NaN]) {
      expect(
        codeOf(() =>
          denominatorFor({ valueBasis: 'fairValue', pricePerShare: PPS, exercisePrice: 10, theta }),
        ),
        `theta ${theta} was accepted`,
      ).toBe('thetaOutOfRange');
    }
  });

  it('refuses a price per share at or below zero', () => {
    expect(
      codeOf(() =>
        denominatorFor({ valueBasis: 'notional', pricePerShare: 0, exercisePrice: 10 }),
      ),
    ).toBe('nonPositivePricePerShare');
  });

  it('refuses an exercise price at or above the price per share under the realisable basis', () => {
    for (const exercisePrice of [PPS, PPS + 1, PPS * 2]) {
      expect(
        codeOf(() => denominatorFor({ valueBasis: 'realisable', pricePerShare: PPS, exercisePrice })),
        `an exercise price of ${exercisePrice} was accepted`,
      ).toBe('degenerateRealisableSpread');
    }
  });

  it('guards the realisable spread at a fixed fraction of the price per share', () => {
    const threshold = PPS * MIN_REALISABLE_SPREAD_FRACTION_OF_PPS;

    expect(
      codeOf(() =>
        denominatorFor({
          valueBasis: 'realisable',
          pricePerShare: PPS,
          exercisePrice: PPS - threshold,
        }),
      ),
    ).toBe('degenerateRealisableSpread');

    expect(
      denominatorFor({
        valueBasis: 'realisable',
        pricePerShare: PPS,
        exercisePrice: PPS - threshold * 10,
      }),
    ).toBeCloseTo(threshold * 10, 12);
  });
});

describe('denominator from the strike policy in one step', () => {
  it('agrees with computing the exercise price first', () => {
    const strikePolicy: StrikePolicy = { kind: 'discountToFMV', discountPct: 30 };

    const exercisePrice = exercisePriceAtYear({
      strikePolicy,
      pricePerShare: PPS,
      faceValuePerShare: FACE_VALUE,
    });

    expect(
      denominatorForYear({
        valueBasis: 'realisable',
        strikePolicy,
        pricePerShare: PPS,
        faceValuePerShare: FACE_VALUE,
      }),
    ).toBe(denominatorFor({ valueBasis: 'realisable', pricePerShare: PPS, exercisePrice }));
  });
});

describe('all three bases at once', () => {
  it('prices every basis at a face value strike, notional above realisable', () => {
    const outcomes = allDenominatorsForYear({
      strikePolicy: { kind: 'faceValue' },
      pricePerShare: PPS,
      faceValuePerShare: FACE_VALUE,
    });

    expect(outcomes.notional.ok && outcomes.realisable.ok && outcomes.fairValue.ok).toBe(true);
    if (!outcomes.notional.ok || !outcomes.realisable.ok || !outcomes.fairValue.ok) return;

    expect(outcomes.notional.denominator).toBe(PPS);
    expect(outcomes.realisable.denominator).toBe(PPS - FACE_VALUE);
    expect(outcomes.fairValue.denominator).toBe(PPS * DEFAULT_THETA);
    expect(outcomes.realisable.denominator).toBeLessThan(outcomes.notional.denominator);
  });

  it('carries the exercise price on every outcome, priced or not', () => {
    const outcomes = allDenominatorsForYear({
      strikePolicy: { kind: 'lastRoundPrice' },
      pricePerShare: PPS,
      faceValuePerShare: FACE_VALUE,
    });

    expect(outcomes.notional.exercisePrice).toBe(PPS);
    expect(outcomes.realisable.exercisePrice).toBe(PPS);
    expect(outcomes.fairValue.exercisePrice).toBe(PPS);
  });
});
