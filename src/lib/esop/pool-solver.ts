/**
 * ESOP pool engine — the recommended pool, as a fixed point.
 *
 * ENGINE_SPEC.md section 4.5:
 *
 *   K = (sum_t (N_t + R_t - Returned_t)) * (1 + buffer)
 *   pool% = (K - existingUnallocated) / (FD_0 + max(0, K - existingUnallocated))
 *
 *   K depends on PPS_t, which depends on FD_t, which contains the pool. Iterate
 *   from 10%, tolerance 0.01 percentage points, max 25 iterations, return the
 *   iteration count. Round the displayed figure up to the nearest 0.5%.
 *
 * The circularity is real under both bases and for different reasons, which is
 * why the spec spells out that it still applies under Basis A. Under Basis B a
 * bigger pool means more shares, a lower price per share, and so more options
 * bought by the same rupee grant. Under Basis A a bigger pool means a bigger
 * FD_t, and pct_b is applied straight to FD_t. Either way, guessing the pool
 * changes the answer, so the answer has to be solved for rather than computed.
 *
 * Three promises this file keeps, in order of how badly breaking them would
 * hurt:
 *
 * 1. **It never spins.** The loop is a bounded `for`. There is no `while (true)`
 *    and no recursion, so a pathological input costs 25 path runs and then
 *    stops, flagged.
 * 2. **A non-converged run still returns a number.** The last iterate that was
 *    finite and in range comes back with `converged: false`. A founder gets a
 *    figure and a warning, not an exception and a blank screen.
 * 3. **The percentage and the option count are one pool.** After the loop the
 *    path is run once more, the option count comes off that single run, and the
 *    percentage is computed from the option count by the spec's own formula, so
 *    the two cannot describe different pools. This promise used to be worded to
 *    cover the roll forward as well, and that part was not true: the returned
 *    run is priced at the converged *iterate*, which sits within the spec's 0.01
 *    point tolerance of the reported answer rather than exactly on it. It is not
 *    claimed here now. On a non-converged run there is no gap at all, because
 *    the level leads and the run is at exactly that level.
 */

import { SOLVER } from './defaults';
import { requireFinite, requireNonNegative, requirePositive } from './errors';
import { runRollForward, type RollForwardArgs, type RollForwardResult } from './roll-forward';
import type {
  GrantBasis,
  GrantPolicyInputs,
  PoolSizing,
  RecommendedPool,
  SolverDiagnostics,
  ValueBasis,
} from './types';

/**
 * The iterate is capped short of 100%, where `FD_0 * p / (100 - p)` runs away.
 * A plan that wants 99.9% of the company as an option pool has already told us
 * something is wrong with its inputs; the cap is there so the solver reports
 * that rather than dividing by nothing on the way to reporting it.
 */
const MAX_POOL_PCT = 99.9;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function nonNegative(value: number): number {
  return value > 0 ? value : 0;
}

/**
 * Round up to the nearest half point, per the last line of section 4.5. This is
 * a display rule, so it is applied to a copy and never fed back into the maths.
 */
export function roundPoolPctForDisplay(
  poolPct: number,
  step: number = SOLVER.displayRoundingPctPoints,
): number {
  requirePositive(step, 'invalidMoneyAmount', 'The display rounding step must be above zero.');
  requireFinite(poolPct, 'invalidMoneyAmount', 'A pool percentage must be finite to round it.');

  return Math.ceil(poolPct / step) * step;
}

/**
 * The options a candidate pool percentage adds to the company.
 *
 * `p` is the new pool measured against the *expanded* fully diluted count, per
 * the spec's denominator, so inverting it gives `FD_0 * p / (100 - p)` rather
 * than `FD_0 * p / 100`.
 */
export function poolOptionsForPct(args: {
  readonly fullyDilutedSharesAtYear0: number;
  readonly poolPct: number;
}): number {
  const { fullyDilutedSharesAtYear0, poolPct } = args;

  requirePositive(
    fullyDilutedSharesAtYear0,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero to size a pool against them.',
  );

  const p = clamp(poolPct, 0, MAX_POOL_PCT);

  return (fullyDilutedSharesAtYear0 * p) / (100 - p);
}

/* ------------------------------------------------------------------------- *
 * The solution
 * ------------------------------------------------------------------------- */

