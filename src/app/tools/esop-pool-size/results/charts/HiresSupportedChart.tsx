'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PoolPlanSeries } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';
import { paletteFor } from '../../lib/chartTheme';
import { formatIndian, formatIndianCompact } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';
import { tooltipStyle } from './tooltip';

interface HiresSupportedChartProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
  readonly locked?: boolean;
}

/** Both series flatten at the engine's own `hiresSupported` scalar once the
 * cumulative plan overtakes it — never past the horizon, and never below. */
function supportedCumulative(series: PoolPlanSeries, cumulativePlanned: number): number {
  return Math.min(cumulativePlanned, series.exhaustion.hiresSupported);
}

export function HiresSupportedChart({ recommended, current, locked = false }: HiresSupportedChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);
  const animate = !usePrefersReducedMotion();

  const cumulativePlannedByYear = recommended.years.reduce<number[]>((acc, y) => {
    const previous = acc[acc.length - 1] ?? 0;
    acc.push(previous + y.hires);
    return acc;
  }, []);

  const data = recommended.years.map((y, i) => {
    const cumulativePlanned = cumulativePlannedByYear[i] ?? 0;
    return {
      name: `Y${y.year + 1}`,
      planned: Math.round(cumulativePlanned),
      recommendedSupports: Math.round(supportedCumulative(recommended, cumulativePlanned)),
      currentSupports: Math.round(supportedCumulative(current, cumulativePlanned)),
    };
  });

  return (
    <ChartFrame
      id="hires-supported"
      title="Hires supported vs planned"
      caption="Cumulative across the horizon. Where a line flattens below the bars, that pool has run out."
      keys={[
        { label: 'Planned (cumulative)', color: p.neutralSoft },
        { label: 'Recommended pool supports', color: p.accent },
        { label: 'Current pool supports', color: p.warn },
      ]}
      dataTable={{
        headers: ['Year', 'Planned (cumulative)', 'Recommended supports', 'Current supports'],
        rows: data.map((d) => [d.name, d.planned, d.recommendedSupports, d.currentSupports]),
      }}
      locked={locked}
    >
      <div className="mt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={36}
              tickFormatter={(v: number) => formatIndianCompact(v)}
            />
            <Tooltip {...tooltipStyle(p)} formatter={(value) => formatIndian(Number(value))} />
            <Bar
              dataKey="planned"
              name="Planned (cumulative)"
              fill={p.neutralSoft}
              radius={[3, 3, 0, 0]}
              isAnimationActive={animate}
            />
            <Line
              type="monotone"
              dataKey="recommendedSupports"
              name="Recommended pool supports"
              stroke={p.accent}
              strokeWidth={2}
              dot={{ r: 2, fill: p.accent }}
              isAnimationActive={animate}
            />
            <Line
              type="monotone"
              dataKey="currentSupports"
              name="Current pool supports"
              stroke={p.warn}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 2, fill: p.warn }}
              isAnimationActive={animate}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
