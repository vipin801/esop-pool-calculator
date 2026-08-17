interface SliderPreset {
  readonly value: number;
  readonly label: string;
}

interface SliderFieldProps {
  readonly id: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly suffix?: string;
  readonly presets?: readonly SliderPreset[];
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  /**
   * The founder has not dragged this yet. A range input always needs *a*
   * handle position — there is no native blank state — so `value` still
   * positions it, but faded, and the readout says so instead of a number
   * that was never chosen. Any drag or preset click reports a real value
   * and the caller stops passing `blank`.
   */
  readonly blank?: boolean;
}

export function SliderField({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = '%',
  presets,
  ariaLabel,
  disabled,
  blank = false,
}: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={blank ? `${ariaLabel ?? ''} (not set)`.trim() : ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full ${blank ? 'opacity-40' : ''}`}
        />
        <span
          className={`tnum w-14 shrink-0 rounded border border-strong px-1.5 py-1 text-right text-eyebrow ${
            disabled ? 'bg-disabled text-quiet' : blank ? 'bg-raised text-faint' : 'bg-raised text-ink'
          }`}
        >
          {blank ? 'Not set' : `${value}${suffix}`}
        </span>
      </div>
      {presets ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:text-quiet ${
                !blank && preset.value === value ? 'border-accent text-accent' : 'border-strong text-sub hover:text-ink'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
