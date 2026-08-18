'use client';

import type { EsopInputs } from '@/lib/esop';
import { Field } from '../../ui/Field';
import { NumberField } from '../../ui/NumberField';
import { RadioGroup } from '../../ui/RadioGroup';
import { RequiredMarker } from '../../ui/RequiredMarker';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { makeTouchHelpers, META_LEADERSHIP_HIRES } from '../../lib/touched';
import { BAND_LABEL } from '../../lib/labels';
import { distributeHires, mixFromProfile, type HiringTiming, type TeamProfile } from '../../lib/translateHiringPlan';
import type { EsopGroupKey } from '../../inputs/InputCard';
import { SeniorityMix } from '../../inputs/SeniorityMix';

const HORIZON_OPTIONS = ['2', '3', '4', '5'] as const;
const TIMING_OPTIONS: readonly { value: HiringTiming; label: string }[] = [
  { value: 'earlier', label: 'Earlier' },
  { value: 'even', label: 'Evenly spread' },
  { value: 'later', label: 'Later' },
];
const PROFILE_OPTIONS: readonly { value: TeamProfile | 'custom'; label: string; helper: string }[] = [
  { value: 'juniorHeavy', label: 'Mostly junior', helper: 'A small leadership layer, mostly junior and mid hires.' },
  { value: 'balanced', label: 'Balanced', helper: 'A typical spread across every level.' },
  { value: 'seniorHeavy', label: 'Senior-heavy', helper: 'Weighted toward senior ICs and leadership.' },
  { value: 'custom', label: 'Custom mix', helper: 'Set every band yourself.' },
];

export interface HiringMeta {
  readonly totalHires: number;
  readonly timing: HiringTiming;
  readonly profile: TeamProfile | 'custom';
  readonly leadershipHires: number;
  /**
   * Whether "total hires" has ever been entered. Read from `meta` itself
   * rather than the `touched` dot-path set: `markTouched` and `setState` are
   * both async, so a handler that calls `markTouched(path)` and then checks
   * `touched.has(path)` in the same tick still sees the pre-update set. `meta`
   * has no such lag — `setTotalHires` both flips this flag and applies the
   * distribution in the same object, read back correctly on every render.
   */
  readonly hasEnteredHires: boolean;
}

export const DEFAULT_HIRING_META: HiringMeta = {
  totalHires: 0,
  timing: 'even',
  profile: 'balanced',
  leadershipHires: 0,
  hasEnteredHires: false,
};

interface ScreenHiringProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly meta: HiringMeta;
  readonly setMeta: (meta: HiringMeta) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly markManyTouched: (paths: readonly string[]) => void;
  readonly requiredPaths: ReadonlySet<string>;
}

const META_TOTAL_HIRES = 'onboarding.hiring.totalHires';

/**
 * design.md §4.2/§4.3. The engine only ever sees `hiring.hiresPerYear` and
 * `hiring.seniorityMix` — this screen collects four simple questions and
 * derives both through the pure functions in lib/translateHiringPlan.ts,
 * documented there rather than computed silently here.
 */
