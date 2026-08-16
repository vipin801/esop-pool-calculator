import type { AccountingBasis, CompanyType } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { formatShares, lakhCrore } from '../lib/format';
import { InputCard, type CardProps } from './InputCard';

export function ComplianceCard({ inputs, setGroup, advanced }: CardProps) {
  const { company, compliance, employeeValue } = inputs;
  const authorisedRupees = company.authorisedCapitalShares * company.faceValuePerShare;

  return (
    <InputCard index="07" title="Legal and compliance (India)">
      <Field label="Face value per share">
        <NumberField
          id="face-value"
          value={company.faceValuePerShare}
          onChange={(faceValuePerShare) => setGroup('company', { faceValuePerShare: Math.max(0.01, faceValuePerShare) })}
          min={0.01}
          prefix="₹"
        />
      </Field>

      <Field
        label="Authorised capital"
        readout={`${formatShares(company.authorisedCapitalShares)} shares · ${lakhCrore(authorisedRupees)}`}
        helper="Must cover issued capital plus the pool at scheme adoption."
      >
        <NumberField
          id="authorised-capital-shares"
          value={company.authorisedCapitalShares}
          onChange={(authorisedCapitalShares) => setGroup('company', { authorisedCapitalShares })}
          grouped
        />
      </Field>

      <Field
        label="DPIIT recognised"
        helper="Drives the promoter and 10%-director eligibility exemption under Rule 12, for 10 years from incorporation."
      >
        <ToggleSwitch
          id="dpiit-recognised"
          checked={compliance.dpiitRecognised}
          onChange={(dpiitRecognised) => setGroup('compliance', { dpiitRecognised })}
          label="DPIIT-recognised startup"
        />
      </Field>

      <Field
        label="IMB certified under Section 80-IAC"
        helper="Drives the perquisite tax deferral. DPIIT recognition alone does not qualify — roughly 4,000 of about 1.97 lakh DPIIT-recognised startups hold this certificate."
      >
        <ToggleSwitch
          id="imb-certified"
          checked={compliance.imbCertified80IAC}
          onChange={(imbCertified80IAC) => setGroup('compliance', { imbCertified80IAC })}
          label="IMB-certified under Section 80-IAC"
        />
      </Field>

      {advanced ? (
        <>
          <Field
            label="Employee marginal tax rate"
            estimate
            helper="Slab rate used to value a median employee's grant at horizon (output item 11)."
          >
            <NumberField
              id="employee-tax-rate"
              value={employeeValue.marginalTaxRatePct}
              onChange={(marginalTaxRatePct) => setGroup('employeeValue', { marginalTaxRatePct })}
              max={100}
              suffix="%"
            />
          </Field>

          <Field label="Incorporation date" helper="The DPIIT Rule 12 exemption runs 10 years from this date.">
            <input
              id="incorporation-date"
              type="date"
              value={compliance.incorporationDate}
              onChange={(e) => setGroup('compliance', { incorporationDate: e.target.value })}
              className="w-full rounded border border-border bg-raised px-2.5 py-2 text-[13px] text-ink outline-none focus:border-strong"
            />
          </Field>

          <Field label="Company type" helper="Decides ordinary versus special resolution to adopt the scheme.">
            <RadioGroup<CompanyType>
              name="companyType"
              value={company.companyType}
              onChange={(companyType) => setGroup('company', { companyType })}
              ariaLabel="Company type"
              options={[
                { value: 'private', label: 'Private company', helper: 'Ordinary resolution, per the 5 June 2015 MCA exemption.' },
                { value: 'unlistedPublic', label: 'Unlisted public company', helper: 'Special resolution required.' },
              ]}
            />
          </Field>

          <Field label="Grants to group company employees" helper="Employees of a holding, subsidiary or associate company.">
            <ToggleSwitch
              id="grants-to-group"
              checked={compliance.grantsToGroupCompanyEmployees}
              onChange={(grantsToGroupCompanyEmployees) => setGroup('compliance', { grantsToGroupCompanyEmployees })}
              label="Any grants planned to group company employees"
            />
          </Field>

          <Field label="Large individual grants" helper="Any one employee granted 1% or more of issued capital in a year.">
            <ToggleSwitch
              id="large-individual-grant"
              checked={compliance.anyIndividualGrantAtOrAbove1Pct}
              onChange={(anyIndividualGrantAtOrAbove1Pct) => setGroup('compliance', { anyIndividualGrantAtOrAbove1Pct })}
              label="Plan includes a grant at or above 1% to one person"
            />
          </Field>

          <Field label="Accounting basis" helper="Decides how the annual ESOP expense is valued.">
            <RadioGroup<AccountingBasis>
              name="accountingBasis"
              value={compliance.accountingBasis}
              onChange={(accountingBasis) => setGroup('compliance', { accountingBasis })}
              ariaLabel="Accounting basis"
              options={[
                { value: 'indAS102', label: 'Ind AS 102', helper: 'Fair value, theta-scaled.' },
                { value: 'icaiGuidanceNote', label: 'ICAI Guidance Note', helper: 'Intrinsic value at grant.' },
              ]}
            />
          </Field>
        </>
      ) : null}

      <p className="text-2xs leading-4 text-faint">
        General information, not legal advice. The instrument modelled is ESOP; RSUs and SARs are not
        recognised under Section 62(1)(b) today.
      </p>
    </InputCard>
  );
}
