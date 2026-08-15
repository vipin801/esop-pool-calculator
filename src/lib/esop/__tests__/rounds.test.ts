/** ENGINE_SPEC.md section 4.6, closed form first: T, I, dP, and the price. */

import { describe, expect, it } from 'vitest';

import { EsopEngineError } from '../errors';
import {
  capTable,
  existingPoolPostRoundPct,
  fullyDilutedShares,
  investorFractionOfPostMoney,
  runRoundSchedule,
  sharesExcludingPool,
  shuffleRound,
} from '../rounds';
import type { FundingRound, PreRoundHoldings } from '../types';
import { expectBalanced } from './cap-table-balance';

/** S_ex = 80,00,000, U = 10,00,000. */
const HOLDINGS: PreRoundHoldings = {
  founderShares: 6_500_000,
  investorShares: 1_000_000,
  grantedOptions: 500_000,
  unallocatedPool: 1_000_000,
};

/** ₹40 crore pre, ₹10 crore raise, so the investor takes 20% of the post-money. */
const ROUND: FundingRound = {
  id: 'seriesA',
  label: 'Series A',
  year: 1,
  preMoneyValuation: 400_000_000,
  raiseAmount: 100_000_000,
  investorRequiredPostRoundPoolPct: 15,
  poolCreation: 'preMoney',
};

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsopEngineError) return error.code;
    throw error;
  }
  throw new Error('expected an EsopEngineError, none was thrown');
}

describe('holdings', () => {
  it('puts granted options inside S_ex and the unallocated pool outside it', () => {
    expect(sharesExcludingPool(HOLDINGS)).toBe(8_000_000);
    expect(fullyDilutedShares(HOLDINGS)).toBe(9_000_000);
  });

  it('refuses a negative holding', () => {
    expect(codeOf(() => sharesExcludingPool({ ...HOLDINGS, grantedOptions: -1 }))).toBe(
      'negativeShareCount',
    );
  });
});

describe('the closed form', () => {
  const outcome = shuffleRound({ round: ROUND, holdings: HOLDINGS, poolCreation: 'preMoney' });

  it('takes the investor fraction straight from the round', () => {
    expect(investorFractionOfPostMoney(ROUND)).toBe(0.2);
  });

  it('solves T = S_ex / (1 - pi - r)', () => {
    // 80,00,000 / (1 - 0.15 - 0.2)
    expect(outcome.postRoundFullyDiluted).toBeCloseTo(12_307_692.3077, 4);
  });

  it('gives the investor T * r shares', () => {
    expect(outcome.investorShares).toBeCloseTo(2_461_538.4615, 4);
  });

  it('creates dP = pi*T - U new pool shares', () => {
    expect(outcome.postRoundPoolShares).toBeCloseTo(1_846_153.8462, 4);
    expect(outcome.newPoolShares).toBeCloseTo(846_153.8462, 4);
  });

  it('strikes the price on the post-pool pre-money share count', () => {
    // Vpre / (S_ex + pi*T), which is a lower price than Vpre / S_ex because the
    // pool is inside the count the investor pays against.
    expect(outcome.investorPricePerShare).toBeCloseTo(40.625, 9);
    expect(outcome.investorPricePerShare).toBeLessThan(ROUND.preMoneyValuation / 8_000_000);
  });

  it('marks the whole company at Vpre + R once the round closes', () => {
    expect(outcome.postRoundPricePerShare * outcome.postRoundFullyDiluted).toBeCloseTo(
      500_000_000,
      6,
    );
    expect(outcome.postRoundPricePerShare).toBeCloseTo(outcome.investorPricePerShare, 9);
  });

  it('takes exactly the money raised off the investor', () => {
    expect(outcome.investorShares * outcome.investorPricePerShare).toBeCloseTo(100_000_000, 6);
  });

  it('values the pool dilution at that round’s price per share, as the spec words it', () => {
    expect(outcome.founderDilutionFromPoolPctPoints).toBeCloseTo(6.875, 9);
    expect(outcome.founderDilutionCostRupees).toBeCloseTo(34_375_000, 6);
    expect(outcome.founderDilutionCostRupees).toBeCloseTo(
      outcome.newPoolShares * outcome.investorPricePerShare,
      6,
    );
  });
});

