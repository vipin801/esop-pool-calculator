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
      <div className="space-y-4 border-b border-border p-6 sm:p-8">
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

      {/*
        An underlined rail rather than a row of pills. A pill is a control; a
        section marker is a place — the 2px accent rule under the in-view
        label says where you are without adding seven boxes to a panel whose
        whole job is to stay quiet under the figures.
      */}
      <nav
        aria-label="Report sections"
        className="sticky top-0 z-10 flex flex-wrap justify-center gap-x-5 border-b border-border bg-surface/95 px-6 backdrop-blur-sm sm:px-8"
      >
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={activeSection === s.id ? 'location' : undefined}
            onClick={() => scrollToSection(s.id)}
            className={`section-label -mb-px border-b-2 py-3 transition-colors duration-150 hover:text-ink ${
              activeSection === s.id ? 'border-accent text-ink' : 'border-transparent text-faint'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/*
        §5/§7: "Use `.section-divider` between every major section — it
        provides rhythm without visual heaviness." The report is one
        continuous scroll of eight sections, so the hairline is what tells a
        reader where one ends, in place of the boxes an earlier pass used.
        `space-y-12` still owns the gap; the divider only draws the rule.
      */}
      <div className="space-y-12 p-6 [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:-top-6 [&>*+*]:before:left-0 [&>*+*]:before:right-0 [&>*+*]:before:border-t [&>*+*]:before:border-border/60 sm:p-8">
        <div id="why-this-number">
          <WhyThisNumber inputs={inputs} onDownload={onDownload} reportReady={reportReady} touched={touched} />
        </div>

        <ScenarioStrip inputs={inputs} baseResult={result} onLoad={onLoadScenario} />

        <section id="runway" className="scroll-mt-[52px] space-y-4">
          <h3 className="section-label text-accent">Current pool &amp; runway</h3>
          <div className="rounded-lg border border-border bg-raised p-5">
            <RunwayTimeline current={result.current} horizonYears={inputs.hiring.horizonYears} />
          </div>
          <PoolRunwayChart recommended={result.recommended} current={result.current} locked />
          <PoolPctChart recommended={result.recommended} current={result.current} locked />
        </section>

        <section id="hiring" className="scroll-mt-[52px] space-y-4">
          <h3 className="section-label text-accent">Hiring coverage</h3>
          <HiresSupportedChart recommended={result.recommended} current={result.current} locked />

          <h3 className="section-label text-accent">Hiring economics</h3>
          <GrantCostChart
            years={result.recommended.years}
            grantBasisKind={result.recommendedPool.selected.grantBasisKind}
            locked
          />
          {takeaway ? (
            <p className="rounded border-l-2 border-accent bg-muted px-4 py-3 text-2xs leading-5 text-sub">{takeaway}</p>
          ) : null}
        </section>

        <section id="benchmarks" className="scroll-mt-[52px]">
          <BenchmarkStrip benchmarkComparison={result.benchmarkComparison} />
        </section>

        <section id="year-by-year" className="scroll-mt-[52px] space-y-4">
          <h3 className="section-label text-accent">Year by year</h3>
          <YearTable recommended={result.recommended} current={result.current} />
        </section>

        <section id="cap-table" className="scroll-mt-[52px] space-y-4">
          <h3 className="section-label text-accent">Cap table</h3>
          <OwnershipImpact capTables={result.capTables} />
          <CapTablePanel capTables={result.capTables} />
        </section>

        <FundingRoundImpact result={result} onModelRound={onReviewAssumptions} />

        <section className="space-y-4">
          <h3 className="section-label text-accent">Employee economics</h3>
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
