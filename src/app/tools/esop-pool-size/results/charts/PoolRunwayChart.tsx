'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PoolPlanSeries } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';
import { paletteFor } from '../../lib/chartTheme';
import { formatIndianCompact, formatSignedShares } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';
import { tooltipStyle } from './tooltip';

interface PoolRunwayChartProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
}

export function PoolRunwayChart({ recommended, current }: PoolRunwayChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);
  const animate = !usePrefersReducedMotion();

  const data = current.years.map((y, i) => ({
    name: `Y${y.year + 1}`,
    newHires: Math.round(y.newHireGrants),
    refresh: Math.round(y.refreshGrants),
    returned: Math.round(y.returnedToPool),
    availableCurrent: Math.round(y.closingAvailable),
    availableRecommended: Math.round(recommended.years[i]?.closingAvailable ?? 0),
  }));

  const hasExistingPool = current.openingPoolOptions > 0;
  const exhaustYear =
    current.exhaustion.exhausted && current.exhaustion.monthIndex !== null
      ? `Y${Math.min(current.years.length, Math.floor(current.exhaustion.monthIndex / 12) + 1)}`
      : null;

  /** Defect fix: a founder holding no pool at all should read "no pool yet",
   * never a month number — "Month 0" is technically correct but reads like a
   * bug, the same reason the headline names this state instead of dating it. */
  const exhaustionLabel = !hasExistingPool
    ? 'No pool exists yet — there is nothing to run down'
    : exhaustYear
      ? `Current pool exhausted — Month ${current.exhaustion.monthIndex}`
      : null;

  return (
    <ChartFrame
      id="pool-runway"
      title="Pool runway — your current pool"
      caption="Options, per year. The recommended pool's available balance is the reference line."
      keys={[
        { label: 'New hires', color: p.accent },
        { label: 'Refreshes', color: p.accentSoft },
        { label: 'Returned', color: p.returned },
        { label: 'Available (current)', color: p.neutral },
        { label: 'Available (recommended)', color: p.accent },
      ]}
      dataTable={{
        headers: ['Year', 'New hires', 'Refreshes', 'Returned', 'Available (current)', 'Available (recommended)'],
        rows: data.map((d) => [d.name, d.newHires, d.refresh, d.returned, d.availableCurrent, d.availableRecommended]),
      }}
    >
      {exhaustionLabel ? (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded border border-warn bg-warn-soft px-2 py-1 text-2xs font-medium text-warn">
          {exhaustionLabel}
        </p>
      ) : null}
      <div className="mt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={44}
              tickFormatter={(v: number) => formatIndianCompact(v)}
            />
            <Tooltip {...tooltipStyle(p)} formatter={(value) => formatSignedShares(Number(value))} />
            <Bar
              dataKey="newHires"
              name="New hires"
              stackId="1"
              fill={p.accent}
              radius={[0, 0, 0, 0]}
              isAnimationActive={animate}
            />
            <Bar
              dataKey="refresh"
              name="Refreshes"
              stackId="1"
              fill={p.accentSoft}
              radius={[3, 3, 0, 0]}
              isAnimationActive={animate}
            />
            <Area
              type="monotone"
              dataKey="returned"
              name="Returned"
              stackId="2"
              stroke={p.returned}
              fill={p.returned}
              fillOpacity={0.35}
              isAnimationActive={animate}
            />
            <Line
              type="monotone"
              dataKey="availableCurrent"
              name="Available (current)"
              stroke={p.neutral}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={animate}
            />
            <Line
              type="monotone"
              dataKey="availableRecommended"
              name="Available (recommended)"
              stroke={p.accent}
              strokeWidth={2}
              dot={false}
              isAnimationActive={animate}
            />
            {exhaustYear ? <ReferenceLine x={exhaustYear} stroke={p.warn} strokeDasharray="3 3" /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
