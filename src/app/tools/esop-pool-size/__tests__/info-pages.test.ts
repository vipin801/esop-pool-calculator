/**
 * The two standalone info pages ("How it works", "FAQs"), their shared
 * chrome (`InfoPageShell`), the calculator-page section that links to them
 * (`HelpLinksBand`), and the footer link. Supersedes `how-it-works.test.ts`
 * now that the combined page split into two.
 *
 * `prohibitions.test.ts`'s `offenders()` sweep only scans quoted
 * string/template literals (`copyStringsOf`), not bare JSX text — so these
 * pages' prose, written directly as JSX children, would slip past that
 * sweep entirely. These are direct text assertions instead, the same
 * technique prohibitions.test.ts itself uses for BenchmarkStrip's on-screen
 * copy (`toMatch` against `.text`).
 */
import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

const SHELL = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/InfoPageShell.tsx')!;
const SHELL_CODE = withoutComments(SHELL.text);
const HOW_IT_WORKS = sourceFiles(['.tsx']).find((f) => f.rel === '/how-it-works/HowItWorksClient.tsx')!;
const HOW_IT_WORKS_CODE = withoutComments(HOW_IT_WORKS.text);
const FAQS = sourceFiles(['.tsx']).find((f) => f.rel === '/faqs/FaqsClient.tsx')!;
const FAQS_CODE = withoutComments(FAQS.text);
const HELP_LINKS = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/HelpLinksBand.tsx')!;
const HELP_LINKS_CODE = withoutComments(HELP_LINKS.text);
const FOOTER = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/Footer.tsx')!;
const CLIENT = sourceFiles(['.tsx']).find((f) => f.rel === '/EsopPoolSizeClient.tsx')!;

it('is reading the real files, not empty ones', () => {
  for (const file of [SHELL, HOW_IT_WORKS, FAQS, HELP_LINKS]) {
    expect(file.text.length).toBeGreaterThan(300);
  }
});

describe('InfoPageShell: the shared chrome both pages reuse', () => {
  it('renders Header, Footer and ThemeProvider, and a link back to the calculator', () => {
    expect(SHELL_CODE).toContain('<Header />');
    expect(SHELL_CODE).toContain('<Footer />');
    expect(SHELL_CODE).toContain('<ThemeProvider>');
    expect(SHELL_CODE).toMatch(/href="\/tools\/esop-pool-size"/);
    expect(SHELL_CODE).toContain('Back to the calculator');
  });

  it('cross-links the two info pages to each other', () => {
    expect(SHELL_CODE).toMatch(/href="\/tools\/esop-pool-size\/faqs"/);
    expect(SHELL_CODE).toMatch(/href="\/tools\/esop-pool-size\/how-it-works"/);
  });
});

describe('HowItWorksClient and FaqsClient both build on the shared shell, not their own chrome', () => {
  it('neither renders Header/Footer/ThemeProvider directly', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      expect(code).not.toContain('<Header');
      expect(code).not.toContain('<Footer');
      expect(code).not.toContain('<ThemeProvider');
      expect(code).toContain('<InfoPageShell');
    }
  });

  it('does not share state with EsopPoolSizeClient', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      expect(code).not.toContain('EsopPoolSizeClient');
    }
  });
});

describe('prohibition 1: never implies DPIIT recognition alone gives the tax deferral', () => {
  it('names the Inter-Ministerial Board wherever DPIIT and the deferral are named together', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      if (/\bDPIIT\b/.test(code) && /defer/i.test(code)) {
        expect(code).toMatch(/Inter-Ministerial/);
      }
    }
    // At least one of the two pages actually carries this content — a
    // vacuously-true loop above would pass even if both pages went silent
    // on DPIIT entirely.
    expect(FAQS_CODE + HOW_IT_WORKS_CODE).toMatch(/Inter-Ministerial/);
  });

  it('never cites the superseded 48-month window or Section 192(1C)', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      expect(code).not.toMatch(/48[-\s]month/i);
      expect(code).not.toMatch(/192\s*\(\s*1C\s*\)/i);
    }
  });
});

describe('prohibition 5: never presents advisory benchmarks as data', () => {
  it('reuses the exact, already-proven "opinion" framing rather than a fresh claim', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      if (/advisory/i.test(code)) {
        expect(code).toMatch(/Advisory consensus is opinion/);
        expect(code).toMatch(/Neither is presented as the truth/);
      }
    }
  });
});

describe('the Corporate Laws (Amendment) Bill 2026 and RSU/SAR are out of scope for both pages', () => {
  it('does not mention them at all, rather than risk an unqualified reference', () => {
    for (const code of [HOW_IT_WORKS_CODE, FAQS_CODE]) {
      expect(code).not.toMatch(/Amendment\) Bill|Corporate Laws|\bRSU\b|\bSAR\b/i);
    }
  });
});

describe('FAQs carries the "general information, not legal advice" framing', () => {
  it('has a disclaimer in the legal/tax FAQ answer', () => {
    expect(FAQS_CODE).toMatch(/not a substitute for legal or tax/i);
  });
});

describe('HelpLinksBand: the calculator-page section linking to both pages', () => {
  it('links to both info pages, titled to match', () => {
    expect(HELP_LINKS_CODE).toMatch(/href:\s*'\/tools\/esop-pool-size\/how-it-works'/);
    expect(HELP_LINKS_CODE).toMatch(/title:\s*'How it works'/);
    expect(HELP_LINKS_CODE).toMatch(/href:\s*'\/tools\/esop-pool-size\/faqs'/);
    expect(HELP_LINKS_CODE).toMatch(/title:\s*'FAQs'/);
  });

  it('is mounted in EsopPoolSizeClient, above the footer', () => {
    expect(withoutComments(CLIENT.text)).toContain('<HelpLinksBand />');
    const [beforeFooter = ''] = withoutComments(CLIENT.text).split('<Footer />');
    expect(beforeFooter).toContain('<HelpLinksBand />');
  });
});

describe('Footer links to the "How it works" page', () => {
  it('has a link pointing at the route', () => {
    expect(FOOTER.text).toMatch(/href="\/tools\/esop-pool-size\/how-it-works"/);
    expect(FOOTER.text).toContain('How this works');
  });
});
