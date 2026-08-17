'use client';

import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GrantBasisKind, RollForwardYear } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';
import { paletteFor } from '../../lib/chartTheme';
import { formatIndian, formatIndianCompact } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';
import { tooltipStyle } from './tooltip';

interface GrantCostChartProps {
  readonly years: readonly RollForwardYear[];
  readonly grantBasisKind: GrantBasisKind;
}

const TEN_LAKH = 1_000_000;

/** Both axes and the tooltip are Indian-grouped. Recharts prints the raw
 * number when no formatter is given, which is how this chart was showing
 * ungrouped counts beside axes that were grouped. */
function valueText(value: unknown, name: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return name === 'Valuation (₹ crore)' ? `₹${formatIndian(n, 1)} crore` : formatIndian(n);
}

export function GrantCostChart({ years, grantBasisKind }: GrantCostChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);
  const animate = !usePrefersReducedMotion();
  const isRupeeValue = grantBasisKind === 'rupeeValue';

  const data = years.map((y) => ({
    name: `Y${y.year + 1}`,
    valuationCr: Math.round((y.valuation / 10_000_000) * 10) / 10,
    optionsPer10L: y.denominator && y.denominator > 0 ? Math.round(TEN_LAKH / y.denominator) : null,
  }));

  if (!isRupeeValue) {
    return (
      <ChartFrame
        id="grant-cost"
        title="Valuation over the plan"
        caption="Grants are a fixed percent of equity here, so a rupee grant cost does not apply."
        keys={[{ label: 'Valuation (₹ crore)', color: p.neutral }]}
        dataTable={{ headers: ['Year', 'Valuation (₹ crore)'], rows: data.map((d) => [d.name, d.valuationCr]) }}
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
                width={40}
                tickFormatter={(v: number) => formatIndian(v)}
              />
              <Tooltip {...tooltipStyle(p)} formatter={(value, name) => valueText(value, name)} />
              <Line
                type="monotone"
                dataKey="valuationCr"
                name="Valuation (₹ crore)"
                stroke={p.neutral}
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      id="grant-cost"
      title="The same rupee grant buys fewer options every year"
      caption="Valuation (left) against options a fixed ₹10,00,000 grant buys (right), at the selected value basis."
      keys={[
        { label: 'Valuation (₹ crore)', color: p.neutral },
        { label: 'Options per ₹10,00,000', color: p.accent },
      ]}
      dataTable={{
        headers: ['Year', 'Valuation (₹ crore)', 'Options per ₹10,00,000'],
        rows: data.map((d) => [d.name, d.valuationCr, d.optionsPer10L ?? 'Not priced on this basis']),
      }}
    >
      <div className="mt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              tickFormatter={(v: number) => formatIndian(v)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={44}
              tickFormatter={(v: number) => formatIndianCompact(v)}
            />
            <Tooltip {...tooltipStyle(p)} formatter={(value, name) => valueText(value, name)} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="valuationCr"
              name="Valuation (₹ crore)"
              stroke={p.neutral}
              strokeWidth={2}
              dot={false}
              isAnimationActive={animate}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="optionsPer10L"
              name="Options per ₹10,00,000"
              stroke={p.accent}
              strokeWidth={2}
              dot={{ r: 2, fill: p.accent }}
              connectNulls
              isAnimationActive={animate}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
