import type { ChangeEvent } from 'react';
import type { AccountingBasis, CompanyType } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { formatShares, lakhCrore } from '../lib/format';
import { makeTouchHelpers } from '../lib/touched';
import type { CardProps } from './InputCard';

/**
 * Brief §3, section 07: none of these ever change the recommended pool
 * (all `reportOnly` in lib/visibility.ts, per the field-by-field trace
 * there), so none of them is required (D7) and the section starts closed.
 * It still feeds the compliance checklist and the ESOP expense estimate in
 * the report, which is why it exists at all rather than being dropped.
 */
export function ReportOnlyCard({ inputs, setGroup, touched, markTouched, requiredPaths }: CardProps) {
  const { company, compliance, employeeValue, exercise } = inputs;
  const authorisedRupees = company.authorisedCapitalShares * company.faceValuePerShare;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths);

  return (
    <CollapsibleSection index="07" title="Doesn't change your pool, changes your report">
      <Field
        label="Founder ownership" htmlFor="company-founder-ownership"
        estimate
        required={isRequired('company.founderOwnershipPctOfFullyDiluted')}
        helper="Used only to show the cap table before and after."
      >
        <NumberField
          id="company-founder-ownership"
          value={company.founderOwnershipPctOfFullyDiluted}
          blank={isBlank('company.founderOwnershipPctOfFullyDiluted')}
          onChange={withTouch('company.founderOwnershipPctOfFullyDiluted', (founderOwnershipPctOfFullyDiluted) =>
            setGroup('company', { founderOwnershipPctOfFullyDiluted }),
          )}
          max={100}
          suffix="%"
        />
      </Field>

      <Field label="Face value per share" htmlFor="face-value" required={isRequired('company.faceValuePerShare')}>
        <NumberField
          id="face-value"
          value={company.faceValuePerShare}
          blank={isBlank('company.faceValuePerShare')}
          onChange={withTouch('company.faceValuePerShare', (faceValuePerShare) => setGroup('company', { faceValuePerShare: Math.max(0.01, faceValuePerShare) }))}
          min={0.01}
          prefix="₹"
        />
      </Field>

      <Field
        label="Authorised capital" htmlFor="authorised-capital-shares"
        required={isRequired('company.authorisedCapitalShares')}
        readout={isBlank('company.authorisedCapitalShares') ? undefined : `${formatShares(company.authorisedCapitalShares)} shares · ${lakhCrore(authorisedRupees)}`}
        helper="Must cover issued capital plus the pool at scheme adoption."
      >
        <NumberField
          id="authorised-capital-shares"
          value={company.authorisedCapitalShares}
          blank={isBlank('company.authorisedCapitalShares')}
          onChange={withTouch('company.authorisedCapitalShares', (authorisedCapitalShares) => setGroup('company', { authorisedCapitalShares }))}
          grouped
        />
      </Field>

      <Field
        label="DPIIT recognised"
        required={isRequired('compliance.dpiitRecognised')}
        helper="Drives the promoter and 10%-director eligibility exemption under Rule 12, for 10 years from incorporation."
      >
        <ToggleSwitch
          id="dpiit-recognised"
          checked={isBlank('compliance.dpiitRecognised') ? null : compliance.dpiitRecognised}
          onChange={withTouch('compliance.dpiitRecognised', (dpiitRecognised) => setGroup('compliance', { dpiitRecognised }))}
          label="DPIIT-recognised startup"
        />
      </Field>

      <Field
        label="Inter-Ministerial Board certified"
        required={isRequired('compliance.imbCertified80IAC')}
        helper="Drives the deferral of the tax an employee owes at exercise. DPIIT recognition alone does not qualify."
      >
        <ToggleSwitch
          id="imb-certified"
          checked={isBlank('compliance.imbCertified80IAC') ? null : compliance.imbCertified80IAC}
          onChange={withTouch('compliance.imbCertified80IAC', (imbCertified80IAC) => setGroup('compliance', { imbCertified80IAC }))}
          label="Inter-Ministerial Board certificate held"
        />
        <p className="text-2xs leading-4 text-faint">
          About 4,000 of roughly 1.97 lakh DPIIT-recognised startups hold one.
        </p>
      </Field>

      <Field
        label="Employee marginal tax rate" htmlFor="employee-tax-rate"
        estimate
        required={isRequired('employeeValue.marginalTaxRatePct')}
        helper="Slab rate used to value what a median employee holds at the end of the horizon."
      >
        <NumberField
          id="employee-tax-rate"
          value={employeeValue.marginalTaxRatePct}
          blank={isBlank('employeeValue.marginalTaxRatePct')}
          onChange={withTouch('employeeValue.marginalTaxRatePct', (marginalTaxRatePct) => setGroup('employeeValue', { marginalTaxRatePct }))}
          max={100}
          suffix="%"
        />
      </Field>

      <Field
        label="Continuing-employee exercises" htmlFor="continuing-exercise"
        estimate
        required={isRequired('exercise.continuingEmployeeExercisePctPerYear')}
        helper="Exercises by employees who have not left. Usually zero pre-liquidity in India."
      >
        <NumberField
          id="continuing-exercise"
          value={exercise.continuingEmployeeExercisePctPerYear}
          blank={isBlank('exercise.continuingEmployeeExercisePctPerYear')}
          onChange={withTouch('exercise.continuingEmployeeExercisePctPerYear', (continuingEmployeeExercisePctPerYear) =>
            setGroup('exercise', { continuingEmployeeExercisePctPerYear }),
          )}
          max={100}
          suffix="%"
        />
      </Field>

      <Field
        label="Incorporation date" htmlFor="incorporation-date"
        required={isRequired('compliance.incorporationDate')}
        helper="The DPIIT Rule 12 exemption runs 10 years from this date."
      >
        <input
          id="incorporation-date"
          type="date"
          value={isBlank('compliance.incorporationDate') ? '' : compliance.incorporationDate}
          onChange={withTouch('compliance.incorporationDate', (e: ChangeEvent<HTMLInputElement>) =>
            setGroup('compliance', { incorporationDate: e.target.value }),
          )}
          className="w-full rounded border border-strong bg-raised px-2.5 py-2 text-eyebrow text-ink"
        />
      </Field>

      <Field label="Company type" required={isRequired('company.companyType')} helper="Decides ordinary versus special resolution to adopt the scheme.">
        <RadioGroup<CompanyType>
          name="companyType"
          value={isBlank('company.companyType') ? null : company.companyType}
          onChange={withTouch('company.companyType', (companyType) => setGroup('company', { companyType }))}
          ariaLabel="Company type"
          options={[
            { value: 'private', label: 'Private company', helper: 'Ordinary resolution, per the 5 June 2015 MCA exemption.' },
            { value: 'unlistedPublic', label: 'Unlisted public company', helper: 'Special resolution required.' },
          ]}
        />
      </Field>

      <Field
        label="Grants to group company employees"
        required={isRequired('compliance.grantsToGroupCompanyEmployees')}
        helper="Employees of a holding, subsidiary or associate company."
      >
        <ToggleSwitch
          id="grants-to-group"
          checked={isBlank('compliance.grantsToGroupCompanyEmployees') ? null : compliance.grantsToGroupCompanyEmployees}
          onChange={withTouch('compliance.grantsToGroupCompanyEmployees', (grantsToGroupCompanyEmployees) =>
            setGroup('compliance', { grantsToGroupCompanyEmployees }),
          )}
          label="Any grants planned to group company employees"
        />
      </Field>

      <Field
        label="Large individual grants"
        required={isRequired('compliance.anyIndividualGrantAtOrAbove1Pct')}
        helper="Any one employee granted 1% or more of issued capital in a year."
      >
        <ToggleSwitch
          id="large-individual-grant"
          checked={isBlank('compliance.anyIndividualGrantAtOrAbove1Pct') ? null : compliance.anyIndividualGrantAtOrAbove1Pct}
          onChange={withTouch('compliance.anyIndividualGrantAtOrAbove1Pct', (anyIndividualGrantAtOrAbove1Pct) =>
            setGroup('compliance', { anyIndividualGrantAtOrAbove1Pct }),
          )}
          label="Plan includes a grant at or above 1% to one person"
        />
      </Field>

      <Field label="Accounting basis" required={isRequired('compliance.accountingBasis')} helper="Decides how the annual ESOP expense is valued.">
        <RadioGroup<AccountingBasis>
          name="accountingBasis"
          value={isBlank('compliance.accountingBasis') ? null : compliance.accountingBasis}
          onChange={withTouch('compliance.accountingBasis', (accountingBasis) => setGroup('compliance', { accountingBasis }))}
          ariaLabel="Accounting basis"
          options={[
            { value: 'indAS102', label: 'Ind AS 102', helper: 'Fair value, theta-scaled.' },
            { value: 'icaiGuidanceNote', label: 'ICAI Guidance Note', helper: 'Intrinsic value at grant.' },
          ]}
        />
      </Field>

      <p className="text-2xs leading-4 text-faint">
        General information, not legal advice. The instrument modelled is ESOP; RSUs and SARs are not
        recognised under Section 62(1)(b) today.
      </p>
    </CollapsibleSection>
  );
}
