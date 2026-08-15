/**
 * ENGINE_SPEC.md section 4.6, the comparison: the same round with the pool cut
 * before the money against the same round with it cut after.
 *
 * "That delta, in rupees, is the number the founder is actually buying the tool
 * for." So it is worth being exact about which delta, and about what the two
 * conventions can and cannot differ in.
 */

import { describe, expect, it } from 'vitest';

import {
  existingPoolPostRoundPct,
  fullyDilutedShares,
  investorFractionOfPostMoney,
  poolCostToFounders,
  shuffleRound,
} from '../rounds';
import type { FundingRound, PreRoundHoldings } from '../types';
import { expectBalanced } from './cap-table-balance';

/** S_ex = 80,00,000, U = 10,00,000, so 90,00,000 fully diluted before the round. */
const HOLDINGS: PreRoundHoldings = {
  founderShares: 6_500_000,
  investorShares: 1_000_000,
  grantedOptions: 500_000,
  unallocatedPool: 1_000_000,
};

/** ₹40 crore pre, ₹10 crore raise, investor wants a 15% pool post-round. */
const ROUND: FundingRound = {
  id: 'seriesA',
  label: 'Series A',
  year: 1,
  preMoneyValuation: 400_000_000,
  raiseAmount: 100_000_000,
  investorRequiredPostRoundPoolPct: 15,
  poolCreation: 'preMoney',
};

const POST_MONEY_VALUATION = ROUND.preMoneyValuation + ROUND.raiseAmount;

const preMoney = shuffleRound({ round: ROUND, holdings: HOLDINGS, poolCreation: 'preMoney' });
const postMoney = shuffleRound({ round: ROUND, holdings: HOLDINGS, poolCreation: 'postMoney' });

describe('pre-money against post-money pool creation', () => {
  /*
   * The session prompt asked for a test that the two conventions produce
   * identical total fully diluted shares but different founder percentages.
   * Those two cannot hold together, and not because of anything in this
   * implementation.
   *
   * The founders are issued no shares by either convention, so their share
   * count F is the same in both. Their percentage is F/T. Identical totals
   * therefore force identical percentages, and different percentages force
   * different totals. The expectation was not weakened to make it pass and the
   * model was not bent to fit it; what is asserted below is the strongest true
   * statement in the same place, and the discrepancy is raised in LOG.md.
   *
   * The two conventions do coincide completely, totals and percentages alike,
   * in exactly one case: when no new pool is created. That is the next test
   * down, and it is the same identity seen from the other side.
   */

  it('issues the founders no new shares, which is why the totals and the percentages move together', () => {
    expect(preMoney.capTables.final.rows[0]?.shares).toBe(HOLDINGS.founderShares);
    expect(postMoney.capTables.final.rows[0]?.shares).toBe(HOLDINGS.founderShares);
  });

  it('produces different totals and different founder percentages when a new pool is created', () => {
    expect(preMoney.newPoolShares).toBeGreaterThan(0);

    expect(preMoney.postRoundFullyDiluted).not.toBe(postMoney.postRoundFullyDiluted);
    expect(postMoney.postRoundFullyDiluted).toBeLessThan(preMoney.postRoundFullyDiluted);

    expect(preMoney.founderPctOfFullyDiluted).toBeCloseTo(52.8125, 6);
    expect(postMoney.founderPctOfFullyDiluted).toBeCloseTo(53.9024, 4);
    expect(postMoney.founderPctOfFullyDiluted).toBeGreaterThan(preMoney.founderPctOfFullyDiluted);
  });

  it('cuts the same pool percentage either way, and charges it to different people', () => {
    // The pool lands at pi of the post-round company under both conventions.
    // What changes is who paid for it: under postMoney the incoming investor
    // carries part of it, which is exactly why the founders keep more.
    const poolPct = (outcome: typeof preMoney): number =>
      (outcome.postRoundPoolShares / outcome.postRoundFullyDiluted) * 100;

    expect(poolPct(preMoney)).toBeCloseTo(15, 9);
    expect(poolPct(postMoney)).toBeCloseTo(15, 9);
    expect(postMoney.investorPctOfFullyDiluted).toBeLessThan(preMoney.investorPctOfFullyDiluted);
  });

  it('balances every cap table under both conventions', () => {
    for (const outcome of [preMoney, postMoney]) {
      expectBalanced(outcome.capTables.before);
      expectBalanced(outcome.capTables.afterPoolCreated);
      expectBalanced(outcome.capTables.afterRound);
      expectBalanced(outcome.capTables.final);
    }
  });
});

