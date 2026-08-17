import type { ReactNode } from 'react';
import type { EsopResult, GrantBasisKind, StrikePolicyKind } from '@/lib/esop';
import { Abbr } from '../ui/Abbr';
import { displayPoolPct, formatPct, formatShares, lakhCrore, monthLabel } from '../lib/format';

const GRANT_BASIS_LABEL: Record<GrantBasisKind, string> = {
  percentOfEquity: 'percent-of-equity',
  rupeeValue: 'rupee-value',
};

const STRIKE_LABEL: Record<StrikePolicyKind, string> = {
  faceValue: 'face value',
  lastRoundPrice: 'the last round price',
  discountToFMV: 'a discount to fair market value',
};

interface HeadlineProps {
  readonly result: EsopResult;
  /** The page's one primary action, on the headline's own row to keep the
   * pinned zone short enough that the tab panel below it fits a 900px screen. */
  readonly action?: ReactNode;
}

/**
 * The zone that never moves.
 *
 * The pool percentage, the option count behind it, the grant basis and strike
 * policy that produced it, and both exhaustion lines sit above the tab strip
 * and stay there whichever tab is open. The grant basis and strike policy
 * being here rather than in a tab is what satisfies the PROJECT.md
 * prohibition structurally: no tab can show a pool percentage without them,
 * because they are never off screen.
 */
export function Headline({ result, action }: HeadlineProps) {
  const { recommendedPool, recommended, current, poolCostToFounders } = result;
  const hasExistingPool = current.openingPoolOptions > 0;
  const topUpLabel = hasExistingPool ? 'Top-up needed' : 'Pool to create';

  const totalPlannedHires = recommended.years.reduce((sum, y) => sum + y.hires, 0);

  const recommendedRunway =
    !recommended.exhaustion.exhausted || recommended.exhaustion.monthIndex === null
      ? 'lasts the full horizon.'
      : `runs out in ${monthLabel(recommended.exhaustion.monthIndex)}.`;

  const currentRunway = !hasExistingPool
    ? 'no pool exists yet, so it supports nothing.'
    : !current.exhaustion.exhausted || current.exhaustion.monthIndex === null
      ? 'lasts the full horizon.'
      : `runs out in ${monthLabel(current.exhaustion.monthIndex)}.`;

  const offeredOutcome = poolCostToFounders
    ? poolCostToFounders.asOffered === 'preMoney'
      ? poolCostToFounders.preMoneyPool
      : poolCostToFounders.postMoneyPool
    : null;

  const costStat = offeredOutcome
    ? {
        label: 'Cost to founders at the next round',
        value: lakhCrore(offeredOutcome.founderDilutionCostRupees),
        helper: `${offeredOutcome.founderDilutionFromPoolPctPoints.toFixed(2)} percentage points of founder dilution.`,
      }
    : {
        label: 'Value of the pool created today',
        value: lakhCrore(recommendedPool.selected.poolOptions * (recommended.years[0]?.pricePerShare ?? 0)),
        helper: 'At today’s price per share. Model a round for the cost at the next round.',
      };

  return (
    <div className="space-y-3">
      {/*
        The percentage and the option count must describe one pool. Both come
        off `recommended`, the run's own opening pool. `PoolSizing`'s figures
        are the *top-up* (section 4.5 nets the existing pool off K), so pairing
        that percentage with this count reads 3.0% beside 6,72,995 options for
        a company already holding 4,00,000 — AUDIT_P4 defect 2, in the UI.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p className="tnum text-[38px] font-semibold leading-none tracking-tight text-ink">
            {formatPct(displayPoolPct(recommended.openingPoolPctOfFullyDiluted))}
          </p>
          <p className="text-small text-sub">of fully diluted, recommended</p>
        </div>
        {action}
      </div>

      <p className="tnum text-eyebrow leading-5 text-sub">
        {formatShares(recommended.openingPoolOptions)} options, under{' '}
        {GRANT_BASIS_LABEL[recommendedPool.selected.grantBasisKind]} grants struck at{' '}
        {STRIKE_LABEL[recommendedPool.selected.strikePolicyKind]}.
      </p>

      <div className="space-y-1 rounded border border-border bg-muted px-3 py-2">
        <p className="tnum text-eyebrow leading-5 text-ink">
          <span className="font-semibold">Recommended pool</span> — {recommendedRunway}
        </p>
        <p className="tnum text-eyebrow leading-5 text-ink">
          <span className="font-semibold">Your current pool</span>
          {hasExistingPool ? ` (${formatPct(current.openingPoolPctOfFullyDiluted)} of fully diluted)` : ''} —{' '}
          {currentRunway}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3">
        <div className="bg-raised px-3 py-2">
          <dt className="text-2xs text-faint">{topUpLabel}</dt>
          <dd className="tnum mt-0.5 text-body font-semibold leading-6 text-ink">
            {formatShares(recommendedPool.selected.poolOptions)}
            <span className="ml-1.5 text-2xs font-normal text-faint">
              {formatPct(recommendedPool.selected.displayPoolPctOfFullyDiluted)} of <Abbr short="FD" long="fully diluted" />
            </span>
          </dd>
          <p className="mt-0.5 text-2xs leading-4 text-faint">
            {hasExistingPool
              ? `On top of the ${formatShares(current.openingPoolOptions)} you already hold.`
              : 'You hold no unallocated pool today.'}
          </p>
        </div>
        <div className="bg-raised px-3 py-2">
          <dt className="text-2xs text-faint">Hires your current pool supports</dt>
          <dd className="tnum mt-0.5 text-body font-semibold leading-6 text-ink">
            {formatShares(current.exhaustion.hiresSupported)} of {formatShares(totalPlannedHires)}
          </dd>
          <p className="mt-0.5 text-2xs leading-4 text-faint">From the unallocated pool you hold right now.</p>
        </div>
        <div className="bg-raised px-3 py-2">
          <dt className="text-2xs text-faint">{costStat.label}</dt>
          <dd className="tnum mt-0.5 text-body font-semibold leading-6 text-ink">{costStat.value}</dd>
          <p className="mt-0.5 text-2xs leading-4 text-faint">{costStat.helper}</p>
        </div>
      </dl>
    </div>
  );
}
