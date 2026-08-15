/**
 * A plausible seed-stage Indian company, and the knobs to bend it.
 *
 * Sections 4.3 to 4.5 take the whole input object rather than four numbers, so
 * the alternative to a fixture is every test restating twenty fields and
 * quietly disagreeing with the next test about what a normal company looks like.
 *
 * Every value here is either a v2 default from `DEFAULTS` or a company fact a
 * founder would type. Nothing is tuned to make a test pass.
 */

import { DEFAULTS, DEFAULT_GRANT_PCT_BY_BAND, DEFAULT_GRANT_VALUE_BY_BAND } from '../defaults';
import type { RollForwardArgs } from '../roll-forward';
import type {
  AttritionInputs,
  CompanyInputs,
  ExerciseInputs,
  GrantBasis,
  GrantPolicyInputs,
  GrowthInputs,
  HiringPlan,
  SeniorityMix,
  VestingSchedule,
} from '../types';

export const BASIS_A: GrantBasis = {
  kind: 'percentOfEquity',
  grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND,
};

export const BASIS_B: GrantBasis = {
  kind: 'rupeeValue',
  grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND,
};

export const SENIORITY_MIX: SeniorityMix = DEFAULTS.seniorityMixPct.value;

export const COMPANY: CompanyInputs = {
  stage: 'seed',
  companyType: 'private',
  postMoneyValuation: 500_000_000,
  fullyDilutedShares: 10_000_000,
  existingUnallocatedOptions: 600_000,
  grantedOutstandingOptions: 0,
  faceValuePerShare: 10,
  authorisedCapitalShares: 12_000_000,
};

export const HIRING: HiringPlan = {
  horizonYears: 4,
  hiresPerYear: [15, 25, 35, 40],
  seniorityMix: SENIORITY_MIX,
};

export const GROWTH: GrowthInputs = {
  valuationGrowthPctPerYear: DEFAULTS.valuationGrowthPctPerYear.value,
};

export const VESTING: VestingSchedule = {
  cliffMonths: DEFAULTS.cliffMonths.value,
  vestYears: DEFAULTS.vestYears.value,
  frequency: DEFAULTS.vestFrequency.value,
};

export const ATTRITION: AttritionInputs = {
  baseAnnualPct: DEFAULTS.attritionBaseAnnualPct.value,
  byBand: DEFAULTS.attritionByBandPct.value,
  sector: 'general',
};

export const EXERCISE: ExerciseInputs = {
  exerciseWindowDays: DEFAULTS.exerciseWindowDays.value,
  vestedNeverExercisedPct: DEFAULTS.vestedNeverExercisedPct.value,
  continuingEmployeeExercisePctPerYear:
    DEFAULTS.continuingEmployeeExercisePctPerYear.value,
  recycleForfeited: DEFAULTS.recycleForfeited.value,
};

export const GRANT_POLICY: GrantPolicyInputs = {
  grantBasis: BASIS_A,
  strikePolicy: { kind: 'faceValue' },
  valueBasis: DEFAULTS.valueBasis.value,
  compInflationPctPerYear: DEFAULTS.compInflationPctPerYear.value,
  refresh: {
    ratePct: DEFAULTS.refreshRatePct.value,
    sizePct: DEFAULTS.refreshSizePct.value,
    eligibilityMonths: DEFAULTS.refreshEligibilityMonths.value,
  },
  bufferPct: DEFAULTS.bufferPct.value,
  fairValue: {
    theta: DEFAULTS.theta.value,
    expectedLifeYears: DEFAULTS.expectedLifeYears.value,
    volatilityPct: DEFAULTS.volatilityPct.value,
  },
};

export const BASE_ARGS: RollForwardArgs = {
  company: COMPANY,
  hiring: HIRING,
  growth: GROWTH,
  grantPolicy: GRANT_POLICY,
  attrition: ATTRITION,
  exercise: EXERCISE,
  vesting: VESTING,
  topUps: [],
};

/** Overrides go one level into each named section, so a test can bend one field. */
export interface ArgOverrides {
  readonly company?: Partial<CompanyInputs>;
  readonly hiring?: Partial<HiringPlan>;
  readonly growth?: Partial<GrowthInputs>;
  readonly grantPolicy?: Partial<GrantPolicyInputs>;
  readonly attrition?: Partial<AttritionInputs>;
  readonly exercise?: Partial<ExerciseInputs>;
  readonly vesting?: Partial<VestingSchedule>;
  readonly topUps?: RollForwardArgs['topUps'];
  readonly openingCohorts?: RollForwardArgs['openingCohorts'];
  readonly openingHeadcount?: RollForwardArgs['openingHeadcount'];
  readonly fullyDilutedSharesAtStart?: number;
  readonly openingAvailableOptions?: number;
}

export function withArgs(
  overrides: ArgOverrides,
  base: RollForwardArgs = BASE_ARGS,
): RollForwardArgs {
  return {
    company: { ...base.company, ...overrides.company },
    hiring: { ...base.hiring, ...overrides.hiring },
    growth: { ...base.growth, ...overrides.growth },
    grantPolicy: { ...base.grantPolicy, ...overrides.grantPolicy },
    attrition: { ...base.attrition, ...overrides.attrition },
    exercise: { ...base.exercise, ...overrides.exercise },
    vesting: { ...base.vesting, ...overrides.vesting },
    topUps: overrides.topUps ?? base.topUps,
    openingCohorts: overrides.openingCohorts ?? base.openingCohorts,
    openingHeadcount: overrides.openingHeadcount ?? base.openingHeadcount,
    fullyDilutedSharesAtStart:
      overrides.fullyDilutedSharesAtStart ?? base.fullyDilutedSharesAtStart,
    openingAvailableOptions: overrides.openingAvailableOptions ?? base.openingAvailableOptions,
  };
}
