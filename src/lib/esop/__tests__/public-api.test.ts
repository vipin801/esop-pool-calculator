/**
 * The public surface, frozen.
 *
 * `index.ts` says `calculateEsopPool` is the only function the front end may
 * import. This file is what makes that a check rather than a sentence: it pins
 * the exact list of runtime exports, and it asserts that none of the engine's
 * internal computation functions can be reached through the barrel.
 *
 * The second assertion is the one that matters. Every one of those functions is
 * a legitimate part of the engine and a mistake in a component: `runRollForward`
 * lets a caller run the plan at whatever pool they feel like and print the
 * result beside a recommendation solved at a different one, which is exactly the
 * failure LOG [020] reconciles. The assembler runs both and labels them, and
 * that is the only way in.
 *
 * Adding an export here should fail this test. That is the point of a freeze:
 * the list changes when someone decides it should, not when someone adds a line
 * to `index.ts` on the way to something else.
 */

import { describe, expect, it } from 'vitest';

import * as api from '../index';

/** Every name `index.ts` exports at runtime. Types are erased and cannot appear. */
const PUBLIC_RUNTIME_EXPORTS = [
  'ADVISORY_TRACK',
  'BANDS',
  'BENCHMARK_STAGE_ORDER',
  'BENCHMARK_TRACKS',
  'COMPLIANCE_CHECK_IDS',
  'COMPLIANCE_DISCLAIMER',
  'DEFAULTS',
  'DEFAULT_ATTRITION_BY_SECTOR_PCT',
  'DEFAULT_GRANT_BASIS_BY_STAGE',
  'DEFAULT_GRANT_PCT_BY_BAND',
  'DEFAULT_GRANT_VALUE_BY_BAND',
  'DEFAULT_SENIORITY_MIX_PCT',
  'DEFAULT_STRIKE_POLICY_BY_STAGE',
  'ENGINE_WARNING_IDS',
  'ESOP_ERROR_CODES',
  'EXERCISE_WINDOW_DAYS_OPTIONS',
  'EXPOSED_INSTRUMENTS',
  'EsopEngineError',
  'INSTRUMENTS',
  'OBSERVED_TRACK',
  'SOLVER',
  'STAGES',
  'STATUTORY',
  'VALUE_BASES',
  'baseAttritionPctForSector',
  'calculateEsopPool',
  'isEsopEngineError',
] as const;

/**
 * Callables that are allowed out, and why each is not a second way to run the
 * model.
 *
 * `EsopEngineError` is a class, so `typeof` reads as a function; a caller needs
 * it for `instanceof`. `isEsopEngineError` is the same need without the class.
 * `baseAttritionPctForSector` is a lookup in a defaults table, for a form to
 * call when the founder changes sector — M16 — and it computes nothing.
 */
const ALLOWED_CALLABLES = [
  'EsopEngineError',
  'baseAttritionPctForSector',
  'calculateEsopPool',
  'isEsopEngineError',
];

/**
 * Engine internals that must not be reachable through the barrel. Each of these
 * is exported from its own module, on purpose, for the tests and for the other
 * engine modules — and for nobody else.
 */
const MUST_NOT_ESCAPE = [
  'runRollForward',
  'solveRecommendedPool',
  'recommendedPoolUnderBothBases',
  'runRoundSchedule',
  'shuffleRound',
  'poolCostToFounders',
  'esopExpenseSchedule',
  'runComplianceChecks',
  'newHireGrantDemand',
  'refreshGrantDemand',
  'denominatorFor',
  'denominatorForYear',
  'allDenominatorsForYear',
  'thetaScaledFairValue',
  'fullyDilutedShares',
  'pricePerShare',
  'valuationAtYear',
  'advanceGrantCohorts',
  'stepGrantCohort',
  'cohortPolicy',
  'vestedFraction',
  'capTable',
  'compareToBenchmarks',
  'poolOptionsForPct',
  'roundPoolPctForDisplay',
];

describe('the engine public surface', () => {
  it('exports exactly the names it says it does', () => {
    expect(Object.keys(api).sort()).toEqual([...PUBLIC_RUNTIME_EXPORTS].sort());
  });

  it('exposes calculateEsopPool as a function', () => {
    expect(typeof api.calculateEsopPool).toBe('function');
  });

  it('lets no other engine computation out', () => {
    const callables = Object.entries(api)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name);

    expect(callables.sort()).toEqual([...ALLOWED_CALLABLES].sort());
  });

  it('keeps every internal out of the barrel by name', () => {
    const exported = new Set(Object.keys(api));

    for (const name of MUST_NOT_ESCAPE) {
      expect(exported.has(name), `${name} escaped through index.ts`).toBe(false);
    }
  });

  it('exports the defaults a form has to seed itself from', () => {
    /**
     * D6: every default is an editable estimate shown as one. That is only
     * possible if the form can read the provenance and the `what` line, so the
     * whole table goes out, not a flattened set of values.
     */
    expect(api.DEFAULTS.attritionBaseAnnualPct.provenance).toBe('estimate');
    expect(api.DEFAULTS.bufferPct.provenance).toBe('provisional');
    expect(typeof api.DEFAULTS.hiresPerYear.what).toBe('string');
  });

  it('exports both benchmark tracks, and neither alone', () => {
    /** D5: both tracks are always shown together, so there is no single-track door. */
    expect(api.BENCHMARK_TRACKS).toHaveLength(2);
    expect(api.BENCHMARK_TRACKS.map((track) => track.id)).toEqual(['advisory', 'observed']);
  });
});
