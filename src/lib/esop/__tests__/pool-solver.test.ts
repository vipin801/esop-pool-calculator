/**
 * ENGINE_SPEC.md section 4.5, the fixed point.
 *
 *   K = (sum_t (N_t + R_t - Returned_t)) * (1 + buffer)
 *   pool% = (K - existingUnallocated) / (FD_0 + max(0, K - existingUnallocated))
 *
 * Three things are being checked here and they are not the same thing. That the
 * answer is a *fixed point* — feed it back in and it comes out again. That the
 * loop *terminates*, including on inputs that have no answer. And that the
 * answer *moves in the right direction* when a modelling switch is flipped,
 * which is the only one of the three a founder would ever notice.
 */

import { describe, expect, it } from 'vitest';

import { SOLVER } from '../defaults';
import { isEsopEngineError } from '../errors';
import {
  poolOptionsForPct,
  recommendedPoolUnderBothBases,
  roundPoolPctForDisplay,
  solveRecommendedPool,
} from '../pool-solver';
import { runRollForward } from '../roll-forward';
import { BASIS_A, BASIS_B, withArgs } from './fixtures';
import { randomCases } from './random-inputs';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return isEsopEngineError(error) ? error.code : 'not an EsopEngineError';
  }
  return 'nothing thrown';
}

describe('the solver parameters are the ones the spec names', () => {
  it('starts at 10%, tolerates 0.01 points, and stops at 25', () => {
    expect(SOLVER.startPoolPct).toBe(10);
    expect(SOLVER.tolerancePctPoints).toBe(0.01);
    expect(SOLVER.maxIterations).toBe(25);
  });
});

describe('the answer is a fixed point', () => {
  for (const [label, basis] of [
    ['percent of equity', BASIS_A],
    ['rupee value', BASIS_B],
  ] as const) {
    it(`reproduces itself when fed back in: ${label}`, () => {
      const args = withArgs({ grantPolicy: { grantBasis: basis } });
      const solution = solveRecommendedPool(args);

      expect(solution.solver.converged).toBe(true);

      // Re-derive the spec's two formulae from the roll forward the solver
      // returned, at the pool it recommended, and land back on the same figure.
      const net = Math.max(
        solution.rollForward.totalGrossConsumptionOptions -
          solution.rollForward.totalReturnedToPool,
        0,
      );
      const k = net * (1 + args.grantPolicy.bufferPct / 100);
      const topUp = k - args.company.existingUnallocatedOptions;
      const reDerived =
        (topUp / (args.company.fullyDilutedShares + Math.max(0, topUp))) * 100;

      expect(reDerived).toBeCloseTo(solution.sizing.poolPctOfFullyDiluted, 2);
    });
  }

  it('adds the recommended options to the fully diluted count it priced against', () => {
    const solution = solveRecommendedPool(withArgs({}));

    expect(solution.fullyDilutedSharesAtYear0).toBeCloseTo(
      10_000_000 +
        poolOptionsForPct({
          fullyDilutedSharesAtYear0: 10_000_000,
          poolPct: solution.sizing.poolPctOfFullyDiluted,
        }),
      6,
    );
  });

  it('reports the option count and the percentage from the same run', () => {
    const solution = solveRecommendedPool(withArgs({}));

    expect(solution.sizing.poolOptions).toBeCloseTo(
      solution.bufferedRequirementOptions - 600_000,
      6,
    );
    expect(solution.netConsumptionOptions).toBeCloseTo(
      solution.grossConsumptionOptions - solution.returnedToPoolOptions,
      6,
    );
  });
});

describe('the iteration count comes back out, as the spec requires', () => {
  it('is at least one and never past the maximum', () => {
    const solution = solveRecommendedPool(withArgs({}));

    expect(solution.solver.iterations).toBeGreaterThanOrEqual(1);
    expect(solution.solver.iterations).toBeLessThanOrEqual(SOLVER.maxIterations);
    expect(solution.solver.maxIterations).toBe(25);
    expect(solution.solver.tolerancePctPoints).toBe(0.01);
  });
});

