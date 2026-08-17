import {
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  STAGES,
  type GrantBasis,
} from '@/lib/esop';
import { Field } from '../ui/Field';
import { RadioGroup } from '../ui/RadioGroup';
import { SelectField } from '../ui/SelectField';
import { STAGE_LABEL } from '../lib/labels';
import { makeTouchHelpers } from '../lib/touched';
import { InputCard, type CardProps } from './InputCard';

function otherGrantBasis(kind: GrantBasis['kind']): GrantBasis {
  return kind === 'percentOfEquity'
    ? { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND }
    : { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND };
}

/**
 * Brief §3, section 01: the two controls a founder makes before anything else
 * — stage seeds every default below, grant basis decides whether valuation
 * growth affects the answer at all (D1). Neither is ever hidden.
 */
export function GrantBasisCard({ inputs, setGroup, touched, markTouched, requiredPaths }: CardProps) {
  const { company, grantPolicy } = inputs;
  const { grantBasis, comparisonGrantBasis } = grantPolicy;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

  function switchBasis(kind: GrantBasis['kind']) {
    if (kind === grantBasis.kind) return;
    if (comparisonGrantBasis.kind === kind) {
      setGroup('grantPolicy', { grantBasis: comparisonGrantBasis, comparisonGrantBasis: grantBasis });
      return;
    }
    setGroup('grantPolicy', { grantBasis: otherGrantBasis(grantBasis.kind), comparisonGrantBasis: grantBasis });
  }

  return (
    <InputCard index="01" title="How you grant">
      <Field label="Stage" htmlFor="company-stage" required={isRequired('company.stage')}>
        <SelectField
          id="company-stage"
          value={company.stage}
          blank={isBlank('company.stage')}
          onChange={withTouch('company.stage', (stage) => setGroup('company', { stage }))}
          options={STAGES.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))}
        />
        <p className="text-2xs leading-4 text-faint">Seeds every default below. Sets the benchmark band we compare you against.</p>
      </Field>

      <Field label="Grant basis" required={isRequired('grantPolicy.grantBasis.kind')} helper="Decides whether valuation growth affects the pool at all.">
        <RadioGroup<GrantBasis['kind']>
          name="grantBasis"
          value={isBlank('grantPolicy.grantBasis.kind') ? null : grantBasis.kind}
          onChange={withTouch('grantPolicy.grantBasis.kind', switchBasis)}
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
    </InputCard>
  );
}
