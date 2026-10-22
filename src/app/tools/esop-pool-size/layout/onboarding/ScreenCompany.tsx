'use client';

import { useState } from 'react';
import {
  DEFAULT_GRANT_BASIS_BY_STAGE,
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  STAGES,
  type GrantBasis,
  type Stage,
  type OpeningGrantCohortInput,
} from '@/lib/esop';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { NumberField } from '../../ui/NumberField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { formatShares } from '../../lib/format';
import { STAGE_LABEL } from '../../lib/labels';
import { fullyDilutedSharesPatch, shareBreakdownLine, shareCountError } from '../../lib/shareCount';
import { strikePolicyForStage } from '../../lib/seedInputs';
import { makeTouchHelpers } from '../../lib/touched';
import type { EsopGroupKey } from '../../inputs/InputCard';
import type { EsopInputs } from '@/lib/esop';

export type PoolUnit = 'percent' | 'shares';

function otherGrantBasis(kind: GrantBasis['kind']): GrantBasis {
  return kind === 'percentOfEquity'
    ? { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND }
    : { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND };
}

interface ScreenCompanyProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly requiredPaths: ReadonlySet<string>;
  /** Lifted to the wizard, which stays mounted across steps: held here it
   *  reset to percent on every Back, and a pool typed in shares would then be
   *  rescaled as if it were a percentage the next time the count changed. */
  readonly poolUnit: PoolUnit;
  readonly setPoolUnit: (unit: PoolUnit) => void;
}

/**
 * design.md §4.1. Stage, current pool and grant basis first — the three
 * things a founder decides before anything else — then a compact "about your
 * company" block once grant basis is chosen. Valuation stays off this screen
 * entirely: it only ever matters under Basis B, and lives on screen 03B.
 */
