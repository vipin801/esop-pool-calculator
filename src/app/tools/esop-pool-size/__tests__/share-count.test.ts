import { describe, expect, it } from 'vitest';
import { calculateEsopPool, isEsopEngineError } from '@/lib/esop';
import { buildSeedInputs } from '../lib/seedInputs';
import { fullyDilutedSharesPatch, rescalePoolForNewFd, shareBreakdown, shareBreakdownLine, shareCountError } from '../lib/shareCount';
import { sourceFiles, withoutComments } from './ui-source';

const company = (fullyDilutedShares: number, existingUnallocatedOptions: number, grantedOutstandingOptions: number) => ({
  fullyDilutedShares,
  existingUnallocatedOptions,
  grantedOutstandingOptions,
});

describe('shareBreakdown', () => {
  it('splits the fully diluted count into issued, granted and unallocated', () => {
    expect(shareBreakdown(company(20_000, 500, 1_000))).toEqual({ fullyDiluted: 20_000, issued: 18_500, granted: 1_000, pool: 500 });
  });
});

describe('shareCountError', () => {
  it('is null when the pool and granted options fit', () => {
    expect(shareCountError(company(20_000, 500, 1_000))).toBeNull();
    expect(shareCountError(company(20_000, 19_000, 1_000))).toBeNull();
  });

  it('names the numbers when they do not', () => {
    const message = shareCountError(company(20_000, 15_000, 8_000));
    expect(message).toContain('23,000');
    expect(message).toContain('20,000');
  });

  it('refuses a count of zero, which the engine also refuses (LOG [042])', () => {
    expect(shareCountError(company(0, 0, 0))).toBe('Fully diluted shares must be above zero.');
    const base = buildSeedInputs();
    expect(() => calculateEsopPool({ ...base, company: { ...base.company, fullyDilutedShares: 0 } })).toThrow();
  });

  it('agrees with the engine: it fires exactly when calculateEsopPool throws negativeShareCount', () => {
    for (const [fd, pool, granted] of [
      [20_000, 15_000, 8_000],
      [20_000, 10_000, 10_000],
      [20_000, 19_999, 1],
    ] as const) {
      const base = buildSeedInputs();
      const inputs = {
        ...base,
        company: { ...base.company, fullyDilutedShares: fd, existingUnallocatedOptions: pool, grantedOutstandingOptions: granted },
        openingGrants: granted > 0 ? [{ band: 'mid' as const, outstandingOptions: granted, ageYearsAtPlanStart: 2 }] : [],
      };
      let code: string | null = null;
      try {
        calculateEsopPool(inputs);
      } catch (error) {
        if (!isEsopEngineError(error)) throw error;
        code = error.code;
      }
      expect(shareCountError(inputs.company) !== null, `${fd}/${pool}/${granted}`).toBe(code === 'negativeShareCount');
    }
  });
});

describe('shareBreakdownLine', () => {
  it('states how many options are left to grant', () => {
    expect(shareBreakdownLine(company(20_000, 500, 1_000))).toContain('500 unallocated, available to grant');
  });

  it('is withheld while the numbers cannot work', () => {
    expect(shareBreakdownLine(company(20_000, 15_000, 8_000))).toBeNull();
  });
});

describe('fullyDilutedSharesPatch', () => {
  it('survives a count that briefly reads zero: 10% of the seed, then 0, then 20,000 is 2,000', () => {
    const atZero = fullyDilutedSharesPatch({ next: 0, poolShares: 1_000_000, lastPositiveFullyDiluted: 10_000_000, poolUnit: 'percent' });
    expect(atZero.existingUnallocatedOptions).toBe(1_000_000);
    const real = fullyDilutedSharesPatch({ next: 20_000, poolShares: atZero.existingUnallocatedOptions, lastPositiveFullyDiluted: 10_000_000, poolUnit: 'percent' });
    expect(real).toEqual({ fullyDilutedShares: 20_000, existingUnallocatedOptions: 2_000 });
  });

  it('leaves a pool typed in shares exactly as typed', () => {
    expect(fullyDilutedSharesPatch({ next: 40_000, poolShares: 15_000, lastPositiveFullyDiluted: 20_000, poolUnit: 'shares' }).existingUnallocatedOptions).toBe(15_000);
  });
});

