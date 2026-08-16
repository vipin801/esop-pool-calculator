/**
 * Indian digit grouping and money formatting. Pure presentation — no business
 * logic lives here, per PROJECT.md's ban on locally computed engine numbers.
 */

const CRORE = 10_000_000;
const LAKH = 100_000;

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

const indianInt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatIndian(n: number, digits = 0): string {
  const v = safe(n);
  if (digits > 0) {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v);
  }
  return indianInt.format(Math.round(v));
}

export function formatMoney(n: number): string {
  return `₹${formatIndian(n)}`;
}

/** "≈ ₹1.50 crore" / "≈ ₹45.00 lakh" / "≈ ₹8,000" */
export function lakhCrore(n: number): string {
  const v = safe(n);
  if (v === 0) return '≈ ₹0';
  const abs = Math.abs(v);
  if (abs >= CRORE) return `≈ ₹${formatIndian(v / CRORE, 2)} crore`;
  if (abs >= LAKH) return `≈ ₹${formatIndian(v / LAKH, 2)} lakh`;
  return `≈ ₹${formatIndian(v)}`;
}

export function crores(n: number, digits = 1): string {
  return formatIndian(safe(n) / CRORE, digits);
}

export function toCrores(n: number): number {
  return safe(n) / CRORE;
}

export function formatPct(n: number, digits = 1): string {
  return `${formatIndian(safe(n), digits)}%`;
}

export function formatShares(n: number): string {
  return formatIndian(Math.max(0, Math.round(safe(n))));
}

/** Signed variant, for fields the engine deliberately leaves signed (M18). */
export function formatSignedShares(n: number): string {
  const v = safe(n);
  const sign = v < 0 ? '−' : '';
  return `${sign}${formatIndian(Math.abs(Math.round(v)))}`;
}

/** Month index (0-based, from the start of year 0) -> "Month 27 (Year 3)". */
export function monthLabel(monthIndex: number): string {
  const m = Math.max(0, Math.round(safe(monthIndex)));
  const year = Math.floor(m / 12) + 1;
  return `Month ${m} (Year ${year})`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, safe(n)));
}

export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : 0;
}
