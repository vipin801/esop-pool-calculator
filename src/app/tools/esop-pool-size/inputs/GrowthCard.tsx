import { Field } from '../ui/Field';
import { SliderField } from '../ui/SliderField';
import { InputCard, type CardProps } from './InputCard';

const PRESETS = [
  { value: 20, label: 'Conservative' },
  { value: 40, label: 'Base' },
  { value: 80, label: 'Aggressive' },
];

export function GrowthCard({ inputs, setGroup }: CardProps) {
  const disabled = inputs.grantPolicy.grantBasis.kind === 'percentOfEquity';

  return (
    <InputCard index="04" title="Growth">
      <Field
        label="Valuation growth per year" htmlFor="growth-valuation"
        note={
          disabled
            ? 'Grants are a percentage of equity, so valuation growth cannot change the pool. Switch the grant basis above to rupee value to make this matter.'
            : undefined
        }
      >
        <SliderField
          id="growth-valuation"
          value={inputs.growth.valuationGrowthPctPerYear}
          onChange={(valuationGrowthPctPerYear) => setGroup('growth', { valuationGrowthPctPerYear })}
          min={0}
          max={150}
          presets={PRESETS}
          disabled={disabled}
          ariaLabel="Valuation growth per year"
        />
      </Field>
    </InputCard>
  );
}
