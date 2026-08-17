import { describe, expect, it } from 'vitest';
import type { EsopInputs } from '@/lib/esop';
import { requiredFieldPaths } from '../lib/completeness';
import { buildSeedInputs } from '../lib/seedInputs';
import { showsSeededDefault, tierFor } from '../lib/visibility';

const BASE = buildSeedInputs(new Date('2026-01-01T00:00:00.000Z'));

function withInputs(patch: {
  readonly company?: Partial<EsopInputs['company']>;
  readonly grantPolicy?: Partial<EsopInputs['grantPolicy']>;
  readonly exercise?: Partial<EsopInputs['exercise']>;
  readonly rounds?: EsopInputs['rounds'];
}): EsopInputs {
  return {
    ...BASE,
    ...(patch.company ? { company: { ...BASE.company, ...patch.company } } : {}),
    ...(patch.grantPolicy ? { grantPolicy: { ...BASE.grantPolicy, ...patch.grantPolicy } } : {}),
    ...(patch.exercise ? { exercise: { ...BASE.exercise, ...patch.exercise } } : {}),
    ...(patch.rounds ? { rounds: patch.rounds } : {}),
  };
}

const PERCENT_OF_EQUITY = withInputs({ grantPolicy: { grantBasis: { kind: 'percentOfEquity', grantPctByBand: { leadership: 1, senior: 0.5, mid: 0.2, junior: 0.1 } } } });
const RUPEE_NOTIONAL = withInputs({ grantPolicy: { grantBasis: { kind: 'rupeeValue', grantValueByBand: { leadership: 4000000, senior: 2500000, mid: 1200000, junior: 600000 } }, valueBasis: 'notional', strikePolicy: { kind: 'faceValue' } } });
const RUPEE_REALISABLE = withInputs({ grantPolicy: { ...RUPEE_NOTIONAL.grantPolicy, valueBasis: 'realisable', strikePolicy: { kind: 'lastRoundPrice' } } });
const RUPEE_FAIR_VALUE = withInputs({ grantPolicy: { ...RUPEE_NOTIONAL.grantPolicy, valueBasis: 'fairValue', strikePolicy: { kind: 'lastRoundPrice' } } });

