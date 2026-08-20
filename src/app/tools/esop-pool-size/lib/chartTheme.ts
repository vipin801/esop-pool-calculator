/**
 * Chart colour palettes, light and dark. Mirrors the CSS custom properties in
 * globals.css, because Recharts needs paintable colour strings rather than
 * `var(...)` references it cannot always resolve inside SVG.
 *
 * Five keys are the Incentiv tokens, held here as literals for that reason
 * and annotated with the token each one is:
 *
 *   accent  = --accent  (2026-08-19 document swap; light is the hue-preserving
 *             a11y correction of `#3482ff`, dark is the document blue as-is)
 *   surface = --surface, which is also this app's --surface-raised
 *   text    = --ink
 *   axis    = --ink-2, the same token --text-faint reads
 *   grid    = --line
 *
 * **The other six are still UNMAPPED** — Incentiv ships no chart palette —
 * but two of them are no longer arbitrary, and the 2026-08-19 pass closed the
 * two defects PROJECT.md carried against this file:
 *
 * - `returned` was `#3f6ea3`, chosen in [021] to sit apart from a *mint*
 *   accent, and against a blue accent it had become the same hue family at
 *   nearly the same lightness — 1.10:1 between two marks `PoolRunwayChart`
 *   plots together. It is now the design system's own terracotta, deepened
 *   from the `#D4715D` display value to `#b85c46` so it clears 4.51:1 on the
 *   white panel rather than 3.32:1. Blue against orange is the one two-hue
 *   pair that survives every common colour-vision deficiency, which is what
 *   these two marks needed and did not have.
 * - `accentSoft` was a desaturated mint left over from the old accent, so the
 *   refresh bars did not read as a soft version of anything. It is now the
 *   accent's own hue at a higher lightness, and the three stacked series in
 *   `PoolRunwayChart` form a real ladder: 5.35 / 3.29 / 4.51 against the
 *   panel, in two hues.
 *
 * `neutral`/`neutralSoft` moved from cool grey to the warm grey the cream
 * ramp is built on, so the "current pool" and "planned" series stop reading
 * as a different temperature from every surface around them.
 *
 * Every series colour clears 3:1 against the panel it is drawn on, in both
 * themes — WCAG 1.4.11, which covers a bar or a line because the mark *is*
 * the information. Measured 2026-08-19: light 5.35/3.29/5.77/3.73/4.51/6.33,
 * dark 5.35/10.90/7.61/4.41/7.43/9.40, axis 6.84 and 6.47 against its 4.5
 * text floor.
 *
 * `grid` is the exception and is deliberately below 3:1. Grid lines are not
 * required to read the chart — the axis ticks carry the values and every
 * chart ships a screen-reader data table — and a 3:1 grid turns a small chart
 * into a cage.
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
  accent: '#0063e6', // --accent (2026-08-19 document swap, hue-preserving a11y correction)
  accentSoft: '#5b8fd9', // UNMAPPED, but now the accent's own hue
  accentFaint: '#d9e6fb', // UNMAPPED, and no consumer
  neutral: '#6b655c', // UNMAPPED, warm grey
  neutralSoft: '#8c8378', // UNMAPPED, warm grey
  returned: '#b85c46', // UNMAPPED, the design system's terracotta deepened for 4.5:1
  grid: '#e5e2dc', // --line
  axis: '#666666', // --ink-2
  surface: '#ffffff', // --surface
  text: '#1a1a1a', // --ink
  warn: '#8a5300', // UNMAPPED
};

export const DARK_PALETTE: ChartPalette = {
  accent: '#3482ff', // --accent (the document blue as-is; it clears 5.16:1 on dark)
  accentSoft: '#9dc4ff', // UNMAPPED, but now the accent's own hue
  accentFaint: '#16233a', // UNMAPPED, and no consumer
  neutral: '#a8a8a8', // UNMAPPED, neutral grey to match the dark ramp
  neutralSoft: '#7e7e7e', // UNMAPPED, neutral grey to match the dark ramp
  returned: '#e08a6e', // UNMAPPED, the design system's terracotta lifted for dark
  grid: '#2e2e2e', // --line
  axis: '#9a9a9a', // --ink-2
  surface: '#121212', // --surface (document §2 dark card, hsl(0 0% 7%))
  text: '#f5f3f0', // --ink
  warn: '#e0ab5f', // UNMAPPED
};

export type ThemeMode = 'light' | 'dark';

export function paletteFor(theme: ThemeMode): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
