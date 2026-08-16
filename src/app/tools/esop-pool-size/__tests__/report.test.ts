/**
 * The report, and the PROJECT.md prohibitions it must never breach.
 *
 * The prohibitions are the reason `reportModel.ts` is a pure module rather
 * than drawing straight into a PDF: a rule enforced only by whoever wrote the
 * copy is not enforced. Every check below runs against `reportPlainText(...)`
 * for a **sweep** of input combinations, not one fixture, because the copy the
 * prohibitions bite on is exactly the copy that changes with the inputs — the
 * tax row moves with two compliance toggles, the resolution row with the
 * company type, and the headline with the grant basis.
 */

import { describe, expect, it, vi } from 'vitest';

import type { EsopInputs, FundingRound } from '@/lib/esop';
import {
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  calculateEsopPool,
} from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import type { LeadDraft } from '../lib/leadValidation';
import {
  GLOSSARY,
  buildReportModel,
  coverText,
  reportFileName,
  reportPlainText,
  sectionText,
  type ReportModel,
} from '../lib/reportModel';

/** Fixed, so nothing here depends on the day the suite runs. */
const AS_AT = new Date('2026-08-16T00:00:00.000Z');
const PREPARED_ON = '2026-08-16';

const LEAD: LeadDraft = {
  name: 'Asha Menon',
  email: 'asha@northstar.co.in',
  company: 'Northstar Labs',
  consent: true,
};

const ROUND: FundingRound = {
  id: 'series-b',
  label: 'Series B',
  year: 1,
  preMoneyValuation: 3_000_000_000,
  raiseAmount: 500_000_000,
  investorRequiredPostRoundPoolPct: 10,
  poolCreation: 'preMoney',
};

function asPercentOfEquity(inputs: EsopInputs): EsopInputs {
  return {
    ...inputs,
    grantPolicy: {
      ...inputs.grantPolicy,
      grantBasis: { kind: 'percentOfEquity', grantPctByBand: DEFAULT_GRANT_PCT_BY_BAND },
      comparisonGrantBasis: { kind: 'rupeeValue', grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND },
    },
  };
}

interface Variant {
  readonly name: string;
  readonly inputs: EsopInputs;
}

/**
 * The sweep. Grant basis crossed with the three compliance states, whether a
 * pool is already held, whether a round is modelled, and both company types.
 */
function variants(): readonly Variant[] {
  const seed = buildSeedInputs(AS_AT);
  const built: Variant[] = [];

  for (const basis of ['rupeeValue', 'percentOfEquity'] as const) {
    const base = basis === 'rupeeValue' ? seed : asPercentOfEquity(seed);

    for (const compliance of [
      { name: 'no recognition', dpiitRecognised: false, imbCertified80IAC: false },
      { name: 'DPIIT only', dpiitRecognised: true, imbCertified80IAC: false },
      { name: 'DPIIT and IMB', dpiitRecognised: true, imbCertified80IAC: true },
    ]) {
      for (const pool of [0, 400_000]) {
        for (const rounds of [[], [ROUND]] as const) {
          for (const companyType of ['private', 'unlistedPublic'] as const) {
            built.push({
              name: `${basis}, ${compliance.name}, pool ${pool}, ${rounds.length} round(s), ${companyType}`,
              inputs: {
                ...base,
                company: { ...base.company, existingUnallocatedOptions: pool, companyType },
                compliance: {
                  ...base.compliance,
                  dpiitRecognised: compliance.dpiitRecognised,
                  imbCertified80IAC: compliance.imbCertified80IAC,
                },
                rounds,
              },
            });
          }
        }
      }
    }
  }

  return built;
}

function modelFor(inputs: EsopInputs): ReportModel {
  return buildReportModel({
    inputs,
    result: calculateEsopPool(inputs),
    lead: LEAD,
    preparedOn: PREPARED_ON,
  });
}

const CASES = variants().map((variant) => ({
  ...variant,
  model: modelFor(variant.inputs),
}));

const TEXTS = CASES.map((c) => ({ ...c, text: reportPlainText(c.model) }));

function linesOf(text: string): readonly string[] {
  return text.split('\n');
}

