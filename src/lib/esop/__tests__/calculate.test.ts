/**
 * The assembler's contract, as properties rather than as pinned figures.
 *
 * `golden-fixtures.test.ts` pins one company's numbers. This file asserts the
 * things that have to hold for *any* company, and the things the front-end build
 * gets wrong. The two do different jobs and neither replaces the other: a golden
 * fixture catches a number moving, a property catches a number being wrong in a
 * way that happens to leave the fixture alone.
 */

import { describe, expect, it } from 'vitest';

import { calculateEsopPool, medianBand } from '../calculate';
import { EsopEngineError } from '../errors';
import { BASIS_A, BASIS_B, withInputs } from './fixtures';
import { SERIES_A_MARKET } from './golden-inputs';

const base = calculateEsopPool(SERIES_A_MARKET);

describe('the two series are two runs, and the result will not let them be confused', () => {
  it('has no top-level roll forward or exhaustion to reach for', () => {
    /**
     * The whole fix, in one assertion. A caller cannot write
     * `result.exhaustion` beside `result.recommendedPool`; they have to say
     * `result.current.exhaustion` or `result.recommended.exhaustion`, and the
     * moment they type it they have decided which question they are asking.
     */
    expect('rollForward' in base).toBe(false);
    expect('exhaustion' in base).toBe(false);
    expect('authorisedCapital' in base).toBe(false);
  });

  it('gives the two runs different prices, grants and balances', () => {
    const recommended = base.recommended.years[0];
    const current = base.current.years[0];

    expect(recommended?.pricePerShare).not.toBe(current?.pricePerShare);
    expect(recommended?.newHireGrants).not.toBe(current?.newHireGrants);
    expect(recommended?.closingAvailable).not.toBe(current?.closingAvailable);
  });

  it('gives only the recommended series a sizing, because only it is a recommendation', () => {
    expect(base.recommended.sizing).not.toBeNull();
    expect(base.current.sizing).toBeNull();
  });

  it('opens the current series at exactly the pool the founder holds', () => {
    const held = 400_000;
    const result = calculateEsopPool(
      withInputs(
        { company: { existingUnallocatedOptions: held } },
        SERIES_A_MARKET,
      ),
    );

    expect(result.current.openingPoolOptions).toBe(held);
    expect(result.current.years[0]?.openingAvailable).toBe(held);
  });
});

describe('an empty pool', () => {
  const empty = base.current;

  it('supports zero hires, not three', () => {
    expect(empty.exhaustion.hiresSupported).toBe(0);
  });

  it('runs out at month zero, not month two', () => {
    expect(empty.exhaustion.monthIndex).toBe(0);
    expect(empty.exhaustion.yearIndex).toBe(0);
    expect(empty.exhaustion.exhausted).toBe(true);
  });

  it('does not fund itself out of the returns on grants it never made', () => {
    /**
     * Year 0 returns options to the pool, because grants made in year 0 churn.
     * Those returns are real and they are in the roll forward. What they cannot
     * do is give an empty pool a runway: the balance is already overdrawn by
     * the grants that produced them, and the exhaustion month is read off the
     * *opening* balance plus the top-up, never off the returns.
     */
    expect(empty.years[0]?.returnedToPool).toBeGreaterThan(0);
    expect(empty.years[0]?.closingAvailable).toBeLessThan(0);
    expect(empty.exhaustion.monthIndex).toBe(0);
  });

  it('reports the balance signed, so the overdraft is visible rather than clamped', () => {
    for (const year of empty.years) {
      expect(year.closingAvailable).toBeLessThan(0);
    }
    expect(empty.closingAvailable).toBeLessThan(0);
  });
});

