/**
 * ESOP pool engine — compliance checks and the Ind AS 102 expense estimate.
 *
 * ENGINE_SPEC.md section 5, rule by rule, plus the accounting paragraph at the
 * end of it. Every rule in that section produces exactly one row, the set of
 * rows is a closed union so none can be quietly dropped, and every row carries
 * the disclaimer as a literal type so a row without it does not compile.
 *
 * Three things about this file are load-bearing and easy to get wrong.
 *
 * 1. **The tax deferral has three states, not two.** DPIIT recognition carries
 *    the Rule 12 eligibility exemption. It does not carry the perquisite tax
 *    deferral, which additionally needs an Inter-Ministerial Board certificate
 *    under Section 140 of the Income Tax Act 2025. PROJECT.md prohibits
 *    implying otherwise, and `dpiitOnly` is the state that exists so the tool
 *    can say so out loud rather than by omission.
 *
 * 2. **No clock.** The DPIIT exemption runs ten years from incorporation, so
 *    the checks need a date — and take it as an input rather than reading one.
 *    An engine that reads the system clock cannot be tested at a boundary, and
 *    this one has a boundary that matters on a specific day.
 *
 * 3. **The vesting floor is not reported, it is guaranteed.** By the time a
 *    `VestingSchedule` reaches this file it has already been through
 *    `requireLawfulVestingSchedule`, which refuses anything under twelve
 *    months. The row therefore always passes, and the way to make it fail is to
 *    hand this function an unlawful schedule — which throws instead. That is
 *    the difference between a rule the engine enforces and a rule it describes.
 *
 * General information, not legal advice.
 */

import { cliffMeetsStatutoryMinimum, requireLawfulVestingSchedule } from './cohorts';
import { STATUTORY } from './defaults';
import { exercisePriceAtYear } from './denominator';
import { EsopEngineError, requireNonNegative } from './errors';
import type { RollForwardResult } from './roll-forward';
import {
  COMPLIANCE_CHECK_IDS,
  COMPLIANCE_DISCLAIMER,
  type AccountingBasis,
  type AuthorisedCapitalHeadroom,
  type CompanyInputs,
  type ComplianceCheck,
  type ComplianceCheckId,
  type ComplianceInputs,
  type ComplianceStatus,
  type EsopExpenseSchedule,
  type EsopExpenseYear,
  type FairValueAssumptions,
  type StrikePolicy,
  type TaxDeferralStatus,
  type VestingSchedule,
} from './types';

/* ------------------------------------------------------------------------- *
 * Dates, without a clock
 * ------------------------------------------------------------------------- */

/** An ISO date, parsed strictly. A silent NaN here would misdate a statutory window. */
function parseIsoDate(value: string, field: string): Date {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(parsed.getTime())) {
    throw new EsopEngineError(
      'invalidDate',
      `${field} must be an ISO date, YYYY-MM-DD. A statutory window cannot be measured from a date that does not parse.`,
      { field, value },
    );
  }

  return parsed;
}

/**
 * Whether the DPIIT Rule 12 exemption is still running.
 *
 * GSR 127(E) dated 19 February 2019 gives DPIIT-recognised startups ten years
 * from incorporation. Measured in calendar years rather than in milliseconds,
 * because the tenth anniversary is a date and not 3,652.5 days.
 */
export function dpiitExemptionExpiry(incorporationDate: string): Date {
  const incorporated = parseIsoDate(incorporationDate, 'incorporationDate');

  return new Date(
    Date.UTC(
      incorporated.getUTCFullYear() + STATUTORY.dpiitExemptionYearsFromIncorporation,
      incorporated.getUTCMonth(),
      incorporated.getUTCDate(),
    ),
  );
}

/* ------------------------------------------------------------------------- *
 * The tax deferral, in three states
 * ------------------------------------------------------------------------- */

