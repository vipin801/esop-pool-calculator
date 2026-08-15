/**
 * ENGINE_SPEC.md section 5, rule by rule, plus the Ind AS 102 paragraph.
 *
 * Two tests here exist because PROJECT.md prohibits getting them wrong rather
 * than because the code looked risky: a DPIIT-only company must never receive a
 * deferral-available result, and every returned row must carry the not-legal-
 * advice string. Both are asserted across the whole input space that can
 * produce them, not on one happy path.
 */

import { describe, expect, it } from 'vitest';

import {
  dpiitExemptionExpiry,
  esopExpenseSchedule,
  isTaxDeferralAvailable,
  runComplianceChecks,
  taxDeferralStatus,
  type ComplianceCheckArgs,
} from '../compliance';
import { openingGrantCohorts } from '../cohorts';
import { STATUTORY } from '../defaults';
import { isEsopEngineError } from '../errors';
import { authorisedCapitalHeadroom, runRollForward } from '../roll-forward';
import {
  COMPLIANCE_CHECK_IDS,
  COMPLIANCE_DISCLAIMER,
  INSTRUMENTS,
  type ComplianceCheck,
  type ComplianceCheckId,
  type ComplianceInputs,
  type Instrument,
} from '../types';
import { BASIS_B, COMPANY, VESTING, withArgs } from './fixtures';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return isEsopEngineError(error) ? error.code : 'not an EsopEngineError';
  }
  return 'nothing thrown';
}

const COMPLIANCE: ComplianceInputs = {
  dpiitRecognised: false,
  imbCertified80IAC: false,
  incorporationDate: '2024-03-01',
  grantsToGroupCompanyEmployees: false,
  anyIndividualGrantAtOrAbove1Pct: false,
  accountingBasis: 'indAS102',
  instrument: 'ESOP',
};

const SUFFICIENT = authorisedCapitalHeadroom({
  authorisedShares: 20_000_000,
  issuedShares: 9_400_000,
  grantedOutstanding: 0,
  availablePool: 600_000,
  faceValuePerShare: 10,
});

const SHORT = authorisedCapitalHeadroom({
  authorisedShares: 9_000_000,
  issuedShares: 9_400_000,
  grantedOutstanding: 0,
  availablePool: 600_000,
  faceValuePerShare: 10,
});

const BASE: ComplianceCheckArgs = {
  company: COMPANY,
  compliance: COMPLIANCE,
  vesting: VESTING,
  authorisedCapital: SUFFICIENT,
  asOfDate: '2026-08-15',
};

function withChecks(overrides: Partial<ComplianceCheckArgs>): readonly ComplianceCheck[] {
  return runComplianceChecks({ ...BASE, ...overrides });
}

