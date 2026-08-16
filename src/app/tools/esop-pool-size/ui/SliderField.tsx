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
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full disabled:opacity-50"
        />
        <span className="tnum w-14 shrink-0 rounded border border-border bg-raised px-1.5 py-1 text-right text-[13px] text-ink">
          {value}
          {suffix}
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
              className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors duration-150 ${
                preset.value === value ? 'border-accent text-accent' : 'border-border text-sub hover:text-ink'
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
