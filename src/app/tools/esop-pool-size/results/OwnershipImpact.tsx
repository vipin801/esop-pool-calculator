import type { CapTable, CapTableRow, CapTableSet } from '@/lib/esop';
import { formatPct } from '../lib/format';

/** `CapTableHolder` itself is not on the frozen public surface (index.ts);
 *  `CapTableRow['holder']` is the same union, reached through an exported
 *  type — the same workaround `CapTablePanel.tsx` already uses. */
type CapTableHolder = CapTableRow['holder'];

/**
 * `locked` marks the rows whose "After pool" and "Change" cells read the
 * founder/investor split — `company.founderOwnershipPctOfFullyDiluted`, a
 * `reportOnly` field (D9) that is an invented example fact until a founder
 * fills in section 07, exactly like `CapTablePanel.tsx`'s now-locked "after"
 * table it summarises. `unallocatedPool` stays open: that figure is the
 * recommended pool percentage itself, already the free headline number
 * (D3) — locking a restatement of it here while it sits large and unlocked
 * above would hide nothing and confuse everything.
 */
const ROWS: readonly { readonly holder: CapTableHolder; readonly label: string; readonly locked: boolean }[] = [
  { holder: 'founders', label: 'Founders', locked: true },
  { holder: 'investors', label: 'Investors', locked: true },
  { holder: 'unallocatedPool', label: 'Pool', locked: false },
];

function pctFor(table: CapTable, holder: CapTableHolder): number {
  return table.rows.find((r) => r.holder === holder)?.pctOfFullyDiluted ?? 0;
}

interface OwnershipImpactProps {
  readonly capTables: CapTableSet;
}

/**
 * design.md §5.4. A display transform over `capTables.before`/`.after` —
 * both already returned by the engine, so this computes nothing the roll
 * forward hasn't already priced. Sits above the detailed cap tables
 * `CapTablePanel` renders below, per the brief's own instruction to keep the
 * detailed tables and add a summary above them, not replace them — though
 * the "after" table is now one of the locked ones (PROJECT.md), so this
 * summary's own founders/investors "After pool"/"Change" cells are locked
 * the same way, for the same reason: see `ROWS` above.
 */
export function OwnershipImpact({ capTables }: OwnershipImpactProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-raised">
      <table className="w-full border-collapse text-2xs">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="eyebrow border-b border-border px-4 py-3 text-left text-faint">
              Ownership impact
            </th>
            <th scope="col" className="eyebrow border-b border-border px-4 py-3 text-right text-faint">
              Today
            </th>
            <th scope="col" className="eyebrow border-b border-border px-4 py-3 text-right text-faint">
              After pool
            </th>
            <th scope="col" className="eyebrow border-b border-border px-4 py-3 text-right text-faint">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ holder, label, locked }) => {
            const before = pctFor(capTables.before, holder);
            const after = pctFor(capTables.after, holder);
            const change = after - before;
            const sign = change > 0 ? '+' : '';
            return (
              <tr key={holder} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{label}</td>
                <td className="figure px-4 py-2.5 text-right text-sub">{formatPct(before, 1)}</td>
                {locked ? (
                  <td className="px-4 py-2.5 text-right" aria-hidden="true">
                    <span className="ml-auto inline-block h-3 w-10 rounded bg-border blur-[1.5px]" />
                  </td>
                ) : (
                  <td className="figure px-4 py-2.5 text-right text-ink">{formatPct(after, 1)}</td>
                )}
                {locked ? (
                  <td className="px-4 py-2.5 text-right" aria-hidden="true">
                    <span className="ml-auto inline-block h-3 w-10 rounded bg-border blur-[1.5px]" />
                  </td>
                ) : (
                  <td className={`figure px-4 py-2.5 text-right ${change === 0 ? 'text-sub' : 'text-accent'}`}>
                    {sign}
                    {change.toFixed(1)} pp
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <span className="sr-only">
        The founders' and investors' after-pool percentages and change are locked until you
        download the full report.
      </span>
    </div>
  );
}
