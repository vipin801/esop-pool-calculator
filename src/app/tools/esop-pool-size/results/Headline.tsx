import type { ReactNode } from 'react';
import type { EsopInputs, EsopResult, GrantBasisKind, StrikePolicyKind } from '@/lib/esop';
import { Abbr } from '../ui/Abbr';
import { Button } from '../ui/Button';
import { displayPoolPct, formatPct, formatShares, lakhCrore, monthLabel } from '../lib/format';
import { heroStateFor, isAboveAdvisoryCeiling, likelyDrivers } from '../lib/heroState';

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
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  /** The page's one primary action, on the headline's own row to keep the
   * pinned zone short enough that the tab panel below it fits a 900px screen. */
  readonly action?: ReactNode;
  /** design.md §5.1's extreme state: opens `Your model`, scrolled/focused to
   *  the assumptions that produced this figure. */
  readonly onReviewAssumptions?: () => void;
}

/**
 * design.md §5.1. Four states over the same underlying figures, not four
 * different calculations: `normal` (today's layout), `adequate` (the
 * existing pool already covers the plan), `extreme` (the solver did not
 * converge — the spec's own signal for "no practical answer in range", not
 * a separate ">100%" check the engine does not surface), plus a soft-warning
 * callout on `normal` when the answer is unusually far above the advisory
 * ceiling without actually failing to converge.
 *
 * 2026-08-19: this is the instrument face. The answer is set in IBM Plex Mono
 * 300 at the document's stat size — the design system puts financial figures
 * in the mono face, and at 48–80px that is the one element on the page that
 * outranks the H1. Everything under it is hairline-ruled rather than boxed:
 * a stat tile with its own border and its own fill reads as three cards, and
 * three cards read as three unrelated facts.
 */
