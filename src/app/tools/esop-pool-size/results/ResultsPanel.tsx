import type { EsopInputs, EsopResult } from '@/lib/esop';
import { Button } from '../ui/Button';
import { BenchmarkStrip } from './BenchmarkStrip';
import { CapTablePanel } from './CapTablePanel';
import { ComplianceChecks } from './ComplianceChecks';
import { GrantCostChart } from './charts/GrantCostChart';
import { Headline } from './Headline';
import { HiresSupportedChart } from './charts/HiresSupportedChart';
import { HowCalculated } from './HowCalculated';
import { MedianEmployeeValue } from './MedianEmployeeValue';
import { PoolPctChart } from './charts/PoolPctChart';
import { PoolRunwayChart } from './charts/PoolRunwayChart';
import { ResultTabs, type ResultTab } from './ResultTabs';
import { ScenarioStrip } from './ScenarioStrip';
import { YearTable } from './YearTable';

interface ResultsPanelProps {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly onLoadScenario: (inputs: EsopInputs) => void;
  readonly onDownload: () => void;
  readonly reportReady: boolean;
  readonly downloadError: string | null;
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

/**
 * One result object, not eight stacked cards.
 *
 * The header is everything a founder must never lose sight of: the pool
 * percentage, the options behind it, the grant basis and strike policy that
 * produced it, and both exhaustion lines. Everything else is a tab, so the
 * page stops being a scroll and starts being a screen.
 */
export function ResultsPanel({
  inputs,
  result,
  onLoadScenario,
  onDownload,
  reportReady,
  downloadError,
  incompleteCount = 0,
}: ResultsPanelProps) {
  const tabs: readonly ResultTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      render: () => (
        <div className="space-y-3">
          <BenchmarkStrip benchmarkComparison={result.benchmarkComparison} />
          <ScenarioStrip inputs={inputs} baseResult={result} onLoad={onLoadScenario} />
          <HowCalculated solver={result.solver} />
        </div>
      ),
    },
    {
      id: 'runway',
      label: 'Runway',
      render: () => (
        <div className="grid gap-3 xl:grid-cols-2">
          <PoolRunwayChart recommended={result.recommended} current={result.current} />
          <PoolPctChart recommended={result.recommended} current={result.current} />
        </div>
      ),
    },
    {
      id: 'hiring-cost',
      label: 'Hiring cost',
      render: () => (
        <div className="grid gap-3 xl:grid-cols-2">
          <HiresSupportedChart recommended={result.recommended} current={result.current} />
          <GrantCostChart
            years={result.recommended.years}
            grantBasisKind={result.recommendedPool.selected.grantBasisKind}
          />
        </div>
      ),
    },
    {
      id: 'year-by-year',
      label: 'Year by year',
      render: () => <YearTable recommended={result.recommended} current={result.current} />,
    },
    {
      id: 'cap-table',
      label: 'Cap table',
      render: () => <CapTablePanel capTables={result.capTables} />,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      render: () => (
        <div className="space-y-3">
          <ComplianceChecks checks={result.complianceChecks} />
          <MedianEmployeeValue value={result.medianEmployeeValue} />
        </div>
      ),
    },
  ];

  return (
    <section
      id="result"
      aria-labelledby="result-heading"
      className="scroll-mt-[64px] rounded-lg border border-border bg-surface shadow-panel"
    >
      <div className="space-y-2.5 border-b border-border p-4">
        <h2 id="result-heading" className="sr-only">
          Your ESOP pool
        </h2>

        <Headline
          result={result}
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

      <ResultTabs tabs={tabs} ariaLabel="Result detail" />
    </section>
  );
}