/**
 * Spec section 5. Never a boolean.
 *
 * `dpiitOnly` is not a partial qualification for the deferral. It is a full
 * qualification for a different thing — the Rule 12 eligibility exemption — and
 * no qualification at all for this one.
 */
export function taxDeferralStatus(compliance: ComplianceInputs): TaxDeferralStatus {
  if (!compliance.dpiitRecognised) return 'notEligible';

  return compliance.imbCertified80IAC ? 'dpiitAndImb' : 'dpiitOnly';
}

/**
 * The one boolean the rest of the engine may read, derived in one place.
 *
 * Deliberately not `compliance.dpiitRecognised` and deliberately not
 * `compliance.imbCertified80IAC` on its own. An IMB certificate without DPIIT
 * recognition is not a state that exists, and reading either flag alone is the
 * error PROJECT.md prohibits.
 */
export function isTaxDeferralAvailable(compliance: ComplianceInputs): boolean {
  return taxDeferralStatus(compliance) === 'dpiitAndImb';
}

/* ------------------------------------------------------------------------- *
 * The checks
 * ------------------------------------------------------------------------- */

export interface ComplianceCheckArgs {
  readonly company: CompanyInputs;
  readonly compliance: ComplianceInputs;
  readonly vesting: VestingSchedule;
  /** From the roll forward. Spec output item 7 feeds spec section 5's check. */
  readonly authorisedCapital: AuthorisedCapitalHeadroom;
  /** ISO date the checks are made as at. Taken, never read from a clock. */
  readonly asOfDate: string;
}

function check(args: {
  readonly id: ComplianceCheckId;
  readonly title: string;
  readonly status: ComplianceStatus;
  readonly finding: string;
  readonly action: string;
  readonly statutoryReference: string;
}): ComplianceCheck {
  return { ...args, disclaimer: COMPLIANCE_DISCLAIMER };
}

/** Indian digit grouping, per the PROJECT.md copy conventions. */
function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function shares(count: number): string {
  return Math.round(count).toLocaleString('en-IN');
}

function schemeApproval(company: CompanyInputs): ComplianceCheck {
  const isPrivate = company.companyType === 'private';

  return check({
    id: 'schemeApproval',
    title: 'Scheme approval',
    status: 'pass',
    finding: isPrivate
      ? 'A private company approves an ESOP scheme by ordinary resolution.'
      : 'An unlisted public company approves an ESOP scheme by special resolution.',
    action: isPrivate
      ? 'Pass an ordinary resolution of the members, then file MGT-14 within 30 days.'
      : 'Pass a special resolution of the members, then file MGT-14 within 30 days.',
    statutoryReference: isPrivate
      ? 'Section 62(1)(b), Companies Act 2013, with Rule 12 of the Companies (Share Capital and Debentures) Rules 2014; MCA exemption notification of 5 June 2015'
      : 'Section 62(1)(b), Companies Act 2013, with Rule 12 of the Companies (Share Capital and Debentures) Rules 2014',
  });
}

function separateResolution(compliance: ComplianceInputs): ComplianceCheck {
  const triggers: string[] = [];
  if (compliance.grantsToGroupCompanyEmployees) {
    triggers.push('grants to employees of a holding, subsidiary or associate company');
  }
  if (compliance.anyIndividualGrantAtOrAbove1Pct) {
    triggers.push(
      `a grant to an identified employee of ${STATUTORY.individualGrantSeparateResolutionPct}% or more of issued capital in one year`,
    );
  }

  if (triggers.length === 0) {
    return check({
      id: 'separateResolution',
      title: 'Separate resolution triggers',
      status: 'pass',
      finding: 'Neither separate-resolution trigger applies to this plan.',
      action: 'Re-check before each grant round, because either trigger can arise later.',
      statutoryReference: 'Rule 12(1), Companies (Share Capital and Debentures) Rules 2014',
    });
  }

  return check({
    id: 'separateResolution',
    title: 'Separate resolution triggers',
    status: 'warn',
    finding: `This plan triggers a separate resolution: ${triggers.join(', and ')}.`,
    action: 'Pass a separate special resolution for each trigger, alongside the scheme resolution.',
    statutoryReference: 'Rule 12(1), Companies (Share Capital and Debentures) Rules 2014',
  });
}

