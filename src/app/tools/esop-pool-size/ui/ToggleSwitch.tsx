interface ToggleSwitchProps {
  readonly id: string;
  readonly checked: boolean;
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
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 disabled:cursor-not-allowed ${
          disabled
            ? 'border-strong bg-disabled'
            : checked
              ? 'border-accent bg-accent'
              : 'border-strong bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
            disabled ? 'bg-quiet' : checked ? 'bg-accent-ink' : 'bg-strong'
          } ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </button>
      <span className={`text-eyebrow ${disabled ? 'text-quiet' : 'text-sub'}`}>{label}</span>
      <span className="sr-only">{checked ? onLabel : offLabel}</span>
    </label>
  );
}
