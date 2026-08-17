import { useId } from 'react';

interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly helper?: string;
}

interface RadioGroupProps<T extends string> {
  readonly name: string;
  /** `null` before the founder has chosen — every field starts blank. */
  readonly value: T | null;
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
  const uid = useId();

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="space-y-1.5">
      {options.map((option) => (
        <label
          key={option.value}
          htmlFor={`${uid}-${option.value}`}
          className={`flex items-start gap-2 rounded border px-2.5 py-2 ${
            disabled
              ? 'cursor-not-allowed border-border bg-disabled'
              : `cursor-pointer bg-raised ${value === option.value ? 'border-accent' : 'border-strong'}`
          }`}
        >
          {/*
            The accessible name comes from `aria-labelledby`, not from the
            wrapping label's text. Without it the option announced as its own
            `value` — "percentOfEquity" — which is the enum, not the choice.
            The helper is a description rather than part of the name, so the
            option reads as "Percent of equity" and explains itself after.
          */}
          <input
            id={`${uid}-${option.value}`}
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            aria-labelledby={`${uid}-${option.value}-label`}
            aria-describedby={option.helper ? `${uid}-${option.value}-helper` : undefined}
            className="mt-0.5 h-3.5 w-3.5 accent-accent"
          />
          <span>
            <span
              id={`${uid}-${option.value}-label`}
              className={`block text-eyebrow leading-4 ${disabled ? 'text-quiet' : 'text-ink'}`}
            >
              {option.label}
            </span>
            {option.helper ? (
              <span
                id={`${uid}-${option.value}-helper`}
                className={`mt-0.5 block text-2xs leading-4 ${disabled ? 'text-quiet' : 'text-faint'}`}
              >
                {option.helper}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
