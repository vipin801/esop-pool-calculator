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
      className={`flex items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ${
          checked ? 'border-accent bg-accent' : 'border-strong bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-[13px] text-sub">{label}</span>
      <span className="sr-only">{checked ? onLabel : offLabel}</span>
    </label>
  );
}
