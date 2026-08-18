/**
 * Every on-screen chart is locked to its heading only (PROJECT.md D15).
 * `ChartFrame`'s `locked` branch is the single point that hides the legend,
 * the plotted series and the sr-only data table — this file checks each of
 * the four chart components passes `locked` through, that `ResultsPanel`
 * turns it on, and that `ReportCharts` (the PDF's off-screen render) does
 * not, since the download itself must still produce a real chart.
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

  it('hides the legend, the plotted children/caption and the sr-only table when locked', () => {
    expect(FRAME_CODE).toMatch(/!locked && keys/);
    // children/caption/the sr-only <table> all sit in the `locked ? (...) : (<>{children}...)` else arm.
    const [, afterLockedTernary = ''] = FRAME_CODE.split(/\{locked \? \(/);
    const [lockedArm = '', restArm = ''] = afterLockedTernary.split(') : (');
    expect(lockedArm).not.toContain('{children}');
    expect(lockedArm).not.toContain('<table>');
    expect(restArm).toContain('{children}');
    expect(restArm).toContain('<table>');
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
