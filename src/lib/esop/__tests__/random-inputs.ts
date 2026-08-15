/**
 * A generator of plausible engine inputs, for the property and fuzz runs.
 *
 * Deterministic on purpose. The PRNG is seeded, so a failure at case 361 is a
 * failure anyone can reproduce by running case 361 again, and the suite cannot
 * go green or red depending on the day. That is worth more here than the wider
 * coverage a random seed would buy.
 *
 * "Plausible" is a claim this file has to earn rather than assert, so the bounds
 * below say why they are where they are. The one that matters for section 4.5 is
 * total grant demand: the fixed point converges at a rate set by how much of the
 * company the plan gives away over the horizon, so a plan that grants away most
 * of the business is not a slow case, it is a case with no answer in range. The
 * hiring and grant bounds keep the generated plans inside roughly half the
 * company, which is where a founder using this tool actually lives.
 */

import type { RollForwardArgs } from '../roll-forward';
import type {
  AttritionInputs,
  Band,
  CompanyInputs,
  ExerciseInputs,
  ExerciseWindowDays,
  GrantBasis,
  GrantPolicyInputs,
  SeniorityMix,
  StrikePolicy,
  ValueBasis,
  VestingSchedule,
} from '../types';

/** mulberry32. Small, fast, and good enough to shake out arithmetic. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Draw {
  readonly between: (low: number, high: number) => number;
  readonly intBetween: (low: number, high: number) => number;
  readonly pick: <T>(options: readonly T[]) => T;
  readonly chance: (probability: number) => boolean;
}

function drawFrom(random: () => number): Draw {
  const between = (low: number, high: number): number => low + random() * (high - low);

  return {
    between,
    intBetween: (low, high) => Math.floor(between(low, high + 1 - Number.EPSILON)),
    pick: <T,>(options: readonly T[]): T => {
      const chosen = options[Math.floor(random() * options.length)];
      if (chosen === undefined) throw new Error('cannot pick from an empty list');
      return chosen;
    },
    chance: (probability) => random() < probability,
  };
}

/**
 * A mix where leadership is a small slice and the bulk sits at mid and junior.
 * A company hiring 30% VPs is not a company; it is a way to make the fixed point
 * diverge and then blame the solver.
 */
function seniorityMix(draw: Draw): SeniorityMix {
  const leadership = draw.between(0, 10);
  const senior = draw.between(10, 30);
  const rest = 100 - leadership - senior;
  const mid = rest * draw.between(0.4, 0.7);

  return { leadership, senior, mid, junior: rest - mid };
}

/** Basis A: the M1 midpoints, jittered inside the advisory range. */
function percentOfEquityBasis(draw: Draw): GrantBasis {
  const jitter = draw.between(0.5, 1.3);

  return {
    kind: 'percentOfEquity',
    grantPctByBand: {
      leadership: 0.9 * jitter,
      senior: 0.225 * jitter,
      mid: 0.1 * jitter,
      junior: 0.06 * jitter,
    },
  };
}

/**
 * Basis B: rupee grants scaled to the company, because that is the only way a
 * rupee figure is plausible. A ₹80 lakh leadership grant is generous at a ₹500
 * crore valuation and absurd at ₹5 crore, and the tool has to work at both.
 */
function rupeeValueBasis(draw: Draw, valuation: number): GrantBasis {
  const jitter = draw.between(0.5, 1.3);

  return {
    kind: 'rupeeValue',
    grantValueByBand: {
      leadership: valuation * 0.009 * jitter,
      senior: valuation * 0.00225 * jitter,
      mid: valuation * 0.001 * jitter,
      junior: valuation * 0.0006 * jitter,
    },
  };
}

/**
 * The realisable basis divides by PPS_t - X_t, which is zero when the strike is
 * the last round price. That is a typed refusal, not a bug, and section 2 says
 * so — so the generator pairs realisable with a strike that leaves a spread
 * rather than generating cases whose only outcome is a documented error.
 */
function strikePolicyFor(draw: Draw, valueBasis: ValueBasis): StrikePolicy {
  if (valueBasis === 'realisable') {
    return draw.chance(0.5)
      ? { kind: 'faceValue' }
      : { kind: 'discountToFMV', discountPct: draw.between(20, 80) };
  }

  return draw.pick<StrikePolicy>([
    { kind: 'faceValue' },
    { kind: 'lastRoundPrice' },
    { kind: 'discountToFMV', discountPct: draw.between(0, 90) },
  ]);
}

export interface RandomCase {
  readonly seed: number;
  readonly args: RollForwardArgs;
}