describe('a pool that already covers the plan', () => {
  const covered = calculateEsopPool(
    withInputs({ company: { existingUnallocatedOptions: 2_000_000 } }, SERIES_A_MARKET),
  );

  it('never exhausts, and supports the whole hiring plan', () => {
    expect(covered.current.exhaustion.exhausted).toBe(false);
    expect(covered.current.exhaustion.monthIndex).toBeNull();
    expect(covered.current.exhaustion.hiresSupported).toBe(115);
  });

  it('recommends nothing further, and says the existing pool is enough', () => {
    expect(covered.recommendedPool.selected.poolOptions).toBe(0);
    expect(covered.recommendedPool.selected.poolPctOfFullyDiluted).toBe(0);
  });

  it('gives the two series the same opening pool, so they agree year for year', () => {
    expect(covered.recommended.openingPoolOptions).toBe(covered.current.openingPoolOptions);
    expect(covered.recommended.years.map((year) => year.closingAvailable)).toEqual(
      covered.current.years.map((year) => year.closingAvailable),
    );
  });
});

describe('item 1 under both bases', () => {
  it('swaps the two figures when the two bases are swapped', () => {
    const swapped = calculateEsopPool(
      withInputs(
        { grantPolicy: { grantBasis: BASIS_A, comparisonGrantBasis: BASIS_B } },
        SERIES_A_MARKET,
      ),
    );

    expect(swapped.recommendedPool.selected.grantBasisKind).toBe('percentOfEquity');
    expect(swapped.recommendedPool.comparison.grantBasisKind).toBe('rupeeValue');
  });

  it('refuses a comparison basis of the same kind as the selected one', () => {
    expect(() =>
      calculateEsopPool(
        withInputs({ grantPolicy: { comparisonGrantBasis: BASIS_B } }, SERIES_A_MARKET),
      ),
    ).toThrow(EsopEngineError);
  });
});

describe('Basis A independence from valuation, through the assembler', () => {
  /**
   * Section 1 is the whole ballgame and it has been asserted at the grant level
   * and at the roll forward level. This is the same claim at the level a founder
   * actually meets it: change the growth rate, change nothing else, and a
   * percent-of-equity plan comes back with the identical pool.
   */
  const inputs = withInputs(
    {
      grantPolicy: { grantBasis: BASIS_A, comparisonGrantBasis: BASIS_B },
      /** Basis A grants are quoted in percent, so face value keeps the strike out of it. */
    },
    SERIES_A_MARKET,
  );

  const slow = calculateEsopPool(withInputs({ growth: { valuationGrowthPctPerYear: 0 } }, inputs));
  const fast = calculateEsopPool(
    withInputs({ growth: { valuationGrowthPctPerYear: 120 } }, inputs),
  );

  it('recommends exactly the same pool at 0% and at 120% growth', () => {
    expect(fast.recommendedPool.selected.poolOptions).toBe(
      slow.recommendedPool.selected.poolOptions,
    );
    expect(fast.recommendedPool.selected.poolPctOfFullyDiluted).toBe(
      slow.recommendedPool.selected.poolPctOfFullyDiluted,
    );
  });

  it('still moves the price per share, so the test cannot pass by doing nothing', () => {
    const slowLast = slow.recommended.years[3]?.pricePerShare ?? 0;
    const fastLast = fast.recommended.years[3]?.pricePerShare ?? 0;

    expect(fastLast / slowLast).toBeGreaterThan(9);
  });
});

