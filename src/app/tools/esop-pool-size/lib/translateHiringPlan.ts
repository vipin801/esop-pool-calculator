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