export interface RecommendedPoolSolution {
  readonly sizing: PoolSizing;
  readonly solver: SolverDiagnostics;
  /** K, before the existing pool is netted off. */
  readonly bufferedRequirementOptions: number;
  /** sum_t (N_t + R_t - Returned_t), floored at zero. */
  readonly netConsumptionOptions: number;
  readonly grossConsumptionOptions: number;
  readonly returnedToPoolOptions: number;
  /** FD_0 once the recommended pool has been added to it. */
  readonly fullyDilutedSharesAtYear0: number;
  /** True when the existing unallocated pool already covers K. */
  readonly existingPoolIsEnough: boolean;
  /** The roll forward that produced the answer, run at the answer. */
  readonly rollForward: RollForwardResult;
}

/**
 * The same inputs the roll forward takes, with two of them under the solver's
 * control rather than the caller's: `fullyDilutedSharesAtStart` is read once as
 * FD_0 and then overwritten on every turn with FD_0 plus the candidate pool, and
 * `openingAvailableOptions` is overwritten with the existing pool plus the same
 * candidate. Setting the second has no effect; the existing pool comes from
 * `company.existingUnallocatedOptions`, which is what the spec's formula nets
 * against K.
 */
export type SolveRecommendedPoolArgs = RollForwardArgs;

function valueBasisFor(grantPolicy: GrantPolicyInputs): ValueBasis | null {
  return grantPolicy.grantBasis.kind === 'percentOfEquity' ? null : grantPolicy.valueBasis;
}

/**
 * One turn of the crank: given a candidate pool percentage, what percentage does
 * the model come back with?
 *
 * The candidate is materialised as options, added to both the fully diluted
 * count and the opening pool, and the whole plan is run against it. That is the
 * only place the guess enters, and the spec's two formulae are applied to the
 * result exactly as written.
 */
function stepOnce(args: {
  readonly base: RollForwardArgs;
  readonly poolPct: number;
}): { readonly nextPoolPct: number; readonly run: RollForwardResult; readonly newOptions: number } {
  const { base, poolPct } = args;

  const fd0 = base.fullyDilutedSharesAtStart ?? base.company.fullyDilutedShares;
  const existingUnallocated = base.company.existingUnallocatedOptions;
  const newOptions = poolOptionsForPct({ fullyDilutedSharesAtYear0: fd0, poolPct });

  const run = runRollForward({
    ...base,
    fullyDilutedSharesAtStart: fd0 + newOptions,
    openingAvailableOptions: existingUnallocated + newOptions,
  });

  /**
   * Net consumption is floored at zero. Returns can outrun a thin hiring plan
   * when a large book of existing grants churns, and "the plan consumed less
   * than nothing" is not a pool size — it is the answer that no top-up is
   * needed, which the next line already expresses as a percentage of zero.
   */
  const netConsumption = nonNegative(
    run.totalGrossConsumptionOptions - run.totalReturnedToPool,
  );
  const bufferedRequirement = netConsumption * (1 + base.grantPolicy.bufferPct / 100);
  const topUpOptions = bufferedRequirement - existingUnallocated;

  const nextPoolPct = (topUpOptions / (fd0 + nonNegative(topUpOptions))) * 100;

  return { nextPoolPct, run, newOptions };
}

/**
 * Solve for the recommended pool. Spec section 4.5, output item 1.
 *
 * Starts at 10%, stops when two consecutive iterates sit within 0.01 percentage
 * points of each other, and gives up after 25 iterations with the last stable
 * value and `converged: false`.
 */
