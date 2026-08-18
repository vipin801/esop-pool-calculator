import type { EsopResult } from '@/lib/esop';
import { formatPct, lakhCrore } from '../lib/format';

interface FundingRoundImpactProps {
  readonly result: EsopResult;
  readonly onModelRound?: () => void;
}

/**
 * design.md §5's "Funding round impact", master brief §36: optional after
 * the core recommendation, reusing figures the engine already returns
 * (`topUpAtNextRound`, `poolCostToFounders`) rather than any new
 * calculation. Never rebuilds the Funding Round Simulator's instrument-level
 * modelling — this is the same one-round pool-shuffle preview the report
 * has always shown, just promoted onto the live screen.
 */
export function FundingRoundImpact({ result, onModelRound }: FundingRoundImpactProps) {
  if (!result.poolCostToFounders || !result.topUpAtNextRound) {
    return (
      <section className="rounded-lg border border-border bg-raised p-4">
        <h3 className="text-eyebrow font-semibold text-ink">Raising soon?</h3>
        <p className="mt-1 text-eyebrow leading-5 text-sub">
          See what topping up your pool before versus after your next round costs founders.
        </p>
        <p className="mt-2 text-2xs leading-4 text-faint">
          Model a round from <span className="font-medium text-ink">Your model → Next funding round</span>
          {onModelRound ? '.' : ' to see this section fill in.'}
        </p>
      </section>
    );
  }

  const { preMoneyPool, postMoneyPool, deltaRupees, deltaPctPoints } = result.poolCostToFounders;
  const topUp = result.topUpAtNextRound;

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <h3 className="text-eyebrow font-semibold text-ink">Funding round impact</h3>
      <p className="mt-1 text-2xs leading-4 text-faint">
        Investor asks for {formatPct(topUp.investorRequiredPostRoundPoolPct)} of the company post-round; your
        existing pool would otherwise land at {formatPct(topUp.existingPoolPostRoundPct)}.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2">
        <div className="bg-raised px-3 py-2">
          <dt className="text-2xs text-faint">Pool created pre-money</dt>
          <dd className="tnum mt-0.5 text-small font-semibold text-ink">
            {lakhCrore(preMoneyPool.founderDilutionCostRupees)}
          </dd>
          <p className="mt-0.5 text-2xs text-faint">{preMoneyPool.founderDilutionFromPoolPctPoints.toFixed(2)} pp to founders.</p>
        </div>
        <div className="bg-raised px-3 py-2">
          <dt className="text-2xs text-faint">Pool created post-money</dt>
          <dd className="tnum mt-0.5 text-small font-semibold text-ink">
            {lakhCrore(postMoneyPool.founderDilutionCostRupees)}
          </dd>
          <p className="mt-0.5 text-2xs text-faint">{postMoneyPool.founderDilutionFromPoolPctPoints.toFixed(2)} pp to founders.</p>
        </div>
      </dl>
      <p className="mt-2 text-2xs leading-4 text-sub">
        The difference, in rupees: {lakhCrore(Math.abs(deltaRupees))} ({Math.abs(deltaPctPoints).toFixed(2)} pp) —
        that&apos;s what timing the pool the other way is worth to founders.
      </p>
    </section>
  );
}
