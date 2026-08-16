/**
 * ESOP pool engine — the assembler.
 *
 * `calculateEsopPool` is the one entry point. It takes `EsopInputs` and returns
 * everything ENGINE_SPEC.md section 7 asks for, items 1 to 11. Nothing else in
 * `src/lib/esop` is meant to be called from outside the engine; `index.ts` is
 * the frozen surface and `public-api.test.ts` is what freezes it.
 *
 * The one design decision worth reading before the code.
 *
 * **The engine runs the plan twice and labels both runs.** Once at the pool
 * section 4.5 recommends, and once at the pool the founder holds today. They are
 * different states and they disagree by construction: at the recommended pool
 * every year closes with options left over; at an empty pool the same plan is
 * overdrawn from the first month. There is no top-level `rollForward` or
 * `exhaustion` on `EsopResult`, deliberately, so no caller can print a headline
 * from one run above a table from the other. That is not a hypothetical failure
 * — it is the state the front-end build shipped in, and it is written up in
 * docs/esop/LOG.md entry [020].
 *
 * Everything here composes functions that already exist and are already tested.
 * No arithmetic in this file re-derives a quantity another module owns: FD_t
 * comes from `fullyDilutedShares` (M22), the pool from `solveRecommendedPool`
 * (M23), theta-scaled fair value from `thetaScaledFairValue` (M30), and the
 * round's price per share is read off the outcome rather than recomputed (the
 * P6 constraint PROJECT.md records).
 */

import { compareToBenchmarks } from './benchmarks';
import {
  openingGrantCohorts,
  openingHeadcountCohorts,
  vestedFraction,
  type GrantCohort,
  type HeadcountCohort,
} from './cohorts';
import { esopExpenseSchedule, isTaxDeferralAvailable, runComplianceChecks } from './compliance';
import { allDenominatorsForYear, exercisePriceAtYear } from './denominator';
import { EsopEngineError, requireNonNegative, requirePercentage } from './errors';
import { compInflationFactor, seniorityMixSumsTo100 } from './grants';
import { recommendedPoolUnderBothBases, type RecommendedPoolSolution } from './pool-solver';
import { runRollForward, type RollForwardArgs, type RollForwardResult } from './roll-forward';
import { capTable, existingPoolPostRoundPct, runRoundSchedule } from './rounds';
import { BANDS } from './types';
import type {
  Band,
  CapTableSet,
  EngineWarning,
  EsopInputs,
  EsopResult,
  GrantValueBreakdown,
  MedianEmployeeValue,
  ModelledRound,
  PoolPlanSeries,
  PoolSeriesLabel,
  PoolSizing,
  PreRoundHoldings,
  RollForwardYear,
  SeniorityMix,
  TopUpRequirement,
  ValueBasis,
  ValueBasisOutcome,
} from './types';

/* ------------------------------------------------------------------------- *
 * Guards the assembler owns, because nothing below it sees the whole input
 * ------------------------------------------------------------------------- */

function requireComparisonBasis(inputs: EsopInputs): void {
  if (inputs.grantPolicy.comparisonGrantBasis.kind === inputs.grantPolicy.grantBasis.kind) {
    throw new EsopEngineError(
      'comparisonBasisSameAsSelected',
      'Spec output item 1 asks for the recommendation under the selected grant basis and the same figure under the other one. The comparison basis given is the same kind as the selected basis, so there is no other basis to run.',
      { kind: inputs.grantPolicy.grantBasis.kind },
    );
  }
}

/**
 * A hiring plan shorter than its own horizon is a form bug, not a plan with
 * quiet years in it.
 *
 * The roll forward reads `hiresPerYear[t] ?? 0`, so without this the missing
 * years hire nobody and the recommendation comes back smaller for a reason
 * nothing on screen would explain. Extra entries past the horizon are fine and
 * are ignored: shortening the horizon is a founder editing their plan, not an
 * error.
 */
function requireHiringPlanCoversHorizon(inputs: EsopInputs): void {
  const { horizonYears, hiresPerYear } = inputs.hiring;

  if (hiresPerYear.length < horizonYears) {
    throw new EsopEngineError(
      'invalidHorizon',
      'The hiring plan has fewer years in it than the planning horizon, so the last years of the plan would silently hire nobody.',
      { horizonYears, hiresPerYearLength: hiresPerYear.length },
    );
  }
}

