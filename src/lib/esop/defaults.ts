/**
 * ESOP pool engine — v2 defaults.
 *
 * Source of truth: docs/esop/ENGINE_SPEC.md section 6, plus the values the spec
 * names inline in sections 1 to 5.
 *
 * PROJECT.md D6: every default here is an editable estimate, marked as such in
 * the UI, and never presented as sourced data. There is no `sourced` provenance
 * tier because we hold no measured data about the founder's own company.
 *
 * `estimate`    the spec states this value, or it is advisory consensus.
 * `provisional` the spec states no v2 value and this is a placeholder, or the
 *               figure is a dated third-party observation we have not verified.
 *               Every `provisional` entry is a to-do before launch.
 */

import type {
  Band,
  DefaultEntry,
  GrantBasisKind,
  Sector,
  Stage,
  StrikePolicyKind,
} from './types';

/** When every value below was last checked. The spec is current as at 14 August 2026. */
const AS_OF = '2026-08';

/* ------------------------------------------------------------------------- *
 * Statutory limits — law, not estimates
 * ------------------------------------------------------------------------- */

/**
 * These carry no provenance tag on purpose. They are legal constraints from
 * ENGINE_SPEC.md section 5, not modelling assumptions, and tagging them as
 * estimates would be a category error under D6.
 *
 * General information, not legal advice.
 */
export const STATUTORY = {
  /** Rule 12(6)(a). Minimum gap between grant and vesting. Block any input below this. */
  minVestingMonths: 12,
  /** A grant at or above this share of issued capital needs a separate resolution. */
  individualGrantSeparateResolutionPct: 1,
  /** Directors holding above this, directly or indirectly, are excluded absent DPIIT. */
  directorShareholdingExclusionPct: 10,
  /** GSR 127(E) dated 19 February 2019. DPIIT Rule 12 exemption, from incorporation. */
  dpiitExemptionYearsFromIncorporation: 10,
  /** MGT-14, SH-7 and PAS-3 all run to 30 days. */
  filingWindowDays: 30,
  /**
   * Section 392(3) read with Section 289(3), for shares allotted on or after
   * 1 April 2026. Up from 48 under the superseded Section 192(1C).
   */
  taxDeferralWindowMonths: 60,
} as const;

/* ------------------------------------------------------------------------- *
 * Solver parameters — spec-mandated algorithm constants, not estimates
 * ------------------------------------------------------------------------- */

/** ENGINE_SPEC.md section 4.5. Also untagged: these are the algorithm, not assumptions. */
export const SOLVER = {
  startPoolPct: 10,
  tolerancePctPoints: 0.01,
  maxIterations: 25,
  /** Round the displayed pool figure up to the nearest half point. */
  displayRoundingPctPoints: 0.5,
} as const;

/* ------------------------------------------------------------------------- *
 * The v2 defaults table
 * ------------------------------------------------------------------------- */

