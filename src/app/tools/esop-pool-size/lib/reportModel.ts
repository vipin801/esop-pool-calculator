/**
 * The detailed report, as a document model.
 *
 * This module is **pure**: no DOM, no `fetch`, no clock, no React. It turns an
 * `EsopInputs` and the `EsopResult` the screen is already showing into an
 * ordered set of sections, and `reportPlainText` flattens that to a string.
 *
 * Two reasons it is built this way rather than drawn straight into a PDF.
 *
 * 1. **The PROJECT.md prohibitions are checkable.** `__tests__/report.test.ts`
 *    runs every one of them against `reportPlainText(...)`. A prohibition that
 *    is only enforced by the person writing the copy is not enforced.
 * 2. **It generates without a network call**, which is a property a test can
 *    assert only if the thing under test is separable from the renderer.
 *
 * `reportPdf.ts` is the renderer and is the only part that touches a browser.
 */

import {
  DEFAULTS,
  calculateEsopPool,
  type Band,
  type ComplianceCheck,
  type ComplianceStatus,
  type EsopInputs,
  type EsopResult,
  type GrantBasisKind,
  type PoolPlanSeries,
  type StrikePolicy,
  type ValueBasis,
} from '@/lib/esop';
import { LIGHT_PALETTE } from './chartTheme';
import { currentPoolRunwayLabel } from './describe';
import {
  crores,
  displayPoolPct,
  formatIndian,
  formatMoney,
  formatPct,
  formatShares,
  formatSignedShares,
  lakhCrore,
} from './format';
import { BAND_LABEL, SECTOR_LABEL, STAGE_LABEL } from './labels';
import { SCENARIOS, applyScenario } from './scenarios';
import type { LeadDraft } from './leadValidation';

/* ------------------------------------------------------------------------- *
 * The document model
 * ------------------------------------------------------------------------- */

export type ReportProvenance = 'entered' | 'estimate' | 'provisional';

/** D6: nothing in this report may read as sourced data about the company. */
export const PROVENANCE_LABEL: Record<ReportProvenance, string> = {
  entered: 'Entered by you',
  estimate: 'Editable estimate',
  provisional: 'Provisional estimate',
};

export interface KeyValueRow {
  readonly label: string;
  readonly value: string;
  readonly provenance?: ReportProvenance;
}

export interface ChecklistItem {
  readonly title: string;
  readonly status: ComplianceStatus;
  readonly finding: string;
  readonly action: string;
  readonly reference: string;
  readonly disclaimer: string;
}

