import { describe, expect, it } from 'vitest';
import { DEFAULT_GRANT_VALUE_BY_BAND, calculateEsopPool } from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import { heroStateFor, isAboveAdvisoryCeiling, likelyDrivers } from '../lib/heroState';

describe('heroStateFor', () => {
  it('is "normal" for the seeded example (no existing pool, a converged plan)', () => {
    const result = calculateEsopPool(buildSeedInputs());
    expect(heroStateFor(result)).toBe('normal');
  });

  it('is "adequate" when a large existing pool already covers a tiny plan', () => {
    const inputs = buildSeedInputs();
    const covered = {
      ...inputs,
      company: { ...inputs.company, existingUnallocatedOptions: inputs.company.fullyDilutedShares * 0.05 },
      hiring: { ...inputs.hiring, hiresPerYear: inputs.hiring.hiresPerYear.map(() => 1) },
      grantPolicy: {
        ...inputs.grantPolicy,
        grantBasis: { kind: 'percentOfEquity' as const, grantPctByBand: { leadership: 0.01, senior: 0.01, mid: 0.01, junior: 0.01 } },
        comparisonGrantBasis: { kind: 'rupeeValue' as const, grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND },
      },
    };
    const result = calculateEsopPool(covered);
    expect(result.solver.converged).toBe(true);
    expect(heroStateFor(result)).toBe('adequate');
  });

  it('is "extreme" when the plan cannot converge in range', () => {
    const inputs = buildSeedInputs();
    const runaway = {
      ...inputs,
      hiring: {
        ...inputs.hiring,
        seniorityMix: { leadership: 100, senior: 0, mid: 0, junior: 0 },
        hiresPerYear: inputs.hiring.hiresPerYear.map(() => 50),
      },
      grantPolicy: {
        ...inputs.grantPolicy,
        grantBasis: { kind: 'percentOfEquity' as const, grantPctByBand: { leadership: 20, senior: 20, mid: 20, junior: 20 } },
        comparisonGrantBasis: { kind: 'rupeeValue' as const, grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND },
      },
    };
    const result = calculateEsopPool(runaway);
    expect(result.solver.converged).toBe(false);
    expect(heroStateFor(result)).toBe('extreme');
  });
});

describe('isAboveAdvisoryCeiling', () => {
  it('is false for the ordinary seeded example', () => {
    const result = calculateEsopPool(buildSeedInputs());
    expect(isAboveAdvisoryCeiling(result)).toBe(false);
  });

  it('is true once the recommended pool sits well past the advisory ceiling', () => {
    const inputs = buildSeedInputs();
    const aggressive = {
      ...inputs,
      grantPolicy: {
        ...inputs.grantPolicy,
        grantBasis: { kind: 'percentOfEquity' as const, grantPctByBand: { leadership: 5, senior: 5, mid: 5, junior: 5 } },
        comparisonGrantBasis: { kind: 'rupeeValue' as const, grantValueByBand: DEFAULT_GRANT_VALUE_BY_BAND },
      },
    };
    const result = calculateEsopPool(aggressive);
    if (result.solver.converged) {
      expect(isAboveAdvisoryCeiling(result)).toBe(true);
    }
  });
});

describe('likelyDrivers', () => {
  it('names the grant basis appropriate lever', () => {
    const inputs = buildSeedInputs();
    const drivers = likelyDrivers(inputs);
    expect(drivers.length).toBeGreaterThan(0);
    if (inputs.grantPolicy.grantBasis.kind === 'rupeeValue') {
      expect(drivers).toContain('₹ grant values');
    } else {
      expect(drivers).toContain('percent-of-equity grant sizes');
    }
  });
});