describe('a pool demand the company already meets', () => {
  /** pi set to where the existing pool lands post-round, which is the honest comparison. */
  const investorRequiredPostRoundPoolPct = existingPoolPostRoundPct({
    round: ROUND,
    holdings: HOLDINGS,
  });
  const round: FundingRound = { ...ROUND, investorRequiredPostRoundPoolPct };

  it('creates no new pool shares', () => {
    for (const poolCreation of ['preMoney', 'postMoney'] as const) {
      const outcome = shuffleRound({ round, holdings: HOLDINGS, poolCreation });

      expect(outcome.newPoolShares, poolCreation).toBeCloseTo(0, 6);
      expect(outcome.postRoundPoolShares, poolCreation).toBeCloseTo(
        HOLDINGS.unallocatedPool,
        6,
      );
      expect(outcome.founderDilutionFromPoolPctPoints, poolCreation).toBeCloseTo(0, 9);
      expect(outcome.founderDilutionCostRupees, poolCreation).toBeCloseTo(0, 3);
    }
  });

  it('makes the two conventions identical, totals and percentages alike', () => {
    const pre = shuffleRound({ round, holdings: HOLDINGS, poolCreation: 'preMoney' });
    const post = shuffleRound({ round, holdings: HOLDINGS, poolCreation: 'postMoney' });

    expect(post.postRoundFullyDiluted).toBeCloseTo(pre.postRoundFullyDiluted, 6);
    expect(post.founderPctOfFullyDiluted).toBeCloseTo(pre.founderPctOfFullyDiluted, 9);
    expect(post.investorPricePerShare).toBeCloseTo(pre.investorPricePerShare, 9);

    // And so the whole feature is worth nothing on this round, correctly.
    const cost = poolCostToFounders({ round, holdings: HOLDINGS });
    expect(cost.deltaRupees).toBeCloseTo(0, 3);
    expect(cost.founderOwnershipDeltaRupees).toBeCloseTo(0, 3);
  });

  it('is not the same as the pool’s pre-round percentage, which would still create shares', () => {
    // 11.11% before the round against 8.89% after it. Reading pi against the
    // pre-round figure reserves options nobody asked for.
    const naive = (HOLDINGS.unallocatedPool / fullyDilutedShares(HOLDINGS)) * 100;

    expect(naive).toBeGreaterThan(investorRequiredPostRoundPoolPct);
    expect(
      shuffleRound({
        round: { ...ROUND, investorRequiredPostRoundPoolPct: naive },
        holdings: HOLDINGS,
      }).newPoolShares,
    ).toBeGreaterThan(0);
  });
});

describe('the investor’s percentage after the round', () => {
  it('equals R/(Vpre+R) under the pre-money convention', () => {
    const r = investorFractionOfPostMoney(ROUND);

    expect(r).toBe(0.2);
    expect(preMoney.investorPctOfFullyDiluted).toBeCloseTo(r * 100, 9);
    expect(preMoney.investorPctOfFullyDiluted).toBeCloseTo(20, 9);
  });

  it('holds at every pool size the round can carry', () => {
    for (const investorRequiredPostRoundPoolPct of [0, 5, 15, 30, 50, 79]) {
      const outcome = shuffleRound({
        round: { ...ROUND, investorRequiredPostRoundPoolPct },
        holdings: HOLDINGS,
        poolCreation: 'preMoney',
      });

      expect(
        outcome.investorPctOfFullyDiluted,
        `a ${investorRequiredPostRoundPoolPct}% pool moved the investor off 20%`,
      ).toBeCloseTo(20, 9);
    }
  });

  it('lands below it under the post-money convention, which is the whole point', () => {
    expect(postMoney.investorPctOfFullyDiluted).toBeCloseTo(18.6585, 4);
    expect(postMoney.investorPctOfFullyDiluted).toBeLessThan(20);
  });
});

describe('the delta', () => {
  const cost = poolCostToFounders({ round: ROUND, holdings: HOLDINGS });

  it('reports both conventions and which one is on the table', () => {
    expect(cost.roundId).toBe('seriesA');
    expect(cost.asOffered).toBe('preMoney');
    expect(cost.preMoneyPool.poolCreation).toBe('preMoney');
    expect(cost.postMoneyPool.poolCreation).toBe('postMoney');
  });

  it('prices the spec’s dP/T measure under each convention and takes the difference', () => {
    expect(cost.preMoneyPool.founderDilutionFromPoolPctPoints).toBeCloseTo(6.875, 9);
    expect(cost.postMoneyPool.founderDilutionFromPoolPctPoints).toBeCloseTo(6.7073, 4);

    expect(cost.deltaPctPoints).toBeCloseTo(0.1677, 4);
    expect(cost.deltaRupees).toBeCloseTo((cost.deltaPctPoints / 100) * POST_MONEY_VALUATION, 6);
    expect(cost.deltaRupees).toBeGreaterThan(0);
  });

  it('also reports what the founders actually keep, which is the larger number', () => {
    // dP/T is the pool's footprint on the company. The founders' own gain from
    // moving the pool post-money is bigger than the difference in that
    // footprint, because the incoming investor absorbs part of a post-money
    // pool and none of a pre-money one.
    expect(cost.founderOwnershipDeltaPctPoints).toBeCloseTo(1.0899, 4);
    expect(cost.founderOwnershipDeltaRupees).toBeCloseTo(5_449_695, 0);

    expect(cost.founderOwnershipDeltaPctPoints).toBeGreaterThan(cost.deltaPctPoints);
    expect(cost.founderOwnershipDeltaRupees).toBeGreaterThan(cost.deltaRupees);
  });

  it('grows with the size of the pool the investor demands', () => {
    const deltas = [5, 10, 15, 20, 25].map(
      (investorRequiredPostRoundPoolPct) =>
        poolCostToFounders({
          round: { ...ROUND, investorRequiredPostRoundPoolPct },
          holdings: HOLDINGS,
        }).founderOwnershipDeltaRupees,
    );

    for (const [index, delta] of deltas.entries()) {
      if (index === 0) continue;
      const previous = deltas[index - 1];
      if (previous === undefined) throw new Error('missing delta');
      expect(delta, `a bigger pool did not cost more at index ${index}`).toBeGreaterThan(previous);
    }
  });
});
