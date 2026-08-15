/**
 * ESOP pool engine — the funding round schedule and the pool shuffle.
 *
 * ENGINE_SPEC.md section 4.6, the highest value output in the tool:
 *
 *   T   = S_ex / (1 - pi - R/(Vpre + R))     post-round fully diluted
 *   I   = T * R/(Vpre + R)                   investor shares
 *   dP  = pi*T - U                           new pool shares
 *   PPS = Vpre / (S_ex + pi*T)               investor price per share
 *
 * The last line is the whole argument. The investor's price is struck on the
 * pre-money share count *after* the new pool has been added to it, so a bigger
 * pool means a lower price for the same money and the founders pay for all of
 * it. That is the pre-money pool, and it is what almost every Indian term sheet
 * proposes.
 *
 * The counterfactual is the post-money pool: the investor buys at the price the
 * shares were worth before the pool existed, and the pool is cut afterwards, so
 * the incoming investor is diluted by it alongside the founders. Both are
 * computed for every round, and the difference between them, in rupees, is the
 * number a founder is actually here for.
 *
 * Two things this file will not do:
 *
 * 1. It does not round shares to whole numbers. The closed form holds exactly
 *    in fractions and only approximately in integers, and an engine that
 *    quietly rounds cannot then be checked against its own identities.
 *    Rounding is a presentation decision.
 * 2. It does not clamp `dP` at zero. When the investor asks for a smaller pool
 *    than the company already reserves, `dP` comes back negative, which is the
 *    honest reading of the spec's formula and a real term sheet outcome.
 */

import {
  EsopEngineError,
  requireNonNegative,
  requirePositive,
  requireYearIndex,
} from './errors';
import type {
  CapTable,
  CapTableRow,
  FundingRound,
  PoolCostToFounders,
  PoolCreationTiming,
  PoolShuffleCapTables,
  PoolShuffleOutcome,
  PreRoundHoldings,
} from './types';
import { fullyDilutedShares as fullyDilutedSharesOf } from './valuation';

/* ------------------------------------------------------------------------- *
 * Holdings and cap tables
 * ------------------------------------------------------------------------- */

function requireHoldings(holdings: PreRoundHoldings): void {
  requireNonNegative(holdings.founderShares, 'negativeShareCount', 'Founder shares cannot be negative.');
  requireNonNegative(
    holdings.investorShares,
    'negativeShareCount',
    'Investor shares cannot be negative.',
  );
  requireNonNegative(
    holdings.grantedOptions,
    'negativeShareCount',
    'Granted options cannot be negative.',
  );
  requireNonNegative(
    holdings.unallocatedPool,
    'negativeShareCount',
    'The unallocated pool cannot be negative.',
  );
}

/** S_ex. Shares excluding the unallocated pool: granted options are allocated. */
export function sharesExcludingPool(holdings: PreRoundHoldings): number {
  requireHoldings(holdings);

  return holdings.founderShares + holdings.investorShares + holdings.grantedOptions;
}

/**
 * S_ex + U, composed through the one definition of `FD_t` in section 3.
 *
 * A round's cap table splits the issued shares by holder and the roll forward
 * does not, but both are counting the same three things, so both go through
 * `fullyDilutedShares` in valuation.ts rather than each adding up its own terms.
 */
export function fullyDilutedShares(holdings: PreRoundHoldings): number {
  requireHoldings(holdings);

  return fullyDilutedSharesOf({
    issuedShares: holdings.founderShares + holdings.investorShares,
    grantedOutstandingOptions: holdings.grantedOptions,
    unallocatedPoolOptions: holdings.unallocatedPool,
  });
}

