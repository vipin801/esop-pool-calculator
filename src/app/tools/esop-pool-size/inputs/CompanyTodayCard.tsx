'use client';

import { useState } from 'react';
import { BANDS, type OpeningGrantCohortInput } from '@/lib/esop';
import { CroreField } from '../ui/CroreField';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectField } from '../ui/SelectField';
import { SliderField } from '../ui/SliderField';
import { formatShares } from '../lib/format';
import { makeTouchHelpers } from '../lib/touched';
import { makeVisibilityHelpers } from '../lib/visibility';
import { InputCard, type CardProps } from './InputCard';

type PoolUnit = 'percent' | 'shares';

const GROWTH_PRESETS = [
  { value: 20, label: 'Conservative' },
  { value: 40, label: 'Base' },
  { value: 80, label: 'Aggressive' },
];

interface CompanyTodayCardProps extends CardProps {
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  /** `Your model`'s "Grant economics" group reuses ScreenGrants for valuation
   *  and its growth instead, so this card hides both there rather than
   *  showing the same two fields through two different controls. Defaults
   *  to false so every other caller is unaffected. */
  readonly hideValuationAndGrowth?: boolean;
}

/**
 * Brief §3, section 02. Fully diluted shares "sets your share numbers" —
 * it drives every share count and the authorised capital check, but the
 * pool *percentage* is scale-invariant in both bases (property test 2), so
 * it is never badged as moving the percentage.
 */