describe('the existing pool measured against the investor’s demand', () => {
  it('reports where the existing pool lands after the round, not before it', () => {
    // 10,00,000 of 90,00,000 is 11.11% before the round. A 20% round dilutes it
    // to 8.89% without a single new option being reserved, and 8.89% is the
    // number an investor demand of "15% post" has to be compared against.
    expect((HOLDINGS.unallocatedPool / fullyDilutedShares(HOLDINGS)) * 100).toBeCloseTo(11.1111, 4);
    expect(existingPoolPostRoundPct({ round: ROUND, holdings: HOLDINGS })).toBeCloseTo(8.8889, 4);
  });
});

describe('cap tables', () => {
  it('balances at every stage under both conventions', () => {
    for (const poolCreation of ['preMoney', 'postMoney'] as const) {
      const { capTables } = shuffleRound({ round: ROUND, holdings: HOLDINGS, poolCreation });

      expectBalanced(capTables.before);
      expectBalanced(capTables.afterPoolCreated);
      expectBalanced(capTables.afterRound);
      expectBalanced(capTables.final);
    }
  });

  it('carries the four rows in a fixed order', () => {
    expect(capTable('t', HOLDINGS).rows.map((row) => row.holder)).toEqual([
      'founders',
      'investors',
      'grantedOptions',
      'unallocatedPool',
    ]);
  });

  it('runs before, pool, round under the pre-money convention', () => {
    const { capTables } = shuffleRound({ round: ROUND, holdings: HOLDINGS, poolCreation: 'preMoney' });

    expect(capTables.before.fullyDilutedShares).toBe(9_000_000);
    // The pool is cut before the money arrives, so the middle table has the
    // enlarged pool and the old investor register.
    expect(capTables.afterPoolCreated.fullyDilutedShares).toBeCloseTo(9_846_153.8462, 4);
    expect(capTables.afterPoolCreated.rows[1]?.shares).toBe(1_000_000);
    expect(capTables.final).toBe(capTables.afterRound);
  });

  it('runs before, round, pool under the post-money convention', () => {
    const { capTables } = shuffleRound({
      round: ROUND,
      holdings: HOLDINGS,
      poolCreation: 'postMoney',
    });

    // The money arrives first, so the middle table has the old pool and the new
    // investor on the register.
    expect(capTables.afterRound.rows[3]?.shares).toBe(1_000_000);
    expect(capTables.afterRound.fullyDilutedShares).toBeCloseTo(11_250_000, 6);
    expect(capTables.final).toBe(capTables.afterPoolCreated);
  });

  it('leaves the founders holding the same number of shares throughout', () => {
    const { capTables } = shuffleRound({ round: ROUND, holdings: HOLDINGS });

    for (const table of [capTables.before, capTables.afterPoolCreated, capTables.afterRound]) {
      expect(table.rows[0]?.shares).toBe(6_500_000);
    }
  });
});

