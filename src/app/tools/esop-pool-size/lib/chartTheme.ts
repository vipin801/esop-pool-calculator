/**
 * Chart colour palettes, light and dark. Mirrors the CSS custom properties in
 * globals.css, because Recharts needs paintable colour strings rather than
 * `var(...)` references it cannot always resolve inside SVG.
 *
 * Five keys are the Incentiv tokens, held here as literals for that reason
 * and annotated with the token each one is:
 *
 *   accent  = --accent  (2026-08-18 live-site retune; light is a11y-corrected,
 *             dark is the measured value as-is — see globals.css)
 *   surface = --surface, which is also this app's --surface-raised
 *   text    = --ink
 *   axis    = --ink-2, the same token --text-faint reads
 *   grid    = --line
 *
 * **The other six are UNMAPPED.** Incentiv ships no chart palette, so
 * `accentSoft`, `accentFaint`, `neutral`, `neutralSoft`, `returned` and `warn`
 * keep the values this tool already used. Two consequences are real and are
 * carried in PROJECT.md rather than quietly absorbed:
 *
 * - `returned` (#3f6ea3 light) was chosen in [021] to sit apart from a *mint*
 *   accent. Against the Incentiv blue it is the same hue family at nearly the
 *   same lightness — 1.10:1 between the two marks in light — and the pool
 *   runway chart plots them together.
 * - `accentSoft` is still the desaturated mint that matched the old accent,
 *   so the refresh bars no longer read as a soft version of the new one.
 *
 * Every series colour still clears 3:1 against the panel it is drawn on, in
 * both themes — WCAG 1.4.11, which covers a bar or a line because the mark
 * *is* the information. Re-measured against the 2026-08-18 retune: light
 * 5.35/3.33/4.91/3.27/5.29/6.33, dark 6.59/4.40/7.27/3.51/8.41/9.06, axis 5.74
 * and 6.58 against its 4.5 text floor.
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
  accent: '#0063e6', // --accent (2026-08-18 live-site retune, a11y-corrected — see globals.css)
  accentSoft: '#55998a', // UNMAPPED
  accentFaint: '#cfe6df', // UNMAPPED, and no consumer
  neutral: '#6b7273', // UNMAPPED
  neutralSoft: '#8b8f8f', // UNMAPPED
  returned: '#3f6ea3', // UNMAPPED
  grid: '#e5e1dc', // --line
  axis: '#666666', // --ink-2
  surface: '#ffffff', // --surface
  text: '#1a1a1a', // --ink
  warn: '#8a5300', // UNMAPPED
};

export const DARK_PALETTE: ChartPalette = {
  accent: '#4d9aff', // --accent (2026-08-18 live-site retune — measured value, no correction needed)
  accentSoft: '#1f8a72', // UNMAPPED
  accentFaint: '#1b3c35', // UNMAPPED, and no consumer
  neutral: '#9aa3a4', // UNMAPPED
  neutralSoft: '#666c6d', // UNMAPPED
  returned: '#7fb3e0', // UNMAPPED
  grid: '#2e2e2e', // --line
  axis: '#999999', // --ink-2
  surface: '#121212', // --surface
  text: '#f5f3f0', // --ink
  warn: '#e0ab5f', // UNMAPPED
};

export type ThemeMode = 'light' | 'dark';

export function paletteFor(theme: ThemeMode): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
