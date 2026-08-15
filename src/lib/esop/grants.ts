/**
 * ESOP pool engine — grant demand.
 *
 * ENGINE_SPEC.md section 4.1 (new hire grants) and 4.2 (refresh grants), under
 * the section 1 grant basis fork:
 *
 *   Basis A:  N_t = sum_b [ H_t,b * pct_b * FD_t ]
 *   Basis B:  N_t = sum_b [ H_t,b * G_b * (1+i)^t / D_t ]
 *   R_t     = Eligible_t * refreshRate * refreshSize * Gbar * (1+i)^t / D_t
 *
 * Section 1 is the whole ballgame: under Basis A, pool consumption is
 * completely independent of valuation. That independence is structural here,
 * not a promise kept by discipline. `GrantYear` carries no price. The Basis A
 * functions take no price, no denominator and no growth rate, so a valuation
 * has no route into them. The test that proves it is the most important test in
 * this repo.
 *
 * Section 4.2 is written in Basis B terms — it divides by D_t — but a refresh
 * grant is the same promise as an initial grant, made again. Under Basis A it
 * therefore has to be a percentage of FD_t as well, or Basis A demand would
 * become valuation-dependent through the back door and section 1 would be
 * false. So refresh mirrors the fork, and Gbar is the headcount-weighted mean
 * grant across the eligible base: a percentage under Basis A, rupees under
 * Basis B. Model decision M7.
 */

import {
  EsopEngineError,
  requireNonNegative,
  requirePositive,
  requireYearIndex,
} from './errors';
import { BANDS, type Band, type GrantBasis, type GrantBasisKind, type RefreshPolicy, type SeniorityMix } from './types';

/** A number per band: hires, eligible employees, grant values, options. */
export type ByBand = Readonly<Record<Band, number>>;

export type PercentOfEquityBasis = Extract<GrantBasis, { kind: 'percentOfEquity' }>;
export type RupeeValueBasis = Extract<GrantBasis, { kind: 'rupeeValue' }>;

/**
 * Everything sections 4.1 and 4.2 need to know about year t, other than the
 * grant basis itself.
 *
 * There is deliberately no price per share on this object. Under Basis A the
 * price is irrelevant, and under Basis B it reaches the formula only through
 * `denominator`, which section 2 computes.
 */
export interface GrantYear {
  /** t. Zero-based: year 0 is the first plan year. */
  readonly year: number;
  /** FD_t, including the unallocated pool. The only market fact Basis A uses. */
  readonly fullyDilutedShares: number;
  /** i. Comp inflation on grant values. Applied only under Basis B. */
  readonly compInflationPctPerYear: number;
}

/**
 * Options demanded in one year, and the basis that produced them.
 *
 * The basis kind rides along for the same reason `PoolSizing` carries it: a
 * demand figure without its basis is not a figure a founder can act on.
 */
export interface GrantDemand {
  readonly year: number;
  readonly basisKind: GrantBasisKind;
  readonly optionsByBand: ByBand;
  readonly totalOptions: number;
  /** D_t. Null under Basis A, which has no denominator at all. */
  readonly denominator: number | null;
}

export interface RefreshGrantDemand extends GrantDemand {
  readonly eligibleHeadcount: number;
  /**
   * Gbar. The headcount-weighted mean grant across the eligible base: a percent
   * of fully diluted under Basis A, a rupee value under Basis B. Zero when
   * nobody is eligible.
   */
  readonly averageGrantPerEligible: number;
}

/* ------------------------------------------------------------------------- *
 * Band helpers
 * ------------------------------------------------------------------------- */

/**
 * Build a per-band record. Written out band by band rather than looped, so that
 * adding a band to `BANDS` fails to compile here instead of silently producing
 * a record with a missing key.
 */
export function mapBands(compute: (band: Band) => number): ByBand {
  return {
    leadership: compute('leadership'),
    senior: compute('senior'),
    mid: compute('mid'),
    junior: compute('junior'),
  };
}

export function sumOverBands(values: ByBand): number {
  return BANDS.reduce((total, band) => total + values[band], 0);
}

