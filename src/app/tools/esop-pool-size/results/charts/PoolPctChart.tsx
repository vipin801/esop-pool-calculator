'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PoolPlanSeries } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { paletteFor } from '../../lib/chartTheme';
import { formatIndian } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';

interface PoolPctChartProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
}

function pctOfFd(closingAvailable: number, fullyDilutedShares: number): number {
  return fullyDilutedShares > 0 ? Number(((closingAvailable / fullyDilutedShares) * 100).toFixed(2)) : 0;
}

export function PoolPctChart({ recommended, current }: PoolPctChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);

  const data = recommended.years.map((y, i) => {
    const currentYear = current.years[i];
    return {
      name: `Y${y.year + 1}`,
      recommendedPct: pctOfFd(y.closingAvailable, y.fullyDilutedShares),
      currentPct: currentYear ? pctOfFd(currentYear.closingAvailable, currentYear.fullyDilutedShares) : 0,
    };
  });

  return (
    <ChartFrame
      id="pool-pct"
      title="Available pool, % of fully diluted"
      caption="What's left in the pool, as a share of the company, each year — recommended pool vs the pool you hold today."
      keys={[
        { label: 'Recommended pool', color: p.accent },
        { label: 'Current pool', color: p.neutral },
      ]}
      dataTable={{
        headers: ['Year', 'Recommended pool (% FD)', 'Current pool (% FD)'],
        rows: data.map((d) => [d.name, d.recommendedPct, d.currentPct]),
      }}
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={(v: number) => `${formatIndian(v)}%`} />
            <Tooltip
              contentStyle={{ background: p.surface, border: `1px solid ${p.grid}`, borderRadius: 8, fontSize: 12 }}
              formatter={(value) => `${value}%`}
            />
            <Line type="monotone" dataKey="recommendedPct" name="Recommended pool" stroke={p.accent} strokeWidth={2} dot={{ r: 2, fill: p.accent }} />
            <Line
              type="monotone"
              dataKey="currentPct"
              name="Current pool"
              stroke={p.neutral}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 2, fill: p.neutral }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
