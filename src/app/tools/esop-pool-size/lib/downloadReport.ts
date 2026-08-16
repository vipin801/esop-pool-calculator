/**
 * The download path, in order: post the lead, then build the PDF locally.
 *
 * The post is deliberately not awaited for correctness of the download. A lead
 * endpoint that is down, slow or blocked by an ad blocker must not cost the
 * founder the report they just asked for, so its failure is swallowed and the
 * PDF is generated either way. Nothing after the post touches the network.
 */

import type { EsopInputs, EsopResult } from '@/lib/esop';
import { captureCharts } from './chartCapture';
import { buildReportModel, reportFileName, REPORT_CHART_IDS } from './reportModel';
import { renderReportPdf } from './reportPdf';
import type { Lead } from '../results/LeadModal';

/**
 * How long the lead POST gets before the report goes ahead without it.
 *
 * A swallowed error is not enough on its own: a hanging endpoint never
 * rejects, so an un-timed `await` would leave the founder on a spinner
 * indefinitely for a record that is worth none of their time.
 */
const LEAD_POST_TIMEOUT_MS = 4_000;

export async function postLead(lead: Lead): Promise<boolean> {
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(LEAD_POST_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function generateAndDownloadReport(args: {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly lead: Lead;
  /** The results panel, which holds the `[data-chart]` wrappers. */
  readonly chartsRoot: ParentNode | null;
  readonly preparedOn?: string;
}): Promise<void> {
  const { inputs, result, lead, chartsRoot, preparedOn } = args;

  const captured = chartsRoot ? await captureCharts(chartsRoot, REPORT_CHART_IDS) : new Map();
  const model = buildReportModel({ inputs, result, lead, preparedOn });

  renderReportPdf(model, captured).save(reportFileName(model));
}
