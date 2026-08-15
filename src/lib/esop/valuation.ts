/**
 * ESOP pool engine — valuation and price per share.
 *
 * ENGINE_SPEC.md section 3:
 *
 *   FD_t   fully diluted shares at end of year t, including the unallocated pool
 *   V_t    post-money valuation
 *   PPS_t  V_t / FD_t
 *
 * The dependency that matters is the second half of that last line. Price per
 * share is not a founder input; it falls out of the valuation divided by the
 * fully diluted count, and the fully diluted count contains the pool. Grow the
 * pool and the price per share drops, which under Basis B raises the option
 * count each rupee of grant buys, which grows the pool again. That circularity
 * is what makes section 4.5 a fixed point rather than a formula.
 *
 * So FD_t is taken as an argument here, never assumed constant and never
 * derived internally. The caller owns the share count; this module only prices
 * it.
 */

import {
  EsopEngineError,
  requireFinite,
  requirePositive,
  requireYearIndex,
} from './errors';

/**
 * One year of the market path.
 *
 * Year indices are zero-based: year 0 is the first plan year, priced at today's
 * post-money valuation, matching `(1+i)^t` in section 4.1 leaving grant values
 * uninflated in the first year.
 */
export interface MarketYear {
  /** t. */
  readonly year: number;
  /** V_t. */
  readonly valuation: number;
  /** FD_t, including the unallocated pool. */
  readonly fullyDilutedShares: number;
  /** PPS_t. */
  readonly pricePerShare: number;
}

/** V_t = V_0 * (1 + g)^t. */
export function valuationAtYear(args: {
  readonly postMoneyValuation: number;
  readonly growthPctPerYear: number;
  readonly year: number;
}): number {
  const { postMoneyValuation, growthPctPerYear, year } = args;

  requireYearIndex(year);
  requirePositive(
    postMoneyValuation,
    'nonPositiveValuation',
    'Post-money valuation must be above zero to price a share.',
  );
  requireFinite(
    growthPctPerYear,
    'nonPositiveGrowthFactor',
    'Valuation growth must be a finite percentage.',
  );

  const growthFactor = 1 + growthPctPerYear / 100;
  if (growthFactor <= 0) {
    throw new EsopEngineError(
      'nonPositiveGrowthFactor',
      'Valuation growth at or below -100% leaves no company to price.',
      { growthPctPerYear },
    );
  }

  return postMoneyValuation * growthFactor ** year;
}

/**
 * PPS_t = V_t / FD_t.
 *
 * FD_t includes the unallocated pool, so a bigger pool means a lower price per
 * share for the same valuation.
 */
export function pricePerShare(args: {
  readonly valuation: number;
  readonly fullyDilutedShares: number;
}): number {
  const { valuation, fullyDilutedShares } = args;

  requirePositive(valuation, 'nonPositiveValuation', 'Valuation must be above zero to price a share.');
  requirePositive(
    fullyDilutedShares,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero to price a share.',
  );

  return valuation / fullyDilutedShares;
}

/** One year of the path: grow the valuation, then divide by that year's share count. */
export function marketYear(args: {
  readonly postMoneyValuation: number;
  readonly growthPctPerYear: number;
  readonly year: number;
  readonly fullyDilutedShares: number;
}): MarketYear {
  const { postMoneyValuation, growthPctPerYear, year, fullyDilutedShares } = args;

  const valuation = valuationAtYear({ postMoneyValuation, growthPctPerYear, year });

  return {
    year,
    valuation,
    fullyDilutedShares,
    pricePerShare: pricePerShare({ valuation, fullyDilutedShares }),
  };
}

/**
 * The whole path, one entry per year.
 *
 * `fullyDilutedSharesByYear` is indexed from year 0 and is supplied by the
 * caller, because FD_t depends on how much of the pool has been granted and
 * exercised by year t. This module does not guess it.
 */
export function buildMarketPath(args: {
  readonly postMoneyValuation: number;
  readonly growthPctPerYear: number;
  readonly fullyDilutedSharesByYear: readonly number[];
}): readonly MarketYear[] {
  const { postMoneyValuation, growthPctPerYear, fullyDilutedSharesByYear } = args;

  return fullyDilutedSharesByYear.map((fullyDilutedShares, year) =>
    marketYear({ postMoneyValuation, growthPctPerYear, year, fullyDilutedShares }),
  );
}
