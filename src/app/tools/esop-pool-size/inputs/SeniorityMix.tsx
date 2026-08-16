import { BANDS, DEFAULT_SENIORITY_MIX_PCT, type SeniorityMix as SeniorityMixValue } from '@/lib/esop';
import { NumberField } from '../ui/NumberField';
import { BAND_LABEL } from '../lib/labels';

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
}

function normalise(mix: SeniorityMixValue): SeniorityMixValue {
  const total = BANDS.reduce((sum, band) => sum + Math.max(mix[band], 0), 0);
  if (total <= 0) return { ...DEFAULT_SENIORITY_MIX_PCT };

  const scaled = BANDS.map((band) => ({ band, value: (Math.max(mix[band], 0) / total) * 100 }));
  const rounded = scaled.map((s) => ({ band: s.band, value: Math.round(s.value) }));
  const drift = 100 - rounded.reduce((sum, r) => sum + r.value, 0);

  if (drift !== 0) {
    const largest = rounded.reduce((best, r) => (r.value > best.value ? r : best), rounded[0]!);
    largest.value += drift;
  }

  const result = {} as Record<(typeof BANDS)[number], number>;
  for (const r of rounded) result[r.band] = r.value;
  return result;
}

export function SeniorityMix({ mix, onChange }: SeniorityMixProps) {
  const total = BANDS.reduce((sum, band) => sum + Math.max(mix[band], 0), 0);
  const invalid = Math.round(total) !== 100;

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-ink">Seniority mix</p>
      <div className="flex h-2 overflow-hidden rounded-full border border-border">
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
            </span>
            <NumberField
              id={`mix-${band}`}
              value={mix[band]}
              onChange={(value) => onChange({ ...mix, [band]: Math.max(0, value) })}
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
            onClick={() => onChange(normalise(mix))}
            className="mt-1 text-2xs font-medium text-danger underline"
          >
            Rebalance to 100%
          </button>
        </div>
      ) : null}
    </div>
  );
}
