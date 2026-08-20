interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  /** `null` before the founder has chosen — every field starts blank. */
  readonly value: T | null;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
}

/** The selected segment stays a dark fill even after the 2026-08-19 accent
 *  reversal. A rail can hold six of these at once; six blue fills beside one
 *  blue primary action would make the action invisible, which is the failure
 *  mode the accent exists to prevent. Selection-by-tint is the accent's job
 *  here (`RadioGroup`, the slider presets) — a segmented control is a value
 *  picker, and its dark fill reads as "this one", not as "do this". */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'sm',
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid gap-1 rounded border border-strong ${size === 'lg' ? 'h-11 p-1' : 'p-1'} ${size === 'lg' ? 'max-sm:!grid-cols-3' : ''} ${disabled ? 'bg-disabled' : 'bg-muted'}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded px-2 font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
              size === 'lg' ? 'h-full text-eyebrow' : size === 'sm' ? 'py-1 text-2xs' : 'py-1.5 text-eyebrow'
            } ${active ? 'bg-ink text-bg' : 'text-sub hover:text-ink'} ${disabled ? 'text-quiet' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
