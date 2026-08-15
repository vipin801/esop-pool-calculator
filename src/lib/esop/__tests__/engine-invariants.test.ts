/**
 * What must be true of every number the engine emits, on every input.
 *
 * A money engine has two failure modes worse than a wrong answer. One is NaN or
 * Infinity, which propagates silently through a report and surfaces as a blank
 * cell in front of an investor. The other is a negative share count, which is
 * arithmetically fine and physically impossible, and which a founder will read
 * as a number rather than as a bug.
 *
 * So this file asserts the shape of the output rather than its value, over 500
 * generated cases. It walks the output objects by key instead of listing the
 * fields, so a field added to `RollForwardYear` next month is covered the day it
 * lands rather than the day someone remembers to add it here.
 *
 * Three fields are allowed to go negative, for two different reasons, and both
 * reasons are written down rather than lumped into one permissive list. A field
 * that is not on either list and goes negative fails, so nothing new can slip
 * through by resembling something that was already excused.
 */

import { describe, expect, it } from 'vitest';

import { solveRecommendedPool } from '../pool-solver';
import { runRollForward, type RollForwardResult } from '../roll-forward';
import { randomCases } from './random-inputs';

const CASES = randomCases(500);

/**
 * The deficit fields. Section 4.4 defines exhaustion as the first year where
 * `Available_t` drops below zero, so clamping the balance would delete the
 * signal the exhaustion month is read off.
 */
const DEFICIT_FIELDS = ['openingAvailable', 'closingAvailable'] as const;

/**
 * Not a count of anything. `ageYearsAtEndOfYear0` is an offset on the year axis,
 * and it is `-grantYear` for every cohort granted inside the plan, so it is
 * negative for every cohort after year 0 by construction.
 */
const AXIS_FIELDS = ['ageYearsAtEndOfYear0'] as const;

const MAY_BE_NEGATIVE = new Set<string>([...DEFICIT_FIELDS, ...AXIS_FIELDS]);

interface Problem {
  readonly seed: number;
  readonly where: string;
  readonly value: number;
}

function checkNumbers(args: {
  readonly seed: number;
  readonly where: string;
  readonly value: unknown;
  readonly problems: Problem[];
}): void {
  const { seed, where, value, problems } = args;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      problems.push({ seed, where: `${where} is not finite`, value });
      return;
    }
    const key = where.split('.').at(-1) ?? where;
    if (value < 0 && !MAY_BE_NEGATIVE.has(key)) {
      problems.push({ seed, where: `${where} is negative`, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkNumbers({ seed, where: `${where}[${index}]`, value: item, problems }),
    );
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      checkNumbers({ seed, where: `${where}.${key}`, value: nested, problems });
    }
  }
}

function describeProblems(problems: readonly Problem[]): readonly string[] {
  return problems.slice(0, 20).map((problem) => `seed ${problem.seed}: ${problem.where} = ${problem.value}`);
}

describe('over 500 generated valid inputs', () => {
  it('generates the number of cases it claims to', () => {
    expect(CASES).toHaveLength(500);
    expect(new Set(CASES.map((testCase) => testCase.seed)).size).toBe(500);
  });

  it('every roll forward field is finite, and non-negative unless it is a deficit', () => {
    const problems: Problem[] = [];

    for (const { seed, args } of CASES) {
      checkNumbers({ seed, where: 'rollForward', value: runRollForward(args), problems });
    }

    expect(describeProblems(problems)).toEqual([]);
  });

  it('every solver field is finite and non-negative', () => {
    const problems: Problem[] = [];

    for (const { seed, args } of CASES) {
      const solution = solveRecommendedPool(args);

      checkNumbers({ seed, where: 'sizing', value: solution.sizing, problems });
      checkNumbers({ seed, where: 'solver', value: solution.solver, problems });
      checkNumbers({
        seed,
        where: 'totals',
        value: {
          bufferedRequirementOptions: solution.bufferedRequirementOptions,
          netConsumptionOptions: solution.netConsumptionOptions,
          grossConsumptionOptions: solution.grossConsumptionOptions,
          returnedToPoolOptions: solution.returnedToPoolOptions,
          fullyDilutedSharesAtYear0: solution.fullyDilutedSharesAtYear0,
        },
        problems,
      });
    }

    expect(describeProblems(problems)).toEqual([]);
  });

  it('never reports a pool percentage outside [0, 100)', () => {
    for (const { seed, args } of CASES) {
      const { sizing } = solveRecommendedPool(args);

      expect(sizing.poolPctOfFullyDiluted, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(sizing.poolPctOfFullyDiluted, `seed ${seed}`).toBeLessThan(100);
    }
  });
});

describe('the bucket identity holds on every generated case', () => {
  it('issued plus granted plus available equals fully diluted, every year', () => {
    const failures: string[] = [];

    for (const { seed, args } of CASES) {
      for (const year of runRollForward(args).years) {
        const sum =
          year.closingIssuedShares + year.closingGrantedOutstanding + year.closingAvailable;
        const slack = Math.max(Math.abs(year.fullyDilutedShares), 1) * 1e-9;

        if (Math.abs(sum - year.fullyDilutedShares) > slack) {
          failures.push(`seed ${seed} year ${year.year}: ${sum} vs ${year.fullyDilutedShares}`);
        }
      }
    }

    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('conservation across the cohorts', () => {
  it('never lets more options leave a cohort than were granted into it', () => {
    const failures: string[] = [];

    for (const { seed, args } of CASES) {
      const run: RollForwardResult = runRollForward(args);

      const grantedIn =
        run.totalGrossConsumptionOptions +
        (args.openingCohorts ?? []).reduce((sum, cohort) => sum + cohort.outstandingOptions, 0);
      const goneOut =
        run.totalReturnedToPool + run.totalExercisedShares + run.totalCancelledNotRecycled;

      if (goneOut > grantedIn * (1 + 1e-9) + 1e-6) {
        failures.push(`seed ${seed}: ${goneOut} left a book of ${grantedIn}`);
      }

      if (Math.abs(grantedIn - goneOut - run.closingGrantedOutstanding) > Math.max(grantedIn, 1) * 1e-9) {
        failures.push(
          `seed ${seed}: ${grantedIn} in, ${goneOut} out, ${run.closingGrantedOutstanding} left`,
        );
      }
    }

    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('never returns an exercised option to the pool', () => {
    for (const { seed, args } of CASES) {
      const run = runRollForward(args);

      for (const year of run.years) {
        expect(year.returnedToPool, `seed ${seed} year ${year.year}`).toBeCloseTo(
          args.exercise.recycleForfeited ? year.unvestedForfeited + year.vestedLapsed : 0,
          6,
        );
      }
    }
  });
});
