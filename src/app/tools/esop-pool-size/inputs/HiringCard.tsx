import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { InputCard, type CardProps } from './InputCard';
import { SeniorityMix } from './SeniorityMix';

const HORIZON_OPTIONS = ['3', '4', '5', '6'] as const;

export function HiringCard({ inputs, setGroup }: CardProps) {
  const { hiring } = inputs;
  const years = Array.from({ length: hiring.horizonYears }, (_, i) => i);
  const totalHires = years.reduce((sum, i) => sum + Math.max(0, hiring.hiresPerYear[i] ?? 0), 0);

  function setHorizon(horizonYears: number) {
    let hiresPerYear = hiring.hiresPerYear;
    if (hiresPerYear.length < horizonYears) {
      const last = hiresPerYear[hiresPerYear.length - 1] ?? 0;
      hiresPerYear = [...hiresPerYear, ...Array(horizonYears - hiresPerYear.length).fill(last)];
    }
    setGroup('hiring', { horizonYears, hiresPerYear });
  }

  function setHiresInYear(index: number, value: number) {
    const next = [...hiring.hiresPerYear];
    next[index] = Math.max(0, value);
    setGroup('hiring', { hiresPerYear: next });
  }

  return (
    <InputCard index="02" title="Your hiring plan">
      <Field label="Planning horizon" readout={`${totalHires} hires total`}>
        <SegmentedControl
          value={String(hiring.horizonYears)}
          onChange={(v) => setHorizon(Number(v))}
          ariaLabel="Planning horizon"
          options={HORIZON_OPTIONS.map((v) => ({ value: v, label: `${v} years` }))}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {years.map((i) => (
          <label key={i} className="space-y-1">
            <span className="text-2xs text-faint">{`Y${i + 1}`}</span>
            <NumberField
              id={`hires-y${i}`}
              value={hiring.hiresPerYear[i] ?? 0}
              onChange={(v) => setHiresInYear(i, v)}
            />
          </label>
        ))}
      </div>

      <SeniorityMix
        mix={hiring.seniorityMix}
        onChange={(seniorityMix) => setGroup('hiring', { seniorityMix })}
      />
    </InputCard>
  );
}
