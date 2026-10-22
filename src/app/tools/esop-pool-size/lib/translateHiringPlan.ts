/**
 * Deterministic translations from the simple onboarding screens (design.md
 * §4.2–4.4) to the engine's own shapes. The engine has exactly two
 * hiring-shaped inputs — `hiring.hiresPerYear` (one number per plan year) and
 * `hiring.seniorityMix` (one split for the whole horizon, not per year) — and
 * exactly two per-band grant tables (`grantPctByBand`, `grantValueByBand`).
 * Nothing here is a hidden judgment call: every constant and formula is the
 * one written down in design.md §4.3/§4.4, so a mapping can be read here
 * instead of reverse-engineered from a component.
 *
 * Pure functions throughout, the same discipline `lib/seniorityMix.ts` and
 * `lib/format.ts` already hold to — no engine call, no DOM, no clock.
 */
import { BANDS, DEFAULTS, DEFAULT_GRANT_PCT_BY_BAND, DEFAULT_GRANT_VALUE_BY_BAND, DEFAULT_SENIORITY_MIX_PCT, type Band, type SeniorityMix } from '@/lib/esop';
import { clamp } from './format';

export type HiringTiming = 'earlier' | 'even' | 'later';
export type TeamProfile = 'juniorHeavy' | 'balanced' | 'seniorHeavy';
export type GrantPhilosophy = 'conservative' | 'market' | 'generous';

/**
 * weight_i, one-indexed over `1..horizonYears`: uniform for "evenly spread";
 * a decreasing line, year 1 heaviest, for "earlier"; an increasing line, the
 * final year heaviest, for "later". design.md §4.3.
 */
function weightsFor(horizonYears: number, timing: HiringTiming): readonly number[] {
  return Array.from({ length: horizonYears }, (_, idx) => {
    const i = idx + 1;
    if (timing === 'earlier') return horizonYears - i + 1;
    if (timing === 'later') return i;
    return 1;
  });
}

/**
 * Splits `totalHires` across `horizonYears` by `timing`'s weight curve, using
 * the largest-remainder method: floor every year's proportional share, then
 * hand the leftover hires — the total minus the sum of the floors, always a
 * small non-negative integer — one each to the years whose fractional part
 * was largest. `sum(result) === totalHires` exactly, never off by a rounding
 * unit the way a naive per-year round() can be.
 */
