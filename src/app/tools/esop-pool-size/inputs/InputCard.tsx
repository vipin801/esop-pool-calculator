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
  /** Dot paths the founder has entered a value for. See lib/touched.ts. */
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  /** Dot paths withholding the result until entered. See lib/completeness.ts. */
  readonly requiredPaths: ReadonlySet<string>;
}

interface InputCardProps {
  readonly index: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function InputCard({ index, title, children }: InputCardProps) {
  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
        {/* The index is a figure, so it takes the figure face — and the accent,
            because a numbered step is the one place a rail label earns it. */}
        <span className="figure text-2xs text-accent">{index}</span>
        <h3 className="text-small font-medium tracking-tight text-ink">{title}</h3>
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </div>
  );
}
