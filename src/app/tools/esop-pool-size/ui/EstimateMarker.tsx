interface EstimateMarkerProps {
  readonly label?: string;
}

export function EstimateMarker({ label = 'Estimate' }: EstimateMarkerProps) {
  return (
    <span
      title="Editable estimate, not a sourced figure"
      className="ml-1.5 inline-flex items-center rounded border border-border px-1 py-px text-2xs font-medium text-faint align-middle"
    >
      {label}
    </span>
  );
}
