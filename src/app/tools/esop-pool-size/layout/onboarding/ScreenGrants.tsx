'use client';

import { BANDS, type EsopInputs, type StrikePolicy, type StrikePolicyKind } from '@/lib/esop';
import { Button } from '../../ui/Button';
import { CroreField } from '../../ui/CroreField';
import { Field } from '../../ui/Field';
import { LakhField } from '../../ui/LakhField';
import { NumberField } from '../../ui/NumberField';
import { RadioGroup } from '../../ui/RadioGroup';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SliderField } from '../../ui/SliderField';
import { crores } from '../../lib/format';
import { BAND_LABEL } from '../../lib/labels';
import { makeTouchHelpers } from '../../lib/touched';
import { grantPctPresetFor, grantValuePresetFor, type GrantPhilosophy } from '../../lib/translateHiringPlan';
import type { EsopGroupKey } from '../../inputs/InputCard';

const GROWTH_PRESETS = [
  { value: 20, label: 'Conservative' },
  { value: 40, label: 'Base' },
  { value: 80, label: 'Aggressive' },
];

const PHILOSOPHY_OPTIONS: readonly { value: GrantPhilosophy; label: string }[] = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'market', label: 'Market' },
  { value: 'generous', label: 'Generous' },
];

export interface GrantMeta {
  readonly philosophy: GrantPhilosophy;
  readonly customGrants: boolean;
}

export const DEFAULT_GRANT_META: GrantMeta = { philosophy: 'market', customGrants: false };

interface ScreenGrantsProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly meta: GrantMeta;
  readonly setMeta: (meta: GrantMeta) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly requiredPaths: ReadonlySet<string>;
  /**
   * `Your model`'s "Grant economics" group (design.md §6.1) reuses this
   * screen but must keep strike policy and theta reachable even when
   * they've never been required or touched — D2: strike policy "must remain
   * visible and editable under model assumptions" for every founder, not
   * only the ones for whom it happened to gate the result. The onboarding
   * wizard keeps the original hide-until-relevant behaviour (design.md §4.4:
   * both stay off screens 03A/03B by default).
   */
  readonly alwaysShowStrikeAndTheta?: boolean;
}

/** design.md §4.4. Branches on grant basis; valuation and its growth live
 *  here, and only here, since they only ever matter under Basis B. */