function row(checks: readonly ComplianceCheck[], id: ComplianceCheckId): ComplianceCheck {
  const found = checks.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no ${id} row`);
  return found;
}

/* ------------------------------------------------------------------ *
 * Every rule produces a row, and every row is well formed
 * ------------------------------------------------------------------ */

describe('the shape of the list', () => {
  it('produces exactly one row per rule section 5 states', () => {
    const checks = withChecks({});

    expect(checks.map((entry) => entry.id)).toEqual([...COMPLIANCE_CHECK_IDS]);
    expect(new Set(checks.map((entry) => entry.id)).size).toBe(COMPLIANCE_CHECK_IDS.length);
  });

  it('gives every row a status, a one-line finding, a one-line action and a reference', () => {
    for (const entry of withChecks({})) {
      expect(['pass', 'warn', 'blocked'], entry.id).toContain(entry.status);
      expect(entry.title.length, entry.id).toBeGreaterThan(0);
      expect(entry.finding.length, entry.id).toBeGreaterThan(20);
      expect(entry.action.length, entry.id).toBeGreaterThan(0);
      expect(entry.finding, `${entry.id} finding is not one line`).not.toContain('\n');
      expect(entry.action, `${entry.id} action is not one line`).not.toContain('\n');
      expect(entry.statutoryReference.length, entry.id).toBeGreaterThan(10);
    }
  });
});

/* ------------------------------------------------------------------ *
 * PROHIBITION: every row carries the disclaimer
 * ------------------------------------------------------------------ */

describe('every returned row carries the not-legal-advice string', () => {
  it('carries it on every row, on every combination of inputs that changes a row', () => {
    const instruments: readonly Instrument[] = INSTRUMENTS;
    let rowsChecked = 0;

    for (const companyType of ['private', 'unlistedPublic'] as const) {
      for (const dpiitRecognised of [true, false]) {
        for (const imbCertified80IAC of [true, false]) {
          for (const grantsToGroupCompanyEmployees of [true, false]) {
            for (const anyIndividualGrantAtOrAbove1Pct of [true, false]) {
              for (const instrument of instruments) {
                for (const headroom of [SUFFICIENT, SHORT]) {
                  for (const incorporationDate of ['2024-03-01', '2005-01-01']) {
                    const checks = withChecks({
                      company: { ...COMPANY, companyType },
                      compliance: {
                        ...COMPLIANCE,
                        dpiitRecognised,
                        imbCertified80IAC,
                        grantsToGroupCompanyEmployees,
                        anyIndividualGrantAtOrAbove1Pct,
                        instrument,
                        incorporationDate,
                      },
                      authorisedCapital: headroom,
                    });

                    expect(checks).toHaveLength(COMPLIANCE_CHECK_IDS.length);
                    for (const entry of checks) {
                      expect(entry.disclaimer, entry.id).toBe('General information, not legal advice.');
                      rowsChecked += 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2 * 2 * 2 * 2 * 2 * 3 * 2 * 2 combinations, eight rows each.
    expect(rowsChecked).toBe(384 * COMPLIANCE_CHECK_IDS.length);
    expect(COMPLIANCE_DISCLAIMER).toBe('General information, not legal advice.');
  });
});

/* ------------------------------------------------------------------ *
 * Rule by rule
 * ------------------------------------------------------------------ */

describe('scheme approval route by company type', () => {
  it('is an ordinary resolution for a private company, which is the prohibition', () => {
    const entry = row(withChecks({ company: { ...COMPANY, companyType: 'private' } }), 'schemeApproval');

    expect(entry.status).toBe('pass');
    expect(entry.finding).toContain('ordinary resolution');
    expect(entry.finding).not.toContain('special resolution');
    expect(entry.action).toContain('ordinary resolution');
    expect(entry.action).toContain('MGT-14');
    expect(entry.statutoryReference).toContain('5 June 2015');
  });

  it('is a special resolution for an unlisted public company', () => {
    const entry = row(
      withChecks({ company: { ...COMPANY, companyType: 'unlistedPublic' } }),
      'schemeApproval',
    );

    expect(entry.finding).toContain('special resolution');
    expect(entry.action).toContain('MGT-14');
  });
});

describe('separate resolution triggers', () => {
  it('passes when neither trigger applies', () => {
    const entry = row(withChecks({}), 'separateResolution');

    expect(entry.status).toBe('pass');
  });

  it('warns on grants to group company employees', () => {
    const entry = row(
      withChecks({ compliance: { ...COMPLIANCE, grantsToGroupCompanyEmployees: true } }),
      'separateResolution',
    );

    expect(entry.status).toBe('warn');
    expect(entry.finding).toContain('holding, subsidiary or associate');
  });

  it('warns on an individual grant at or above one percent of issued capital', () => {
    const entry = row(
      withChecks({ compliance: { ...COMPLIANCE, anyIndividualGrantAtOrAbove1Pct: true } }),
      'separateResolution',
    );

    expect(entry.status).toBe('warn');
    expect(entry.finding).toContain(`${STATUTORY.individualGrantSeparateResolutionPct}%`);
  });

  it('names both when both apply', () => {
    const entry = row(
      withChecks({
        compliance: {
          ...COMPLIANCE,
          grantsToGroupCompanyEmployees: true,
          anyIndividualGrantAtOrAbove1Pct: true,
        },
      }),
      'separateResolution',
    );

    expect(entry.status).toBe('warn');
    expect(entry.finding).toContain('holding, subsidiary or associate');
    expect(entry.finding).toContain('identified employee');
  });
});

describe('the twelve month vesting floor', () => {
  it('reports a value the engine has already guaranteed is legal', () => {
    const entry = row(withChecks({}), 'vestingFloor');

    expect(entry.status).toBe('pass');
    expect(entry.finding).toContain(`${VESTING.cliffMonths} months`);
    expect(entry.statutoryReference).toContain('Rule 12(6)(a)');
  });

  it('refuses an unlawful schedule rather than reporting it as non-compliant', () => {
    // The point of AUDIT_P4 defect 4: this is a rule the engine enforces, not a
    // rule it describes. A six month cliff cannot reach a compliance row at all.
    expect(codeOf(() => withChecks({ vesting: { ...VESTING, cliffMonths: 6 } }))).toBe(
      'cliffBelowStatutoryMinimum',
    );
  });
});

describe('eligibility and the DPIIT ten year exemption', () => {
  it('warns without DPIIT recognition, because the exclusions apply', () => {
    const entry = row(withChecks({}), 'eligibility');

    expect(entry.status).toBe('warn');
    expect(entry.finding).toContain('Promoters');
    expect(entry.finding).toContain(`${STATUTORY.directorShareholdingExclusionPct}%`);
  });

  it('passes with DPIIT recognition inside the ten year window', () => {
    const entry = row(
      withChecks({ compliance: { ...COMPLIANCE, dpiitRecognised: true } }),
      'eligibility',
    );

    expect(entry.status).toBe('pass');
    expect(entry.finding).toContain('2034-03-01');
    expect(entry.statutoryReference).toContain('GSR 127(E)');
  });

  it('warns again once the ten years have run', () => {
    const entry = row(
      withChecks({
        compliance: { ...COMPLIANCE, dpiitRecognised: true, incorporationDate: '2010-01-01' },
      }),
      'eligibility',
    );

    expect(entry.status).toBe('warn');
    expect(entry.finding).toContain('lapsed on 2020-01-01');
  });

  it('measures the window in calendar years, to the day', () => {
    expect(dpiitExemptionExpiry('2016-08-15').toISOString().slice(0, 10)).toBe('2026-08-15');

    // The day the exemption expires, it has expired: the window is exclusive.
    const onExpiry = row(
      withChecks({
        compliance: { ...COMPLIANCE, dpiitRecognised: true, incorporationDate: '2016-08-15' },
        asOfDate: '2026-08-15',
      }),
      'eligibility',
    );
    const dayBefore = row(
      withChecks({
        compliance: { ...COMPLIANCE, dpiitRecognised: true, incorporationDate: '2016-08-16' },
        asOfDate: '2026-08-15',
      }),
      'eligibility',
    );

    expect(onExpiry.status).toBe('warn');
    expect(dayBefore.status).toBe('pass');
    expect(STATUTORY.dpiitExemptionYearsFromIncorporation).toBe(10);
  });

  it('refuses a date that does not parse rather than measuring from NaN', () => {
    expect(
      codeOf(() =>
        withChecks({ compliance: { ...COMPLIANCE, dpiitRecognised: true, incorporationDate: 'last spring' } }),
      ),
    ).toBe('invalidDate');
    expect(codeOf(() => withChecks({ asOfDate: 'today' }))).toBe('invalidDate');
  });
});

describe('authorised capital headroom', () => {
  it('passes when authorised capital covers issued capital plus the pool', () => {
    const entry = row(withChecks({}), 'authorisedCapital');

    expect(entry.status).toBe('pass');
  });

  it('blocks on a shortfall and quotes the shares and the rupee increase', () => {
    const entry = row(withChecks({ authorisedCapital: SHORT }), 'authorisedCapital');

    // 94,00,000 issued + 6,00,000 pool = 1,00,00,000 needed against 90,00,000.
    expect(entry.status).toBe('blocked');
    expect(SHORT.shortfallShares).toBe(1_000_000);
    expect(SHORT.increaseRequiredRupees).toBe(10_000_000);
    expect(entry.finding).toContain('10,00,000 shares');
    expect(entry.finding).toContain('₹1,00,00,000');
    expect(entry.action).toContain('SH-7');
  });

  it('quotes no fee estimate, because stamp duty varies by state', () => {
    const entry = row(withChecks({ authorisedCapital: SHORT }), 'authorisedCapital');

    expect(entry.action).toContain('vary by state');
    expect(entry.finding).not.toMatch(/stamp duty of|ROC fee of|fee of ₹/i);
  });
});

describe('allotment filings', () => {
  it('names PAS-3, the SH-6 register and the Rule 12(9) disclosures', () => {
    const entry = row(withChecks({}), 'allotmentFilings');

    expect(entry.status).toBe('pass');
    expect(entry.action).toContain('PAS-3');
    expect(entry.action).toContain(`${STATUTORY.filingWindowDays} days`);
    expect(entry.action).toContain('SH-6');
    expect(entry.action).toContain('Rule 12(9)');
  });
});

/* ------------------------------------------------------------------ *
 * PROHIBITION: the tax deferral has three states
 * ------------------------------------------------------------------ */

describe('the perquisite tax deferral, gated on DPIIT and IMB together', () => {
  const dpiitOnly = { ...COMPLIANCE, dpiitRecognised: true, imbCertified80IAC: false };
  const both = { ...COMPLIANCE, dpiitRecognised: true, imbCertified80IAC: true };

  it('has three states, not two', () => {
    expect(taxDeferralStatus(COMPLIANCE)).toBe('notEligible');
    expect(taxDeferralStatus(dpiitOnly)).toBe('dpiitOnly');
    expect(taxDeferralStatus(both)).toBe('dpiitAndImb');
  });

  it('NEVER gives a DPIIT-only company a deferral-available result', () => {
    // The PROJECT.md prohibition, asserted over every other input that could
    // conceivably reach the tax row, so it cannot pass by luck of the fixture.
    for (const companyType of ['private', 'unlistedPublic'] as const) {
      for (const incorporationDate of ['2024-03-01', '2005-01-01']) {
        for (const headroom of [SUFFICIENT, SHORT]) {
          const compliance = { ...dpiitOnly, incorporationDate };

          expect(isTaxDeferralAvailable(compliance)).toBe(false);
          expect(taxDeferralStatus(compliance)).not.toBe('dpiitAndImb');

          const entry = row(
            withChecks({
              company: { ...COMPANY, companyType },
              compliance,
              authorisedCapital: headroom,
            }),
            'taxDeferral',
          );

          expect(entry.status).toBe('warn');
          expect(entry.finding).toContain('alone does not give the deferral');
          expect(entry.finding).toContain('Inter-Ministerial Board');
          expect(entry.action).toContain('perquisite tax in cash at exercise');
        }
      }
    }
  });

  it('passes only when DPIIT and IMB are both held', () => {
    const entry = row(withChecks({ compliance: both }), 'taxDeferral');

    expect(isTaxDeferralAvailable(both)).toBe(true);
    expect(entry.status).toBe('pass');
    expect(entry.finding).toContain(`${STATUTORY.taxDeferralWindowMonths} months`);
  });

  it('warns when neither is held, and says both are needed', () => {
    const entry = row(withChecks({}), 'taxDeferral');

    expect(entry.status).toBe('warn');
    expect(entry.action).toContain('Both are needed');
  });

  it('cites the current section and window, never the superseded ones', () => {
    for (const compliance of [COMPLIANCE, dpiitOnly, both]) {
      const entry = row(withChecks({ compliance }), 'taxDeferral');

      expect(entry.statutoryReference).toContain('Section 392(3)');
      expect(entry.statutoryReference).toContain('Section 289(3)');
      expect(entry.statutoryReference).not.toContain('192(1C)');
      expect(entry.statutoryReference).not.toContain('80-IAC');
      expect(`${entry.finding} ${entry.action}`).not.toContain('48 months');
    }

    expect(STATUTORY.taxDeferralWindowMonths).toBe(60);
  });
});

describe('the instrument', () => {
  it('passes for options', () => {
    expect(row(withChecks({}), 'instrument').status).toBe('pass');
  });

  it('blocks RSUs and SARs, and does not present the Bill as law', () => {
    for (const instrument of ['RSU', 'SAR'] as const) {
      const entry = row(withChecks({ compliance: { ...COMPLIANCE, instrument } }), 'instrument');

      expect(entry.status).toBe('blocked');
      expect(entry.finding).toContain('not in force');
      expect(entry.finding).toContain('Joint Parliamentary Committee');
      expect(entry.finding).not.toMatch(/the Bill (is|has been) (now )?(law|enacted|in force)/i);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Ind AS 102
 * ------------------------------------------------------------------ */

describe('the Ind AS 102 expense estimate', () => {
  const args = withArgs({ grantPolicy: { grantBasis: BASIS_B } });
  const run = runRollForward(args);

  const schedule = esopExpenseSchedule({
    rollForward: run,
    vesting: args.vesting,
    fairValue: args.grantPolicy.fairValue,
    accountingBasis: 'indAS102',
    strikePolicy: args.grantPolicy.strikePolicy,
    faceValuePerShare: args.company.faceValuePerShare,
  });

  it('reports one row per plan year, on the stated basis', () => {
    expect(schedule.years).toHaveLength(args.hiring.horizonYears);
    expect(schedule.years.map((entry) => entry.year)).toEqual([0, 1, 2, 3]);
    expect(schedule.basis).toBe('indAS102');
    for (const entry of schedule.years) expect(entry.basis).toBe('indAS102');
  });

  it('splits every period exactly into an amortisation charge and a reversal', () => {
    for (const entry of schedule.years) {
      expect(
        entry.amortisationChargeRupees + entry.forfeitureReversalRupees,
        `year ${entry.year}`,
      ).toBeCloseTo(entry.expenseRupees, 6);
      expect(entry.amortisationChargeRupees, `year ${entry.year}`).toBeGreaterThanOrEqual(0);
      expect(entry.forfeitureReversalRupees, `year ${entry.year}`).toBeLessThanOrEqual(0);
    }
  });

  it('accumulates, and the running total is the sum of the periods', () => {
    let running = 0;
    for (const entry of schedule.years) {
      running += entry.expenseRupees;
      expect(entry.cumulativeExpenseRupees, `year ${entry.year}`).toBeCloseTo(running, 6);
    }
    expect(schedule.totalExpenseRupees).toBeCloseTo(running, 6);
  });

  it('amortises grant-date fair value straight line over the vesting period', () => {
    // One cohort, no attrition, so nothing reverses and the arithmetic is
    // visible: 10 mid hires at 1% of a 1,00,00,000 share company is 10,00,000
    // options, granted at PPS 100 against theta 0.5, so ₹5,00,00,000 of fair
    // value spread over four years is ₹1,25,00,000 a year.
    const clean = withArgs({
      company: {
        postMoneyValuation: 1_000_000_000,
        fullyDilutedShares: 10_000_000,
        existingUnallocatedOptions: 5_000_000,
        grantedOutstandingOptions: 0,
      },
      hiring: {
        horizonYears: 4,
        hiresPerYear: [10, 0, 0, 0],
        seniorityMix: { leadership: 0, senior: 0, mid: 100, junior: 0 },
      },
      growth: { valuationGrowthPctPerYear: 0 },
      grantPolicy: {
        grantBasis: {
          kind: 'percentOfEquity',
          grantPctByBand: { leadership: 0, senior: 0, mid: 1, junior: 0 },
        },
        refresh: { ratePct: 0, sizePct: 0, eligibilityMonths: 24 },
        fairValue: { theta: 0.5, expectedLifeYears: 4, volatilityPct: 60 },
      },
      attrition: { baseAnnualPct: 0, byBand: {} },
      vesting: { cliffMonths: 12, vestYears: 4, frequency: 'monthly' },
    });
    const cleanRun = runRollForward(clean);
    const cleanSchedule = esopExpenseSchedule({
      rollForward: cleanRun,
      vesting: clean.vesting,
      fairValue: clean.grantPolicy.fairValue,
      accountingBasis: 'indAS102',
      strikePolicy: clean.grantPolicy.strikePolicy,
      faceValuePerShare: clean.company.faceValuePerShare,
    });

    expect(cleanRun.years[0]?.pricePerShare).toBe(100);
    expect(cleanRun.years[0]?.newHireGrants).toBe(1_000_000);

    for (const entry of cleanSchedule.years) {
      expect(entry.expenseRupees, `year ${entry.year}`).toBeCloseTo(12_500_000, 6);
      expect(entry.forfeitureReversalRupees, `year ${entry.year}`).toBe(0);
    }
    expect(cleanSchedule.totalExpenseRupees).toBeCloseTo(50_000_000, 6);
  });

  it('reverses expense on options forfeited before they vest', () => {
    // Same plan with attrition switched on. Unvested forfeitures pull options
    // out of the base, so the reversal leg is non-zero and the total falls.
    const churning = withArgs({
      company: {
        postMoneyValuation: 1_000_000_000,
        fullyDilutedShares: 10_000_000,
        existingUnallocatedOptions: 5_000_000,
      },
      hiring: {
        horizonYears: 4,
        hiresPerYear: [10, 0, 0, 0],
        seniorityMix: { leadership: 0, senior: 0, mid: 100, junior: 0 },
      },
      growth: { valuationGrowthPctPerYear: 0 },
      grantPolicy: {
        grantBasis: {
          kind: 'percentOfEquity',
          grantPctByBand: { leadership: 0, senior: 0, mid: 1, junior: 0 },
        },
        refresh: { ratePct: 0, sizePct: 0, eligibilityMonths: 24 },
        fairValue: { theta: 0.5, expectedLifeYears: 4, volatilityPct: 60 },
      },
      attrition: { baseAnnualPct: 30, byBand: {} },
      vesting: { cliffMonths: 12, vestYears: 4, frequency: 'monthly' },
    });
    const churningSchedule = esopExpenseSchedule({
      rollForward: runRollForward(churning),
      vesting: churning.vesting,
      fairValue: churning.grantPolicy.fairValue,
      accountingBasis: 'indAS102',
      strikePolicy: churning.grantPolicy.strikePolicy,
      faceValuePerShare: churning.company.faceValuePerShare,
    });

    const reversed = churningSchedule.years.reduce(
      (sum, entry) => sum + entry.forfeitureReversalRupees,
      0,
    );

    expect(reversed).toBeLessThan(0);
    expect(churningSchedule.totalExpenseRupees).toBeLessThan(50_000_000);
  });

  it('does not reverse expense on options that lapsed after vesting', () => {
    // Lambda at 100% sends every leaver's *vested* options to lapse rather than
    // exercise. Those vested, so their expense stands: the reversal leg must
    // hold only the unvested forfeitures, never the vested lapses.
    const lapsing = withArgs({
      hiring: { horizonYears: 6, hiresPerYear: [20, 0, 0, 0, 0, 0] },
      exercise: { vestedNeverExercisedPct: 100 },
      company: { existingUnallocatedOptions: 5_000_000 },
    });
    const lapsingRun = runRollForward(lapsing);
    const lapsingSchedule = esopExpenseSchedule({
      rollForward: lapsingRun,
      vesting: lapsing.vesting,
      fairValue: lapsing.grantPolicy.fairValue,
      accountingBasis: 'indAS102',
      strikePolicy: lapsing.grantPolicy.strikePolicy,
      faceValuePerShare: lapsing.company.faceValuePerShare,
    });

    const totalVestedLapsed = lapsingRun.years.reduce((sum, year) => sum + year.vestedLapsed, 0);
    const totalUnvestedForfeited = lapsingRun.years.reduce(
      (sum, year) => sum + year.unvestedForfeited,
      0,
    );

    expect(totalVestedLapsed).toBeGreaterThan(0);

    // The reversal is bounded by the unvested leg alone. If vested lapses were
    // reversing too, the magnitude would exceed this bound.
    const reversed = Math.abs(
      lapsingSchedule.years.reduce((sum, entry) => sum + entry.forfeitureReversalRupees, 0),
    );
    const perOption = 0.55 * (lapsingRun.years[0]?.pricePerShare ?? 0);

    expect(reversed).toBeLessThanOrEqual(totalUnvestedForfeited * perOption + 1e-6);
    expect(totalUnvestedForfeited * perOption).toBeLessThan(
      (totalUnvestedForfeited + totalVestedLapsed) * perOption,
    );
  });

  it('values on the ICAI intrinsic basis when the company is not on Ind AS', () => {
    const intrinsic = esopExpenseSchedule({
      rollForward: run,
      vesting: args.vesting,
      fairValue: args.grantPolicy.fairValue,
      accountingBasis: 'icaiGuidanceNote',
      strikePolicy: { kind: 'faceValue' },
      faceValuePerShare: args.company.faceValuePerShare,
    });

    // Intrinsic at a ₹10 face value strike is PPS - 10, which is above
    // 0.55 * PPS at these prices, so the intrinsic basis expenses more.
    expect(intrinsic.basis).toBe('icaiGuidanceNote');
    expect(intrinsic.totalExpenseRupees).toBeGreaterThan(schedule.totalExpenseRupees);
  });

  it('excludes options granted before the plan started, and says how many', () => {
    expect(schedule.excludedOpeningOptions).toBe(0);

    const withOpening = runRollForward(
      withArgs({
        company: { grantedOutstandingOptions: 400_000 },
        openingCohorts: [
          {
            id: 'opening#0:mid',
            band: 'mid',
            grantYear: null,
            ageYearsAtEndOfYear0: 3,
            grantedOptions: 400_000,
            outstandingOptions: 400_000,
            fromNewHires: 400_000,
            fromRefresh: 0,
          },
        ],
      }),
    );
    const openingSchedule = esopExpenseSchedule({
      rollForward: withOpening,
      vesting: args.vesting,
      fairValue: args.grantPolicy.fairValue,
      accountingBasis: 'indAS102',
      strikePolicy: args.grantPolicy.strikePolicy,
      faceValuePerShare: args.company.faceValuePerShare,
    });

    expect(openingSchedule.excludedOpeningOptions).toBe(400_000);
  });

  /**
   * Three states, not two. AUDIT_P4 session P9, item 4(b).
   *
   * A cohort whose grant-date value was never supplied is excluded because the
   * engine holds no price to value it at. A cohort whose value was supplied
   * and happens to be zero is included and contributes nothing. Both produce
   * the same total expense today, and that equality is exactly the trap: the
   * two are not the same fact about the company, and the moment a real opening
   * cohort with a genuinely zero grant-date value (a scheme adopted at par,
   * struck at grant) arrives, collapsing the two would misreport it as
   * "unknown" when the founder told the tool it was known and zero.
   */
  describe('grant-date value on an opening cohort: unsupplied, zero and non-zero', () => {
    /**
     * Zero hires and zero attrition, so the opening cohort is the only source
     * of expense in the schedule and the "same total" trap is real rather than
     * coincidental — the standard fixture still grants new-hire options every
     * year, which would swamp the opening cohort's contribution and make a
     * `toBe(0)` assertion true for the wrong reason.
     */
    const isolated = {
      hiring: { hiresPerYear: [0, 0, 0, 0] },
      attrition: { baseAnnualPct: 0, byBand: {} },
    };

    it('is distinguishable in the schedule, not just in the total', () => {
      const unsupplied = runRollForward(
        withArgs({
          ...isolated,
          company: { grantedOutstandingOptions: 300_000 },
          openingCohorts: openingGrantCohorts([
            { band: 'mid', outstandingOptions: 300_000, ageYearsAtPlanStart: 2 },
          ]),
        }),
      );
      const suppliedZero = runRollForward(
        withArgs({
          ...isolated,
          company: { grantedOutstandingOptions: 300_000 },
          openingCohorts: openingGrantCohorts([
            {
              band: 'mid',
              outstandingOptions: 300_000,
              ageYearsAtPlanStart: 2,
              grantDateValuePerOption: 0,
            },
          ]),
        }),
      );

      const unsuppliedSchedule = esopExpenseSchedule({
        rollForward: unsupplied,
        vesting: args.vesting,
        fairValue: args.grantPolicy.fairValue,
        accountingBasis: 'indAS102',
        strikePolicy: args.grantPolicy.strikePolicy,
        faceValuePerShare: args.company.faceValuePerShare,
      });
      const suppliedZeroSchedule = esopExpenseSchedule({
        rollForward: suppliedZero,
        vesting: args.vesting,
        fairValue: args.grantPolicy.fairValue,
        accountingBasis: 'indAS102',
        strikePolicy: args.grantPolicy.strikePolicy,
        faceValuePerShare: args.company.faceValuePerShare,
      });

      // The trap: identical totals.
      expect(unsuppliedSchedule.totalExpenseRupees).toBe(0);
      expect(suppliedZeroSchedule.totalExpenseRupees).toBe(0);

      // Not the same fact, and the schedule says so outside the total.
      expect(unsuppliedSchedule.excludedOpeningOptions).toBe(300_000);
      expect(unsuppliedSchedule.includedOpeningOptions).toBe(0);

      expect(suppliedZeroSchedule.excludedOpeningOptions).toBe(0);
      expect(suppliedZeroSchedule.includedOpeningOptions).toBe(300_000);
    });

    it('amortises a supplied non-zero value straight line over the remaining vesting', () => {
      const withValue = runRollForward(
        withArgs({
          ...isolated,
          company: { grantedOutstandingOptions: 300_000 },
          openingCohorts: openingGrantCohorts([
            {
              band: 'mid',
              outstandingOptions: 300_000,
              ageYearsAtPlanStart: 0,
              grantDateValuePerOption: 40,
            },
          ]),
        }),
      );
      const withValueSchedule = esopExpenseSchedule({
        rollForward: withValue,
        vesting: args.vesting,
        fairValue: args.grantPolicy.fairValue,
        accountingBasis: 'indAS102',
        strikePolicy: args.grantPolicy.strikePolicy,
        faceValuePerShare: args.company.faceValuePerShare,
      });

      expect(withValueSchedule.includedOpeningOptions).toBe(300_000);
      expect(withValueSchedule.excludedOpeningOptions).toBe(0);
      expect(withValueSchedule.totalExpenseRupees).toBeGreaterThan(0);

      // ageYearsAtPlanStart 0, so ageYearsAtEndOfYear0 is 1: elapsed_t =
      // (t + 1)/4 against the fixture's 4 year vest. Quarter of the value each
      // year, reaching 1 only at year 3 — the last year of the default 4 year
      // horizon — and nowhere before it, with zero attrition so nothing else
      // moves the expected count.
      expect(withValueSchedule.years[0]?.cumulativeExpenseRupees).toBeCloseTo(
        300_000 * 40 * 0.25,
        0,
      );
      expect(withValueSchedule.years[2]?.cumulativeExpenseRupees).toBeCloseTo(
        300_000 * 40 * 0.75,
        0,
      );
      expect(withValueSchedule.years[3]?.cumulativeExpenseRupees).toBeCloseTo(
        300_000 * 40,
        0,
      );
      expect(withValueSchedule.years[3]?.expenseRupees).toBeGreaterThan(0);
    });

    it('reverses a supplied value the same way an in-plan cohort does, on unvested forfeiture', () => {
      const churning = runRollForward(
        withArgs({
          hiring: { hiresPerYear: [0, 0, 0, 0] },
          attrition: { baseAnnualPct: 30, byBand: {} },
          company: { grantedOutstandingOptions: 300_000 },
          openingCohorts: openingGrantCohorts([
            {
              band: 'mid',
              outstandingOptions: 300_000,
              ageYearsAtPlanStart: 0,
              grantDateValuePerOption: 40,
            },
          ]),
        }),
      );
      const churningSchedule = esopExpenseSchedule({
        rollForward: churning,
        vesting: args.vesting,
        fairValue: args.grantPolicy.fairValue,
        accountingBasis: 'indAS102',
        strikePolicy: args.grantPolicy.strikePolicy,
        faceValuePerShare: args.company.faceValuePerShare,
      });

      const reversed = churningSchedule.years.reduce(
        (sum, entry) => sum + entry.forfeitureReversalRupees,
        0,
      );

      expect(reversed).toBeLessThan(0);
      expect(churningSchedule.totalExpenseRupees).toBeLessThan(300_000 * 40);
    });
  });

  it('refuses an unlawful vesting schedule, same as every other entry point', () => {
    expect(
      codeOf(() =>
        esopExpenseSchedule({
          rollForward: run,
          vesting: { ...VESTING, cliffMonths: 3 },
          fairValue: args.grantPolicy.fairValue,
          accountingBasis: 'indAS102',
          strikePolicy: args.grantPolicy.strikePolicy,
          faceValuePerShare: args.company.faceValuePerShare,
        }),
      ),
    ).toBe('cliffBelowStatutoryMinimum');
  });
});
