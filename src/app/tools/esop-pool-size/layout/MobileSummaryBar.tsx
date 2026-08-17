import type { GrantBasisKind, PoolPlanSeries, PoolSizing, StrikePolicyKind } from '@/lib/esop';
import { Abbr } from '../ui/Abbr';
import { currentPoolRunwayLabel } from '../lib/describe';
import { displayPoolPct, formatPct } from '../lib/format';

const GRANT_BASIS_SHORT: Record<GrantBasisKind, string> = {
  percentOfEquity: '% of equity',
  rupeeValue: 'rupee value',
};

const STRIKE_SHORT: Record<StrikePolicyKind, string> = {
  faceValue: 'face value',
  lastRoundPrice: 'last round price',
  discountToFMV: 'discount to FMV',
};

interface MobileSummaryBarProps {
  readonly recommended: PoolPlanSeries;
  readonly current: PoolPlanSeries;
  readonly selected: PoolSizing;
}

/**
 * Two fixes over the [021] bar, both of them defects rather than polish.
 *
 * The percentage is put through `displayPoolPct`, so the bar and the headline
 * cannot print one pool at two roundings — the bar read 6.6% under a headline
 * reading 7.0%.
 *
 * And the grant basis and strike policy are printed here. PROJECT.md forbids
 * a pool percentage appearing without them on the same screen; on a phone the
 * headline scrolls away and this bar does not, so the bar was the one surface
 * where the prohibition could actually be broken.
 */
export function MobileSummaryBar({ recommended, current, selected }: MobileSummaryBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 border-t border-strong bg-surface px-5 py-2 lg:hidden">
      <div className="min-w-0">
        <p className="tnum text-[17px] font-semibold leading-6 text-ink">
          {formatPct(displayPoolPct(recommended.openingPoolPctOfFullyDiluted))}{' '}
          <span className="text-2xs font-normal text-faint">
            of <Abbr short="FD" long="fully diluted" />
          </span>
        </p>
        <p className="truncate text-2xs leading-4 text-faint">
          {GRANT_BASIS_SHORT[selected.grantBasisKind]} grants at {STRIKE_SHORT[selected.strikePolicyKind]}
        </p>
      </div>
      <p className="tnum max-w-[45%] shrink-0 text-right text-2xs leading-4 text-sub">
        Current pool: {currentPoolRunwayLabel(current)}
      </p>
    </div>
  );
}