export const DEFAULTS = {
  /* --- Attrition. Spec section 6. --- */
  attritionBaseAnnualPct: {
    value: 15,
    provenance: 'estimate',
    what: 'Annual attrition, all bands. India overall ran 16.2% in 2025 and is projected around 13-14% for 2026. Carta puts startup employees holding equity at a 17.5% median.',
    asOf: AS_OF,
  },
  attritionByBandPct: {
    value: { leadership: 10 },
    provenance: 'provisional',
    what: 'Band override. Leadership churns slower than the base rate. The spec calls for band overrides but sets no numbers, so this is a placeholder. Bands absent here fall back to the base rate.',
    asOf: AS_OF,
  },
  attritionBySectorPct: {
    value: { general: 15, itServices: 14, ecommerce: 26.5 },
    provenance: 'estimate',
    what: 'Sector override. Midpoints of the spec ranges: IT services 13-15%, e-commerce 25-28%.',
    asOf: AS_OF,
  },

  /* --- Exercise behaviour. Spec sections 4.3 and 6. --- */
  vestedNeverExercisedPct: {
    value: 50,
    provenance: 'estimate',
    what: 'lambda. Share of vested options never exercised after exit, linked to the exercise window. Pre-liquidity exercise in India is rare because of the cash plus perquisite tax at exercise.',
    asOf: AS_OF,
  },
  vestedNeverExercisedRangePct: {
    value: { min: 30, max: 70 },
    provenance: 'estimate',
    what: 'Plausible range for lambda. One 2021 estimate put 70-80% of vested options in unicorns going unexercised. Treat as an assumption, never as data.',
    asOf: AS_OF,
  },
  exerciseWindowDays: {
    value: 90,
    provenance: 'estimate',
    what: 'Post-termination exercise window. Directly drives the lapse rate. Longer windows are becoming a differentiator.',
    asOf: AS_OF,
  },
  continuingEmployeeExercisePctPerYear: {
    value: 0,
    provenance: 'estimate',
    what: 'Exercises by employees who have not left. Zero is the realistic position for unlisted India: nobody exercises without a liquidity event unless the founder says otherwise.',
    asOf: AS_OF,
    intentionalZero: true,
  },
  recycleForfeited: {
    value: true,
    provenance: 'estimate',
    what: 'Whether forfeited unvested and lapsed vested options return to the pool. Most Indian schemes recycle.',
    asOf: AS_OF,
  },

  /* --- Grant policy. Spec sections 1, 2, 3 and 4.2. --- */
  compInflationPctPerYear: {
    value: 8,
    provenance: 'estimate',
    what: 'i. Comp inflation applied to grant values year on year.',
    asOf: AS_OF,
  },
  grantBasisByStage: {
    value: {
      preSeed: 'percentOfEquity',
      seed: 'percentOfEquity',
      seriesA: 'rupeeValue',
      seriesB: 'rupeeValue',
      seriesCPlus: 'rupeeValue',
    },
    provenance: 'estimate',
    what: 'Which grant basis to preselect. Percent of equity is common at pre-seed and seed; rupee value at Series A and beyond. Never silently pick one, always show the other as a comparison.',
    asOf: AS_OF,
  },
  valueBasis: {
    value: 'notional',
    provenance: 'estimate',
    what: 'Which of section 2\'s three denominators converts a rupee grant into options. Notional is what most Indian offer letters mean by "your grant is worth X", which is exactly why the engine computes the other two alongside it.',
    asOf: AS_OF,
  },
  strikePolicyByStage: {
    value: {
      preSeed: 'faceValue',
      seed: 'faceValue',
      seriesA: 'lastRoundPrice',
      seriesB: 'lastRoundPrice',
      seriesCPlus: 'lastRoundPrice',
    },
    provenance: 'estimate',
    what: 'Which strike policy to preselect. Face value at early stage minimises the employee perquisite exposure; the last round price is the growth-stage pole.',
    asOf: AS_OF,
  },
  grantPctLowByBand: {
    value: { leadership: 0.3, senior: 0.15, mid: 0.05, junior: 0.02 },
    provenance: 'estimate',
    what: 'Basis A advisory range, low end, percent of fully diluted equity per hire. Spec section 1.',
    asOf: AS_OF,
  },
  grantPctHighByBand: {
    value: { leadership: 1.5, senior: 0.3, mid: 0.15, junior: 0.1 },
    provenance: 'estimate',
    what: 'Basis A advisory range, high end, percent of fully diluted equity per hire. Spec section 1.',
    asOf: AS_OF,
  },
  grantPctByBand: {
    value: { leadership: 0.9, senior: 0.225, mid: 0.1, junior: 0.06 },
    provenance: 'estimate',
    what: 'Basis A starting point. Midpoint of the advisory range for each band, because the spec gives ranges and the form needs a point. Model decision M1 in PROJECT.md.',
    asOf: AS_OF,
  },
  grantValueByBand: {
    value: { leadership: 8000000, senior: 2500000, mid: 1000000, junior: 300000 },
    provenance: 'provisional',
    what: 'Basis B starting point, rupee grant value per hire. Carried from the v1 Magic Patterns prompt; the spec sets no v2 rupee figures. Needs a market check before launch.',
    asOf: AS_OF,
  },
  refreshEligibilityMonths: {
    value: 24,
    provenance: 'estimate',
    what: 'Tenure at which an employee becomes eligible for a refresh grant. Spec section 4.2.',
    asOf: AS_OF,
  },
  refreshRatePct: {
    value: 25,
    provenance: 'provisional',
    what: 'Share of eligible employees who get a refresh in a year. The spec gives the formula but no v2 value.',
    asOf: AS_OF,
  },
  refreshSizePct: {
    value: 40,
    provenance: 'provisional',
    what: 'Refresh size as a percentage of an initial grant for the band. The spec gives the formula but no v2 value.',
    asOf: AS_OF,
  },
  bufferPct: {
    value: 15,
    provenance: 'provisional',
    what: 'Headroom added to total consumption in the fixed point. The spec applies (1 + buffer) but sets no v2 value.',
    asOf: AS_OF,
  },

  /* --- Fair value. Spec section 2. --- */
  theta: {
    value: 0.55,
    provenance: 'estimate',
    what: 'Black-Scholes value ratio for a 4 year expected life, 60% volatility, strike at FMV. Approaches 1 as the strike approaches zero.',
    asOf: AS_OF,
  },
  expectedLifeYears: {
    value: 4,
    provenance: 'estimate',
    what: 'Expected life behind theta.',
    asOf: AS_OF,
  },
  volatilityPct: {
    value: 60,
    provenance: 'estimate',
    what: 'Volatility behind theta.',
    asOf: AS_OF,
  },

  /* --- Vesting. Spec sections 4.3 and 5. --- */
  cliffMonths: {
    value: 12,
    provenance: 'estimate',
    what: 'Cliff set to the statutory floor of 12 months under Rule 12(6)(a). Market practice sitting on the legal minimum, not a measurement.',
    asOf: AS_OF,
  },
  vestYears: {
    value: 4,
    provenance: 'estimate',
    what: 'k. Total vesting period. Four years is the Indian market convention.',
    asOf: AS_OF,
  },
  vestFrequency: {
    value: 'monthly',
    provenance: 'estimate',
    what: 'Vesting tick after the cliff. The spec vests linearly and does not model a tick, so this is presentational until the engine uses it.',
    asOf: AS_OF,
  },

  /* --- Hiring plan. The spec sets no v2 values for any of these. --- */
  horizonYears: {
    value: 4,
    provenance: 'provisional',
    what: 'T. Planning horizon. Placeholder; the spec sets no default horizon.',
    asOf: AS_OF,
  },
  hiresPerYear: {
    value: [15, 25, 35, 40, 45],
    provenance: 'provisional',
    what: 'Total hires per year, index 0 is year 1. Carried from the v1 Magic Patterns prompt. Placeholder for a founder-entered plan.',
    asOf: AS_OF,
  },
  seniorityMixPct: {
    value: { leadership: 5, senior: 20, mid: 45, junior: 30 },
    provenance: 'provisional',
    what: 'Share of hires by band, in percent. Must sum to 100. Carried from the v1 Magic Patterns prompt.',
    asOf: AS_OF,
  },

  /* --- Growth and accounting. --- */
  valuationGrowthPctPerYear: {
    value: 40,
    provenance: 'provisional',
    what: 'Post-money valuation growth. Irrelevant under Basis A, decisive under Basis B. The spec sets no v2 value.',
    asOf: AS_OF,
  },
  sector: {
    value: 'general',
    provenance: 'estimate',
    what: 'Sector used to pick the attrition override. General means no sector adjustment.',
    asOf: AS_OF,
  },
  accountingBasis: {
    value: 'indAS102',
    provenance: 'provisional',
    what: 'Ind AS 102 fair value. Companies not on Ind AS use the ICAI Guidance Note intrinsic value basis instead, so this depends on the company and should be asked, not assumed.',
    asOf: AS_OF,
  },
} as const satisfies Readonly<Record<string, DefaultEntry>>;

