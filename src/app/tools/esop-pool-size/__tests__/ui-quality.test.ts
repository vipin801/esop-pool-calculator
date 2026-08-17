/**
 * The quality floor, as checks rather than as a review someone did once.
 *
 * Every rule here is one the PROJECT.md copy conventions or the P13 QA brief
 * names, and every one of them was broken somewhere in the tree before this
 * file existed. They are asserted against the source because that is where
 * the rule lives: a rendered assertion covers the one state it renders, and
 * the states that were wrong — dark mode, disabled, a chart with no tooltip
 * formatter — are the ones a happy-path render never reaches.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DARK_PALETTE, LIGHT_PALETTE, type ChartPalette } from '../lib/chartTheme';
import { formatIndian, formatIndianCompact, displayPoolPct } from '../lib/format';
import { isMixValid, mixTotal, normaliseMix } from '../lib/seniorityMix';
import { APP_DIR, jsxTextRuns, onScreenFiles, prosePropValues, sourceFiles, withoutComments, wordCount } from './ui-source';

/* ------------------------------------------------------------------------- *
 * Copy: no block over 25 words in the primary column
 * ------------------------------------------------------------------------- */

const WORD_BUDGET = 25;

describe('copy budget', () => {
  it('has no JSX text run over 25 words in any on-screen component', () => {
    const over: string[] = [];

    for (const file of onScreenFiles()) {
      for (const run of jsxTextRuns(withoutComments(file.text))) {
        if (wordCount(run) > WORD_BUDGET) over.push(`${file.rel}: (${wordCount(run)}w) ${run}`);
      }
    }

    expect(over).toEqual([]);
  });

  it('has no prose prop over 25 words in any on-screen component', () => {
    const over: string[] = [];

    for (const file of onScreenFiles()) {
      for (const value of prosePropValues(withoutComments(file.text))) {
        if (wordCount(value) > WORD_BUDGET) over.push(`${file.rel}: (${wordCount(value)}w) ${value}`);
      }
    }

    expect(over).toEqual([]);
  });

  it('has no copy string over 25 words in the on-screen lib modules', () => {
    const modules = sourceFiles(['.ts']).filter(
      (f) => f.rel.startsWith('/lib/') && !f.rel.includes('report') && !f.rel.includes('chartCapture'),
    );
    const over: string[] = [];

    for (const file of modules) {
      const text = withoutComments(file.text);
      // No newlines inside the literal: a character class that allows them
      // matches from one quote to the next across the whole file.
      for (const match of text.matchAll(/(?:'([^'\\\n]{40,})'|"([^"\\\n]{40,})"|`([^`\\\n]{40,})`)/g)) {
        const value = match[1] ?? match[2] ?? match[3] ?? '';
        if (wordCount(value) > WORD_BUDGET) over.push(`${file.rel}: (${wordCount(value)}w) ${value}`);
      }
    }

    expect(over).toEqual([]);
  });

  it('counts words the way the budget means it', () => {
    expect(wordCount('one two three')).toBe(3);
    expect(wordCount('a ${formatShares(n)} b')).toBe(3);
    expect(wordCount('  ')).toBe(0);
  });
});

/* ------------------------------------------------------------------------- *
 * Contrast, light and dark
 * ------------------------------------------------------------------------- */

const GLOBALS_CSS = readFileSync(join(APP_DIR, 'globals.css'), 'utf8');

function tokensFor(selector: string): Record<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(GLOBALS_CSS);
  if (!block) throw new Error(`No ${selector} block in globals.css`);

  const out: Record<string, string> = {};
  for (const match of (block[1] ?? '').matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})/gi)) {
    out[match[1]!] = match[2]!;
  }
  return out;
}

const LIGHT_TOKENS = tokensFor(':root');
const DARK_TOKENS = tokensFor('\\.dark');

function channel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** WCAG 1.4.3 for text under 18.66px — all of this tool's copy — and 1.4.11
 *  for the boundary of a control and for a plotted mark. */
const TEXT_MIN = 4.5;
const UI_MIN = 3;

interface Pair {
  readonly label: string;
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
}

