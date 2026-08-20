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
  /** design.md §6.3: opens the same model editor as the desktop sticky
   *  panel, in a full-screen sheet — the "View / edit model" action. */
  readonly onOpenModel: () => void;
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
 *
 * A `<button>`, not an `<a href="#result">`: a hash link jumps instantly and
 * changes the URL, `scrollIntoView` animates (or snaps, under reduced
 * motion, since the browser itself honours that preference) without one.
 * Left unstyled by `ui/Button.tsx` on purpose — `ui-quality.test.ts` asserts
 * exactly one primary-styled button in the whole route, the download button.
 */
export function MobileSummaryBar({ recommended, current, selected, onOpenModel }: MobileSummaryBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex w-full items-stretch gap-3 border-t border-border bg-surface px-4 py-3 shadow-panel lg:hidden">
      <button
        type="button"
        onClick={() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="figure-display text-h4 leading-6 text-ink">
            {formatPct(displayPoolPct(recommended.openingPoolPctOfFullyDiluted))}{' '}
            <span className="font-sans text-2xs font-normal text-faint">
              of <Abbr short="FD" long="fully diluted" />
            </span>
          </p>
          <p className="truncate text-2xs leading-4 text-faint">
            {GRANT_BASIS_SHORT[selected.grantBasisKind]} grants at {STRIKE_SHORT[selected.strikePolicyKind]}
          </p>
        </div>
        <p className="max-w-[45%] shrink-0 text-right text-2xs leading-4 text-sub">
          Current pool: {currentPoolRunwayLabel(current)}
        </p>
      </button>
      <button
        type="button"
        onClick={onOpenModel}
        className="shrink-0 self-center rounded border border-strong px-3 py-2 text-2xs font-medium text-sub transition-colors duration-150 hover:border-ink hover:text-ink"
      >
        Edit model
      </button>
    </div>
  );
}
