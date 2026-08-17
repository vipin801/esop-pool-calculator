import { useId, type ReactNode } from 'react';
import { EstimateMarker } from './EstimateMarker';

interface FieldProps {
  readonly label: string;
  /**
   * The id of the single control this label names. Required whenever the
   * field holds exactly one control.
   *
   * Without it the label sits in a sibling `div` — it neither wraps the
   * control nor points at it — so every input in the rail was reaching
   * assistive technology unnamed, announced by its own value. Fields that
   * hold two or more controls pass `group` instead.
   */
  readonly htmlFor?: string;
  /** Set when the field holds more than one control, so the label names a
   *  `role="group"` rather than pretending to name one of them. */
  readonly group?: boolean;
  readonly helper?: ReactNode;
  readonly readout?: ReactNode;
  readonly estimate?: boolean;
  readonly error?: string;
  readonly note?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  group,
  helper,
  readout,
  estimate,
  error,
  note,
  action,
  children,
}: FieldProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const asGroup = group === true || htmlFor === undefined;

  const heading = asGroup ? (
    <span id={labelId} className="text-eyebrow font-medium text-ink">
      {label}
      {estimate ? <EstimateMarker /> : null}
    </span>
  ) : (
    <label htmlFor={htmlFor} className="text-eyebrow font-medium text-ink">
      {label}
      {estimate ? <EstimateMarker /> : null}
    </label>
  );

  return (
    <div
      className="space-y-1.5"
      role={asGroup ? 'group' : undefined}
      aria-labelledby={asGroup ? labelId : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        {heading}
        {action}
      </div>
      {children}
      {helper || readout ? (
        <div className="flex items-baseline justify-between gap-3">
          {helper ? <p className="text-2xs leading-4 text-faint">{helper}</p> : <span />}
          {readout ? <p className="tnum whitespace-nowrap text-2xs font-medium text-sub">{readout}</p> : null}
        </div>
      ) : null}
      {note ? <p className="text-2xs leading-4 text-warn">{note}</p> : null}
      {error ? (
        <p role="alert" className="text-2xs leading-4 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