function tokenPairs(t: Record<string, string>): readonly Pair[] {
  const surfaces: readonly [string, string][] = [
    ['surface', t['--surface']!],
    ['raised', t['--surface-raised']!],
    ['muted', t['--surface-muted']!],
  ];
  const inks: readonly [string, string, number][] = [
    ['ink', t['--text']!, TEXT_MIN],
    ['sub', t['--text-muted']!, TEXT_MIN],
    ['faint', t['--text-faint']!, TEXT_MIN],
    ['accent', t['--accent']!, TEXT_MIN],
  ];

  const pairs: Pair[] = [];
  for (const [sName, bg] of surfaces) {
    for (const [iName, fg, min] of inks) pairs.push({ label: `${iName} on ${sName}`, fg, bg, min });
    pairs.push({ label: `control border on ${sName}`, fg: t['--border-strong']!, bg, min: UI_MIN });
  }

  pairs.push(
    { label: 'accent ink on accent', fg: t['--accent-ink']!, bg: t['--accent']!, min: TEXT_MIN },
    { label: 'accent ink on accent hover', fg: t['--accent-ink']!, bg: t['--accent-hover']!, min: TEXT_MIN },
    { label: 'warn on warn-soft', fg: t['--warn']!, bg: t['--warn-soft']!, min: TEXT_MIN },
    { label: 'warn on raised', fg: t['--warn']!, bg: t['--surface-raised']!, min: TEXT_MIN },
    { label: 'danger on danger-soft', fg: t['--danger']!, bg: t['--danger-soft']!, min: TEXT_MIN },
    { label: 'danger on raised', fg: t['--danger']!, bg: t['--surface-raised']!, min: TEXT_MIN },
    { label: 'disabled text on disabled fill', fg: t['--text-disabled']!, bg: t['--surface-disabled']!, min: TEXT_MIN },
    { label: 'disabled text on raised', fg: t['--text-disabled']!, bg: t['--surface-raised']!, min: TEXT_MIN },
    { label: 'control border on disabled fill', fg: t['--border-strong']!, bg: t['--surface-disabled']!, min: UI_MIN },
  );
  return pairs;
}

/** Every plotted mark, against the panel `ChartFrame` draws it on. */
function chartPairs(p: ChartPalette): readonly Pair[] {
  return (['accent', 'accentSoft', 'neutral', 'neutralSoft', 'returned', 'warn', 'axis'] as const).map((key) => ({
    label: `chart ${key} on panel`,
    fg: p[key],
    bg: p.surface,
    min: key === 'axis' ? TEXT_MIN : UI_MIN,
  }));
}

describe.each([
  ['light', LIGHT_TOKENS, LIGHT_PALETTE],
  ['dark', DARK_TOKENS, DARK_PALETTE],
])('contrast in %s', (_theme, tokens, palette) => {
  const pairs = [...tokenPairs(tokens), ...chartPairs(palette)];

  it.each(pairs.map((p) => [p.label, p] as const))('%s clears its threshold', (_label, pair) => {
    expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });

  it('paints the chart panel the same colour the palette claims', () => {
    expect(palette.surface.toLowerCase()).toBe(tokens['--surface-raised']!.toLowerCase());
  });
});