export function ScreenGrants({ inputs, setGroup, meta, setMeta, touched, markTouched, requiredPaths, alwaysShowStrikeAndTheta }: ScreenGrantsProps) {
  const { grantPolicy, company, growth } = inputs;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);
  const isPercentOfEquity = grantPolicy.grantBasis.kind === 'percentOfEquity';

  function setPhilosophy(philosophy: GrantPhilosophy) {
    setMeta({ ...meta, philosophy });
    if (isPercentOfEquity) {
      setGroup('grantPolicy', {
        grantBasis: { kind: 'percentOfEquity', grantPctByBand: grantPctPresetFor(philosophy) },
      });
    } else {
      setGroup('grantPolicy', {
        grantBasis: { kind: 'rupeeValue', grantValueByBand: grantValuePresetFor(philosophy) },
      });
    }
  }

  function setStrikeKind(kind: StrikePolicyKind) {
    const next: StrikePolicy =
      kind === 'discountToFMV'
        ? { kind: 'discountToFMV', discountPct: grantPolicy.strikePolicy.kind === 'discountToFMV' ? grantPolicy.strikePolicy.discountPct : 20 }
        : { kind };
    setGroup('grantPolicy', { strikePolicy: next });
  }

  const trajectory = isPercentOfEquity
    ? null
    : Array.from({ length: inputs.hiring.horizonYears + 1 }, (_, year) => ({
        year,
        valuation: company.postMoneyValuation * Math.pow(1 + growth.valuationGrowthPctPerYear / 100, year),
      }));

  return (
    <div className="space-y-8">
      {!isPercentOfEquity ? (
        <>
          <Field
            label="Current post-money valuation"
            htmlFor="onb-valuation"
            required={isRequired('company.postMoneyValuation')}
            helper="Enter your current valuation to model ₹-value grants."
          >
            <CroreField
              id="onb-valuation"
              value={company.postMoneyValuation}
              blank={isBlank('company.postMoneyValuation')}
              onChange={withTouch('company.postMoneyValuation', (postMoneyValuation) => setGroup('company', { postMoneyValuation }))}
              align="right"
            />
          </Field>

          <Field
            label="Expected valuation growth"
            htmlFor="onb-growth"
            required={isRequired('growth.valuationGrowthPctPerYear')}
          >
            <SliderField
              id="onb-growth"
              value={growth.valuationGrowthPctPerYear}
              blank={isBlank('growth.valuationGrowthPctPerYear')}
              onChange={withTouch('growth.valuationGrowthPctPerYear', (valuationGrowthPctPerYear) =>
                setGroup('growth', { valuationGrowthPctPerYear }),
              )}
              min={0}
              max={150}
              presets={GROWTH_PRESETS}
              ariaLabel="Expected valuation growth per year"
            />
          </Field>

          {trajectory && !isBlank('company.postMoneyValuation') ? (
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="mb-1.5 text-2xs font-medium text-faint">What that means</p>
              <p className="figure text-2xs leading-5 text-sub">
                {trajectory.map((point, i) => (
                  <span key={point.year}>
                    {i > 0 ? ' → ' : ''}
                    {point.year === 0 ? 'Today' : `Year ${point.year}`} ₹{crores(point.valuation)} Cr
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <Field label="Grant philosophy" group helper="How generous your grants are relative to the advisory range for your stage.">
        <SegmentedControl<GrantPhilosophy> value={meta.philosophy} onChange={setPhilosophy} ariaLabel="Grant philosophy" size="md" options={PHILOSOPHY_OPTIONS} />
      </Field>

      {!meta.customGrants ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
          <p className="text-2xs font-medium text-faint">
            {isPercentOfEquity ? "We'll use approximately" : "Typical grants (estimated, not sourced)"}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {BANDS.map((band) => (
              <div key={band} className="flex items-baseline justify-between gap-2">
                <dt className="text-2xs text-faint">{BAND_LABEL[band]}</dt>
                <dd className="figure text-eyebrow text-ink">
                  {isPercentOfEquity
                    ? `${grantPctPresetFor(meta.philosophy)[band]}%`
                    : `₹${(grantValuePresetFor(meta.philosophy)[band] / 100000).toFixed(1)} L`}
                </dd>
              </div>
            ))}
          </dl>
          <Button variant="ghost" size="sm" onClick={() => setMeta({ ...meta, customGrants: true })}>
            Customize grants
          </Button>
        </div>
      ) : isPercentOfEquity ? (
        <Field label="Grant per hire" estimate helper="Percent of fully diluted equity, per band.">
          <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
              <label key={band} className="space-y-1">
                <span className="text-2xs text-faint">{BAND_LABEL[band]}</span>
                <NumberField
                  id={`onb-grant-pct-${band}`}
                  ariaLabel={`${BAND_LABEL[band]} grant, percent of fully diluted equity`}
                  value={grantPolicy.grantBasis.kind === 'percentOfEquity' ? grantPolicy.grantBasis.grantPctByBand[band] : 0}
                  onChange={(value) => {
                    if (grantPolicy.grantBasis.kind !== 'percentOfEquity') return;
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'percentOfEquity', grantPctByBand: { ...grantPolicy.grantBasis.grantPctByBand, [band]: value } },
                    });
                  }}
                  max={10}
                  suffix="%"
                />
              </label>
            ))}
          </div>
        </Field>
      ) : (
        <Field label="Grant per hire" estimate helper="Rupee value at grant date, per band.">
          <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
              <label key={band} className="space-y-1">
                <span className="text-2xs text-faint">{BAND_LABEL[band]}</span>
                <LakhField
                  id={`onb-grant-value-${band}`}
                  ariaLabel={`${BAND_LABEL[band]} grant, rupees at grant date`}
                  value={grantPolicy.grantBasis.kind === 'rupeeValue' ? grantPolicy.grantBasis.grantValueByBand[band] : 0}
                  onChange={(value) => {
                    if (grantPolicy.grantBasis.kind !== 'rupeeValue') return;
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'rupeeValue', grantValueByBand: { ...grantPolicy.grantBasis.grantValueByBand, [band]: value } },
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </Field>
      )}

      {alwaysShowStrikeAndTheta || !isBlank('grantPolicy.strikePolicy.kind') || isRequired('grantPolicy.strikePolicy.kind') ? (
        <Field
          label="Strike price policy"
          required={isRequired('grantPolicy.strikePolicy.kind')}
          helper="The exercise price every employee pays."
        >
          <RadioGroup<StrikePolicyKind>
            name="onb-strike-policy"
            value={isBlank('grantPolicy.strikePolicy.kind') ? null : grantPolicy.strikePolicy.kind}
            onChange={withTouch('grantPolicy.strikePolicy.kind', setStrikeKind)}
            ariaLabel="Strike price policy"
            options={[
              { value: 'faceValue', label: 'Face value', helper: 'Lowest exercise price. Common pre-Series A.' },
              { value: 'lastRoundPrice', label: 'Last round price', helper: 'Fair market value. Common from Series A onward.' },
              { value: 'discountToFMV', label: 'Discount to fair market value', helper: 'A stated discount off the last round price.' },
            ]}
          />
          {grantPolicy.strikePolicy.kind === 'discountToFMV' ? (
            <div className="mt-2">
              <NumberField
                id="onb-strike-discount"
                ariaLabel="Discount to fair market value, percent"
                value={grantPolicy.strikePolicy.discountPct}
                blank={isBlank('grantPolicy.strikePolicy.discountPct')}
                onChange={withTouch('grantPolicy.strikePolicy.discountPct', (discountPct) =>
                  setGroup('grantPolicy', { strikePolicy: { kind: 'discountToFMV', discountPct } }),
                )}
                max={100}
                suffix="%"
              />
            </div>
          ) : null}
        </Field>
      ) : null}

      {isRequired('grantPolicy.fairValue.theta') ? (
        <Field
          label="Theta"
          htmlFor="onb-theta"
          estimate
          required
          helper="Black-Scholes value ratio of an option to a share. Approaches 1 as the strike approaches zero."
        >
          <NumberField
            id="onb-theta"
            value={grantPolicy.fairValue.theta}
            blank={isBlank('grantPolicy.fairValue.theta')}
            onChange={withTouch('grantPolicy.fairValue.theta', (theta) => setGroup('grantPolicy', { fairValue: { ...grantPolicy.fairValue, theta } }))}
            min={0.01}
            max={1}
          />
        </Field>
      ) : null}
    </div>
  );
}
