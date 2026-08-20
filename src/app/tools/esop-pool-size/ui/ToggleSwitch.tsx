interface ToggleSwitchProps {
  readonly id: string;
  /** `null` before the founder has answered, for a required toggle only (D7).
   *  A `minor` toggle passes its real value from the first render, per D9 §5. */
  readonly checked: boolean | null;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly offLabel?: string;
  readonly onLabel?: string;
  readonly disabled?: boolean;
}

export function ToggleSwitch({
  id,
  checked,
  onChange,
  label,
  offLabel = 'No',
  onLabel = 'Yes',
  disabled,
}: ToggleSwitchProps) {
  const unanswered = checked === null;

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={unanswered ? 'mixed' : checked}
        disabled={disabled}
        // `!null === true`: the first click on an unanswered toggle turns it
        // on, the same gesture as turning on any other toggle. A founder
        // whose real answer is "no" clicks once to reach it explicitly — the
        // point of every field starting blank is that "no" is chosen, not
        // defaulted to.
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 disabled:cursor-not-allowed ${
          disabled
            ? 'border-strong bg-disabled'
            : unanswered
              ? 'border-dashed border-strong bg-muted'
              : checked
                ? 'border-accent bg-accent'
                : 'border-strong bg-muted'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
            disabled ? 'bg-quiet' : unanswered ? 'bg-faint' : checked ? 'bg-accent-ink' : 'bg-strong'
          } ${unanswered ? 'translate-x-2' : checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      <span className={`text-eyebrow ${disabled ? 'text-quiet' : 'text-sub'}`}>{label}</span>
      <span className="sr-only">{unanswered ? 'Not answered' : checked ? onLabel : offLabel}</span>
    </label>
  );
}