/** A cap table with its four rows, its total, and every percentage on the same base. */
export function capTable(label: string, holdings: PreRoundHoldings): CapTable {
  const total = fullyDilutedShares(holdings);

  requirePositive(
    total,
    'nonPositiveFullyDilutedShares',
    'A cap table with no shares in it cannot be drawn.',
    { label },
  );

  const row = (holder: CapTableRow['holder'], shares: number): CapTableRow => ({
    holder,
    shares,
    pctOfFullyDiluted: (shares / total) * 100,
  });

  return {
    label,
    rows: [
      row('founders', holdings.founderShares),
      row('investors', holdings.investorShares),
      row('grantedOptions', holdings.grantedOptions),
      row('unallocatedPool', holdings.unallocatedPool),
    ],
    total: { shares: total, pctOfFullyDiluted: 100 },
    fullyDilutedShares: total,
  };
}

/* ------------------------------------------------------------------------- *
 * The round itself
 * ------------------------------------------------------------------------- */

/** r = R / (Vpre + R). The investor's share of the post-money, by definition. */
export function investorFractionOfPostMoney(round: FundingRound): number {
  requirePositive(
    round.preMoneyValuation,
    'nonPositiveValuation',
    'Pre-money valuation must be above zero.',
    { roundId: round.id },
  );
  requirePositive(round.raiseAmount, 'nonPositiveRaiseAmount', 'A round must raise something.', {
    roundId: round.id,
  });

  return round.raiseAmount / (round.preMoneyValuation + round.raiseAmount);
}

/** pi, as a fraction. */
function poolFraction(round: FundingRound): number {
  const pi = round.investorRequiredPostRoundPoolPct / 100;

  if (!Number.isFinite(pi) || pi < 0 || pi >= 1) {
    throw new EsopEngineError(
      'poolPctOutOfRange',
      'The investor-required post-round pool must be at or above 0% and below 100%.',
      { roundId: round.id, investorRequiredPostRoundPoolPct: round.investorRequiredPostRoundPoolPct },
    );
  }

  return pi;
}

/**
 * The percentage of the post-round company the existing unallocated pool would
 * come to if this round created no new pool at all.
 *
 * This is the number to compare an investor's demand against. Comparing against
 * the pool's *pre-round* percentage is the natural mistake and it is wrong: the
 * existing pool is diluted by the round like everything else, so a pool sitting
 * at 11.1% before the round lands at 8.9% after a 20% round without a single
 * new option being reserved.
 */
export function existingPoolPostRoundPct(args: {
  readonly round: FundingRound;
  readonly holdings: PreRoundHoldings;
}): number {
  const { round, holdings } = args;

  const r = investorFractionOfPostMoney(round);
  const untouched = fullyDilutedShares(holdings) / (1 - r);

  requirePositive(
    untouched,
    'nonPositiveFullyDilutedShares',
    'The round leaves no shares outstanding.',
    { roundId: round.id },
  );

  return (holdings.unallocatedPool / untouched) * 100;
}

/** One round under one pool convention. Spec section 4.6. */
export function shuffleRound(args: {
  readonly round: FundingRound;
  readonly holdings: PreRoundHoldings;
  /** Defaults to whatever the round says it is being offered on. */
  readonly poolCreation?: PoolCreationTiming;
}): PoolShuffleOutcome {
  const { round, holdings } = args;
  const poolCreation = args.poolCreation ?? round.poolCreation;

  requireYearIndex(round.year);

  const sEx = sharesExcludingPool(holdings);
  requirePositive(
    sEx,
    'nonPositiveFullyDilutedShares',
    'A round needs shares outstanding before it to price against.',
    { roundId: round.id },
  );

  const u = holdings.unallocatedPool;
  const r = investorFractionOfPostMoney(round);
  const pi = poolFraction(round);
  const postMoneyValuation = round.preMoneyValuation + round.raiseAmount;

  const { postRoundFullyDiluted, investorShares, investorPricePerShare } =
    poolCreation === 'preMoney'
      ? preMoneyPoolRound({ round, sEx, pi, r })
      : postMoneyPoolRound({ round, sEx, u, pi });

  const postRoundPoolShares = pi * postRoundFullyDiluted;
  const newPoolShares = postRoundPoolShares - u;
  const postRoundPricePerShare = postMoneyValuation / postRoundFullyDiluted;

  const founderDilutionFromPoolPctPoints = (newPoolShares / postRoundFullyDiluted) * 100;

  return {
    poolCreation,
    postRoundFullyDiluted,
    investorShares,
    newPoolShares,
    postRoundPoolShares,
    investorPricePerShare,
    postRoundPricePerShare,
    investorPctOfFullyDiluted: (investorShares / postRoundFullyDiluted) * 100,
    founderPctOfFullyDiluted: (holdings.founderShares / postRoundFullyDiluted) * 100,
    founderDilutionFromPoolPctPoints,
    founderDilutionCostRupees: (founderDilutionFromPoolPctPoints / 100) * postMoneyValuation,
    capTables: buildCapTables({ holdings, poolCreation, investorShares, newPoolShares }),
  };
}

