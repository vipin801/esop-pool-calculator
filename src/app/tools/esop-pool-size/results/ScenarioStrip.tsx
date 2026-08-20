'use client';

import { useMemo } from 'react';
import { calculateEsopPool, isEsopEngineError, type EsopInputs, type EsopResult } from '@/lib/esop';
import { currentPoolRunwayLabel } from '../lib/describe';
import { formatPct, lakhCrore } from '../lib/format';
import { applyScenario, SCENARIOS, type ScenarioKey } from '../lib/scenarios';

interface ScenarioStripProps {
  readonly inputs: EsopInputs;
  readonly baseResult: EsopResult;
  readonly onLoad: (inputs: EsopInputs) => void;
}

function poolCostFor(result: EsopResult): string {
  if (result.poolCostToFounders) {
    const outcome =
      result.poolCostToFounders.asOffered === 'preMoney'
        ? result.poolCostToFounders.preMoneyPool
        : result.poolCostToFounders.postMoneyPool;
    return lakhCrore(outcome.founderDilutionCostRupees);
  }
  return lakhCrore(result.recommendedPool.selected.poolOptions * (result.recommended.years[0]?.pricePerShare ?? 0));
}

function runScenario(inputs: EsopInputs, key: ScenarioKey, baseResult: EsopResult): EsopResult | 'error' {
  if (key === 'base') return baseResult;
  try {
    return calculateEsopPool(applyScenario(inputs, key));
  } catch (error) {
    if (isEsopEngineError(error)) return 'error';
    throw error;
  }
}

export function ScenarioStrip({ inputs, baseResult, onLoad }: ScenarioStripProps) {
  const results = useMemo(
    () => SCENARIOS.map((s) => ({ ...s, result: runScenario(inputs, s.key, baseResult) })),
    [inputs, baseResult],
  );

  return (
    <section className="rounded-lg border border-border bg-raised">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <h3 className="text-small font-medium tracking-tight text-ink">Scenarios</h3>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {results.map(({ key, label, note, result }) => (
          <div key={key} className="bg-raised px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow text-faint">{label}</span>
              {key === 'base' ? (
                <span className="text-2xs text-accent">Current</span>
              ) : result === 'error' ? null : (
                <button
                  type="button"
                  onClick={() => onLoad(applyScenario(inputs, key))}
                  className="text-2xs text-accent transition-colors duration-150 hover:text-accent-hover"
                >
                  Load
                </button>
              )}
            </div>
            {result === 'error' ? (
              <p className="mt-2 text-2xs leading-4 text-warn">
                This scenario pushes the plan out of the range the model can solve for.
              </p>
            ) : (
              <>
                <p className="figure mt-3 text-h4 text-ink">
                  {formatPct(result.recommendedPool.selected.displayPoolPctOfFullyDiluted)}
                </p>
                {key === 'base' ? (
                  <>
                    <dl className="mt-2 space-y-1">
                      <div className="flex justify-between gap-2">
                        <dt className="text-2xs text-faint">Current pool</dt>
                        <dd className="figure text-2xs text-sub">{currentPoolRunwayLabel(result.current)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-2xs text-faint">Founder cost</dt>
                        <dd className="figure text-2xs text-sub">{poolCostFor(result)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-2xs leading-4 text-faint">{note}</p>
                  </>
                ) : (
                  /**
                   * Slow/Fast are perturbations of `minor`-tier assumptions
                   * (hiring pace, growth, attrition, grant size — `lib/scenarios.ts`),
                   * and `poolCostFor` reads the same invented
                   * `founderOwnershipPctOfFullyDiluted` split D13 already locks
                   * on the cap table. Naming the perturbation ("hiring at 70%,
                   * growth halved...") or the founder cost it implies is the
                   * same leak one door over, so the whole detail block is
                   * opaque here — only the headline percentage and `Load`
                   * stay free, same as Base. No label or figure renders,
                   * matching `WhyThisNumber`/`CapTablePanel`'s locked columns.
                   */
                  <div className="mt-2 space-y-1.5 overflow-hidden" aria-hidden="true">
                    <div className="h-3 w-full rounded bg-border blur-[1.5px]" />
                    <div className="h-3 w-full rounded bg-border blur-[1.5px]" />
                    <div className="h-3 w-4/5 rounded bg-border blur-[1.5px]" />
                  </div>
                )}
              </>
            )}
            {result !== 'error' && key !== 'base' ? (
              <span className="sr-only">Locked until you download the full report.</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
