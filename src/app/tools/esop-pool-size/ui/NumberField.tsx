'use client';

import { useState } from 'react';
import { formatIndian, parseNumber } from '../lib/format';

interface NumberFieldProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly grouped?: boolean;
  readonly ariaLabel?: string;
  readonly align?: 'left' | 'right';
  readonly disabled?: boolean;
  /**
   * The founder has not yet entered this field *and* it is one of the ones
   * whose control starts empty. `value` still holds the real seed the engine
   * would use; the box shows nothing instead. Required fields set this until
   * answered (D7); a `minor` field never does, because a blank box that still
   * moves the answer is an unmarked default (D9 §5). Callers ask
   * `lib/touched.ts`'s `isBlank`, which decides both halves.
   */
  readonly blank?: boolean;
}

/**
 * Three decimal places, not two.
 *
 * Two was invisible while every field started blank: the only seeded default in
 * `DEFAULTS` carrying a third decimal is the senior band's Basis A grant, and
 * M1 puts it at the midpoint of the advisory 0.15–0.3 range, so 0.225. Now that
 * D9 §5 renders an untouched `minor` field's default rather than an empty box,
 * rounding it to 0.23 would show a figure the engine is not using — the
 * unmarked default D6 forbids, arriving through the display layer instead of
 * through a blank. Nothing else in the table needs the third place, and no
 * field's rendering moves but that one.
 */
function display(v: number, grouped: boolean): string {
  return grouped ? formatIndian(v) : String(Math.round(v * 1000) / 1000);
}

export function NumberField({
  id,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  suffix,
  prefix,
  grouped = false,
  ariaLabel,
  align = 'left',
  disabled,
  blank = false,
}: NumberFieldProps) {
  const [raw, setRaw] = useState(() => (blank ? '' : display(value, grouped)));
  const [focused, setFocused] = useState(false);
  const [synced, setSynced] = useState({ value, grouped, blank });

  // Adjusting state during render (not in an effect) when an external prop
  // change should overwrite the local edit buffer — e.g. Reset, or a preset
  // that sets this field from elsewhere. Skipped while the user is mid-edit.
  if (!focused && (synced.value !== value || synced.grouped !== grouped || synced.blank !== blank)) {
    setSynced({ value, grouped, blank });
    setRaw(blank ? '' : display(value, grouped));
  }

  function commit(text: string) {
    const next = Math.min(max, Math.max(min, parseNumber(text)));
    onChange(next);
    setRaw(display(next, grouped));
  }

  return (
    <div
      className={`focus-ring flex h-11 items-center rounded border border-strong ${
        disabled ? 'bg-disabled' : 'bg-raised'
      }`}
    >
      {prefix ? <span className="pl-2.5 text-eyebrow text-faint">{prefix}</span> : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={raw}
        onFocus={() => setFocused(true)}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={`tnum w-full bg-transparent px-2.5 py-2 text-eyebrow text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:text-quiet ${
          align === 'right' ? 'text-right' : ''
        }`}
      />
      {suffix ? <span className="pr-2.5 text-eyebrow text-faint">{suffix}</span> : null}
    </div>
  );
}