function vestingFloor(vesting: VestingSchedule): ComplianceCheck {
  /** Guaranteed by the boundary guard. Asserted rather than assumed. */
  if (!cliffMeetsStatutoryMinimum(vesting, STATUTORY.minVestingMonths)) {
    throw new EsopEngineError(
      'cliffBelowStatutoryMinimum',
      'A vesting schedule below the statutory minimum reached the compliance checks. It should have been refused at the engine boundary.',
      { cliffMonths: vesting.cliffMonths, minimumMonths: STATUTORY.minVestingMonths },
    );
  }

  return check({
    id: 'vestingFloor',
    title: 'Minimum vesting period',
    status: 'pass',
    finding: `Vesting begins ${vesting.cliffMonths} months after grant, at or above the statutory minimum of ${STATUTORY.minVestingMonths}.`,
    action: 'Keep the cliff at twelve months or more in the scheme document and every grant letter.',
    statutoryReference: 'Rule 12(6)(a), Companies (Share Capital and Debentures) Rules 2014',
  });
}

function eligibility(compliance: ComplianceInputs, asOfDate: string): ComplianceCheck {
  const excluded =
    'Promoters, the promoter group, and directors holding more than ' +
    `${STATUTORY.directorShareholdingExclusionPct}% directly or indirectly, cannot hold options.`;
  const statutoryReference =
    'Rule 12(1), Companies (Share Capital and Debentures) Rules 2014; GSR 127(E) dated 19 February 2019';

  if (!compliance.dpiitRecognised) {
    return check({
      id: 'eligibility',
      title: 'Grantee eligibility',
      status: 'warn',
      finding: `Without DPIIT recognition the standard exclusions apply. ${excluded}`,
      action:
        'Check every intended grantee against the exclusions, and consider applying for DPIIT recognition.',
      statutoryReference,
    });
  }

  const expiry = dpiitExemptionExpiry(compliance.incorporationDate);
  const asOf = parseIsoDate(asOfDate, 'asOfDate');
  const expiryDate = expiry.toISOString().slice(0, 10);

  if (asOf.getTime() >= expiry.getTime()) {
    return check({
      id: 'eligibility',
      title: 'Grantee eligibility',
      status: 'warn',
      finding: `The DPIIT exemption ran ${STATUTORY.dpiitExemptionYearsFromIncorporation} years from incorporation and lapsed on ${expiryDate}, so the standard exclusions apply again. ${excluded}`,
      action: 'Check every intended grantee against the exclusions before the next grant round.',
      statutoryReference,
    });
  }

  return check({
    id: 'eligibility',
    title: 'Grantee eligibility',
    status: 'pass',
    finding: `DPIIT recognition exempts this company from the promoter and 10% director exclusions until ${expiryDate}.`,
    action: `Grant to promoters and to holders above ${STATUTORY.directorShareholdingExclusionPct}% before that date if you intend to, and diarise the expiry.`,
    statutoryReference,
  });
}

function authorisedCapital(
  headroom: AuthorisedCapitalHeadroom,
  company: CompanyInputs,
): ComplianceCheck {
  const statutoryReference =
    'Section 61(1)(a) and Section 14, Companies Act 2013; SH-7 within 30 days';

  if (headroom.sufficient) {
    return check({
      id: 'authorisedCapital',
      title: 'Authorised capital headroom',
      status: 'pass',
      finding: `Authorised capital of ${shares(headroom.authorisedShares)} shares covers the ${shares(headroom.requiredShares)} shares the scheme needs.`,
      action: 'Re-check before each top-up, because the pool consumes the headroom as it grows.',
      statutoryReference,
    });
  }

  return check({
    id: 'authorisedCapital',
    title: 'Authorised capital headroom',
    status: 'blocked',
    /**
     * Share shortfall and the rupee increase, and no fee estimate. Stamp duty
     * and ROC fees vary by state, so quoting one would be inventing a number.
     */
    finding: `Authorised capital is short by ${shares(headroom.shortfallShares)} shares, an increase of ${inr(headroom.increaseRequiredRupees)} at a face value of ${inr(company.faceValuePerShare)}.`,
    action:
      'Increase authorised capital by ordinary resolution, after checking the AoA has an enabling clause and amending it by special resolution if not, then file SH-7 within 30 days. Stamp duty and ROC fees vary by state.',
    statutoryReference,
  });
}