describe('the sweep is real', () => {
  it('covers both grant bases, all three compliance states and both company types', () => {
    expect(CASES).toHaveLength(48);

    // Not a tautology: the reports must actually differ, or every prohibition
    // check below would be one assertion repeated 48 times.
    expect(new Set(TEXTS.map((t) => t.text)).size).toBe(48);
  });
});

/* ------------------------------------------------------------------------- *
 * PROJECT.md prohibitions, one describe each
 * ------------------------------------------------------------------------- */

describe('prohibition: never state or imply that DPIIT recognition alone gives the tax deferral', () => {
  for (const { name, text } of TEXTS) {
    it(`never claims it — ${name}`, () => {
      for (const line of linesOf(text)) {
        expect(
          /DPIIT[^.]*\balone\b[^.]*\b(gives|grants|qualifies|entitles|allows|provides|unlocks|means)\b/i.test(line),
          line,
        ).toBe(false);
      }
    });
  }

  it('says the opposite outright when DPIIT is held without IMB', () => {
    const dpiitOnly = TEXTS.filter(
      (t) => t.inputs.compliance.dpiitRecognised && !t.inputs.compliance.imbCertified80IAC,
    );

    expect(dpiitOnly.length).toBeGreaterThan(0);
    for (const { name, text } of dpiitOnly) {
      expect(text, name).toMatch(/alone does not give the deferral/i);
      expect(text, name).toMatch(/Inter-Ministerial Board/i);
    }
  });

  it('claims the deferral only when both are held', () => {
    for (const { name, text, inputs } of TEXTS) {
      const both = inputs.compliance.dpiitRecognised && inputs.compliance.imbCertified80IAC;

      expect(/may defer the perquisite tax/i.test(text), name).toBe(both);
    }
  });
});

describe('prohibition: never cite Section 192(1C) as current, and the window is 60 months', () => {
  for (const { name, text } of TEXTS) {
    it(`cites neither the superseded section nor the old window — ${name}`, () => {
      expect(text).not.toMatch(/192\s*\(\s*1C\s*\)/i);
      // Hyphenated and spaced forms both, so "48-month window" cannot slip past.
      expect(text).not.toMatch(/\b48[\s-]months?\b/i);
    });
  }

  it('cites the successor provision where it states the deferral', () => {
    for (const { name, text } of TEXTS) {
      expect(text, name).toMatch(/Section 392\(3\) read with Section 289\(3\)/);
    }
  });

  it('states 60 months wherever it states a window', () => {
    const both = TEXTS.filter(
      (t) => t.inputs.compliance.dpiitRecognised && t.inputs.compliance.imbCertified80IAC,
    );

    expect(both.length).toBeGreaterThan(0);
    for (const { name, text } of both) {
      expect(text, name).toMatch(/60 months/);
    }
  });
});

describe('prohibition: never state that a private company needs a special resolution', () => {
  for (const { name, text } of TEXTS) {
    it(`never puts the two on one line — ${name}`, () => {
      for (const line of linesOf(text)) {
        const claimsBoth = /private compan/i.test(line) && /special resolution/i.test(line);
        expect(claimsBoth, line).toBe(false);
      }
    });
  }

  it('says ordinary resolution for a private company, and special for an unlisted public one', () => {
    for (const { name, text, inputs } of TEXTS) {
      // Scoped to the scheme-approval row. A document-wide grep for "special
      // resolution" is satisfied by the authorised-capital row, which mentions
      // one for amending the AoA and says nothing about scheme approval.
      const approvalRow = linesOf(text).find((line) => /approves an ESOP scheme|ESOP scheme by/i.test(line));

      expect(approvalRow, `${name}: no scheme-approval row found`).toBeDefined();

      if (inputs.company.companyType === 'private') {
        expect(approvalRow, name).toMatch(/ordinary resolution/i);
        expect(approvalRow, name).not.toMatch(/special resolution/i);
      } else {
        expect(approvalRow, name).toMatch(/special resolution/i);
      }
    }
  });
});

