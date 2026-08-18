/**
 * "Why this number" gating. "You told us" carries only what the founder
 * actually supplied; "Model assumptions" is a locked teaser — no `minor`
 * field name or value anywhere in its markup, not even a count — and the
 * only way past it is the same lead-gated report download every other
 * "Download report" action already sits behind (D3).
 *
 * Static source checks, per this suite's convention (see ui-source.ts): the
 * component has no branch that renders an assumption's name or value, so
 * there is no fixture state to render past to catch a leak — the property
 * being asserted is of the source, not of one rendered state.
 */
import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

const FILE = sourceFiles(['.tsx']).find((f) => f.rel === '/results/WhyThisNumber.tsx')!;
const CODE = withoutComments(FILE.text);

it('is reading the real file, not an empty one', () => {
  expect(FILE.text.length).toBeGreaterThan(500);
});

describe('the "Model assumptions" column names no field and no value', () => {
  it('has no `minor`-tier assumption term anywhere in its executable source', () => {
    // The component's own doc comment names these (buffer, attrition,
    // vesting, exercise, strike…) to explain what used to leak — that prose
    // is stripped by `withoutComments` before this check runs, so a match
    // here can only come from real, renderable code.
    const forbidden = [
      /buffer/i,
      /attrition/i,
      /vest(ing|Years|Frequency)?/i,
      /cliffMonths/i,
      /exercise/i,
      /strike/i,
      /theta/i,
      /recycl/i,
      /\bsector\b/i,
      /compInflation|comp inflation/i,
      /refresh/i,
    ];
    for (const pattern of forbidden) {
      expect(CODE).not.toMatch(pattern);
    }
  });

  it('renders the locked column as opaque bars with no text node inside them', () => {
    const block = CODE.match(/<ul className="mt-1\.5 space-y-2" aria-hidden="true">([\s\S]*?)<\/ul>/)?.[1];
    expect(block).toBeTruthy();
    // Every child is a self-closing `<li ... />` — never a name or figure
    // rendered between an open and close tag.
    expect(block).not.toMatch(/<li[^/]*>[^<]+<\/li>/);
  });

  it('gates the deeper explanation behind the report download, not a free preview', () => {
    expect(CODE).toContain('Full model explanation');
    expect(CODE).toContain(
      'See the assumptions, scenarios and calculations supporting your ESOP pool recommendation.',
    );
    expect(CODE).toContain("'Download full report'");
    expect(CODE).toContain("'Preparing report…'");
    expect(CODE).toContain('disabled={!reportReady}');
    // No secondary escape hatch — e.g. a "view all assumptions" link that
    // opens `Your model` early — reintroducing the leak by another door.
    expect(CODE).not.toMatch(/view all assumptions|review assumptions/i);
  });
});

describe('"You told us" carries only founder-supplied values', () => {
  it('is built from founder-facing input paths only', () => {
    const founderPaths = [
      'inputs.company.stage',
      'inputs.company.existingUnallocatedOptions',
      'inputs.grantPolicy.grantBasis.kind',
      'inputs.hiring.horizonYears',
      'inputs.hiring.hiresPerYear',
      'inputs.hiring.seniorityMix.leadership',
      'inputs.company.postMoneyValuation',
      'inputs.growth.valuationGrowthPctPerYear',
    ];
    for (const path of founderPaths) {
      expect(CODE).toContain(path);
    }
  });

  it('never reads a `minor`-tier field path directly', () => {
    expect(CODE).not.toMatch(/inputs\.grantPolicy\.(bufferPct|compInflationPctPerYear|valueBasis|strikePolicy|fairValue|refresh)/);
    expect(CODE).not.toMatch(/inputs\.(attrition|exercise|vesting)\b/);
  });

  it('requires the leadership-hires line to be a touched, founder-answered value', () => {
    // hiring.seniorityMix.leadership carries a non-zero seeded default
    // (DEFAULTS.seniorityMixPct), so a bare `> 0` check would credit a
    // founder with a figure they never entered. The line must be gated on
    // `touched` as well.
    expect(CODE).toMatch(/leadershipHires > 0 && leadershipAnswered/);
    expect(CODE).toContain('META_LEADERSHIP_HIRES');
    expect(CODE).toMatch(/touched\.has\(META_LEADERSHIP_HIRES\)/);
    expect(CODE).toMatch(/touched\.has\('hiring\.seniorityMix\.leadership'\)/);
  });
});

describe('wiring: mounted in the results panel, with touch state reaching it', () => {
  const panel = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ResultsPanel.tsx')!;
  const client = sourceFiles(['.tsx']).find((f) => f.rel === '/EsopPoolSizeClient.tsx')!;

  it('is rendered by ResultsPanel', () => {
    expect(panel.text).toContain('<WhyThisNumber');
  });

  it('receives `touched` from ResultsPanel, which receives it from the client', () => {
    const [, whyCall = ''] = panel.text.split('<WhyThisNumber');
    expect(whyCall.split('/>')[0]).toContain('touched={touched}');
    expect(client.text).toMatch(/<ResultsPanel[\s\S]*?touched=\{touched\}[\s\S]*?\/>/);
  });
});