function allotmentFilings(): ComplianceCheck {
  return check({
    id: 'allotmentFilings',
    title: 'Allotment and register',
    status: 'pass',
    finding: 'Every exercise allots shares and carries filing and register obligations.',
    action: `File PAS-3 within ${STATUTORY.filingWindowDays} days of each allotment, maintain the option register in SH-6, and make the Rule 12(9) disclosures in the Directors' Report.`,
    statutoryReference:
      'Section 39(4) and Rule 12(9), Companies Act 2013 and the Companies (Share Capital and Debentures) Rules 2014; SH-6 register',
  });
}

function taxDeferral(compliance: ComplianceInputs): ComplianceCheck {
  const statutoryReference =
    'Section 392(3) read with Section 289(3), Income Tax Act 2025, for employers eligible under Section 140';
  const window = `${STATUTORY.taxDeferralWindowMonths} months from the end of the tax year of allotment`;

  switch (taxDeferralStatus(compliance)) {
    case 'dpiitAndImb':
      return check({
        id: 'taxDeferral',
        title: 'Perquisite tax deferral',
        status: 'pass',
        finding: `DPIIT recognition and an Inter-Ministerial Board certificate together make this an eligible startup, so employees may defer the perquisite tax for ${window}.`,
        action:
          'Tell employees the deferral ends at the earliest of window expiry, sale of the shares, or leaving. The rate is locked to the year of allotment.',
        statutoryReference,
      });

    case 'dpiitOnly':
      return check({
        id: 'taxDeferral',
        title: 'Perquisite tax deferral',
        status: 'warn',
        /** The prohibition lives here. DPIIT alone does not qualify, and the row says so. */
        finding:
          'DPIIT recognition alone does not give the deferral. It needs an Inter-Ministerial Board certificate as well, which about 4,000 of roughly 1.97 lakh recognised startups hold.',
        action:
          'Apply to the Inter-Ministerial Board. Until the certificate is granted, employees owe perquisite tax in cash at exercise.',
        statutoryReference,
      });

    case 'notEligible':
      return check({
        id: 'taxDeferral',
        title: 'Perquisite tax deferral',
        status: 'warn',
        finding:
          'Without DPIIT recognition and an Inter-Ministerial Board certificate the deferral is not available, so employees owe perquisite tax in cash at exercise.',
        action:
          'Apply for DPIIT recognition first, then to the Inter-Ministerial Board. Both are needed; neither is sufficient alone.',
        statutoryReference,
      });
  }
}

function instrument(compliance: ComplianceInputs): ComplianceCheck {
  const statutoryReference = 'Section 62(1)(b), Companies Act 2013';

  if (compliance.instrument === 'ESOP') {
    return check({
      id: 'instrument',
      title: 'Instrument',
      status: 'pass',
      finding: 'Options are the instrument Section 62(1)(b) recognises today.',
      action: 'No action.',
      statutoryReference,
    });
  }

  return check({
    id: 'instrument',
    title: 'Instrument',
    status: 'blocked',
    /** The Bill is not law and this row must not imply that it is. */
    finding: `${compliance.instrument}s are not recognised under Section 62(1)(b). The Corporate Laws (Amendment) Bill 2026 would recognise them and is not in force: it was referred to a Joint Parliamentary Committee, whose report was tabled in August 2026.`,
    action: 'Grant options until the Bill is enacted.',
    statutoryReference,
  });
}