/* ------------------------------------------------------------------------- *
 * Opening state
 * ------------------------------------------------------------------------- */

function rollForwardArgs(inputs: EsopInputs): RollForwardArgs {
  const openingCohorts: readonly GrantCohort[] = openingGrantCohorts(inputs.openingGrants);
  const openingHeadcount: readonly HeadcountCohort[] = openingHeadcountCohorts(
    inputs.openingHeadcount,
  );

  return {
    company: inputs.company,
    hiring: inputs.hiring,
    growth: inputs.growth,
    grantPolicy: inputs.grantPolicy,
    attrition: inputs.attrition,
    exercise: inputs.exercise,
    vesting: inputs.vesting,
    topUps: inputs.topUps,
    openingCohorts,
    openingHeadcount,
  };
}

/* ------------------------------------------------------------------------- *
 * The two series
 * ------------------------------------------------------------------------- */

const SERIES_DESCRIPTION: Readonly<Record<PoolSeriesLabel, string>> = {
  recommended: 'The hiring plan run against the pool this tool recommends you reserve.',
  current: 'The same hiring plan run against the unallocated pool you hold today.',
};

/**
 * One run, packaged with the pool it was run against.
 *
 * `openingPoolOptions` is the pool the run was actually priced at, which on the
 * recommended series is the solver's converged iterate rather than the reported
 * recommendation. The two sit within section 4.5's 0.01 percentage point
 * tolerance of each other by construction — M23 states this rather than hiding
 * it — and both are reported here so the gap is visible instead of implied.
 */
function series(args: {
  readonly label: PoolSeriesLabel;
  readonly run: RollForwardResult;
  readonly openingPoolOptions: number;
  readonly fullyDilutedSharesAtYear0: number;
  readonly sizing: PoolSizing | null;
}): PoolPlanSeries {
  const { label, run, openingPoolOptions, fullyDilutedSharesAtYear0, sizing } = args;

  return {
    label,
    description: SERIES_DESCRIPTION[label],
    openingPoolOptions,
    openingPoolPctOfFullyDiluted:
      fullyDilutedSharesAtYear0 > 0 ? (openingPoolOptions / fullyDilutedSharesAtYear0) * 100 : 0,
    sizing,
    years: run.years,
    exhaustion: run.exhaustion,
    authorisedCapital: run.authorisedCapital,
    fullyDilutedSharesAtYear0,
    closingAvailable: run.closingAvailable,
    closingIssuedShares: run.closingIssuedShares,
    closingGrantedOutstanding: run.closingGrantedOutstanding,
    closingFullyDilutedShares: run.closingFullyDilutedShares,
    totalGrossConsumptionOptions: run.totalGrossConsumptionOptions,
    totalReturnedToPool: run.totalReturnedToPool,
    totalExercisedShares: run.totalExercisedShares,
    totalCancelledNotRecycled: run.totalCancelledNotRecycled,
  };
}

/** FD_0 for a run, read off its own first year rather than recomposed. M22. */
function fullyDilutedAtYear0(run: RollForwardResult, fallback: number): number {
  return run.years[0]?.openingFullyDilutedShares ?? fallback;
}

/* ------------------------------------------------------------------------- *
 * Cap tables, spec output item 6
 * ------------------------------------------------------------------------- */

/**
 * The holdings at the start of year 0, split by holder.
 *
 * The roll forward knows the issued total and not who holds it, so the founder
 * percentage is the one extra fact this needs and the investors are the
 * remainder. Entering both would let them disagree.
 */
