import { EXERCISE_WINDOW_DAYS_OPTIONS, STATUTORY } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { OptionalFieldToggle } from '../ui/OptionalFieldToggle';
import { makeTouchHelpers } from '../lib/touched';
import type { CardProps } from './InputCard';

/**
 * Brief §3, section 05, merging the old AttritionCard and VestingCard.
 * Since D9 nothing here is required: every field is `minor`, so it falls
 * back to the spec default it would otherwise have applied silently, and the
 * founder reaches a pool without opening this section at all. Collapsed by
 * default state mirrors the current value of `recycleForfeited` rather than
 * forcing a mismatched "closed" on a plan that already recycles.
 *
 * 2026-08-18 restraint pass: every field here being `minor` means every field
 * carried `EstimateMarker`, nine badges reading the same word — the same
 * repetition "All fields required" fixed for the wizard's asterisks. One line
 * up top says it once instead; individual fields no longer pass `estimate`.
 *
 * D11 (the "Simplify Optional ESOP Inputs" / "Simplify Remaining Inputs"
 * passes): Sector is gone from the UI entirely — `attrition.sector` still
 * exists on `EsopInputs` and still seeds `baseAnnualPct` at mount
 * (`buildSeedInputs`), but nothing here lets a founder change it, and the
 * copy explaining that it used to prefill the rate is gone with it. Base
 * annual attrition, the leadership override, vested-options-never-exercised,
 * the post-termination exercise window and the vesting policy (cliff, total
 * period, frequency — one `OptionalFieldToggle`, since a founder editing any
 * one of the three almost always means the other two) are
 * `OptionalFieldToggle`s now: D11's narrow exception to D9's "always show the
 * live default, marked as an estimate" rule for exactly these fields (see
 * PROJECT.md D11). Only the recycle toggle — the one field named to stay
 * visible — is unaffected.
 */
interface LeaversAndRecyclingCardProps extends CardProps {
  readonly index?: string;
}

export function LeaversAndRecyclingCard({ inputs, setGroup, touched, markTouched, requiredPaths, index = '05' }: LeaversAndRecyclingCardProps) {
  const { attrition, exercise, vesting } = inputs;
  const atFloor = vesting.cliffMonths <= STATUTORY.minVestingMonths;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

  return (
    <CollapsibleSection
      index={index}
      title="Leavers and recycling"
      defaultOpen={exercise.recycleForfeited}
      hint="Attrition and vesting don't change your pool when options aren't recycled. They still affect your ESOP expense."
    >
      <Field
        label="Forfeited and lapsed options"
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

      <OptionalFieldToggle label="Add annual attrition">
        <Field label="Base annual attrition" htmlFor="attrition-base" required={isRequired('attrition.baseAnnualPct')}>
          <NumberField
            id="attrition-base"
            value={attrition.baseAnnualPct}
            blank={isBlank('attrition.baseAnnualPct')}
            onChange={withTouch('attrition.baseAnnualPct', (baseAnnualPct) => setGroup('attrition', { baseAnnualPct }))}
            max={100}
            suffix="%"
          />
        </Field>
      </OptionalFieldToggle>

      <OptionalFieldToggle label="Add leadership attrition override">
        <Field
          label="Leadership override" htmlFor="attrition-leadership"
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
      </OptionalFieldToggle>

      <OptionalFieldToggle label="Add vested options never exercised">
        <Field
          label="Vested options never exercised" htmlFor="lapse-rate"
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
      </OptionalFieldToggle>

      <OptionalFieldToggle label="Add exercise window">
        <Field label="Post-termination exercise window" required={isRequired('exercise.exerciseWindowDays')}>
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
      </OptionalFieldToggle>

      <OptionalFieldToggle label="Add vesting policy">
        <div className="space-y-4">
          <Field
            label="Cliff" htmlFor="vesting-cliff"
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

          <Field label="Total vesting period" htmlFor="vesting-years" required={isRequired('vesting.vestYears')}>
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

          <Field label="Vesting frequency" required={isRequired('vesting.frequency')}>
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
        </div>
      </OptionalFieldToggle>
    </CollapsibleSection>
  );
}
