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
import { ResultsPanel } from './results/ResultsPanel';
import { generateAndDownloadReport, postLead } from './lib/downloadReport';
import { buildSeedInputs } from './lib/seedInputs';
import { ThemeProvider } from './lib/theme';

type Mode = 'simple' | 'advanced';

function EsopPoolSizeApp() {
  const [inputs, setInputs] = useState<EsopInputs>(() => buildSeedInputs());
  const [mode, setMode] = useState<Mode>('simple');
  const [modalOpen, setModalOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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
   */
  async function runDownload(forLead: Lead, isNewLead: boolean) {
    if (!outcome.ok || busy) return;

    setBusy(true);
    setDownloadError(null);
    try {
      if (isNewLead) await postLead(forLead);

      await generateAndDownloadReport({
        inputs,
        result: outcome.result,
        lead: forLead,
        chartsRoot: resultsRef.current,
      });
      setLead(forLead);
      setModalOpen(false);
    } catch {
      setDownloadError('The PDF could not be generated. Your results on screen are unaffected — try again.');
    } finally {
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
      <Header />
      <Hero />
      <main id="main" className="mx-auto max-w-page px-5 pb-28 lg:pb-12">
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">
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
          <div className="min-w-0 space-y-4" ref={resultsRef}>
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
              <div className="rounded-lg border border-warn bg-warn-soft p-4 text-[13px] text-warn">
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
          recommendedPoolPct={outcome.result.recommended.openingPoolPctOfFullyDiluted}
          exhaustion={outcome.result.current.exhaustion}
          hasExistingPool={outcome.result.current.openingPoolOptions > 0}
        />
      ) : null}
      <LeadModal
        open={modalOpen}
        stage={inputs.company.stage}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmitLead}
      />
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
