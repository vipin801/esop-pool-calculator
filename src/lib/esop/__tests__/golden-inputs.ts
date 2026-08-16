/**
 * The golden fixtures: the exact company the front-end build is showing today.
 *
 * These are the inputs visible in the Magic Patterns build at
 * `C:\Users\Vipin\Desktop\How big should your ESOP pool be` — Series A, a four
 * year horizon, 15/25/35/40 hires, a 5/20/45/30 seniority mix, the Market grant
 * preset, and the 40% growth path that produces ₹150.0 / 210.0 / 294.0 / 411.6
 * crore. Everything a founder can see on that screen is reproduced here; nothing
 * is tuned.
 *
 * Two fixtures, and the difference between them is the whole point.
 *
 * `SERIES_A_MARKET` runs those inputs against the **spec's v2 defaults**, which
 * is what this engine is for. `SERIES_A_MARKET_AT_V1_ASSUMPTIONS` runs the same
 * inputs against the **v1 assumptions the front-end build still carries** —
 * attrition 18%, lapse 35% — which ENGINE_SPEC.md section 6 corrects to 15% and
 * 50%. Holding the assumptions constant is the only way to reconcile: a delta
 * measured across two different attrition rates says nothing about whether
 * either model is right.
 *
 * The front-end build's own reported figures are recorded in
 * `docs/esop/LOG.md` entry [020], beside what this engine returns for the same
 * company and why the two differ.
 */

import { DEFAULTS, DEFAULT_GRANT_PCT_BY_BAND } from '../defaults';
import type {
  AttritionInputs,
  CompanyInputs,
  ComplianceInputs,
  EmployeeValueInputs,
  EsopInputs,
  ExerciseInputs,
  FundingRound,
  GrantBasis,
  GrantPolicyInputs,
  GrowthInputs,
  HiringPlan,
  VestingSchedule,
} from '../types';

/** The Market preset. The same four figures the build's `MARKET_GRANTS` holds. */
export const MARKET_GRANT_VALUES: GrantBasis = {
  kind: 'rupeeValue',
  grantValueByBand: {
    leadership: 8_000_000,
    senior: 2_500_000,
    mid: 1_000_000,
    junior: 300_000,
  },
};

/** Item 1's other basis. Basis A at the spec's own advisory midpoints, M1. */
export const COMPARISON_BASIS_A: GrantBasis = {
  kind: 'percentOfEquity',
  grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND,
};

/**
 * ₹150 crore post-money on a crore of shares, ₹10 par, ₹12 crore authorised.
 *
 * Founder ownership is the build's own Series A estimate. It is only read for
 * the cap tables and the round; no pool figure depends on it.
 */
export const GOLDEN_COMPANY: CompanyInputs = {
  stage: 'seriesA',
  companyType: 'private',
  postMoneyValuation: 1_500_000_000,
  fullyDilutedShares: 10_000_000,
  existingUnallocatedOptions: 0,
  grantedOutstandingOptions: 0,
  faceValuePerShare: 10,
  authorisedCapitalShares: 12_000_000,
  founderOwnershipPctOfFullyDiluted: 58,
};

export const GOLDEN_HIRING: HiringPlan = {
  horizonYears: 4,
  hiresPerYear: [15, 25, 35, 40],
  seniorityMix: { leadership: 5, senior: 20, mid: 45, junior: 30 },
};

/** 40% a year: ₹150.0, 210.0, 294.0, 411.6 crore. */
export const GOLDEN_GROWTH: GrowthInputs = { valuationGrowthPctPerYear: 40 };

/**
 * Series A defaults: rupee grants at the last round price, quoted notionally.
 *
 * That combination is exactly the one ENGINE_SPEC.md section 8 wants a warning
 * on, and the engine raises it — the strike sits at fair market value, so the
 * headline grant value overstates what an employee banks. It is the default
 * because it is what Indian Series A offer letters actually say, not because it
 * is the honest basis.
 */