function requireHeadcounts(values: ByBand, what: string): void {
  for (const band of BANDS) {
    requireNonNegative(values[band], 'negativeHeadcount', `${what} for ${band} cannot be negative.`, {
      band,
    });
  }
}

function requireGrantAmounts(values: ByBand, what: string): void {
  for (const band of BANDS) {
    requireNonNegative(values[band], 'invalidMoneyAmount', `${what} for ${band} cannot be negative.`, {
      band,
    });
  }
}

/* ------------------------------------------------------------------------- *
 * Shared arithmetic
 * ------------------------------------------------------------------------- */

/** (1 + i)^t. */
export function compInflationFactor(compInflationPctPerYear: number, year: number): number {
  requireYearIndex(year);
  requirePositive(
    1 + compInflationPctPerYear / 100,
    'invalidMoneyAmount',
    'Comp inflation at or below -100% would wipe out every grant value.',
  );

  return (1 + compInflationPctPerYear / 100) ** year;
}

/** H_t,b from the yearly total and the seniority mix. */
export function splitHiresByBand(totalHires: number, mix: SeniorityMix): ByBand {
  requireNonNegative(totalHires, 'negativeHeadcount', 'Total hires in a year cannot be negative.');
  requireHeadcounts(mix, 'Seniority mix share');

  return mapBands((band) => (totalHires * mix[band]) / 100);
}

/**
 * Whether the mix adds up. Section 4.1 applies the mix as given, so a mix that
 * sums to 90 loses a tenth of the hiring plan rather than throwing; the engine
 * raises `seniorityMixDoesNotSumTo100` as a warning instead. This predicate is
 * what it checks.
 */
export function seniorityMixSumsTo100(mix: SeniorityMix, tolerancePctPoints = 1e-9): boolean {
  return Math.abs(sumOverBands(mix) - 100) <= tolerancePctPoints;
}

function requireDenominator(denominator: number | undefined, basisLabel: string): number {
  if (denominator === undefined) {
    throw new EsopEngineError(
      'missingDenominator',
      `${basisLabel} converts a rupee grant into options at D_t, so a denominator from section 2 is required.`,
    );
  }
  requirePositive(denominator, 'nonPositiveDenominator', 'The denominator D_t must be above zero.');

  return denominator;
}

/* ------------------------------------------------------------------------- *
 * 4.1 New hire grants
 * ------------------------------------------------------------------------- */

/**
 * Basis A. N_t = sum_b [ H_t,b * pct_b * FD_t ].
 *
 * Note what this signature does not take: no price per share, no denominator,
 * no growth rate. Valuation cannot affect the answer because it cannot get in.
 */
export function newHireGrantDemandBasisA(args: {
  readonly grantBasis: PercentOfEquityBasis;
  readonly hiresByBand: ByBand;
  readonly year: number;
  readonly fullyDilutedShares: number;
}): GrantDemand {
  const { grantBasis, hiresByBand, year, fullyDilutedShares } = args;

  requireYearIndex(year);
  requirePositive(
    fullyDilutedShares,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero for a percent-of-equity grant to mean anything.',
  );
  requireHeadcounts(hiresByBand, 'Hires');
  requireGrantAmounts(grantBasis.grantPctByBand, 'Grant percentage');

  const optionsByBand = mapBands(
    (band) => (hiresByBand[band] * grantBasis.grantPctByBand[band] * fullyDilutedShares) / 100,
  );

  return {
    year,
    basisKind: 'percentOfEquity',
    optionsByBand,
    totalOptions: sumOverBands(optionsByBand),
    denominator: null,
  };
}

