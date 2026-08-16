import type { ReactNode } from 'react';
import { EstimateMarker } from './EstimateMarker';

interface FieldProps {
  readonly label: string;
  readonly htmlFor?: string;
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
  helper,
  readout,
  estimate,
  error,
  note,
  action,
  children,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
          {estimate ? <EstimateMarker /> : null}
        </label>
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