/**
 * The pool is cut first, so it sits inside the pre-money share count and the
 * investor's price is struck after it. `T = S_ex / (1 - pi - r)`.
 */
function preMoneyPoolRound(args: {
  readonly round: FundingRound;
  readonly sEx: number;
  readonly pi: number;
  readonly r: number;
}): Pick<
  PoolShuffleOutcome,
  'postRoundFullyDiluted' | 'investorShares' | 'investorPricePerShare'
> {
  const { round, sEx, pi, r } = args;

  const residual = 1 - pi - r;
  if (residual <= 0) {
    throw new EsopEngineError(
      'roundLeavesNoRoomForExistingHolders',
      'The investor stake and the required pool together take the whole company, so there is no post-round share count to solve for.',
      { roundId: round.id, investorFraction: r, poolFraction: pi },
    );
  }

  const postRoundFullyDiluted = sEx / residual;

  return {
    postRoundFullyDiluted,
    investorShares: postRoundFullyDiluted * r,
    // Vpre / (S_ex + pi*T), exactly as the spec writes it.
    investorPricePerShare: round.preMoneyValuation / (sEx + pi * postRoundFullyDiluted),
  };
}

/**
 * The money lands first, at the price the shares were worth with no new pool in
 * the count, and the pool is cut afterwards. Solving
 * `T = S_ex + I + pi*T` gives `T = (S_ex + I) / (1 - pi)`.
 *
 * The investor is diluted by the pool here, which is the entire point of the
 * comparison and the reason their post-round percentage lands below R/(Vpre+R).
 */
function postMoneyPoolRound(args: {
  readonly round: FundingRound;
  readonly sEx: number;
  readonly u: number;
  readonly pi: number;
}): Pick<
  PoolShuffleOutcome,
  'postRoundFullyDiluted' | 'investorShares' | 'investorPricePerShare'
> {
  const { round, sEx, u, pi } = args;

  const investorPricePerShare = round.preMoneyValuation / (sEx + u);
  const investorShares = round.raiseAmount / investorPricePerShare;

  return {
    postRoundFullyDiluted: (sEx + investorShares) / (1 - pi),
    investorShares,
    investorPricePerShare,
  };
}

function buildCapTables(args: {
  readonly holdings: PreRoundHoldings;
  readonly poolCreation: PoolCreationTiming;
  readonly investorShares: number;
  readonly newPoolShares: number;
}): PoolShuffleCapTables {
  const { holdings, poolCreation, investorShares, newPoolShares } = args;

  const withPool: PreRoundHoldings = {
    ...holdings,
    unallocatedPool: holdings.unallocatedPool + newPoolShares,
  };
  const withMoney: PreRoundHoldings = {
    ...holdings,
    investorShares: holdings.investorShares + investorShares,
  };
  const withBoth: PreRoundHoldings = {
    ...withPool,
    investorShares: holdings.investorShares + investorShares,
  };

  const before = capTable('Before the round', holdings);

  if (poolCreation === 'preMoney') {
    const afterPoolCreated = capTable('After the pool is created, before the round', withPool);
    const afterRound = capTable('After the round', withBoth);

    return { before, afterPoolCreated, afterRound, final: afterRound };
  }

  const afterRound = capTable('After the round, before the pool is created', withMoney);
  const afterPoolCreated = capTable('After the pool is created', withBoth);

  return { before, afterPoolCreated, afterRound, final: afterPoolCreated };
}