describe('recycling', () => {
  it('off produces a strictly larger recommended pool than on, all else equal', () => {
    const on = solveRecommendedPool(withArgs({ exercise: { recycleForfeited: true } }));
    const off = solveRecommendedPool(withArgs({ exercise: { recycleForfeited: false } }));

    expect(on.solver.converged).toBe(true);
    expect(off.solver.converged).toBe(true);
    expect(off.sizing.poolPctOfFullyDiluted).toBeGreaterThan(on.sizing.poolPctOfFullyDiluted);
    expect(off.sizing.poolOptions).toBeGreaterThan(on.sizing.poolOptions);
    expect(on.returnedToPoolOptions).toBeGreaterThan(0);
    expect(off.returnedToPoolOptions).toBe(0);
  });

  it('holds under the rupee value basis too', () => {
    const on = solveRecommendedPool(
      withArgs({ grantPolicy: { grantBasis: BASIS_B }, exercise: { recycleForfeited: true } }),
    );
    const off = solveRecommendedPool(
      withArgs({ grantPolicy: { grantBasis: BASIS_B }, exercise: { recycleForfeited: false } }),
    );

    expect(off.sizing.poolPctOfFullyDiluted).toBeGreaterThan(on.sizing.poolPctOfFullyDiluted);
  });

  it('makes no difference when nobody ever leaves, because nothing is forfeited', () => {
    const noAttrition = { baseAnnualPct: 0, byBand: {} };
    const on = solveRecommendedPool(
      withArgs({ attrition: noAttrition, exercise: { recycleForfeited: true } }),
    );
    const off = solveRecommendedPool(
      withArgs({ attrition: noAttrition, exercise: { recycleForfeited: false } }),
    );

    expect(off.sizing.poolPctOfFullyDiluted).toBeCloseTo(on.sizing.poolPctOfFullyDiluted, 9);
  });
});

describe('the edges terminate and stay finite', () => {
  it('at 100% attrition', () => {
    const solution = solveRecommendedPool(withArgs({ attrition: { baseAnnualPct: 100, byBand: {} } }));

    expect(Number.isFinite(solution.sizing.poolPctOfFullyDiluted)).toBe(true);
    expect(Number.isFinite(solution.sizing.poolOptions)).toBe(true);
    expect(solution.sizing.poolPctOfFullyDiluted).toBeGreaterThanOrEqual(0);
    expect(solution.solver.iterations).toBeLessThanOrEqual(25);
  });

  it('at 0% attrition, where the pool has to be bigger because nothing returns', () => {
    const none = solveRecommendedPool(withArgs({ attrition: { baseAnnualPct: 0, byBand: {} } }));
    const some = solveRecommendedPool(withArgs({}));

    expect(Number.isFinite(none.sizing.poolPctOfFullyDiluted)).toBe(true);
    expect(none.sizing.poolPctOfFullyDiluted).toBeGreaterThan(some.sizing.poolPctOfFullyDiluted);
  });

  it('with no hiring plan at all, where the answer is no pool', () => {
    const solution = solveRecommendedPool(
      withArgs({ hiring: { horizonYears: 4, hiresPerYear: [0, 0, 0, 0] } }),
    );

    expect(solution.sizing.poolPctOfFullyDiluted).toBe(0);
    expect(solution.sizing.poolOptions).toBe(0);
    expect(solution.existingPoolIsEnough).toBe(true);
    expect(solution.solver.converged).toBe(true);
  });

  it('when the existing pool already covers the plan', () => {
    const solution = solveRecommendedPool(
      withArgs({ company: { existingUnallocatedOptions: 5_000_000 } }),
    );

    expect(solution.sizing.poolPctOfFullyDiluted).toBe(0);
    expect(solution.sizing.poolOptions).toBe(0);
    expect(solution.solver.converged).toBe(true);
  });
});

