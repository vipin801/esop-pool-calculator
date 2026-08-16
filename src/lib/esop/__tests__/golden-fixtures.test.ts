/**
 * Golden fixtures: the exact company the front-end build is showing today, and
 * every number this engine returns for it.
 *
 * These tests pin values rather than assert properties, which is what makes them
 * golden and also what makes them brittle on purpose. A change anywhere in the
 * engine that moves a figure a founder reads has to come through this file, be
 * seen, and be explained in docs/esop/LOG.md. That is the point. Nothing here is
 * an invariant, and nothing here should be relaxed to make a change pass — if a
 * figure moves, either the change is wrong or the fixture is out of date, and
 * both are decisions rather than edits.
 *
 * Every figure below was produced by running the engine and recording the
 * result. None was computed by hand and then chased. Where a figure is also
 * derivable by hand, the derivation is in the comment, because a fixture nobody
 * can check is a fixture nobody will notice going wrong.
 *
 * The reconciliation against the front-end build's own figures is LOG [020].
 */

import { describe, expect, it } from 'vitest';

import { calculateEsopPool } from '../calculate';
import {
  SERIES_A_MARKET,
  SERIES_A_MARKET_AT_V1_ASSUMPTIONS,
  SERIES_A_MARKET_WITH_ROUND,
} from './golden-inputs';

const CRORE = 10_000_000;

const result = calculateEsopPool(SERIES_A_MARKET);
const atV1 = calculateEsopPool(SERIES_A_MARKET_AT_V1_ASSUMPTIONS);
const withRound = calculateEsopPool(SERIES_A_MARKET_WITH_ROUND);

describe('the Series A market fixture, item 1: the recommended pool', () => {
  it('is 6.550973% of fully diluted under the selected rupee basis', () => {
    const { selected } = result.recommendedPool;

    expect(selected.grantBasisKind).toBe('rupeeValue');
    expect(selected.strikePolicyKind).toBe('lastRoundPrice');
    expect(selected.valueBasis).toBe('notional');
    expect(selected.poolPctOfFullyDiluted).toBeCloseTo(6.550973320034335, 12);
    expect(selected.poolOptions).toBeCloseTo(701_021.0328320931, 6);
    expect(selected.displayPoolPctOfFullyDiluted).toBe(7);
  });

  it('is 17.078783% under the other basis, which is the whole point of item 1', () => {
    const { comparison } = result.recommendedPool;

    expect(comparison.grantBasisKind).toBe('percentOfEquity');
    /** Basis A has no denominator, so no value basis produced this figure. */
    expect(comparison.valueBasis).toBeNull();
    expect(comparison.poolPctOfFullyDiluted).toBeCloseTo(17.078783187200884, 12);
    expect(comparison.poolOptions).toBeCloseTo(2_059_639.721129216, 6);
    expect(comparison.displayPoolPctOfFullyDiluted).toBe(17.5);
  });

  it('reports the same pool in both units, to the last digit', () => {
    const { selected } = result.recommendedPool;
    const fd0 = result.recommended.fullyDilutedSharesAtYear0 - result.recommended.openingPoolOptions;

    /** Section 4.5's own formula, re-applied to the reported option count. M23. */
    expect((selected.poolOptions / (fd0 + selected.poolOptions)) * 100).toBeCloseTo(
      selected.poolPctOfFullyDiluted,
      12,
    );
  });

  it('settles in four iterations', () => {
    expect(result.solver).toEqual({
      iterations: 4,
      converged: true,
      tolerancePctPoints: 0.01,
      maxIterations: 25,
    });
  });
});

