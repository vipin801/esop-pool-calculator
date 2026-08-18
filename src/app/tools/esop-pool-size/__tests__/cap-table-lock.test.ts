/**
 * The cap table "after the recommended pool is reserved" and its summary in
 * `OwnershipImpact` both price the founders/investors split off
 * `company.founderOwnershipPctOfFullyDiluted`, a `reportOnly` field (D9) —
 * an invented example fact until a founder fills in section 07, not a
 * modelled result. Both are locked behind the report download so that
 * invented fact never reads as a computed answer for free. Static source
 * checks, per this suite's convention (see ui-source.ts): neither component
 * has a branch that renders the real figures for the locked rows, so there
 * is no fixture state to render past to catch a leak.
 */
import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

const PANEL = sourceFiles(['.tsx']).find((f) => f.rel === '/results/CapTablePanel.tsx')!;
const PANEL_CODE = withoutComments(PANEL.text);
const IMPACT = sourceFiles(['.tsx']).find((f) => f.rel === '/results/OwnershipImpact.tsx')!;
const IMPACT_CODE = withoutComments(IMPACT.text);

describe('CapTablePanel: the "after" table is locked, "before" is not', () => {
  it('renders capTables.before through the real table, capTables.after through the locked one', () => {
    expect(PANEL_CODE).toMatch(/<OneCapTable table=\{capTables\.before\}\s*\/>/);
    expect(PANEL_CODE).toMatch(/<LockedCapTable label=\{capTables\.after\.label\}\s*\/>/);
    expect(PANEL_CODE).not.toMatch(/<OneCapTable table=\{capTables\.after\}/);
  });

  it('LockedCapTable takes only a label — it cannot read a row or a figure', () => {
    const [, fn = ''] = PANEL_CODE.split('function LockedCapTable');
    const body = fn.split('function OneCapTable')[0] ?? '';
    // The header row is real (HEADERS — "Holder"/"Shares"/"% of fully
    // diluted", none of them a company fact) but there is no <tbody>, no
    // per-row mapping, and none of the formatters or label lookup a real
    // row would need.
    expect(body).toContain('HEADERS.map');
    expect(body).not.toContain('<tbody');
    expect(body).not.toMatch(/row\.|formatShares|formatPct|HOLDER_LABEL/);
    expect(body).toMatch(/aria-hidden="true"/);
    expect(body).toContain('The rows are locked until you download the full report.');
  });

  it('does not render a CSV export for the locked table', () => {
    const [, fn = ''] = PANEL_CODE.split('function LockedCapTable');
    const body = fn.split('function OneCapTable')[0] ?? '';
    expect(body).not.toContain('CopyCsvButton');
  });

  it('clips its own rounded corners so the blurred placeholder cannot bleed past them', () => {
    const [, fn = ''] = PANEL_CODE.split('function LockedCapTable');
    const body = fn.split('function OneCapTable')[0] ?? '';
    expect(body).toMatch(/className="overflow-hidden rounded-lg border border-border/);
  });
});

describe('ScenarioStrip: Slow/Fast detail blocks are locked, Base is not', () => {
  const STRIP = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ScenarioStrip.tsx')!;
  const STRIP_CODE = withoutComments(STRIP.text);

  // Isolate the percentage-and-below block — `key === 'base'` also gates the
  // unrelated "Current"/"Load" header above it, so splitting on the literal
  // percentage read pins this to the second occurrence, not the first.
  const [, afterPct = ''] = STRIP_CODE.split(
    "{formatPct(result.recommendedPool.selected.displayPoolPctOfFullyDiluted)}",
  );
  const [, afterBaseCond = ''] = afterPct.split(/key === 'base' \? \(/);
  const [baseArm = '', nonBaseArm = ''] = afterBaseCond.split(') : (');

  it('isolated real, non-empty branches to check', () => {
    expect(baseArm.length).toBeGreaterThan(50);
    expect(nonBaseArm.length).toBeGreaterThan(50);
  });

  it('only renders the dl/note for the base scenario', () => {
    expect(baseArm).toContain('<dl');
    expect(baseArm).toContain('currentPoolRunwayLabel');
    expect(baseArm).toContain('poolCostFor');
    expect(baseArm).toContain('{note}');
  });

  it('renders only opaque bars for the non-base branch, no label, figure or note text', () => {
    expect(nonBaseArm).not.toContain('<dl');
    expect(nonBaseArm).not.toContain('currentPoolRunwayLabel');
    expect(nonBaseArm).not.toContain('poolCostFor');
    expect(nonBaseArm).not.toContain('{note}');
    expect(nonBaseArm).not.toMatch(/Current pool|Founder cost/);
    expect(nonBaseArm).toMatch(/aria-hidden="true"/);
    expect(nonBaseArm).toMatch(/overflow-hidden/);
    expect(nonBaseArm).toMatch(/blur-\[1\.5px\]/);
  });

  it('still shows the headline percentage and the Load action for every scenario', () => {
    // The lock sits below the percentage read, and `Load` is rendered
    // unconditionally for any non-base, non-error scenario — neither is
    // inside the `key === 'base'` branch this test just checked.
    expect(STRIP_CODE).toMatch(/formatPct\(result\.recommendedPool\.selected\.displayPoolPctOfFullyDiluted\)/);
    expect(STRIP_CODE).toContain('Load');
  });
});

describe('OwnershipImpact: founders/investors after-pool and change are locked, pool is not', () => {
  it('marks founders and investors locked, and the pool row open', () => {
    expect(IMPACT_CODE).toMatch(/\{ holder: 'founders', label: 'Founders', locked: true \}/);
    expect(IMPACT_CODE).toMatch(/\{ holder: 'investors', label: 'Investors', locked: true \}/);
    expect(IMPACT_CODE).toMatch(/\{ holder: 'unallocatedPool', label: 'Pool', locked: false \}/);
  });

  it('renders a blurred placeholder, not formatPct, for a locked row\'s after/change cells', () => {
    // The two `locked ? (...) : (...)` branches must be the ones carrying the
    // blur; `formatPct(after` and the `change.toFixed` line must sit only in
    // the non-locked branch.
    expect(IMPACT_CODE).toMatch(/locked \? \([\s\S]*?blur-\[1\.5px\][\s\S]*?\) : \([\s\S]*?formatPct\(after, 1\)[\s\S]*?\)/);
    expect(IMPACT_CODE).toMatch(/locked \? \([\s\S]*?blur-\[1\.5px\][\s\S]*?\) : \([\s\S]*?change\.toFixed\(1\)[\s\S]*?\)/);
  });

  it('never prints the founders/investors after-pool percentage or delta as text', () => {
    // A regression that swapped the ternary order, or dropped the `locked`
    // check, would put `formatPct(after, 1)` or `{sign}` back on every row
    // unconditionally — one `locked ? (` guard per locked cell (after-pool,
    // change) is what stands between a real figure and the blur.
    const guardCount = (IMPACT_CODE.match(/locked \? \(/g) ?? []).length;
    expect(guardCount).toBe(2);
  });
});
