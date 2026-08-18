import type { PoolPlanSeries } from '@/lib/esop';
import { monthLabel } from '../lib/format';

interface RunwayTimelineProps {
  readonly current: PoolPlanSeries;
  readonly horizonYears: number;
}

/**
 * design.md §5.3, the "one-glance answer" the brief's §30 asks for, sitting
 * above `PoolRunwayChart`'s detailed view rather than replacing it. A plain
 * horizontal read of the same `current.exhaustion` the chart and the
 * headline already use — no new figure.
 */
export function RunwayTimeline({ current, horizonYears }: RunwayTimelineProps) {
  const horizonMonths = horizonYears * 12;
  const hasExistingPool = current.openingPoolOptions > 0;

  if (!hasExistingPool) {
    return (
      <p className="text-2xs leading-4 text-faint">No pool exists yet, so there is nothing to run down.</p>
    );
  }

  if (!current.exhaustion.exhausted || current.exhaustion.monthIndex === null) {
    return (
      <div>
        <p className="text-eyebrow text-ink">Your current pool lasts the full plan.</p>
        <div className="mt-2 h-1.5 rounded-full bg-accent" />
        <div className="mt-1 flex justify-between text-2xs text-faint">
          <span>Today</span>
          <span>Horizon end</span>
        </div>
      </div>
    );
  }

  const monthIndex = current.exhaustion.monthIndex;
  const fraction = horizonMonths > 0 ? Math.min(1, Math.max(0, monthIndex / horizonMonths)) : 0;

  return (
    <div>
      <p className="text-eyebrow text-ink">
        Expected to run out around <span className="font-semibold">{monthLabel(monthIndex)}</span>.
      </p>
      <div className="relative mt-3 h-1.5 rounded-full bg-border">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${fraction * 100}%` }} />
        <div
          className="absolute -top-1 h-3.5 w-[3px] rounded-full bg-danger"
          style={{ left: `${fraction * 100}%` }}
          role="img"
          aria-label={`Pool exhausted at ${monthLabel(monthIndex)}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-2xs text-faint">
        <span>Today</span>
        <span className="text-danger">Pool exhausted</span>
        <span>Horizon end</span>
      </div>
    </div>
  );
}