function openingHoldings(inputs: EsopInputs): PreRoundHoldings {
  const { company } = inputs;

  requirePercentage(
    company.founderOwnershipPctOfFullyDiluted,
    'invalidMoneyAmount',
    'Founder ownership must sit between 0% and 100% of the fully diluted count.',
  );

  const issued =
    company.fullyDilutedShares -
    company.existingUnallocatedOptions -
    company.grantedOutstandingOptions;

  requireNonNegative(
    issued,
    'negativeShareCount',
    'The unallocated pool and the granted options together exceed the fully diluted share count, which would leave the company with negative issued shares.',
  );

  const founderShares =
    (company.fullyDilutedShares * company.founderOwnershipPctOfFullyDiluted) / 100;

  if (founderShares > issued) {
    throw new EsopEngineError(
      'founderOwnershipExceedsIssuedShares',
      'The founders are shown holding more shares than the company has issued, which would leave the investors on a negative holding. Founder ownership is a percentage of the fully diluted count, and the fully diluted count includes options nobody has been issued shares for yet.',
      { founderShares, issuedShares: issued },
    );
  }

  return {
    founderShares,
    investorShares: issued - founderShares,
    grantedOptions: company.grantedOutstandingOptions,
    unallocatedPool: company.existingUnallocatedOptions,
  };
}

/**
 * Item 6, all three tables struck at the same moment: today.
 *
 * `before` is the register as it stands. `after` is the register once the
 * recommended pool is reserved. `afterModelledRound` is the first modelled round
 * applied to `after`.
 *
 * All three are year 0 rather than the round's own plan year, because
 * `PreRoundHoldings` has four buckets and none of them is exercised shares —
 * the [003] open item — so striking the round at year 2 would have to fold two
 * years of exercises into the investor row and misstate the register. Three
 * tables on one basis is also the comparison a founder is actually making.
 */
function capTables(args: {
  readonly holdings: PreRoundHoldings;
  readonly recommendedNewPoolOptions: number;
  readonly rounds: readonly ModelledRound[];
}): CapTableSet {
  const { holdings, recommendedNewPoolOptions, rounds } = args;

  const afterHoldings: PreRoundHoldings = {
    ...holdings,
    unallocatedPool: holdings.unallocatedPool + recommendedNewPoolOptions,
  };

  return {
    before: capTable('Today', holdings),
    after: capTable('After the recommended pool is reserved', afterHoldings),
    afterModelledRound: rounds[0]?.asOffered.capTables.final ?? null,
  };
}

/* ------------------------------------------------------------------------- *
 * Rounds, spec output items 3 and 4
 * ------------------------------------------------------------------------- */

function topUpFor(args: {
  readonly round: ModelledRoundSource;
  readonly openingHoldings: PreRoundHoldings;
}): TopUpRequirement {
  const { round, openingHoldings: holdings } = args;

  return {
    roundId: round.round.id,
    /**
     * dP / T, section 4.6's own measure. Read off the outcome rather than
     * recomputed from `dP` and `T` separately, so the two cannot drift.
     */
    topUpPctPoints: round.outcome.founderDilutionFromPoolPctPoints,
    topUpOptions: round.outcome.newPoolShares,
    investorRequiredPostRoundPoolPct: round.round.investorRequiredPostRoundPoolPct,
    existingPoolPostRoundPct: existingPoolPostRoundPct({ round: round.round, holdings }),
    poolCreation: round.outcome.poolCreation,
  };
}

type ModelledRoundSource = ReturnType<typeof runRoundSchedule>[number];

function modelledRounds(args: {
  readonly inputs: EsopInputs;
  readonly openingHoldings: PreRoundHoldings;
}): readonly ModelledRound[] {
  const { inputs, openingHoldings: holdings } = args;

  if (inputs.rounds.length === 0) return [];

  return runRoundSchedule({ rounds: inputs.rounds, openingHoldings: holdings }).map((step) => ({
    roundId: step.round.id,
    label: step.round.label,
    year: step.round.year,
    asOffered: step.outcome,
    topUp: topUpFor({ round: step, openingHoldings: step.openingHoldings }),
    cost: step.cost,
  }));
}

/* ------------------------------------------------------------------------- *
 * Section 2, per band and per year
 * ------------------------------------------------------------------------- */

