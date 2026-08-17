'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  calculateEsopPool,
  isEsopEngineError,
  type EsopInputs,
  type FundingRound,
  type OpeningGrantCohortInput,
} from '@/lib/esop';
import { CtaBand } from './layout/CtaBand';
import { Footer } from './layout/Footer';
import { Header } from './layout/Header';
import { Hero } from './layout/Hero';
import { MobileSummaryBar } from './layout/MobileSummaryBar';
import { InputRail } from './inputs/InputRail';
import type { EsopGroupKey } from './inputs/InputCard';
import { IncompleteResultPlaceholder } from './results/IncompleteResultPlaceholder';
import { LeadModal, type Lead } from './results/LeadModal';
import { ReportCharts } from './results/ReportCharts';
import { ResultsPanel } from './results/ResultsPanel';
import { requiredFieldPaths } from './lib/completeness';
import { generateAndDownloadReport, postLead } from './lib/downloadReport';
import { buildSeedInputs } from './lib/seedInputs';
import { ThemeProvider } from './lib/theme';

/**
 * Two frames, so a freshly mounted `ResponsiveContainer` has measured itself
 * before `captureChart` reads a bounding box off it.
 *
 * Raced against a timer, because `requestAnimationFrame` is paused in a
 * background tab: a founder who starts the download and switches tabs would
 * otherwise sit on "Preparing report…" until they came back. Losing the two
 * frames costs at worst a chart that captures as null, and `captureChart`
 * already returns null rather than throwing — a report with three charts
 * beats no report at all.
 */
const PAINT_TIMEOUT_MS = 400;

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    requestAnimationFrame(() => requestAnimationFrame(done));
    window.setTimeout(done, PAINT_TIMEOUT_MS);
  });
}