describe('rounds the engine refuses', () => {
  it('rejects a raise of nothing and a pre-money of nothing', () => {
    expect(codeOf(() => investorFractionOfPostMoney({ ...ROUND, raiseAmount: 0 }))).toBe(
      'nonPositiveRaiseAmount',
    );
    expect(codeOf(() => investorFractionOfPostMoney({ ...ROUND, preMoneyValuation: 0 }))).toBe(
      'nonPositiveValuation',
    );
  });

  it('rejects a pool demand outside [0, 100)', () => {
    for (const investorRequiredPostRoundPoolPct of [-1, 100, 140]) {
      expect(
        codeOf(() =>
          shuffleRound({
            round: { ...ROUND, investorRequiredPostRoundPoolPct },
            holdings: HOLDINGS,
          }),
        ),
      ).toBe('poolPctOutOfRange');
    }
  });

  it('rejects a round where the investor and the pool take the whole company', () => {
    // 20% to the investor and 80% to the pool leaves the founders nothing, and
    // T = S_ex / 0 is not a number to hand a founder.
    expect(
      codeOf(() =>
        shuffleRound({
          round: { ...ROUND, investorRequiredPostRoundPoolPct: 80 },
          holdings: HOLDINGS,
        }),
      ),
    ).toBe('roundLeavesNoRoomForExistingHolders');
  });

  it('reports a pool that has to shrink rather than pretending it cannot happen', () => {
    // The investor asks for 5% post-round when the existing pool already lands
    // at 8.89%. dP comes back negative, which is what the spec's formula says.
    const outcome = shuffleRound({
      round: { ...ROUND, investorRequiredPostRoundPoolPct: 5 },
      holdings: HOLDINGS,
    });

    expect(outcome.newPoolShares).toBeLessThan(0);
    expect(outcome.founderDilutionFromPoolPctPoints).toBeLessThan(0);
  });
});

describe('the schedule', () => {
  const SEED: FundingRound = { ...ROUND, id: 'seed', label: 'Seed', year: 0 };
  const SERIES_B: FundingRound = {
    ...ROUND,
    id: 'seriesB',
    label: 'Series B',
    year: 3,
    preMoneyValuation: 1_600_000_000,
    raiseAmount: 400_000_000,
    investorRequiredPostRoundPoolPct: 12,
  };

  it('opens each round on the cap table the last one closed with', () => {
    const steps = runRoundSchedule({
      rounds: [SEED, SERIES_B],
      openingHoldings: HOLDINGS,
    });

    expect(steps).toHaveLength(2);

    const [first, second] = steps;
    if (first === undefined || second === undefined) throw new Error('schedule is too short');

    expect(second.openingHoldings).toEqual(first.closingHoldings);
    expect(first.closingHoldings.founderShares).toBe(HOLDINGS.founderShares);
    expect(first.closingHoldings.investorShares).toBeCloseTo(
      HOLDINGS.investorShares + first.outcome.investorShares,
      6,
    );
    expect(first.closingHoldings.unallocatedPool).toBeCloseTo(first.outcome.postRoundPoolShares, 6);
    expect(fullyDilutedShares(first.closingHoldings)).toBeCloseTo(
      first.outcome.postRoundFullyDiluted,
      6,
    );
  });

  it('dilutes the founders further at every round', () => {
    const steps = runRoundSchedule({ rounds: [SEED, SERIES_B], openingHoldings: HOLDINGS });

    const founderPcts = steps.map((step) => step.outcome.founderPctOfFullyDiluted);
    const [firstPct, secondPct] = founderPcts;
    if (firstPct === undefined || secondPct === undefined) throw new Error('schedule is too short');

    expect(secondPct).toBeLessThan(firstPct);
  });

  it('balances every cap table in the schedule', () => {
    for (const step of runRoundSchedule({ rounds: [SEED, SERIES_B], openingHoldings: HOLDINGS })) {
      expectBalanced(step.outcome.capTables.before);
      expectBalanced(step.outcome.capTables.final);
    }
  });

  it('refuses rounds that are out of order or share a year', () => {
    expect(codeOf(() => runRoundSchedule({ rounds: [SERIES_B, SEED], openingHoldings: HOLDINGS })))
      .toBe('roundsOutOfOrder');
    expect(
      codeOf(() =>
        runRoundSchedule({ rounds: [SEED, { ...SERIES_B, year: 0 }], openingHoldings: HOLDINGS }),
      ),
    ).toBe('roundsOutOfOrder');
  });

  it('returns nothing for an empty schedule', () => {
    expect(runRoundSchedule({ rounds: [], openingHoldings: HOLDINGS })).toEqual([]);
  });
});
