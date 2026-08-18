/**
 * Every on-screen chart is locked behind the report download (PROJECT.md
 * D15). `ChartFrame`'s `locked` branch is the single point that renders the
 * real chart blurred and non-interactive — legend and the sr-only data
 * table (exact figures, not a picture) are hidden outright, but the chart
 * itself stays real, per an explicit follow-up instruction that a flat
 * placeholder read as broken rather than locked. This file checks each of
 * the four chart components passes `locked` through, that `ResultsPanel`
 * turns it on, that the blurred chart can't be hovered for a tooltip, and
 * that `ReportCharts` (the PDF's off-screen render) never locks, since the
 * download itself must still produce a real, sharp chart.
 */
import { describe, expect, it } from 'vitest';
import { sourceFiles, withoutComments } from './ui-source';

const FRAME = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ChartFrame.tsx')!;
const FRAME_CODE = withoutComments(FRAME.text);
const CHART_FILES = sourceFiles(['.tsx']).filter((f) => f.rel.startsWith('/results/charts/'));
const PANEL = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ResultsPanel.tsx')!;
const REPORT_CHARTS = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ReportCharts.tsx')!;

it('is reading a real set of chart files, not an empty one', () => {
  expect(CHART_FILES.length).toBeGreaterThanOrEqual(4);
});

describe('ChartFrame: locked hides everything but the heading', () => {
  it('has a locked prop, default false', () => {
    expect(FRAME_CODE).toMatch(/locked\?:\s*boolean/);
    expect(FRAME_CODE).toContain('locked = false');
  });

  it('renders the heading (title) unconditionally, outside the locked branch', () => {
    const [beforeLockedBranch = ''] = FRAME_CODE.split(/\{locked \? \(/);
    expect(beforeLockedBranch).toContain('{title}');
  });

  it('hides the legend and the sr-only table when locked, but still renders the real chart', () => {
    expect(FRAME_CODE).toMatch(/!locked && keys/);
    // children/caption/the sr-only <table> all sit in the `locked ? (...) : (<>{children}...)` else arm.
    const [, afterLockedTernary = ''] = FRAME_CODE.split(/\{locked \? \(/);
    const [lockedArm = '', restArm = ''] = afterLockedTernary.split(') : (');
    // The chart itself renders in the locked arm too — a flat grey box read
    // as broken rather than locked, per the founder's own follow-up. Only
    // the caption and the sr-only exact-figures table are still cut.
    expect(lockedArm).toContain('{children}');
    expect(lockedArm).not.toContain('<table>');
    expect(lockedArm).not.toMatch(/\{caption \?/);
    expect(restArm).toContain('{children}');
    expect(restArm).toContain('<table>');
  });

  it('blurs the real chart and strips it of interaction, so a hover can never reveal an exact figure', () => {
    const [, afterLockedTernary = ''] = FRAME_CODE.split(/\{locked \? \(/);
    const [lockedArm = ''] = afterLockedTernary.split(') : (');
    expect(lockedArm).toMatch(/blur-md/);
    expect(lockedArm).toMatch(/pointer-events-none/);
    expect(lockedArm).toMatch(/aria-hidden="true"/);
  });

  it('shows a visible "download the report" message in the locked branch', () => {
    const [, afterLockedTernary = ''] = FRAME_CODE.split(/\{locked \? \(/);
    const [lockedArm = ''] = afterLockedTernary.split(') : (');
    expect(lockedArm).toMatch(/Download the report to see this chart/);
    expect(lockedArm).not.toMatch(/\bsr-only\b/); // visible, not screen-reader-only
  });
});

describe('every chart component threads locked through to ChartFrame', () => {
  for (const file of CHART_FILES) {
    it(`${file.rel} accepts and forwards locked`, () => {
      const code = withoutComments(file.text);
      expect(code).toMatch(/locked\??:\s*boolean/);
      expect(code).toMatch(/locked=\{locked\}/);
    });
  }
});

describe('ResultsPanel locks every on-screen chart', () => {
  it('passes locked to all four chart components', () => {
    const code = withoutComments(PANEL.text);
    expect(code).toMatch(/<PoolRunwayChart[^>]*\blocked\b[^>]*\/>/);
    expect(code).toMatch(/<PoolPctChart[^>]*\blocked\b[^>]*\/>/);
    expect(code).toMatch(/<HiresSupportedChart[^>]*\blocked\b[^>]*\/>/);
    expect(code).toMatch(/<GrantCostChart[\s\S]*?\blocked\b[\s\S]*?\/>/);
  });
});

describe('ReportCharts never locks its off-screen charts', () => {
  it('does not pass locked at all — the PDF the download produces must show real charts', () => {
    expect(withoutComments(REPORT_CHARTS.text)).not.toMatch(/\blocked\b/);
  });
});
