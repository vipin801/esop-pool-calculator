import type { PoolPlanSeries, RollForwardYear } from '@/lib/esop';
import { Collapsible } from '../ui/Collapsible';
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
  'Pool % of FD',
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
    <div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="text-[13px] font-semibold text-ink">
          {series.label === 'recommended' ? 'Recommended pool' : 'Your current pool'}
        </p>
        <CopyCsvButton headers={HEADERS} rows={rows} />
      </div>
      <p className="px-4 pb-2 text-2xs leading-4 text-faint">{series.description}</p>
      <div className="max-h-[280px] overflow-auto px-4 pb-3">
        <table className="w-full border-collapse text-2xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {HEADERS.map((h, i) => (
                <th
                  key={h}
                  className={`whitespace-nowrap border-b border-border px-3 py-2 font-medium text-sub ${
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
    <Collapsible title="Year-by-year roll-forward" defaultOpen>
      <div className="divide-y divide-border">
        <SeriesTable series={recommended} />
        <SeriesTable series={current} />
      </div>
    </Collapsible>
  );
}
