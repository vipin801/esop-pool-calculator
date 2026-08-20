import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  readonly size?: 'sm' | 'md';
}

/**
 * The accent is a fill again (2026-08-19 document swap), reversing the
 * 2026-08-18 restraint pass's `bg-ink`/`text-bg` primary. The design system
 * names CTAs and primary interactive elements as the accent's own job — it is
 * "the only chromatic color in UI chrome", and reserving it for focus rings
 * left the whole app achromatic and the brand unreadable from a screenshot.
 * `--accent`/`--accent-ink` invert per theme (5.35:1 light, 5.45:1 dark), so
 * this is still one rule in both themes rather than a hardcoded colour.
 *
 * Every other variant stays achromatic, so a viewport still has exactly one
 * blue fill in it: the action that viewport is for.
 *
 * Disabled states are a fill and a colour rather than `opacity-50`, which
 * took the same label to 2.09:1 in light mode. WCAG exempts inactive
 * controls; a label nobody can read is still a defect — dimmed only when
 * genuinely disabled, never as the resting state.
 */
const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-accent-ink border border-accent hover:bg-accent-hover hover:border-accent-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled disabled:text-quiet',
  secondary:
    'bg-surface text-ink border border-strong hover:border-ink hover:bg-muted disabled:cursor-not-allowed disabled:bg-disabled disabled:text-quiet',
  ghost:
    'bg-transparent text-sub border border-transparent hover:text-ink hover:bg-muted disabled:cursor-not-allowed disabled:text-quiet',
  /** "Ghost with a border" — a visible outline, no fill, for a page's second
   *  action next to a `primary` first one (the Tabulate CTA band). */
  outline:
    'bg-transparent text-ink border border-strong hover:border-ink hover:bg-muted disabled:cursor-not-allowed disabled:text-quiet',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  /** 32px tall. The header's and the results screen's small secondaries —
   *  compact enough to sit on the headline's own row beside a 72px figure. */
  sm: 'h-8 px-3 text-2xs',
  /** 44px tall — this redesign's touch-target floor for the wizard's own
   *  Back/Continue and the CTA-band buttons, and wider than it was: at a 4px
   *  radius a button is read by its box, so the box needs real horizontal
   *  room to stop looking like an input. */
  md: 'h-11 px-5 text-eyebrow',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium tracking-[-0.005em] transition-colors duration-150 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
