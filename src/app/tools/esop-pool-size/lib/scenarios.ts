/**
 * Scenario presets. These only ever adjust `EsopInputs` — every scenario's
 * numbers still come from a real `calculateEsopPool` run, never a locally
 * computed shortcut, so the strip stays honest under any grant basis.
 */
import type { EsopInputs, GrantBasis } from '@/lib/esop';

export type ScenarioKey = 'slow' | 'base' | 'fast';

export const SCENARIOS: readonly { readonly key: ScenarioKey; readonly label: string; readonly note: string }[] = [
  { key: 'slow', label: 'Slow', note: 'Hiring at 70%, growth halved, attrition +5 points.' },
  { key: 'base', label: 'Base', note: 'Your inputs, exactly as entered.' },
  { key: 'fast', label: 'Fast', note: 'Hiring at 130%, growth ×1.5, grants +20%.' },
];

function scaleGrantBasis(basis: GrantBasis, multiplier: number): GrantBasis {
  if (multiplier === 1) return basis;
  if (basis.kind === 'percentOfEquity') {
    return {
      kind: 'percentOfEquity',
      grantPctByBand: {
        leadership: basis.grantPctByBand.leadership * multiplier,
        senior: basis.grantPctByBand.senior * multiplier,
        mid: basis.grantPctByBand.mid * multiplier,
        junior: basis.grantPctByBand.junior * multiplier,
      },
    };
  }
  return {
    kind: 'rupeeValue',
    grantValueByBand: {
      leadership: basis.grantValueByBand.leadership * multiplier,
      senior: basis.grantValueByBand.senior * multiplier,
      mid: basis.grantValueByBand.mid * multiplier,
      junior: basis.grantValueByBand.junior * multiplier,
    },
  };
}

export function applyScenario(inputs: EsopInputs, key: ScenarioKey): EsopInputs {
  if (key === 'base') return inputs;

  const hireMultiplier = key === 'slow' ? 0.7 : 1.3;
  const growthMultiplier = key === 'slow' ? 0.5 : 1.5;
  const attritionDelta = key === 'slow' ? 5 : 0;
  const grantMultiplier = key === 'slow' ? 1 : 1.2;

  return {
    ...inputs,
    hiring: {
      ...inputs.hiring,
      hiresPerYear: inputs.hiring.hiresPerYear.map((h) => Math.max(0, Math.round(h * hireMultiplier))),
    },
    growth: {
      ...inputs.growth,
      valuationGrowthPctPerYear: inputs.growth.valuationGrowthPctPerYear * growthMultiplier,
    },
    attrition: {
      ...inputs.attrition,
      baseAnnualPct: Math.min(100, inputs.attrition.baseAnnualPct + attritionDelta),
    },
    grantPolicy: {
      ...inputs.grantPolicy,
      grantBasis: scaleGrantBasis(inputs.grantPolicy.grantBasis, grantMultiplier),
    },
  };
}