describe('tierFor', () => {
  describe('company.postMoneyValuation — live under Basis B only', () => {
    it('is reportOnly under percent-of-equity', () => {
      expect(tierFor('company.postMoneyValuation', PERCENT_OF_EQUITY)).toBe('reportOnly');
    });
    it('drives the pool under rupee value', () => {
      expect(tierFor('company.postMoneyValuation', RUPEE_NOTIONAL)).toBe('drivesPool');
    });
  });

  describe('granted and outstanding — live when recycling or refresh is on', () => {
    const neither = withInputs({ exercise: { recycleForfeited: false }, grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 0 } } });
    it('is reportOnly when neither recycling nor refresh is on', () => {
      expect(tierFor('company.grantedOutstandingOptions', neither)).toBe('reportOnly');
      expect(tierFor('openingGrants.0.band', neither)).toBe('reportOnly');
    });
    it('drives the pool when recycling is on', () => {
      const recycling = withInputs({ exercise: { recycleForfeited: true }, grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 0 } } });
      expect(tierFor('company.grantedOutstandingOptions', recycling)).toBe('drivesPool');
    });
    it('drives the pool when refresh is on, even with recycling off', () => {
      const refreshing = withInputs({ exercise: { recycleForfeited: false }, grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 25 } } });
      expect(tierFor('company.grantedOutstandingOptions', refreshing)).toBe('drivesPool');
    });
  });

  describe('valuation growth — drives the pool under Basis B regardless of a modelled round (Correction 3)', () => {
    it('is hidden under percent-of-equity', () => {
      expect(tierFor('growth.valuationGrowthPctPerYear', PERCENT_OF_EQUITY)).toBe('hidden');
    });
    it('drives the pool under rupee value with no round modelled', () => {
      expect(tierFor('growth.valuationGrowthPctPerYear', RUPEE_NOTIONAL)).toBe('drivesPool');
    });
    it('still drives the pool under rupee value even with a round modelled', () => {
      const withRound = withInputs({
        grantPolicy: RUPEE_NOTIONAL.grantPolicy,
        rounds: [{ id: 'r', label: 'Round', year: 1, preMoneyValuation: 1, raiseAmount: 1, investorRequiredPostRoundPoolPct: 10, poolCreation: 'preMoney' }],
      });
      expect(tierFor('growth.valuationGrowthPctPerYear', withRound)).toBe('drivesPool');
    });
  });

  describe('comp inflation and value basis — visible under Basis B, hidden under Basis A', () => {
    it.each(['grantPolicy.compInflationPctPerYear', 'grantPolicy.valueBasis'])('%s is hidden under percent-of-equity', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('hidden');
    });
    /** D9 §4: both have a default (8%, notional) and both moved to `minor`. */
    it.each(['grantPolicy.compInflationPctPerYear', 'grantPolicy.valueBasis'])('%s is minor under rupee value, not required', (path) => {
      expect(tierFor(path, RUPEE_NOTIONAL)).toBe('minor');
    });
  });

  describe('strike policy — live only under Basis B + realisable (Correction 2)', () => {
    it('is reportOnly under percent-of-equity', () => {
      expect(tierFor('grantPolicy.strikePolicy.kind', PERCENT_OF_EQUITY)).toBe('reportOnly');
    });
    it('is reportOnly under rupee value + notional', () => {
      expect(tierFor('grantPolicy.strikePolicy.kind', RUPEE_NOTIONAL)).toBe('reportOnly');
    });
    it('is reportOnly under rupee value + fair value — the strike cancels out of theta * PPS', () => {
      expect(tierFor('grantPolicy.strikePolicy.kind', RUPEE_FAIR_VALUE)).toBe('reportOnly');
    });
    it('drives the pool under rupee value + realisable', () => {
      expect(tierFor('grantPolicy.strikePolicy.kind', RUPEE_REALISABLE)).toBe('drivesPool');
    });
  });

  describe('theta — live only under Basis B + fair value', () => {
    it('is hidden under percent-of-equity', () => {
      expect(tierFor('grantPolicy.fairValue.theta', PERCENT_OF_EQUITY)).toBe('hidden');
    });
    it('is hidden under rupee value + notional', () => {
      expect(tierFor('grantPolicy.fairValue.theta', RUPEE_NOTIONAL)).toBe('hidden');
    });
    it('is hidden under rupee value + realisable', () => {
      expect(tierFor('grantPolicy.fairValue.theta', RUPEE_REALISABLE)).toBe('hidden');
    });
    it('drives the pool under rupee value + fair value', () => {
      expect(tierFor('grantPolicy.fairValue.theta', RUPEE_FAIR_VALUE)).toBe('drivesPool');
    });
  });

  describe('refresh rate and size — hidden until the refresh toggle is on', () => {
    /** D9 §4 made the toggle optional and it defaults to on, so its sub-fields
     *  are `minor` too: a default the founder never chose cannot demand two
     *  fields of its own. */
    it('is minor, not required, once the refresh rate is above zero', () => {
      const on = withInputs({ grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 25 } } });
      expect(tierFor('grantPolicy.refresh.ratePct', on)).toBe('minor');
      expect(tierFor('grantPolicy.refresh.sizePct', on)).toBe('minor');
    });
    it('is hidden when the refresh rate is exactly zero', () => {
      const off = withInputs({ grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 0 } } });
      expect(tierFor('grantPolicy.refresh.ratePct', off)).toBe('hidden');
      expect(tierFor('grantPolicy.refresh.sizePct', off)).toBe('hidden');
    });
  });

  describe('leavers and recycling — minor, never hidden, when recycling is off (Correction 1)', () => {
    const off = withInputs({ exercise: { recycleForfeited: false } });
    const on = withInputs({ exercise: { recycleForfeited: true } });

    it.each([
      'attrition.sector',
      'attrition.baseAnnualPct',
      'attrition.byBand.leadership',
      'vesting.cliffMonths',
      'vesting.vestYears',
      'vesting.frequency',
      'exercise.vestedNeverExercisedPct',
    ])('%s is minor, not hidden, when recycling is off', (path) => {
      expect(tierFor(path, off)).toBe('minor');
    });

    /** D9 §4 took the recycle toggle itself to `minor`, so these can no longer
     *  step up to required with it: they would then be demanded by a default
     *  the founder never chose. Every one of them has a spec default (15%
     *  attrition, a 12-month cliff, 4 years, 50% lapse), so they are `minor`
     *  in both states now — Correction 1's "never hidden" reading holds
     *  unconditionally rather than only in the off state. */
    it.each([
      'attrition.sector',
      'attrition.baseAnnualPct',
      'attrition.byBand.leadership',
      'vesting.cliffMonths',
      'vesting.vestYears',
      'vesting.frequency',
      'exercise.vestedNeverExercisedPct',
    ])('%s is minor, not required, when recycling is on', (path) => {
      expect(tierFor(path, on)).toBe('minor');
    });

    it('the exercise window is always minor, recycling on or off, since the engine reads it nowhere', () => {
      expect(tierFor('exercise.exerciseWindowDays', off)).toBe('minor');
      expect(tierFor('exercise.exerciseWindowDays', on)).toBe('minor');
    });
  });

  describe('section 07 — always reportOnly, independent of every other choice', () => {
    it.each([
      'company.founderOwnershipPctOfFullyDiluted',
      'company.authorisedCapitalShares',
      'company.faceValuePerShare',
      'company.companyType',
      'compliance.dpiitRecognised',
      'compliance.imbCertified80IAC',
      'compliance.incorporationDate',
      'compliance.grantsToGroupCompanyEmployees',
      'compliance.anyIndividualGrantAtOrAbove1Pct',
      'compliance.accountingBasis',
      'employeeValue.marginalTaxRatePct',
      'exercise.continuingEmployeeExercisePctPerYear',
      'rounds.0.year',
      'rounds.0.preMoneyValuation',
      'rounds.0.raiseAmount',
      'rounds.0.investorRequiredPostRoundPoolPct',
      'rounds.0.poolCreation',
    ])('%s is reportOnly under every combination tried', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('reportOnly');
      expect(tierFor(path, RUPEE_REALISABLE)).toBe('reportOnly');
      expect(tierFor(path, withInputs({ exercise: { recycleForfeited: true } }))).toBe('reportOnly');
    });
  });

  /**
   * D9 §3 split what used to be one "unconditional fields default to
   * drivesPool" case. The same twelve paths are still covered; six of them
   * changed tier and are asserted below rather than dropped.
   */
  describe('D9 §3 — the inputs no honest default exists for stay required', () => {
    it.each([
      'company.stage',
      'grantPolicy.grantBasis.kind',
      'company.fullyDilutedShares',
      'company.existingUnallocatedOptions',
      'hiring.horizonYears',
      'hiring.hiresPerYear.0',
    ])('%s drives the pool regardless of basis', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('drivesPool');
      expect(tierFor(path, RUPEE_NOTIONAL)).toBe('drivesPool');
    });

    it('requires every year of the hiring plan, however long the horizon', () => {
      const longHorizon = { ...BASE, hiring: { ...BASE.hiring, horizonYears: 6 } };
      for (let i = 0; i < 6; i++) {
        expect(tierFor(`hiring.hiresPerYear.${i}`, longHorizon)).toBe('drivesPool');
      }
    });
  });

  describe('D9 §4 — the defaulted drivers drop to minor, still visible and editable', () => {
    it.each([
      'hiring.seniorityMix.leadership',
      'hiring.seniorityMix.junior',
      'grantPolicy.bufferPct',
      'exercise.recycleForfeited',
      'grantPolicy.refresh.enabled',
      'rounds.enabled',
    ])('%s is minor regardless of basis', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('minor');
      expect(tierFor(path, RUPEE_NOTIONAL)).toBe('minor');
    });

    it('drops the grant size per band under whichever basis is selected', () => {
      expect(tierFor('grantPolicy.grantBasis.grantPctByBand.senior', PERCENT_OF_EQUITY)).toBe('minor');
      expect(tierFor('grantPolicy.grantBasis.grantValueByBand.senior', RUPEE_NOTIONAL)).toBe('minor');
    });
  });

  /**
   * D9 §5. Only `minor` shows its seeded default; `drivesPool` keeps D7's
   * blank start, which is the mechanism by which it is required at all, and
   * `reportOnly` keeps it too because those seeds are invented company facts
   * rather than assumptions the engine is making.
   */
  describe('showsSeededDefault — minor and nothing else', () => {
    it.each(['grantPolicy.bufferPct', 'attrition.baseAnnualPct', 'vesting.cliffMonths', 'exercise.recycleForfeited'])(
      '%s shows the value being used for it',
      (path) => {
        expect(showsSeededDefault(path, RUPEE_NOTIONAL)).toBe(true);
      },
    );

    it.each(['company.stage', 'company.fullyDilutedShares', 'hiring.hiresPerYear.0', 'company.postMoneyValuation'])(
      '%s stays blank until entered',
      (path) => {
        expect(showsSeededDefault(path, RUPEE_NOTIONAL)).toBe(false);
      },
    );

    it.each(['compliance.incorporationDate', 'company.founderOwnershipPctOfFullyDiluted', 'rounds.0.preMoneyValuation'])(
      '%s stays blank because its seed is an invented company fact',
      (path) => {
        expect(showsSeededDefault(path, RUPEE_NOTIONAL)).toBe(false);
      },
    );

    it('says nothing about a hidden field, which is not rendered at all', () => {
      expect(tierFor('growth.valuationGrowthPctPerYear', PERCENT_OF_EQUITY)).toBe('hidden');
      expect(showsSeededDefault('growth.valuationGrowthPctPerYear', PERCENT_OF_EQUITY)).toBe(false);
    });
  });
});

