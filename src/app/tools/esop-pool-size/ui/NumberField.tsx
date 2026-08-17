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
   * The founder has not yet entered this field. `value` still holds the real
   * seed the engine would use, but the box shows empty rather than that seed
   * — every field starts blank, and showing the seed here would show it
   * everywhere at once, the thing this prop exists to prevent.
   */
  readonly blank?: boolean;
}

function display(v: number, grouped: boolean): string {
  return grouped ? formatIndian(v) : String(Math.round(v * 100) / 100);
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
      className={`focus-ring flex items-center rounded border border-strong ${
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
