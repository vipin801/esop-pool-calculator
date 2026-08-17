import { BANDS, DEFAULT_SENIORITY_MIX_PCT, type SeniorityMix } from '@/lib/esop';

/**
 * Pure, so the "cannot be left invalid" rule is a test rather than a claim
 * about a component. The engine normalises nothing — a mix that does not add
 * to 100 silently loses hires — so the form is the only place this can hold.
 */
export function mixTotal(mix: SeniorityMix): number {
  return BANDS.reduce((sum, band) => sum + Math.max(mix[band], 0), 0);
}

export function isMixValid(mix: SeniorityMix): boolean {
  return Math.round(mixTotal(mix)) === 100;
}

/**
 * Scale to 100 and push the rounding drift into the largest band, so the four
 * printed integers add to exactly 100 rather than to 99 or 101. An all-zero
 * mix has no proportions to preserve and falls back to the defaults table.
 */
export function normaliseMix(mix: SeniorityMix): SeniorityMix {
  const total = mixTotal(mix);
  if (total <= 0) return { ...DEFAULT_SENIORITY_MIX_PCT };

  const rounded = BANDS.map((band) => ({
    band,
    value: Math.round((Math.max(mix[band], 0) / total) * 100),
  }));
  const drift = 100 - rounded.reduce((sum, r) => sum + r.value, 0);

  if (drift !== 0) {
    const largest = rounded.reduce((best, r) => (r.value > best.value ? r : best), rounded[0]!);
    largest.value += drift;
  }

  const result = {} as Record<(typeof BANDS)[number], number>;
  for (const r of rounded) result[r.band] = r.value;
  return result;
}