function EsopPoolSizeApp() {
  const [inputs, setInputs] = useState<EsopInputs>(() => buildSeedInputs());
  const [modalOpen, setModalOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const reportChartsRef = useRef<HTMLDivElement>(null);

  /**
   * Every field starts blank (PROJECT.md decision D7). `inputs` itself is
   * never blank — the engine takes a total `EsopInputs` (M33) — so what is
   * blank is the *display*: a path not yet in `touched` renders empty, and
   * the result stays hidden until every path `requiredFieldPaths` currently
   * names is in this set. See lib/touched.ts and lib/completeness.ts.
   */
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * Layout only (see PROJECT.md). Captured here, not in a `useLayoutEffect`
   * keyed on the state change, because by the time any effect for that commit
   * runs React has already mutated the DOM — there is no later point at which
   * "before" is still measurable. An event handler is the only place that
   * still sees the pre-update layout, so the field just committed is measured
   * here, synchronously, before `setTouched` schedules the re-render that may
   * move it (the empty-to-resolved layout switch, or just its own reflow).
   *
   * Reliable for every click-driven control (radio, toggle, segmented,
   * select) since focus does not move until something else claims it.
   * Best-effort only for `NumberField`'s blur-commit, where which element
   * `document.activeElement` names during the blur handler is not something
   * every browser agrees on — not solved here, since fixing it needs a DOM
   * node threaded through every field type, well past a layout-only pass.
   */
  const pendingScrollAnchor = useRef<{ readonly el: HTMLElement; readonly top: number } | null>(null);
  const markTouched = useCallback((path: string) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      pendingScrollAnchor.current = { el: active, top: active.getBoundingClientRect().top };
    }
    setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
  }, []);

  /** Runs after every commit; a no-op except the one right after a touch that
   *  moved the anchored element, so the field the founder is looking at holds
   *  its screen position through both the state-A-to-B layout switch and any
   *  smaller reflow (a note appearing, a helper line wrapping). */
  useLayoutEffect(() => {
    const anchor = pendingScrollAnchor.current;
    pendingScrollAnchor.current = null;
    if (!anchor || !anchor.el.isConnected) return;
    const delta = anchor.el.getBoundingClientRect().top - anchor.top;
    if (delta) window.scrollBy(0, delta);
  });

  const setGroup = useCallback(<K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } as EsopInputs[K] }));
  }, []);

  const setOpeningGrants = useCallback((openingGrants: readonly OpeningGrantCohortInput[]) => {
    setInputs((prev) => ({ ...prev, openingGrants }));
  }, []);

  const setRounds = useCallback((rounds: readonly FundingRound[]) => {
    setInputs((prev) => ({ ...prev, rounds }));
  }, []);

  const required = useMemo(() => requiredFieldPaths(inputs), [inputs]);
  const requiredPaths = useMemo(() => new Set(required), [required]);
  const filledCount = useMemo(() => required.filter((path) => touched.has(path)).length, [required, touched]);
  const complete = filledCount === required.length;

  const outcome = useMemo(() => {
    try {
      return { ok: true as const, result: calculateEsopPool(inputs) };
    } catch (error) {
      if (isEsopEngineError(error)) {
        return { ok: false as const, message: error.message };
      }
      throw error;
    }
  }, [inputs]);

  /**
   * Layout state, latched. `complete` and `outcome.ok` are the one existing
   * source of truth for "is there an answer" — this adds no second list of
   * field names, it only remembers that the answer was once reached. Once a
   * founder has seen a result the page never collapses back to the empty,
   * form-only layout: reopening a requirement (recycling turned on after the
   * fact, say) keeps the results panel mounted with a note on what still
   * needs entering, rather than replacing it with the empty state.
   *
   * `outcome.ok` alone, without `complete`, would let the layout switch the
   * moment the seeded, untouched `inputs` happens to price — which is every
   * render, since `EsopInputs` is total (M33) and the engine never sees a
   * hole. `complete` is what "an answer the founder actually asked for" means
   * here.
   *
   * Set during render rather than in an effect: an extra render before the
   * switch takes effect would be the one place a stale grid briefly shows a
   * result that has already arrived, which is worse than the additional
   * render this guarded set avoids. `NumberField` already syncs to an
   * external value change the same way.
   */
  const [reachedResults, setReachedResults] = useState(false);
  if (complete && outcome.ok && !reachedResults) {
    setReachedResults(true);
  }
  const showResults = reachedResults;

  /**
   * The lead goes first, and its failure cannot reach the founder: `postLead`
   * swallows errors and gives up after a timeout, so a blocked, down or
   * hanging endpoint costs a lead record and never the report.
   *
   * The report's own failure is different and must be shown. Without the catch
   * the promise rejects into nothing — `void` at both call sites — and the
   * founder watches the button settle back to "Download report" with no file
   * and no reason.
   *
   * `capturing` mounts the off-screen chart tree for the length of the
   * download. Since [023] the visible charts live in tab panels and three of
   * the four are unmounted at any moment, so the report scrapes that tree
   * rather than the screen.
   */
  async function runDownload(forLead: Lead, isNewLead: boolean) {
    if (!outcome.ok || busy) return;

    setBusy(true);
    setCapturing(true);
    setDownloadError(null);
    try {
      if (isNewLead) await postLead(forLead);
      await nextPaint();

      await generateAndDownloadReport({
        inputs,
        result: outcome.result,
        lead: forLead,
        chartsRoot: reportChartsRef.current,
      });
      setLead(forLead);
      setModalOpen(false);
    } catch {
      setDownloadError('The PDF could not be generated. Your results on screen are unaffected — try again.');
    } finally {
      setCapturing(false);
      setBusy(false);
    }
  }

  function onDownload() {
    if (lead) {
      void runDownload(lead, false);
      return;
    }
    setModalOpen(true);
  }

  /** `setLead` moved into `runDownload`, on success only: committing it here
   * made a failed download look like a captured lead, so the retry silently
   * skipped both the modal and the POST. */
  function onSubmitLead(submitted: Lead) {
    void runDownload(submitted, true);
  }

  function onReset() {
    setInputs(buildSeedInputs());
    setTouched(new Set());
    setReachedResults(false);
  }

  const rail = (
    <InputRail
      inputs={inputs}
      setGroup={setGroup}
      openingGrants={inputs.openingGrants}
      setOpeningGrants={setOpeningGrants}
      rounds={inputs.rounds}
      setRounds={setRounds}
      touched={touched}
      markTouched={markTouched}
      requiredPaths={requiredPaths}
      onReset={onReset}
    />
  );

  return (
    <div className="min-h-screen w-full bg-surface">
      <a
        href="#main"
        className="sr-only rounded border border-strong bg-raised px-3 py-2 text-eyebrow text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50"
      >
        Skip to the calculator
      </a>
      <Header />
      <Hero />
      {/*
       * Two layouts, not one grid with a placeholder in its second column.
       * Empty: a single centered column, the form filling the page, nothing
       * reserved for an answer that doesn't exist yet. Resolved: today's rail
       * plus sticky results, latched by `showResults` so a reopened
       * requirement doesn't collapse the page back to empty under the
       * founder's cursor — see the `reachedResults` comment above.
       */}
      <main
        id="main"
        className={`mx-auto px-5 pb-28 lg:pb-10 ${showResults ? 'max-w-page' : 'max-w-[680px]'}`}
      >
        {showResults ? (
          <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            {/* `top-4`/`100vh-32px`, not the old `68px`/`100vh-88px`: those
                cleared a sticky header (Header.tsx) that no longer persists
                — see the comment there. Sticking the rail near the viewport
                top on its own still holds while the founder scrolls the
                results column. */}
            <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto lg:pr-1">
              {rail}
            </div>
            <div className="min-w-0 animate-fade-in space-y-4">
              {outcome.ok ? (
                <ResultsPanel
                  inputs={inputs}
                  result={outcome.result}
                  onLoadScenario={setInputs}
                  onDownload={onDownload}
                  reportReady={!busy}
                  downloadError={downloadError}
                  incompleteCount={complete ? 0 : required.length - filledCount}
                />
              ) : (
                <div role="alert" className="rounded-lg border border-warn bg-warn-soft p-4 text-eyebrow text-warn">
                  This plan can’t be priced yet: {outcome.message}
                </div>
              )}
              <CtaBand />
            </div>
          </div>
        ) : (
          <div className="mt-3 min-w-0 space-y-4">
            {rail}
            <IncompleteResultPlaceholder />
            <CtaBand />
          </div>
        )}
      </main>
      <Footer />
      {showResults && outcome.ok ? (
        <MobileSummaryBar
          recommended={outcome.result.recommended}
          current={outcome.result.current}
          selected={outcome.result.recommendedPool.selected}
        />
      ) : null}
      <LeadModal
        open={modalOpen}
        stage={inputs.company.stage}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmitLead}
      />
      {capturing && outcome.ok ? <ReportCharts ref={reportChartsRef} result={outcome.result} /> : null}
    </div>
  );
}

export function EsopPoolSizeClient() {
  return (
    <ThemeProvider>
      <EsopPoolSizeApp />
    </ThemeProvider>
  );
}
