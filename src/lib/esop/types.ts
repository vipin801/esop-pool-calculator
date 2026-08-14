/**
 * ESOP pool engine — input and output shapes.
 *
 * Source of truth: docs/esop/ENGINE_SPEC.md. Section references below point at it.
 * If anything in this file disagrees with the spec, this file is wrong.
 *
 * No `any` anywhere. Every fork the spec names is a discriminated union, so an
 * illegal combination cannot be constructed.
 */

/* ------------------------------------------------------------------------- *
 * Provenance (PROJECT.md D6)
 * ------------------------------------------------------------------------- */

/**
 * There are exactly two tiers. There is deliberately no `sourced` tier, because
 * we hold no measured data about the founder's own company.
 *
 * - `estimate`    a modelling judgement. Nobody measured it. Either the spec
 *                 states it as a v2 default, or it is advisory consensus.
 * - `provisional` a figure standing in until someone checks it: a dated
 *                 third-party observation we have not independently verified,
 *                 or a placeholder for something the spec does not set.
 *
 * Both must be marked as editable estimates in the UI. Neither may ever be
 * presented as sourced data.
 */
export type Provenance = 'estimate' | 'provisional';

/* ------------------------------------------------------------------------- *
 * Enumerations
 * ------------------------------------------------------------------------- */

/**
 * Seniority bands. Maps to the spec's section 1 vocabulary:
 * leadership = CXO or VP, senior = senior IC, mid = mid IC, junior = junior.
 */
export const BANDS = ['leadership', 'senior', 'mid', 'junior'] as const;
export type Band = (typeof BANDS)[number];

export const STAGES = ['preSeed', 'seed', 'seriesA', 'seriesB', 'seriesCPlus'] as const;
export type Stage = (typeof STAGES)[number];

/** Benchmark tracks also report on growth rounds, which are not a funding stage input. */
export const BENCHMARK_STAGE_ORDER = [
  'preSeed',
  'seed',
  'seriesA',
  'seriesB',
  'seriesCPlus',
  'growth',
] as const;
export type BenchmarkStage = (typeof BENCHMARK_STAGE_ORDER)[number];

export type Geography = 'IN' | 'US';

/** Drives ordinary vs special resolution. Spec section 5. */
export type CompanyType = 'private' | 'unlistedPublic';

/** Only the two sectors the spec names. Do not invent more. Spec section 6. */
export type Sector = 'general' | 'itServices' | 'ecommerce';

export type VestFrequency = 'monthly' | 'quarterly' | 'annual';

/** Ind AS 102 fair value, or the ICAI Guidance Note intrinsic basis. Spec section 5. */
export type AccountingBasis = 'indAS102' | 'icaiGuidanceNote';

/**
 * Spec section 5. Build the field now, expose only ESOP. The Corporate Laws
 * (Amendment) Bill 2026 that would recognise RSUs and SARs is not law.
 */
