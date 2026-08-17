/**
 * PROJECT.md's seven prohibitions, swept across the whole codebase.
 *
 * `report.test.ts` already sweeps them across the generated report *model*,
 * over 48 input combinations. This file is the other half: a static sweep of
 * every source file that can put words on a screen — components, the engine's
 * compliance rows, the defaults table, the report modules — so a prohibition
 * cannot be broken in a string that no fixture happens to render.
 *
 * The two are complementary and deliberately overlap. A model sweep cannot
 * see copy behind a branch no fixture takes; a static sweep cannot see a
 * sentence assembled from three fragments. Neither alone is enough.
 */

import { describe, expect, it } from 'vitest';
import { COMPLIANCE_DISCLAIMER, calculateEsopPool, type ComplianceCheck } from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import { sourceFiles, withoutComments } from './ui-source';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../../..', import.meta.url));

/** Everything that can produce user-visible words, tests excluded. */
const ALL_SOURCES = sourceFiles(['.ts', '.tsx'], SRC_DIR);

/** Only the words themselves: string and template literals, comments stripped. */
function copyStringsOf(text: string): readonly string[] {
  const out: string[] = [];
  const stripped = withoutComments(text);
  for (const match of stripped.matchAll(/(?:'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`)/g)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    if (/[a-z]{3}/i.test(value)) out.push(value);
  }
  return out;
}

const ALL_COPY = ALL_SOURCES.flatMap((f) => copyStringsOf(f.text).map((s) => ({ rel: f.rel, s })));

function offenders(predicate: (copy: string) => boolean) {
  return ALL_COPY.filter(({ s }) => predicate(s)).map(({ rel, s }) => `${rel}: ${s}`);
}

it('is reading a real corpus, not an empty one', () => {
  expect(ALL_SOURCES.length).toBeGreaterThan(60);
  expect(ALL_COPY.length).toBeGreaterThan(500);
});

/* 1 -------------------------------------------------------------------- */

describe('never implies DPIIT recognition alone gives the perquisite tax deferral', () => {
  it('mentions the Inter-Ministerial Board in every deferral sentence that names DPIIT', () => {
    const bad = offenders(
      (s) =>
        /\bDPIIT\b/i.test(s) &&
        /defer/i.test(s) &&
        !/Inter-Ministerial|\bIMB\b|imbCertified/i.test(s) &&
        !/alone does not|not sufficient|neither is sufficient/i.test(s),
    );
    expect(bad).toEqual([]);
  });

  it('renders the DPIIT-only state as unavailable in a real engine run', () => {
    const base = buildSeedInputs();
    const dpiitOnly = calculateEsopPool({
      ...base,
      compliance: { ...base.compliance, dpiitRecognised: true, imbCertified80IAC: false },
    });
    const taxRow = dpiitOnly.complianceChecks.find((c: ComplianceCheck) => c.id === 'taxDeferral')!;

    expect(taxRow.finding).toMatch(/alone does not give the deferral/i);
    expect(taxRow.status).not.toBe('pass');
  });

  it('renders the deferral as available only when both flags are on', () => {
    const base = buildSeedInputs();
    const withBoth = { ...base.compliance, dpiitRecognised: true, imbCertified80IAC: true };
    const states = [
      { c: { ...base.compliance, dpiitRecognised: false, imbCertified80IAC: false }, expected: false },
      { c: { ...base.compliance, dpiitRecognised: true, imbCertified80IAC: false }, expected: false },
      { c: { ...base.compliance, dpiitRecognised: false, imbCertified80IAC: true }, expected: false },
      { c: withBoth, expected: true },
    ];

    for (const { c, expected } of states) {
      const result = calculateEsopPool({ ...base, compliance: c });
      expect(result.medianEmployeeValue?.taxDeferralAvailable ?? false).toBe(expected);
    }
  });
});

/* 2 -------------------------------------------------------------------- */

describe('never cites Section 192(1C) as current, and never a 48-month window', () => {
  it('names 192(1C) only as superseded', () => {
    const bad = offenders((s) => /192\s*\(\s*1C\s*\)/i.test(s) && !/supersed|former|repeal|until/i.test(s));
    expect(bad).toEqual([]);
  });

  it('never puts 48 months on the deferral window', () => {
    const bad = offenders((s) => /\b48[-\s]month/i.test(s) || /\b48 months\b/i.test(s));
    expect(bad).toEqual([]);
  });

  it('cites the successor provisions on the engine tax row', () => {
    const base = buildSeedInputs();
    const result = calculateEsopPool({
      ...base,
      compliance: { ...base.compliance, dpiitRecognised: true, imbCertified80IAC: true },
    });
    const taxRow = result.complianceChecks.find((c: ComplianceCheck) => c.id === 'taxDeferral')!;

    expect(taxRow.statutoryReference).toContain('Section 392(3)');
    expect(taxRow.statutoryReference).toContain('Section 289(3)');
    expect(`${taxRow.finding} ${taxRow.action}`).toMatch(/60[-\s]month/);
  });
});

/* 3 -------------------------------------------------------------------- */

describe('never says a private company needs a special resolution for the scheme', () => {
  it('has no copy pairing a private company with a special resolution', () => {
    const bad = offenders((s) => /private/i.test(s) && /special resolution/i.test(s) && /scheme|adopt|approv/i.test(s));
    expect(bad).toEqual([]);
  });

  it('says ordinary resolution on the scheme-approval row for a private company', () => {
    const base = buildSeedInputs();
    const result = calculateEsopPool({
      ...base,
      company: { ...base.company, companyType: 'private' },
    });
    const row = result.complianceChecks.find((c: ComplianceCheck) => c.id === 'schemeApproval')!;

    expect(`${row.finding} ${row.action}`).toMatch(/ordinary resolution/i);
    expect(row.finding).not.toMatch(/special resolution/i);
  });

  it('still says special resolution for an unlisted public company', () => {
    const base = buildSeedInputs();
    const result = calculateEsopPool({
      ...base,
      company: { ...base.company, companyType: 'unlistedPublic' },
    });
    const row = result.complianceChecks.find((c: ComplianceCheck) => c.id === 'schemeApproval')!;

    expect(row.finding).toMatch(/special resolution/i);
  });
});

/* 4 -------------------------------------------------------------------- */

describe('never presents the Corporate Laws (Amendment) Bill 2026 as law', () => {
  it('qualifies every mention of the Bill', () => {
    const bad = offenders(
      (s) => /Amendment\) Bill 2026|Corporate Laws/i.test(s) && !/not in force|would recognise|until the Bill|not law/i.test(s),
    );
    expect(bad).toEqual([]);
  });

  it('names only options as recognised, on the row every founder sees', () => {
    const result = calculateEsopPool(buildSeedInputs());
    const row = result.complianceChecks.find((c: ComplianceCheck) => c.id === 'instrument')!;

    // M27: the row is `pass` for every founder who can reach the form, and
    // exists so the tool answers the RSU/SAR question rather than being
    // silent on a pending law.
    expect(row.finding).toMatch(/Section 62\(1\)\(b\) recognises today/i);
    expect(row.finding).not.toMatch(/RSU|SAR/i);
  });

  it('blocks and says "not in force" on the branch that names the Bill', () => {
    const base = buildSeedInputs();
    const result = calculateEsopPool({
      ...base,
      compliance: { ...base.compliance, instrument: 'RSU' },
    });
    const row = result.complianceChecks.find((c: ComplianceCheck) => c.id === 'instrument')!;

    expect(row.status).toBe('blocked');
    expect(row.finding).toMatch(/not in force/i);
    expect(row.finding).toMatch(/not recognised under Section 62\(1\)\(b\)/i);
  });
});

/* 5 -------------------------------------------------------------------- */

describe('never presents advisory benchmark ranges as data', () => {
  it('has no copy calling the advisory track data, evidence or a study', () => {
    // An explicit denial — "never data", "not measurement" — is the copy this
    // prohibition asks for, not a breach of it.
    const denies = /never data|not data|not measurement|not a measurement|opinion|observed data is/i;
    const bad = offenders(
      (s) => /advisory/i.test(s) && /\b(data|evidence|study|measured|observed)\b/i.test(s) && !denies.test(s),
    );
    expect(bad).toEqual([]);
  });

  it('says on screen that the advisory track is opinion', () => {
    const strip = sourceFiles(['.tsx']).find((f) => f.rel === '/results/BenchmarkStrip.tsx')!;
    expect(strip.text).toMatch(/Advisory consensus is opinion/);
    expect(strip.text).toMatch(/Neither is presented as the truth/);
  });

  it('shows both tracks together, never one alone', () => {
    const result = calculateEsopPool(buildSeedInputs());
    expect(result.benchmarkComparison.tracks).toHaveLength(2);

    const strip = sourceFiles(['.tsx']).find((f) => f.rel === '/results/BenchmarkStrip.tsx')!;
    expect(strip.text).toContain('tracks.map');
  });
});

/* 6 -------------------------------------------------------------------- */

describe('never outputs a pool percentage without the grant basis and strike policy on screen', () => {
  const headline = sourceFiles(['.tsx']).find((f) => f.rel === '/results/Headline.tsx')!;
  const bar = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/MobileSummaryBar.tsx')!;
  const panel = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ResultsPanel.tsx')!;

  it('prints both beside the headline percentage', () => {
    expect(headline.text).toContain('GRANT_BASIS_LABEL[recommendedPool.selected.grantBasisKind]');
    expect(headline.text).toContain('STRIKE_LABEL[recommendedPool.selected.strikePolicyKind]');
  });

  it('keeps the headline outside the tab strip, so no tab can show a percentage without them', () => {
    const [header = ''] = panel.text.split('<ResultTabs');
    expect(header).toContain('<Headline');
  });

  it('prints both on the mobile bar, which is the surface that outlives the headline', () => {
    // On a phone the headline scrolls away and this bar does not, so a pool
    // percentage here with no basis beside it is the prohibition, live.
    expect(bar.text).toContain('GRANT_BASIS_SHORT[selected.grantBasisKind]');
    expect(bar.text).toContain('STRIKE_SHORT[selected.strikePolicyKind]');
  });

  it('welds the two to the percentage in the engine type as well', () => {
    const result = calculateEsopPool(buildSeedInputs());
    expect(result.recommendedPool.selected.grantBasisKind).toBeTruthy();
    expect(result.recommendedPool.selected.strikePolicyKind).toBeTruthy();
  });
});

/* 7 -------------------------------------------------------------------- */

describe('never lets a compliance row appear without the disclaimer', () => {
  it('carries the literal on every row of a real run', () => {
    const result = calculateEsopPool(buildSeedInputs());
    expect(result.complianceChecks.length).toBeGreaterThan(0);

    for (const check of result.complianceChecks) {
      expect(check.disclaimer).toBe(COMPLIANCE_DISCLAIMER);
    }
  });

  it('renders it on every row rather than once per panel', () => {
    const checks = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ComplianceChecks.tsx')!;
    const [, perRow = ''] = checks.text.split('checks.map');
    expect(perRow).toContain('check.disclaimer');
  });
});
