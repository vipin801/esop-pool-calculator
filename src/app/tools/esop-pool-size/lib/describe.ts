import type { PoolPlanSeries } from '@/lib/esop';
import { formatShares, monthLabel } from './format';

/** Shared, honest phrasing for "how long does the current pool last" — the
 * degenerate zero-pool case is named explicitly rather than defaulting to
 * "Month 0", per the labelling defect this build fixes. */
export function currentPoolRunwayLabel(current: PoolPlanSeries): string {
  if (current.openingPoolOptions <= 0) return 'No pool yet';
  if (!current.exhaustion.exhausted || current.exhaustion.monthIndex === null) return 'Lasts the horizon';
  return `Ends ${monthLabel(current.exhaustion.monthIndex)}`;
}

export function hiresSupportedLabel(current: PoolPlanSeries, totalPlannedHires: number): string {
  return `${formatShares(current.exhaustion.hiresSupported)} of ${formatShares(totalPlannedHires)}`;
}
