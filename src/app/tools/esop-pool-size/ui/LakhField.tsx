'use client';

import { NumberField } from './NumberField';

const LAKH = 100_000;

interface LakhFieldProps {
  readonly id: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly blank?: boolean;
  readonly ariaLabel?: string;
}

/**
 * "Grant amounts exception": an individual employee grant (₹25 L, say) reads
 * naturally in lakh — forcing it into `CroreField`'s crore would print
 * ₹0.25 Cr for every band. Same boundary conversion as `CroreField`, scaled
 * by lakh instead of crore.
 */
export function LakhField({ id, value, onChange, blank, ariaLabel }: LakhFieldProps) {
  return (
    <NumberField
      id={id}
      ariaLabel={ariaLabel}
      value={value / LAKH}
      onChange={(l) => onChange(l * LAKH)}
      blank={blank}
      prefix="₹"
      suffix="L"
    />
  );
}
