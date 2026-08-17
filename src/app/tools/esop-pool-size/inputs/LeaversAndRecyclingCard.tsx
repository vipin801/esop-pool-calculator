import { EXERCISE_WINDOW_DAYS_OPTIONS, STATUTORY, baseAttritionPctForSector, type Sector } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectField } from '../ui/SelectField';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { makeTouchHelpers } from '../lib/touched';
import type { CardProps } from './InputCard';

const SECTOR_LABEL: Record<Sector, string> = {
  general: 'General',
  itServices: 'IT services',
  ecommerce: 'E-commerce',
};

/**
 * Brief §3, section 05, merging the old AttritionCard and VestingCard.
 * Nothing here is ever hidden — see lib/visibility.ts's Correction 1 for why
 * lambda and the exercise window stay visible even with recycling off — and
 * since D9 nothing here is required either: every field is `minor`, so it
 * shows the spec default it would otherwise have applied silently, marked as
 * an estimate, and the founder reaches a pool without opening this section at
 * all. Collapsed by default state mirrors the current value of
 * `recycleForfeited` rather than forcing a mismatched "closed" on a plan that
 * already recycles.
 */
export function LeaversAndRecyclingCard({ inputs, setGroup, touched, markTouched, requiredPaths }: CardProps) {
  const { attrition, exercise, vesting } = inputs;
  const atFloor = vesting.cliffMonths <= STATUTORY.minVestingMonths;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

  return (
    <CollapsibleSection
      index="05"
      title="Leavers and recycling"
      defaultOpen={exercise.recycleForfeited}
      hint="Attrition and vesting don't change your pool when options aren't recycled. They still affect your ESOP expense."
    >
      <Field
        label="Forfeited and lapsed options"
        estimate
        required={isRequired('exercise.recycleForfeited')}
        helper={exercise.recycleForfeited ? 'They return to the pool.' : 'They are extinguished, not recycled.'}
      >
        <ToggleSwitch
          id="recycle-forfeited"
          checked={isBlank('exercise.recycleForfeited') ? null : exercise.recycleForfeited}
          onChange={withTouch('exercise.recycleForfeited', (recycleForfeited) => setGroup('exercise', { recycleForfeited }))}
          label="Recycle forfeited and lapsed options"
        />
      </Field>

      <Field
        label="Sector" htmlFor="attrition-sector"
        estimate
        required={isRequired('attrition.sector')}
        helper="Prefills the base attrition rate. It does not scale a rate you type yourself."
      >
        <SelectField
          id="attrition-sector"
          value={attrition.sector}
          blank={isBlank('attrition.sector')}
          onChange={withTouch('attrition.sector', (sector) =>
            setGroup('attrition', { sector, baseAnnualPct: baseAttritionPctForSector(sector) }),
          )}
          options={(Object.keys(SECTOR_LABEL) as Sector[]).map((sector) => ({
            value: sector,
            label: SECTOR_LABEL[sector],
          }))}
        />
      </Field>

      <Field label="Base annual attrition" htmlFor="attrition-base" estimate required={isRequired('attrition.baseAnnualPct')}>
        <NumberField
          id="attrition-base"
          value={attrition.baseAnnualPct}
          blank={isBlank('attrition.baseAnnualPct')}
          onChange={withTouch('attrition.baseAnnualPct', (baseAnnualPct) => setGroup('attrition', { baseAnnualPct }))}
          max={100}
          suffix="%"
        />
      </Field>

      <Field
        label="Leadership override" htmlFor="attrition-leadership"
        estimate
        required={isRequired('attrition.byBand.leadership')}
        helper="Leadership usually churns slower than the base rate."
      >
        <NumberField
          id="attrition-leadership"
          value={attrition.byBand.leadership ?? attrition.baseAnnualPct}
          blank={isBlank('attrition.byBand.leadership')}
          onChange={withTouch('attrition.byBand.leadership', (value) => setGroup('attrition', { byBand: { ...attrition.byBand, leadership: value } }))}
          max={100}
          suffix="%"
        />
      </Field>

      <Field
        label="Vested options never exercised" htmlFor="lapse-rate"
        estimate
        required={isRequired('exercise.vestedNeverExercisedPct')}
        helper="Share of vested options a leaver never exercises before their window closes."
      >
        <NumberField
          id="lapse-rate"
          value={exercise.vestedNeverExercisedPct}
          blank={isBlank('exercise.vestedNeverExercisedPct')}
          onChange={withTouch('exercise.vestedNeverExercisedPct', (vestedNeverExercisedPct) => setGroup('exercise', { vestedNeverExercisedPct }))}
          max={100}
          suffix="%"
        />
      </Field>

      <Field label="Post-termination exercise window" estimate required={isRequired('exercise.exerciseWindowDays')}>
        <SegmentedControl
          value={isBlank('exercise.exerciseWindowDays') ? null : String(exercise.exerciseWindowDays)}
          onChange={withTouch('exercise.exerciseWindowDays', (v) =>
            setGroup('exercise', {
              exerciseWindowDays: Number(v) as (typeof EXERCISE_WINDOW_DAYS_OPTIONS)[number],
            }),
          )}
          ariaLabel="Post-termination exercise window"
          options={EXERCISE_WINDOW_DAYS_OPTIONS.map((days) => ({
            value: String(days),
            label: days >= 365 ? `${Math.round(days / 365)}y` : `${days}d`,
          }))}
        />
      </Field>

      <Field
        label="Cliff" htmlFor="vesting-cliff"
        estimate
        required={isRequired('vesting.cliffMonths')}
        note={
          atFloor
            ? `Rule 12(6)(a) of the Companies (Share Capital and Debentures) Rules requires at least ${STATUTORY.minVestingMonths} months between grant and vesting. This is the statutory floor.`
            : undefined
        }
      >
        <NumberField
          id="vesting-cliff"
          value={vesting.cliffMonths}
          blank={isBlank('vesting.cliffMonths')}
          onChange={withTouch('vesting.cliffMonths', (cliffMonths) => setGroup('vesting', { cliffMonths: Math.max(STATUTORY.minVestingMonths, cliffMonths) }))}
          min={STATUTORY.minVestingMonths}
          max={48}
          suffix="months"
        />
      </Field>

      <Field label="Total vesting period" htmlFor="vesting-years" estimate required={isRequired('vesting.vestYears')}>
        <NumberField
          id="vesting-years"
          value={vesting.vestYears}
          blank={isBlank('vesting.vestYears')}
          onChange={withTouch('vesting.vestYears', (vestYears) => setGroup('vesting', { vestYears: Math.max(1, vestYears) }))}
          min={1}
          max={10}
          suffix="years"
        />
      </Field>

      <Field label="Vesting frequency" estimate required={isRequired('vesting.frequency')}>
        <SegmentedControl
          value={isBlank('vesting.frequency') ? null : vesting.frequency}
          onChange={withTouch('vesting.frequency', (frequency) => setGroup('vesting', { frequency }))}
          ariaLabel="Vesting frequency"
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'annual', label: 'Annual' },
          ]}
        />
      </Field>
    </CollapsibleSection>
  );
}