/** Every rule in ENGINE_SPEC.md section 5, one row each. Spec output item 9. */
export function runComplianceChecks(args: ComplianceCheckArgs): readonly ComplianceCheck[] {
  const { company, compliance, vesting, authorisedCapital: headroom, asOfDate } = args;

  /**
   * The same boundary guard the roll forward uses. A caller who reaches the
   * compliance checks without going through the engine still cannot describe an
   * unlawful schedule as merely non-compliant.
   */
  requireLawfulVestingSchedule(vesting);
  parseIsoDate(asOfDate, 'asOfDate');

  /**
   * Keyed by id rather than pushed into an array, so that completeness is a
   * compile error rather than a runtime one. Dropping a rule from section 5
   * fails `tsc`; there is no need for a guard that throws about it, and a guard
   * no real call can reach would rot the way `ESOP_ERROR_CODES` exists to stop.
   */
  const byId: Readonly<Record<ComplianceCheckId, ComplianceCheck>> = {
    schemeApproval: schemeApproval(company),
    separateResolution: separateResolution(compliance),
    vestingFloor: vestingFloor(vesting),
    eligibility: eligibility(compliance, asOfDate),
    authorisedCapital: authorisedCapital(headroom, company),
    allotmentFilings: allotmentFilings(),
    taxDeferral: taxDeferral(compliance),
    instrument: instrument(compliance),
  };

  /** Declaration order is the reading order the report uses. */
  return COMPLIANCE_CHECK_IDS.map((id) => byId[id]);
}

/* ------------------------------------------------------------------------- *
 * Ind AS 102, spec output item 8
 * ------------------------------------------------------------------------- */

