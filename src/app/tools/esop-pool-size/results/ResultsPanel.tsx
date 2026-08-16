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
import { ScenarioStrip } from './ScenarioStrip';
import { YearTable } from './YearTable';

interface ResultsPanelProps {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly onLoadScenario: (inputs: EsopInputs) => void;
  readonly onDownload: () => void;
  readonly reportReady: boolean;
}

export function ResultsPanel({ inputs, result, onLoadScenario, onDownload, reportReady }: ResultsPanelProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Headline result={result} />
        <HowCalculated />
      </div>

      <BenchmarkStrip benchmarkComparison={result.benchmarkComparison} />

      <PoolRunwayChart recommended={result.recommended} current={result.current} />

      <div className="grid gap-3 xl:grid-cols-2">
        <GrantCostChart years={result.recommended.years} grantBasisKind={result.recommendedPool.selected.grantBasisKind} />
        <PoolPctChart recommended={result.recommended} current={result.current} />
      </div>

      <HiresSupportedChart recommended={result.recommended} current={result.current} />

      <ScenarioStrip inputs={inputs} baseResult={result} onLoad={onLoadScenario} />

      <YearTable recommended={result.recommended} current={result.current} />

      <CapTablePanel capTables={result.capTables} />

      <MedianEmployeeValue value={result.medianEmployeeValue} />

      <ComplianceChecks checks={result.complianceChecks} />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Download the detailed report</h3>
          <p className="mt-0.5 text-2xs text-faint">Your inputs, the recommendation, the roll forward and the compliance checklist.</p>
        </div>
        <Button onClick={onDownload} disabled={!reportReady}>
          {reportReady ? 'Download report' : 'Preparing report…'}
        </Button>
      </div>
    </div>
  );
}