describe('a plan with no answer in range', () => {
  // Fifty leadership hires a year, each taking 20% of the company. Every extra
  // point of pool makes the next year's grants bigger than the point that paid
  // for them, so there is no fixed point below 100%.
  const runaway = withArgs({
    hiring: {
      horizonYears: 4,
      hiresPerYear: [50, 50, 50, 50],
      seniorityMix: { leadership: 100, senior: 0, mid: 0, junior: 0 },
    },
    grantPolicy: {
      grantBasis: {
        kind: 'percentOfEquity',
        grantPctByBand: { leadership: 20, senior: 0, mid: 0, junior: 0 },
      },
    },
  });

  it('comes back flagged rather than spinning', () => {
    const solution = solveRecommendedPool(runaway);

    expect(solution.solver.converged).toBe(false);
    expect(solution.solver.iterations).toBeLessThanOrEqual(SOLVER.maxIterations);
  });

  /**
   * AUDIT_P4 defect 3. LOG [004] recorded this case as coming "back at 10%
   * flagged rather than at 99.9% pretending". It does not: it comes back at
   * 97.84%. The log went uncorrected for three sessions because the only
   * assertion here was `< 100`, which is true of 10%, true of 97.84%, and true
   * of every other number the contract could have picked.
   *
   * So the figure is pinned. M23 and M20 together say what it is: on a
   * non-converged run the *level* leads, and the level is the last iterate that
   * was finite and inside the cap — here the first step off the 10% start,
   * because the second step ran past 99.9% and the loop stopped rather than
   * report the cap as an answer.
   */
  it('returns the last pool level it stood on, and it is not 10% and not the cap', () => {
    const solution = solveRecommendedPool(runaway);

    expect(solution.sizing.poolPctOfFullyDiluted).toBeCloseTo(97.8394077, 6);
    expect(solution.sizing.poolPctOfFullyDiluted).not.toBeCloseTo(SOLVER.startPoolPct, 6);
    expect(solution.sizing.poolPctOfFullyDiluted).toBeLessThan(99.9);
    expect(solution.solver.iterations).toBe(2);
  });

  it('reports a real pool rather than a sentinel, in both units and consistently', () => {
    // The contract is "the last stable iterate with a flag", not "a sentinel".
    // A founder gets a figure and a warning, never a blank. That only means
    // anything if the figure is internally coherent, so the same one-pool
    // property the converged path has is asserted here too.
    const solution = solveRecommendedPool(runaway);
    const fd0 = runaway.company.fullyDilutedShares;

    expect(Number.isFinite(solution.sizing.poolPctOfFullyDiluted)).toBe(true);
    expect(solution.sizing.poolPctOfFullyDiluted).toBeGreaterThanOrEqual(0);
    expect(solution.sizing.poolPctOfFullyDiluted).toBeLessThan(100);
    expect(solution.sizing.poolOptions).toBeGreaterThan(0);

    expect(solution.sizing.poolOptions).toBeCloseTo(
      poolOptionsForPct({
        fullyDilutedSharesAtYear0: fd0,
        poolPct: solution.sizing.poolPctOfFullyDiluted,
      }),
      6,
    );
    expect(solution.fullyDilutedSharesAtYear0).toBeCloseTo(fd0 + solution.sizing.poolOptions, 6);

    // And it does not quietly claim the plan needs nothing.
    expect(solution.existingPoolIsEnough).toBe(false);
  });
});

