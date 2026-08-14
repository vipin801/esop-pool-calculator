import { describe, expect, it } from 'vitest';

import {
  DEFAULTS,
  DEFAULT_GRANT_BASIS_BY_STAGE,
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_SENIORITY_MIX_PCT,
  DEFAULT_STRIKE_POLICY_BY_STAGE,
  SOLVER,
  STATUTORY,
} from '../defaults';
import { BANDS, STAGES, type DefaultEntry, type DefaultValue, type Provenance } from '../types';

const ALLOWED_PROVENANCE: readonly Provenance[] = ['estimate', 'provisional'];

const entries: ReadonlyArray<readonly [string, DefaultEntry]> = Object.entries(DEFAULTS);

/** Every number reachable inside a default value, including inside records and arrays. */
function numericLeaves(value: DefaultValue): readonly number[] {
  if (typeof value === 'number') return [value];
  if (typeof value !== 'object') return [];
  return Object.values(value).filter((leaf): leaf is number => typeof leaf === 'number');
}

describe('provenance', () => {
  it('tags every default', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, entry] of entries) {
      expect(ALLOWED_PROVENANCE, `${key} has an unknown provenance`).toContain(entry.provenance);
    }
  });

  it('offers no sourced tier, because there is no sourced data', () => {
    const tiers = new Set(entries.map(([, entry]) => String(entry.provenance)));
    expect(tiers).not.toContain('sourced');
    expect([...tiers].sort()).toEqual(['estimate', 'provisional']);
  });

  it('says what every default is and when it was last checked', () => {
    for (const [key, entry] of entries) {
      expect(entry.what.length, `${key} has no description`).toBeGreaterThan(20);
      expect(entry.asOf, `${key} has no asOf`).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});

describe('zero values', () => {
  it('never leaves a default silently zero', () => {
    for (const [key, entry] of entries) {
      const zeros = numericLeaves(entry.value).filter((leaf) => leaf === 0);
      if (zeros.length > 0) {
        expect(
          entry.intentionalZero,
          `${key} is zero but is not marked intentionalZero, so it reads as an unfilled field`,
        ).toBe(true);
      }
    }
  });

  it('never marks intentionalZero on a default that is not zero', () => {
    for (const [key, entry] of entries) {
      if (entry.intentionalZero === true) {
        expect(
          numericLeaves(entry.value),
          `${key} claims an intentional zero but holds none`,
        ).toContain(0);
      }
    }
  });

  it('actually exercises the intentional-zero marker', () => {
    const marked = entries.filter(([, entry]) => entry.intentionalZero === true);
    expect(marked.map(([key]) => key)).toEqual(['continuingEmployeeExercisePctPerYear']);
  });
});

describe('seniority mix', () => {
  it('sums to 100', () => {
    const total = BANDS.reduce((sum, band) => sum + DEFAULT_SENIORITY_MIX_PCT[band], 0);
    expect(total).toBe(100);
  });

  it('covers every band with a positive share', () => {
    for (const band of BANDS) {
      expect(DEFAULT_SENIORITY_MIX_PCT[band], `${band} has no share`).toBeGreaterThan(0);
    }
  });
});

describe('basis A grant percentages', () => {
  it('sits inside the advisory range for every band', () => {
    for (const band of BANDS) {
      const low = DEFAULTS.grantPctLowByBand.value[band];
      const high = DEFAULTS.grantPctHighByBand.value[band];
      const point = DEFAULT_GRANT_PCT_BY_BAND[band];

      expect(low, `${band} range is inverted`).toBeLessThan(high);
      expect(point, `${band} default is below its advisory range`).toBeGreaterThanOrEqual(low);
      expect(point, `${band} default is above its advisory range`).toBeLessThanOrEqual(high);
    }
  });

  it('falls with seniority', () => {
    expect(DEFAULT_GRANT_PCT_BY_BAND.leadership).toBeGreaterThan(DEFAULT_GRANT_PCT_BY_BAND.senior);
    expect(DEFAULT_GRANT_PCT_BY_BAND.senior).toBeGreaterThan(DEFAULT_GRANT_PCT_BY_BAND.mid);
    expect(DEFAULT_GRANT_PCT_BY_BAND.mid).toBeGreaterThan(DEFAULT_GRANT_PCT_BY_BAND.junior);
  });
});

describe('stage preselections', () => {
  it('covers every stage', () => {
    for (const stage of STAGES) {
      expect(DEFAULT_GRANT_BASIS_BY_STAGE[stage], `${stage} has no grant basis`).toBeDefined();
      expect(DEFAULT_STRIKE_POLICY_BY_STAGE[stage], `${stage} has no strike policy`).toBeDefined();
    }
  });

  it('preselects percent of equity early and rupee value from Series A', () => {
    expect(DEFAULT_GRANT_BASIS_BY_STAGE.preSeed).toBe('percentOfEquity');
    expect(DEFAULT_GRANT_BASIS_BY_STAGE.seed).toBe('percentOfEquity');
    expect(DEFAULT_GRANT_BASIS_BY_STAGE.seriesA).toBe('rupeeValue');
    expect(DEFAULT_GRANT_BASIS_BY_STAGE.seriesCPlus).toBe('rupeeValue');
  });

  it('preselects face value early and the last round price from Series A', () => {
    expect(DEFAULT_STRIKE_POLICY_BY_STAGE.seed).toBe('faceValue');
    expect(DEFAULT_STRIKE_POLICY_BY_STAGE.seriesA).toBe('lastRoundPrice');
  });
});

describe('statutory limits and solver parameters', () => {
  it('carries no provenance tag, because law is not an estimate', () => {
    expect('provenance' in STATUTORY).toBe(false);
    expect('provenance' in SOLVER).toBe(false);
  });

  it('holds the statutory figures the spec states', () => {
    expect(STATUTORY.minVestingMonths).toBe(12);
    expect(STATUTORY.taxDeferralWindowMonths).toBe(60);
    expect(STATUTORY.dpiitExemptionYearsFromIncorporation).toBe(10);
    expect(STATUTORY.individualGrantSeparateResolutionPct).toBe(1);
  });

  it('holds the fixed-point parameters the spec states', () => {
    expect(SOLVER.startPoolPct).toBe(10);
    expect(SOLVER.tolerancePctPoints).toBe(0.01);
    expect(SOLVER.maxIterations).toBe(25);
  });
});

describe('defaults the cliff cannot break', () => {
  it('never defaults the cliff below the statutory minimum', () => {
    expect(DEFAULTS.cliffMonths.value).toBeGreaterThanOrEqual(STATUTORY.minVestingMonths);
  });
});
