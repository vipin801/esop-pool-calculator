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

/**
 * The founders/investors split on every cap table here — `before` and
 * `after` alike — is priced off `company.founderOwnershipPctOfFullyDiluted`,
 * a `reportOnly` field (D9): an invented company fact with a seeded example
 * value, not a founder-entered one, until section 07 is filled in. Free on
 * `before` because "today" is asserted, not modelled; gated on `after`
 * because that table is where the recommended pool's dilution — a modelled
 * outcome — reads as fact if the split beneath it never was one.
 *
 * The column headers are real — `Holder`/`Shares`/`% of fully diluted` name
 * no company or figure, so they cost nothing to show, and a bare set of
 * grey bars with no structure at all read as broken rather than locked. Only
 * the body is a placeholder: one `aria-hidden`, `overflow-hidden`-clipped
 * bar, not a row per holder, so nothing about *how many* rows or what they
 * are leaks either. No CSV export, unlike `OneCapTable` — a locked table
 * offers no download of the numbers it isn't showing. The only way past any
 * of this is the same lead-gated report download every other locked surface
 * already sits behind.
 */
function LockedCapTable({ label }: { readonly label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-raised">
      <div className="px-3 pt-3">
        <h3 className="text-eyebrow font-semibold text-ink">{label}</h3>
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
        </table>
        <div className="mt-2" aria-hidden="true">
          <div className="h-16 rounded bg-border blur-[1.5px]" />
        </div>
      </div>
      <span className="sr-only">The rows are locked until you download the full report.</span>
    </div>
  );
}

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
      <LockedCapTable label={capTables.after.label} />
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