/**
 * The required set, pinned path by path rather than only counted.
 *
 * `tierFor`'s catch-all is `minor`, so a company-specific field added later
 * and left off `REQUIRED_ALWAYS` would silently become optional. Nothing in
 * the tier spot-checks above would catch that; this does. It is also where
 * D9 §6's "measure, don't trust the brief" lands: the counts in PROJECT.md
 * come from here.
 */
describe('requiredFieldPaths', () => {
  const BASIS_A = withInputs({
    grantPolicy: {
      grantBasis: { kind: 'percentOfEquity', grantPctByBand: { leadership: 0.9, senior: 0.225, mid: 0.1, junior: 0.06 } },
      comparisonGrantBasis: { kind: 'rupeeValue', grantValueByBand: { leadership: 8_000_000, senior: 2_500_000, mid: 1_000_000, junior: 300_000 } },
    },
  });

  /** Basis A at the seed: recycling and refresh are both on by default, and
   *  neither now pulls a field of its own into the required set. */
  it('asks a Basis A founder for ten fields, all of them facts only they hold', () => {
    expect([...requiredFieldPaths(BASIS_A)]).toEqual([
      'company.stage',
      'grantPolicy.grantBasis.kind',
      'company.fullyDilutedShares',
      'company.existingUnallocatedOptions',
      'company.grantedOutstandingOptions',
      'hiring.horizonYears',
      'hiring.hiresPerYear.0',
      'hiring.hiresPerYear.1',
      'hiring.hiresPerYear.2',
      'hiring.hiresPerYear.3',
    ]);
  });

  /** Basis B adds exactly the two §3 names it adds: the valuation the rupee
   *  promise is priced against, and the growth ENGINE_SPEC §1 makes the
   *  largest single driver. */
  it('asks a Basis B founder for those plus the valuation and its growth', () => {
    const extra = requiredFieldPaths(BASE).filter((path) => !requiredFieldPaths(BASIS_A).includes(path));
    expect(extra).toEqual(['company.postMoneyValuation', 'growth.valuationGrowthPctPerYear']);
  });

  it('adds the strike policy only where it decides the denominator', () => {
    expect(requiredFieldPaths(RUPEE_REALISABLE)).toContain('grantPolicy.strikePolicy.kind');
    expect(requiredFieldPaths(RUPEE_NOTIONAL)).not.toContain('grantPolicy.strikePolicy.kind');
    expect(requiredFieldPaths(RUPEE_FAIR_VALUE)).not.toContain('grantPolicy.strikePolicy.kind');
  });

  it('adds theta only where fair value reads it', () => {
    expect(requiredFieldPaths(RUPEE_FAIR_VALUE)).toContain('grantPolicy.fairValue.theta');
    expect(requiredFieldPaths(RUPEE_NOTIONAL)).not.toContain('grantPolicy.fairValue.theta');
  });

  /** M21: the engine refuses to invent a grant year and a band, so the two
   *  cohort fields stay required once there is a cohort to describe. */
  it('adds the opening cohort once something has been granted', () => {
    const withGrants = { ...BASIS_A, company: { ...BASIS_A.company, grantedOutstandingOptions: 250_000 } };
    const required = requiredFieldPaths(withGrants);
    expect(required).toContain('openingGrants.0.band');
    expect(required).toContain('openingGrants.0.ageYearsAtPlanStart');
  });

  it('asks for nothing from sections 05, 06 or 07 under either basis', () => {
    for (const inputs of [BASIS_A, BASE]) {
      const required = requiredFieldPaths(inputs);
      for (const path of required) {
        expect(path).not.toMatch(/^(attrition|vesting|compliance|employeeValue|rounds)\./);
      }
      expect(required).not.toContain('exercise.recycleForfeited');
      expect(required).not.toContain('exercise.vestedNeverExercisedPct');
      expect(required).not.toContain('exercise.exerciseWindowDays');
    }
  });
});