export const GOLDEN_GRANT_POLICY: GrantPolicyInputs = {
  grantBasis: MARKET_GRANT_VALUES,
  comparisonGrantBasis: COMPARISON_BASIS_A,
  strikePolicy: { kind: 'lastRoundPrice' },
  valueBasis: 'notional',
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

/** Spec section 6: 15%, not v1's 18%. */
export const GOLDEN_ATTRITION: AttritionInputs = {
  baseAnnualPct: DEFAULTS.attritionBaseAnnualPct.value,
  byBand: DEFAULTS.attritionByBandPct.value,
  sector: 'general',
};

/** Spec section 6: lambda 50%, not v1's 35%. */
export const GOLDEN_EXERCISE: ExerciseInputs = {
  exerciseWindowDays: DEFAULTS.exerciseWindowDays.value,
  vestedNeverExercisedPct: DEFAULTS.vestedNeverExercisedPct.value,
  continuingEmployeeExercisePctPerYear: DEFAULTS.continuingEmployeeExercisePctPerYear.value,
  recycleForfeited: DEFAULTS.recycleForfeited.value,
};

export const GOLDEN_VESTING: VestingSchedule = {
  cliffMonths: DEFAULTS.cliffMonths.value,
  vestYears: DEFAULTS.vestYears.value,
  frequency: DEFAULTS.vestFrequency.value,
};

/** The build carries one DPIIT toggle. D4 requires two, and both are off here. */
export const GOLDEN_COMPLIANCE: ComplianceInputs = {
  dpiitRecognised: false,
  imbCertified80IAC: false,
  incorporationDate: '2022-04-01',
  grantsToGroupCompanyEmployees: false,
  anyIndividualGrantAtOrAbove1Pct: false,
  accountingBasis: DEFAULTS.accountingBasis.value,
  instrument: 'ESOP',
};

/** The top slab, before surcharge and cess. An estimate, and editable. */
export const GOLDEN_EMPLOYEE_VALUE: EmployeeValueInputs = { marginalTaxRatePct: 30 };

/** The date the fixtures are struck as at. Never a clock. */
export const GOLDEN_AS_OF_DATE = '2026-08-16';

/** The fixture. Spec v2 defaults throughout. */
export const SERIES_A_MARKET: EsopInputs = {
  company: GOLDEN_COMPANY,
  hiring: GOLDEN_HIRING,
  growth: GOLDEN_GROWTH,
  grantPolicy: GOLDEN_GRANT_POLICY,
  attrition: GOLDEN_ATTRITION,
  exercise: GOLDEN_EXERCISE,
  vesting: GOLDEN_VESTING,
  compliance: GOLDEN_COMPLIANCE,
  employeeValue: GOLDEN_EMPLOYEE_VALUE,
  rounds: [],
  topUps: [],
  openingGrants: [],
  openingHeadcount: [],
  asOfDate: GOLDEN_AS_OF_DATE,
};

/**
 * The same company at the front-end build's own v1 assumptions.
 *
 * Only two fields move — attrition 15 to 18, lambda 50 to 35 — and they are the
 * two ENGINE_SPEC.md section 6 corrects. This fixture exists so the
 * reconciliation in LOG [020] can hold the assumptions still and measure what
 * the *model* does differently, rather than adding up two unrelated changes and
 * calling the sum a discrepancy.
 */
export const SERIES_A_MARKET_AT_V1_ASSUMPTIONS: EsopInputs = {
  ...SERIES_A_MARKET,
  attrition: { ...GOLDEN_ATTRITION, baseAnnualPct: 18 },
  exercise: { ...GOLDEN_EXERCISE, vestedNeverExercisedPct: 35 },
};

/**
 * A Series B term sheet at the end of year 1, so spec output items 3, 4 and the
 * third cap table have a golden case of their own.
 *
 * ₹400 crore pre-money, ₹100 crore in, and an investor asking for a 15% pool
 * post-round, cut pre-money — which is what almost every Indian term sheet
 * proposes and what item 4 exists to put a price on.
 */
export const NEXT_ROUND: FundingRound = {
  id: 'seriesB',
  label: 'Series B',
  year: 1,
  preMoneyValuation: 4_000_000_000,
  raiseAmount: 1_000_000_000,
  investorRequiredPostRoundPoolPct: 15,
  poolCreation: 'preMoney',
};

export const SERIES_A_MARKET_WITH_ROUND: EsopInputs = {
  ...SERIES_A_MARKET,
  rounds: [NEXT_ROUND],
};