describe('rescalePoolForNewFd', () => {
  it('keeps a percentage a percentage when the count under it changes', () => {
    // 10% typed against the 10,000,000 seed, then the real count of 20,000.
    expect(rescalePoolForNewFd(1_000_000, 10_000_000, 20_000)).toBe(2_000);
  });

  it('is the identity when the count does not move', () => {
    expect(rescalePoolForNewFd(1_500, 20_000, 20_000)).toBe(1_500);
  });

  it('leaves the pool alone when there is no old count to take a percentage of', () => {
    expect(rescalePoolForNewFd(500, 0, 20_000)).toBe(500);
  });

  it('never rescales a pool to a count of zero', () => {
    expect(rescalePoolForNewFd(1_000_000, 10_000_000, 0)).toBe(1_000_000);
  });

  it('removes the original failure: a pool typed before the count never exceeds the company', () => {
    const company = (fd: number, pool: number) => ({ fullyDilutedShares: fd, existingUnallocatedOptions: pool, grantedOutstandingOptions: 0 });
    const staleFd = company(20_000, 1_000_000);
    expect(shareCountError(staleFd)).not.toBeNull();
    const rescaled = company(20_000, rescalePoolForNewFd(1_000_000, 10_000_000, 20_000));
    expect(shareCountError(rescaled)).toBeNull();
  });
});

describe('the company step refuses a share count that cannot work', () => {
  const read = (rel: string) => withoutComments(sourceFiles(['.tsx']).find((f) => f.rel === rel)!.text);

  it('shows the error on the fully diluted field in the wizard and in Your model', () => {
    expect(read('/layout/onboarding/ScreenCompany.tsx')).toContain('error={shareCountError(company)');
    expect(read('/inputs/CompanyTodayCard.tsx')).toContain('error={shareCountError(company)');
  });

  it('shows the breakdown line only once fully diluted shares has been entered, never the seed', () => {
    expect(read('/layout/onboarding/ScreenCompany.tsx')).toContain("!isBlank('company.fullyDilutedShares') && shareBreakdownLine(company)");
  });

  it('hides the pool share readout while a percentage has no entered count to convert against', () => {
    expect(read('/layout/onboarding/ScreenCompany.tsx')).toContain("(poolUnit === 'percent' && isBlank('company.fullyDilutedShares'))");
  });

  it('asks for fully diluted shares before the pool, so a percentage is never converted against the seed', () => {
    const screen = read('/layout/onboarding/ScreenCompany.tsx');
    expect(screen.indexOf('id="onb-fd-shares"')).toBeGreaterThan(-1);
    expect(screen.indexOf('id="onb-fd-shares"')).toBeLessThan(screen.indexOf('id="onb-pool-pct"'));
  });

  it('rescales the pool through the same patch, against the last count above zero, in the wizard and in Your model', () => {
    for (const rel of ['/layout/onboarding/ScreenCompany.tsx', '/inputs/CompanyTodayCard.tsx']) {
      const code = read(rel);
      expect(code, rel).toContain('fullyDilutedSharesPatch({ next, poolShares: company.existingUnallocatedOptions, lastPositiveFullyDiluted: pctBase, poolUnit })');
      expect(code, rel).toContain('const pctBase = company.fullyDilutedShares > 0 ? company.fullyDilutedShares : lastPositiveFd;');
      // A % typed while the count reads zero is converted against the same base, not against 0.
      expect(code, rel).toContain('setExistingPoolShares((pct / 100) * pctBase)');
      expect(code, rel).toContain('(company.existingUnallocatedOptions / pctBase) * 100');
    }
  });

  it('keeps the pool unit in the wizard, so Back does not reset a shares pool to percent', () => {
    const wizard = read('/layout/onboarding/OnboardingWizard.tsx');
    expect(wizard).toContain("useState<PoolUnit>('percent')");
    expect(wizard).toContain('poolUnit={poolUnit}');
    expect(read('/layout/onboarding/ScreenCompany.tsx')).not.toContain('useState<PoolUnit>');
  });

  it('blocks Continue on the company step', () => {
    expect(read('/layout/onboarding/OnboardingWizard.tsx')).toMatch(/step === 0 \? shareCountError\(inputs\.company\)/);
  });
});
