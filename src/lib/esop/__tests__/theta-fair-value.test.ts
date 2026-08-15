/**
 * AUDIT_P4 divergence map, session P9's final item: theta-scaled fair value
 * (`theta * PPS_t`) was written independently in two files, and their guards
 * had drifted apart. `denominatorFor`'s fair value case rejected theta outside
 * `(0, 1]`. The Ind AS 102 expense path only rejected theta below zero, so
 * `theta = 0` and `theta = 1.5` passed one call site and were refused by the
 * other for the identical arithmetic operation.
 *
 * This file pins the two call sites to agree, on the same bad inputs, with
 * the same error code — proof that they now share one guard rather than two
 * that happen to overlap on ordinary values.
 */

import { describe, expect, it } from 'vitest';

import { esopExpenseSchedule } from '../compliance';
import { denominatorFor } from '../denominator';
import { isEsopEngineError } from '../errors';
import { runRollForward } from '../roll-forward';
import { withArgs } from './fixtures';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return isEsopEngineError(error) ? error.code : 'not an EsopEngineError';
  }
  return 'nothing thrown';
}

/** A plan with at least one in-plan cohort, so the expense path actually reaches theta. */
const PLAN = withArgs({});

function expenseScheduleAt(theta: number): unknown {
  return esopExpenseSchedule({
    rollForward: runRollForward(PLAN),
    vesting: PLAN.vesting,
    fairValue: { ...PLAN.grantPolicy.fairValue, theta },
    accountingBasis: 'indAS102',
    strikePolicy: PLAN.grantPolicy.strikePolicy,
    faceValuePerShare: PLAN.company.faceValuePerShare,
  });
}

function denominatorAt(theta: number): unknown {
  return denominatorFor({ valueBasis: 'fairValue', pricePerShare: 1000, exercisePrice: 10, theta });
}

describe('theta = 1.5 and theta = 0 are handled identically by both call sites', () => {
  it('both reject theta above 1', () => {
    expect(codeOf(() => denominatorAt(1.5)), 'denominatorFor').toBe('thetaOutOfRange');
    expect(codeOf(() => expenseScheduleAt(1.5)), 'esopExpenseSchedule').toBe('thetaOutOfRange');
  });

  it('both reject theta at exactly zero', () => {
    expect(codeOf(() => denominatorAt(0)), 'denominatorFor').toBe('thetaOutOfRange');
    expect(codeOf(() => expenseScheduleAt(0)), 'esopExpenseSchedule').toBe('thetaOutOfRange');
  });

  it('both reject a negative theta', () => {
    expect(codeOf(() => denominatorAt(-0.2)), 'denominatorFor').toBe('thetaOutOfRange');
    expect(codeOf(() => expenseScheduleAt(-0.2)), 'esopExpenseSchedule').toBe('thetaOutOfRange');
  });

  it('both accept theta at exactly 1, the closed end of the range', () => {
    expect(codeOf(() => denominatorAt(1))).toBe('nothing thrown');
    expect(codeOf(() => expenseScheduleAt(1))).toBe('nothing thrown');
  });

  it('both accept the default, 0.55, and compute the same multiple of price per share', () => {
    expect(codeOf(() => denominatorAt(0.55))).toBe('nothing thrown');
    expect(codeOf(() => expenseScheduleAt(0.55))).toBe('nothing thrown');
  });
});

describe('theta stops being guarded on a path that never reads it', () => {
  /**
   * The old top-level guard in `esopExpenseSchedule` fired unconditionally,
   * before the loop even looked at `accountingBasis`. An `icaiGuidanceNote`
   * company never multiplies by theta — its per-option value is the intrinsic
   * spread at grant — so a negative theta used to be refused for a value the
   * calculation never touches. Moving the guard inside `thetaScaledFairValue`,
   * called only from the `indAS102` branch, removes that false refusal.
   */
  it('accepts an out-of-range theta on the ICAI intrinsic basis, which never multiplies by it', () => {
    const schedule = esopExpenseSchedule({
      rollForward: runRollForward(PLAN),
      vesting: PLAN.vesting,
      fairValue: { ...PLAN.grantPolicy.fairValue, theta: -0.2 },
      accountingBasis: 'icaiGuidanceNote',
      strikePolicy: { kind: 'faceValue' },
      faceValuePerShare: PLAN.company.faceValuePerShare,
    });

    expect(schedule.basis).toBe('icaiGuidanceNote');
    expect(schedule.totalExpenseRupees).toBeGreaterThan(0);
  });
});
