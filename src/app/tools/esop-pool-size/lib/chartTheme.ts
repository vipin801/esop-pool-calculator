/**
 * Chart colour palettes, light and dark. Mirrors the CSS custom properties in
 * globals.css, because Recharts needs paintable colour strings rather than
 * `var(...)` references it cannot always resolve inside SVG.
 *
 * `returned` is deliberately its own hue rather than a lighter/darker grey:
 * "Returned" and "Available" used to share the neutral-grey family and were
 * too close to tell apart in the pool runway chart.
 *
 * Every series colour clears 3:1 against the panel it is drawn on, in both
 * themes — WCAG 1.4.11, which covers a bar or a line because the mark *is*
 * the information. Three failed before this: light `accentSoft` at 2.37:1
 * (the refresh bars), and `neutralSoft` at 1.29:1 light and 1.58:1 dark (the
 * planned-hires bars, which were effectively invisible on white).
 *
 * `grid` is the exception and is deliberately below 3:1. Grid lines are not
 * required to read the chart — the axis ticks carry the values and every
 * chart ships a screen-reader data table — and a 3:1 grid turns a small chart
 * into a cage. It is raised from the divider grey for legibility at 375px,
 * not to a threshold it does not owe.
 */
export interface ChartPalette {
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentFaint: string;
  readonly neutral: string;
  readonly neutralSoft: string;
  readonly returned: string;
  readonly grid: string;
  readonly axis: string;
  readonly surface: string;
  readonly text: string;
  readonly warn: string;
}

export const LIGHT_PALETTE: ChartPalette = {
  accent: '#0e7c66',
  accentSoft: '#55998a',
  accentFaint: '#cfe6df',
  neutral: '#6b7273',
  neutralSoft: '#8b8f8f',
  returned: '#3f6ea3',
  grid: '#d9dddd',
  axis: '#666d6e',
  surface: '#ffffff',
  text: '#0b0d0e',
  warn: '#8a5300',
};

export const DARK_PALETTE: ChartPalette = {
  accent: '#35c9a5',
  accentSoft: '#1f8a72',
  accentFaint: '#1b3c35',
  neutral: '#9aa3a4',
  neutralSoft: '#666c6d',
  returned: '#7fb3e0',
  grid: '#2e3435',
  axis: '#7d8788',
  surface: '#121516',
  text: '#f4f6f6',
  warn: '#e0ab5f',
};

export type ThemeMode = 'light' | 'dark';

export function paletteFor(theme: ThemeMode): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
