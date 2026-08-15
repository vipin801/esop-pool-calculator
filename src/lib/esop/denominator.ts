/**
 * ESOP pool engine — the denominator, by strike policy.
 *
 * ENGINE_SPEC.md section 2. Under Basis B, what you divide the rupee grant
 * value by depends on what "grant value" is being promised:
 *
 *   notional    D_t = PPS_t                 most Indian offer letters
 *   realisable  D_t = PPS_t - X_t           what the employee actually banks
 *   fairValue   D_t = theta_t * PPS_t       Ind AS 102
 *
 * X_t is the exercise price at grant, set by `strikePolicy`. Indian practice
 * has converged on face value at early stage and the last round price at growth
 * stage, with a discount to FMV as the third pole. The Companies Act leaves the
 * exercise price to the company subject to accounting standards, with face
 * value the practical floor, so face value is applied as a floor to every
 * policy rather than only to the discount case.
 *
 * The realisable basis has a hole in it: set the strike at the last round price
 * and PPS_t - X_t is zero. The engine raises a typed error there rather than
 * dividing by something near zero and reporting a pool of several million
 * percent. That is exactly the case the spec calls out — fair value is "the
 * only honest basis when the strike is set at the last round price".
 */

import { DEFAULTS } from './defaults';
import { EsopEngineError, requireFinite, requirePositive } from './errors';
import type { StrikePolicy, ValueBasis } from './types';

/**
 * theta. Black-Scholes value ratio for a 4 year expected life, 60% volatility,
 * strike at FMV. Spec section 2. Approaches 1 as the strike approaches zero.
 */
export const DEFAULT_THETA: number = DEFAULTS.theta.value;

/**
 * The realisable spread must clear this fraction of PPS_t before the engine
 * will divide by it.
 *
 * This is a numeric guard, not a market judgement, so it carries no provenance
 * tag under model decision M3 — the same reasoning that keeps the solver
 * parameters out of the defaults table. It says nothing about whether a thin
 * spread is a good idea; it only refuses to divide by nothing.
 */
export const MIN_REALISABLE_SPREAD_FRACTION_OF_PPS = 1e-6;

/**
 * theta * PPS_t: the Black-Scholes-style fair value of one option.
 *
 * Spec section 2 names this `D_t` under the fair value basis. Ind AS 102 uses
 * the identical expression, in compliance.ts, to value a grant for the annual
 * expense estimate — the same quantity behind two different questions, "how
 * many options does this rupee buy" and "what does this option cost the P&L".
 * It used to be written out independently in both files, and their theta
 * guards had drifted apart: this one rejected theta outside `(0, 1]`, the
 * expense path only rejected theta below zero, so `theta = 0` and
 * `theta = 1.5` passed one call site and were refused by the other for
 * arithmetic that is, character for character, the same multiplication.
 *
 * The domain is `(0, 1]`, the stricter of the two guards that existed before
 * this. Theta is a value ratio — what one option is worth divided by what one
 * share is worth — and section 2 says it "approaches 1 as the strike
 * approaches zero", which only reads as a ceiling if 1 is the top of the
 * range theta can take. A ratio at or below zero prices an option at nothing
 * or less, which is not a fair value Ind AS 102 lets a company book, so zero
 * is excluded along with everything negative. Both callers now reject the
 * same values with the same code, because both call this function rather than
 * repeating its arithmetic or its guard.
 */
export function thetaScaledFairValue(args: {
  readonly theta: number;
  readonly pricePerShare: number;
}): number {
  const { theta, pricePerShare } = args;

  if (!Number.isFinite(theta) || theta <= 0 || theta > 1) {
    throw new EsopEngineError(
      'thetaOutOfRange',
      'Theta is the value ratio of an option to a share and must sit in (0, 1]. It approaches 1 as the strike approaches zero.',
      { theta },
    );
  }

  return theta * pricePerShare;
}

/**
 * X_t, the exercise price for options granted in year t.
 *
 * `lastRoundPrice` uses the modelled PPS_t for that year, which is the price of
 * the most recent round on the modelled path. Face value is applied as a floor
 * throughout, because shares cannot be issued below par.
 */