export type ReportBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'callout'; readonly text: string }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'keyValue'; readonly rows: readonly KeyValueRow[] }
  | {
      readonly kind: 'table';
      readonly caption?: string;
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | {
      readonly kind: 'chart';
      readonly chartId: string;
      readonly title: string;
      readonly caption: string;
      /**
       * The legend, carried as data. The on-screen legend is HTML beside the
       * SVG, so it is not part of the captured image and has to be redrawn.
       * Colours are the light palette because the report is a printed page.
       */
      readonly keys: readonly { readonly label: string; readonly color: string }[];
    }
  | { readonly kind: 'checklist'; readonly items: readonly ChecklistItem[] };

export interface ReportSection {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly ReportBlock[];
}

/**
 * The cover, as structured fields rather than prose.
 *
 * `grantBasis` and `strikePolicy` sit here, beside `headlinePoolPct`, because
 * PROJECT.md forbids a pool percentage appearing without them. Keeping all
 * three on one object means the renderer cannot lay the number out on a page
 * the two controls did not reach, and `coverText` lets a test prove it.
 */
export interface ReportCover {
  readonly companyName: string;
  readonly stageLabel: string;
  readonly preparedOn: string;
  readonly preparedFor: string;
  /**
   * The headline pair, and they must describe **one** pool.
   *
   * Both come off `result.recommended`: the pool that run actually opened
   * with, in percent and in options. They are not `PoolSizing`'s fields —
   * section 4.5's `poolPctOfFullyDiluted` and `poolOptions` are the *top-up*,
   * `K - existingUnallocated`, and pairing that percentage with the whole
   * pool's option count is AUDIT_P4 defect 2 arriving through the front end.
   * Measured: a company holding 4,00,000 options reads 3.0% beside 6,72,995
   * options, two pools 2.5x apart on one line.
   */
  readonly headlinePoolPct: string;
  readonly headlinePoolOptions: string;
  readonly grantBasis: string;
  readonly strikePolicy: string;
  readonly valueBasis: string;
  /** The top-up, in both units, kept together for the same reason. */
  readonly topUpLabel: string;
  readonly topUpValue: string;
  readonly topUpPct: string;
  readonly currentPoolRunway: string;
  readonly disclaimer: string;
}

export interface ReportModel {
  readonly cover: ReportCover;
  readonly sections: readonly ReportSection[];
  readonly footer: string;
  /**
   * The grant basis and strike policy, as page furniture.
   *
   * PROJECT.md forbids a pool percentage appearing without both of them
   * visible on the same screen. A PDF is paginated and pool percentages appear
   * on several of its pages, so satisfying that on the cover alone would not
   * be enough — the renderer prints this on **every** page, which makes the
   * prohibition structurally impossible to breach rather than a thing the copy
   * has to remember.
   */
  readonly controlsFooter: string;
}

export const REPORT_DISCLAIMER =
  'This report models assumptions you entered and estimates you can edit. It is not measured data about your company, and it is general information, not legal advice.';

/* ------------------------------------------------------------------------- *
 * Labels for the two controls the prohibition is about
 * ------------------------------------------------------------------------- */

export const GRANT_BASIS_LABEL: Record<GrantBasisKind, string> = {
  percentOfEquity: 'Percent of equity',
  rupeeValue: 'Rupee value',
};

export const VALUE_BASIS_LABEL: Record<ValueBasis, string> = {
  notional: 'Notional',
  realisable: 'Realisable',
  fairValue: 'Fair value',
};

export function strikePolicyLabel(policy: StrikePolicy): string {
  switch (policy.kind) {
    case 'faceValue':
      return 'Face value';
    case 'lastRoundPrice':
      return 'Last round price';
    case 'discountToFMV':
      return `Discount to FMV, ${formatPct(policy.discountPct)}`;
  }
}

/* ------------------------------------------------------------------------- *
 * Formatting helpers, presentation only
 * ------------------------------------------------------------------------- */

/** Copy convention: a lakh or crore readout on every money field. */
function money(rupees: number): string {
  return `${formatMoney(rupees)} · ${lakhCrore(rupees)}`;
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function bandRow(byBand: Readonly<Record<Band, number>>, format: (n: number) => string): string {
  return (Object.keys(BAND_LABEL) as Band[]).map((b) => `${BAND_LABEL[b]} ${format(byBand[b])}`).join(', ');
}

/* ------------------------------------------------------------------------- *
 * Cover
 * ------------------------------------------------------------------------- */

function buildCover(args: {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly lead: LeadDraft;
  readonly preparedOn: string;
}): ReportCover {
  const { inputs, result, lead, preparedOn } = args;
  const sizing = result.recommendedPool.selected;
  const holdsAPool = result.current.openingPoolOptions > 0;

  return {
    companyName: lead.company.trim(),
    stageLabel: STAGE_LABEL[inputs.company.stage],
    preparedOn,
    preparedFor: lead.name.trim(),
    headlinePoolPct: formatPct(displayPoolPct(result.recommended.openingPoolPctOfFullyDiluted)),
    headlinePoolOptions: `${formatShares(result.recommended.openingPoolOptions)} options`,
    grantBasis: GRANT_BASIS_LABEL[sizing.grantBasisKind],
    strikePolicy: strikePolicyLabel(inputs.grantPolicy.strikePolicy),
    valueBasis: sizing.valueBasis === null ? 'Not applicable under percent-of-equity grants' : VALUE_BASIS_LABEL[sizing.valueBasis],
    /** Copy convention: "Pool to create" when they hold nothing. */
    topUpLabel: holdsAPool ? 'Top-up needed' : 'Pool to create',
    topUpValue: `${formatShares(sizing.poolOptions)} options`,
    topUpPct: formatPct(sizing.displayPoolPctOfFullyDiluted),
    currentPoolRunway: currentPoolRunwayLabel(result.current),
    disclaimer: REPORT_DISCLAIMER,
  };
}

/**
 * The cover as one string.
 *
 * Exported so a test can assert the pool percentage never appears without the
 * grant basis and the strike policy on the same page — the PROJECT.md
 * prohibition, checked against the page rather than against the whole report.
 */
export function coverText(cover: ReportCover): string {
  return [
    'Incentiv',
    'ESOP pool sizing report',
    cover.companyName,
    `${cover.stageLabel} · prepared ${cover.preparedOn} for ${cover.preparedFor}`,
    'Recommended pool',
    cover.headlinePoolPct,
    'of fully diluted',
    cover.headlinePoolOptions,
    `Grant basis: ${cover.grantBasis}`,
    `Strike price policy: ${cover.strikePolicy}`,
    `Value basis: ${cover.valueBasis}`,
    `${cover.topUpLabel}: ${cover.topUpValue}, ${cover.topUpPct} of fully diluted`,
    `Your current pool: ${cover.currentPoolRunway}`,
    cover.disclaimer,
  ].join('\n');
}

/* ------------------------------------------------------------------------- *
 * Section 1 — the recommendation and what drove it
 * ------------------------------------------------------------------------- */

function recommendationSection(inputs: EsopInputs, result: EsopResult): ReportSection {
  const { recommended, current, solver } = result;
  const sizing = result.recommendedPool.selected;
  const plannedHires = recommended.years.reduce((sum, y) => sum + y.hires, 0);

  /** Presentation subtraction of two figures the engine returned, not a re-derivation. */
  const netConsumption = recommended.totalGrossConsumptionOptions - recommended.totalReturnedToPool;

  const blocks: ReportBlock[] = [
    {
      kind: 'paragraph',
      text: `Your plan hires ${formatShares(plannedHires)} people over ${inputs.hiring.horizonYears} years. Granting them takes ${formatShares(
        recommended.totalGrossConsumptionOptions,
      )} options, of which ${formatShares(recommended.totalReturnedToPool)} come back through forfeiture and lapse${
        inputs.exercise.recycleForfeited ? '' : ' — though your scheme does not recycle them, so they do not return to the pool'
      }. Net consumption is ${formatShares(netConsumption)} options.`,
    },
    {
      kind: 'paragraph',
      text: `A buffer of ${formatPct(inputs.grantPolicy.bufferPct)} is added on top, for senior hires not yet in the plan. Against your existing unallocated pool of ${formatShares(
        current.openingPoolOptions,
      )} options, that leaves ${formatShares(sizing.poolOptions)} options to reserve — ${formatPct(
        sizing.poolPctOfFullyDiluted,
      )} of the fully diluted count once reserved, shown as ${formatPct(sizing.displayPoolPctOfFullyDiluted)} after rounding up to the nearest half point.`,
    },
    {
      kind: 'paragraph',
      text:
        sizing.grantBasisKind === 'rupeeValue'
          ? `Because grants are promised in rupees, valuation growth of ${formatPct(
              inputs.growth.valuationGrowthPctPerYear,
            )} a year against comp inflation of ${formatPct(
              inputs.grantPolicy.compInflationPctPerYear,
            )} is the single largest driver: the same rupee grant buys fewer options every year as the price per share compounds.`
          : `Because grants are a percentage of equity, valuation growth does not change how many options a hire receives. The pool still has to be solved for, because each grant is a share of a fully diluted count that the pool itself enlarges.`,
    },
    {
      kind: 'paragraph',
      text: `The pool size is a fixed point, not a formula: reserving options changes the fully diluted count, which changes the price per share, which changes what each grant costs. The model settled in ${solver.iterations} iteration${
        solver.iterations === 1 ? '' : 's'
      }${solver.converged ? '' : ' without converging, so the figure above is where it stopped rather than an answer'}.`,
    },
    {
      kind: 'callout',
      text: `Two states, never merged. "Recommended" is this plan run against the pool above. "Current" is the same plan run against the ${formatShares(
        current.openingPoolOptions,
      )} options you hold today: ${currentPoolRunwayLabel(current).toLowerCase()}, supporting ${formatShares(
        current.exhaustion.hiresSupported,
      )} of ${formatShares(plannedHires)} planned hires.`,
    },
  ];

  if (result.warnings.length > 0) {
    blocks.push({ kind: 'bullets', items: result.warnings.map((w) => w.message) });
  }

  return { id: 'recommendation', title: 'The recommendation, and what drove it', blocks };
}

/* ------------------------------------------------------------------------- *
 * Section 2 — every input and assumption, with its provenance
 * ------------------------------------------------------------------------- */

function inputsSection(inputs: EsopInputs): ReportSection {
  const { company, hiring, growth, grantPolicy, attrition, exercise, vesting, compliance, employeeValue } = inputs;

  const companyRows: KeyValueRow[] = [
    { label: 'Stage', value: STAGE_LABEL[company.stage], provenance: 'entered' },
    { label: 'Company type', value: company.companyType === 'private' ? 'Private company' : 'Unlisted public company', provenance: 'entered' },
    { label: 'Post-money valuation', value: money(company.postMoneyValuation), provenance: 'entered' },
    { label: 'Fully diluted shares', value: formatShares(company.fullyDilutedShares), provenance: 'entered' },
    { label: 'Existing unallocated pool', value: `${formatShares(company.existingUnallocatedOptions)} options`, provenance: 'entered' },
    { label: 'Granted and outstanding', value: `${formatShares(company.grantedOutstandingOptions)} options`, provenance: 'entered' },
    { label: 'Face value per share', value: money(company.faceValuePerShare), provenance: 'entered' },
    { label: 'Authorised capital', value: `${formatShares(company.authorisedCapitalShares)} shares · ${lakhCrore(company.authorisedCapitalShares * company.faceValuePerShare)}`, provenance: 'entered' },
    { label: 'Founder ownership', value: formatPct(company.founderOwnershipPctOfFullyDiluted), provenance: 'entered' },
  ];

  const planRows: KeyValueRow[] = [
    { label: 'Planning horizon', value: `${hiring.horizonYears} years`, provenance: DEFAULTS.horizonYears.provenance },
    {
      label: 'Hires per year',
      value: hiring.hiresPerYear.slice(0, hiring.horizonYears).map((h, i) => `Y${i + 1} ${formatIndian(h)}`).join(', '),
      provenance: DEFAULTS.hiresPerYear.provenance,
    },
    { label: 'Seniority mix', value: bandRow(hiring.seniorityMix, (n) => formatPct(n, 0)), provenance: DEFAULTS.seniorityMixPct.provenance },
    { label: 'Valuation growth per year', value: formatPct(growth.valuationGrowthPctPerYear), provenance: DEFAULTS.valuationGrowthPctPerYear.provenance },
  ];

  const grantRows: KeyValueRow[] = [
    { label: 'Grant basis', value: GRANT_BASIS_LABEL[grantPolicy.grantBasis.kind], provenance: DEFAULTS.grantBasisByStage.provenance },
    { label: 'Strike price policy', value: strikePolicyLabel(grantPolicy.strikePolicy), provenance: DEFAULTS.strikePolicyByStage.provenance },
    {
      label: 'Value basis',
      value: grantPolicy.grantBasis.kind === 'percentOfEquity' ? 'Not applicable under percent-of-equity grants' : VALUE_BASIS_LABEL[grantPolicy.valueBasis],
      provenance: DEFAULTS.valueBasis.provenance,
    },
    grantPolicy.grantBasis.kind === 'percentOfEquity'
      ? {
          label: 'Grant per hire',
          value: bandRow(grantPolicy.grantBasis.grantPctByBand, (n) => formatPct(n, 2)),
          provenance: DEFAULTS.grantPctByBand.provenance,
        }
      : {
          label: 'Grant per hire',
          value: bandRow(grantPolicy.grantBasis.grantValueByBand, (n) => lakhCrore(n)),
          provenance: DEFAULTS.grantValueByBand.provenance,
        },
    { label: 'Comp inflation', value: formatPct(grantPolicy.compInflationPctPerYear), provenance: DEFAULTS.compInflationPctPerYear.provenance },
    { label: 'Refresh rate', value: `${formatPct(grantPolicy.refresh.ratePct)} of eligible employees a year`, provenance: DEFAULTS.refreshRatePct.provenance },
    { label: 'Refresh size', value: `${formatPct(grantPolicy.refresh.sizePct)} of an initial grant`, provenance: DEFAULTS.refreshSizePct.provenance },
    { label: 'Refresh eligibility', value: `${grantPolicy.refresh.eligibilityMonths} months of tenure`, provenance: DEFAULTS.refreshEligibilityMonths.provenance },
    { label: 'Buffer', value: formatPct(grantPolicy.bufferPct), provenance: DEFAULTS.bufferPct.provenance },
    { label: 'Theta, the Black-Scholes value ratio', value: String(grantPolicy.fairValue.theta), provenance: DEFAULTS.theta.provenance },
    { label: 'Expected life behind theta', value: `${grantPolicy.fairValue.expectedLifeYears} years`, provenance: DEFAULTS.expectedLifeYears.provenance },
    { label: 'Volatility behind theta', value: formatPct(grantPolicy.fairValue.volatilityPct), provenance: DEFAULTS.volatilityPct.provenance },
  ];

  const behaviourRows: KeyValueRow[] = [
    { label: 'Sector', value: SECTOR_LABEL[attrition.sector], provenance: DEFAULTS.sector.provenance },
    { label: 'Base annual attrition', value: formatPct(attrition.baseAnnualPct), provenance: DEFAULTS.attritionBaseAnnualPct.provenance },
    {
      label: 'Leadership attrition override',
      value: attrition.byBand.leadership === undefined ? 'None, falls back to the base rate' : formatPct(attrition.byBand.leadership),
      provenance: DEFAULTS.attritionByBandPct.provenance,
    },
    { label: 'Post-termination exercise window', value: `${exercise.exerciseWindowDays} days`, provenance: DEFAULTS.exerciseWindowDays.provenance },
    { label: 'Vested options never exercised', value: formatPct(exercise.vestedNeverExercisedPct), provenance: DEFAULTS.vestedNeverExercisedPct.provenance },
    { label: 'Continuing-employee exercises', value: `${formatPct(exercise.continuingEmployeeExercisePctPerYear)} a year`, provenance: DEFAULTS.continuingEmployeeExercisePctPerYear.provenance },
    { label: 'Forfeited options recycled', value: yesNo(exercise.recycleForfeited), provenance: DEFAULTS.recycleForfeited.provenance },
    { label: 'Vesting cliff', value: `${vesting.cliffMonths} months`, provenance: DEFAULTS.cliffMonths.provenance },
    { label: 'Total vesting period', value: `${vesting.vestYears} years`, provenance: DEFAULTS.vestYears.provenance },
    { label: 'Vesting frequency', value: vesting.frequency, provenance: DEFAULTS.vestFrequency.provenance },
  ];

  const complianceRows: KeyValueRow[] = [
    { label: 'DPIIT recognised', value: yesNo(compliance.dpiitRecognised), provenance: 'entered' },
    { label: 'IMB certified under Section 80-IAC', value: yesNo(compliance.imbCertified80IAC), provenance: 'entered' },
    { label: 'Incorporation date', value: compliance.incorporationDate, provenance: 'entered' },
    { label: 'Grants to group company employees', value: yesNo(compliance.grantsToGroupCompanyEmployees), provenance: 'entered' },
    { label: 'Any individual grant at or above 1%', value: yesNo(compliance.anyIndividualGrantAtOrAbove1Pct), provenance: 'entered' },
    { label: 'Instrument', value: compliance.instrument, provenance: 'entered' },
    { label: 'Accounting basis', value: compliance.accountingBasis === 'indAS102' ? 'Ind AS 102 fair value' : 'ICAI Guidance Note intrinsic value', provenance: DEFAULTS.accountingBasis.provenance },
    { label: 'Employee marginal tax rate', value: formatPct(employeeValue.marginalTaxRatePct), provenance: 'estimate' },
  ];

  return {
    id: 'inputs',
    title: 'Every input and assumption',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Everything the model used, with where each figure came from. Nothing here is measured data about your company: figures you entered are yours, and every other line is an estimate you can change.',
      },
      { kind: 'keyValue', rows: companyRows },
      { kind: 'keyValue', rows: planRows },
      { kind: 'keyValue', rows: grantRows },
      { kind: 'keyValue', rows: behaviourRows },
      { kind: 'keyValue', rows: complianceRows },
    ],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 3 — the roll forward, both series
 * ------------------------------------------------------------------------- */

const ROLL_FORWARD_HEADERS = [
  'Year',
  'Valuation (₹ cr)',
  'Price/share (₹)',
  'Hires',
  'New grants',
  'Refresh',
  'Returned',
  'Closing available',
] as const;

function rollForwardRows(series: PoolPlanSeries): readonly (readonly string[])[] {
  return series.years.map((y) => [
    `Y${y.year + 1}`,
    crores(y.valuation, 1),
    formatIndian(y.pricePerShare, 2),
    formatShares(y.hires),
    formatShares(y.newHireGrants),
    formatShares(y.refreshGrants),
    formatShares(y.returnedToPool),
    formatSignedShares(y.closingAvailable),
  ]);
}

function rollForwardSection(result: EsopResult): ReportSection {
  return {
    id: 'roll-forward',
    title: 'Year-by-year roll-forward',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The same hiring plan, run twice. Both tables are shown because a closing balance means nothing without saying which pool it belongs to.',
      },
      {
        kind: 'table',
        caption: `Recommended pool — ${result.recommended.description}`,
        headers: ROLL_FORWARD_HEADERS,
        rows: rollForwardRows(result.recommended),
      },
      {
        kind: 'table',
        caption: `Your current pool — ${result.current.description}`,
        headers: ROLL_FORWARD_HEADERS,
        rows: rollForwardRows(result.current),
      },
      {
        kind: 'paragraph',
        text: `Over the horizon the recommended run issues ${formatShares(
          result.recommended.totalExercisedShares,
        )} shares on exercise and closes with ${formatShares(result.recommended.closingIssuedShares)} issued shares.`,
      },
    ],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 4 — the four charts
 * ------------------------------------------------------------------------- */

export const REPORT_CHART_IDS = ['pool-runway', 'grant-cost', 'pool-pct', 'hires-supported'] as const;
export type ReportChartId = (typeof REPORT_CHART_IDS)[number];

/**
 * `GrantCostChart` renders a different chart under each grant basis — a
 * two-axis valuation-against-options chart for rupee grants, and a
 * valuation-only fallback for percent-of-equity, where "options per ₹10,00,000"
 * has no meaning. The captured image follows the component, so the title,
 * caption and legend here have to follow it too or the PDF describes a chart
 * the founder is not looking at.
 */
function grantCostChartBlock(basisKind: GrantBasisKind): ReportBlock {
  const p = LIGHT_PALETTE;

  if (basisKind === 'percentOfEquity') {
    return {
      kind: 'chart',
      chartId: 'grant-cost',
      title: 'Valuation over the plan',
      caption:
        'Grants are a fixed percent of equity under this basis, so what a rupee grant buys does not apply. Switch the grant basis to rupee value to see that instead.',
      keys: [{ label: 'Valuation (₹ crore)', color: p.neutral }],
    };
  }

  return {
    kind: 'chart',
    chartId: 'grant-cost',
    title: 'The same rupee grant buys fewer options every year',
    caption: 'Valuation (left) against the options a fixed ₹10,00,000 grant buys (right), at the selected value basis.',
    keys: [
      { label: 'Valuation (₹ crore)', color: p.neutral },
      { label: 'Options per ₹10,00,000', color: p.accent },
    ],
  };
}

function chartsSection(basisKind: GrantBasisKind): ReportSection {
  const p = LIGHT_PALETTE;

  return {
    id: 'charts',
    title: 'The charts, as shown on screen',
    blocks: [
      {
        kind: 'chart',
        chartId: 'pool-runway',
        title: 'Pool runway',
        caption: 'Grants and returns per year against the balance left, for the pool you hold today, with the recommended pool as a reference line.',
        keys: [
          { label: 'New hires', color: p.accent },
          { label: 'Refreshes', color: p.accentSoft },
          { label: 'Returned', color: p.returned },
          { label: 'Available (current)', color: p.neutral },
          { label: 'Available (recommended)', color: p.accent },
        ],
      },
      grantCostChartBlock(basisKind),
      {
        kind: 'chart',
        chartId: 'pool-pct',
        title: 'Available pool, percent of fully diluted',
        caption: 'What is left in each pool, as a share of the company, year by year.',
        keys: [
          { label: 'Recommended pool', color: p.accent },
          { label: 'Current pool', color: p.neutral },
        ],
      },
      {
        kind: 'chart',
        chartId: 'hires-supported',
        title: 'Hires supported against hires planned',
        caption: 'Cumulative across the horizon. Where a line flattens below the bars, that pool has run out.',
        keys: [
          { label: 'Planned (cumulative)', color: p.neutralSoft },
          { label: 'Recommended pool supports', color: p.accent },
          { label: 'Current pool supports', color: p.warn },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 5 — cap tables
 * ------------------------------------------------------------------------- */

const CAP_TABLE_HEADERS = ['Holder', 'Shares', '% of fully diluted'] as const;

const CAP_HOLDER_LABEL: Record<string, string> = {
  founders: 'Founders',
  investors: 'Investors',
  grantedOptions: 'Granted options',
  unallocatedPool: 'Unallocated pool',
  exercisedShares: 'Exercised shares',
};

function capTableBlock(table: { readonly label: string; readonly rows: readonly { readonly holder: string; readonly shares: number; readonly pctOfFullyDiluted: number }[]; readonly total: { readonly shares: number; readonly pctOfFullyDiluted: number } }): ReportBlock {
  return {
    kind: 'table',
    caption: table.label,
    headers: CAP_TABLE_HEADERS,
    rows: [
      ...table.rows.map((row) => [
        CAP_HOLDER_LABEL[row.holder] ?? row.holder,
        formatShares(row.shares),
        formatPct(row.pctOfFullyDiluted, 2),
      ]),
      ['Total', formatShares(table.total.shares), formatPct(table.total.pctOfFullyDiluted, 2)],
    ],
  };
}

function capTableSection(result: EsopResult): ReportSection {
  const blocks: ReportBlock[] = [
    {
      kind: 'paragraph',
      text: 'The register as it stands, and once the recommended pool is reserved. Both are struck as at today, so the comparison is like for like.',
    },
    capTableBlock(result.capTables.before),
    capTableBlock(result.capTables.after),
  ];

  if (result.capTables.afterModelledRound) {
    blocks.push(capTableBlock(result.capTables.afterModelledRound));
  }

  blocks.push({
    kind: 'paragraph',
    text: 'The founder and investor split is an editable estimate. Investor shares are whatever issued capital the founders do not hold.',
  });

  return { id: 'cap-table', title: 'Cap table, before and after', blocks };
}

/* ------------------------------------------------------------------------- *
 * Section 6 — the round and the pool shuffle
 * ------------------------------------------------------------------------- */

function roundSection(result: EsopResult): ReportSection | null {
  const round = result.rounds[0];
  const cost = result.poolCostToFounders;
  const topUp = result.topUpAtNextRound;
  if (!round || !cost || !topUp) return null;

  const offered = cost.asOffered === 'preMoney' ? cost.preMoneyPool : cost.postMoneyPool;

  return {
    id: 'round',
    title: 'The next round, and the pool shuffle',
    blocks: [
      {
        kind: 'paragraph',
        text: `${round.label}, modelled in year ${round.year + 1}. The investor asks for a post-round pool of ${formatPct(
          topUp.investorRequiredPostRoundPoolPct,
        )}. The pool this report recommends lands at ${formatPct(
          topUp.existingPoolPostRoundPct,
        )} of the post-round company on its own, so the round needs a further ${formatSignedShares(
          topUp.topUpOptions,
        )} options, ${formatPct(topUp.topUpPctPoints, 2)} of it.${
          topUp.topUpOptions < 0
            ? ' That figure is negative: the investor is asking for a smaller pool than the recommendation already reserves, which means shrinking the reserve rather than adding to it, and that is a board decision rather than an automatic one.'
            : ''
        }`,
      },
      {
        kind: 'keyValue',
        rows: [
          { label: 'Offered as', value: cost.asOffered === 'preMoney' ? 'Pool created pre-money' : 'Pool created post-money' },
          { label: 'Post-round fully diluted', value: formatShares(offered.postRoundFullyDiluted) },
          { label: "This round's investor", value: `${formatShares(offered.investorShares)} shares · ${formatPct(offered.investorPctOfFullyDiluted, 2)}` },
          { label: 'Investor price per share', value: money(offered.investorPricePerShare) },
          { label: 'Post-round price per share', value: money(offered.postRoundPricePerShare) },
          { label: 'Founders after the round', value: formatPct(offered.founderPctOfFullyDiluted, 2) },
        ],
      },
      {
        kind: 'table',
        caption: 'Pre-money against post-money',
        headers: ['Measure', 'Pool created pre-money', 'Pool created post-money'],
        rows: [
          [
            "The pool's footprint on the post-round company",
            formatPct(cost.preMoneyPool.founderDilutionFromPoolPctPoints, 2),
            formatPct(cost.postMoneyPool.founderDilutionFromPoolPctPoints, 2),
          ],
          [
            'That footprint, in rupees',
            lakhCrore(cost.preMoneyPool.founderDilutionCostRupees),
            lakhCrore(cost.postMoneyPool.founderDilutionCostRupees),
          ],
          [
            'Founders after the round',
            formatPct(cost.preMoneyPool.founderPctOfFullyDiluted, 2),
            formatPct(cost.postMoneyPool.founderPctOfFullyDiluted, 2),
          ],
        ],
      },
      {
        kind: 'callout',
        text: `Moving the pool into the post-money keeps the founders ${formatPct(
          cost.founderOwnershipDeltaPctPoints,
          2,
        )} more of the company, worth ${lakhCrore(
          cost.founderOwnershipDeltaRupees,
        )}. Measured as the pool's own footprint the difference is smaller, ${formatPct(
          cost.deltaPctPoints,
          2,
        )} and ${lakhCrore(cost.deltaRupees)}, because a post-money pool is partly borne by the incoming investor. The first figure is what the founders actually keep.`,
      },
    ],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 7 — scenarios
 * ------------------------------------------------------------------------- */

function scenariosSection(inputs: EsopInputs, result: EsopResult): ReportSection {
  const rows: string[][] = [];

  for (const scenario of SCENARIOS) {
    const scenarioResult = scenario.key === 'base' ? result : safeCalculate(applyScenario(inputs, scenario.key));

    rows.push(
      scenarioResult === null
        ? [scenario.label, 'Out of range', '—', scenario.note]
        : [
            scenario.label,
            formatPct(scenarioResult.recommendedPool.selected.displayPoolPctOfFullyDiluted),
            currentPoolRunwayLabel(scenarioResult.current),
            scenario.note,
          ],
    );
  }

  return {
    id: 'scenarios',
    title: 'Scenarios',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The same model, run against three hiring and growth paths. Each is a full run, not a scaled headline.',
      },
      {
        kind: 'table',
        headers: ['Scenario', 'Recommended pool', 'Your current pool', 'What changed'],
        rows,
      },
    ],
  };
}

/**
 * A scenario can push a plan out of the range the fixed point can price. That
 * is a real outcome, reported as one, rather than a thrown error that would
 * take the whole report down with it.
 */
function safeCalculate(inputs: EsopInputs): EsopResult | null {
  try {
    return calculateEsopPool(inputs);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- *
 * Section 8 — compliance
 * ------------------------------------------------------------------------- */

function complianceSection(checks: readonly ComplianceCheck[]): ReportSection {
  const items: ChecklistItem[] = checks.map((check) => ({
    title: check.title,
    status: check.status,
    finding: check.finding,
    action: check.action,
    reference: check.statutoryReference,
    /** The engine's literal, carried through rather than retyped here. */
    disclaimer: check.disclaimer,
  }));

  return {
    id: 'compliance',
    title: 'Compliance checklist (India)',
    blocks: [{ kind: 'checklist', items }],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 9 — the Ind AS 102 expense estimate
 * ------------------------------------------------------------------------- */

function expenseSection(result: EsopResult): ReportSection {
  const { esopExpense } = result;
  const basisLabel = esopExpense.basis === 'indAS102' ? 'Ind AS 102 fair value' : 'ICAI Guidance Note intrinsic value';

  const blocks: ReportBlock[] = [
    {
      kind: 'paragraph',
      text: `Estimated on the ${basisLabel} basis, amortised over the vesting period. Options forfeited before they vest reverse their expense; options that lapse after vesting do not. This surfaces in diligence and routinely blindsides founders.`,
    },
    {
      kind: 'table',
      headers: ['Year', 'Charge for the year', 'Amortisation', 'Forfeiture reversal', 'Cumulative'],
      rows: esopExpense.years.map((y) => [
        `Y${y.year + 1}`,
        lakhCrore(y.expenseRupees),
        lakhCrore(y.amortisationChargeRupees),
        lakhCrore(y.forfeitureReversalRupees),
        lakhCrore(y.cumulativeExpenseRupees),
      ]),
    },
    {
      kind: 'paragraph',
      text: `Total across the horizon: ${money(esopExpense.totalExpenseRupees)}.`,
    },
  ];

  if (esopExpense.excludedOpeningOptions > 0) {
    blocks.push({
      kind: 'paragraph',
      text: `${formatShares(
        esopExpense.excludedOpeningOptions,
      )} options granted before the plan started are excluded, because no grant-date value was supplied for them and the model holds no price per share from before year 0 to value them at. The estimate above understates the charge by whatever those options are worth.`,
    });
  }

  return { id: 'expense', title: 'Estimated ESOP expense', blocks };
}

/* ------------------------------------------------------------------------- *
 * Section 10 — glossary, eight terms
 * ------------------------------------------------------------------------- */

export const GLOSSARY: readonly { readonly term: string; readonly definition: string }[] = [
  {
    term: 'Fully diluted',
    definition:
      'Every share that could exist today: issued shares, options already granted, and the unallocated pool. Pool percentages in this report are measured against it.',
  },
  {
    term: 'Grant basis',
    definition:
      'Whether a hire is promised a percentage of the company or a rupee amount. It decides whether valuation growth changes the pool at all.',
  },
  {
    term: 'Strike price',
    definition:
      'What an employee pays to exercise. Face value is the statutory floor; the last round price is fair market value. It sets the perquisite tax exposure.',
  },
  {
    term: 'Cliff',
    definition:
      'The minimum period between grant and any vesting. Rule 12(6)(a) sets it at one year, and this model refuses anything shorter.',
  },
  {
    term: 'Pool exhaustion',
    definition:
      'The month the unallocated pool first goes below zero against the hiring plan, interpolated on that year’s grant run rate.',
  },
  {
    term: 'Refresh grant',
    definition:
      'A second grant to an employee already on the register, once they pass the tenure threshold. It consumes pool alongside new hires.',
  },
  {
    term: 'Perquisite tax',
    definition:
      'Tax on the gap between fair market value and the strike price, charged at exercise at slab rates. It falls in cash, before any share is sold.',
  },
  {
    term: 'Pool shuffle',
    definition:
      'Whether a new pool is cut before or after an investor’s money lands. Pre-money, the founders carry all of it; post-money, the round shares it.',
  },
];

function glossarySection(): ReportSection {
  return {
    id: 'glossary',
    title: 'Glossary',
    blocks: [{ kind: 'keyValue', rows: GLOSSARY.map((entry) => ({ label: entry.term, value: entry.definition })) }],
  };
}

/* ------------------------------------------------------------------------- *
 * Section 11 — the closing CTA
 * ------------------------------------------------------------------------- */

export const CTA_LINE = 'Tabulate is Incentiv’s equity management product for grants, vesting and exercises.';
export const CTA_HEADING = 'This model runs on assumptions. Tabulate runs on your actual cap table.';

function ctaSection(): ReportSection {
  return {
    id: 'cta',
    title: CTA_HEADING,
    blocks: [
      { kind: 'paragraph', text: CTA_LINE },
      { kind: 'bullets', items: ['Book a demo — incentiv.finance', 'Explore Tabulate — incentiv.finance/tabulate'] },
    ],
  };
}

/* ------------------------------------------------------------------------- *
 * The model
 * ------------------------------------------------------------------------- */

export function buildReportModel(args: {
  readonly inputs: EsopInputs;
  readonly result: EsopResult;
  readonly lead: LeadDraft;
  /** Passed in rather than read from a clock, so the output is deterministic. */
  readonly preparedOn?: string;
}): ReportModel {
  const { inputs, result, lead } = args;
  const preparedOn = args.preparedOn ?? result.asOfDate;

  const sections: ReportSection[] = [
    recommendationSection(inputs, result),
    inputsSection(inputs),
    rollForwardSection(result),
    chartsSection(inputs.grantPolicy.grantBasis.kind),
    capTableSection(result),
  ];

  const round = roundSection(result);
  if (round) sections.push(round);

  sections.push(scenariosSection(inputs, result));
  sections.push(complianceSection(result.complianceChecks));
  sections.push(expenseSection(result));
  sections.push(glossarySection());
  sections.push(ctaSection());

  const cover = buildCover({ inputs, result, lead, preparedOn });

  return {
    cover,
    sections,
    footer: 'Incentiv · General information, not legal advice.',
    controlsFooter: `Grant basis: ${cover.grantBasis} · Strike price policy: ${cover.strikePolicy}`,
  };
}

/* ------------------------------------------------------------------------- *
 * Flattening, for the prohibition checks and for any text export
 * ------------------------------------------------------------------------- */

function blockText(block: ReportBlock): string {
  switch (block.kind) {
    case 'paragraph':
    case 'callout':
      return block.text;
    case 'bullets':
      return block.items.join('\n');
    case 'keyValue':
      return block.rows
        .map((row) => `${row.label}: ${row.value}${row.provenance ? ` [${PROVENANCE_LABEL[row.provenance]}]` : ''}`)
        .join('\n');
    case 'table':
      return [block.caption ?? '', block.headers.join(' | '), ...block.rows.map((r) => r.join(' | '))]
        .filter((line) => line.length > 0)
        .join('\n');
    case 'chart':
      return `${block.title}\n${block.caption}\n${block.keys.map((k) => k.label).join(', ')}`;
    case 'checklist':
      return block.items
        .map((item) => `${item.title} — ${item.finding} ${item.action} ${item.reference} ${item.disclaimer}`)
        .join('\n');
  }
}

export function sectionText(section: ReportSection): string {
  return [section.title, ...section.blocks.map(blockText)].join('\n');
}

/** The whole report as one string. What the prohibition checks run against. */
export function reportPlainText(model: ReportModel): string {
  return [coverText(model.cover), ...model.sections.map(sectionText), model.controlsFooter, model.footer].join(
    '\n\n',
  );
}

export function reportFileName(model: ReportModel): string {
  const slug = model.cover.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return `esop-pool-sizing-${slug.length > 0 ? slug : 'report'}.pdf`;
}
