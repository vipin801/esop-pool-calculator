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
      <section className="rounded-lg border border-border bg-raised p-5">
        <h3 className="text-small font-medium tracking-tight text-ink">Raising soon?</h3>
        <p className="mt-2 text-eyebrow leading-5 text-sub">
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
    <section className="rounded-lg border border-border bg-raised p-5">
      <h3 className="text-small font-medium tracking-tight text-ink">Funding round impact</h3>
      <p className="mt-2 text-2xs leading-4 text-faint">
        Investor asks for {formatPct(topUp.investorRequiredPostRoundPoolPct)} of the company post-round; your
        existing pool would otherwise land at {formatPct(topUp.existingPoolPostRoundPct)}.
      </p>
      {/* A hairline pair, not two filled tiles: the two figures are the same
          measurement taken two ways, and the rule between them says so. */}
      <dl className="mt-5 grid grid-cols-1 border-t border-border sm:grid-cols-2">
        <div className="border-b border-border py-4 sm:border-r sm:pr-6">
          <dt className="section-label text-faint">Pool created pre-money</dt>
          <dd className="number-display mt-3 text-ink">
            {lakhCrore(preMoneyPool.founderDilutionCostRupees)}
          </dd>
          <p className="mt-2 text-2xs text-faint">{preMoneyPool.founderDilutionFromPoolPctPoints.toFixed(2)} pp to founders.</p>
        </div>
        <div className="border-b border-border py-4 sm:pl-6">
          <dt className="section-label text-faint">Pool created post-money</dt>
          <dd className="number-display mt-3 text-ink">
            {lakhCrore(postMoneyPool.founderDilutionCostRupees)}
          </dd>
          <p className="mt-2 text-2xs text-faint">{postMoneyPool.founderDilutionFromPoolPctPoints.toFixed(2)} pp to founders.</p>
        </div>
      </dl>
      <p className="mt-4 text-2xs leading-4 text-sub">
        The difference, in rupees: {lakhCrore(Math.abs(deltaRupees))} ({Math.abs(deltaPctPoints).toFixed(2)} pp) —
        that&apos;s what timing the pool the other way is worth to founders.
      </p>
    </section>
  );
}
