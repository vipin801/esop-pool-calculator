'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { LeadModal, type Lead } from './results/LeadModal';
import { ReportCharts } from './results/ReportCharts';
import { ResultsPanel } from './results/ResultsPanel';
import { generateAndDownloadReport, postLead } from './lib/downloadReport';
import { buildSeedInputs } from './lib/seedInputs';
import { ThemeProvider } from './lib/theme';

type Mode = 'simple' | 'advanced';

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
  const [mode, setMode] = useState<Mode>('simple');
  const [modalOpen, setModalOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const reportChartsRef = useRef<HTMLDivElement>(null);

  const setGroup = useCallback(<K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } as EsopInputs[K] }));
  }, []);

  const setOpeningGrants = useCallback((openingGrants: readonly OpeningGrantCohortInput[]) => {
    setInputs((prev) => ({ ...prev, openingGrants }));
  }, []);

  const setRounds = useCallback((rounds: readonly FundingRound[]) => {
    setInputs((prev) => ({ ...prev, rounds }));
  }, []);

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
      <main id="main" className="mx-auto max-w-page px-5 pb-28 lg:pb-10">
        <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pr-1">
            <InputRail
              inputs={inputs}
              setGroup={setGroup}
              openingGrants={inputs.openingGrants}
              setOpeningGrants={setOpeningGrants}
              rounds={inputs.rounds}
              setRounds={setRounds}
              mode={mode}
              onModeChange={setMode}
              onReset={() => setInputs(buildSeedInputs())}
            />
          </div>
          <div className="min-w-0 space-y-4">
            {outcome.ok ? (
              <ResultsPanel
                inputs={inputs}
                result={outcome.result}
                onLoadScenario={setInputs}
                onDownload={onDownload}
                reportReady={!busy}
                downloadError={downloadError}
              />
            ) : (
              <div role="alert" className="rounded-lg border border-warn bg-warn-soft p-4 text-eyebrow text-warn">
                This plan can’t be priced yet: {outcome.message}
              </div>
            )}
            <CtaBand />
          </div>
        </div>
      </main>
      <Footer />
      {outcome.ok ? (
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
