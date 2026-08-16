import type { PoolExhaustion } from '@/lib/esop';
import { formatPct, monthLabel } from '../lib/format';

interface MobileSummaryBarProps {
  readonly recommendedPoolPct: number;
  readonly exhaustion: PoolExhaustion;
  readonly hasExistingPool: boolean;
}

function currentPoolLabel(exhaustion: PoolExhaustion, hasExistingPool: boolean): string {
  if (!hasExistingPool) return 'No pool yet — current pool';
  if (!exhaustion.exhausted || exhaustion.monthIndex === null) return 'Current pool lasts the horizon';
  return `Current pool ends ${monthLabel(exhaustion.monthIndex)}`;
}

export function MobileSummaryBar({
  recommendedPoolPct,
  exhaustion,
  hasExistingPool,
}: MobileSummaryBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-2.5 lg:hidden">
      <div>
        <p className="text-2xs text-faint">Recommended pool</p>
        <p className="tnum text-[17px] font-semibold leading-6 text-ink">
          {formatPct(recommendedPoolPct)} <span className="text-2xs font-normal text-faint">of FD</span>
        </p>
      </div>
      <p className="tnum max-w-[55%] text-right text-2xs leading-4 text-sub">
        {currentPoolLabel(exhaustion, hasExistingPool)}
      </p>
    </div>
  );
}