describe('the Series A market fixture, the two series', () => {
  it('labels them apart and describes each', () => {
    expect(result.recommended.label).toBe('recommended');
    expect(result.current.label).toBe('current');
    expect(result.recommended.description).not.toBe(result.current.description);
  });

  it('runs the recommended series against a pool of 701,028 options', () => {
    /**
     * Not exactly `sizing.poolOptions` (701,021.03), and that gap is the one
     * M23 states: the returned run is priced at the solver's converged iterate,
     * which sits inside section 4.5's 0.01 percentage point tolerance of the
     * reported answer. Seven options on ten and a half million, pinned here so
     * it cannot widen quietly.
     */
    expect(result.recommended.openingPoolOptions).toBeCloseTo(701_028.090752647, 6);
    expect(result.recommended.fullyDilutedSharesAtYear0).toBeCloseTo(10_701_028.090752646, 6);
    expect(
      Math.abs(
        result.recommended.openingPoolPctOfFullyDiluted -
          result.recommendedPool.selected.poolPctOfFullyDiluted,
      ),
    ).toBeLessThan(0.01);
  });

  it('closes every year of the recommended series with options in hand', () => {
    const closings = result.recommended.years.map((year) => year.closingAvailable);

    expect(closings.every((closing) => closing > 0)).toBe(true);
    expect(closings[0]).toBeCloseTo(557_420.2937747465, 6);
    expect(closings[1]).toBeCloseTo(392_289.671869745, 6);
    expect(closings[2]).toBeCloseTo(225_063.48704845377, 6);
    expect(closings[3]).toBeCloseTo(91_444.5839421313, 6);
  });

  it('never exhausts the recommended pool, and covers all 115 hires', () => {
    expect(result.recommended.exhaustion).toEqual({
      exhausted: false,
      yearIndex: null,
      monthIndex: null,
      hiresSupported: 115,
    });
  });

  it('runs the current series against the empty pool the founder actually holds', () => {
    expect(result.current.openingPoolOptions).toBe(0);
    expect(result.current.openingPoolPctOfFullyDiluted).toBe(0);
    expect(result.current.fullyDilutedSharesAtYear0).toBe(10_000_000);
    expect(result.current.sizing).toBeNull();
  });

  it('exhausts the current pool at month zero, supporting zero hires', () => {
    expect(result.current.exhaustion).toEqual({
      exhausted: true,
      yearIndex: 0,
      monthIndex: 0,
      hiresSupported: 0,
    });
  });

  it('carries the current series overdrawn, signed, in every year', () => {
    const closings = result.current.years.map((year) => year.closingAvailable);

    expect(closings.every((closing) => closing < 0)).toBe(true);
    expect(closings[0]).toBeCloseTo(-134_200, 6);
    expect(closings[1]).toBeCloseTo(-288_512.85714285716, 6);
    expect(closings[2]).toBeCloseTo(-444_783.9961428572, 6);
    expect(closings[3]).toBeCloseTo(-569_649.4782004083, 6);
    expect(result.current.closingAvailable).toBeCloseTo(-569_649.4782004083, 6);
  });

  it('prices the two series differently, because they are different companies', () => {
    /**
     * The recommended run carries 701,028 more shares in FD_0, so its price per
     * share is lower and each rupee of grant buys more options. Reading a grant
     * count off one series beside a balance off the other is the front-end
     * build's bug, and these two lines are why it is a bug.
     */
    expect(result.recommended.years[0]?.pricePerShare).toBeCloseTo(140.1734475677373, 9);
    expect(result.current.years[0]?.pricePerShare).toBe(150);
    expect(result.recommended.years[0]?.newHireGrants).toBeCloseTo(154_094.8045068381, 6);
    expect(result.current.years[0]?.newHireGrants).toBe(144_000);
  });
});

