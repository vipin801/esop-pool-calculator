import { ChevronDown } from 'lucide-react';

interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SelectFieldProps<T extends string> {
  readonly id: string;
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
}

export function SelectField<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full appearance-none rounded border border-border bg-raised px-2.5 py-2 pr-8 text-[13px] text-ink outline-none focus:border-strong disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
    </div>
  );
}
