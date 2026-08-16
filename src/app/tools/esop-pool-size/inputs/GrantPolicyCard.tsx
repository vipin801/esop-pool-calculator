import {
  BANDS,
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  VALUE_BASES,
  type GrantBasis,
  type StrikePolicy,
  type StrikePolicyKind,
  type ValueBasis,
} from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { SegmentedControl } from '../ui/SegmentedControl';
import { lakhCrore } from '../lib/format';
import { BAND_LABEL } from '../lib/labels';
import { InputCard, type CardProps } from './InputCard';

const VALUE_BASIS_LABEL: Record<ValueBasis, string> = {
  notional: 'Notional',
  realisable: 'Realisable',
  fairValue: 'Fair value',
};

function otherGrantBasis(kind: GrantBasis['kind']): GrantBasis {
  return kind === 'percentOfEquity'
    ? { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND }
    : { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND };
}

export function GrantPolicyCard({ inputs, setGroup, advanced }: CardProps) {
  const { grantPolicy } = inputs;
  const { grantBasis, comparisonGrantBasis, strikePolicy, valueBasis } = grantPolicy;
  const isPercentOfEquity = grantBasis.kind === 'percentOfEquity';

  function switchBasis(kind: GrantBasis['kind']) {
    if (kind === grantBasis.kind) return;
    if (comparisonGrantBasis.kind === kind) {
      setGroup('grantPolicy', { grantBasis: comparisonGrantBasis, comparisonGrantBasis: grantBasis });
      return;
    }
    setGroup('grantPolicy', { grantBasis: otherGrantBasis(grantBasis.kind), comparisonGrantBasis: grantBasis });
  }

  function setStrikeKind(kind: StrikePolicyKind) {
    const next: StrikePolicy =
      kind === 'discountToFMV'
        ? { kind: 'discountToFMV', discountPct: strikePolicy.kind === 'discountToFMV' ? strikePolicy.discountPct : 20 }
        : { kind };
    setGroup('grantPolicy', { strikePolicy: next });
  }

  return (
    <InputCard index="03" title="Grant policy">
      <Field label="Grant basis" helper="Decides whether valuation growth affects the pool at all.">
        <RadioGroup<GrantBasis['kind']>
          name="grantBasis"
          value={grantBasis.kind}
          onChange={switchBasis}
          ariaLabel="Grant basis"
          options={[
            {
              value: 'percentOfEquity',
              label: 'Percent of equity',
              helper: 'Each hire gets a fixed share of the company. Immune to valuation.',
            },
            {
              value: 'rupeeValue',
              label: 'Rupee value',
              helper: 'Each hire gets a fixed rupee promise, priced into options each year.',
            },
          ]}
        />
      </Field>

      <Field label="Strike price policy" helper="Decides the denominator that prices a rupee grant, and the exercise price every employee pays.">
        <RadioGroup<StrikePolicyKind>
          name="strikePolicy"
          value={strikePolicy.kind}
          onChange={setStrikeKind}
          ariaLabel="Strike price policy"
          options={[
            { value: 'faceValue', label: 'Face value', helper: 'Minimises perquisite tax exposure. Common pre-Series A.' },
            { value: 'lastRoundPrice', label: 'Last round price', helper: 'Fair market value. Common from Series A onward.' },
            { value: 'discountToFMV', label: 'Discount to FMV', helper: 'A stated discount off the last round price.' },
          ]}
        />
        {strikePolicy.kind === 'discountToFMV' ? (
          <div className="mt-2">
            <NumberField
              id="strike-discount"
              value={strikePolicy.discountPct}
              onChange={(discountPct) => setGroup('grantPolicy', { strikePolicy: { kind: 'discountToFMV', discountPct } })}
              max={100}
              suffix="%"
            />
          </div>
        ) : null}
      </Field>

      <Field
        label="Value basis"
        helper="Which of the three prices converts a rupee grant into options."
        note={isPercentOfEquity ? 'Inert under percent-of-equity grants: there is no rupee promise to convert.' : undefined}
      >
        <SegmentedControl<ValueBasis>
          value={valueBasis}
          onChange={(next) => setGroup('grantPolicy', { valueBasis: next })}
          ariaLabel="Value basis"
          disabled={isPercentOfEquity}
          options={VALUE_BASES.map((basis) => ({ value: basis, label: VALUE_BASIS_LABEL[basis] }))}
        />
      </Field>

      {isPercentOfEquity ? (
        <Field label="Grant per hire" helper="Percent of fully diluted equity, per band.">
          <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
              <label key={band} className="space-y-1">
                <span className="text-2xs text-faint">{BAND_LABEL[band]}</span>
                <NumberField
                  id={`grant-pct-${band}`}
                  value={grantBasis.grantPctByBand[band]}
                  onChange={(value) =>
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'percentOfEquity', grantPctByBand: { ...grantBasis.grantPctByBand, [band]: value } },
                    })
                  }
                  max={10}
                  suffix="%"
                />
              </label>
            ))}
          </div>
        </Field>
      ) : (
        <Field label="Grant per hire" helper="Rupee value at grant date, per band.">
          <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
              <label key={band} className="space-y-1">
                <span className="text-2xs text-faint">
                  {BAND_LABEL[band]} · {lakhCrore(grantBasis.grantValueByBand[band])}
                </span>
                <NumberField
                  id={`grant-value-${band}`}
                  value={grantBasis.grantValueByBand[band]}
                  onChange={(value) =>
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'rupeeValue', grantValueByBand: { ...grantBasis.grantValueByBand, [band]: value } },
                    })
                  }
                  prefix="₹"
                  grouped
                />
              </label>
            ))}
          </div>
        </Field>
      )}

      {advanced ? (
        <>
          <Field
            label="Comp inflation"
            helper="Applied to rupee grant values year on year."
            note={isPercentOfEquity ? 'Inert under percent-of-equity grants.' : undefined}
          >
            <NumberField
              id="comp-inflation"
              value={grantPolicy.compInflationPctPerYear}
              onChange={(compInflationPctPerYear) => setGroup('grantPolicy', { compInflationPctPerYear })}
              max={100}
              suffix="%"
              disabled={isPercentOfEquity}
            />
          </Field>

          <Field label="Refresh: employees refreshed" helper="Share of eligible employees refreshed each year.">
            <NumberField
              id="refresh-rate"
              value={grantPolicy.refresh.ratePct}
              onChange={(ratePct) => setGroup('grantPolicy', { refresh: { ...grantPolicy.refresh, ratePct } })}
              max={100}
              suffix="%"
            />
          </Field>

          <Field label="Refresh: size of original grant" helper="Refresh size as a percentage of an initial grant.">
            <NumberField
              id="refresh-size"
              value={grantPolicy.refresh.sizePct}
              onChange={(sizePct) => setGroup('grantPolicy', { refresh: { ...grantPolicy.refresh, sizePct } })}
              max={200}
              suffix="%"
            />
          </Field>

          <Field label="Buffer for unplanned senior hires" helper="Headroom added on top of total consumption.">
            <NumberField
              id="buffer"
              value={grantPolicy.bufferPct}
              onChange={(bufferPct) => setGroup('grantPolicy', { bufferPct })}
              max={100}
              suffix="%"
            />
          </Field>
        </>
      ) : null}
    </InputCard>
  );
}
