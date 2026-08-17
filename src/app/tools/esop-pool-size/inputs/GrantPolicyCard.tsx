import {
  BANDS,
  DEFAULTS,
  VALUE_BASES,
  type StrikePolicy,
  type StrikePolicyKind,
  type ValueBasis,
} from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { RequiredMarker } from '../ui/RequiredMarker';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { lakhCrore } from '../lib/format';
import { BAND_LABEL } from '../lib/labels';
import { makeTouchHelpers } from '../lib/touched';
import { makeVisibilityHelpers } from '../lib/visibility';
import { InputCard, type CardProps } from './InputCard';

const VALUE_BASIS_LABEL: Record<ValueBasis, string> = {
  notional: 'Notional',
  realisable: 'Realisable',
  fairValue: 'Fair value',
};

export function GrantPolicyCard({ inputs, setGroup, touched, markTouched, requiredPaths }: CardProps) {
  const { grantPolicy } = inputs;
  const { grantBasis, strikePolicy, valueBasis, refresh, fairValue } = grantPolicy;
  const isPercentOfEquity = grantBasis.kind === 'percentOfEquity';
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths);
  const { isHidden, isReportOnly } = makeVisibilityHelpers(inputs);
  const refreshOn = refresh.ratePct > 0;

  function setStrikeKind(kind: StrikePolicyKind) {
    const next: StrikePolicy =
      kind === 'discountToFMV'
        ? { kind: 'discountToFMV', discountPct: strikePolicy.kind === 'discountToFMV' ? strikePolicy.discountPct : 20 }
        : { kind };
    setGroup('grantPolicy', { strikePolicy: next });
  }

  return (
    <InputCard index="04" title="Grant policy">
      {isPercentOfEquity ? (
        <Field label="Grant per hire" helper="Percent of fully diluted equity, per band.">
          <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
              <label key={band} className="space-y-1">
                <span className="text-2xs text-faint">
                  {BAND_LABEL[band]}
                  {isRequired(`grantPolicy.grantBasis.grantPctByBand.${band}`) ? <RequiredMarker /> : null}
                </span>
                <NumberField
                  id={`grant-pct-${band}`}
                  ariaLabel={`${BAND_LABEL[band]} grant, percent of fully diluted equity`}
                  value={grantBasis.grantPctByBand[band]}
                  blank={isBlank(`grantPolicy.grantBasis.grantPctByBand.${band}`)}
                  onChange={withTouch(`grantPolicy.grantBasis.grantPctByBand.${band}`, (value) =>
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'percentOfEquity', grantPctByBand: { ...grantBasis.grantPctByBand, [band]: value } },
                    }),
                  )}
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
                  {isRequired(`grantPolicy.grantBasis.grantValueByBand.${band}`) ? <RequiredMarker /> : null}
                </span>
                <NumberField
                  id={`grant-value-${band}`}
                  ariaLabel={`${BAND_LABEL[band]} grant, rupees at grant date`}
                  value={grantBasis.grantValueByBand[band]}
                  blank={isBlank(`grantPolicy.grantBasis.grantValueByBand.${band}`)}
                  onChange={withTouch(`grantPolicy.grantBasis.grantValueByBand.${band}`, (value) =>
                    setGroup('grantPolicy', {
                      grantBasis: { kind: 'rupeeValue', grantValueByBand: { ...grantBasis.grantValueByBand, [band]: value } },
                    }),
                  )}
                  prefix="₹"
                  grouped
                />
              </label>
            ))}
          </div>
        </Field>
      )}

      <Field
        label="Buffer for unplanned senior hires" htmlFor="buffer"
        required={isRequired('grantPolicy.bufferPct')}
        helper="Headroom added on top of total consumption."
      >
        <NumberField
          id="buffer"
          value={grantPolicy.bufferPct}
          blank={isBlank('grantPolicy.bufferPct')}
          onChange={withTouch('grantPolicy.bufferPct', (bufferPct) => setGroup('grantPolicy', { bufferPct }))}
          max={100}
          suffix="%"
        />
      </Field>

      {isHidden('grantPolicy.compInflationPctPerYear') ? null : (
        <Field
          label="Comp inflation" htmlFor="comp-inflation"
          required={isRequired('grantPolicy.compInflationPctPerYear')}
          helper="Applied to rupee grant values year on year."
        >
          <NumberField
            id="comp-inflation"
            value={grantPolicy.compInflationPctPerYear}
            blank={isBlank('grantPolicy.compInflationPctPerYear')}
            onChange={withTouch('grantPolicy.compInflationPctPerYear', (compInflationPctPerYear) => setGroup('grantPolicy', { compInflationPctPerYear }))}
            max={100}
            suffix="%"
          />
        </Field>
      )}

      {isHidden('grantPolicy.valueBasis') ? null : (
        <Field
          label="Value basis"
          required={isRequired('grantPolicy.valueBasis')}
          helper="Notional is the full share price. Realisable is the price less the strike. Fair value is in between."
        >
          <SegmentedControl<ValueBasis>
            value={isBlank('grantPolicy.valueBasis') ? null : valueBasis}
            onChange={withTouch('grantPolicy.valueBasis', (next) => setGroup('grantPolicy', { valueBasis: next }))}
            ariaLabel="Value basis"
            options={VALUE_BASES.map((basis) => ({ value: basis, label: VALUE_BASIS_LABEL[basis] }))}
          />
        </Field>
      )}

      <Field
        label="Strike price policy"
        required={isRequired('grantPolicy.strikePolicy.kind')}
        helper="The exercise price every employee pays."
        note={
          isReportOnly('grantPolicy.strikePolicy.kind')
            ? isPercentOfEquity
              ? "Doesn't change your pool under percent-of-equity grants — still sets what employees pay to exercise."
              : "Doesn't change your option count under this value basis — still sets what employees pay to exercise."
            : undefined
        }
      >
        <RadioGroup<StrikePolicyKind>
          name="strikePolicy"
          value={isBlank('grantPolicy.strikePolicy.kind') ? null : strikePolicy.kind}
          onChange={withTouch('grantPolicy.strikePolicy.kind', setStrikeKind)}
          ariaLabel="Strike price policy"
          options={[
            {
              value: 'faceValue',
              label: 'Face value',
              helper: 'Lowest exercise price, so the least tax at exercise. Common pre-Series A.',
            },
            {
              value: 'lastRoundPrice',
              label: 'Last round price',
              helper: 'The fair market value. Common from Series A onward.',
            },
            {
              value: 'discountToFMV',
              label: 'Discount to fair market value',
              helper: 'A stated discount off the last round price.',
            },
          ]}
        />
        {strikePolicy.kind === 'discountToFMV' ? (
          <div className="mt-2">
            <NumberField
              id="strike-discount"
              ariaLabel="Discount to fair market value, percent"
              value={strikePolicy.discountPct}
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

      {isHidden('grantPolicy.fairValue.theta') ? null : (
        <Field
          label="Theta" htmlFor="fair-value-theta"
          estimate
          required={isRequired('grantPolicy.fairValue.theta')}
          helper="Black-Scholes value ratio of an option to a share. Approaches 1 as the strike approaches zero."
        >
          <NumberField
            id="fair-value-theta"
            value={fairValue.theta}
            blank={isBlank('grantPolicy.fairValue.theta')}
            onChange={withTouch('grantPolicy.fairValue.theta', (theta) => setGroup('grantPolicy', { fairValue: { ...fairValue, theta } }))}
            min={0.01}
            max={1}
          />
        </Field>
      )}

      <Field label="Refresh grants" required={isRequired('grantPolicy.refresh.enabled')} helper="A second grant to employees already on the plan, some years in.">
        <ToggleSwitch
          id="refresh-enabled"
          checked={isBlank('grantPolicy.refresh.enabled') ? null : refreshOn}
          onChange={withTouch('grantPolicy.refresh.enabled', (checked) =>
            setGroup('grantPolicy', {
              refresh: checked
                ? { ...refresh, ratePct: DEFAULTS.refreshRatePct.value, sizePct: DEFAULTS.refreshSizePct.value }
                : { ...refresh, ratePct: 0 },
            }),
          )}
          label="Refresh employees already on the plan"
        />
      </Field>

      {refreshOn ? (
        <>
          <Field
            label="Refresh: employees refreshed" htmlFor="refresh-rate"
            required={isRequired('grantPolicy.refresh.ratePct')}
            helper="Share of eligible employees refreshed each year."
          >
            <NumberField
              id="refresh-rate"
              value={refresh.ratePct}
              blank={isBlank('grantPolicy.refresh.ratePct')}
              onChange={withTouch('grantPolicy.refresh.ratePct', (ratePct) => setGroup('grantPolicy', { refresh: { ...refresh, ratePct } }))}
              max={100}
              suffix="%"
            />
          </Field>

          <Field
            label="Refresh: size of original grant" htmlFor="refresh-size"
            required={isRequired('grantPolicy.refresh.sizePct')}
            helper="Refresh size as a percentage of an initial grant."
          >
            <NumberField
              id="refresh-size"
              value={refresh.sizePct}
              blank={isBlank('grantPolicy.refresh.sizePct')}
              onChange={withTouch('grantPolicy.refresh.sizePct', (sizePct) => setGroup('grantPolicy', { refresh: { ...refresh, sizePct } }))}
              max={200}
              suffix="%"
            />
          </Field>
        </>
      ) : null}
    </InputCard>
  );
}