export function exercisePriceAtYear(args: {
  readonly strikePolicy: StrikePolicy;
  readonly pricePerShare: number;
  readonly faceValuePerShare: number;
}): number {
  const { strikePolicy, pricePerShare, faceValuePerShare } = args;

  requirePositive(
    pricePerShare,
    'nonPositivePricePerShare',
    'Price per share must be above zero to set an exercise price.',
  );
  requirePositive(
    faceValuePerShare,
    'invalidMoneyAmount',
    'Face value per share must be above zero. It is the practical floor on the exercise price.',
  );

  switch (strikePolicy.kind) {
    case 'faceValue':
      return faceValuePerShare;
    case 'lastRoundPrice':
      return Math.max(pricePerShare, faceValuePerShare);
    case 'discountToFMV': {
      requireFinite(
        strikePolicy.discountPct,
        'invalidMoneyAmount',
        'The discount to FMV must be a finite percentage.',
      );
      const discounted = pricePerShare * (1 - strikePolicy.discountPct / 100);
      return Math.max(discounted, faceValuePerShare);
    }
  }
}

/**
 * D_t for one value basis.
 *
 * `exercisePrice` is only read under the realisable basis and `theta` only
 * under fair value, but both are taken up front so that a caller cannot compute
 * one basis while forgetting what the other two would have needed.
 */
export function denominatorFor(args: {
  readonly valueBasis: ValueBasis;
  readonly pricePerShare: number;
  readonly exercisePrice: number;
  readonly theta?: number;
}): number {
  const { valueBasis, pricePerShare, exercisePrice, theta = DEFAULT_THETA } = args;

  requirePositive(
    pricePerShare,
    'nonPositivePricePerShare',
    'Price per share must be above zero to convert a rupee grant into options.',
  );

  switch (valueBasis) {
    case 'notional':
      return pricePerShare;

    case 'realisable': {
      requirePositive(
        exercisePrice,
        'invalidMoneyAmount',
        'The exercise price must be above zero under the realisable basis.',
      );
      const spread = pricePerShare - exercisePrice;
      if (spread <= pricePerShare * MIN_REALISABLE_SPREAD_FRACTION_OF_PPS) {
        throw new EsopEngineError(
          'degenerateRealisableSpread',
          'The exercise price is at or above the price per share, so there is no realisable spread to divide by. Use the fair value basis when the strike is set at the last round price.',
          { pricePerShare, exercisePrice, spread },
        );
      }
      return spread;
    }

    case 'fairValue':
      return thetaScaledFairValue({ theta, pricePerShare });
  }
}

/** D_t for one value basis, deriving X_t from the strike policy first. */
export function denominatorForYear(args: {
  readonly valueBasis: ValueBasis;
  readonly strikePolicy: StrikePolicy;
  readonly pricePerShare: number;
  readonly faceValuePerShare: number;
  readonly theta?: number;
}): number {
  const { valueBasis, strikePolicy, pricePerShare, faceValuePerShare, theta } = args;

  const exercisePrice = exercisePriceAtYear({ strikePolicy, pricePerShare, faceValuePerShare });

  return denominatorFor({ valueBasis, pricePerShare, exercisePrice, theta });
}

/**
 * One basis either priced or refused, with the reason.
 *
 * The spec wants all three bases computed and notional shown above realisable.
 * One of the three can legitimately be undefined for a given strike policy, so
 * the refusal is carried as data rather than thrown away or thrown at the UI.
 */
export type DenominatorOutcome =
  | {
      readonly ok: true;
      readonly valueBasis: ValueBasis;
      readonly exercisePrice: number;
      readonly denominator: number;
    }
  | {
      readonly ok: false;
      readonly valueBasis: ValueBasis;
      readonly exercisePrice: number;
      readonly error: EsopEngineError;
    };

/** All three bases at once, per section 2's "compute all three value bases". */
export function allDenominatorsForYear(args: {
  readonly strikePolicy: StrikePolicy;
  readonly pricePerShare: number;
  readonly faceValuePerShare: number;
  readonly theta?: number;
}): Readonly<Record<ValueBasis, DenominatorOutcome>> {
  const { strikePolicy, pricePerShare, faceValuePerShare, theta } = args;

  const exercisePrice = exercisePriceAtYear({ strikePolicy, pricePerShare, faceValuePerShare });

  const outcome = (valueBasis: ValueBasis): DenominatorOutcome => {
    try {
      return {
        ok: true,
        valueBasis,
        exercisePrice,
        denominator: denominatorFor({ valueBasis, pricePerShare, exercisePrice, theta }),
      };
    } catch (error) {
      if (error instanceof EsopEngineError) {
        return { ok: false, valueBasis, exercisePrice, error };
      }
      throw error;
    }
  };

  return {
    notional: outcome('notional'),
    realisable: outcome('realisable'),
    fairValue: outcome('fairValue'),
  };
}