export type DefaultKey = keyof typeof DEFAULTS;

/* ------------------------------------------------------------------------- *
 * Narrow accessors — so callers get a real type, not a widened one
 * ------------------------------------------------------------------------- */

export const DEFAULT_GRANT_BASIS_BY_STAGE: Readonly<Record<Stage, GrantBasisKind>> =
  DEFAULTS.grantBasisByStage.value;

export const DEFAULT_STRIKE_POLICY_BY_STAGE: Readonly<Record<Stage, StrikePolicyKind>> =
  DEFAULTS.strikePolicyByStage.value;

export const DEFAULT_SENIORITY_MIX_PCT: Readonly<Record<Band, number>> =
  DEFAULTS.seniorityMixPct.value;

export const DEFAULT_GRANT_PCT_BY_BAND: Readonly<Record<Band, number>> =
  DEFAULTS.grantPctByBand.value;

export const DEFAULT_GRANT_VALUE_BY_BAND: Readonly<Record<Band, number>> =
  DEFAULTS.grantValueByBand.value;

/**
 * The sector prefills the *base* attrition rate; it does not scale it. A founder
 * who picks e-commerce and then types 20% means 20%, and multiplying the two
 * would silently overrule them. Model decision M16.
 */
export const DEFAULT_ATTRITION_BY_SECTOR_PCT: Readonly<Record<Sector, number>> =
  DEFAULTS.attritionBySectorPct.value;

export function baseAttritionPctForSector(sector: Sector): number {
  return DEFAULT_ATTRITION_BY_SECTOR_PCT[sector];
}