/* ------------------------------------------------------------------------- *
 * The comparison, and the number the founder is here for
 * ------------------------------------------------------------------------- */

/** Both conventions for one round, and the delta between them. Spec section 4.6. */
export function poolCostToFounders(args: {
  readonly round: FundingRound;
  readonly holdings: PreRoundHoldings;
}): PoolCostToFounders {
  const { round, holdings } = args;

  const preMoneyPool = shuffleRound({ round, holdings, poolCreation: 'preMoney' });
  const postMoneyPool = shuffleRound({ round, holdings, poolCreation: 'postMoney' });

  const postMoneyValuation = round.preMoneyValuation + round.raiseAmount;
  const founderOwnershipDeltaPctPoints =
    postMoneyPool.founderPctOfFullyDiluted - preMoneyPool.founderPctOfFullyDiluted;

  return {
    roundId: round.id,
    asOffered: round.poolCreation,
    preMoneyPool,
    postMoneyPool,
    deltaPctPoints:
      preMoneyPool.founderDilutionFromPoolPctPoints -
      postMoneyPool.founderDilutionFromPoolPctPoints,
    deltaRupees: preMoneyPool.founderDilutionCostRupees - postMoneyPool.founderDilutionCostRupees,
    founderOwnershipDeltaPctPoints,
    founderOwnershipDeltaRupees: (founderOwnershipDeltaPctPoints / 100) * postMoneyValuation,
  };
}

/* ------------------------------------------------------------------------- *
 * The schedule
 * ------------------------------------------------------------------------- */

export interface RoundScheduleStep {
  readonly round: FundingRound;
  readonly openingHoldings: PreRoundHoldings;
  /** The round as actually offered, per `round.poolCreation`. */
  readonly outcome: PoolShuffleOutcome;
  /** Both conventions and the delta, for this round. */
  readonly cost: PoolCostToFounders;
  /** What the next round opens on. */
  readonly closingHoldings: PreRoundHoldings;
}

/**
 * Every round in order, each opening on the cap table the last one closed with.
 *
 * The chain follows `round.poolCreation`, the structure the founder is actually
 * being offered. The post-money counterfactual on each step is a comparison for
 * that round alone and is not carried forward, because a founder who wins that
 * argument once has a different company from then on and the point of the
 * number is what that single argument is worth.
 */
export function runRoundSchedule(args: {
  readonly rounds: readonly FundingRound[];
  readonly openingHoldings: PreRoundHoldings;
}): readonly RoundScheduleStep[] {
  const { rounds, openingHoldings } = args;

  requireHoldings(openingHoldings);

  const steps: RoundScheduleStep[] = [];
  let holdings = openingHoldings;
  let previousYear = -1;

  for (const round of rounds) {
    requireYearIndex(round.year);
    if (round.year <= previousYear) {
      throw new EsopEngineError(
        'roundsOutOfOrder',
        'Rounds must be given in order, one per year at most.',
        { roundId: round.id, year: round.year, previousYear },
      );
    }
    previousYear = round.year;

    const outcome = shuffleRound({ round, holdings });
    const cost = poolCostToFounders({ round, holdings });

    const closingHoldings: PreRoundHoldings = {
      founderShares: holdings.founderShares,
      investorShares: holdings.investorShares + outcome.investorShares,
      grantedOptions: holdings.grantedOptions,
      unallocatedPool: holdings.unallocatedPool + outcome.newPoolShares,
    };

    steps.push({ round, openingHoldings: holdings, outcome, cost, closingHoldings });
    holdings = closingHoldings;
  }

  return steps;
}
