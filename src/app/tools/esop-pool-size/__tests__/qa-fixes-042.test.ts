import { describe, expect, it } from 'vitest';
import { calculateEsopPool, DEFAULT_STRIKE_POLICY_BY_STAGE, STAGES } from '@/lib/esop';
import { heldPoolUsage, heroStateFor } from '../lib/heroState';
import { buildSeedInputs, strikePolicyForStage } from '../lib/seedInputs';
import { sourceFiles, withoutComments } from './ui-source';

/**
 * LOG [042]: the QA pass's bugs 2 to 8. Each block names the bug it pins.
 */
const read = (rel: string) => withoutComments(sourceFiles(['.tsx']).find((f) => f.rel === rel)!.text);

describe('bug 2: Discard in Your model restores the hiring and grant answers too', () => {
  const client = read('/EsopPoolSizeClient.tsx');
  it('snapshots the meta when results are reached and on every Recalculate', () => {
    expect(client.match(/setAppliedMeta\(\{ hiring: hiringMeta, grant: grantMeta \}\)/g)?.length).toBe(2);
  });
  it('puts both back on Discard and clears the snapshot on Reset', () => {
    expect(client).toMatch(/function onDiscardDraft\(\) \{[\s\S]*?setHiringMeta\(appliedMeta\.hiring\);[\s\S]*?setGrantMeta\(appliedMeta\.grant\);/);
    expect(client).toMatch(/function onReset\(\) \{[\s\S]*?setAppliedMeta\(null\)/);
  });
});

describe('bugs 3 and 5: an untouched number field is not answered by tabbing through it', () => {
  it('does not commit an empty blur while the field is still blank', () => {
    const field = withoutComments(sourceFiles(['.tsx']).find((f) => f.rel === '/ui/NumberField.tsx')!.text);
    expect(field).toMatch(/if \(blank && e\.target\.value\.trim\(\) === ''\) return;\s*commit\(e\.target\.value\);/);
  });
});

describe('bug 4: the Scenarios card and the PDF scenario table print the whole pool, like the headline', () => {
  it('Base equals the headline figure for the same inputs', () => {
    const result = calculateEsopPool({ ...buildSeedInputs(), company: { ...buildSeedInputs().company, existingUnallocatedOptions: 1_000_000 } });
    // The two numbers the card used to disagree on, for a company that holds a pool.
    expect(result.recommended.openingPoolPctOfFullyDiluted).not.toBeCloseTo(result.recommendedPool.selected.poolPctOfFullyDiluted, 1);
    expect(read('/results/ScenarioStrip.tsx')).toContain('displayPoolPct(result.recommended.openingPoolPctOfFullyDiluted)');
    const report = withoutComments(sourceFiles(['.ts']).find((f) => f.rel === '/lib/reportModel.ts')!.text);
    expect(report).toContain('displayPoolPct(scenarioResult.recommended.openingPoolPctOfFullyDiluted)');
    expect(report).not.toContain('scenarioResult.recommendedPool.selected.displayPoolPctOfFullyDiluted');
  });
});

describe('bug 6: an adequate pool says how much of it the plan uses', () => {
  const base = buildSeedInputs();
  const adequate = calculateEsopPool({ ...base, company: { ...base.company, existingUnallocatedOptions: 3_000_000 } });

  it('is the adequate state for a pool far larger than the plan', () => {
    expect(heroStateFor(adequate)).toBe('adequate');
  });

  it('reads usage off the current roll forward: held = used + spare, and used is below held', () => {
    const usage = heldPoolUsage(adequate);
    expect(usage.held).toBe(adequate.current.openingPoolOptions);
    expect(usage.used + usage.spare).toBeCloseTo(usage.held, 6);
    expect(usage.used).toBeGreaterThan(0);
    expect(usage.used).toBeLessThan(usage.held);
    expect(usage.spare).toBeCloseTo(Math.min(...adequate.current.years.map((y) => y.closingAvailable)), 6);
  });

  it('renders the line only in the adequate state', () => {
    expect(read('/results/Headline.tsx')).toContain("state === 'adequate' ? <HeldPoolUsageLine result={result} /> : null");
  });
});

describe('bug 7 (D17): a stage change reseeds the strike policy unless the founder chose one', () => {
  it('maps every stage to its default strike policy', () => {
    for (const stage of STAGES) expect(strikePolicyForStage(stage).kind).toBe(DEFAULT_STRIKE_POLICY_BY_STAGE[stage]);
  });

  it('is touched-aware in the wizard and in Your model', () => {
    for (const rel of ['/layout/onboarding/ScreenCompany.tsx', '/inputs/GrantBasisCard.tsx']) {
      expect(read(rel), rel).toMatch(/if \(!touched\.has\('grantPolicy\.strikePolicy\.kind'\)\) \{\s*setGroup\('grantPolicy', \{ strikePolicy: strikePolicyForStage\(stage\) \}\);/);
      expect(read(rel), rel).toContain("withTouch('company.stage', setStage)");
    }
  });
});

describe('the off-screen report chart tree is actually inert', () => {
  it('passes inert as a boolean, which React 19 honours, not as an empty string, which it reads as false', () => {
    const charts = withoutComments(sourceFiles(['.tsx']).find((f) => f.rel === '/results/ReportCharts.tsx')!.text);
    expect(charts).not.toContain('inert=""');
    expect(charts).toMatch(/\binert\s*\n\s*style=/);
  });
});
