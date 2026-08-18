import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

describe('CtaBand: content is centered, not left-aligned', () => {
  const FILE = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/CtaBand.tsx')!;
  const CODE = withoutComments(FILE.text);

  it('centers the section text and the button row as a group', () => {
    expect(CODE).toMatch(/<section className="[^"]*\btext-center\b[^"]*">/);
    expect(CODE).toMatch(/className="[^"]*flex[^"]*\bjustify-center\b[^"]*"/);
  });
});

describe('ComplianceChecks: the panel is a collapsible dropdown, not always-open', () => {
  const FILE = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ComplianceChecks.tsx')!;
  const CODE = withoutComments(FILE.text);
  // `CheckRow` (above `ComplianceChecks` in the file) has its own, unrelated
  // <summary>"Details"</summary> disclosure for the statutory reference —
  // isolate the panel function first so a split on '</summary>' can't grab
  // that inner one instead of the outer accordion's.
  const [, panelFn = ''] = CODE.split('export function ComplianceChecks');

  it('isolated the real function body, not an empty split', () => {
    expect(panelFn.length).toBeGreaterThan(200);
  });

  it('is a native <details>/<summary>, not a plain <section>', () => {
    expect(panelFn).toMatch(/<details className="[^"]*">/);
    expect(panelFn).toContain('<summary');
  });

  it('keeps the heading and the pass/attention summary inside <summary>, always visible', () => {
    const [, afterSummaryOpen = ''] = panelFn.split(/<summary[^>]*>/);
    const summaryBody = afterSummaryOpen.split('</summary>')[0] ?? '';
    expect(summaryBody).toContain('Compliance checks (India)');
    expect(summaryBody).toContain('{summary.join');
  });

  it('mounts the grouped rows only inside the collapsible body, not in <summary>', () => {
    const [, afterSummaryClose = ''] = panelFn.split('</summary>');
    expect(afterSummaryClose).toMatch(/GROUP_ORDER\.map/);
  });
});
