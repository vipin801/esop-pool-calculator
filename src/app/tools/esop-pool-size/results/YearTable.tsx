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

function rowsFor(years: readonly RollForwardYear[]): (string | number)[][] {
  return years.map((y) => [
    `Y${y.year + 1}`,
    crores(y.valuation, 1),
    formatIndian(y.pricePerShare, 2),
    formatShares(y.hires),
    formatShares(y.newHireGrants),
    formatShares(y.refreshGrants),
    formatShares(y.returnedToPool),
    formatSignedShares(y.closingAvailable),
    formatPct(y.fullyDilutedShares > 0 ? (y.closingAvailable / y.fullyDilutedShares) * 100 : 0, 2),
  ]);
}

function SeriesTable({ series }: { readonly series: PoolPlanSeries }) {
  const rows = rowsFor(series.years);

  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <h3 className="text-eyebrow font-semibold text-ink">
          {series.label === 'recommended' ? 'Recommended pool' : 'Your current pool'}
        </h3>
        <CopyCsvButton headers={HEADERS} rows={rows} />
      </div>
      <p className="px-3 pb-2 text-2xs leading-4 text-faint">{series.description}</p>
      <div className="overflow-auto px-3 pb-3">
        <table className="w-full border-collapse text-2xs">
          <thead className="sticky top-0 z-10 bg-muted">
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
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`tnum whitespace-nowrap px-3 py-2 ${
                      ci === 0 ? 'font-medium text-ink' : 'text-right text-sub'
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
    <div className="space-y-3">
      <SeriesTable series={recommended} />
      <SeriesTable series={current} />
    </div>
  );
}
