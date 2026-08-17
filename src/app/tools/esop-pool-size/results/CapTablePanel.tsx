import type { CapTable, CapTableRow, CapTableSet } from '@/lib/esop';
import { CopyCsvButton } from './CopyCsvButton';
import { formatPct, formatShares } from '../lib/format';

/** `CapTableHolder` itself is not part of the frozen engine surface (index.ts);
 * `CapTableRow['holder']` is the same union, reached through an exported type. */
type Holder = CapTableRow['holder'];

const HOLDER_LABEL: Record<Holder, string> = {
  founders: 'Founders',
  investors: 'Investors',
  grantedOptions: 'Granted options',
  unallocatedPool: 'Unallocated pool',
  exercisedShares: 'Exercised shares',
};

const HEADERS = ['Holder', 'Shares', '% of fully diluted'];

function OneCapTable({ table }: { readonly table: CapTable }) {
  const rows: (string | number)[][] = [
    ...table.rows.map((row) => [HOLDER_LABEL[row.holder], formatShares(row.shares), formatPct(row.pctOfFullyDiluted, 2)]),
    ['Total', formatShares(table.total.shares), formatPct(table.total.pctOfFullyDiluted, 2)],
  ];

  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <h3 className="text-eyebrow font-semibold text-ink">{table.label}</h3>
        <CopyCsvButton headers={HEADERS} rows={rows} />
      </div>
      <div className="overflow-auto px-3 pb-3">
        <table className="w-full border-collapse text-2xs">
          <thead className="bg-muted">
            <tr>
              {HEADERS.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`border-b border-border px-3 py-2 font-medium text-sub ${
                    i === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isTotal = ri === rows.length - 1;
              return (
                <tr key={ri} className={`border-b border-border last:border-0 ${isTotal ? 'bg-muted' : ''}`}>
                  <td className={`px-3 py-2 ${isTotal ? 'font-semibold text-ink' : 'text-ink'}`}>{row[0]}</td>
                  <td className="tnum px-3 py-2 text-right text-sub">{row[1]}</td>
                  <td className={`tnum px-3 py-2 text-right ${isTotal ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                    {row[2]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CapTablePanelProps {
  readonly capTables: CapTableSet;
}

export function CapTablePanel({ capTables }: CapTablePanelProps) {
  return (
    <div className="space-y-3">
      <OneCapTable table={capTables.before} />
      <OneCapTable table={capTables.after} />
      {capTables.afterModelledRound ? (
        <OneCapTable table={capTables.afterModelledRound} />
      ) : (
        <p className="rounded-lg border border-border bg-raised px-3 py-3 text-2xs leading-4 text-faint">
          Model a funding round in the company card to see the cap table after it closes.
        </p>
      )}
      <p className="text-2xs leading-4 text-faint">
        Founder and investor split is an editable estimate. All tables are struck as at today.
      </p>
    </div>
  );
}