export function ScreenCompany({
  inputs,
  setGroup,
  openingGrants,
  setOpeningGrants,
  touched,
  markTouched,
  requiredPaths,
  poolUnit,
  setPoolUnit,
}: ScreenCompanyProps) {
  const { company, grantPolicy } = inputs;
  const { grantBasis, comparisonGrantBasis } = grantPolicy;
  const [lastPositiveFd, setLastPositiveFd] = useState(company.fullyDilutedShares);
  const existingCohort = openingGrants[0];
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

  /** What the pool's percentage is read and written against: the count, or
   *  the last count above zero while it reads zero. Without it a % typed while
   *  the count was 0 was stored as 0 shares and lost. */
  const pctBase = company.fullyDilutedShares > 0 ? company.fullyDilutedShares : lastPositiveFd;
  const existingPoolPct = pctBase > 0 ? (company.existingUnallocatedOptions / pctBase) * 100 : 0;

  function setExistingPoolShares(shares: number) {
    setGroup('company', { existingUnallocatedOptions: Math.max(0, shares) });
  }

  function setExistingPoolFromPct(pct: number) {
    setExistingPoolShares((pct / 100) * pctBase);
  }

  /** In percent mode the pool keeps its percentage when the count under it
   *  changes; in shares mode it stays the absolute number the founder typed. */
  function setFullyDilutedShares(next: number) {
    if (company.fullyDilutedShares > 0) setLastPositiveFd(company.fullyDilutedShares);
    setGroup(
      'company',
      fullyDilutedSharesPatch({ next, poolShares: company.existingUnallocatedOptions, lastPositiveFullyDiluted: pctBase, poolUnit }),
    );
  }

  /** D17: a stage change reseeds the strike policy to the stage's default,
   *  unless the founder has already chosen one. */
  function setStage(stage: Stage) {
    setGroup('company', { stage });
    if (!touched.has('grantPolicy.strikePolicy.kind')) {
      setGroup('grantPolicy', { strikePolicy: strikePolicyForStage(stage) });
    }
  }

  function switchBasis(kind: GrantBasis['kind']) {
    if (kind === grantBasis.kind) return;
    if (comparisonGrantBasis.kind === kind) {
      setGroup('grantPolicy', { grantBasis: comparisonGrantBasis, comparisonGrantBasis: grantBasis });
      return;
    }
    setGroup('grantPolicy', { grantBasis: otherGrantBasis(grantBasis.kind), comparisonGrantBasis: grantBasis });
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

  const stageChosen = !isBlank('company.stage');
  const recommendedBasis = stageChosen ? DEFAULT_GRANT_BASIS_BY_STAGE[company.stage] : null;
  const grantBasisChosen = !isBlank('grantPolicy.grantBasis.kind');

  return (
    <div className="space-y-8">
      <Field label="What stage are you at?" group required={isRequired('company.stage')}>
        <SegmentedControl
          value={isBlank('company.stage') ? null : company.stage}
          onChange={withTouch('company.stage', setStage)}
          ariaLabel="Company stage"
          size="lg"
          options={STAGES.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))}
        />
      </Field>

      {/* Asked before the pool, not after: a pool typed as a percentage is
          converted to shares against this number, so it has to exist first. */}
      <Field
        label="Fully diluted shares"
        htmlFor="onb-fd-shares"
        required={isRequired('company.fullyDilutedShares')}
        helper="Founders + investors + options already granted, including the unallocated pool."
        error={shareCountError(company) ?? undefined}
      >
        <NumberField
          id="onb-fd-shares"
          value={company.fullyDilutedShares}
          blank={isBlank('company.fullyDilutedShares')}
          onChange={withTouch('company.fullyDilutedShares', setFullyDilutedShares)}
          grouped
        />
      </Field>

      <Field
        label="How much unallocated ESOP pool do you have today?"
        required={isRequired('company.existingUnallocatedOptions')}
        readout={
          isBlank('company.existingUnallocatedOptions') || (poolUnit === 'percent' && isBlank('company.fullyDilutedShares'))
            ? undefined
            : `${formatShares(company.existingUnallocatedOptions)} shares`
        }
      >
        {/* 2026-08-18: the unit toggle moved out of the label row into this
            one row with the input and "No pool yet" — same baseline, 12px
            gaps, all 44px tall.

            2026-08-20: `flex-wrap` plus a floor on the input. §4's button
            padding is `14px 28px`, which makes "No pool yet" wide enough that
            all three controls no longer fit a 390px screen — the input was
            being squeezed to a few pixels. Wrapping the button onto its own
            line below is §8's own collapsing strategy for exactly this row,
            and the desktop layout is unchanged. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[9rem] flex-1">
            {poolUnit === 'percent' ? (
              <NumberField
                id="onb-pool-pct"
                ariaLabel="Existing unallocated pool, percent of fully diluted"
                value={Math.round(existingPoolPct * 100) / 100}
                blank={isBlank('company.existingUnallocatedOptions')}
                onChange={withTouch('company.existingUnallocatedOptions', setExistingPoolFromPct)}
                max={90}
                suffix="%"
              />
            ) : (
              <NumberField
                id="onb-pool-shares"
                ariaLabel="Existing unallocated pool, in shares"
                value={company.existingUnallocatedOptions}
                blank={isBlank('company.existingUnallocatedOptions')}
                onChange={withTouch('company.existingUnallocatedOptions', setExistingPoolShares)}
                grouped
              />
            )}
          </div>
          <SegmentedControl<PoolUnit>
            value={poolUnit}
            onChange={setPoolUnit}
            ariaLabel="Existing pool unit"
            size="lg"
            options={[
              { value: 'percent', label: '% of FD' },
              { value: 'shares', label: 'Shares' },
            ]}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="shrink-0"
            onClick={withTouch('company.existingUnallocatedOptions', () => setExistingPoolShares(0))}
          >
            No pool yet
          </Button>
        </div>
      </Field>

      {/* Only once the founder has entered the count: before that,
          `fullyDilutedShares` is the form's 10,000,000 seed, and printing a
          breakdown of it would present an invented number as their company. */}
      {!isBlank('company.fullyDilutedShares') && shareBreakdownLine(company) ? (
        <p className="figure -mt-4 text-eyebrow leading-5 text-sub">{shareBreakdownLine(company)}</p>
      ) : null}

      <Field label="How do you usually quote ESOP grants?" group required={isRequired('grantPolicy.grantBasis.kind')}>
        <div role="radiogroup" aria-label="Grant basis" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                kind: 'percentOfEquity' as const,
                title: 'Percent of company',
                example: '"0.20% equity"',
              },
              {
                kind: 'rupeeValue' as const,
                title: '₹ value',
                example: '"₹20 lakh worth of ESOPs"',
              },
            ] satisfies { kind: GrantBasis['kind']; title: string; example: string }[]
          ).map((option) => {
            const active = grantBasisChosen && grantBasis.kind === option.kind;
            const recommended = recommendedBasis === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  markTouched('grantPolicy.grantBasis.kind');
                  switchBasis(option.kind);
                }}
                className={`rounded-[12px] p-5 text-left transition-colors duration-150 ${
                  active ? 'border-2 border-ink bg-muted' : 'border border-strong bg-raised hover:border-ink'
                }`}
              >
                <p className="text-small font-medium text-ink">{option.title}</p>
                <p className="mt-1 truncate text-eyebrow leading-4 text-faint">{option.example}</p>
                {recommended ? <p className="mt-2 text-eyebrow font-medium text-ink">Recommended for your stage</p> : null}
              </button>
            );
          })}
        </div>
      </Field>

      {grantBasisChosen ? (
        <div className="space-y-4 rounded-lg border border-border bg-muted p-4">
          <p className="text-eyebrow font-medium text-ink">About your company</p>

          <Field
            label="Granted and outstanding"
            htmlFor="onb-granted-outstanding"
            required={isRequired('company.grantedOutstandingOptions')}
            helper="Live grants, vested and unvested. Leave at 0 if nothing's been granted yet."
          >
            <NumberField
              id="onb-granted-outstanding"
              value={company.grantedOutstandingOptions}
              blank={isBlank('company.grantedOutstandingOptions')}
              onChange={withTouch('company.grantedOutstandingOptions', setGrantedOutstanding)}
              grouped
            />
          </Field>

          {company.grantedOutstandingOptions > 0 ? (
            <Field
              label="Average age of those grants"
              htmlFor="onb-granted-age"
              required={isRequired('openingGrants.0.ageYearsAtPlanStart')}
              helper="Years since grant."
            >
              <NumberField
                id="onb-granted-age"
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
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