export function CompanyTodayCard({
  inputs,
  setGroup,
  openingGrants,
  setOpeningGrants,
  touched,
  markTouched,
  requiredPaths,
  hideValuationAndGrowth,
}: CompanyTodayCardProps) {
  const { company, growth } = inputs;
  const [poolUnit, setPoolUnit] = useState<PoolUnit>('percent');
  const existingCohort = openingGrants[0];
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);
  const { isHidden, isReportOnly } = makeVisibilityHelpers(inputs);

  const existingPoolPct =
    company.fullyDilutedShares > 0
      ? (company.existingUnallocatedOptions / company.fullyDilutedShares) * 100
      : 0;

  function setExistingPoolShares(shares: number) {
    setGroup('company', { existingUnallocatedOptions: Math.max(0, shares) });
  }

  function setExistingPoolFromPct(pct: number) {
    setExistingPoolShares((pct / 100) * company.fullyDilutedShares);
  }

  function setGrantedOutstanding(next: number) {
    setGroup('company', { grantedOutstandingOptions: Math.max(0, next) });
    if (next <= 0) {
      setOpeningGrants([]);
      return;
    }
    setOpeningGrants([
      {
        band: existingCohort?.band ?? 'mid',
        outstandingOptions: next,
        ageYearsAtPlanStart: existingCohort?.ageYearsAtPlanStart ?? 2,
      },
    ]);
  }

  return (
    <InputCard index="02" title="Your company today">
      <Field
        label="Fully diluted shares" htmlFor="company-fd-shares"
        required={isRequired('company.fullyDilutedShares')}
        helper="Sets your share numbers. Founders + investors + options already granted, including the unallocated pool."
      >
        <NumberField
          id="company-fd-shares"
          value={company.fullyDilutedShares}
          blank={isBlank('company.fullyDilutedShares')}
          onChange={withTouch('company.fullyDilutedShares', (fullyDilutedShares) => setGroup('company', { fullyDilutedShares }))}
          grouped
        />
      </Field>

      <Field
        label="Existing unallocated ESOP pool"
        required={isRequired('company.existingUnallocatedOptions')}
        helper="Reserved but not yet granted."
        readout={isBlank('company.existingUnallocatedOptions') ? undefined : `${formatShares(company.existingUnallocatedOptions)} shares`}
        action={
          <SegmentedControl<PoolUnit>
            value={poolUnit}
            onChange={setPoolUnit}
            ariaLabel="Existing pool unit"
            options={[
              { value: 'percent', label: '% of FD' },
              { value: 'shares', label: 'Shares' },
            ]}
          />
        }
      >
        {poolUnit === 'percent' ? (
          <NumberField
            id="company-existing-pool-pct"
            ariaLabel="Existing unallocated pool, percent of fully diluted"
            value={Math.round(existingPoolPct * 100) / 100}
            blank={isBlank('company.existingUnallocatedOptions')}
            onChange={withTouch('company.existingUnallocatedOptions', setExistingPoolFromPct)}
            max={90}
            suffix="%"
          />
        ) : (
          <NumberField
            id="company-existing-pool-shares"
            ariaLabel="Existing unallocated pool, in shares"
            value={company.existingUnallocatedOptions}
            blank={isBlank('company.existingUnallocatedOptions')}
            onChange={withTouch('company.existingUnallocatedOptions', setExistingPoolShares)}
            grouped
          />
        )}
      </Field>

      <Field
        label="Granted and outstanding" htmlFor="company-granted-outstanding"
        required={isRequired('company.grantedOutstandingOptions')}
        helper="Live grants, vested and unvested. Included in fully diluted."
        note={isReportOnly('company.grantedOutstandingOptions') ? "Doesn't change your pool unless you recycle forfeitures or refresh grants — still shapes how fast it drains." : undefined}
      >
        <NumberField
          id="company-granted-outstanding"
          value={company.grantedOutstandingOptions}
          blank={isBlank('company.grantedOutstandingOptions')}
          onChange={withTouch('company.grantedOutstandingOptions', setGrantedOutstanding)}
          grouped
        />
      </Field>

      {company.grantedOutstandingOptions > 0 ? (
        <Field
          label="Average age of those grants"
          required={isRequired('openingGrants.0.band')}
          helper="Years since grant. Needed to project how they vest and lapse from here."
        >
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              id="company-granted-band"
              ariaLabel="Band of the existing grants"
              value={existingCohort?.band ?? 'mid'}
              blank={isBlank('openingGrants.0.band')}
              onChange={withTouch('openingGrants.0.band', (band) =>
                setOpeningGrants([
                  {
                    band,
                    outstandingOptions: company.grantedOutstandingOptions,
                    ageYearsAtPlanStart: existingCohort?.ageYearsAtPlanStart ?? 2,
                  },
                ]),
              )}
              options={BANDS.map((band) => ({ value: band, label: band }))}
            />
            <NumberField
              id="company-granted-age"
              ariaLabel="Average age of the existing grants, in years"
              value={existingCohort?.ageYearsAtPlanStart ?? 2}
              blank={isBlank('openingGrants.0.ageYearsAtPlanStart')}
              onChange={withTouch('openingGrants.0.ageYearsAtPlanStart', (age) =>
                setOpeningGrants([
                  {
                    band: existingCohort?.band ?? 'mid',
                    outstandingOptions: company.grantedOutstandingOptions,
                    ageYearsAtPlanStart: age,
                  },
                ]),
              )}
              suffix="yrs"
            />
          </div>
        </Field>
      ) : null}

      {hideValuationAndGrowth ? null : (
        <Field
          label="Post-money valuation" htmlFor="company-valuation"
          required={isRequired('company.postMoneyValuation')}
          helper="Latest round price, or your best estimate."
          note={isReportOnly('company.postMoneyValuation') ? "Doesn't change your pool under percent-of-equity grants — there's no valuation term in the formula. Still used for your report." : undefined}
        >
          <CroreField
            id="company-valuation"
            value={company.postMoneyValuation}
            blank={isBlank('company.postMoneyValuation')}
            onChange={withTouch('company.postMoneyValuation', (postMoneyValuation) => setGroup('company', { postMoneyValuation }))}
            align="right"
          />
        </Field>
      )}

      {hideValuationAndGrowth || isHidden('growth.valuationGrowthPctPerYear') ? null : (
        <Field label="Valuation growth per year" htmlFor="growth-valuation" required={isRequired('growth.valuationGrowthPctPerYear')}>
          <SliderField
            id="growth-valuation"
            value={growth.valuationGrowthPctPerYear}
            blank={isBlank('growth.valuationGrowthPctPerYear')}
            onChange={withTouch('growth.valuationGrowthPctPerYear', (valuationGrowthPctPerYear) => setGroup('growth', { valuationGrowthPctPerYear }))}
            min={0}
            max={150}
            presets={GROWTH_PRESETS}
            ariaLabel="Valuation growth per year"
          />
        </Field>
      )}
    </InputCard>
  );
}
