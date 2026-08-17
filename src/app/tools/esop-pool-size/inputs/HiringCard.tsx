import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RequiredMarker } from '../ui/RequiredMarker';
import { SegmentedControl } from '../ui/SegmentedControl';
import { makeTouchHelpers } from '../lib/touched';
import { InputCard, type CardProps } from './InputCard';
import { SeniorityMix } from './SeniorityMix';

const HORIZON_OPTIONS = ['3', '4', '5', '6'] as const;

export function HiringCard({ inputs, setGroup, touched, markTouched, requiredPaths }: CardProps) {
  const { hiring } = inputs;
  const years = Array.from({ length: hiring.horizonYears }, (_, i) => i);
  const totalHires = years.reduce((sum, i) => sum + Math.max(0, hiring.hiresPerYear[i] ?? 0), 0);
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

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
    <InputCard index="03" title="Your hiring plan">
      <Field label="Planning horizon" required={isRequired('hiring.horizonYears')} readout={`${totalHires} hires total`}>
        <SegmentedControl
          value={isBlank('hiring.horizonYears') ? null : String(hiring.horizonYears)}
          onChange={withTouch('hiring.horizonYears', (v) => setHorizon(Number(v)))}
          ariaLabel="Planning horizon"
          options={HORIZON_OPTIONS.map((v) => ({ value: v, label: `${v} years` }))}
        />
      </Field>

      <div role="group" aria-label="Hires per year" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {years.map((i) => (
          <label key={i} className="space-y-1">
            <span className="text-2xs text-faint">
              {`Y${i + 1}`}
              {isRequired(`hiring.hiresPerYear.${i}`) ? <RequiredMarker /> : null}
            </span>
            <NumberField
              id={`hires-y${i}`}
              ariaLabel={`Hires in year ${i + 1}`}
              value={hiring.hiresPerYear[i] ?? 0}
              blank={isBlank(`hiring.hiresPerYear.${i}`)}
              onChange={withTouch(`hiring.hiresPerYear.${i}`, (v) => setHiresInYear(i, v))}
            />
          </label>
        ))}
      </div>

      <SeniorityMix
        mix={hiring.seniorityMix}
        onChange={(seniorityMix) => setGroup('hiring', { seniorityMix })}
        touched={touched}
        markTouched={markTouched}
        requiredPaths={requiredPaths}
        inputs={inputs}
      />
    </InputCard>
  );
}
