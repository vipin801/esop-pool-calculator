/**
 * Builds a starting `EsopInputs` for the form.
 *
 * `EsopInputs` is total (M33): there is no optional field and the engine
 * applies no default of its own. Every value below is either a spec-mandated
 * default from `DEFAULTS` (marked `estimate`/`provisional` there already) or an
 * example starting figure for the company-specific fields the spec cannot
 * default (valuation, share count, founder ownership) — the same worked
 * example carried through docs/esop/LOG.md entry [020]. Every one of these is
 * editable in the form; none is presented as sourced data.
 *
 * No seed-input builder existed before this (PROJECT.md open item, carried
 * from [001]): this is route-local rather than part of the frozen engine
 * surface, per M32 — the engine exports data and types, a form assembles them.
 */
import {
  DEFAULTS,
  DEFAULT_ATTRITION_BY_SECTOR_PCT,
  DEFAULT_GRANT_BASIS_BY_STAGE,
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  DEFAULT_SENIORITY_MIX_PCT,
  DEFAULT_STRIKE_POLICY_BY_STAGE,
  type EsopInputs,
  type GrantBasis,
  type Stage,
  type StrikePolicy,
  type StrikePolicyKind,
} from '@/lib/esop';

const EXAMPLE_STAGE: Stage = 'seriesA';

function otherGrantBasis(kind: GrantBasis['kind']): GrantBasis {
  return kind === 'percentOfEquity'
    ? { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND }
    : { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND };
}

function grantBasisForStage(stage: Stage): GrantBasis {
  const kind = DEFAULT_GRANT_BASIS_BY_STAGE[stage];
  return kind === 'percentOfEquity'
    ? { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND }
    : { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND };
}

/**
 * A `Record<Stage, StrikePolicyKind>` value is typed as the whole
 * `StrikePolicyKind` union no matter which key is read, so it cannot be
 * spread straight into the `StrikePolicy` discriminated union (the
 * `discountToFMV` arm also needs a `discountPct`). This switch is the one
 * place that turns the kind back into a real, exhaustively-typed policy.
 */
function strikePolicyFor(kind: StrikePolicyKind): StrikePolicy {
  switch (kind) {
    case 'faceValue':
      return { kind: 'faceValue' };
    case 'lastRoundPrice':
      return { kind: 'lastRoundPrice' };
    case 'discountToFMV':
      return { kind: 'discountToFMV', discountPct: 20 };
  }
}

function isoDateYearsAgo(years: number, from: Date): string {
  const d = new Date(Date.UTC(from.getUTCFullYear() - years, from.getUTCMonth(), 1));
  return d.toISOString().slice(0, 10);
}

/**
 * `asOfDate` is taken from the caller's clock exactly once, at form-seed time
 * — a UI concern. The engine itself never reads a clock (README.md, "Failure").
 */
export function buildSeedInputs(now: Date = new Date()): EsopInputs {
  const grantBasis = grantBasisForStage(EXAMPLE_STAGE);
  const asOfDate = now.toISOString().slice(0, 10);

  return {
    company: {
      stage: EXAMPLE_STAGE,
      companyType: 'private',
      /** Example post-money valuation. Editable — the worked example in LOG [020]. */
      postMoneyValuation: 1_500_000_000,
      /** Example fully diluted share count, including the unallocated pool. */
      fullyDilutedShares: 10_000_000,
      /** Seeded at zero on purpose: the degenerate "no pool yet" state a founder starting from scratch is actually in. */
      existingUnallocatedOptions: 0,
      grantedOutstandingOptions: 0,
      faceValuePerShare: 10,
      authorisedCapitalShares: 12_000_000,
      /** Example founder ownership. Company-specific; not a modelling assumption. */
      founderOwnershipPctOfFullyDiluted: 55,
    },
    hiring: {
      horizonYears: DEFAULTS.horizonYears.value,
      hiresPerYear: [...DEFAULTS.hiresPerYear.value],
      seniorityMix: { ...DEFAULT_SENIORITY_MIX_PCT },
    },
    growth: {
      valuationGrowthPctPerYear: DEFAULTS.valuationGrowthPctPerYear.value,
    },
    grantPolicy: {
      grantBasis,
      comparisonGrantBasis: otherGrantBasis(grantBasis.kind),
      strikePolicy: strikePolicyFor(DEFAULT_STRIKE_POLICY_BY_STAGE[EXAMPLE_STAGE]),
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
    },
    attrition: {
      baseAnnualPct: DEFAULT_ATTRITION_BY_SECTOR_PCT[DEFAULTS.sector.value],
      byBand: { ...DEFAULTS.attritionByBandPct.value },
      sector: DEFAULTS.sector.value,
    },
    exercise: {
      exerciseWindowDays: DEFAULTS.exerciseWindowDays.value,
      vestedNeverExercisedPct: DEFAULTS.vestedNeverExercisedPct.value,
      continuingEmployeeExercisePctPerYear: DEFAULTS.continuingEmployeeExercisePctPerYear.value,
      recycleForfeited: DEFAULTS.recycleForfeited.value,
    },
    vesting: {
      cliffMonths: DEFAULTS.cliffMonths.value,
      vestYears: DEFAULTS.vestYears.value,
      frequency: DEFAULTS.vestFrequency.value,
    },
    compliance: {
      dpiitRecognised: false,
      imbCertified80IAC: false,
      incorporationDate: isoDateYearsAgo(3, now),
      grantsToGroupCompanyEmployees: false,
      anyIndividualGrantAtOrAbove1Pct: false,
      accountingBasis: DEFAULTS.accountingBasis.value,
      instrument: 'ESOP',
    },
    employeeValue: {
      /** India's top individual slab. Editable estimate, not the company's rate. */
      marginalTaxRatePct: 30,
    },
    rounds: [],
    topUps: [],
    openingGrants: [],
    openingHeadcount: [],
    asOfDate,
  };
}
