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
  /** Only where no `Field` label points at this id — a control inside a group. */
  readonly ariaLabel?: string;
  /**
   * The founder has not yet chosen. `value` still holds the real seed, but
   * an empty placeholder option is shown selected instead of it, and picking
   * it back is impossible — it exists only to render "nothing chosen yet".
   */
  readonly blank?: boolean;
}

const BLANK_OPTION_VALUE = '__blank__';

export function SelectField<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  blank = false,
}: SelectFieldProps<T>) {
  return (
    <div className="relative">
      <select
        id={id}
        value={blank ? BLANK_OPTION_VALUE : value}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === BLANK_OPTION_VALUE) return;
          onChange(e.target.value as T);
        }}
        className="w-full appearance-none rounded border border-strong bg-raised px-2.5 py-2 pr-8 text-eyebrow text-ink disabled:cursor-not-allowed disabled:bg-disabled disabled:text-quiet"
      >
        {blank ? (
          <option value={BLANK_OPTION_VALUE} disabled hidden>
            Select…
          </option>
        ) : null}
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
