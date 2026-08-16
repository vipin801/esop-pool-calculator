interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly helper?: string;
}

interface RadioGroupProps<T extends string> {
  readonly name: string;
  readonly value: T;
  readonly options: readonly RadioOption<T>[];
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

export function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: RadioGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="space-y-1.5">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex items-start gap-2 rounded border border-border bg-raised px-2.5 py-2 ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="mt-0.5 h-3.5 w-3.5 accent-accent"
          />
          <span>
            <span className="block text-[13px] leading-4 text-ink">{option.label}</span>
            {option.helper ? (
              <span className="mt-0.5 block text-2xs leading-4 text-faint">{option.helper}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