/** Basis B. N_t = sum_b [ H_t,b * G_b * (1+i)^t / D_t ]. */
export function newHireGrantDemandBasisB(args: {
  readonly grantBasis: RupeeValueBasis;
  readonly hiresByBand: ByBand;
  readonly year: number;
  readonly compInflationPctPerYear: number;
  readonly denominator: number;
}): GrantDemand {
  const { grantBasis, hiresByBand, year, compInflationPctPerYear, denominator } = args;

  requireHeadcounts(hiresByBand, 'Hires');
  requireGrantAmounts(grantBasis.grantValueByBand, 'Grant value');
  const d = requireDenominator(denominator, 'The rupee value basis');
  const inflation = compInflationFactor(compInflationPctPerYear, year);

  const optionsByBand = mapBands(
    (band) => (hiresByBand[band] * grantBasis.grantValueByBand[band] * inflation) / d,
  );

  return {
    year,
    basisKind: 'rupeeValue',
    optionsByBand,
    totalOptions: sumOverBands(optionsByBand),
    denominator: d,
  };
}

export interface NewHireGrantArgs {
  readonly grantBasis: GrantBasis;
  /** H_t,b. */
  readonly hiresByBand: ByBand;
  readonly grantYear: GrantYear;
  /**
   * D_t, per section 2. Required under Basis B. Under Basis A there is no
   * denominator — that absence is the fork, not an omission — and anything
   * passed here is never read.
   */
  readonly denominator?: number;
}

/** N_t under whichever basis the founder picked. Spec section 4.1. */
export function newHireGrantDemand(args: NewHireGrantArgs): GrantDemand {
  const { grantBasis, hiresByBand, grantYear, denominator } = args;

  switch (grantBasis.kind) {
    case 'percentOfEquity':
      return newHireGrantDemandBasisA({
        grantBasis,
        hiresByBand,
        year: grantYear.year,
        fullyDilutedShares: grantYear.fullyDilutedShares,
      });

    case 'rupeeValue':
      return newHireGrantDemandBasisB({
        grantBasis,
        hiresByBand,
        year: grantYear.year,
        compInflationPctPerYear: grantYear.compInflationPctPerYear,
        denominator: requireDenominator(denominator, 'The rupee value basis'),
      });
  }
}

/* ------------------------------------------------------------------------- *
 * 4.2 Refresh grants, on the eligible base
 * ------------------------------------------------------------------------- */

/** Eligible_t = employees with tenure >= refreshEligibility. Spec default 24 months. */
export function isRefreshEligible(tenureMonths: number, refresh: RefreshPolicy): boolean {
  requireNonNegative(tenureMonths, 'negativeHeadcount', 'Tenure in months cannot be negative.');
  requireNonNegative(
    refresh.eligibilityMonths,
    'invalidRefreshPolicy',
    'Refresh eligibility in months cannot be negative.',
  );

  return tenureMonths >= refresh.eligibilityMonths;
}

export interface EmployeeTenure {
  readonly band: Band;
  readonly tenureMonths: number;
}

/** The eligible base, counted per band. */
export function eligibleByBandFromTenures(
  employees: readonly EmployeeTenure[],
  refresh: RefreshPolicy,
): ByBand {
  const eligible = employees.filter((employee) => isRefreshEligible(employee.tenureMonths, refresh));

  return mapBands((band) => eligible.filter((employee) => employee.band === band).length);
}

function requireRefreshPolicy(refresh: RefreshPolicy): number {
  requireNonNegative(
    refresh.ratePct,
    'invalidRefreshPolicy',
    'The share of eligible employees receiving a refresh cannot be negative.',
  );
  requireNonNegative(
    refresh.sizePct,
    'invalidRefreshPolicy',
    'Refresh size as a share of an initial grant cannot be negative.',
  );

  return (refresh.ratePct / 100) * (refresh.sizePct / 100);
}

/** Gbar, weighted by the eligible headcount in each band. Zero when nobody is eligible. */
function averageGrant(eligibleByBand: ByBand, grantByBand: ByBand): number {
  const headcount = sumOverBands(eligibleByBand);
  if (headcount === 0) return 0;

  return sumOverBands(mapBands((band) => eligibleByBand[band] * grantByBand[band])) / headcount;
}

/**
 * Basis A refresh. R_t = sum_b [ Eligible_b * rate * size * pct_b * FD_t ].
 *
 * Same shape as section 4.2, with pct_b applied to FD_t in place of G_b / D_t,
 * per M7. Again: no price, no denominator, no growth rate.
 */