function valueBasisOutcomes(args: {
  readonly year: RollForwardYear;
  readonly grantValueRupees: number;
  readonly strikePolicy: EsopInputs['grantPolicy']['strikePolicy'];
  readonly faceValuePerShare: number;
  readonly theta: number;
}): {
  readonly exercisePrice: number;
  readonly byBasis: Readonly<Record<ValueBasis, ValueBasisOutcome>>;
} {
  const { year, grantValueRupees, strikePolicy, faceValuePerShare, theta } = args;

  const all = allDenominatorsForYear({
    strikePolicy,
    pricePerShare: year.pricePerShare,
    faceValuePerShare,
    theta,
  });

  const one = (basis: ValueBasis): ValueBasisOutcome => {
    const outcome = all[basis];
    if (!outcome.ok) {
      return { ok: false, reason: outcome.error.code, message: outcome.error.message };
    }

    return {
      ok: true,
      optionsPerHire: grantValueRupees / outcome.denominator,
      denominator: outcome.denominator,
    };
  };

  return {
    exercisePrice: all.notional.exercisePrice,
    byBasis: {
      notional: one('notional'),
      realisable: one('realisable'),
      fairValue: one('fairValue'),
    },
  };
}

/** Section 2 computed for every band in every plan year of the recommended run. */
function grantValueBreakdown(args: {
  readonly inputs: EsopInputs;
  readonly run: RollForwardResult;
}): readonly GrantValueBreakdown[] {
  const { inputs, run } = args;
  const { grantBasis, strikePolicy, compInflationPctPerYear, fairValue } = inputs.grantPolicy;

  const rows: GrantValueBreakdown[] = [];

  for (const year of run.years) {
    for (const band of BANDS) {
      if (grantBasis.kind === 'percentOfEquity') {
        const pct = grantBasis.grantPctByBand[band];
        rows.push({
          basisKind: 'percentOfEquity',
          band,
          year: year.year,
          optionsPerHire: (pct * year.openingFullyDilutedShares) / 100,
          grantPctOfFullyDiluted: pct,
        });
        continue;
      }

      const grantValueRupees =
        grantBasis.grantValueByBand[band] *
        compInflationFactor(compInflationPctPerYear, year.year);
      const { exercisePrice, byBasis } = valueBasisOutcomes({
        year,
        grantValueRupees,
        strikePolicy,
        faceValuePerShare: inputs.company.faceValuePerShare,
        theta: fairValue.theta,
      });

      rows.push({
        basisKind: 'rupeeValue',
        band,
        year: year.year,
        grantValueRupees,
        exercisePrice,
        optionsPerHireByValueBasis: byBasis,
      });
    }
  }

  return rows;
}

/* ------------------------------------------------------------------------- *
 * The median employee, spec output item 11
 * ------------------------------------------------------------------------- */

/**
 * The band the 50th percentile hire falls in, walking from the most senior band
 * down.
 *
 * The mix is normalised first, so a mix that does not sum to 100 still has a
 * median — it loses hires, which is the separate `seniorityMixDoesNotSumTo100`
 * warning, and that is not a reason to refuse to name a median band as well. A
 * mix that is entirely zero has no employees at all and returns null.
 */
export function medianBand(mix: SeniorityMix): Band | null {
  const total = BANDS.reduce((sum, band) => sum + Math.max(mix[band], 0), 0);
  if (total <= 0) return null;

  let cumulative = 0;
  for (const band of BANDS) {
    cumulative += Math.max(mix[band], 0);
    if (cumulative / total >= 0.5) return band;
  }

  /** Unreachable: the loop's last iteration always reaches the whole total. */
  return BANDS[BANDS.length - 1] ?? null;
}

/**
 * Item 11. What one median hire, granted in year 0, is worth at the horizon.
 *
 * Notional is the vested holding at the modelled horizon price. Realisable is
 * that less what it costs to get: the exercise price, which is cash out of the
 * employee's pocket, and the perquisite tax on the spread, which under the
 * Income Tax Act 2025 falls at exercise and at slab.
 *
 * The deferral flag is `isTaxDeferralAvailable`, which reads both compliance
 * toggles together and is the only place in the engine that does. It changes
 * *when* the tax falls, never whether it does, so it does not reduce
 * `perquisiteTaxRupees` — presenting a deferral as a discount is the error
 * PROJECT.md prohibits, one step removed.
 */
