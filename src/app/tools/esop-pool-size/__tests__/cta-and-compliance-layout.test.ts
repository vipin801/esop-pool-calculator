import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

/**
 * Rewritten 2026-08-20. The original asserted a single centered layout with a
 * literal `className="... text-center ..."`, which was right while `CtaBand`
 * had one presentation. It now has two: the `band` below the report, still
 * centered on the warm surface, and the `aside` in the pre-results left rail,
 * left aligned under the masthead — a deliberate layout change, so the
 * assertion follows it rather than being deleted, the way LOG [020] rewrote a
 * test whose scope an architecture change had overtaken.
 *
 * What is still asserted, and is the point: the two presentations cannot
 * collapse into one. `band` must stay centered, `aside` must stay left, and
 * the button row must follow whichever it is in.
 */
describe('CtaBand: the band is centered, the aside is left-aligned', () => {
  const FILE = sourceFiles(['.tsx']).find((f) => f.rel === '/layout/CtaBand.tsx')!;
  const CODE = withoutComments(FILE.text);

  it('offers exactly the two presentations, and defaults to the band', () => {
    expect(CODE).toMatch(/variant\?: 'band' \| 'aside'/);
    expect(CODE).toMatch(/variant = 'band'/);
  });

  it('centers the band and left-aligns the aside on the same section', () => {
    expect(CODE).toContain("'text-left'");
    expect(CODE).toMatch(/text-center/);
    // The centered branch is the one that carries the filled surface; the
    // aside is unfilled, so a reader never meets a 420px centered card.
    expect(CODE).toMatch(/bg-muted[^']*text-center/);
  });

  it('keeps the button row aligned with whichever presentation it is in', () => {
    expect(CODE).toMatch(/flex flex-wrap gap-3 \$\{isAside \? '' : 'justify-center'\}/);
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