export function refreshGrantDemandBasisA(args: {
  readonly grantBasis: PercentOfEquityBasis;
  readonly eligibleByBand: ByBand;
  readonly refresh: RefreshPolicy;
  readonly year: number;
  readonly fullyDilutedShares: number;
}): RefreshGrantDemand {
  const { grantBasis, eligibleByBand, refresh, year, fullyDilutedShares } = args;

  requireYearIndex(year);
  requirePositive(
    fullyDilutedShares,
    'nonPositiveFullyDilutedShares',
    'Fully diluted shares must be above zero for a percent-of-equity refresh to mean anything.',
  );
  requireHeadcounts(eligibleByBand, 'Eligible employees');
  requireGrantAmounts(grantBasis.grantPctByBand, 'Grant percentage');
  const refreshFactor = requireRefreshPolicy(refresh);

  const optionsByBand = mapBands(
    (band) =>
      (eligibleByBand[band] * refreshFactor * grantBasis.grantPctByBand[band] * fullyDilutedShares) /
      100,
  );

  return {
    year,
    basisKind: 'percentOfEquity',
    optionsByBand,
    totalOptions: sumOverBands(optionsByBand),
    denominator: null,
    eligibleHeadcount: sumOverBands(eligibleByBand),
    averageGrantPerEligible: averageGrant(eligibleByBand, grantBasis.grantPctByBand),
  };
}

/** Basis B refresh. R_t = sum_b [ Eligible_b * rate * size * G_b * (1+i)^t / D_t ]. */
export function refreshGrantDemandBasisB(args: {
  readonly grantBasis: RupeeValueBasis;
  readonly eligibleByBand: ByBand;
  readonly refresh: RefreshPolicy;
  readonly year: number;
  readonly compInflationPctPerYear: number;
  readonly denominator: number;
}): RefreshGrantDemand {
  const { grantBasis, eligibleByBand, refresh, year, compInflationPctPerYear, denominator } = args;

  requireHeadcounts(eligibleByBand, 'Eligible employees');
  requireGrantAmounts(grantBasis.grantValueByBand, 'Grant value');
  const refreshFactor = requireRefreshPolicy(refresh);
  const d = requireDenominator(denominator, 'The rupee value basis');
  const inflation = compInflationFactor(compInflationPctPerYear, year);

  const optionsByBand = mapBands(
    (band) =>
      (eligibleByBand[band] * refreshFactor * grantBasis.grantValueByBand[band] * inflation) / d,
  );

  return {
    year,
    basisKind: 'rupeeValue',
    optionsByBand,
    totalOptions: sumOverBands(optionsByBand),
    denominator: d,
    eligibleHeadcount: sumOverBands(eligibleByBand),
    averageGrantPerEligible: averageGrant(eligibleByBand, grantBasis.grantValueByBand),
  };
}

export interface RefreshGrantArgs {
  readonly grantBasis: GrantBasis;
  /** Eligible_t, per band. Section 4.3 produces this from the cohorts. */
  readonly eligibleByBand: ByBand;
  readonly refresh: RefreshPolicy;
  readonly grantYear: GrantYear;
  /** D_t, per section 2. Required under Basis B, absent under Basis A. */
  readonly denominator?: number;
}

/** R_t under whichever basis the founder picked. Spec section 4.2. */
export function refreshGrantDemand(args: RefreshGrantArgs): RefreshGrantDemand {
  const { grantBasis, eligibleByBand, refresh, grantYear, denominator } = args;

  switch (grantBasis.kind) {
    case 'percentOfEquity':
      return refreshGrantDemandBasisA({
        grantBasis,
        eligibleByBand,
        refresh,
        year: grantYear.year,
        fullyDilutedShares: grantYear.fullyDilutedShares,
      });

    case 'rupeeValue':
      return refreshGrantDemandBasisB({
        grantBasis,
        eligibleByBand,
        refresh,
        year: grantYear.year,
        compInflationPctPerYear: grantYear.compInflationPctPerYear,
        denominator: requireDenominator(denominator, 'The rupee value basis'),
      });
  }
}