export function solveRecommendedPool(args: SolveRecommendedPoolArgs): RecommendedPoolSolution {
  const fd0 = args.fullyDilutedSharesAtStart ?? args.company.fullyDilutedShares;

  requirePositive(
    fd0,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero to recommend a pool.',
  );
  requireNonNegative(
    args.company.existingUnallocatedOptions,
    'negativeShareCount',
    'The existing unallocated pool cannot be negative.',
  );

  const base: RollForwardArgs = { ...args, fullyDilutedSharesAtStart: fd0 };

  let poolPct: number = SOLVER.startPoolPct;
  let iterations = 0;
  let converged = false;

  for (let iteration = 1; iteration <= SOLVER.maxIterations; iteration += 1) {
    iterations = iteration;

    const { nextPoolPct } = stepOnce({ base, poolPct });

    /**
     * Two ways out that are not convergence, both leaving `poolPct` on the last
     * value the model actually stood on:
     *
     * - a non-finite iterate, which is where the model stopped being a model;
     * - an iterate past the cap, which means the plan grants away more of the
     *   company than exists and there is no fixed point in range. Clamping to
     *   the cap and calling it converged would report 99.9% as an answer rather
     *   than as a failure, which is the one outcome worse than not converging.
     */
    if (!Number.isFinite(nextPoolPct) || nextPoolPct > MAX_POOL_PCT) break;

    /**
     * The floor is different, and is a real answer rather than a guard. The
     * spec's numerator is unclamped, so a company whose existing pool already
     * covers the plan produces a negative percentage; zero is what that means.
     */
    const clamped = nonNegative(nextPoolPct);
    const moved = Math.abs(clamped - poolPct);
    poolPct = clamped;

    if (moved <= SOLVER.tolerancePctPoints) {
      converged = true;
      break;
    }
  }

  /** Run the plan once more at the answer, so nothing reported can disagree. */
  const final = stepOnce({ base, poolPct });
  const existingUnallocated = args.company.existingUnallocatedOptions;
  const netConsumption = nonNegative(
    final.run.totalGrossConsumptionOptions - final.run.totalReturnedToPool,
  );
  const bufferedRequirement = netConsumption * (1 + args.grantPolicy.bufferPct / 100);

  /**
   * The recommended pool, in options, from the one final run — and then the
   * percentage from those options, rather than from the loop.
   *
   * Section 7 item 1 asks for the pool "in % of fully diluted and in options".
   * One pool, two units, so one of them has to be computed from the other.
   * Reporting the last iterate as the percentage while recomputing the options
   * from the final run gave two fields describing two pools up to the spec's
   * 0.01 point tolerance, which is what AUDIT_P4 defect 2 measured.
   *
   * Which is primary follows the spec: section 4.5 computes `K` first and the
   * percentage from it, so the option count leads and the percentage is
   * `(K - existing) / (FD_0 + max(0, K - existing))`, exactly as written.
   *
   * On a non-converged run there is no such state — the requirement and the
   * level disagree, which is what non-convergence *means* — so the pool level
   * the model last stood on leads instead, and the options are the options at
   * that level. Either way the two are one pool. M23.
   */
  const poolOptions = converged
    ? nonNegative(bufferedRequirement - existingUnallocated)
    : poolOptionsForPct({ fullyDilutedSharesAtYear0: fd0, poolPct });
  const recommendedPoolPct = (poolOptions / (fd0 + poolOptions)) * 100;

  return {
    sizing: {
      grantBasisKind: args.grantPolicy.grantBasis.kind,
      strikePolicyKind: args.grantPolicy.strikePolicy.kind,
      valueBasis: valueBasisFor(args.grantPolicy),
      poolPctOfFullyDiluted: recommendedPoolPct,
      poolOptions,
      displayPoolPctOfFullyDiluted: roundPoolPctForDisplay(recommendedPoolPct),
    },
    solver: {
      iterations,
      converged,
      tolerancePctPoints: SOLVER.tolerancePctPoints,
      maxIterations: SOLVER.maxIterations,
    },
    bufferedRequirementOptions: bufferedRequirement,
    netConsumptionOptions: netConsumption,
    grossConsumptionOptions: final.run.totalGrossConsumptionOptions,
    returnedToPoolOptions: final.run.totalReturnedToPool,
    fullyDilutedSharesAtYear0: fd0 + poolOptions,
    /**
     * Only claimable on a converged run. On a non-converged one `poolOptions` is
     * the level the loop stopped at rather than the plan's requirement, so a
     * zero there says the loop stopped at zero, not that the existing pool
     * covers the plan.
     */
    existingPoolIsEnough: converged && poolOptions === 0,
    rollForward: final.run,
  };
}

/**
 * Output item 1: the recommended pool under the selected basis, and the same
 * figure under the other one.
 *
 * The comparison basis has to be supplied, because `GrantBasis` is a union and
 * the selected arm carries only its own grant table. A percent-of-equity plan
 * simply does not hold the rupee figures the comparison needs, which is the
 * union doing its job rather than a gap.
 */
export function recommendedPoolUnderBothBases(args: {
  readonly inputs: SolveRecommendedPoolArgs;
  readonly comparisonGrantBasis: GrantBasis;
}): {
  readonly recommendedPool: RecommendedPool;
  readonly selected: RecommendedPoolSolution;
  readonly comparison: RecommendedPoolSolution;
} {
  const { inputs, comparisonGrantBasis } = args;

  const selected = solveRecommendedPool(inputs);
  const comparison = solveRecommendedPool({
    ...inputs,
    grantPolicy: { ...inputs.grantPolicy, grantBasis: comparisonGrantBasis },
  });

  return {
    recommendedPool: { selected: selected.sizing, comparison: comparison.sizing },
    selected,
    comparison,
  };
}
