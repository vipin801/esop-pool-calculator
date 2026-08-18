import type { ReactNode } from 'react';
import { formatIndian } from '../lib/format';

interface ChartKey {
  readonly label: string;
  readonly color: string;
}

interface DataTable {
  readonly headers: readonly string[];
  readonly rows: readonly (string | number)[][];
}

interface ChartFrameProps {
  readonly title: string;
  readonly caption?: string;
  readonly keys?: readonly ChartKey[];
  readonly dataTable: DataTable;
  readonly children: ReactNode;
  readonly id: string;
  /**
   * PROJECT.md D15: on screen, every chart is locked behind the report
   * download — only the heading stays free. `false` by default and left
   * unset by `ReportCharts.tsx`'s off-screen instances, which capture the
   * real chart for the PDF the download itself produces; setting this
   * `true` there would lock the very thing downloading is supposed to
   * unlock. Hides `keys`, `children`, `caption` and the sr-only data table
   * alike — a legend naming "New hires"/"Refreshes" is as much a locked
   * value as the numbers are, per the founder's own instruction to keep
   * only the heading.
   */
  readonly locked?: boolean;
}

/**
 * Numbers reaching the screen-reader table are raw, because they come from the
 * same rows the chart plots. Formatting them here rather than at every call
 * site is what stops one table from reading "153740" while the axis beside it
 * reads "1,53,740" — the grouping convention has to hold in the accessible
 * copy too, not only in the picture.
 */
function cellText(cell: string | number): string {
  return typeof cell === 'number' ? formatIndian(cell, Number.isInteger(cell) ? 0 : 2) : cell;
}

export function ChartFrame({ title, caption, keys, dataTable, children, id, locked = false }: ChartFrameProps) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-raised p-3" data-chart={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-eyebrow font-semibold text-ink">{title}</h3>
        {!locked && keys ? (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {keys.map((k) => (
              <li key={k.label} className="flex items-center gap-1.5 text-2xs text-sub">
                <span className="h-1.5 w-3 shrink-0 rounded-sm" style={{ background: k.color }} />
                {k.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {locked ? (
        <div className="relative mt-2 h-[220px] overflow-hidden rounded bg-muted" aria-hidden="true">
          <div className="absolute inset-0 bg-border blur-[3px]" />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span className="rounded border border-border bg-surface px-3 py-1.5 text-center text-2xs font-medium text-sub shadow-panel">
              Download the report to see this chart
            </span>
          </div>
        </div>
      ) : (
        <>
          {children}
          {caption ? <p className="mt-2 text-2xs leading-4 text-faint">{caption}</p> : null}
          {/*
            `sr-only` goes on a wrapping div, not on the table.
            `display: table` treats `width: 1px` as a minimum and grows to fit its
            content, so an `sr-only` table is an absolutely positioned 610px box
            that `overflow: hidden` does not clip — which pushed
            `documentElement.scrollWidth` to 655 on a 375px screen and gave the
            whole page a horizontal scrollbar. A block wrapper clips properly.
          */}
          <div className="sr-only">
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  {dataTable.headers.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataTable.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cellText(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {locked ? (
        <span className="sr-only">This chart is locked until you download the full report.</span>
      ) : null}
    </section>
  );
}