describe('disabled states do not rely on transparency', () => {
  it('uses no opacity utility for a disabled control anywhere in the route', () => {
    const offenders = sourceFiles(['.tsx', '.ts'])
      .filter((f) => !f.rel.includes('/report'))
      .filter((f) => /disabled:opacity-/.test(f.text))
      .map((f) => f.rel);

    // `opacity-50` on a label measured 1.70:1 against the panel. WCAG exempts
    // an inactive control; a label nobody can read is still a defect.
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- *
 * Focus
 * ------------------------------------------------------------------------- */

describe('focus is always visible', () => {
  it('gives every field that suppresses its outline a replacement ring', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(['.tsx'])) {
      for (const line of withoutComments(file.text).split('\n')) {
        if (!line.includes('outline-none')) continue;
        // The ring lives on the wrapper, so accept it on either the same line
        // (LeadModal's shared class string) or anywhere in the file.
        if (!line.includes('focus-ring') && !file.text.includes('focus-ring')) {
          offenders.push(`${file.rel}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('defines the replacement ring in globals.css', () => {
    expect(GLOBALS_CSS).toMatch(/\.focus-ring:has\(:focus-visible\)\s*\{[^}]*outline:/);
  });

  it('keeps a global :focus-visible outline for everything else', () => {
    expect(GLOBALS_CSS).toMatch(/:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--accent\)/);
  });
});

/* ------------------------------------------------------------------------- *
 * Every control has a name
 * ------------------------------------------------------------------------- */

describe('form controls are named', () => {
  const INPUT_CARDS = sourceFiles(['.tsx']).filter((f) => f.rel.startsWith('/inputs/'));

  it('gives every Field either a control to point at or a group role', () => {
    const field = sourceFiles(['.tsx']).find((f) => f.rel === '/ui/Field.tsx')!;
    // The label used to sit in a sibling div with no `htmlFor` and no
    // wrapping, so every input in the rail reached assistive technology
    // unnamed and was announced by its own value.
    expect(field.text).toContain('htmlFor={htmlFor}');
    expect(field.text).toContain("role={asGroup ? 'group' : undefined}");
    expect(field.text).toContain('aria-labelledby={asGroup ? labelId : undefined}');
  });

  it('points at least ten Fields at a real control', () => {
    const wired = INPUT_CARDS.flatMap((f) => [...f.text.matchAll(/htmlFor="([a-z0-9-]+)"/g)].map((m) => m[1]!));
    expect(wired.length).toBeGreaterThanOrEqual(10);

    // Every id a Field points at must exist as a control id in the same card.
    for (const file of INPUT_CARDS) {
      for (const match of file.text.matchAll(/htmlFor="([a-z0-9-]+)"/g)) {
        expect(file.text).toContain(`id="${match[1]}"`);
      }
    }
  });

  it('names a radio option by its label, never by its enum value', () => {
    const radio = sourceFiles(['.tsx']).find((f) => f.rel === '/ui/RadioGroup.tsx')!;
    expect(radio.text).toContain('aria-labelledby=');
    expect(radio.text).toContain('aria-describedby=');
  });

  it('names every control that sits inside a multi-control group', () => {
    // These have no `Field` label of their own, so they carry an `ariaLabel`.
    const inGroups = [
      'strike-discount',
      'company-granted-band',
      'company-granted-age',
      'hires-y',
      'mix-',
      'grant-pct-',
      'grant-value-',
    ];
    const all = INPUT_CARDS.map((f) => f.text).join('\n');

    for (const id of inGroups) {
      const at = all.indexOf(id.endsWith('-') ? `id={\`${id}` : `id="${id}"`);
      const fallback = all.indexOf(`id={\`${id}`);
      const start = at >= 0 ? at : fallback;
      expect(start, `no control found for ${id}`).toBeGreaterThan(-1);
      expect(all.slice(start, start + 260), `${id} has no ariaLabel`).toContain('ariaLabel');
    }
  });
});

/* ------------------------------------------------------------------------- *
 * Charts: Indian grouping, reduced motion, screen-reader tables
 * ------------------------------------------------------------------------- */

const CHART_FILES = sourceFiles(['.tsx']).filter((f) => f.rel.startsWith('/results/charts/'));

describe('charts', () => {
  it('finds all four chart components', () => {
    expect(CHART_FILES.map((f) => f.rel).sort()).toEqual([
      '/results/charts/GrantCostChart.tsx',
      '/results/charts/HiresSupportedChart.tsx',
      '/results/charts/PoolPctChart.tsx',
      '/results/charts/PoolRunwayChart.tsx',
    ]);
  });

  it.each(CHART_FILES.map((f) => [f.rel, f] as const))('%s formats every tooltip', (_rel, file) => {
    const tooltips = file.text.match(/<Tooltip\b[\s\S]*?\/>/g) ?? [];
    expect(tooltips.length).toBeGreaterThan(0);
    // A Recharts tooltip with no formatter prints the raw number, ungrouped —
    // which is exactly how the grant-cost chart was escaping the convention.
    for (const tooltip of tooltips) expect(tooltip).toContain('formatter=');
  });

  it.each(CHART_FILES.map((f) => [f.rel, f] as const))('%s formats every y-axis tick', (_rel, file) => {
    const axes = file.text.match(/<YAxis\b[\s\S]*?\/>/g) ?? [];
    expect(axes.length).toBeGreaterThan(0);
    for (const axis of axes) expect(axis).toContain('tickFormatter=');
  });

  it.each(CHART_FILES.map((f) => [f.rel, f] as const))('%s honours prefers-reduced-motion', (_rel, file) => {
    expect(file.text).toContain('usePrefersReducedMotion');

    const series = file.text.match(/<(Bar|Line|Area)\b[\s\S]*?\/>/g) ?? [];
    expect(series.length).toBeGreaterThan(0);
    for (const mark of series) expect(mark).toContain('isAnimationActive={animate}');
  });

  it.each(CHART_FILES.map((f) => [f.rel, f] as const))('%s ships a screen-reader data table', (_rel, file) => {
    expect(file.text).toContain('dataTable={{');
  });

  it('wraps the screen-reader table in a block, not on the table itself', () => {
    const frame = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ChartFrame.tsx')!;
    // `display: table` treats `width: 1px` as a minimum, so an `sr-only`
    // table is a 610px box `overflow: hidden` does not clip — it gave the
    // whole page a horizontal scrollbar at 375px.
    expect(frame.text).toMatch(/<div className="sr-only">\s*<table>/);
    expect(frame.text).not.toMatch(/<table className="sr-only"/);
  });

  it('styles the Recharts 3 tick class, not the class Recharts 2 used', () => {
    expect(GLOBALS_CSS).toContain('.recharts-cartesian-axis-tick-value');
  });
});

/* ------------------------------------------------------------------------- *
 * Indian digit grouping
 * ------------------------------------------------------------------------- */

describe('Indian digit grouping', () => {
  it('never asks for a locale other than en-IN', () => {
    const offenders = sourceFiles(['.ts', '.tsx'])
      .filter((f) => /toLocaleString\(|Intl\.NumberFormat\(/.test(f.text))
      .filter((f) => !/en-IN/.test(f.text))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  it('groups by lakh and crore, not by thousand', () => {
    expect(formatIndian(701021)).toBe('7,01,021');
    expect(formatIndian(10660056)).toBe('1,06,60,056');
    expect(formatIndian(1234)).toBe('1,234');
  });

  it('shortens an axis tick in the Indian scale', () => {
    expect(formatIndianCompact(600000)).toBe('6.0L');
    expect(formatIndianCompact(-600000)).toBe('-6.0L');
    expect(formatIndianCompact(10660056)).toBe('1.07Cr');
    expect(formatIndianCompact(8000)).toBe('8,000');
  });

  it('puts no space before the suffix, because Recharts breaks a tick there', () => {
    // `-6.0 L` rendered as two stacked lines on the runway chart's negative
    // ticks while `6.0 L` stayed on one.
    expect(formatIndianCompact(600000)).not.toMatch(/\s/);
    expect(formatIndianCompact(-12000000)).not.toMatch(/\s/);
  });
});

/* ------------------------------------------------------------------------- *
 * One pool, one rounding
 * ------------------------------------------------------------------------- */

describe('the displayed pool percentage', () => {
  it('rounds up to the nearest half point', () => {
    expect(displayPoolPct(6.55)).toBeCloseTo(7, 10);
    expect(displayPoolPct(6.19)).toBeCloseTo(6.5, 10);
    expect(displayPoolPct(7)).toBeCloseTo(7, 10);
  });

  it('is applied wherever a headline pool percentage is printed', () => {
    // The mobile bar printed 6.6% under a headline printing 7.0% — one pool
    // at two roundings, because only the headline used the rule.
    for (const rel of ['/results/Headline.tsx', '/layout/MobileSummaryBar.tsx']) {
      const file = sourceFiles(['.tsx']).find((f) => f.rel === rel)!;
      expect(file.text).toContain('displayPoolPct(');
    }
  });
});

/* ------------------------------------------------------------------------- *
 * A percentage split that must sum to 100 cannot be left invalid
 * ------------------------------------------------------------------------- */

describe('the seniority mix', () => {
  const CASES = [
    { leadership: 5, senior: 20, mid: 45, junior: 30 },
    { leadership: 50, senior: 20, mid: 45, junior: 30 },
    { leadership: 1, senior: 1, mid: 1, junior: 0 },
    { leadership: 0, senior: 0, mid: 0, junior: 0 },
    { leadership: 100, senior: 100, mid: 100, junior: 100 },
    { leadership: 33, senior: 33, mid: 33, junior: 0 },
    { leadership: -10, senior: 60, mid: 20, junior: 20 },
  ];

  it.each(CASES.map((c) => [JSON.stringify(c), c] as const))('normalises %s to exactly 100', (_label, mix) => {
    const normalised = normaliseMix(mix);
    expect(mixTotal(normalised)).toBe(100);
    expect(isMixValid(normalised)).toBe(true);
  });

  it('leaves a valid mix alone', () => {
    const mix = { leadership: 5, senior: 20, mid: 45, junior: 30 };
    expect(normaliseMix(mix)).toEqual(mix);
  });

  it('pushes the rounding drift into the largest band, never into a new total', () => {
    const normalised = normaliseMix({ leadership: 33, senior: 33, mid: 33, junior: 0 });
    expect(mixTotal(normalised)).toBe(100);
    expect(Math.max(...Object.values(normalised))).toBe(34);
  });

  it('rebalances the group when focus leaves it, not only on the button', () => {
    const component = sourceFiles(['.tsx']).find((f) => f.rel === '/inputs/SeniorityMix.tsx')!;
    expect(component.text).toContain('onBlur={onBlurCapture}');
    expect(component.text).toContain("rebalance('blur')");
    expect(component.text).toContain('aria-live="polite"');
  });
});

/* ------------------------------------------------------------------------- *
 * One result object, one primary action
 * ------------------------------------------------------------------------- */

describe('information architecture', () => {
  const panel = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ResultsPanel.tsx')!;

  it('puts every result section behind one tab strip', () => {
    const ids = [...panel.text.matchAll(/id: '([a-z-]+)',\n\s+label:/g)].map((m) => m[1]);
    expect(ids).toEqual(['overview', 'runway', 'hiring-cost', 'year-by-year', 'cap-table', 'compliance']);
  });

  it('keeps the headline and both exhaustion lines out of the tabs', () => {
    const [header = '', tabsRegion = ''] = panel.text.split('<ResultTabs');
    expect(header).toContain('<Headline');
    expect(tabsRegion).not.toContain('<Headline');
  });

  it('renders exactly one primary button in the whole route', () => {
    const primaries = sourceFiles(['.tsx'])
      .filter((f) => !f.rel.includes('/report'))
      .flatMap((f) => [...f.text.matchAll(/variant="primary"/g)].map(() => f.rel));

    // The header is sticky and the CTA band sits under the result, so a
    // second primary would share a viewport with the tool's own.
    expect(primaries).toEqual([]);
    expect(panel.text).toMatch(/<Button onClick=\{onDownload\}/);
  });

  it('implements the tabs with the ARIA tabs pattern', () => {
    const tabs = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ResultTabs.tsx')!;
    for (const needle of [
      'role="tablist"',
      'role="tab"',
      'role="tabpanel"',
      'aria-selected',
      'aria-controls',
      'aria-labelledby',
      "'ArrowRight'",
      "'ArrowLeft'",
      "'Home'",
      "'End'",
      'tabIndex={selected ? 0 : -1}',
    ]) {
      expect(tabs.text).toContain(needle);
    }
  });

  it('traps focus in the lead modal and gives it back', () => {
    const modal = sourceFiles(['.tsx']).find((f) => f.rel === '/results/LeadModal.tsx')!;
    expect(modal.text).toContain("event.key === 'Escape'");
    expect(modal.text).toContain("event.key !== 'Tab'");
    expect(modal.text).toContain('opener?.focus?.()');
    expect(modal.text).toContain('aria-modal="true"');
  });

  it('mounts the report charts off screen rather than hiding them', () => {
    const reportCharts = sourceFiles(['.tsx']).find((f) => f.rel === '/results/ReportCharts.tsx')!;
    // Tabs unmount three of the four charts, so the PDF scrapes this tree.
    // `display: none` would give ResponsiveContainer a zero box and the
    // capture a 1x1 image.
    expect(reportCharts.text).toContain("left: '-20000px'");
    expect(reportCharts.text).toContain('aria-hidden="true"');
    expect(withoutComments(reportCharts.text)).not.toContain('display');
  });
});