export interface EsopExpenseArgs {
  readonly rollForward: RollForwardResult;
  readonly vesting: VestingSchedule;
  readonly fairValue: FairValueAssumptions;
  readonly accountingBasis: AccountingBasis;
  readonly strikePolicy: StrikePolicy;
  readonly faceValuePerShare: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * What one option granted in year `s` is carried at.
 *
 * Ind AS 102 uses fair value, which here is `theta * PPS_s`, the same ratio
 * section 2 uses to convert a rupee grant into options. Companies not on Ind AS
 * use the ICAI Guidance Note intrinsic basis instead, which is the spread at
 * grant and is frequently zero at a face value strike — the reason the two
 * bases are a founder-facing choice rather than an internal detail.
 */
function perOptionValue(args: {
  readonly basis: AccountingBasis;
  readonly pricePerShare: number;
  readonly theta: number;
  readonly strikePolicy: StrikePolicy;
  readonly faceValuePerShare: number;
}): number {
  const { basis, pricePerShare, theta, strikePolicy, faceValuePerShare } = args;

  if (basis === 'indAS102') return theta * pricePerShare;

  const exercisePrice = exercisePriceAtYear({ strikePolicy, pricePerShare, faceValuePerShare });

  return Math.max(pricePerShare - exercisePrice, 0);
}

/**
 * Annual ESOP expense, spec section 5 and output item 8.
 *
 * Grant-date value, amortised straight line over the vesting period, on the
 * options still expected to vest. Written as a cumulative catch-up rather than
 * as a per-year charge, because that is what makes the two lapse rules fall out
 * rather than be special-cased:
 *
 *   expected_t   = granted - (unvested forfeitures to date)
 *   elapsed_t    = clamp((t - s + 1) / k, 0, 1)
 *   cumulative_t = value * expected_t * elapsed_t
 *
 * An option forfeited *before* vesting leaves `expected`, so the expense already
 * taken on it reverses. An option that lapses *after* vesting never touches
 * `expected` — it vested, it was earned, and its expense is not reversed through
 * P&L. Neither rule is coded as a branch; both are consequences of the base.
 *
 * The period charge splits exactly into the two terms, which the tests assert:
 *
 *   period_t = value * expected_t * (elapsed_t - elapsed_(t-1))       amortisation
 *            + value * elapsed_(t-1) * (expected_t - expected_(t-1))  reversal
 */
export function esopExpenseSchedule(args: EsopExpenseArgs): EsopExpenseSchedule {
  const { rollForward, vesting, fairValue, accountingBasis, strikePolicy, faceValuePerShare } = args;

  requireLawfulVestingSchedule(vesting);
  requireNonNegative(
    fairValue.theta,
    'thetaOutOfRange',
    'Theta cannot be negative when valuing a grant.',
  );

  const grantedById = new Map<string, number>();
  for (const cohort of rollForward.cohorts) grantedById.set(cohort.id, cohort.grantedOptions);

  /** Granted before year 0, at a price the engine does not hold. Reported, not guessed. */
  const excludedOpeningOptions = rollForward.cohorts
    .filter((cohort) => cohort.grantYear === null)
    .reduce((sum, cohort) => sum + cohort.grantedOptions, 0);

  /** Grant-date value per option, once per cohort, from the year it was granted in. */
  const valueById = new Map<string, number>();
  for (const cohort of rollForward.cohorts) {
    if (cohort.grantYear === null) continue;
    const grantYear = rollForward.years[cohort.grantYear];
    if (grantYear === undefined) continue;

    valueById.set(
      cohort.id,
      perOptionValue({
        basis: accountingBasis,
        pricePerShare: grantYear.pricePerShare,
        theta: fairValue.theta,
        strikePolicy,
        faceValuePerShare,
      }),
    );
  }

  const grantYearById = new Map<string, number>();
  for (const cohort of rollForward.cohorts) {
    if (cohort.grantYear !== null) grantYearById.set(cohort.id, cohort.grantYear);
  }

  /** Running per-cohort state: options still expected to vest, and elapsed vesting. */
  const expectedById = new Map<string, number>(
    [...valueById.keys()].map((id) => [id, grantedById.get(id) ?? 0]),
  );
  const elapsedById = new Map<string, number>([...valueById.keys()].map((id) => [id, 0]));

  const forfeitedByYearAndCohort = new Map<string, number>();
  for (const entry of rollForward.cohortYears) {
    if (entry.grantYear === null) continue;
    const key = `${entry.year}|${entry.cohortId}`;
    forfeitedByYearAndCohort.set(
      key,
      (forfeitedByYearAndCohort.get(key) ?? 0) + entry.unvestedForfeited,
    );
  }

  const years: EsopExpenseYear[] = [];
  let cumulative = 0;

  for (const year of rollForward.years) {
    let amortisation = 0;
    let reversal = 0;

    for (const [id, value] of valueById) {
      const cohortGrantYear = grantYearById.get(id);
      if (cohortGrantYear === undefined || year.year < cohortGrantYear) continue;

      const previousExpected = expectedById.get(id) ?? 0;
      const previousElapsed = elapsedById.get(id) ?? 0;

      const forfeited = forfeitedByYearAndCohort.get(`${year.year}|${id}`) ?? 0;
      const expected = Math.max(previousExpected - forfeited, 0);
      const elapsed = clamp((year.year - cohortGrantYear + 1) / vesting.vestYears, 0, 1);

      amortisation += value * expected * (elapsed - previousElapsed);
      reversal += value * previousElapsed * (expected - previousExpected);

      expectedById.set(id, expected);
      elapsedById.set(id, elapsed);
    }

    const expense = amortisation + reversal;
    cumulative += expense;

    years.push({
      year: year.year,
      expenseRupees: expense,
      amortisationChargeRupees: amortisation,
      forfeitureReversalRupees: reversal,
      cumulativeExpenseRupees: cumulative,
      basis: accountingBasis,
    });
  }

  return {
    basis: accountingBasis,
    years,
    totalExpenseRupees: cumulative,
    excludedOpeningOptions,
  };
}
