'use client';

import { NumberField } from './NumberField';

const CRORE = 10_000_000;

interface CroreFieldProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly blank?: boolean;
  readonly ariaLabel?: string;
  readonly align?: 'left' | 'right';
}

/**
 * "Standardise ALL monetary inputs to ₹ Crore": every company-level rupee
 * amount — valuation, a round's pre-money and raise amount — edits and
 * displays in crore, never a raw rupee integer or a lakh/crore mix.
 * Converts once at the boundary: `NumberField` underneath sees and commits
 * crore (so `₹12.5 Cr` round-trips as a plain decimal, no new parsing),
 * `onChange` still hands the caller — and so the engine — whole rupees.
 */
export function CroreField({ id, value, onChange, blank, ariaLabel, align }: CroreFieldProps) {
  return (
    <NumberField
      id={id}
      ariaLabel={ariaLabel}
      value={value / CRORE}
      onChange={(cr) => onChange(cr * CRORE)}
      blank={blank}
      align={align}
      prefix="₹"
      suffix="Cr"
    />
  );
}
