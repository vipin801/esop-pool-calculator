/**
 * Which field paths must be entered before a result may show, right now.
 *
 * "Right now" carries weight: a field nobody can currently see, or one that
 * would only fall back to its own seeded default (D6) if left alone, cannot
 * be a reason to withhold the answer. Required is exactly `tierFor(path,
 * inputs) === 'drivesPool'` from `lib/visibility.ts` — the one place that
 * table is written down. A `minor` or `reportOnly` field stays visible and
 * editable but is optional; a `hidden` one is not rendered at all. Both are
 * asserted against §4's worked example in `visibility.test.ts` and again here
 * against the structural existence rules below (a discount percentage that
 * doesn't exist because the strike isn't `discountToFMV`, an opening cohort
 * that doesn't exist because nothing has been granted yet).
 *
 * `inputs` itself is never blank (see touched.ts): it is read here only to
 * resolve which paths currently exist and at which tier.
 */
import { BANDS, type EsopInputs } from '@/lib/esop';
import { tierFor } from './visibility';

function allDeclaredFieldPaths(inputs: EsopInputs): readonly string[] {
  const paths: string[] = [];

  /* 01 How you grant */
  paths.push('company.stage', 'grantPolicy.grantBasis.kind');

  /* 02 Your company today */
  paths.push(
    'company.fullyDilutedShares',
    'company.existingUnallocatedOptions',
    'company.postMoneyValuation',
    'growth.valuationGrowthPctPerYear',
    'company.grantedOutstandingOptions',
  );
  if (inputs.company.grantedOutstandingOptions > 0) {
    paths.push('openingGrants.0.band', 'openingGrants.0.ageYearsAtPlanStart');
  }

  /* 03 Your hiring plan */
  paths.push('hiring.horizonYears');
  for (let i = 0; i < inputs.hiring.horizonYears; i++) {
    paths.push(`hiring.hiresPerYear.${i}`);
  }
  for (const band of BANDS) {
    paths.push(`hiring.seniorityMix.${band}`);
  }

  /* 04 Grant policy */
  const { grantBasis, strikePolicy } = inputs.grantPolicy;
  const isRupeeValue = grantBasis.kind === 'rupeeValue';
  for (const band of BANDS) {
    paths.push(isRupeeValue ? `grantPolicy.grantBasis.grantValueByBand.${band}` : `grantPolicy.grantBasis.grantPctByBand.${band}`);
  }
  paths.push('grantPolicy.bufferPct', 'grantPolicy.compInflationPctPerYear', 'grantPolicy.valueBasis', 'grantPolicy.strikePolicy.kind', 'grantPolicy.fairValue.theta');
  if (strikePolicy.kind === 'discountToFMV') {
    paths.push('grantPolicy.strikePolicy.discountPct');
  }
  paths.push('grantPolicy.refresh.enabled');
  if (inputs.grantPolicy.refresh.ratePct > 0) {
    paths.push('grantPolicy.refresh.ratePct', 'grantPolicy.refresh.sizePct');
  }

  /* 05 Leavers and recycling */
  paths.push(
    'exercise.recycleForfeited',
    'attrition.sector',
    'attrition.baseAnnualPct',
    'attrition.byBand.leadership',
    'vesting.cliffMonths',
    'vesting.vestYears',
    'vesting.frequency',
    'exercise.vestedNeverExercisedPct',
    'exercise.exerciseWindowDays',
  );

  /* 06 Next funding round */
  paths.push('rounds.enabled');
  if (inputs.rounds.length > 0) {
    paths.push('rounds.0.year', 'rounds.0.preMoneyValuation', 'rounds.0.raiseAmount', 'rounds.0.investorRequiredPostRoundPoolPct', 'rounds.0.poolCreation');
  }

  /* 07 Doesn't change your pool, changes your report */
  paths.push(
    'company.faceValuePerShare',
    'company.authorisedCapitalShares',
    'company.founderOwnershipPctOfFullyDiluted',
    'company.companyType',
    'compliance.dpiitRecognised',
    'compliance.imbCertified80IAC',
    'compliance.incorporationDate',
    'compliance.grantsToGroupCompanyEmployees',
    'compliance.anyIndividualGrantAtOrAbove1Pct',
    'compliance.accountingBasis',
    'employeeValue.marginalTaxRatePct',
    'exercise.continuingEmployeeExercisePctPerYear',
  );

  return paths;
}

export function requiredFieldPaths(inputs: EsopInputs): readonly string[] {
  const declared = allDeclaredFieldPaths(inputs);
  const required = declared.filter((path) => tierFor(path, inputs) === 'drivesPool');
  return [...new Set(required)];
}

export function isFormComplete(touched: ReadonlySet<string>, inputs: EsopInputs): boolean {
  return requiredFieldPaths(inputs).every((path) => touched.has(path));
}