export function distributeHires(totalHires: number, horizonYears: number, timing: HiringTiming): number[] {
  const hires = Math.max(0, Math.round(totalHires));
  const years = Math.max(1, Math.round(horizonYears));
  const weights = weightsFor(years, timing);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  const shares = weights.map((w) => (hires * w) / weightSum);
  const floors = shares.map((s) => Math.floor(s));
  let remainder = hires - floors.reduce((sum, f) => sum + f, 0);

  const byRemainderDesc = shares
    .map((s, i) => ({ i, frac: s - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (const { i } of byRemainderDesc) {
    if (remainder <= 0) break;
    result[i]! += 1;
    remainder -= 1;
  }
  return result;
}

const TEAM_PROFILE_PRESET: Readonly<Record<TeamProfile, SeniorityMix>> = {
  juniorHeavy: { leadership: 2, senior: 13, mid: 35, junior: 50 },
  /** Identical to `DEFAULT_SENIORITY_MIX_PCT` — this preset is not a new
   *  figure, it names the mix the tool already defaults to. */
  balanced: { ...DEFAULT_SENIORITY_MIX_PCT },
  seniorHeavy: { leadership: 10, senior: 30, mid: 40, junior: 20 },
};

/**
 * The team-profile preset gives every band's share; the leadership-hires
 * field then overrides leadership's share directly, and the other three
 * bands are rescaled proportionally so the mix still sums to 100 — never a
 * silent "leadership stays at the preset's share regardless of what was
 * typed". design.md §4.3.
 *
 * `totalHires <= 0` returns the preset unchanged: there is no rate to compute
 * leadership's share against, and zero hires is a validation state (design.md
 * §7), not a mix this function should try to price.
 */
export function mixFromProfile(profile: TeamProfile, leadershipHires: number, totalHires: number): SeniorityMix {
  const preset = TEAM_PROFILE_PRESET[profile];
  if (totalHires <= 0) return { ...preset };

  const leadershipPct = clamp(Math.round(((100 * Math.max(0, leadershipHires)) / totalHires) * 10) / 10, 0, 100);
  const remainingPct = 100 - leadershipPct;
  const nonLeadershipTotal = preset.senior + preset.mid + preset.junior;
  const scale = nonLeadershipTotal > 0 ? remainingPct / nonLeadershipTotal : 0;

  return {
    leadership: leadershipPct,
    senior: preset.senior * scale,
    mid: preset.mid * scale,
    junior: preset.junior * scale,
  };
}

/**
 * Basis A (percent of equity): the three philosophies read the spec's own
 * advisory range, already in `DEFAULTS` — `grantPctLowByBand`/`grantPctByBand`
 * (the M1 midpoint)/`grantPctHighByBand`. No new figure is invented; this
 * only names the three points on a range the engine already carries.
 */
export function grantPctPresetFor(philosophy: GrantPhilosophy): Record<Band, number> {
  const source =
    philosophy === 'conservative'
      ? DEFAULTS.grantPctLowByBand.value
      : philosophy === 'generous'
        ? DEFAULTS.grantPctHighByBand.value
        : DEFAULT_GRANT_PCT_BY_BAND;
  return { ...source };
}

/**
 * Basis B (rupee value): unlike Basis A, the spec sets no v2 rupee figures —
 * `DEFAULTS.grantValueByBand` is tagged `provisional`, "needs a market check
 * before launch" (M2). There is no sourced low/high range to read the way
 * Basis A has one, so scaling the single provisional point (×0.7 / ×1 / ×1.4)
 * is a labelled estimate, never presented as a market survey — design.md
 * §4.4 and the master brief §14 ("do not invent authoritative Market
 * values"). Copy showing these values must say "Estimated, not sourced."
 */
const GRANT_VALUE_SCALE: Readonly<Record<GrantPhilosophy, number>> = {
  conservative: 0.7,
  market: 1,
  generous: 1.4,
};

export function grantValuePresetFor(philosophy: GrantPhilosophy): Record<Band, number> {
  const scale = GRANT_VALUE_SCALE[philosophy];
  const base = DEFAULT_GRANT_VALUE_BY_BAND;
  const result = {} as Record<Band, number>;
  for (const band of BANDS) {
    result[band] = Math.round(base[band] * scale);
  }
  return result;
}

/**
 * "Enter hiring by year" edits `hiring.hiresPerYear` directly, and nothing
 * else — `HiringMeta.totalHires` is UI-only state — so the two can disagree:
 * 50 eligible hires entered, then 25 + 25 + 13 typed across the years. The
 * years are what the engine reads, which makes a total that no longer matches
 * them a wrong answer on screen, not a harmless label, so the screens refuse
 * to move on while they differ. Only the first `horizonYears` entries count:
 * `hiresPerYear` may be longer than the horizon, and the engine ignores the
 * rest.
 *
 * Returns the message to show, or null when they agree. Hires are whole
 * people, so the comparison rounds each year the way `distributeHires` does.
 */
export function hiresPerYearMismatch(totalHires: number, hiresPerYear: readonly number[], horizonYears: number): string | null {
  const total = Math.max(0, Math.round(totalHires));
  const sum = hiresPerYear.slice(0, Math.max(1, Math.round(horizonYears))).reduce((acc, n) => acc + Math.max(0, Math.round(n)), 0);
  if (sum === total) return null;
  return sum > total
    ? `Your years add up to ${sum}, more than the ${total} hires you entered. Lower a year or raise the total.`
    : `Your years add up to ${sum}, fewer than the ${total} hires you entered. Raise a year or lower the total.`;
}

/** Leadership hires are a subset of total hires; more of them than the total
 *  turns `mixFromProfile` into a 100% leadership mix with no warning. */
export function leadershipHiresError(leadershipHires: number, totalHires: number): string | null {
  if (leadershipHires <= totalHires) return null;
  return `Leadership hires (${leadershipHires}) can't be more than your ${totalHires} total hires.`;
}

/**
 * The one check the hiring step and `Your model` both gate on, so they cannot
 * disagree about whether a hiring plan is usable. Nothing is checked until
 * total hires has been entered; leadership hires is only asked outside the
 * custom mix, which sets every band directly.
 */
export function hiringPlanError(
  meta: { readonly hasEnteredHires: boolean; readonly totalHires: number; readonly leadershipHires: number; readonly profile: string },
  hiring: { readonly hiresPerYear: readonly number[]; readonly horizonYears: number },
): string | null {
  if (!meta.hasEnteredHires) return null;
  return (
    hiresPerYearMismatch(meta.totalHires, hiring.hiresPerYear, hiring.horizonYears) ??
    (meta.profile === 'custom' ? null : leadershipHiresError(meta.leadershipHires, meta.totalHires))
  );
}
