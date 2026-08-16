import { STATUTORY } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { InputCard, type CardProps } from './InputCard';

export function VestingCard({ inputs, setGroup }: CardProps) {
  const { vesting } = inputs;
  const atFloor = vesting.cliffMonths <= STATUTORY.minVestingMonths;

  return (
    <InputCard index="06" title="Vesting">
      <Field
        label="Cliff"
        note={
          atFloor
            ? `Rule 12(6)(a) of the Companies (Share Capital and Debentures) Rules requires at least ${STATUTORY.minVestingMonths} months between grant and vesting. This is the statutory floor.`
            : undefined
        }
      >
        <NumberField
          id="vesting-cliff"
          value={vesting.cliffMonths}
          onChange={(cliffMonths) => setGroup('vesting', { cliffMonths: Math.max(STATUTORY.minVestingMonths, cliffMonths) })}
          min={STATUTORY.minVestingMonths}
          max={48}
          suffix="months"
        />
      </Field>

      <Field label="Total vesting period">
        <NumberField
          id="vesting-years"
          value={vesting.vestYears}
          onChange={(vestYears) => setGroup('vesting', { vestYears: Math.max(1, vestYears) })}
          min={1}
          max={10}
          suffix="years"
        />
      </Field>

      <Field label="Vesting frequency">
        <SegmentedControl
          value={vesting.frequency}
          onChange={(frequency) => setGroup('vesting', { frequency })}
          ariaLabel="Vesting frequency"
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
          ]}
        />
      </Field>
    </InputCard>
  );
}
