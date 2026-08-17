import { describe, expect, it } from 'vitest';
import type { EsopInputs } from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import { tierFor } from '../lib/visibility';

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

  describe('comp inflation and value basis — live under Basis B, hidden under Basis A', () => {
    it.each(['grantPolicy.compInflationPctPerYear', 'grantPolicy.valueBasis'])('%s is hidden under percent-of-equity', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('hidden');
    });
    it.each(['grantPolicy.compInflationPctPerYear', 'grantPolicy.valueBasis'])('%s drives the pool under rupee value', (path) => {
      expect(tierFor(path, RUPEE_NOTIONAL)).toBe('drivesPool');
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
    it('drives the pool once the refresh rate is above zero', () => {
      const on = withInputs({ grantPolicy: { refresh: { ...BASE.grantPolicy.refresh, ratePct: 25 } } });
      expect(tierFor('grantPolicy.refresh.ratePct', on)).toBe('drivesPool');
      expect(tierFor('grantPolicy.refresh.sizePct', on)).toBe('drivesPool');
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

    it.each([
      'attrition.sector',
      'attrition.baseAnnualPct',
      'attrition.byBand.leadership',
      'vesting.cliffMonths',
      'vesting.vestYears',
      'vesting.frequency',
      'exercise.vestedNeverExercisedPct',
    ])('%s drives the pool when recycling is on', (path) => {
      expect(tierFor(path, on)).toBe('drivesPool');
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

  describe('unconditional fields default to drivesPool', () => {
    it.each([
      'company.stage',
      'grantPolicy.grantBasis.kind',
      'company.fullyDilutedShares',
      'company.existingUnallocatedOptions',
      'hiring.horizonYears',
      'hiring.hiresPerYear.0',
      'hiring.seniorityMix.leadership',
      'grantPolicy.grantBasis.grantPctByBand.senior',
      'grantPolicy.bufferPct',
      'exercise.recycleForfeited',
      'grantPolicy.refresh.enabled',
      'rounds.enabled',
    ])('%s drives the pool regardless of basis', (path) => {
      expect(tierFor(path, PERCENT_OF_EQUITY)).toBe('drivesPool');
      expect(tierFor(path, RUPEE_NOTIONAL)).toBe('drivesPool');
    });
  });
});
