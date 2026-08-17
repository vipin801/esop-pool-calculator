import type { ChartPalette } from '../../lib/chartTheme';

/**
 * One tooltip shell for all four charts.
 *
 * It exists so that a chart cannot be added without a `formatter`: every
 * caller spreads this and then supplies its own, and a Recharts tooltip left
 * with no formatter prints the raw number — no grouping at all, which is the
 * one place the Indian convention was quietly not being applied.
 */
export function tooltipStyle(p: ChartPalette) {
  return {
    contentStyle: {
      background: p.surface,
      border: `1px solid ${p.axis}`,
      borderRadius: 8,
      fontSize: 12,
      color: p.text,
    },
    labelStyle: { color: p.text },
    itemStyle: { color: p.text },
    cursor: { fill: p.grid, fillOpacity: 0.4 },
  } as const;
}