export function ScreenHiring({ inputs, setGroup, meta, setMeta, touched, markTouched, markManyTouched, requiredPaths }: ScreenHiringProps) {
  const { hiring } = inputs;
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);
  const metaBlank = (path: string) => !touched.has(path);

  function applyDistribution(next: HiringMeta, horizonYears = hiring.horizonYears) {
    if (!next.hasEnteredHires) return;
    const perYear = distributeHires(next.totalHires, horizonYears, next.timing);
    setGroup('hiring', { hiresPerYear: perYear });
    markManyTouched(perYear.map((_, i) => `hiring.hiresPerYear.${i}`));
  }

  function applyMix(next: HiringMeta) {
    if (next.profile === 'custom') return;
    setGroup('hiring', { seniorityMix: mixFromProfile(next.profile, next.leadershipHires, next.totalHires) });
  }

  function setHorizon(horizonYears: number) {
    if (meta.hasEnteredHires) {
      setGroup('hiring', { horizonYears });
      applyDistribution(meta, horizonYears);
      return;
    }
    let hiresPerYear = hiring.hiresPerYear;
    if (hiresPerYear.length < horizonYears) {
      const last = hiresPerYear[hiresPerYear.length - 1] ?? 0;
      hiresPerYear = [...hiresPerYear, ...Array(horizonYears - hiresPerYear.length).fill(last)];
    }
    setGroup('hiring', { horizonYears, hiresPerYear });
  }

  function setTotalHires(totalHires: number) {
    const next = { ...meta, totalHires, hasEnteredHires: true };
    setMeta(next);
    applyDistribution(next);
    applyMix(next);
  }

  function setTiming(timing: HiringTiming) {
    const next = { ...meta, timing };
    setMeta(next);
    applyDistribution(next);
  }

  function setProfile(profile: TeamProfile | 'custom') {
    const next = { ...meta, profile };
    setMeta(next);
    applyMix(next);
  }

  function setLeadershipHires(leadershipHires: number) {
    const next = { ...meta, leadershipHires };
    setMeta(next);
    applyMix(next);
  }

  const previewMix = meta.profile === 'custom' ? null : mixFromProfile(meta.profile, meta.leadershipHires, meta.totalHires);

  return (
    <div className="space-y-8">
      <Field label="Planning horizon" group required={isRequired('hiring.horizonYears')}>
        <SegmentedControl
          value={isBlank('hiring.horizonYears') ? null : String(hiring.horizonYears)}
          onChange={withTouch('hiring.horizonYears', (v) => setHorizon(Number(v)))}
          ariaLabel="Planning horizon"
          size="md"
          options={HORIZON_OPTIONS.map((v) => ({ value: v, label: `${v} years` }))}
        />
      </Field>

      <Field
        label="How many ESOP-eligible people will you hire?"
        htmlFor="onb-total-hires"
        helper="Enter your planned hires, even if it's zero — this is what unlocks the year-by-year plan below."
      >
        <NumberField
          id="onb-total-hires"
          value={meta.totalHires}
          blank={metaBlank(META_TOTAL_HIRES)}
          onChange={(v) => {
            markTouched(META_TOTAL_HIRES);
            setTotalHires(v);
          }}
        />
      </Field>

      <Field label="When will most of the hiring happen?" group>
        <SegmentedControl<HiringTiming>
          value={meta.timing}
          onChange={setTiming}
          ariaLabel="Hiring timing"
          size="md"
          options={TIMING_OPTIONS}
        />
      </Field>

      <Field label="What will your hiring mix roughly look like?" group>
        <RadioGroup<TeamProfile | 'custom'>
          name="team-profile"
          value={meta.profile}
          onChange={setProfile}
          ariaLabel="Team profile"
          options={PROFILE_OPTIONS}
        />
      </Field>

      {meta.profile === 'custom' ? (
        <SeniorityMix
          mix={hiring.seniorityMix}
          onChange={(seniorityMix) => setGroup('hiring', { seniorityMix })}
          touched={touched}
          markTouched={markTouched}
          requiredPaths={requiredPaths}
          inputs={inputs}
        />
      ) : (
        <>
          <Field label="How many leadership / CXO hires?" htmlFor="onb-leadership-hires">
            <NumberField
              id="onb-leadership-hires"
              value={meta.leadershipHires}
              blank={metaBlank(META_LEADERSHIP_HIRES)}
              onChange={(v) => {
                markTouched(META_LEADERSHIP_HIRES);
                setLeadershipHires(v);
              }}
            />
          </Field>
          {previewMix ? (
            <p className="text-2xs leading-4 text-faint">
              We&apos;ll use approximately{' '}
              {(['leadership', 'senior', 'mid', 'junior'] as const)
                .map((band) => `${BAND_LABEL[band]} ${Math.round(previewMix[band] * 10) / 10}%`)
                .join(' · ')}
              .
            </p>
          ) : null}
        </>
      )}

      <details className="rounded-lg border border-border bg-raised">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-eyebrow font-medium text-ink [&::-webkit-details-marker]:hidden">
          Enter hiring by year
        </summary>
        <div className="border-t border-border px-4 py-4">
          <div role="group" aria-label="Hires per year" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {Array.from({ length: hiring.horizonYears }, (_, i) => i).map((i) => (
              <label key={i} className="space-y-1">
                <span className="text-2xs text-faint">
                  {`Y${i + 1}`}
                  {isRequired(`hiring.hiresPerYear.${i}`) ? <RequiredMarker /> : null}
                </span>
                <NumberField
                  id={`onb-hires-y${i}`}
                  ariaLabel={`Hires in year ${i + 1}`}
                  value={hiring.hiresPerYear[i] ?? 0}
                  blank={isBlank(`hiring.hiresPerYear.${i}`)}
                  onChange={withTouch(`hiring.hiresPerYear.${i}`, (v) => {
                    const next = [...hiring.hiresPerYear];
                    next[i] = Math.max(0, v);
                    setGroup('hiring', { hiresPerYear: next });
                  })}
                />
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