describe('the Series A market fixture, item 5: the year by year roll forward', () => {
  it('walks the valuation path the front-end build shows: 150.0, 210.0, 294.0, 411.6 crore', () => {
    for (const years of [result.current.years, result.recommended.years]) {
      expect(years.map((year) => year.valuation / CRORE)).toEqual([
        expect.closeTo(150, 6),
        expect.closeTo(210, 6),
        expect.closeTo(294, 6),
        expect.closeTo(411.6, 6),
      ]);
    }
  });

  it('prices the current series at ₹150, 210, 294 and 411.6 a share', () => {
    /** FD_0 is a round crore of shares and never moves under recycling, so PPS_t is V_t / 10^7. */
    expect(result.current.years.map((year) => year.pricePerShare)).toEqual([
      150,
      expect.closeTo(210, 9),
      expect.closeTo(294, 9),
      expect.closeTo(411.6, 9),
    ]);
  });

  it('pins the recommended series year by year', () => {
    const years = result.recommended.years;

    expect(years.map((year) => year.newHireGrants)).toEqual([
      expect.closeTo(154_094.8045068381, 6),
      expect.closeTo(198_121.8915087919, 6),
      expect.closeTo(213_971.6428294953, 6),
      expect.closeTo(188_644.38714763668, 6),
    ]);
    expect(years.map((year) => year.refreshGrants)).toEqual([
      0,
      0,
      expect.closeTo(7_385.205779445409, 6),
      expect.closeTo(14_421.855209746413, 6),
    ]);
    expect(years.map((year) => year.returnedToPool)).toEqual([
      expect.closeTo(10_487.007528937595, 6),
      expect.closeTo(32_991.26960379041, 6),
      expect.closeTo(54_130.66378764948, 6),
      expect.closeTo(69_447.3392510606, 6),
    ]);
  });

  it('returns nothing in year 0 but unvested forfeitures, because nothing has vested', () => {
    const first = result.recommended.years[0];

    /**
     * The spec's own curve: `v = (age - c/12) / (k - c/12)` is zero at the cliff
     * and a year-0 cohort is at age 0. So the whole leaver population is
     * unvested, nothing lapses, and nobody exercises on the way out.
     */
    expect(first?.vestedLapsed).toBe(0);
    expect(first?.vestedExercised).toBe(0);
    expect(first?.unvestedForfeited).toBeCloseTo(10_487.007528937595, 6);
    expect(first?.returnedToPool).toBe(first?.unvestedForfeited);
  });

  it('starts refresh grants in year 2, when the first cohort clears 24 months', () => {
    expect(result.recommended.years.map((year) => year.refreshEligibleHeadcount)).toEqual([
      0,
      0,
      expect.closeTo(11.845312500000002, 9),
      expect.closeTo(29.842765625000002, 9),
    ]);
  });

  it('issues shares only once options start vesting and leaving', () => {
    expect(result.recommended.years.map((year) => year.closingIssuedShares)).toEqual([
      10_000_000,
      10_000_000,
      expect.closeTo(10_002_797.516268626, 6),
      expect.closeTo(10_011_211.096416496, 6),
    ]);
    expect(result.recommended.totalExercisedShares).toBeCloseTo(11_211.096416494118, 6);
  });
});

describe('the Series A market fixture, item 7: authorised capital', () => {
  it('has headroom, because 1.07 crore shares fit inside 1.2 crore authorised', () => {
    expect(result.recommended.authorisedCapital).toEqual({
      authorisedShares: 12_000_000,
      requiredShares: expect.closeTo(10_701_028.09075265, 6),
      shortfallShares: 0,
      increaseRequiredRupees: 0,
      sufficient: true,
    });
  });
});

describe('the Series A market fixture, item 8: the Ind AS 102 expense', () => {
  it('runs to ₹4.36 crore across the horizon, with reversals after year 0', () => {
    expect(result.esopExpense.basis).toBe('indAS102');
    expect(result.esopExpense.totalExpenseRupees).toBeCloseTo(43_563_658.71070786, 4);
    expect(result.esopExpense.years.map((year) => year.expenseRupees)).toEqual([
      expect.closeTo(2_767_875.000000001, 4),
      expect.closeTo(6_998_062.500000001, 4),
      expect.closeTo(13_166_622.200325003, 4),
      expect.closeTo(20_631_099.010382853, 4),
    ]);
    /** Nothing is forfeited before the first cohort's own grant year closes. */
    expect(result.esopExpense.years[0]?.forfeitureReversalRupees).toBe(0);
    expect(result.esopExpense.years[3]?.forfeitureReversalRupees).toBeCloseTo(
      -2_113_360.3360237502,
      4,
    );
  });

  it('excludes and includes nothing, because the company has granted nothing yet', () => {
    expect(result.esopExpense.excludedOpeningOptions).toBe(0);
    expect(result.esopExpense.includedOpeningOptions).toBe(0);
  });
});

describe('the Series A market fixture, item 9: compliance', () => {
  it('returns all eight rows, in the section 5 order', () => {
    expect(result.complianceChecks.map((check) => [check.id, check.status])).toEqual([
      ['schemeApproval', 'pass'],
      ['separateResolution', 'pass'],
      ['vestingFloor', 'pass'],
      ['eligibility', 'warn'],
      ['authorisedCapital', 'pass'],
      ['allotmentFilings', 'pass'],
      ['taxDeferral', 'warn'],
      ['instrument', 'pass'],
    ]);
  });

  it('reads the authorised capital row off the recommended run, not off nothing', () => {
    expect(result.complianceChecks.find((check) => check.id === 'authorisedCapital')?.finding).toContain(
      '1,07,01,028',
    );
  });
});

