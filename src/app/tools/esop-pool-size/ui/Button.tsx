import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly size?: 'sm' | 'md';
}

/**
 * `text-accent-ink`, not `text-white`. In dark mode the accent is a bright
 * mint and white on it measured 2.09:1 — the worst contrast on the page sat
 * on the page's one primary button.
 *
 * Disabled states are a fill and a colour rather than `opacity-50`, which
 * took the same label to 2.09:1 in light mode. WCAG exempts inactive
 * controls; a label nobody can read is still a defect.
 */
const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-accent-ink border border-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-strong disabled:bg-disabled disabled:text-quiet',
  secondary:
    'bg-raised text-ink border border-strong hover:border-ink disabled:cursor-not-allowed disabled:bg-disabled disabled:text-quiet',
  ghost:
    'bg-transparent text-sub border border-transparent hover:text-ink disabled:cursor-not-allowed disabled:text-quiet',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-2xs',
  md: 'px-3.5 py-2 text-[13px]',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors duration-150 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
