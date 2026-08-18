import { describe, expect, it } from 'vitest';
import { BANDS, DEFAULTS, DEFAULT_GRANT_PCT_BY_BAND, DEFAULT_GRANT_VALUE_BY_BAND, DEFAULT_SENIORITY_MIX_PCT } from '@/lib/esop';
import {
  distributeHires,
  grantPctPresetFor,
  grantValuePresetFor,
  mixFromProfile,
} from '../lib/translateHiringPlan';

describe('distributeHires', () => {
  it('divides evenly when the total divides the horizon exactly', () => {
    expect(distributeHires(40, 4, 'even')).toEqual([10, 10, 10, 10]);
  });

  it('always sums to the total hires, even when it does not divide evenly', () => {
    for (const [total, horizon] of [[35, 4], [1, 3], [7, 5], [100, 3], [2, 7]] as const) {
      for (const timing of ['earlier', 'even', 'later'] as const) {
        const result = distributeHires(total, horizon, timing);
        expect(result).toHaveLength(horizon);
        expect(result.reduce((sum, n) => sum + n, 0)).toBe(total);
        expect(result.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
      }
    }
  });

  it('front-loads under "earlier": each year at least as heavy as the next', () => {
    const result = distributeHires(100, 5, 'earlier');
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!).toBeGreaterThanOrEqual(result[i + 1]!);
    }
  });

  it('back-loads under "later": each year at least as heavy as the previous', () => {
    const result = distributeHires(100, 5, 'later');
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThanOrEqual(result[i - 1]!);
    }
  });

  it('"earlier" and "later" are mirror images of each other', () => {
    const earlier = distributeHires(100, 5, 'earlier');
    const later = distributeHires(100, 5, 'later');
    expect(later).toEqual([...earlier].reverse());
  });

  it('zero total hires distributes as all zeros, not an error', () => {
    expect(distributeHires(0, 4, 'even')).toEqual([0, 0, 0, 0]);
  });

  it('a single-year horizon puts everything in that year', () => {
    expect(distributeHires(23, 1, 'earlier')).toEqual([23]);
    expect(distributeHires(23, 1, 'later')).toEqual([23]);
  });
});

describe('mixFromProfile', () => {
  it('returns the preset unchanged when leadership hires match the preset\'s own leadership share', () => {
    // Balanced preset is 5/20/45/30. At 100 total hires, 5 leadership hires is exactly 5%.
    const mix = mixFromProfile('balanced', 5, 100);
    expect(mix.leadership).toBeCloseTo(5, 5);
    expect(mix.senior).toBeCloseTo(20, 5);
    expect(mix.mid).toBeCloseTo(45, 5);
    expect(mix.junior).toBeCloseTo(30, 5);
  });

  it('always sums to 100, whatever leadership hires are given', () => {
    for (const profile of ['juniorHeavy', 'balanced', 'seniorHeavy'] as const) {
      for (const [leadershipHires, totalHires] of [[0, 40], [2, 40], [40, 40], [1, 3]] as const) {
        const mix = mixFromProfile(profile, leadershipHires, totalHires);
        const total = BANDS.reduce((sum, band) => sum + mix[band], 0);
        expect(total).toBeCloseTo(100, 5);
      }
    }
  });

  it('scales the remaining bands up, in the preset\'s own ratio, when leadership hires are zero', () => {
    const mix = mixFromProfile('balanced', 0, 40);
    expect(mix.leadership).toBe(0);
    // Preset ratio senior:mid:junior is 20:45:30 — unchanged by the rescale.
    expect(mix.senior / mix.mid).toBeCloseTo(20 / 45, 5);
    expect(mix.mid / mix.junior).toBeCloseTo(45 / 30, 5);
  });

  it('returns the preset unscaled when there are no hires at all', () => {
    expect(mixFromProfile('seniorHeavy', 0, 0)).toEqual({ leadership: 10, senior: 30, mid: 40, junior: 20 });
  });

  it('the balanced preset is exactly the tool\'s own default mix, not a second figure', () => {
    expect(mixFromProfile('balanced', 5, 100)).toEqual({ ...DEFAULT_SENIORITY_MIX_PCT });
  });
});

describe('grantPctPresetFor (Basis A)', () => {
  it('reads the spec\'s own advisory range out of DEFAULTS rather than inventing one', () => {
    expect(grantPctPresetFor('conservative')).toEqual(DEFAULTS.grantPctLowByBand.value);
    expect(grantPctPresetFor('market')).toEqual(DEFAULT_GRANT_PCT_BY_BAND);
    expect(grantPctPresetFor('generous')).toEqual(DEFAULTS.grantPctHighByBand.value);
  });

  it('is monotonically ordered conservative <= market <= generous for every band', () => {
    const low = grantPctPresetFor('conservative');
    const mid = grantPctPresetFor('market');
    const high = grantPctPresetFor('generous');
    for (const band of BANDS) {
      expect(low[band]).toBeLessThanOrEqual(mid[band]);
      expect(mid[band]).toBeLessThanOrEqual(high[band]);
    }
  });
});

describe('grantValuePresetFor (Basis B)', () => {
  it('market is exactly the tool\'s existing provisional default, unscaled', () => {
    expect(grantValuePresetFor('market')).toEqual({ ...DEFAULT_GRANT_VALUE_BY_BAND });
  });

  it('conservative and generous scale every band by a fixed factor of the same provisional default', () => {
    for (const band of BANDS) {
      expect(grantValuePresetFor('conservative')[band]).toBe(Math.round(DEFAULT_GRANT_VALUE_BY_BAND[band] * 0.7));
      expect(grantValuePresetFor('generous')[band]).toBe(Math.round(DEFAULT_GRANT_VALUE_BY_BAND[band] * 1.4));
    }
  });

  it('is monotonically ordered conservative <= market <= generous for every band', () => {
    const low = grantValuePresetFor('conservative');
    const mid = grantValuePresetFor('market');
    const high = grantValuePresetFor('generous');
    for (const band of BANDS) {
      expect(low[band]).toBeLessThanOrEqual(mid[band]);
      expect(mid[band]).toBeLessThanOrEqual(high[band]);
    }
  });
});
