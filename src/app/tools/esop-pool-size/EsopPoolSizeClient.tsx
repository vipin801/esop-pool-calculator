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
import { buildReportText, downloadTextFile } from './lib/report';
import { buildSeedInputs } from './lib/seedInputs';
import { ThemeProvider } from './lib/theme';

type Mode = 'simple' | 'advanced';

function EsopPoolSizeApp() {
  const [inputs, setInputs] = useState<EsopInputs>(() => buildSeedInputs());
  const [mode, setMode] = useState<Mode>('simple');
  const [modalOpen, setModalOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
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

  function runDownload(forLead: Lead) {
    if (!outcome.ok) return;
    setBusy(true);
    const text = buildReportText({ inputs, result: outcome.result, lead: forLead });
    downloadTextFile(`esop-pool-sizing-${forLead.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`, text);
    setBusy(false);
    setModalOpen(false);
  }

  function onDownload() {
    if (lead) {
      runDownload(lead);
      return;
    }
    setModalOpen(true);
  }

  function onSubmitLead(submitted: Lead) {
    setLead(submitted);
    runDownload(submitted);
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
          recommendedPoolPct={outcome.result.recommendedPool.selected.displayPoolPctOfFullyDiluted}
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