describe('the fixed point converges across the plausible input range', () => {
  const CASES = randomCases(500);

  it('lands inside 25 iterations, every time', () => {
    const failures: string[] = [];
    let worst = 0;

    for (const { seed, args } of CASES) {
      const solution = solveRecommendedPool(args);
      worst = Math.max(worst, solution.solver.iterations);

      if (!solution.solver.converged) {
        failures.push(
          `seed ${seed}: ${solution.solver.iterations} iterations, last value ${solution.sizing.poolPctOfFullyDiluted}`,
        );
      }
    }

    expect(failures).toEqual([]);
    expect(worst).toBeLessThanOrEqual(SOLVER.maxIterations);
    // The observed worst case is 7. The bound is set close to it rather than at
    // the spec's 25, so that a change which halves the convergence rate shows up
    // here as a failure instead of hiding inside the headroom.
    expect(worst).toBeLessThanOrEqual(12);
  });

  it('is answering a real question on a good share of them', () => {
    // Without this, "converges every time" could be carried entirely by cases
    // whose existing pool already covers the plan and whose answer is zero on
    // the first turn. It is a claim about the population, not the solver.
    const withAPool = CASES.filter(
      ({ args }) => solveRecommendedPool(args).sizing.poolPctOfFullyDiluted > 0.01,
    );

    expect(withAPool.length).toBeGreaterThan(150);
  });

  it('produces an answer that reproduces itself, on every case', () => {
    for (const { seed, args } of CASES) {
      const solution = solveRecommendedPool(args);
      const again = solveRecommendedPool({
        ...args,
        company: { ...args.company },
      });

      expect(again.sizing.poolPctOfFullyDiluted, `seed ${seed}`).toBe(
        solution.sizing.poolPctOfFullyDiluted,
      );
    }
  });
});