describe('the warnings, each with a producer', () => {
  it('raises nothing when a face value strike is paired with the notional basis', () => {
    const clean = calculateEsopPool(
      withInputs({ grantPolicy: { strikePolicy: { kind: 'faceValue' } } }, SERIES_A_MARKET),
    );

    expect(clean.warnings).toEqual([]);
  });

  it('raises notionalValueOverstatesReceipt at a zero discount to FMV', () => {
    const atFmv = calculateEsopPool(
      withInputs(
        { grantPolicy: { strikePolicy: { kind: 'discountToFMV', discountPct: 0 } } },
        SERIES_A_MARKET,
      ),
    );

    expect(atFmv.warnings.map((warning) => warning.id)).toContain(
      'notionalValueOverstatesReceipt',
    );
  });

  it('does not raise it at a real discount, where the employee does get the discount', () => {
    const discounted = calculateEsopPool(
      withInputs(
        { grantPolicy: { strikePolicy: { kind: 'discountToFMV', discountPct: 30 } } },
        SERIES_A_MARKET,
      ),
    );

    expect(discounted.warnings.map((warning) => warning.id)).not.toContain(
      'notionalValueOverstatesReceipt',
    );
  });

  it('raises authorisedCapitalShortfall when the authorised capital will not cover the pool', () => {
    const short = calculateEsopPool(
      withInputs({ company: { authorisedCapitalShares: 10_000_000 } }, SERIES_A_MARKET),
    );

    expect(short.warnings.map((warning) => warning.id)).toContain('authorisedCapitalShortfall');
    expect(
      short.complianceChecks.find((check) => check.id === 'authorisedCapital')?.status,
    ).toBe('blocked');
  });

  it('raises seniorityMixDoesNotSumTo100 on a mix that loses hires', () => {
    const lossy = calculateEsopPool(
      withInputs(
        { hiring: { seniorityMix: { leadership: 5, senior: 20, mid: 45, junior: 20 } } },
        SERIES_A_MARKET,
      ),
    );

    expect(lossy.warnings.map((warning) => warning.id)).toContain('seniorityMixDoesNotSumTo100');
  });

  it('raises solverDidNotConverge on a plan that grants away more than the company', () => {
    const runaway = calculateEsopPool(
      withInputs(
        {
          grantPolicy: {
            grantBasis: {
              kind: 'percentOfEquity',
              grantPctByBand: { leadership: 20, senior: 20, mid: 20, junior: 20 },
            },
            comparisonGrantBasis: BASIS_B,
          },
          hiring: { hiresPerYear: [50, 50, 50, 50] },
        },
        SERIES_A_MARKET,
      ),
    );

    expect(runaway.solver.converged).toBe(false);
    expect(runaway.warnings.map((warning) => warning.id)).toContain('solverDidNotConverge');
  });
});

describe('the guards the assembler owns', () => {
  it('refuses a hiring plan shorter than its own horizon', () => {
    expect(() =>
      calculateEsopPool(
        withInputs({ hiring: { horizonYears: 5, hiresPerYear: [15, 25, 35, 40] } }, SERIES_A_MARKET),
      ),
    ).toThrow(/fewer years in it than the planning horizon/);
  });

  it('accepts a hiring plan longer than its horizon, and ignores the extra years', () => {
    const trimmed = calculateEsopPool(
      withInputs(
        { hiring: { horizonYears: 4, hiresPerYear: [15, 25, 35, 40, 45] } },
        SERIES_A_MARKET,
      ),
    );

    expect(trimmed.recommended.years).toHaveLength(4);
    expect(trimmed.recommendedPool.selected.poolOptions).toBe(
      base.recommendedPool.selected.poolOptions,
    );
  });

  it('refuses founder ownership that leaves the investors negative', () => {
    /**
     * The founders cannot hold 100% of a fully diluted count that includes an
     * unallocated pool nobody has been issued shares for. The company below
     * reserves 6% of itself as options, so 100% of fully diluted is 6% more
     * shares than the company has ever issued.
     */
    expect(() =>
      calculateEsopPool(
        withInputs(
          {
            company: {
              existingUnallocatedOptions: 600_000,
              founderOwnershipPctOfFullyDiluted: 100,
            },
          },
          SERIES_A_MARKET,
        ),
      ),
    ).toThrow(/investors on a negative holding/);
  });

  it('accepts founder ownership that exactly uses up the issued shares', () => {
    const allFounders = calculateEsopPool(
      withInputs({ company: { founderOwnershipPctOfFullyDiluted: 100 } }, SERIES_A_MARKET),
    );

    /** No pool and no grants yet, so fully diluted and issued are the same count. */
    expect(allFounders.capTables.before.rows[1]?.shares).toBe(0);
  });

  it('refuses a date that does not parse, rather than measuring a window from NaN', () => {
    expect(() =>
      calculateEsopPool(withInputs({ asOfDate: 'August 2026' }, SERIES_A_MARKET)),
    ).toThrow(EsopEngineError);
  });
});

