import { describe, expect, it } from 'vitest';

import {
  BANDS,
  COMPLIANCE_DISCLAIMER,
  ENGINE_WARNING_IDS,
  EXERCISE_WINDOW_DAYS_OPTIONS,
  EXPOSED_INSTRUMENTS,
  type Band,
  type ComplianceCheck,
  type ComplianceInputs,
  type EngineWarningId,
  type EsopInputs,
  type ExerciseWindowDays,
  type FundingRound,
  type GrantBasis,
  type Instrument,
  type Provenance,
  type StrikePolicy,
} from '../types';

/* ------------------------------------------------------------------------- *
 * Type-level assertions. These are checked by `pnpm typecheck`, not at
 * runtime: a failure is a tsc error, which is a red gate.
 * ------------------------------------------------------------------------- */

type Expect<T extends true> = T;
type Equal<X, Y> =
  (<A>() => A extends X ? 1 : 2) extends <A>() => A extends Y ? 1 : 2 ? true : false;

/** The two forks the spec calls fatal if unmodelled. */
type _grantBasisForkIsClosed = Expect<
  Equal<GrantBasis['kind'], 'percentOfEquity' | 'rupeeValue'>
>;
type _strikePolicyForkIsClosed = Expect<
  Equal<StrikePolicy['kind'], 'faceValue' | 'lastRoundPrice' | 'discountToFMV'>
>;

/** PROJECT.md D6: exactly two provenance tiers, and no `sourced`. */
type _provenanceHasNoSourcedTier = Expect<Equal<Provenance, 'estimate' | 'provisional'>>;

/** PROJECT.md D4: two separate compliance toggles, never one. */
type _dpiitIsItsOwnToggle = Expect<Equal<ComplianceInputs['dpiitRecognised'], boolean>>;
type _imbIsItsOwnToggle = Expect<Equal<ComplianceInputs['imbCertified80IAC'], boolean>>;

/** Every compliance row carries the exact disclaimer, enforced by a literal type. */
type _disclaimerIsALiteral = Expect<
  Equal<ComplianceCheck['disclaimer'], 'General information, not legal advice.'>
>;

/** Spec section 6 names exactly four exercise windows. */
type _exerciseWindowIsClosed = Expect<Equal<ExerciseWindowDays, 30 | 90 | 365 | 1825>>;

type _bandsAreClosed = Expect<Equal<Band, 'leadership' | 'senior' | 'mid' | 'junior'>>;

/** Spec section 4.6. The round schedule carries every input the pool shuffle needs. */
type _roundCarriesSpecInputs = Expect<
  Equal<
    keyof FundingRound,
    | 'id'
    | 'label'
    | 'year'
    | 'preMoneyValuation'
    | 'raiseAmount'
    | 'investorRequiredPostRoundPoolPct'
    | 'poolCreation'
  >
>;

/** The round schedule hangs off the root input, not off some optional extra. */
type _roundsAreOnTheInput = Expect<Equal<EsopInputs['rounds'], readonly FundingRound[]>>;

/**
 * `EngineWarningId` is enumerable, mirroring `ESOP_ERROR_CODES` in errors.ts and
 * `COMPLIANCE_CHECK_IDS` above: the type has to be exactly the array's members,
 * not a superset or a subset written by hand alongside it, so a warning id
 * cannot exist in the type and nowhere at runtime.
 */
type _engineWarningIdIsEnumerable = Expect<
  Equal<EngineWarningId, (typeof ENGINE_WARNING_IDS)[number]>
>;

/* The directives below must sit on the line immediately above the offending
 * expression, so each illegal literal is passed to a one-line acceptor. */
function acceptGrantBasis(_basis: GrantBasis): void {}
function acceptStrikePolicy(_policy: StrikePolicy): void {}

/* A rupee grant table cannot exist without the basis that gives it meaning. */
// @ts-expect-error grantValueByBand belongs to the rupeeValue arm, not percentOfEquity
acceptGrantBasis({ kind: 'percentOfEquity', grantValueByBand: { leadership: 1 } });

/* A discount percentage cannot be smuggled onto a face-value strike. */
// @ts-expect-error discountPct belongs to the discountToFMV arm only
acceptStrikePolicy({ kind: 'faceValue', discountPct: 20 });

/* ------------------------------------------------------------------------- *
 * Runtime assertions
 * ------------------------------------------------------------------------- */

/** Exercises both arms and fails to compile if a third is ever added silently. */
function summariseGrantBasis(basis: GrantBasis): string {
  switch (basis.kind) {
    case 'percentOfEquity':
      return `percentOfEquity:${Object.keys(basis.grantPctByBand).length}`;
    case 'rupeeValue':
      return `rupeeValue:${Object.keys(basis.grantValueByBand).length}`;
    default: {
      const exhaustive: never = basis;
      return exhaustive;
    }
  }
}

describe('grant basis fork', () => {
  it('narrows to a band table on each arm', () => {
    const basisA: GrantBasis = {
      kind: 'percentOfEquity',
      grantPctByBand: { leadership: 0.9, senior: 0.225, mid: 0.1, junior: 0.06 },
    };
    const basisB: GrantBasis = {
      kind: 'rupeeValue',
      grantValueByBand: { leadership: 8000000, senior: 2500000, mid: 1000000, junior: 300000 },
    };

    expect(summariseGrantBasis(basisA)).toBe('percentOfEquity:4');
    expect(summariseGrantBasis(basisB)).toBe('rupeeValue:4');
  });
});

describe('enumerations', () => {
  it('has four seniority bands, in seniority order', () => {
    expect(BANDS).toEqual(['leadership', 'senior', 'mid', 'junior']);
  });

  it('exposes only ESOP, because the Bill 2026 is not law', () => {
    const exposed: readonly Instrument[] = EXPOSED_INSTRUMENTS;
    expect(exposed).toEqual(['ESOP']);
  });

  it('offers the four exercise windows the spec names', () => {
    expect(EXERCISE_WINDOW_DAYS_OPTIONS).toEqual([30, 90, 365, 1825]);
  });

  it('defaults the exercise window options to include 90 days', () => {
    const options: readonly number[] = EXERCISE_WINDOW_DAYS_OPTIONS;
    expect(options).toContain(90);
  });
});

describe('engine warning ids', () => {
  /**
   * AUDIT_P4 session P9, item 4(a). `cliffBelowStatutoryMinimum` was a member
   * of `EngineWarningId` from [004] to [012]. Section 5's twelve-month floor is
   * now enforced by `requireLawfulVestingSchedule` throwing an `EsopErrorCode`
   * of the same name — a different union — before an engine call exists that
   * could warn about it instead. A warning with no reachable path to it is dead
   * code, and it must not survive as a member of an otherwise-live union where
   * it is indistinguishable from one.
   */
  it('does not carry the vesting floor, which the engine blocks rather than warns about', () => {
    expect(ENGINE_WARNING_IDS).not.toContain('cliffBelowStatutoryMinimum');
  });

  it('is exactly the four warnings the engine can still raise', () => {
    expect([...ENGINE_WARNING_IDS].sort()).toEqual(
      [
        'notionalValueOverstatesReceipt',
        'authorisedCapitalShortfall',
        'solverDidNotConverge',
        'seniorityMixDoesNotSumTo100',
      ].sort(),
    );
  });
});

describe('compliance disclaimer', () => {
  it('is the exact wording PROJECT.md requires', () => {
    expect(COMPLIANCE_DISCLAIMER).toBe('General information, not legal advice.');
  });
});
