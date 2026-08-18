/**
 * design.md §5.1: four hero states, derived only from what `calculateEsopPool`
 * already returns on the frozen public surface (M32) — nothing here reaches
 * into an engine internal. `existingPoolIsEnough` itself is not on that
 * surface (it lives on `RecommendedPoolSolution` in pool-solver.ts), but its
 * condition is: on a converged run the top-up is `nonNegative(bufferedRequirement
 * - existingUnallocated)` (pool-solver.ts), so a converged run reporting a
 * zero top-up is exactly "the existing pool already covers the plan".
 */
import type { EsopInputs, EsopResult } from '@/lib/esop';

export type HeroState = 'normal' | 'adequate' | 'extreme';

export function heroStateFor(result: EsopResult): HeroState {
  if (!result.solver.converged) return 'extreme';

  const hasExistingPool = result.current.openingPoolOptions > 0;
  if (hasExistingPool && result.recommendedPool.selected.poolOptions === 0) return 'adequate';

  return 'normal';
}

/**
 * design.md §5.1's soft-warning: converged, but well above the advisory
 * ceiling for the founder's stage. 1.5x is a threshold, not a second
 * severity the engine computes — a converged answer is never wrong, this
 * only flags "unusual, worth a second look" short of the full extreme-state
 * treatment reserved for a non-converged run.
 */
const SOFT_WARNING_MULTIPLE = 1.5;

export function isAboveAdvisoryCeiling(result: EsopResult): boolean {
  const advisory = result.benchmarkComparison.tracks.find((t) => t.trackId === 'advisory');
  if (!advisory?.band) return false;
  return result.recommended.openingPoolPctOfFullyDiluted > advisory.band.highPct * SOFT_WARNING_MULTIPLE;
}

/**
 * The extreme state's "largest drivers" line (master brief §19). A precise
 * per-field ranking against `DEFAULTS` would need a default for every
 * numeric field including ones with no natural scalar baseline (a hiring
 * plan's total headcount, say) — fragile to build and easy to mis-rank.
 * This is deliberately a plain-language, unranked disclosure of the handful
 * of levers that can actually push a plan out of range, not a scored top-N:
 * honest about what it is, per design.md's own caution against inventing
 * false precision.
 */
export function likelyDrivers(inputs: EsopInputs): readonly string[] {
  const drivers: string[] = [];
  const totalHires = inputs.hiring.hiresPerYear.reduce((sum, n) => sum + Math.max(0, n), 0);

  if (inputs.grantPolicy.grantBasis.kind === 'rupeeValue') {
    drivers.push('₹ grant values');
    if (inputs.growth.valuationGrowthPctPerYear > 0 && inputs.company.postMoneyValuation > 0) {
      drivers.push('current valuation and its growth');
    }
  } else {
    drivers.push('percent-of-equity grant sizes');
  }
  if (totalHires > 0) drivers.push('planned hiring');
  if (inputs.grantPolicy.bufferPct > 0) drivers.push('the buffer for unplanned hires');
  if (inputs.hiring.horizonYears > 0) drivers.push('the planning horizon');

  return drivers;
}