describe('the Series A market fixture, item 10: benchmarks', () => {
  it('shows both tracks, and they disagree about this company', () => {
    expect(result.benchmarkComparison.poolPctOfFullyDiluted).toBeCloseTo(6.550973320034335, 12);
    expect(
      result.benchmarkComparison.tracks.map((track) => [track.trackId, track.position]),
    ).toEqual([
      /** Advisory consensus puts Series A at 12-15%. This pool is under it. */
      ['advisory', 'below'],
      /** The observed India study puts most Series A companies below 10%. This pool is inside it. */
      ['observed', 'within'],
    ]);
  });
});

describe('the Series A market fixture, item 11: the median employee', () => {
  it('is a mid-band hire, the band the 50th percentile of a 5/20/45/30 mix falls in', () => {
    expect(result.medianEmployeeValue?.band).toBe('mid');
  });

  it('values a ₹10 lakh grant at ₹18.29 lakh notional and ₹8.14 lakh realisable', () => {
    const median = result.medianEmployeeValue;

    /** ₹10,00,000 at year 0's ₹140.17 price per share. */
    expect(median?.optionsGranted).toBeCloseTo(7_134.018727168431, 6);
    /** Two thirds vested at the end of year 3: (3 - 1) / (4 - 1). */
    expect(median?.vestedAtHorizon).toBeCloseTo(4_756.012484778954, 6);
    expect(median?.notionalValueRupees).toBeCloseTo(1_829_333.3333333328, 4);
    expect(median?.exerciseCostRupees).toBeCloseTo(666_666.6666666666, 4);
    expect(median?.perquisiteTaxRupees).toBeCloseTo(348_799.9999999998, 4);
    expect(median?.realisableValueRupees).toBeCloseTo(813_866.6666666663, 4);
  });

  it('says the deferral is unavailable, because neither DPIIT nor IMB is held', () => {
    expect(result.medianEmployeeValue?.taxDeferralAvailable).toBe(false);
  });
});

describe('the Series A market fixture, section 2 and the warnings', () => {
  it('refuses the realisable basis at a last-round-price strike, with a reason', () => {
    const leadershipYear0 = result.grantValueBreakdown.find(
      (row) => row.year === 0 && row.band === 'leadership',
    );

    expect(leadershipYear0?.basisKind).toBe('rupeeValue');
    if (leadershipYear0?.basisKind !== 'rupeeValue') throw new Error('wrong basis');

    const { optionsPerHireByValueBasis: byBasis } = leadershipYear0;
    expect(byBasis.notional).toEqual({
      ok: true,
      optionsPerHire: expect.closeTo(57_072.14981734745, 6),
      denominator: expect.closeTo(140.1734475677373, 9),
    });
    expect(byBasis.fairValue).toEqual({
      ok: true,
      optionsPerHire: expect.closeTo(103_767.54512244988, 6),
      denominator: expect.closeTo(77.09539616225553, 9),
    });
    expect(byBasis.realisable.ok).toBe(false);
    if (byBasis.realisable.ok) throw new Error('realisable should be refused');
    expect(byBasis.realisable.reason).toBe('degenerateRealisableSpread');
  });

  it('warns that a notional grant at an FMV strike overstates what an employee gets', () => {
    expect(result.warnings.map((warning) => warning.id)).toEqual([
      'notionalValueOverstatesReceipt',
    ]);
  });
});

describe('the Series A market fixture, item 6: cap tables', () => {
  it('shows the register today and after the pool is reserved', () => {
    expect(result.capTables.before.fullyDilutedShares).toBe(10_000_000);
    expect(result.capTables.before.rows.map((row) => [row.holder, row.shares])).toEqual([
      ['founders', 5_800_000],
      ['investors', 4_200_000],
      ['grantedOptions', 0],
      ['unallocatedPool', 0],
    ]);

    expect(result.capTables.after.fullyDilutedShares).toBeCloseTo(10_701_021.032832094, 6);
    /** The founders' share count does not move; their percentage does. */
    expect(result.capTables.after.rows[0]?.shares).toBe(5_800_000);
    expect(result.capTables.after.rows[0]?.pctOfFullyDiluted).toBeCloseTo(54.20043547438008, 9);
    expect(result.capTables.after.rows[3]?.pctOfFullyDiluted).toBeCloseTo(6.550973320034335, 12);
  });

  it('has no third table until a round is modelled', () => {
    expect(result.capTables.afterModelledRound).toBeNull();
    expect(result.topUpAtNextRound).toBeNull();
    expect(result.poolCostToFounders).toBeNull();
    expect(result.rounds).toEqual([]);
  });
});