export const INSTRUMENTS = ['ESOP', 'RSU', 'SAR'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** The only instrument the UI may offer today. */
export const EXPOSED_INSTRUMENTS = ['ESOP'] as const satisfies readonly Instrument[];

/**
 * Post-termination exercise window. Spec section 6 names exactly these four:
 * 30 days, 90 days, 1 year, 5 years. 90 is the default.
 */
export const EXERCISE_WINDOW_DAYS_OPTIONS = [30, 90, 365, 1825] as const;
export type ExerciseWindowDays = (typeof EXERCISE_WINDOW_DAYS_OPTIONS)[number];

/* ------------------------------------------------------------------------- *
 * The two forks the spec calls fatal if unmodelled
 * ------------------------------------------------------------------------- */

/**
 * Spec section 1. The whole ballgame.
 *
 * Under `percentOfEquity` (Basis A) pool consumption is independent of
 * valuation. Under `rupeeValue` (Basis B) valuation growth is the single
 * largest driver. Same company, same hiring plan, two very different answers.
 *
 * A union, not a flag plus two optional bags, so a rupee grant table cannot
 * exist without the basis that gives it meaning.
 */
export type GrantBasis =
  | {
      readonly kind: 'percentOfEquity';
      /** pct_b. Percent of fully diluted equity per hire, per band. */
      readonly grantPctByBand: Readonly<Record<Band, number>>;
    }
  | {
      readonly kind: 'rupeeValue';
      /** G_b. Rupee grant value per hire, per band, at grant date. */
      readonly grantValueByBand: Readonly<Record<Band, number>>;
    };

export type GrantBasisKind = GrantBasis['kind'];

/**
 * Spec section 2. Decides the denominator, and therefore the answer.
 * Indian practice has converged on face value at early stage and the last
 * round price at growth stage; a discount to FMV is the third pole.
 */
export type StrikePolicy =
  | { readonly kind: 'faceValue' }
  | { readonly kind: 'lastRoundPrice' }
  | { readonly kind: 'discountToFMV'; readonly discountPct: number };

export type StrikePolicyKind = StrikePolicy['kind'];

/**
 * Spec section 2. The engine computes all three. Notional is the headline,
 * realisable sits underneath. A tool that shows only notional is doing what
 * every bad offer letter in India already does.
 */
export const VALUE_BASES = ['notional', 'realisable', 'fairValue'] as const;
export type ValueBasis = (typeof VALUE_BASES)[number];

/* ------------------------------------------------------------------------- *
 * Inputs
 * ------------------------------------------------------------------------- */

/** Spec section 3 and section 5. */
export interface CompanyInputs {
  readonly stage: Stage;
  readonly companyType: CompanyType;
  /** V_0, post-money. */
  readonly postMoneyValuation: number;
  /** FD_0, fully diluted, including the unallocated pool. */
  readonly fullyDilutedShares: number;
  /** Unallocated options already authorised but not granted. */
  readonly existingUnallocatedOptions: number;
  /** Granted and outstanding, vested or not. Not yet issued shares. */
  readonly grantedOutstandingOptions: number;
  readonly faceValuePerShare: number;
  /**
   * Held in shares. The rupee figure is faceValuePerShare times this, and the
   * spec wants the share shortfall and the rupee increase quoted, never a fee
   * estimate, because stamp duty varies by state.
   */
  readonly authorisedCapitalShares: number;
}

/** Spec section 3. H_t,b is derived from the yearly total and the mix. */
export interface HiringPlan {
  /** T, in years. */
  readonly horizonYears: number;
  /** Total hires per year, index 0 is year 1. */
  readonly hiresPerYear: readonly number[];
  /** Percentages across bands. Must sum to 100. */
  readonly seniorityMix: SeniorityMix;
}

export type SeniorityMix = Readonly<Record<Band, number>>;

export interface GrowthInputs {
  /** Drives V_t, and therefore PPS_t. Irrelevant under Basis A, decisive under Basis B. */
  readonly valuationGrowthPctPerYear: number;
}

/** Spec section 2. Black-Scholes inputs behind theta. */
export interface FairValueAssumptions {
  /** theta. Value ratio of an option to a share. Approaches 1 as strike approaches zero. */
  readonly theta: number;
  readonly expectedLifeYears: number;
  readonly volatilityPct: number;
}

/** Spec section 4.2. */
export interface RefreshPolicy {
  /** Share of eligible employees who receive a refresh in a year. */
  readonly ratePct: number;
  /** Refresh size as a percentage of an initial grant for that band. */
  readonly sizePct: number;
  /** Tenure at which an employee becomes refresh-eligible. Spec default 24. */
  readonly eligibilityMonths: number;
}

export interface GrantPolicyInputs {
  readonly grantBasis: GrantBasis;
  readonly strikePolicy: StrikePolicy;
  /** i. Comp inflation applied to grant values. */
  readonly compInflationPctPerYear: number;
  readonly refresh: RefreshPolicy;
  /** Applied to total consumption in the fixed point. Spec section 4.5. */
  readonly bufferPct: number;
  readonly fairValue: FairValueAssumptions;
}

/** Spec section 6. a_b, with band and sector overrides over a base rate. */
export interface AttritionInputs {
  readonly baseAnnualPct: number;
  readonly byBand: Readonly<Partial<Record<Band, number>>>;
  readonly sector: Sector;
}

/** Spec section 4.3 and section 6. */
export interface ExerciseInputs {
  readonly exerciseWindowDays: ExerciseWindowDays;
  /** lambda. Share of vested options never exercised after exit. Spec default 50. */
  readonly vestedNeverExercisedPct: number;
  /** Exercises by continuing employees. Spec default 0 pre-liquidity in India. */
  readonly continuingEmployeeExercisePctPerYear: number;
  /** Whether forfeited and lapsed options return to the pool. Spec section 4.3. */
  readonly recycleForfeited: boolean;
}

/** Spec section 4.3. c in months, k in years. */
export interface VestingSchedule {
  readonly cliffMonths: number;
  readonly vestYears: number;
  /**
   * Spec section 4.3 vests linearly after the cliff and does not model a tick
   * frequency. Carried because founders enter it and the report shows it.
   */
  readonly frequency: VestFrequency;
}

/** Spec section 5. */
export interface ComplianceInputs {
  /** Drives the Rule 12 promoter and 10%-director exemption, GSR 127(E). */
  readonly dpiitRecognised: boolean;
  /**
   * Drives the perquisite tax deferral under Section 392(3) read with
   * Section 289(3), which requires eligible-startup status under Section 140.
   *
   * PROJECT.md D4. Never collapse this into dpiitRecognised. DPIIT recognition
   * on its own does not qualify: roughly 4,000 of about 1.97 lakh recognised
   * startups hold IMB certification.
   */
  readonly imbCertified80IAC: boolean;
  /** ISO date. The DPIIT Rule 12 exemption runs 10 years from incorporation. */
  readonly incorporationDate: string;
  /** Grants to employees of a holding, subsidiary or associate company. */
  readonly grantsToGroupCompanyEmployees: boolean;
  /** Any identified employee granted 1% or more of issued capital in one year. */
  readonly anyIndividualGrantAtOrAbove1Pct: boolean;
  readonly accountingBasis: AccountingBasis;
  readonly instrument: Instrument;
}

/** Whether the new pool is cut before or after the investor's money. Spec section 4.6. */
export type PoolCreationTiming = 'preMoney' | 'postMoney';

/** Spec section 4.6. The pool shuffle is the highest value output in the tool. */
export interface FundingRound {
  readonly id: string;
  readonly label: string;
  /** Year index within the horizon. */
  readonly year: number;
  /** Vpre. */
  readonly preMoneyValuation: number;
  /** R. */
  readonly raiseAmount: number;
  /** pi. Investor-required post-round pool, as a percentage of post-round fully diluted. */
  readonly investorRequiredPostRoundPoolPct: number;
  readonly poolCreation: PoolCreationTiming;
}

/** TopUp_t in the roll forward. Spec section 4.4. */
export interface PoolTopUp {
  readonly year: number;
  readonly options: number;
}

export interface EsopInputs {
  readonly company: CompanyInputs;
  readonly hiring: HiringPlan;
  readonly growth: GrowthInputs;
  readonly grantPolicy: GrantPolicyInputs;
  readonly attrition: AttritionInputs;
  readonly exercise: ExerciseInputs;
  readonly vesting: VestingSchedule;
  readonly compliance: ComplianceInputs;
  readonly rounds: readonly FundingRound[];
  readonly topUps: readonly PoolTopUp[];
}

/* ------------------------------------------------------------------------- *
 * Outputs — spec section 7, items 1 to 11
 * ------------------------------------------------------------------------- */

/**
 * A pool figure and the two controls that produced it, welded together.
 *
 * PROJECT.md prohibits outputting a pool percentage without the grant basis and
 * strike policy visible alongside it. Carrying both on the same object makes a
 * naked pool percentage impossible to render by accident.
 */
export interface PoolSizing {
  readonly grantBasisKind: GrantBasisKind;
  readonly strikePolicyKind: StrikePolicyKind;
  readonly poolPctOfFullyDiluted: number;
  readonly poolOptions: number;
}

/** Item 1. The selected basis, plus the same figure under the other basis. */
export interface RecommendedPool {
  readonly selected: PoolSizing;
  readonly comparison: PoolSizing;
}

/** Item 2. Spec section 4.4, interpolated to a month on that year's run rate. */
export interface PoolExhaustion {
  readonly exhausted: boolean;
  readonly monthIndex: number | null;
  readonly yearIndex: number | null;
}

/** Item 3. */
export interface TopUpRequirement {
  readonly roundId: string;
  readonly topUpPctPoints: number;
  readonly topUpOptions: number;
}

/** Spec section 4.6, one arm of the pre-money versus post-money comparison. */
export interface PoolShuffleOutcome {
  /** T, post-round fully diluted. */
  readonly postRoundFullyDiluted: number;
  /** I. */
  readonly investorShares: number;
  /** dP. */
  readonly newPoolShares: number;
  readonly investorPricePerShare: number;
  /** dP / T. */
  readonly founderDilutionFromPoolPctPoints: number;
  readonly founderDilutionCostRupees: number;
}

/** Item 4. The delta is the number the founder is actually buying the tool for. */
export interface PoolCostToFounders {
  readonly roundId: string;
  readonly preMoneyPool: PoolShuffleOutcome;
  readonly postMoneyPool: PoolShuffleOutcome;
  readonly deltaRupees: number;
  readonly deltaPctPoints: number;
}

/** Item 5. Spec section 4.4, plus the exercised leg that v1 ignored. */
export interface RollForwardYear {
  readonly year: number;
  readonly openingAvailable: number;
  /** TopUp_t. */
  readonly topUp: number;
  /** N_t. */
  readonly newHireGrants: number;
  /** R_t. */
  readonly refreshGrants: number;
  /** Returned_t. Zero when recycleForfeited is off. */
  readonly returnedToPool: number;
  readonly unvestedForfeited: number;
  readonly vestedLapsed: number;
  /** Leaves the pool permanently and becomes issued shares. */
  readonly vestedExercised: number;
  readonly closingAvailable: number;
  /** FD_t. */
  readonly fullyDilutedShares: number;
  /** PPS_t. */
  readonly pricePerShare: number;
  readonly closingIssuedShares: number;
}

export type CapTableHolder =
  | 'founders'
  | 'investors'
  | 'grantedOptions'
  | 'unallocatedPool'
  | 'exercisedShares';

export interface CapTableRow {
  readonly holder: CapTableHolder;
  readonly shares: number;
  readonly pctOfFullyDiluted: number;
}

export interface CapTable {
  readonly label: string;
  readonly rows: readonly CapTableRow[];
  readonly fullyDilutedShares: number;
}

/** Item 6. */
export interface CapTableSet {
  readonly before: CapTable;
  readonly after: CapTable;
  readonly afterModelledRound: CapTable | null;
}

/**
 * Item 7. Spec section 5 wants the share shortfall and the rupee increase, and
 * explicitly not a fee estimate, because stamp duty and ROC fees vary by state.
 * There is no fee field here on purpose.
 */
export interface AuthorisedCapitalHeadroom {
  readonly authorisedShares: number;
  /** Issued shares plus the pool at scheme adoption. */
  readonly requiredShares: number;
  readonly shortfallShares: number;
  readonly increaseRequiredRupees: number;
  readonly sufficient: boolean;
}

/** Item 8. Spec section 5. Surfaces in diligence and blindsides founders. */
export interface EsopExpenseYear {
  readonly year: number;
  readonly expenseRupees: number;
  readonly basis: AccountingBasis;
}

export type ComplianceSeverity = 'info' | 'action' | 'blocker';

/** The exact string PROJECT.md requires on every compliance row. */
export const COMPLIANCE_DISCLAIMER = 'General information, not legal advice.' as const;
export type ComplianceDisclaimer = typeof COMPLIANCE_DISCLAIMER;

/**
 * Item 9. `disclaimer` is a literal type, not a free string, so a compliance
 * row without the required wording will not compile.
 */
export interface ComplianceFlag {
  readonly id: string;
  readonly severity: ComplianceSeverity;
  readonly title: string;
  readonly detail: string;
  /** e.g. "Section 62(1)(b), Companies Act 2013, with Rule 12". */
  readonly statutoryReference: string;
  readonly disclaimer: ComplianceDisclaimer;
}

export type BenchmarkTrackId = 'advisory' | 'observed';

export type BenchmarkPosition = 'below' | 'within' | 'above' | 'noBandForStage';

/**
 * Item 10. Both tracks, always, in one array. PROJECT.md D5: neither is
 * presented as the truth, so there is no primary, preferred or weight field.
 */
export interface BenchmarkTrackComparison {
  readonly trackId: BenchmarkTrackId;
  readonly trackLabel: string;
  readonly provenance: Provenance;
  readonly band: BenchmarkBand | null;
  readonly position: BenchmarkPosition;
}

export interface BenchmarkComparison {
  readonly poolPctOfFullyDiluted: number;
  readonly tracks: readonly BenchmarkTrackComparison[];
}

/** Item 11. Notional, and realisable after exercise cost and perquisite tax. */
export interface MedianEmployeeValue {
  readonly band: Band;
  readonly optionsGranted: number;
  readonly vestedAtHorizon: number;
  readonly notionalValueRupees: number;
  readonly exerciseCostRupees: number;
  readonly perquisiteTaxRupees: number;
  readonly realisableValueRupees: number;
  readonly marginalTaxRatePct: number;
  /** True only when dpiitRecognised AND imbCertified80IAC. Never DPIIT alone. */
  readonly taxDeferralAvailable: boolean;
}

/** Spec section 2. All three bases, computed, never just notional. */
export interface GrantValueBreakdown {
  readonly band: Band;
  readonly year: number;
  readonly optionsByValueBasis: Readonly<Record<ValueBasis, number>>;
}

/** Spec section 4.5 requires the iteration count to come back out. */
export interface SolverDiagnostics {
  readonly iterations: number;
  readonly converged: boolean;
  readonly tolerancePctPoints: number;
  readonly maxIterations: number;
}

/** Spec section 8. */
export type EngineWarningId =
  | 'notionalValueOverstatesReceipt'
  | 'cliffBelowStatutoryMinimum'
  | 'authorisedCapitalShortfall'
  | 'solverDidNotConverge'
  | 'seniorityMixDoesNotSumTo100';

export interface EngineWarning {
  readonly id: EngineWarningId;
  readonly message: string;
}

export interface EsopOutputs {
  readonly recommendedPool: RecommendedPool;
  readonly exhaustion: PoolExhaustion;
  readonly topUpAtNextRound: TopUpRequirement | null;
  readonly poolCostToFounders: PoolCostToFounders | null;
  readonly rollForward: readonly RollForwardYear[];
  readonly capTables: CapTableSet;
  readonly authorisedCapital: AuthorisedCapitalHeadroom;
  readonly esopExpenseByYear: readonly EsopExpenseYear[];
  readonly complianceFlags: readonly ComplianceFlag[];
  readonly benchmarkComparison: BenchmarkComparison;
  readonly medianEmployeeValue: MedianEmployeeValue;
  readonly grantValueBreakdown: readonly GrantValueBreakdown[];
  readonly solver: SolverDiagnostics;
  readonly warnings: readonly EngineWarning[];
}

/* ------------------------------------------------------------------------- *
 * Benchmarks — shapes only. The two tracks live in benchmarks.ts.
 * ------------------------------------------------------------------------- */

/**
 * How a band's numbers should be read.
 *
 * - `range`          a low-to-high band.
 * - `upperBoundOnly` "below 10%". lowPct is null; there is no stated floor.
 * - `average`        a reported average, carried as a narrow band.
 */
export type BenchmarkBoundKind = 'range' | 'upperBoundOnly' | 'average';

export interface BenchmarkBand {
  readonly stage: BenchmarkStage;
  readonly geography: Geography;
  /** Null when the finding states only a ceiling. */
  readonly lowPct: number | null;
  readonly highPct: number;
  readonly kind: BenchmarkBoundKind;
  readonly label: string;
}

/** Which way pool sizes move with stage, within one track and geography. */
export type StageTrendDirection = 'increasing' | 'decreasing';

export interface StageTrend {
  readonly geography: Geography;
  readonly direction: StageTrendDirection;
  readonly note: string;
}

/**
 * Bands that overlap on purpose, declared as data.
 *
 * The spec's own ladders are not partitions, so overlap cannot simply be
 * forbidden. Declaring the known ones lets the tests fail loudly on any new
 * overlap without weakening the check to nothing.
 */
export interface DeclaredOverlap {
  readonly geography: Geography;
  readonly stages: readonly [BenchmarkStage, BenchmarkStage];
  readonly why: string;
}

/**
 * One benchmark track. PROJECT.md D5 shows both together and treats neither as
 * the truth, so this shape carries no authority, rank, weight or default field,
 * and both tracks use it unchanged.
 */
export interface BenchmarkTrack {
  readonly id: BenchmarkTrackId;
  readonly label: string;
  /** One line saying what this track is, and what it is not. */
  readonly description: string;
  readonly provenance: Provenance;
  /** When this was last checked. Both tracks must be re-verified before launch. */
  readonly asOf: string;
  readonly caveat: string;
  readonly bands: readonly BenchmarkBand[];
  readonly stageTrends: readonly StageTrend[];
  readonly knownOverlaps: readonly DeclaredOverlap[];
}

/* ------------------------------------------------------------------------- *
 * Defaults — shapes only. The values live in defaults.ts.
 * ------------------------------------------------------------------------- */

export type DefaultValue =
  | number
  | boolean
  | string
  | readonly number[]
  | Readonly<Record<string, number>>
  | Readonly<Record<string, string>>;

/**
 * A default, and where it came from. PROJECT.md D6: every default is an
 * editable estimate, marked as such, and never presented as sourced data.
 */
export interface DefaultEntry<T extends DefaultValue = DefaultValue> {
  readonly value: T;
  readonly provenance: Provenance;
  /** One line: what this is, and why it holds this value. */
  readonly what: string;
  /** When this was last checked. */
  readonly asOf: string;
  /**
   * Set only when the value is zero and that zero is a deliberate modelling
   * position rather than an unfilled field. Nothing may be silently zero.
   */
  readonly intentionalZero?: true;
}
