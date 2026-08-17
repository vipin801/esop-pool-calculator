import { EXERCISE_WINDOW_DAYS_OPTIONS, baseAttritionPctForSector, type Sector } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectField } from '../ui/SelectField';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { InputCard, type CardProps } from './InputCard';

const SECTOR_LABEL: Record<Sector, string> = {
  general: 'General',
  itServices: 'IT services',
  ecommerce: 'E-commerce',
};

export function AttritionCard({ inputs, setGroup, advanced }: CardProps) {
  const { attrition, exercise } = inputs;

  return (
    <InputCard index="05" title="Attrition and exercise">
      <Field label="Sector" htmlFor="attrition-sector" helper="Prefills the base attrition rate. It does not scale a rate you type yourself.">
        <SelectField
          id="attrition-sector"
          value={attrition.sector}
          onChange={(sector) =>
            setGroup('attrition', { sector, baseAnnualPct: baseAttritionPctForSector(sector) })
          }
          options={(Object.keys(SECTOR_LABEL) as Sector[]).map((sector) => ({
            value: sector,
            label: SECTOR_LABEL[sector],
          }))}
        />
      </Field>

      <Field label="Base annual attrition" htmlFor="attrition-base" estimate>
        <NumberField
          id="attrition-base"
          value={attrition.baseAnnualPct}
          onChange={(baseAnnualPct) => setGroup('attrition', { baseAnnualPct })}
          max={100}
          suffix="%"
        />
      </Field>

      {advanced ? (
        <Field label="Leadership override" htmlFor="attrition-leadership" estimate helper="Leadership usually churns slower than the base rate.">
          <NumberField
            id="attrition-leadership"
            value={attrition.byBand.leadership ?? attrition.baseAnnualPct}
            onChange={(value) => setGroup('attrition', { byBand: { ...attrition.byBand, leadership: value } })}
            max={100}
            suffix="%"
          />
        </Field>
      ) : null}

      <Field
        label="Forfeited and lapsed options"
        helper={exercise.recycleForfeited ? 'They return to the pool.' : 'They are extinguished, not recycled.'}
      >
        <ToggleSwitch
          id="recycle-forfeited"
          checked={exercise.recycleForfeited}
          onChange={(recycleForfeited) => setGroup('exercise', { recycleForfeited })}
          label="Recycle forfeited and lapsed options"
        />
      </Field>

      <Field
        label="Vested options never exercised" htmlFor="lapse-rate"
        estimate
        helper="Share of vested options a leaver never exercises before their window closes."
      >
        <NumberField
          id="lapse-rate"
          value={exercise.vestedNeverExercisedPct}
          onChange={(vestedNeverExercisedPct) => setGroup('exercise', { vestedNeverExercisedPct })}
          max={100}
          suffix="%"
        />
      </Field>

      {advanced ? (
        <>
          <Field label="Post-termination exercise window">
            <SegmentedControl
              value={String(exercise.exerciseWindowDays)}
              onChange={(v) =>
                setGroup('exercise', {
                  exerciseWindowDays: Number(v) as (typeof EXERCISE_WINDOW_DAYS_OPTIONS)[number],
                })
              }
              ariaLabel="Post-termination exercise window"
              options={EXERCISE_WINDOW_DAYS_OPTIONS.map((days) => ({
                value: String(days),
                label: days >= 365 ? `${Math.round(days / 365)}y` : `${days}d`,
              }))}
            />
          </Field>

          <Field
            label="Continuing-employee exercises" htmlFor="continuing-exercise"
            estimate
            helper="Exercises by employees who have not left. Usually zero pre-liquidity in India."
          >
            <NumberField
              id="continuing-exercise"
              value={exercise.continuingEmployeeExercisePctPerYear}
              onChange={(continuingEmployeeExercisePctPerYear) =>
                setGroup('exercise', { continuingEmployeeExercisePctPerYear })
              }
              max={100}
              suffix="%"
            />
          </Field>
        </>
      ) : null}
    </InputCard>
  );
}
