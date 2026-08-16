import type { ReactNode } from 'react';

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
}

export function ChartFrame({ title, caption, keys, dataTable, children, id }: ChartFrameProps) {
  return (
    <section className="rounded-lg border border-border bg-raised p-4" data-chart={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {keys ? (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {keys.map((k) => (
              <li key={k.label} className="flex items-center gap-1.5 text-2xs text-sub">
                <span className="h-1.5 w-3 rounded-sm" style={{ background: k.color }} />
                {k.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {children}
      {caption ? <p className="mt-2 text-2xs leading-4 text-faint">{caption}</p> : null}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            {dataTable.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataTable.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
