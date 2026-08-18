'use client';

import { useEffect, useState } from 'react';
import type { EsopInputs, EsopResult } from '@/lib/esop';
import { Button } from '../ui/Button';
import { BenchmarkStrip } from './BenchmarkStrip';
import { CapTablePanel } from './CapTablePanel';
import { ComplianceChecks } from './ComplianceChecks';
import { FundingRoundImpact } from './FundingRoundImpact';
import { GrantCostChart } from './charts/GrantCostChart';
import { Headline } from './Headline';
import { HiresSupportedChart } from './charts/HiresSupportedChart';
import { HowCalculated } from './HowCalculated';
import { MedianEmployeeValue } from './MedianEmployeeValue';
import { OwnershipImpact } from './OwnershipImpact';
import { PoolPctChart } from './charts/PoolPctChart';
import { PoolRunwayChart } from './charts/PoolRunwayChart';
import { RunwayTimeline } from './RunwayTimeline';
import { ScenarioStrip } from './ScenarioStrip';
import { WhyThisNumber } from './WhyThisNumber';
import { YearTable } from './YearTable';
import { formatIndian } from '../lib/format';

interface ResultsPanelProps {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly onLoadScenario: (inputs: EsopInputs) => void;
  readonly onDownload: () => void;
  readonly onReviewAssumptions?: () => void;
  readonly reportReady: boolean;
  readonly downloadError: string | null;
  /** Threaded straight to `WhyThisNumber` — see its own prop doc for why it
   *  needs this and nothing else on this panel does. */
  readonly touched?: ReadonlySet<string>;
  /**
   * Set once a result has been shown and a later choice reopens a
   * requirement (recycling turned on after the form was already complete,
   * say). The panel stays mounted rather than reverting to the empty state —
   * this is the note that tells the founder the number below no longer
   * reflects everything they've selected. Omit or pass `0` for the ordinary
   * case.
   */
  readonly incompleteCount?: number;
}

const NAV_SECTIONS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'why-this-number', label: 'Why' },
  { id: 'runway', label: 'Runway' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'year-by-year', label: 'Year by year' },
  { id: 'cap-table', label: 'Cap table' },
  { id: 'compliance', label: 'Compliance' },
];