function medianEmployeeValue(args: {
  readonly inputs: EsopInputs;
  readonly run: RollForwardResult;
}): MedianEmployeeValue | null {
  const { inputs, run } = args;

  const band = medianBand(inputs.hiring.seniorityMix);
  const firstYear = run.years[0];
  const lastYear = run.years[run.years.length - 1];
  if (band === null || firstYear === undefined || lastYear === undefined) return null;

  requirePercentage(
    inputs.employeeValue.marginalTaxRatePct,
    'invalidMoneyAmount',
    "The employee's marginal tax rate must sit between 0% and 100%.",
  );

  const { grantBasis } = inputs.grantPolicy;
  const optionsGranted =
    grantBasis.kind === 'percentOfEquity'
      ? (grantBasis.grantPctByBand[band] * firstYear.openingFullyDilutedShares) / 100
      : grantBasis.grantValueByBand[band] / (firstYear.denominator ?? firstYear.pricePerShare);

  /**
   * A cohort granted in year 0 is `t` years old at the end of plan year `t`,
   * exactly as `stepGrantCohort` ages it. The last plan year is `T - 1`.
   */
  const vested =
    optionsGranted *
    vestedFraction({
      ageYears: inputs.hiring.horizonYears - 1,
      cliffMonths: inputs.vesting.cliffMonths,
      vestYears: inputs.vesting.vestYears,
    });

  const exercisePrice = exercisePriceAtYear({
    strikePolicy: inputs.grantPolicy.strikePolicy,
    pricePerShare: firstYear.pricePerShare,
    faceValuePerShare: inputs.company.faceValuePerShare,
  });

  const notionalValueRupees = vested * lastYear.pricePerShare;
  const exerciseCostRupees = vested * exercisePrice;
  const perquisiteTaxRupees =
    Math.max(lastYear.pricePerShare - exercisePrice, 0) *
    vested *
    (inputs.employeeValue.marginalTaxRatePct / 100);

  return {
    band,
    optionsGranted,
    vestedAtHorizon: vested,
    notionalValueRupees,
    exerciseCostRupees,
    perquisiteTaxRupees,
    realisableValueRupees: notionalValueRupees - exerciseCostRupees - perquisiteTaxRupees,
    marginalTaxRatePct: inputs.employeeValue.marginalTaxRatePct,
    taxDeferralAvailable: isTaxDeferralAvailable(inputs.compliance),
  };
}

/* ------------------------------------------------------------------------- *
 * Warnings — spec section 8, plus the two the engine's own behaviour requires
 * ------------------------------------------------------------------------- */

/**
 * Whether the strike is set at fair market value.
 *
 * `lastRoundPrice` is the FMV pole. A `discountToFMV` of exactly zero is the
 * same thing said differently and counts; any real discount does not, because
 * the employee then does receive the discount and the warning would be false.
 */
function strikeIsAtFairMarketValue(strikePolicy: EsopInputs['grantPolicy']['strikePolicy']): boolean {
  if (strikePolicy.kind === 'lastRoundPrice') return true;

  return strikePolicy.kind === 'discountToFMV' && strikePolicy.discountPct === 0;
}

function warningsFor(args: {
  readonly inputs: EsopInputs;
  readonly selected: RecommendedPoolSolution;
}): readonly EngineWarning[] {
  const { inputs, selected } = args;
  const warnings: EngineWarning[] = [];

  if (
    inputs.grantPolicy.grantBasis.kind === 'rupeeValue' &&
    inputs.grantPolicy.valueBasis === 'notional' &&
    strikeIsAtFairMarketValue(inputs.grantPolicy.strikePolicy)
  ) {
    warnings.push({
      id: 'notionalValueOverstatesReceipt',
      message:
        'The strike is set at fair market value and grants are quoted on the notional basis, so the headline grant value overstates what an employee receives. What they bank is the spread, which starts at nothing.',
    });
  }

  if (!selected.rollForward.authorisedCapital.sufficient) {
    warnings.push({
      id: 'authorisedCapitalShortfall',
      message:
        'Authorised capital does not cover the issued shares plus this pool. It has to be increased before the scheme can be adopted.',
    });
  }

  if (!selected.solver.converged) {
    warnings.push({
      id: 'solverDidNotConverge',
      message:
        'The pool calculation did not settle within the iterations the model allows, so the figure shown is where it stopped rather than an answer. The hiring plan is granting away more of the company than the model can price.',
    });
  }

  if (!seniorityMixSumsTo100(inputs.hiring.seniorityMix)) {
    warnings.push({
      id: 'seniorityMixDoesNotSumTo100',
      message:
        'The seniority mix does not add up to 100%, so part of the hiring plan is granted nothing and the pool comes back smaller than the plan needs.',
    });
  }

  return warnings;
}

