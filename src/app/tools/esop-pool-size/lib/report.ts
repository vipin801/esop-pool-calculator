/**
 * The gated download (PROJECT.md D3: results are free, the report is gated).
 *
 * This is a plain-text summary rather than the original build's jsPDF +
 * html2canvas PDF — a deliberate scope reduction for this session, recorded in
 * docs/esop/LOG.md. Every figure in it is read off the same `EsopResult` the
 * screen renders; nothing here recomputes anything.
 */
import type { EsopInputs, EsopResult } from '@/lib/esop';
import { currentPoolRunwayLabel } from './describe';
import { formatPct, formatShares, lakhCrore } from './format';
import { STAGE_LABEL } from './labels';
import type { Lead } from '../results/LeadModal';

export function buildReportText(args: {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly lead: Lead;
}): string {
  const { inputs, result, lead } = args;
  const lines: string[] = [];

  lines.push('INCENTIV — ESOP POOL SIZING REPORT');
  lines.push(`${lead.company} · ${STAGE_LABEL[inputs.company.stage]} · prepared ${result.asOfDate}`);
  lines.push('');
  lines.push('General information, not legal advice.');
  lines.push('');

  lines.push('THE RECOMMENDATION');
  lines.push(
    `Recommended pool: ${formatPct(result.recommendedPool.selected.displayPoolPctOfFullyDiluted)} of fully diluted (${formatShares(
      result.recommended.openingPoolOptions,
    )} options).`,
  );
  lines.push(
    `${result.current.openingPoolOptions > 0 ? 'Top-up needed' : 'Pool to create'}: ${formatShares(
      result.recommendedPool.selected.poolOptions,
    )} options.`,
  );
  lines.push(`Your current pool: ${currentPoolRunwayLabel(result.current)}.`);
  lines.push(`Solved in ${result.solver.iterations} iterations (converged: ${result.solver.converged ? 'yes' : 'no'}).`);
  lines.push('');

  if (result.poolCostToFounders) {
    const outcome =
      result.poolCostToFounders.asOffered === 'preMoney'
        ? result.poolCostToFounders.preMoneyPool
        : result.poolCostToFounders.postMoneyPool;
    lines.push('NEXT FUNDING ROUND');
    lines.push(`Cost to founders from the pool: ${lakhCrore(outcome.founderDilutionCostRupees)}.`);
    lines.push(`Pool footprint on the post-round company: ${outcome.founderDilutionFromPoolPctPoints.toFixed(2)} points.`);
    lines.push('');
  }

  lines.push('YEAR-BY-YEAR ROLL FORWARD (recommended pool)');
  for (const y of result.recommended.years) {
    lines.push(
      `Y${y.year + 1}: ${formatShares(y.hires)} hires, ${formatShares(y.newHireGrants)} new grants, closing available ${formatShares(
        y.closingAvailable,
      )}.`,
    );
  }
  lines.push('');

  lines.push('COMPLIANCE CHECKLIST (INDIA)');
  for (const check of result.complianceChecks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.finding} — ${check.action} (${check.statutoryReference})`);
  }
  lines.push('');
  lines.push('General information, not legal advice.');

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