describe('prohibition: never present the Corporate Laws (Amendment) Bill 2026 as law', () => {
  for (const { name, text } of TEXTS) {
    it(`never describes it as in force — ${name}`, () => {
      expect(text).not.toMatch(/Bill[^.]*\b(is law|is now law|in force|has been enacted|was enacted)\b/i);
      expect(text).not.toMatch(/\b(RSUs?|SARs?)\b[^.]*\b(are|is) (now )?recognised\b/i);
    });
  }

  it('says options are what the section recognises today', () => {
    for (const { name, text } of TEXTS) {
      expect(text, name).toMatch(/Options are the instrument Section 62\(1\)\(b\) recognises today/i);
    }
  });
});

describe('prohibition: never present advisory benchmark ranges as data', () => {
  /**
   * Stated plainly: the report carries no benchmark section at all, so this
   * prohibition is satisfied by omission today and the check below cannot
   * currently fail. It is a guard for the next person, not evidence about the
   * present — the moment a band is added, it has to arrive labelled as
   * opinion. The assertion deliberately does NOT accept the word "estimate",
   * which every provenance tag in the report already contains and which would
   * make this pass no matter what a future benchmark section said.
   */
  it('carries no benchmark band today, which is why this prohibition cannot be breached', () => {
    for (const { name, text } of TEXTS) {
      expect(text, name).not.toMatch(/advisory consensus|observed india data/i);
    }
  });

  for (const { name, text } of TEXTS) {
    it(`would demand the opinion caveat if a band were ever added — ${name}`, () => {
      if (!/advisory consensus/i.test(text)) return;

      expect(text, name).toMatch(/opinion, not measurement|never data|not measured data/i);
    });
  }
});

describe('prohibition: never output a pool percentage without the grant basis and strike policy beside it', () => {
  for (const { name, model } of CASES) {
    it(`puts all three on the cover page — ${name}`, () => {
      const cover = coverText(model.cover);

      expect(cover).toContain(model.cover.headlinePoolPct);
      expect(cover).toContain(model.cover.grantBasis);
      expect(cover).toContain(model.cover.strikePolicy);
    });
  }

  /**
   * The headline percentage and the headline option count must be ONE pool.
   *
   * Section 4.5's `PoolSizing` figures are the *top-up*, `K - existing`, so
   * pairing that percentage with the whole pool's option count reads 3.0%
   * beside 6,72,995 options for a company holding 4,00,000 — AUDIT_P4 defect
   * 2, arriving through the front end. This is what caught it.
   */
  it('pairs the headline percentage with the option count of the same pool', () => {
    const holding = CASES.filter((c) => c.inputs.company.existingUnallocatedOptions > 0);
    expect(holding.length).toBeGreaterThan(0);

    for (const { name, model, inputs } of holding) {
      const result = calculateEsopPool(inputs);

      // Both sides of the headline come off the SAME series object, with
      // section 4.5's round-up applied so one pool is not shown at two
      // roundings beside the top-up.
      const expectedPct = Math.ceil(result.recommended.openingPoolPctOfFullyDiluted / 0.5) * 0.5;
      expect(model.cover.headlinePoolPct, name).toBe(`${expectedPct.toFixed(1)}%`);
      expect(model.cover.headlinePoolOptions, name).toContain(
        Math.round(result.recommended.openingPoolOptions).toLocaleString('en-IN'),
      );

      // And the top-up stat carries its own matching percentage, rather than
      // borrowing the headline's.
      expect(model.cover.topUpPct, name).toBe(
        `${result.recommendedPool.selected.displayPoolPctOfFullyDiluted.toFixed(1)}%`,
      );
      expect(model.cover.topUpPct, name).not.toBe(model.cover.headlinePoolPct);
    }
  });

  it('names a real basis and a real policy, never an empty string', () => {
    for (const { name, model } of CASES) {
      expect(model.cover.grantBasis, name).toMatch(/Percent of equity|Rupee value/);
      expect(model.cover.strikePolicy, name).toMatch(/Face value|Last round price|Discount to FMV/);
    }
  });

  it('repeats both in the inputs section, so the report never states one without the other', () => {
    for (const { name, model } of CASES) {
      const inputs = model.sections.find((s) => s.id === 'inputs');
      const text = sectionText(inputs!);

      expect(text, name).toMatch(/Grant basis:/);
      expect(text, name).toMatch(/Strike price policy:/);
    }
  });

  /**
   * The cover is not enough on its own. A PDF is paginated, and the
   * recommendation, roll-forward, round and scenario sections all print pool
   * percentages on pages the cover panel does not reach — so both controls are
   * page furniture, printed on every page by `drawFooters`. This pins the
   * string that furniture is built from.
   */
  it('carries both controls in the running page furniture, not only on the cover', () => {
    for (const { name, model, inputs } of CASES) {
      // Expectations derived from the INPUTS, not from `model.cover` — reading
      // the expected value back out of the object under test would pass
      // whatever the code did, including printing an empty string twice.
      const expectedBasis = inputs.grantPolicy.grantBasis.kind === 'percentOfEquity' ? 'Percent of equity' : 'Rupee value';
      const strike = inputs.grantPolicy.strikePolicy;
      const expectedStrike =
        strike.kind === 'faceValue'
          ? 'Face value'
          : strike.kind === 'lastRoundPrice'
            ? 'Last round price'
            : 'Discount to FMV';

      expect(model.controlsFooter, name).toContain(expectedBasis);
      expect(model.controlsFooter, name).toContain(expectedStrike);
    }
  });

  it('leaves no section able to state a pool percentage with neither control anywhere in the document', () => {
    // Belt and braces: whatever the pagination does, the flattened report can
    // never hold a percentage-bearing section without both controls present.
    for (const { name, model } of CASES) {
      const text = reportPlainText(model);

      expect(text, name).toContain(model.cover.grantBasis);
      expect(text, name).toContain(model.cover.strikePolicy);
    }
  });
});

