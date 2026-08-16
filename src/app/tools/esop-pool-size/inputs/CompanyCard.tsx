'use client';

import { useState } from 'react';
import {
  BANDS,
  STAGES,
  type FundingRound,
  type OpeningGrantCohortInput,
  type PoolCreationTiming,
} from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectField } from '../ui/SelectField';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { lakhCrore, formatShares } from '../lib/format';
import { STAGE_LABEL } from '../lib/labels';
import { InputCard, type CardProps } from './InputCard';

type PoolUnit = 'percent' | 'shares';

interface CompanyCardProps extends CardProps {
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly rounds: readonly FundingRound[];
  readonly setRounds: (rounds: readonly FundingRound[]) => void;
}

const DEFAULT_ROUND: FundingRound = {
  id: 'next-round',
  label: 'Next round',
  year: 1,
  preMoneyValuation: 3_000_000_000,
  raiseAmount: 500_000_000,
  investorRequiredPostRoundPoolPct: 10,
  poolCreation: 'preMoney',
};

export function CompanyCard({
  inputs,
  setGroup,
  advanced,
  openingGrants,
  setOpeningGrants,
  rounds,
  setRounds,
}: CompanyCardProps) {
  const { company } = inputs;
  const [poolUnit, setPoolUnit] = useState<PoolUnit>('percent');
  const existingCohort = openingGrants[0];
  const round = rounds[0];

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
    <InputCard index="01" title="Your company">
      <Field label="Stage">
        <SelectField
          id="company-stage"
          value={company.stage}
          onChange={(stage) => setGroup('company', { stage })}
          options={STAGES.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))}
        />
        <p className="text-2xs leading-4 text-faint">Sets the benchmark band we compare you against.</p>
      </Field>

      <Field
        label="Post-money valuation"
        readout={lakhCrore(company.postMoneyValuation)}
        helper="Latest round price, or your best estimate."
      >
        <NumberField
          id="company-valuation"
          value={company.postMoneyValuation}
          onChange={(postMoneyValuation) => setGroup('company', { postMoneyValuation })}
          prefix="₹"
          grouped
          align="right"
        />
      </Field>

      <Field
        label="Fully diluted shares"
        helper="Founders + investors + options already granted, including the unallocated pool."
      >
        <NumberField
          id="company-fd-shares"
          value={company.fullyDilutedShares}
          onChange={(fullyDilutedShares) => setGroup('company', { fullyDilutedShares })}
          grouped
        />
      </Field>

      <Field
        label="Existing unallocated ESOP pool"
        helper="Reserved but not yet granted."
        readout={`${formatShares(company.existingUnallocatedOptions)} shares`}
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
            value={Math.round(existingPoolPct * 100) / 100}
            onChange={setExistingPoolFromPct}
            max={90}
            suffix="%"
          />
        ) : (
          <NumberField
            id="company-existing-pool-shares"
            value={company.existingUnallocatedOptions}
            onChange={setExistingPoolShares}
            grouped
          />
        )}
      </Field>

      {advanced ? (
        <>
          <Field
            label="Granted and outstanding"
            helper="Live grants, vested and unvested. Included in fully diluted."
          >
            <NumberField
              id="company-granted-outstanding"
              value={company.grantedOutstandingOptions}
              onChange={setGrantedOutstanding}
              grouped
            />
          </Field>

          {company.grantedOutstandingOptions > 0 ? (
            <Field
              label="Average age of those grants"
              helper="Years since grant. Needed to project how they vest and lapse from here."
            >
              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  id="company-granted-band"
                  value={existingCohort?.band ?? 'mid'}
                  onChange={(band) =>
                    setOpeningGrants([
                      {
                        band,
                        outstandingOptions: company.grantedOutstandingOptions,
                        ageYearsAtPlanStart: existingCohort?.ageYearsAtPlanStart ?? 2,
                      },
                    ])
                  }
                  options={BANDS.map((band) => ({ value: band, label: band }))}
                />
                <NumberField
                  id="company-granted-age"
                  value={existingCohort?.ageYearsAtPlanStart ?? 2}
                  onChange={(age) =>
                    setOpeningGrants([
                      {
                        band: existingCohort?.band ?? 'mid',
                        outstandingOptions: company.grantedOutstandingOptions,
                        ageYearsAtPlanStart: age,
                      },
                    ])
                  }
                  suffix="yrs"
                />
              </div>
            </Field>
          ) : null}

          <Field
            label="Founder ownership"
            estimate
            helper="Used only to show the cap table before and after."
          >
            <NumberField
              id="company-founder-ownership"
              value={company.founderOwnershipPctOfFullyDiluted}
              onChange={(founderOwnershipPctOfFullyDiluted) =>
                setGroup('company', { founderOwnershipPctOfFullyDiluted })
              }
              max={100}
              suffix="%"
            />
          </Field>

          <Field
            label="Model a funding round"
            helper="Unlocks the top-up needed and the cost to founders at the next round."
          >
            <ToggleSwitch
              id="model-round"
              checked={round !== undefined}
              onChange={(checked) => setRounds(checked ? [DEFAULT_ROUND] : [])}
              label="Model the next funding round"
            />
          </Field>

          {round ? (
            <>
              <Field label="Round year" helper="Plan year the round closes in, within your hiring horizon.">
                <NumberField
                  id="round-year"
                  value={round.year}
                  onChange={(year) => setRounds([{ ...round, year: Math.max(0, Math.round(year)) }])}
                  min={0}
                />
              </Field>

              <Field label="Pre-money valuation">
                <NumberField
                  id="round-pre-money"
                  value={round.preMoneyValuation}
                  onChange={(preMoneyValuation) => setRounds([{ ...round, preMoneyValuation }])}
                  prefix="₹"
                  grouped
                />
              </Field>

              <Field label="Raise amount">
                <NumberField
                  id="round-raise"
                  value={round.raiseAmount}
                  onChange={(raiseAmount) => setRounds([{ ...round, raiseAmount }])}
                  prefix="₹"
                  grouped
                />
              </Field>

              <Field label="Investor-required post-round pool" helper="As a percentage of the post-round fully diluted count.">
                <NumberField
                  id="round-investor-pool-pct"
                  value={round.investorRequiredPostRoundPoolPct}
                  onChange={(investorRequiredPostRoundPoolPct) =>
                    setRounds([{ ...round, investorRequiredPostRoundPoolPct }])
                  }
                  max={90}
                  suffix="%"
                />
              </Field>

              <Field label="Pool created">
                <RadioGroup<PoolCreationTiming>
                  name="pool-creation"
                  value={round.poolCreation}
                  onChange={(poolCreation) => setRounds([{ ...round, poolCreation }])}
                  ariaLabel="Pool created"
                  options={[
                    { value: 'preMoney', label: 'Pre-money', helper: 'Founders and existing holders absorb it.' },
                    { value: 'postMoney', label: 'Post-money', helper: 'New investors share the dilution.' },
                  ]}
                />
              </Field>
            </>
          ) : null}
        </>
      ) : null}
    </InputCard>
  );
}