describe('the median employee', () => {
  it('is the band the 50th percentile of the mix falls in', () => {
    expect(medianBand({ leadership: 5, senior: 20, mid: 45, junior: 30 })).toBe('mid');
    expect(medianBand({ leadership: 60, senior: 20, mid: 10, junior: 10 })).toBe('leadership');
    expect(medianBand({ leadership: 0, senior: 0, mid: 0, junior: 100 })).toBe('junior');
  });

  it('handles a mix that does not sum to 100 by normalising it', () => {
    /** Losing hires is a warning, not a reason to refuse to name a median band. */
    expect(medianBand({ leadership: 1, senior: 1, mid: 1, junior: 1 })).toBe('senior');
  });

  it('has no median at all when the mix is empty', () => {
    expect(medianBand({ leadership: 0, senior: 0, mid: 0, junior: 0 })).toBeNull();

    const nobody = calculateEsopPool(
      withInputs(
        { hiring: { seniorityMix: { leadership: 0, senior: 0, mid: 0, junior: 0 } } },
        SERIES_A_MARKET,
      ),
    );
    expect(nobody.medianEmployeeValue).toBeNull();
  });

  it('never nets the perquisite tax away when the deferral is available', () => {
    /**
     * The deferral changes when the tax falls, never whether it does. Reporting
     * a deferral as a discount would be the PROJECT.md prohibition one step
     * removed, so the two figures are identical and only the flag moves.
     */
    const deferred = calculateEsopPool(
      withInputs(
        { compliance: { dpiitRecognised: true, imbCertified80IAC: true } },
        SERIES_A_MARKET,
      ),
    );

    expect(deferred.medianEmployeeValue?.taxDeferralAvailable).toBe(true);
    expect(deferred.medianEmployeeValue?.perquisiteTaxRupees).toBe(
      base.medianEmployeeValue?.perquisiteTaxRupees,
    );
    expect(deferred.medianEmployeeValue?.realisableValueRupees).toBe(
      base.medianEmployeeValue?.realisableValueRupees,
    );
  });

  it('never claims the deferral on DPIIT recognition alone', () => {
    const dpiitOnly = calculateEsopPool(
      withInputs(
        { compliance: { dpiitRecognised: true, imbCertified80IAC: false } },
        SERIES_A_MARKET,
      ),
    );

    expect(dpiitOnly.medianEmployeeValue?.taxDeferralAvailable).toBe(false);
    expect(dpiitOnly.complianceChecks.find((check) => check.id === 'taxDeferral')?.status).toBe(
      'warn',
    );
  });
});

describe('the benchmark comparison', () => {
  it('reports both tracks for every stage, even where a track has no band', () => {
    const preSeed = calculateEsopPool(
      withInputs({ company: { stage: 'preSeed' } }, SERIES_A_MARKET),
    );

    expect(preSeed.benchmarkComparison.tracks).toHaveLength(2);
    /** The observed study never looked at pre-seed, and says so rather than guessing. */
    expect(preSeed.benchmarkComparison.tracks[1]?.position).toBe('noBandForStage');
    expect(preSeed.benchmarkComparison.tracks[1]?.band).toBeNull();
  });

  it('puts a large pool above the advisory band', () => {
    const large = calculateEsopPool(
      withInputs(
        { grantPolicy: { grantBasis: BASIS_A, comparisonGrantBasis: BASIS_B } },
        SERIES_A_MARKET,
      ),
    );

    /** Basis A at the advisory midpoints wants 17.1%, over the 12-15% Series A band. */
    expect(large.benchmarkComparison.tracks[0]?.position).toBe('above');
  });
});

describe('the cap tables', () => {
  it('never moves the founders share count, only their percentage', () => {
    const before = base.capTables.before.rows[0];
    const after = base.capTables.after.rows[0];

    expect(before?.shares).toBe(after?.shares);
    expect(after?.pctOfFullyDiluted).toBeLessThan(before?.pctOfFullyDiluted ?? 0);
  });

  it('balances: every row sums to the total, on every table', () => {
    for (const table of [base.capTables.before, base.capTables.after]) {
      const shares = table.rows.reduce((sum, row) => sum + row.shares, 0);
      expect(shares).toBeCloseTo(table.total.shares, 6);
      expect(table.total.pctOfFullyDiluted).toBe(100);
    }
  });
});