/* ------------------------------------------------------------------------- *
 * The entry point
 * ------------------------------------------------------------------------- */

/**
 * Size an ESOP pool. ENGINE_SPEC.md section 7, items 1 to 11.
 *
 * Throws `EsopEngineError` with a code from `ESOP_ERROR_CODES` when an input
 * makes the model undefined. It never returns NaN, never returns Infinity, and
 * never returns a number that is arithmetically valid and economically absurd.
 */
export function calculateEsopPool(inputs: EsopInputs): EsopResult {
  requireComparisonBasis(inputs);
  requireHiringPlanCoversHorizon(inputs);

  /** Resolved up front so a bad cap table fails before twenty-five solver runs. */
  const holdings = openingHoldings(inputs);
  const base = rollForwardArgs(inputs);

  /* --- Item 1: the recommendation, under both bases --- */
  const solved = recommendedPoolUnderBothBases({
    inputs: base,
    comparisonGrantBasis: inputs.grantPolicy.comparisonGrantBasis,
  });
  const { selected } = solved;

  /* --- The two series --- */
  const recommendedRun = selected.rollForward;
  const recommendedFd0 = fullyDilutedAtYear0(
    recommendedRun,
    selected.fullyDilutedSharesAtYear0,
  );
  const recommended = series({
    label: 'recommended',
    run: recommendedRun,
    openingPoolOptions: recommendedRun.years[0]?.openingAvailable ?? 0,
    fullyDilutedSharesAtYear0: recommendedFd0,
    sizing: selected.sizing,
  });

  const currentRun = runRollForward(base);
  const current = series({
    label: 'current',
    run: currentRun,
    openingPoolOptions: inputs.company.existingUnallocatedOptions,
    fullyDilutedSharesAtYear0: fullyDilutedAtYear0(
      currentRun,
      inputs.company.fullyDilutedShares,
    ),
    sizing: null,
  });

  /* --- Items 3, 4 and 6 --- */
  const afterPoolHoldings: PreRoundHoldings = {
    ...holdings,
    unallocatedPool: holdings.unallocatedPool + selected.sizing.poolOptions,
  };
  const rounds = modelledRounds({ inputs, openingHoldings: afterPoolHoldings });

  /* --- Items 8 and 9, both read off the recommended run --- */
  const esopExpense = esopExpenseSchedule({
    rollForward: recommendedRun,
    vesting: inputs.vesting,
    fairValue: inputs.grantPolicy.fairValue,
    accountingBasis: inputs.compliance.accountingBasis,
    strikePolicy: inputs.grantPolicy.strikePolicy,
    faceValuePerShare: inputs.company.faceValuePerShare,
  });

  const complianceChecks = runComplianceChecks({
    company: inputs.company,
    compliance: inputs.compliance,
    vesting: inputs.vesting,
    authorisedCapital: recommendedRun.authorisedCapital,
    asOfDate: inputs.asOfDate,
  });

  return {
    recommendedPool: solved.recommendedPool,
    recommended,
    current,
    rounds,
    topUpAtNextRound: rounds[0]?.topUp ?? null,
    poolCostToFounders: rounds[0]?.cost ?? null,
    capTables: capTables({
      holdings,
      recommendedNewPoolOptions: selected.sizing.poolOptions,
      rounds,
    }),
    esopExpense,
    complianceChecks,
    benchmarkComparison: compareToBenchmarks({
      poolPctOfFullyDiluted: selected.sizing.poolPctOfFullyDiluted,
      stage: inputs.company.stage,
    }),
    medianEmployeeValue: medianEmployeeValue({ inputs, run: recommendedRun }),
    grantValueBreakdown: grantValueBreakdown({ inputs, run: recommendedRun }),
    solver: selected.solver,
    warnings: warningsFor({ inputs, selected }),
    asOfDate: inputs.asOfDate,
  };
}