describe('the same fixture with a Series B on the table, items 3 and 4', () => {
  it('needs 10.44 points of new pool to meet a 15% post-round demand', () => {
    expect(withRound.topUpAtNextRound).toEqual({
      roundId: 'seriesB',
      topUpPctPoints: expect.closeTo(10.443363286591396, 9),
      topUpOptions: expect.closeTo(1_606_671.274860215, 6),
      investorRequiredPostRoundPoolPct: 15,
      /**
       * M13, and the number an investor's demand should actually be read
       * against: the pool already reserved lands at 5.24% after the round
       * without a single new option being created.
       */
      existingPoolPostRoundPct: expect.closeTo(5.240778656027468, 9),
      poolCreation: 'preMoney',
    });
  });

  it('prices the pre-money pool against the post-money pool at ₹5.97 crore', () => {
    const cost = withRound.poolCostToFounders;

    expect(cost?.asOffered).toBe('preMoney');
    /** The spec's own dP/T measure. Small, and not the founder-facing headline. */
    expect(cost?.deltaPctPoints).toBeCloseTo(0.14439585571001068, 9);
    expect(cost?.deltaRupees).toBeCloseTo(7_219_792.785500467, 4);
    /** M12: what the founders actually keep. Eight times the spec measure here. */
    expect(cost?.founderOwnershipDeltaPctPoints).toBeCloseTo(1.1946802219822459, 9);
    expect(cost?.founderOwnershipDeltaRupees).toBeCloseTo(59_734_011.099112295, 4);
  });

  it('lands the founders at 37.7% pre-money and 38.89% post-money', () => {
    expect(withRound.poolCostToFounders?.preMoneyPool.founderPctOfFullyDiluted).toBeCloseTo(
      37.699999999999996,
      9,
    );
    expect(withRound.poolCostToFounders?.postMoneyPool.founderPctOfFullyDiluted).toBeCloseTo(
      38.89468022198224,
      9,
    );
  });

  it('draws the third cap table off the round as offered', () => {
    const after = withRound.capTables.afterModelledRound;

    expect(after?.fullyDilutedShares).toBeCloseTo(15_384_615.384615386, 6);
    expect(after?.rows[3]?.pctOfFullyDiluted).toBeCloseTo(15, 9);
  });

  it('changes nothing about the pool recommendation itself', () => {
    /** A term sheet is not a hiring plan. Item 1 must not move because item 4 exists. */
    expect(withRound.recommendedPool.selected.poolOptions).toBe(
      result.recommendedPool.selected.poolOptions,
    );
  });
});

describe('the same company at the front-end build v1 assumptions', () => {
  it('recommends 6.335227%, which displays as the build own 6.5%', () => {
    expect(atV1.recommendedPool.selected.poolPctOfFullyDiluted).toBeCloseTo(
      6.335227617127654,
      12,
    );
    expect(atV1.recommendedPool.selected.poolOptions).toBeCloseTo(676_372.4990684033, 6);
    expect(atV1.recommendedPool.selected.displayPoolPctOfFullyDiluted).toBe(6.5);
  });

  it('returns 12,128 options in year 0 where the build returns 22,627', () => {
    /**
     * The whole of LOG [020]'s fourth finding, in one number. Same company, same
     * assumptions, and the difference is entirely the two conventions: half a
     * year of attrition exposure on a cohort granted through the year, and the
     * spec's vesting curve, which puts v at zero in the grant year.
     */
    expect(atV1.recommended.years[0]?.returnedToPool).toBeCloseTo(12_128.366610225674, 6);
    expect(atV1.recommended.years[0]?.newHireGrants).toBeCloseTo(153_739.8584394804, 6);
  });

  it('still exhausts the current pool at month zero', () => {
    /** The assumptions move the pool size. They do not make an empty pool last. */
    expect(atV1.current.exhaustion.monthIndex).toBe(0);
    expect(atV1.current.exhaustion.hiresSupported).toBe(0);
  });
});
