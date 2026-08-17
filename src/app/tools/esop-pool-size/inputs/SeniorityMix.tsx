'use client';

import { useEffect, useRef, useState } from 'react';
import { BANDS, type SeniorityMix as SeniorityMixValue } from '@/lib/esop';
import { NumberField } from '../ui/NumberField';
import { RequiredMarker } from '../ui/RequiredMarker';
import { BAND_LABEL } from '../lib/labels';
import { isMixValid, mixTotal, normaliseMix } from '../lib/seniorityMix';
import { makeTouchHelpers } from '../lib/touched';

/** A shade per band, derived from the theme tokens rather than a fresh palette. */
const BAND_SHADE: Record<(typeof BANDS)[number], string> = {
  leadership: 'var(--accent)',
  senior: 'color-mix(in srgb, var(--accent) 55%, var(--surface-muted))',
  mid: 'var(--border-strong)',
  junior: 'var(--border)',
};

interface SeniorityMixProps {
  readonly mix: SeniorityMixValue;
  readonly onChange: (mix: SeniorityMixValue) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly requiredPaths: ReadonlySet<string>;
}

/**
 * A mix that does not total 100 silently loses hires — the engine normalises
 * nothing and `seniorityMixSumsTo100` is a warning nobody is obliged to read.
 * So the group cannot be *left* invalid: it rebalances when focus leaves it,
 * and says so in a live region rather than changing four numbers silently.
 *
 * While the founder is still inside the group the error and the explicit
 * "Rebalance to 100%" button stay, and nothing is rewritten under their
 * cursor — typing 40 into a field on the way to 40/30/20/10 must not be
 * corrected mid-edit.
 */
export function SeniorityMix({ mix, onChange, touched, markTouched, requiredPaths }: SeniorityMixProps) {
  const [announcement, setAnnouncement] = useState('');
  const groupRef = useRef<HTMLDivElement>(null);
  const { isBlank, isRequired } = makeTouchHelpers(touched, markTouched, requiredPaths);

  /**
   * The field's own blur commit and the group's blur both fire inside one
   * event, and both would read the same stale `mix` prop — so tabbing out of
   * a field you just edited would rebalance the value from *before* the edit
   * and throw the edit away. The ref carries the committed value across the
   * two handlers.
   */
  const latest = useRef(mix);
  useEffect(() => {
    latest.current = mix;
  }, [mix]);

  const total = mixTotal(mix);
  const invalid = !isMixValid(mix);

  function setBand(band: (typeof BANDS)[number], value: number) {
    const next = { ...latest.current, [band]: Math.max(0, value) };
    latest.current = next;
    onChange(next);
  }

  function rebalance(reason: 'button' | 'blur') {
    const current = latest.current;
    if (isMixValid(current)) return;

    const next = normaliseMix(current);
    latest.current = next;
    onChange(next);
    setAnnouncement(reason === 'blur' ? 'Seniority mix rebalanced to 100%.' : 'Seniority mix set to 100%.');
  }

  function onBlurCapture(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && groupRef.current?.contains(next)) return;
    rebalance('blur');
  }

  return (
    <div className="space-y-2" ref={groupRef} onBlur={onBlurCapture}>
      <p className="text-eyebrow font-medium text-ink">Seniority mix</p>
      <div className="flex h-2 overflow-hidden rounded-full border border-strong">
        {BANDS.map((band) => (
          <div
            key={band}
            style={{ width: `${Math.max(0, mix[band])}%`, background: BAND_SHADE[band] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BANDS.map((band) => (
          <label key={band} className="space-y-1">
            <span className="flex items-center gap-1.5 text-2xs text-faint">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BAND_SHADE[band] }} />
              {BAND_LABEL[band]}
              {isRequired(`hiring.seniorityMix.${band}`) ? <RequiredMarker /> : null}
            </span>
            <NumberField
              id={`mix-${band}`}
              ariaLabel={`${BAND_LABEL[band]} share of hires, percent`}
              value={mix[band]}
              blank={isBlank(`hiring.seniorityMix.${band}`)}
              onChange={(value) => {
                setBand(band, value);
                markTouched(`hiring.seniorityMix.${band}`);
              }}
              max={100}
              suffix="%"
            />
          </label>
        ))}
      </div>
      {invalid ? (
        <div className="rounded border border-danger bg-danger-soft px-2.5 py-2">
          <p className="text-2xs text-danger">Mix must total 100%. Currently {Math.round(total)}%.</p>
          <button
            type="button"
            onClick={() => rebalance('button')}
            className="mt-1 text-2xs font-medium text-danger underline"
          >
            Rebalance to 100%
          </button>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
