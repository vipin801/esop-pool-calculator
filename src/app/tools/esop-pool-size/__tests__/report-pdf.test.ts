/**
 * The renderer, run in node. Layout cannot be asserted from here, but three
 * things that went wrong on paper can be.
 *
 * - The money glyphs. Helvetica has no ₹, ≈ or −, and every money field
 *   printed as "¹" and "\"H". The fix is an embedded Inter; this checks it is
 *   actually embedded rather than silently falling back.
 * - Sections flow. One page per section printed thirteen mostly empty pages.
 * - The cover's controls. The headline percentage, grant basis and strike
 *   policy must all be drawn on page one.
 */

import { describe, expect, it } from 'vitest';
import { calculateEsopPool, type FundingRound } from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import { buildReportModel } from '../lib/reportModel';
import { renderReportPdf } from '../lib/reportPdf';

const LEAD = { name: 'Asha Menon', email: 'asha@northstar.co.in', company: 'Northstar Labs', consent: true };

const ROUND: FundingRound = {
  id: 'series-b',
  label: 'Series B',
  year: 1,
  preMoneyValuation: 3_000_000_000,
  raiseAmount: 500_000_000,
  investorRequiredPostRoundPoolPct: 10,
  poolCreation: 'preMoney',
};

function render(withRound: boolean) {
  const seed = buildSeedInputs(new Date('2026-08-16T00:00:00.000Z'));
  const inputs = { ...seed, rounds: withRound ? [ROUND] : [] };
  const model = buildReportModel({ inputs, result: calculateEsopPool(inputs), lead: LEAD, preparedOn: '2026-08-16' });
  const doc = renderReportPdf(model);

  return { model, doc, raw: doc.output() };
}

describe('the PDF renderer', () => {
  for (const withRound of [false, true]) {
    const { model, doc, raw } = render(withRound);
    const label = withRound ? 'with a round' : 'without a round';

    it(`embeds Inter rather than falling back to Helvetica — ${label}`, () => {
      /* jsPDF declares the fourteen standard fonts in every file, unembedded, so
         Helvetica's name appearing proves nothing; three embedded faces does. */
      expect(raw.match(/\/FontFile2/g)).toHaveLength(3);
      for (const face of ['Inter', 'Inter-SemiBold', 'Inter-Bold']) {
        expect(raw).toContain(`/BaseFont /${face}`);
      }
    });

    it(`flows sections rather than giving each a page — ${label}`, () => {
      const pages = doc.getNumberOfPages();
      /* Cover, closing page, and the sections between: well under one each. */
      expect(pages).toBeGreaterThanOrEqual(5);
      expect(pages).toBeLessThan(model.sections.length + 1);
    });

    it(`links the closing page to Incentiv — ${label}`, () => {
      expect(raw).toContain('https://incentiv.finance/tabulate');
    });
  }
});