describe('prohibition: never let a compliance row appear without the disclaimer', () => {
  for (const { name, model } of CASES) {
    it(`carries it on every row — ${name}`, () => {
      const section = model.sections.find((s) => s.id === 'compliance');
      const checklist = section?.blocks.find((b) => b.kind === 'checklist');

      expect(checklist?.kind).toBe('checklist');
      if (checklist?.kind !== 'checklist') return;

      expect(checklist.items.length).toBeGreaterThan(0);
      for (const item of checklist.items) {
        expect(item.disclaimer, `${name} / ${item.title}`).toBe('General information, not legal advice.');
      }
    });
  }

  it('renders it once per row in the text, not once for the section', () => {
    for (const { name, model } of CASES) {
      const section = model.sections.find((s) => s.id === 'compliance');
      const checklist = section?.blocks.find((b) => b.kind === 'checklist');
      if (checklist?.kind !== 'checklist') throw new Error('no checklist');

      const occurrences = sectionText(section!).split('General information, not legal advice.').length - 1;

      expect(occurrences, name).toBe(checklist.items.length);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * The report generates locally
 * ------------------------------------------------------------------------- */

describe('the report generates without a network call', () => {
  it('never touches fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const inputs = buildSeedInputs(AS_AT);

    const model = buildReportModel({
      inputs,
      result: calculateEsopPool(inputs),
      lead: LEAD,
      preparedOn: PREPARED_ON,
    });
    const text = reportPlainText(model);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(text.length).toBeGreaterThan(2_000);

    fetchSpy.mockRestore();
  });

  it('is deterministic: the same inputs produce byte-identical copy', () => {
    const inputs = buildSeedInputs(AS_AT);
    const result = calculateEsopPool(inputs);

    const first = reportPlainText(buildReportModel({ inputs, result, lead: LEAD, preparedOn: PREPARED_ON }));
    const second = reportPlainText(buildReportModel({ inputs, result, lead: LEAD, preparedOn: PREPARED_ON }));

    expect(first).toBe(second);
  });

  it('dates the report from the argument it is given, not from today', () => {
    const inputs = buildSeedInputs(AS_AT);
    const model = buildReportModel({
      inputs,
      result: calculateEsopPool(inputs),
      lead: LEAD,
      preparedOn: '2001-01-01',
    });

    expect(model.cover.preparedOn).toBe('2001-01-01');
  });
});

/* ------------------------------------------------------------------------- *
 * The report says what the prompt asked it to say
 * ------------------------------------------------------------------------- */

describe('the report carries every section it was asked for', () => {
  const withRound = CASES.find((c) => c.inputs.rounds.length > 0)!;

  it('has the cover, the drivers, the inputs, the roll-forward, the charts and the rest', () => {
    const ids = withRound.model.sections.map((s) => s.id);

    expect(ids).toEqual([
      'recommendation',
      'inputs',
      'roll-forward',
      'charts',
      'cap-table',
      'round',
      'scenarios',
      'compliance',
      'expense',
      'glossary',
      'cta',
    ]);
  });

  it('drops the round section, and only that section, when no round is modelled', () => {
    const withoutRound = CASES.find((c) => c.inputs.rounds.length === 0)!;
    const ids = withoutRound.model.sections.map((s) => s.id);

    expect(ids).not.toContain('round');
    expect(ids).toHaveLength(withRound.model.sections.length - 1);
  });

  it('names all four charts', () => {
    const charts = withRound.model.sections.find((s) => s.id === 'charts');
    const ids = charts?.blocks.map((b) => (b.kind === 'chart' ? b.chartId : null));

    expect(ids).toEqual(['pool-runway', 'grant-cost', 'pool-pct', 'hires-supported']);
  });

  it('shows the roll-forward for both series, never one unlabelled table', () => {
    const section = withRound.model.sections.find((s) => s.id === 'roll-forward');
    const captions = section?.blocks.flatMap((b) => (b.kind === 'table' && b.caption ? [b.caption] : []));

    expect(captions?.[0]).toMatch(/^Recommended pool/);
    expect(captions?.[1]).toMatch(/^Your current pool/);
  });

  it('states the pre-money against post-money delta in the round section', () => {
    const text = sectionText(withRound.model.sections.find((s) => s.id === 'round')!);

    expect(text).toMatch(/Pre-money against post-money/);
    expect(text).toMatch(/Moving the pool into the post-money keeps the founders/);
  });

  it('gives every input a provenance tag, and never calls one sourced data', () => {
    const section = withRound.model.sections.find((s) => s.id === 'inputs')!;
    const rows = section.blocks.flatMap((b) => (b.kind === 'keyValue' ? b.rows : []));

    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(row.provenance, row.label).toBeDefined();
    }
    expect(sectionText(section)).not.toMatch(/sourced data/i);
  });

  it('has a glossary of exactly eight terms', () => {
    expect(GLOSSARY).toHaveLength(8);

    const glossary = withRound.model.sections.find((s) => s.id === 'glossary');
    const rows = glossary?.blocks.flatMap((b) => (b.kind === 'keyValue' ? b.rows : []));

    expect(rows).toHaveLength(8);
  });

  it('closes on the CTA, as the last section', () => {
    const last = withRound.model.sections[withRound.model.sections.length - 1]!;

    expect(last.id).toBe('cta');
    expect(sectionText(last)).toMatch(/Tabulate is Incentiv/);
    expect(sectionText(last)).toMatch(/Book a demo/);
    expect(sectionText(last)).toMatch(/Explore Tabulate/);
  });
});

describe('copy conventions hold in the report', () => {
  it('says "Pool to create" when the founder holds nothing, and "Top-up needed" when they do', () => {
    for (const { name, model, inputs } of CASES) {
      const holdsAPool = inputs.company.existingUnallocatedOptions > 0;

      expect(model.cover.topUpLabel, name).toBe(holdsAPool ? 'Top-up needed' : 'Pool to create');
    }
  });

  it('names the zero-pool state rather than dating it', () => {
    const empty = CASES.filter((c) => c.inputs.company.existingUnallocatedOptions === 0);

    expect(empty.length).toBeGreaterThan(0);
    for (const { name, model } of empty) {
      expect(model.cover.currentPoolRunway, name).toBe('No pool yet');
    }
  });

  it('groups money the Indian way, with a lakh or crore readout beside it', () => {
    const text = sectionText(CASES[0]!.model.sections.find((s) => s.id === 'inputs')!);

    expect(text).toMatch(/₹1,50,00,00,000/);
    expect(text).toMatch(/≈ ₹150\.00 crore/);
  });

  it('builds a filename from the company, not from a placeholder', () => {
    expect(reportFileName(CASES[0]!.model)).toBe('esop-pool-sizing-northstar-labs.pdf');
  });
});
