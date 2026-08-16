/**
 * Chart colour palettes, light and dark. Mirrors the CSS custom properties in
 * globals.css, because Recharts needs paintable colour strings rather than
 * `var(...)` references it cannot always resolve inside SVG.
 *
 * `returned` is deliberately its own hue rather than a lighter/darker grey:
 * "Returned" and "Available" used to share the neutral-grey family and were
 * too close to tell apart in the pool runway chart.
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
  accentSoft: '#67b7a3',
  accentFaint: '#cfe6df',
  neutral: '#868f90',
  neutralSoft: '#dfe3e3',
  returned: '#3f6ea3',
  grid: '#e4e7e7',
  axis: '#868f90',
  surface: '#ffffff',
  text: '#0b0d0e',
  warn: '#8a5300',
};

export const DARK_PALETTE: ChartPalette = {
  accent: '#35c9a5',
  accentSoft: '#1f8a72',
  accentFaint: '#1b3c35',
  neutral: '#7d8788',
  neutralSoft: '#333a3b',
  returned: '#7fb3e0',
  grid: '#262b2c',
  axis: '#7d8788',
  surface: '#121516',
  text: '#f4f6f6',
  warn: '#e0ab5f',
};

export type ThemeMode = 'light' | 'dark';

export function paletteFor(theme: ThemeMode): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
