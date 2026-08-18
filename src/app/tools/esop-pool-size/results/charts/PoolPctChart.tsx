'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PoolPlanSeries } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';
import { paletteFor } from '../../lib/chartTheme';
import { formatPct } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';
import { tooltipStyle } from './tooltip';

interface PoolPctChartProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
  readonly locked?: boolean;
}

function pctOfFd(closingAvailable: number, fullyDilutedShares: number): number {
  return fullyDilutedShares > 0 ? Number(((closingAvailable / fullyDilutedShares) * 100).toFixed(2)) : 0;
}

export function PoolPctChart({ recommended, current, locked = false }: PoolPctChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);
  const animate = !usePrefersReducedMotion();

  const data = recommended.years.map((y, i) => {
    const currentYear = current.years[i];
    return {
      name: `Y${y.year + 1}`,
      recommendedPct: pctOfFd(y.closingAvailable, y.fullyDilutedShares),
      currentPct: currentYear ? pctOfFd(currentYear.closingAvailable, currentYear.fullyDilutedShares) : 0,
    };
  });

  /**
   * design.md §7: the data is never clamped — `recommendedPct`/`currentPct`
   * above are the same unrounded figures the year table reads. Only the
   * *rendered range* is floored, with one annotation at the clip, rather
   * than letting the axis stretch to fit e.g. -156% and flatten every other
   * year's line into noise.
   */
  const FLOOR_PCT = -20;
  const rawMin = Math.min(0, ...data.map((d) => Math.min(d.recommendedPct, d.currentPct)));
  const domainMin = Math.max(FLOOR_PCT, rawMin);
  const isClipped = rawMin < FLOOR_PCT;

  return (
    <ChartFrame
      id="pool-pct"
      title="Available pool, % of fully diluted"
      caption="What is left in the pool as a share of the company — recommended, against the pool you hold."
      keys={[
        { label: 'Recommended pool', color: p.accent },
        { label: 'Current pool', color: p.neutral },
      ]}
      dataTable={{
        headers: ['Year', 'Recommended pool (% of fully diluted)', 'Current pool (% of fully diluted)'],
        rows: data.map((d) => [d.name, d.recommendedPct, d.currentPct]),
      }}
      locked={locked}
    >
      <div className="mt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              domain={[domainMin, 'dataMax']}
              tickFormatter={(v: number) => formatPct(v, 0)}
            />
            <Tooltip {...tooltipStyle(p)} formatter={(value) => formatPct(Number(value), 2)} />
            {isClipped ? (
              <ReferenceLine
                y={domainMin}
                stroke={p.warn}
                strokeDasharray="3 3"
                label={{ value: 'Pool exhausted — reading capped', position: 'insideBottomLeft', fontSize: 11, fill: p.warn }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="recommendedPct"
              name="Recommended pool"
              stroke={p.accent}
              strokeWidth={2}
              dot={{ r: 2, fill: p.accent }}
              isAnimationActive={animate}
            />
            <Line
              type="monotone"
              dataKey="currentPct"
              name="Current pool"
              stroke={p.neutral}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 2, fill: p.neutral }}
              isAnimationActive={animate}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