export function Headline({ inputs, result, action, onReviewAssumptions }: HeadlineProps) {
  const state = heroStateFor(result);
  if (state === 'extreme') {
    return <ExtremeHeadline inputs={inputs} result={result} action={action} onReviewAssumptions={onReviewAssumptions} />;
  }

  const { recommendedPool, recommended, current, poolCostToFounders } = result;
  const hasExistingPool = current.openingPoolOptions > 0;
  const topUpLabel = state === 'adequate' ? 'Your pool already covers this plan' : hasExistingPool ? 'Top-up needed' : 'Pool to create';
  const softWarning = state === 'normal' && isAboveAdvisoryCeiling(result);

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
    <div className="space-y-6">
      {/*
        The percentage and the option count must describe one pool. Both come
        off `recommended`, the run's own opening pool. `PoolSizing`'s figures
        are the *top-up* (section 4.5 nets the existing pool off K), so pairing
        that percentage with this count reads 3.0% beside 6,72,995 options for
        a company already holding 4,00,000 — AUDIT_P4 defect 2, in the UI.
      */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="section-label text-accent">Recommended pool</p>
          <p className="number-large mt-4 text-ink">
            {formatPct(displayPoolPct(recommended.openingPoolPctOfFullyDiluted))}
          </p>
          <p className="mt-2 text-small text-sub">of fully diluted</p>
        </div>
        <div className="shrink-0 pt-1">{action}</div>
      </div>

      <p className="border-t border-border pt-4 text-eyebrow leading-5 text-sub">
        <span className="figure text-ink">{formatShares(recommended.openingPoolOptions)}</span> options, under{' '}
        {GRANT_BASIS_LABEL[recommendedPool.selected.grantBasisKind]} grants struck at{' '}
        {STRIKE_LABEL[recommendedPool.selected.strikePolicyKind]}.
      </p>

      {softWarning ? (
        <p className="rounded border-l-2 border-warn bg-warn-soft px-3 py-2 text-2xs leading-4 text-warn">
          Well above the advisory benchmark for your stage. Not an error — a converged answer is never
          wrong, but worth a second look.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
        <div className="border-b border-border py-4 sm:border-r sm:pr-6">
          <dt className="section-label text-faint">Recommended pool</dt>
          <dd className="mt-2 text-eyebrow leading-5 text-ink">{recommendedRunway}</dd>
        </div>
        <div className="border-b border-border py-4 sm:pl-6">
          <dt className="section-label text-faint">
            Your current pool
            {hasExistingPool ? ` · ${formatPct(current.openingPoolPctOfFullyDiluted)} of FD` : ''}
          </dt>
          <dd className="mt-2 text-eyebrow leading-5 text-ink">{currentRunway}</dd>
        </div>
      </dl>

      {/*
        Three facts on one hairline grid, not three bordered tiles: the rules
        between them carry the grouping, and the figures carry the weight.
      */}
      <dl className="grid grid-cols-1 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-0">
        <div className="sm:border-r sm:border-border sm:pr-6">
          <dt className="section-label text-faint">{topUpLabel}</dt>
          <dd className="number-display mt-3 text-ink">
            {formatShares(recommendedPool.selected.poolOptions)}
          </dd>
          <p className="mt-1.5 text-2xs leading-4 text-sub">
            {formatPct(recommendedPool.selected.displayPoolPctOfFullyDiluted)} of{' '}
            <Abbr short="FD" long="fully diluted" />
          </p>
          <p className="mt-2 text-2xs leading-4 text-faint">
            {state === 'adequate'
              ? `Your ${formatShares(current.openingPoolOptions)} already covers the plan — nothing new to reserve.`
              : hasExistingPool
                ? `On top of the ${formatShares(current.openingPoolOptions)} you already hold.`
                : 'You hold no unallocated pool today.'}
          </p>
        </div>
        <div className="sm:border-r sm:border-border sm:pr-6">
          <dt className="section-label text-faint">Hires your current pool supports</dt>
          <dd className="number-display mt-3 text-ink">
            {formatShares(current.exhaustion.hiresSupported)}
            <span className="text-sub"> / {formatShares(totalPlannedHires)}</span>
          </dd>
          <p className="mt-2 text-2xs leading-4 text-faint">From the unallocated pool you hold right now.</p>
        </div>
        <div>
          <dt className="section-label text-faint">{costStat.label}</dt>
          <dd className="number-display mt-3 text-ink">{costStat.value}</dd>
          <p className="mt-2 text-2xs leading-4 text-faint">{costStat.helper}</p>
        </div>
      </dl>
    </div>
  );
}

/**
 * design.md §5.1/master brief §19. The engine's own last-stable iterate is
 * never hidden — it's the number shown, labelled as a mathematical stopping
 * point rather than a practical recommendation, per the brief's own required
 * distinction. No clamping, no invented ceiling: `solver.converged === false`
 * is the one signal this state reads.
 */
function ExtremeHeadline({
  inputs,
  result,
  action,
  onReviewAssumptions,
}: {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly action?: ReactNode;
  readonly onReviewAssumptions?: () => void;
}) {
  const drivers = likelyDrivers(inputs);

  return (
    <div className="space-y-4 rounded border-l-2 border-danger bg-danger-soft p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <p className="heading-section max-w-[24ch] text-ink">
          Your assumptions don&apos;t produce a practical ESOP pool
        </p>
        {action}
      </div>
      <p className="text-eyebrow leading-5 text-sub">
        The current model needs more equity than is practical for an ESOP pool. Nothing was clamped;
        this is exactly where the model stopped.
      </p>
      <div className="border-t border-border pt-3">
        <p className="section-label text-faint">Model requirement, not a recommendation</p>
        <p className="number-display mt-2 text-danger">
          &gt; {formatPct(displayPoolPct(result.recommended.openingPoolPctOfFullyDiluted))} of fully diluted
        </p>
      </div>
      {drivers.length > 0 ? (
        <div className="border-t border-border pt-3">
          <p className="section-label text-faint">Likely drivers</p>
          <ul className="mt-2 list-inside list-disc text-2xs leading-5 text-sub">
            {drivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-2xs leading-4 text-sub">Review your model before using this result.</p>
      {onReviewAssumptions ? (
        <Button size="sm" variant="secondary" onClick={onReviewAssumptions}>
          Review assumptions
        </Button>
      ) : null}
    </div>
  );
}
