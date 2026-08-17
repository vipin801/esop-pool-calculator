import type { ReactNode } from 'react';
import type { EsopInputs } from '@/lib/esop';

/** The nine input groups every card reads and patches. Not `rounds`/`topUps`/
 * `openingGrants`/`openingHeadcount`/`asOfDate`: this port keeps the same
 * input sections the current build has (D1/D2/D4 add controls to existing
 * cards; it does not add a funding-round editor, which the current build
 * never had either — see docs/esop/LOG.md for this session's entry). */
export type EsopGroupKey =
  | 'company'
  | 'hiring'
  | 'growth'
  | 'grantPolicy'
  | 'attrition'
  | 'exercise'
  | 'vesting'
  | 'compliance'
  | 'employeeValue';

export interface CardProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly advanced: boolean;
}

interface InputCardProps {
  readonly index: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function InputCard({ index, title, children }: InputCardProps) {
  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="tnum text-2xs font-semibold text-faint">{index}</span>
        <h3 className="text-eyebrow font-semibold text-ink">{title}</h3>
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </div>
  );
}
