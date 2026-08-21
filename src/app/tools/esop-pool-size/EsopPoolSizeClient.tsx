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
import { HelpLinksBand } from './layout/HelpLinksBand';
import { Hero } from './layout/Hero';
import { MobileSummaryBar } from './layout/MobileSummaryBar';
import { ModelPanel } from './layout/ModelPanel';
import { OnboardingWizard } from './layout/onboarding/OnboardingWizard';
import { DEFAULT_HIRING_META, type HiringMeta } from './layout/onboarding/ScreenHiring';
import { DEFAULT_GRANT_META, type GrantMeta } from './layout/onboarding/ScreenGrants';
import type { EsopGroupKey } from './inputs/InputCard';
import { LeadModal, type Lead } from './results/LeadModal';
import { ReportCharts } from './results/ReportCharts';
import { ResultsPanel } from './results/ResultsPanel';
import { Sheet } from './ui/Sheet';
import { requiredFieldPaths } from './lib/completeness';
import { generateAndDownloadReport, postLead } from './lib/downloadReport';
import { countChangedFields } from './lib/inputDiff';
import { buildSeedInputs } from './lib/seedInputs';
import { ThemeProvider } from './lib/theme';
import { useIsDesktop } from './lib/useIsDesktop';

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
   * Required fields start blank (D7, narrowed by D9 §5 — a `minor` field shows
   * the default it is using instead). `inputs` itself is never blank — the
   * engine takes a total `EsopInputs` (M33) — so what is blank is the
   * *display*, and the result stays hidden until every path
   * `requiredFieldPaths` currently names is in this set. See lib/touched.ts
   * and lib/completeness.ts.
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

  /** Bulk variant for a derived array of paths (design.md §4.3's hiring-plan
   *  translation touches every `hiring.hiresPerYear.*` path at once). No
   *  scroll anchoring — this fires as a side effect of one field's change,
   *  not a direct focus interaction. */
  const markManyTouched = useCallback((paths: readonly string[]) => {
    setTouched((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const path of paths) {
        if (!next.has(path)) {
          next.add(path);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /** design.md §4.2/§4.4: UI-only state behind the onboarding screens'
   *  simple questions (total hires, timing, team profile, leadership hires,
   *  grant philosophy). Lifted here, not local to the wizard, because §6.1
   *  requires the same values to be re-editable from `Your model` later
   *  without desyncing from the per-year array the engine actually reads. */
  const [hiringMeta, setHiringMeta] = useState<HiringMeta>(DEFAULT_HIRING_META);
  const [grantMeta, setGrantMeta] = useState<GrantMeta>(DEFAULT_GRANT_META);

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

  /**
   * design.md §6.2. `inputs` stays the *applied* state the engine reads;
   * `draftInputs` is a working copy, created from `inputs` the moment a
   * founder edits anything inside `Your model`, and is what the panel reads
   * and writes to instead. Recalculate promotes it to `inputs` (which is what
   * actually re-triggers `calculateEsopPool`, via the unchanged `outcome`
   * memo above); Discard drops it. The onboarding wizard is unaffected — it
   * still writes straight to `inputs` via `setGroup`, since D7's per-screen
   * gate is exactly the immediate feedback a draft step would blunt.
   */
  const [draftInputs, setDraftInputsState] = useState<EsopInputs | null>(null);
  const modelInputs = draftInputs ?? inputs;
  const isDirty = draftInputs !== null;
  const changeCount = isDirty ? countChangedFields(inputs, draftInputs) : 0;

  const setDraftGroup = useCallback(<K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => {
    setDraftInputsState((prevDraft) => {
      const base = prevDraft ?? inputs;
      return { ...base, [key]: { ...base[key], ...patch } as EsopInputs[K] };
    });
  }, [inputs]);

  const setDraftOpeningGrants = useCallback((openingGrants: readonly OpeningGrantCohortInput[]) => {
    setDraftInputsState((prevDraft) => ({ ...(prevDraft ?? inputs), openingGrants }));
  }, [inputs]);

  const setDraftRounds = useCallback((rounds: readonly FundingRound[]) => {
    setDraftInputsState((prevDraft) => ({ ...(prevDraft ?? inputs), rounds }));
  }, [inputs]);

  function onDiscardDraft() {
    setDraftInputsState(null);
  }

  function onRecalculate() {
    if (!draftInputs) return;
    setInputs(draftInputs);
    setDraftInputsState(null);
  }

  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const isDesktop = useIsDesktop();

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
  /**
   * design.md §3, D10. Unlike the one-page form this replaces, reaching
   * results is no longer automatic the instant the last required field is
   * touched — it is the explicit "Calculate pool" click at the end of the
   * onboarding wizard (`onCalculate` below), which is D7's gate evaluated
   * once at the end of three screens rather than continuously across one.
   * Once set, nothing here ever reads it back to false except Reset — a
   * requirement reopened from `Your model` after this point keeps the
   * results workspace mounted, per the paragraph above.
   */
  const [reachedResults, setReachedResults] = useState(false);
  const showResults = reachedResults;
  const readyToCalculate = complete && outcome.ok;

  function onCalculate() {
    if (readyToCalculate) setReachedResults(true);
  }

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
    setHiringMeta(DEFAULT_HIRING_META);
    setGrantMeta(DEFAULT_GRANT_META);
    setDraftInputsState(null);
    setModelSheetOpen(false);
  }

  const modelPanel = (
    <ModelPanel
      modelInputs={modelInputs}
      setDraftGroup={setDraftGroup}
      openingGrants={modelInputs.openingGrants}
      setDraftOpeningGrants={setDraftOpeningGrants}
      rounds={modelInputs.rounds}
      setDraftRounds={setDraftRounds}
      touched={touched}
      markTouched={markTouched}
      markManyTouched={markManyTouched}
      requiredPaths={requiredPaths}
      hiringMeta={hiringMeta}
      setHiringMeta={setHiringMeta}
      grantMeta={grantMeta}
      setGrantMeta={setGrantMeta}
      isDirty={isDirty}
      changeCount={changeCount}
      onDiscard={onDiscardDraft}
      onRecalculate={onRecalculate}
      onReset={onReset}
    />
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-bg">
      <a
        href="#main"
        className="sr-only rounded border border-strong bg-surface px-3 py-2 text-eyebrow text-ink shadow-panel focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50"
      >
        Skip to the calculator
      </a>
      <Header />
      {/*
       * The design system's page-edge scan lines run down this container, not
       * the viewport: they mark the *content* edge, which is what makes them
       * read as infrastructure framing the work rather than as a border on
       * the window. Header and footer sit outside it, so the lines start and
       * stop with the page's own body. See globals.css for the two-layer
       * hairline-plus-pulse construction.
       */}
      <div className="page-edge-lines mx-auto w-full max-w-page flex-1">
        {showResults ? <Hero variant="banner" /> : null}
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
          className={`mx-auto max-w-page px-6 pb-32 lg:px-16 lg:pb-20`}
        >
          {showResults ? (
            // The rail stays at 360px and the gutter at 24px: the report
            // column carries a nine-column year table, and every pixel this
            // side takes is a column that scrolls out of view over there.
            <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
              {/* `top-4`/`100vh-32px`, not the old `68px`/`100vh-88px`: those
                  cleared a sticky header (Header.tsx) that no longer persists
                  — see the comment there. Sticking the rail near the viewport
                  top on its own still holds while the founder scrolls the
                  results column. */}
              {/* design.md §6.3: below `lg` the full model panel is not shown
                  inline — only the mobile summary bar's "Edit model" action,
                  opening the same panel in a sheet (below). `isDesktop` (JS,
                  not just CSS) keeps the two mutually exclusive: mounting both
                  at once would put two copies of every field id in the DOM. */}
              <div id="your-model" className="hidden min-w-0 lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto lg:pr-1">
                {isDesktop ? modelPanel : null}
              </div>
              <div className="min-w-0 animate-fade-in space-y-8">
                {outcome.ok ? (
                  <ResultsPanel
                    inputs={inputs}
                    result={outcome.result}
                    onLoadScenario={setInputs}
                    onDownload={onDownload}
                    onReviewAssumptions={() => {
                      document.getElementById('your-model')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setModelSheetOpen(true);
                    }}
                    reportReady={!busy}
                    downloadError={downloadError}
                    touched={touched}
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
            /*
             * Two columns before there is an answer: the masthead and the
             * Tabulate pitch hold a left rail, the form opens to the right.
             *
             * The split starts at `xl`, not `lg`. At 1024px the container has
             * 896px of content, and a 420px rail would leave the form 432px —
             * narrower than the 720px single column it replaces, which is a
             * worse form, not a better layout. Below `xl` the rail simply
             * stacks above the form, which is the layout this replaces.
             *
             * The rail sticks: the form is three screens tall and the pitch
             * under the masthead is the one thing that should stay in view
             * while a founder works down it.
             */
            <div className="mx-auto grid min-w-0 max-w-[720px] gap-12 pt-10 xl:max-w-none xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:gap-16 xl:pt-14">
              <div className="min-w-0 xl:sticky xl:top-10 xl:self-start">
                <Hero />
                {/* The pitch only joins the masthead once there is a rail to
                    join it in. Below `xl` the two would stack between the
                    heading and the form, pushing the first field off screen —
                    so there it stays where it was, under the form, as the
                    centered band. */}
                <div className="mt-10 hidden xl:block">
                  <CtaBand variant="aside" />
                </div>
              </div>
              <div className="min-w-0 space-y-16">
                <OnboardingWizard
                  inputs={inputs}
                  setGroup={setGroup}
                  openingGrants={inputs.openingGrants}
                  setOpeningGrants={setOpeningGrants}
                  rounds={inputs.rounds}
                  touched={touched}
                  markTouched={markTouched}
                  markManyTouched={markManyTouched}
                  requiredPaths={requiredPaths}
                  required={required}
                  hiringMeta={hiringMeta}
                  setHiringMeta={setHiringMeta}
                  grantMeta={grantMeta}
                  setGrantMeta={setGrantMeta}
                  readyToCalculate={readyToCalculate}
                  onCalculate={onCalculate}
                  calculateBlockedReason={complete && !outcome.ok ? outcome.message : undefined}
                />
                <div className="xl:hidden">
                  <CtaBand />
                </div>
              </div>
            </div>
          )}
          <HelpLinksBand />
        </main>
      </div>
      <Footer />
      {showResults && outcome.ok ? (
        <MobileSummaryBar
          recommended={outcome.result.recommended}
          current={outcome.result.current}
          selected={outcome.result.recommendedPool.selected}
          onOpenModel={() => setModelSheetOpen(true)}
        />
      ) : null}
      {showResults && !isDesktop ? (
        <Sheet open={modelSheetOpen} title="Your model" onClose={() => setModelSheetOpen(false)}>
          {modelPanel}
        </Sheet>
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
