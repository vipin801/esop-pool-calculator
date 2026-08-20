import type { ReactNode } from 'react';
import type { PoolPlanSeries, RollForwardYear } from '@/lib/esop';
import { CopyCsvButton } from './CopyCsvButton';
import { crores, formatIndian, formatPct, formatShares, formatSignedShares } from '../lib/format';

const HEADERS = [
  'Year',
  'Valuation (₹ cr)',
  'Price per share (₹)',
  'Hires',
  'New grants',
  'Refresh grants',
  'Returned',
  'Closing available',
  'Pool, % of fully diluted',
];

function poolPct(y: RollForwardYear): number {
  return y.fullyDilutedShares > 0 ? (y.closingAvailable / y.fullyDilutedShares) * 100 : 0;
}

/**
 * design.md §7: the underlying value is never clamped — `poolPct` above is
 * the same unrounded figure CSV export reads. Only the *display* changes
 * once the pool has gone negative: "Exhausted" reads plainly, the raw
 * percentage (which can run to -156% and further) sits behind a `title`
 * rather than on the page, matching the master brief's "founder-facing
 * status: Exhausted, detailed value in a tooltip" instruction.
 */
function poolPctCell(y: RollForwardYear): ReactNode {
  const pct = poolPct(y);
  if (y.closingAvailable >= 0) return formatPct(pct, 2);
  return (
    <span title={`${formatPct(pct, 2)} of fully diluted`} className="cursor-help font-medium text-danger">
      Exhausted
    </span>
  );
}

function csvRowsFor(years: readonly RollForwardYear[]): (string | number)[][] {
  return years.map((y) => [
    `Y${y.year + 1}`,
    crores(y.valuation, 1),
    formatIndian(y.pricePerShare, 2),
    formatShares(y.hires),
    formatShares(y.newHireGrants),
    formatShares(y.refreshGrants),
    formatShares(y.returnedToPool),
    formatSignedShares(y.closingAvailable),
    formatPct(poolPct(y), 2),
  ]);
}

function displayRowsFor(years: readonly RollForwardYear[]): ReactNode[][] {
  return years.map((y) => [
    `Y${y.year + 1}`,
    crores(y.valuation, 1),
    formatIndian(y.pricePerShare, 2),
    formatShares(y.hires),
    formatShares(y.newHireGrants),
    formatShares(y.refreshGrants),
    formatShares(y.returnedToPool),
    formatSignedShares(y.closingAvailable),
    poolPctCell(y),
  ]);
}

function SeriesTable({ series }: { readonly series: PoolPlanSeries }) {
  const csvRows = csvRowsFor(series.years);
  const displayRows = displayRowsFor(series.years);

  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h3 className="text-small font-medium tracking-tight text-ink">
          {series.label === 'recommended' ? 'Recommended pool' : 'Your current pool'}
        </h3>
        <CopyCsvButton headers={HEADERS} rows={csvRows} />
      </div>
      <p className="px-5 pb-3 text-2xs leading-4 text-faint">{series.description}</p>
      <div className="overflow-auto px-5 pb-5">
        <table className="w-full border-collapse text-2xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {HEADERS.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`eyebrow whitespace-nowrap border-b border-border px-3 py-2.5 text-faint ${
                    i === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`figure whitespace-nowrap px-3 py-2.5 ${
                      ci === 0 ? 'text-ink' : 'text-right text-sub'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface YearTableProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
}

export function YearTable({ recommended, current }: YearTableProps) {
  return (
    <div className="space-y-4">
      <SeriesTable series={recommended} />
      <SeriesTable series={current} />
    </div>
  );
}
