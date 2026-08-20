import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  readonly size?: 'sm' | 'md';
}

/**
 * The document's §4 "Buttons" block, as the four variants this app already
 * had. Each maps onto one of §4's named styles:
 *
 *   primary   -> `.btn-primary`   brand fill, white label, hover lift + glow
 *   secondary -> `.btn-secondary` transparent, warm border, hover lift
 *   ghost     -> `.btn-ghost`     no border, muted, hover darkens + nudges
 *   outline   -> `.btn-secondary` with a resting border, for a second action
 *
 * The hover lift (`translateY(-2px)`) and the active settle
 * (`translateY(0) scale(0.98)`) are §4's own interaction language, and §6
 * names them as how elevation is communicated on the cream canvas instead of
 * drop shadows. They live in the `.btn-*` classes in globals.css so the
 * transition timing is declared once.
 *
 * `--accent`/`--accent-ink` invert per theme, so the fill is one rule in both
 * themes rather than a hardcoded colour. Disabled states are a fill and a
 * colour rather than `opacity-50`, which took the label to 2.09:1 in light —
 * WCAG exempts inactive controls; a label nobody can read is still a defect.
 */
const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'btn-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled disabled:text-quiet disabled:transform-none disabled:shadow-none',
  secondary:
    'btn-secondary bg-surface disabled:cursor-not-allowed disabled:bg-disabled disabled:text-quiet disabled:transform-none',
  ghost: 'btn-ghost disabled:cursor-not-allowed disabled:text-quiet disabled:transform-none',
  /** §4's secondary, kept as its own name because it is the page's *second*
   *  action beside a primary one (the Tabulate CTA band) rather than a
   *  standalone alternative. */
  outline: 'btn-secondary disabled:cursor-not-allowed disabled:text-quiet disabled:transform-none',
};

/**
 * §4 gives one padding for `.btn-primary`/`.btn-secondary` — `14px 28px`,
 * which §8 notes is what carries them past the 44px touch-target floor. That
 * is `md`, the default. `sm` is this app's own compact variant for the
 * header and the results chrome, where a 44px button would not fit beside a
 * 48px figure; it keeps the same voice at a smaller box.
 */
const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: '!px-3 !py-1.5 text-2xs',
  md: '',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