describe('the recommended pool is one pool, quoted in two units', () => {
  /**
   * AUDIT_P4 defect 2. `poolPctOfFullyDiluted` used to be the last loop iterate
   * while `poolOptions` was recomputed from the final run at that iterate, so
   * the two fields of one `PoolSizing` described two different pools: worst gap
   * 0.00489 percentage points across these 500 cases, and 0.0012 on the standard
   * fixture. Both are inside the spec's 0.01 point convergence tolerance, which
   * is why nothing noticed, and neither is inside "these are the same pool".
   *
   * Spec section 7 item 1 asks for the recommended pool "in % of fully diluted
   * and in options". One pool, two units. The bound below is float noise rather
   * than a tolerance, because after the fix the percentage is computed from the
   * option count by the spec's own formula and the two cannot drift.
   */
  const CASES = randomCases(500);
  const TIGHT = 1e-9;

  it('quotes an option count that is exactly the percentage it quotes', () => {
    const failures: string[] = [];
    let worstRelative = 0;

    for (const { seed, args } of CASES) {
      const { sizing } = solveRecommendedPool(args);
      const fd0 = args.company.fullyDilutedShares;
      const impliedOptions = poolOptionsForPct({
        fullyDilutedSharesAtYear0: fd0,
        poolPct: sizing.poolPctOfFullyDiluted,
      });

      const scale = Math.max(sizing.poolOptions, impliedOptions, 1);
      const relative = Math.abs(impliedOptions - sizing.poolOptions) / scale;
      worstRelative = Math.max(worstRelative, relative);

      if (relative > TIGHT) {
        failures.push(
          `seed ${seed}: ${sizing.poolOptions} options reported, ${impliedOptions} implied by ${sizing.poolPctOfFullyDiluted}%`,
        );
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(worstRelative).toBeLessThan(TIGHT);
  });

  it('quotes a percentage that is exactly the option count it quotes', () => {
    for (const [label, basis] of [
      ['percent of equity', BASIS_A],
      ['rupee value', BASIS_B],
    ] as const) {
      const args = withArgs({ grantPolicy: { grantBasis: basis } });
      const { sizing } = solveRecommendedPool(args);
      const fd0 = args.company.fullyDilutedShares;

      // The spec's own denominator: FD_0 + max(0, K - existing).
      const impliedPct = (sizing.poolOptions / (fd0 + sizing.poolOptions)) * 100;

      expect(impliedPct, label).toBeCloseTo(sizing.poolPctOfFullyDiluted, 9);
    }
  });

  it('adds exactly the pool it recommends to the count it reports at year 0', () => {
    for (const { seed, args } of CASES.slice(0, 100)) {
      const solution = solveRecommendedPool(args);
      const fd0 = args.company.fullyDilutedShares;

      expect(solution.fullyDilutedSharesAtYear0, `seed ${seed}`).toBeCloseTo(
        fd0 + solution.sizing.poolOptions,
        6,
      );
    }
  });
});

describe('the displayed figure', () => {
  it('rounds up to the nearest half point, per the last line of section 4.5', () => {
    expect(roundPoolPctForDisplay(12.01)).toBe(12.5);
    expect(roundPoolPctForDisplay(12.5)).toBe(12.5);
    expect(roundPoolPctForDisplay(12.51)).toBe(13);
    expect(roundPoolPctForDisplay(0)).toBe(0);
  });

  it('never rounds the underlying figure, only the one on screen', () => {
    const solution = solveRecommendedPool(withArgs({}));

    expect(solution.sizing.displayPoolPctOfFullyDiluted).toBeGreaterThanOrEqual(
      solution.sizing.poolPctOfFullyDiluted,
    );
    expect(solution.sizing.displayPoolPctOfFullyDiluted % 0.5).toBeCloseTo(0, 9);
  });
});

describe('the pool percentage never travels without its controls', () => {
  it('carries the grant basis and the strike policy that produced it', () => {
    const solution = solveRecommendedPool(
      withArgs({ grantPolicy: { grantBasis: BASIS_B, strikePolicy: { kind: 'lastRoundPrice' } } }),
    );

    expect(solution.sizing.grantBasisKind).toBe('rupeeValue');
    expect(solution.sizing.strikePolicyKind).toBe('lastRoundPrice');
    expect(solution.sizing.valueBasis).toBe('notional');
  });

  it('reports no value basis under a percent-of-equity plan, because there is none', () => {
    const solution = solveRecommendedPool(withArgs({ grantPolicy: { grantBasis: BASIS_A } }));

    expect(solution.sizing.valueBasis).toBeNull();
  });
});

describe('output item 1: the selected basis and the other one', () => {
  it('returns both, and they disagree', () => {
    const { recommendedPool, selected, comparison } = recommendedPoolUnderBothBases({
      inputs: withArgs({ grantPolicy: { grantBasis: BASIS_A } }),
      comparisonGrantBasis: BASIS_B,
    });

    expect(recommendedPool.selected.grantBasisKind).toBe('percentOfEquity');
    expect(recommendedPool.comparison.grantBasisKind).toBe('rupeeValue');
    expect(selected.solver.converged).toBe(true);
    expect(comparison.solver.converged).toBe(true);
    expect(recommendedPool.selected.poolPctOfFullyDiluted).not.toBeCloseTo(
      recommendedPool.comparison.poolPctOfFullyDiluted,
      6,
    );
  });
});

describe('the solver and the roll forward agree', () => {
  it('a pool sized at the recommendation lasts the whole horizon', () => {
    const args = withArgs({});
    const solution = solveRecommendedPool(args);
    const options = poolOptionsForPct({
      fullyDilutedSharesAtYear0: args.company.fullyDilutedShares,
      poolPct: solution.sizing.poolPctOfFullyDiluted,
    });

    const run = runRollForward({
      ...args,
      fullyDilutedSharesAtStart: args.company.fullyDilutedShares + options,
      openingAvailableOptions: args.company.existingUnallocatedOptions + options,
    });

    expect(run.exhaustion.exhausted).toBe(false);
    expect(run.exhaustion.hiresSupported).toBe(115);
  });
});

describe('guards', () => {
  it('refuses to size a pool against no shares', () => {
    expect(() =>
      poolOptionsForPct({ fullyDilutedSharesAtYear0: 0, poolPct: 10 }),
    ).toThrow();
    expect(codeOf(() => poolOptionsForPct({ fullyDilutedSharesAtYear0: 0, poolPct: 10 }))).toBe(
      'nonPositiveFullyDilutedShares',
    );
  });

  it('refuses a negative buffer', () => {
    expect(codeOf(() => solveRecommendedPool(withArgs({ grantPolicy: { bufferPct: -5 } })))).toBe(
      'invalidMoneyAmount',
    );
  });
});
