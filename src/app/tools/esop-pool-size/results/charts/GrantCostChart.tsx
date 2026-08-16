'use client';

import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GrantBasisKind, RollForwardYear } from '@/lib/esop';
import { useTheme } from '../../lib/theme';
import { paletteFor } from '../../lib/chartTheme';
import { formatIndian } from '../../lib/format';
import { ChartFrame } from '../ChartFrame';

interface GrantCostChartProps {
  readonly years: readonly RollForwardYear[];
  readonly grantBasisKind: GrantBasisKind;
}

const TEN_LAKH = 1_000_000;

export function GrantCostChart({ years, grantBasisKind }: GrantCostChartProps) {
  const { theme } = useTheme();
  const p = paletteFor(theme);
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
        caption="Grants are a fixed percent of equity under this basis, so a rupee grant cost doesn't apply — switch the grant basis to rupee value to see it."
        keys={[{ label: 'Valuation (₹ crore)', color: p.neutral }]}
        dataTable={{ headers: ['Year', 'Valuation (₹ crore)'], rows: data.map((d) => [d.name, d.valuationCr]) }}
      >
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={54} tickFormatter={(v: number) => formatIndian(v)} />
              <Tooltip contentStyle={{ background: p.surface, border: `1px solid ${p.grid}`, borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="valuationCr" name="Valuation (₹ crore)" stroke={p.neutral} strokeWidth={2} dot={false} />
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
      caption="Valuation (left) versus options a fixed ₹10,00,000 grant buys (right), at the grant policy's selected value basis."
      keys={[
        { label: 'Valuation (₹ crore)', color: p.neutral },
        { label: 'Options per ₹10,00,000', color: p.accent },
      ]}
      dataTable={{
        headers: ['Year', 'Valuation (₹ crore)', 'Options per ₹10,00,000'],
        rows: data.map((d) => [d.name, d.valuationCr, d.optionsPer10L ?? 'n/a']),
      }}
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={54}
              tickFormatter={(v: number) => formatIndian(v)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={54}
              tickFormatter={(v: number) => formatIndian(v)}
            />
            <Tooltip contentStyle={{ background: p.surface, border: `1px solid ${p.grid}`, borderRadius: 8, fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="valuationCr" name="Valuation (₹ crore)" stroke={p.neutral} strokeWidth={2} dot={false} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="optionsPer10L"
              name="Options per ₹10,00,000"
              stroke={p.accent}
              strokeWidth={2}
              dot={{ r: 2, fill: p.accent }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