export function randomArgs(seed: number): RandomCase {
  const draw = drawFrom(seededRandom(seed));

  /**
   * Valuation is drawn as a multiple of the share count, so the price per share
   * stays well clear of the ₹10 face value floor even after six years of the
   * flattest growth path the generator will produce.
   */
  const fullyDilutedShares = draw.between(1_000_000, 100_000_000);
  const postMoneyValuation = fullyDilutedShares * draw.between(200, 5_000);

  const unallocatedPct = draw.between(0, 10);
  const grantedPct = draw.between(0, 15);
  const existingUnallocatedOptions = (fullyDilutedShares * unallocatedPct) / 100;
  const grantedOutstandingOptions = draw.chance(0.5)
    ? (fullyDilutedShares * grantedPct) / 100
    : 0;

  const company: CompanyInputs = {
    stage: draw.pick(['preSeed', 'seed', 'seriesA', 'seriesB', 'seriesCPlus'] as const),
    companyType: draw.pick(['private', 'unlistedPublic'] as const),
    postMoneyValuation,
    fullyDilutedShares,
    existingUnallocatedOptions,
    grantedOutstandingOptions,
    faceValuePerShare: draw.pick([1, 10] as const),
    authorisedCapitalShares: fullyDilutedShares * draw.between(0.5, 2),
  };

  const horizonYears = draw.intBetween(1, 5);
  const hiresPerYear = Array.from({ length: horizonYears }, () => draw.intBetween(0, 18));

  const valueBasis = draw.pick<ValueBasis>(['notional', 'realisable', 'fairValue']);
  const grantBasis = draw.chance(0.5)
    ? percentOfEquityBasis(draw)
    : rupeeValueBasis(draw, postMoneyValuation);

  const grantPolicy: GrantPolicyInputs = {
    grantBasis,
    strikePolicy: strikePolicyFor(draw, valueBasis),
    valueBasis,
    compInflationPctPerYear: draw.between(0, 12),
    refresh: {
      ratePct: draw.between(0, 35),
      sizePct: draw.between(0, 60),
      eligibilityMonths: draw.pick([12, 18, 24, 36] as const),
    },
    bufferPct: draw.between(0, 25),
    fairValue: {
      theta: draw.between(0.2, 1),
      expectedLifeYears: draw.between(2, 6),
      volatilityPct: draw.between(30, 90),
    },
  };

  const attrition: AttritionInputs = {
    baseAnnualPct: draw.between(0, 40),
    byBand: draw.chance(0.5) ? { leadership: draw.between(0, 30) } : {},
    sector: draw.pick(['general', 'itServices', 'ecommerce'] as const),
  };

  const exercise: ExerciseInputs = {
    exerciseWindowDays: draw.pick<ExerciseWindowDays>([30, 90, 365, 1825]),
    vestedNeverExercisedPct: draw.between(0, 100),
    continuingEmployeeExercisePctPerYear: draw.chance(0.25) ? draw.between(0, 15) : 0,
    recycleForfeited: draw.chance(0.5),
  };

  const cliffMonths = draw.pick([12, 18, 24] as const);
  const vesting: VestingSchedule = {
    cliffMonths,
    vestYears: draw.pick([3, 4, 5] as const),
    frequency: draw.pick(['monthly', 'quarterly', 'annual'] as const),
  };

  const bands: readonly Band[] = ['leadership', 'senior', 'mid', 'junior'];
  const openingCohorts =
    grantedOutstandingOptions > 0
      ? bands.map((band, index) => ({
          id: `opening#${index}:${band}`,
          band,
          grantYear: null,
          ageYearsAtEndOfYear0: draw.between(0, 5) + 1,
          grantedOptions: grantedOutstandingOptions / bands.length,
          outstandingOptions: grantedOutstandingOptions / bands.length,
          fromNewHires: grantedOutstandingOptions / bands.length,
          fromRefresh: 0,
        }))
      : [];

  const openingHeadcount = draw.chance(0.5)
    ? bands.map((band) => ({
        band,
        hireYear: null,
        tenureYearsAtMidYear0: draw.between(0, 6),
        headcount: draw.intBetween(0, 10),
      }))
    : [];

  return {
    seed,
    args: {
      company,
      hiring: { horizonYears, hiresPerYear, seniorityMix: seniorityMix(draw) },
      growth: { valuationGrowthPctPerYear: draw.between(0, 100) },
      grantPolicy,
      attrition,
      exercise,
      vesting,
      topUps: draw.chance(0.3)
        ? [{ year: draw.intBetween(0, horizonYears - 1), options: draw.between(0, 500_000) }]
        : [],
      openingCohorts,
      openingHeadcount,
    },
  };
}

export function randomCases(count: number, firstSeed = 1): readonly RandomCase[] {
  return Array.from({ length: count }, (_unused, index) => randomArgs(firstSeed + index));
}
