import type { EsopResult, GrantBasisKind, StrikePolicyKind } from '@/lib/esop';
import { EstimateMarker } from '../ui/EstimateMarker';
import { formatPct, formatShares, lakhCrore, monthLabel } from '../lib/format';

const GRANT_BASIS_LABEL: Record<GrantBasisKind, string> = {
  percentOfEquity: 'percent-of-equity',
  rupeeValue: 'rupee-value',
};

const STRIKE_LABEL: Record<StrikePolicyKind, string> = {
  faceValue: 'face value',
  lastRoundPrice: 'the last round price',
  discountToFMV: 'a discount to FMV',
};

interface HeadlineProps {
  readonly result: EsopResult;
}

export function Headline({ result }: HeadlineProps) {
  const { recommendedPool, recommended, current, solver, poolCostToFounders } = result;
  const hasExistingPool = current.openingPoolOptions > 0;
  const topUpLabel = hasExistingPool ? 'Top-up needed' : 'Pool to create';

  const totalPlannedHires = recommended.years.reduce((sum, y) => sum + y.hires, 0);

  const recommendedRunway =
    !recommended.exhaustion.exhausted || recommended.exhaustion.monthIndex === null
      ? 'lasts the full horizon.'
      : `runs out in ${monthLabel(recommended.exhaustion.monthIndex)} — the buffer is not enough on its own.`;

  const currentRunway = !hasExistingPool
    ? 'no pool exists yet, so it supports nothing until you create one.'
    : !current.exhaustion.exhausted || current.exhaustion.monthIndex === null
      ? 'lasts the full horizon.'
      : `runs out in ${monthLabel(current.exhaustion.monthIndex)}, supporting ${formatShares(
          current.exhaustion.hiresSupported,
        )} of ${formatShares(totalPlannedHires)} planned hires.`;

  const offeredOutcome = poolCostToFounders
    ? poolCostToFounders.asOffered === 'preMoney'
      ? poolCostToFounders.preMoneyPool
      : poolCostToFounders.postMoneyPool
    : null;

  const costStat = offeredOutcome
    ? {
        label: 'Cost to founders at the next round',
        value: lakhCrore(offeredOutcome.founderDilutionCostRupees),
        helper: `${offeredOutcome.founderDilutionFromPoolPctPoints.toFixed(2)} pts of dilution from the pool alone.`,
      }
    : {
        label: 'Value of the pool created today',
        value: lakhCrore(recommendedPool.selected.poolOptions * (recommended.years[0]?.pricePerShare ?? 0)),
        helper: 'At today’s price per share. Model a funding round to see the cost at the next round instead.',
      };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-faint">Recommended pool</span>
        {!solver.converged ? (
          <span className="rounded border border-warn bg-warn-soft px-1.5 py-px text-2xs text-warn">
            Last stable value
          </span>
        ) : null}
      </div>

      <p className="tnum mt-1 text-[40px] font-semibold leading-none tracking-tight text-ink">
        {formatPct(recommendedPool.selected.displayPoolPctOfFullyDiluted)}
        <span className="ml-2 text-[15px] font-normal text-sub">of fully diluted</span>
      </p>
      <p className="tnum mt-2 text-[13px] text-sub">
        {formatShares(recommended.openingPoolOptions)} options reserved, under{' '}
        {GRANT_BASIS_LABEL[recommendedPool.selected.grantBasisKind]} grants struck at{' '}
        {STRIKE_LABEL[recommendedPool.selected.strikePolicyKind]}.
      </p>

      <div className="space-y-1.5 rounded border border-border bg-muted px-3 py-2.5">
        <p className="tnum text-[13px] text-ink">
          <span className="font-semibold">Recommended pool</span> — the pool this tool recommends — {recommendedRunway}
        </p>
        <p className="tnum text-[13px] text-ink">
          <span className="font-semibold">Your current pool</span> — what you hold today
          {hasExistingPool ? ` (${formatPct(current.openingPoolPctOfFullyDiluted)} of FD)` : ' (none yet)'} — {currentRunway}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3">
        <div className="bg-raised px-3 py-3">
          <dt className="text-2xs text-faint">{topUpLabel}</dt>
          <dd className="tnum mt-1 text-[17px] font-semibold leading-6 text-ink">
            {formatShares(recommendedPool.selected.poolOptions)}
          </dd>
          <p className="mt-1 text-2xs leading-4 text-faint">
            {hasExistingPool
              ? `On top of the ${formatShares(current.openingPoolOptions)} you already hold.`
              : 'You hold no unallocated pool today.'}
          </p>
        </div>
        <div className="bg-raised px-3 py-3">
          <dt className="text-2xs text-faint">Hires your current pool supports</dt>
          <dd className="tnum mt-1 text-[17px] font-semibold leading-6 text-ink">
            {formatShares(current.exhaustion.hiresSupported)} of {formatShares(totalPlannedHires)}
          </dd>
          <p className="mt-1 text-2xs leading-4 text-faint">From the unallocated pool you hold right now.</p>
        </div>
        <div className="bg-raised px-3 py-3">
          <dt className="text-2xs text-faint">{costStat.label}</dt>
          <dd className="tnum mt-1 text-[17px] font-semibold leading-6 text-ink">{costStat.value}</dd>
          <p className="mt-1 text-2xs leading-4 text-faint">{costStat.helper}</p>
        </div>
      </div>

      <p className="text-2xs text-faint">
        Solved in {solver.iterations} iteration{solver.iterations === 1 ? '' : 's'}, rounded up to the nearest 0.5%.
        <EstimateMarker label="Model output" />
      </p>
    </div>
  );
}
