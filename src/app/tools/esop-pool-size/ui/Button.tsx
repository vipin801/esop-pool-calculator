import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  readonly size?: 'sm' | 'md';
}

/**
 * One accent, reserved for focus rings only (2026-08-18 restraint pass) —
 * `bg-ink`/`text-bg` instead of `bg-accent`/`text-accent-ink` for the primary
 * action. `--ink`/`--bg` already invert correctly per theme (near-black on
 * cream in light, near-white on near-black in dark), so this is still a
 * single "dark fill, light text" rule in both themes, not a hardcoded colour.
 *
 * Disabled states are a fill and a colour rather than `opacity-50`, which
 * took the same label to 2.09:1 in light mode. WCAG exempts inactive
 * controls; a label nobody can read is still a defect — dimmed only when
 * genuinely disabled, never as the resting state.
 */
const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-ink text-bg border border-ink hover:bg-sub hover:border-sub disabled:cursor-not-allowed disabled:border-strong disabled:bg-disabled disabled:text-quiet',
  secondary:
    'bg-raised text-ink border border-strong hover:border-ink disabled:cursor-not-allowed disabled:bg-disabled disabled:text-quiet',
  ghost:
    'bg-transparent text-sub border border-transparent hover:text-ink disabled:cursor-not-allowed disabled:text-quiet',
  /** "Ghost with a border" — a visible outline, no fill, for a page's second
   *  action next to a `primary` first one (the Tabulate CTA band). */
  outline:
    'bg-transparent text-ink border border-strong hover:border-ink hover:bg-muted disabled:cursor-not-allowed disabled:text-quiet',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-2xs',
  /** 44px tall (h-11) — this redesign's touch-target floor for the wizard's
   *  own Back/Continue and CTA-band buttons, the ones `size="md"` (the
   *  default) is actually used for. `sm` stays compact: it is the header's
   *  and the results screen's own small secondary buttons, out of this
   *  pass's scope. */
  md: 'h-11 px-3.5 text-eyebrow',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors duration-150 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