const NAV_IDS = NAV_SECTIONS.map((s) => s.id);

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** design.md §12: `aria-current` on the anchor nav's in-view section, tracked
 *  via IntersectionObserver rather than a scroll handler. The negative top
 *  margin matches the sticky nav's own height so a section counts as "in
 *  view" once it clears the bar, not merely once any pixel of it is visible. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0]!.target.id);
      },
      { rootMargin: '-52px 0px -70% 0px', threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function hiringEconomicsTakeaway(result: EsopResult): string | null {
  if (result.recommendedPool.selected.grantBasisKind !== 'rupeeValue') return null;
  const first = result.recommended.years[0];
  const last = result.recommended.years[result.recommended.years.length - 1];
  if (!first?.denominator || !last?.denominator || first.denominator <= 0 || last.denominator <= 0) return null;
  const tenLakh = 1_000_000;
  const firstOptions = Math.round(tenLakh / first.denominator);
  const lastOptions = Math.round(tenLakh / last.denominator);
  if (lastOptions >= firstOptions) return null;
  const pctFewer = Math.round((1 - lastOptions / firstOptions) * 100);
  return `The same ₹10,00,000 grant buys ${formatIndian(firstOptions)} options in year 1 and ${formatIndian(lastOptions)} by the final year — ${pctFewer}% fewer, as the price compounds.`;
}

/**
 * design.md §5. One continuous report, not six isolated tab panels — the
 * whole reason for this rebuild is that a founder should read "why this
 * number" next to "here's the runway" in one scroll, per the brief's own
 * complaint about the tab strip this replaces. `ResultTabs.tsx` is retired
 * (kept on disk until Phase 12's cleanup pass, per the working order's own
 * "clean up obsolete UI only after the new flow is working").
 */
export function ResultsPanel({
  inputs,
  result,
  onLoadScenario,
  onDownload,
  onReviewAssumptions,
  reportReady,
  downloadError,
  touched,
  incompleteCount = 0,
}: ResultsPanelProps) {
  const takeaway = hiringEconomicsTakeaway(result);
  const activeSection = useActiveSection(NAV_IDS);

  return (
    <article id="result" className="scroll-mt-[64px] rounded-lg border border-border bg-surface shadow-panel">
      <div className="space-y-2.5 border-b border-border p-4">
        <h2 className="sr-only">Your ESOP pool</h2>

        <Headline
          inputs={inputs}
          result={result}
          onReviewAssumptions={onReviewAssumptions}
          action={
            <div className="flex items-center gap-2">
              {!result.solver.converged ? (
                <span className="rounded border border-warn bg-warn-soft px-1.5 py-px text-2xs text-warn">
                  Last stable value
                </span>
              ) : null}
              <Button onClick={onDownload} disabled={!reportReady} size="sm">
                {reportReady ? 'Download report' : 'Preparing report…'}
              </Button>
            </div>
          }
        />

        {downloadError ? (
          <p role="alert" className="text-2xs leading-4 text-danger">
            {downloadError}
          </p>
        ) : null}

        {incompleteCount > 0 ? (
          <p role="status" className="text-2xs leading-4 text-warn">
            {incompleteCount} field{incompleteCount === 1 ? '' : 's'} still need
            {incompleteCount === 1 ? 's' : ''} entering below for this number to reflect your latest choices.
          </p>
        ) : null}
      </div>

      <nav
        aria-label="Report sections"
        className="sticky top-0 z-10 flex flex-wrap gap-x-1 gap-y-1 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur-sm"
      >
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={activeSection === s.id ? 'location' : undefined}
            onClick={() => scrollToSection(s.id)}
            className={`rounded px-2 py-1 text-2xs font-medium transition-colors duration-150 hover:text-ink ${
              activeSection === s.id ? 'bg-muted text-ink' : 'text-sub'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="space-y-4 p-3">
        <div id="why-this-number">
          <WhyThisNumber inputs={inputs} onDownload={onDownload} reportReady={reportReady} touched={touched} />
        </div>

        <ScenarioStrip inputs={inputs} baseResult={result} onLoad={onLoadScenario} />

        <section id="runway" className="scroll-mt-[52px] space-y-3">
          <h3 className="text-eyebrow font-semibold text-ink">Current pool &amp; runway</h3>
          <div className="rounded-lg border border-border bg-raised p-4">
            <RunwayTimeline current={result.current} horizonYears={inputs.hiring.horizonYears} />
          </div>
          <PoolRunwayChart recommended={result.recommended} current={result.current} locked />
          <PoolPctChart recommended={result.recommended} current={result.current} locked />
        </section>

        <section id="hiring" className="scroll-mt-[52px] space-y-3">
          <h3 className="text-eyebrow font-semibold text-ink">Hiring coverage</h3>
          <HiresSupportedChart recommended={result.recommended} current={result.current} locked />

          <h3 className="text-eyebrow font-semibold text-ink">Hiring economics</h3>
          <GrantCostChart
            years={result.recommended.years}
            grantBasisKind={result.recommendedPool.selected.grantBasisKind}
            locked
          />
          {takeaway ? (
            <p className="rounded border border-border bg-muted px-3 py-2 text-2xs leading-4 text-sub">{takeaway}</p>
          ) : null}
        </section>

        <section id="benchmarks" className="scroll-mt-[52px]">
          <BenchmarkStrip benchmarkComparison={result.benchmarkComparison} />
        </section>

        <section id="year-by-year" className="scroll-mt-[52px] space-y-3">
          <h3 className="text-eyebrow font-semibold text-ink">Year by year</h3>
          <YearTable recommended={result.recommended} current={result.current} />
        </section>

        <section id="cap-table" className="scroll-mt-[52px] space-y-3">
          <h3 className="text-eyebrow font-semibold text-ink">Cap table</h3>
          <OwnershipImpact capTables={result.capTables} />
          <CapTablePanel capTables={result.capTables} />
        </section>

        <FundingRoundImpact result={result} onModelRound={onReviewAssumptions} />

        <section className="space-y-3">
          <h3 className="text-eyebrow font-semibold text-ink">Employee economics</h3>
          <MedianEmployeeValue value={result.medianEmployeeValue} />
        </section>

        <section id="compliance" className="scroll-mt-[52px]">
          <ComplianceChecks checks={result.complianceChecks} />
        </section>

        <HowCalculated solver={result.solver} />
      </div>
    </article>
  );
}
