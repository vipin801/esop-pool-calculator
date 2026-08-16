/**
 * ESOP pool engine — input and output shapes.
 *
 * Source of truth: docs/esop/ENGINE_SPEC.md. Section references below point at it.
 * If anything in this file disagrees with the spec, this file is wrong.
 *
 * No `any` anywhere. Every fork the spec names is a discriminated union, so an
 * illegal combination cannot be constructed.
 */

import type { EsopErrorCode } from './errors';

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
  /**
   * The founders' share of FD_0, including the unallocated pool in the base.
   *
   * Needed because spec output items 4 and 6 are about the founders and the
   * roll forward only ever knows the issued total. Investor shares are the
   * remainder — `issued - founders` — rather than a second input, so the two
   * cannot be entered in a way that does not add up.
   */
  readonly founderOwnershipPctOfFullyDiluted: number;
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
  /**
   * The other basis, for spec output item 1's "the same figure under the other
   * basis".
   *
   * It has to be supplied rather than derived, because `GrantBasis` is a union
   * and the selected arm carries only its own grant table: a percent-of-equity
   * plan simply does not hold the rupee figures the comparison needs. That is
   * the union doing its job rather than a gap, and D6 forbids the engine
   * quietly filling it from `DEFAULTS` where the founder cannot see or edit it.
   * Its `kind` must differ from `grantBasis.kind` or the engine refuses.
   */
  readonly comparisonGrantBasis: GrantBasis;
  readonly strikePolicy: StrikePolicy;
  /**
   * Which of section 2's three denominators converts a rupee grant into options.
   *
   * It sits here, beside the other two forks, because it decides the answer as
   * much as they do: the same ₹25 lakh promise buys one option count against
   * PPS_t and a very different one against PPS_t - X_t. Inert under Basis A,
   * which has no denominator at all — model decision M15.
   */
  readonly valueBasis: ValueBasis;
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

/* ------------------------------------------------------------------------- *
 * Opening state — what the company already holds when the plan starts
 * ------------------------------------------------------------------------- */

/**
 * Options already granted and outstanding when the plan starts.
 *
 * `ageYearsAtPlanStart` is how long ago they were granted, measured at the start
 * of year 0. It is the one thing a founder has to tell us that a total on its
 * own cannot: an option granted three years ago and one granted last month
 * behave nothing alike when their holder resigns. Spec section 4.3 is headed
 * "required, do not approximate", and model decision M21 is why the engine
 * raises rather than inventing a grant year on the founder's behalf.
 */
export interface OpeningGrantCohortInput {
  readonly band: Band;
  readonly outstandingOptions: number;
  readonly ageYearsAtPlanStart: number;
  /** Optional: what was originally granted, if some has already gone. */
  readonly grantedOptions?: number;
  /**
   * Fair value per option at this cohort's original grant date, for the Ind AS
   * 102 estimate. Optional, and `undefined` is not the same input as `0` — M29.
   *
   * Leave it unsupplied and the cohort is excluded from the expense estimate,
   * because the engine holds no price per share from before the plan started
   * to value it at and would otherwise have to guess one. Supply it — including
   * as exactly `0`, a scheme adopted at a price equal to par, say — and the
   * cohort is amortised over its remaining vesting like any other, at the value
   * given. The two states report differently: `EsopExpenseSchedule` keeps
   * `excludedOpeningOptions` and `includedOpeningOptions` apart rather than
   * merging them, because "we don't know" and "we know, and it was nothing"
   * are different facts that happen to net to the same rupee total.
   */
  readonly grantDateValuePerOption?: number;
}

/** Staff already employed when the plan starts, with their tenure at that point. */
export interface OpeningHeadcountInput {
  readonly band: Band;
  readonly headcount: number;
  readonly tenureYearsAtPlanStart: number;
}

/**
 * Spec output item 11. What a median employee's grant is worth at the horizon.
 *
 * The marginal rate is an input rather than a constant because the spec says
 * only "taxed at slab" and D6 makes every assumption editable. It is the
 * employee's rate, not the company's.
 */
export interface EmployeeValueInputs {
  readonly marginalTaxRatePct: number;
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

/**
 * The cap table going into a round. Spec section 4.6 asks only for `S_ex` and
 * `U`, but a cap table has to name who holds `S_ex`, so it is carried split.
 *
 *   S_ex = founderShares + investorShares + grantedOptions
 *   U    = unallocatedPool
 *
 * Exercised options become issued shares and will join `S_ex` as a fifth line
 * when section 4.3 lands. `CapTableHolder` already has the row for them.
 */
export interface PreRoundHoldings {
  readonly founderShares: number;
  /** Every investor from earlier rounds, before this round's investor. */
  readonly investorShares: number;
  /** Granted and outstanding. Allocated, so inside S_ex and not inside U. */
  readonly grantedOptions: number;
  /** U. */
  readonly unallocatedPool: number;
}

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

/**
 * Everything `calculateEsopPool` needs, and nothing it does not.
 *
 * There is no optional field on this shape and no default applied inside the
 * engine: a caller who leaves something out gets a `tsc` error rather than a
 * number computed against an assumption they never saw. `DEFAULTS` in
 * defaults.ts is what a form seeds itself from, in the form, where the founder
 * can see and edit each value — D6.
 */
export interface EsopInputs {
  readonly company: CompanyInputs;
  readonly hiring: HiringPlan;
  readonly growth: GrowthInputs;
  readonly grantPolicy: GrantPolicyInputs;
  readonly attrition: AttritionInputs;
  readonly exercise: ExerciseInputs;
  readonly vesting: VestingSchedule;
  readonly compliance: ComplianceInputs;
  readonly employeeValue: EmployeeValueInputs;
  readonly rounds: readonly FundingRound[];
  readonly topUps: readonly PoolTopUp[];
  /**
   * The cohorts behind `company.grantedOutstandingOptions`. Required whenever
   * that figure is above zero; an empty array is the correct input for a
   * company that has granted nothing.
   */
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  /**
   * Staff already employed at the start of year 0. Left empty, refresh demand
   * in the early years comes only from the hires in the plan, which understates
   * it for any company that already has people.
   */
  readonly openingHeadcount: readonly OpeningHeadcountInput[];
  /**
   * ISO date the answer is struck as at, YYYY-MM-DD.
   *
   * Taken as an input and never read from a clock, because the DPIIT Rule 12
   * exemption expires on a specific day and an engine that reads the system
   * clock cannot be tested at that boundary.
   */
  readonly asOfDate: string;
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
  /** Null under Basis A, which never divides by a denominator. */
  readonly valueBasis: ValueBasis | null;
  readonly poolPctOfFullyDiluted: number;
  readonly poolOptions: number;
  /** The figure to print: `poolPctOfFullyDiluted` rounded up to the nearest 0.5%. */
  readonly displayPoolPctOfFullyDiluted: number;
}

/** Item 1. The selected basis, plus the same figure under the other basis. */
export interface RecommendedPool {
  readonly selected: PoolSizing;
  readonly comparison: PoolSizing;
}

/** Item 2. Spec section 4.4, interpolated to a month on that year's run rate. */
export interface PoolExhaustion {
  readonly exhausted: boolean;
  /**
   * Months from the start of year 0. Zero is a real answer, not a missing one:
   * a pool with nothing in it and a hiring plan is exhausted before it starts.
   */
  readonly monthIndex: number | null;
  readonly yearIndex: number | null;
  /**
   * How many hires the pool covers before it runs out, whole years plus the
   * part-year the interpolation lands in. The whole plan when it never runs out.
   */
  readonly hiresSupported: number;
}

/**
 * Item 3. How much new pool the next round requires, measured against the
 * post-round company.
 *
 * `topUpPctPoints` is `dP / T`, section 4.6's own measure: the new pool's
 * footprint on the post-round company. `existingPoolPostRoundPct` is the
 * comparison an investor's demand should actually be read against, per M13 —
 * a pool sitting at 11.1% before a 20% round lands at 8.9% after it without a
 * single new option being reserved, so comparing `pi` against the pre-round
 * percentage overstates the top-up.
 */
export interface TopUpRequirement {
  readonly roundId: string;
  readonly topUpPctPoints: number;
  readonly topUpOptions: number;
  /** pi. What the investor is asking for, post-round. */
  readonly investorRequiredPostRoundPoolPct: number;
  /** Where the pool already lands after this round with nothing new reserved. M13. */
  readonly existingPoolPostRoundPct: number;
  /** Which convention this top-up is measured under. */
  readonly poolCreation: PoolCreationTiming;
}

/** Spec section 4.6, one arm of the pre-money versus post-money comparison. */
export interface PoolShuffleOutcome {
  readonly poolCreation: PoolCreationTiming;
  /** T, post-round fully diluted. */
  readonly postRoundFullyDiluted: number;
  /** I. This round's investor only, not the investors already on the register. */
  readonly investorShares: number;
  /** dP. Negative when the required pool is smaller than the pool already reserved. */
  readonly newPoolShares: number;
  /** pi * T. The whole pool post-round, old and new. */
  readonly postRoundPoolShares: number;
  /**
   * What this round's investor paid. Under `preMoney` the new pool sits inside
   * the pre-money share count, so this is lower than under `postMoney`.
   */
  readonly investorPricePerShare: number;
  /**
   * (Vpre + R) / T. What a share is marked at once both events are done.
   * Identical to `investorPricePerShare` under `preMoney`; lower under
   * `postMoney`, where the pool is cut after the investor bought.
   */
  readonly postRoundPricePerShare: number;
  /** I / T. Equals R/(Vpre+R) exactly under `preMoney`, and less under `postMoney`. */
  readonly investorPctOfFullyDiluted: number;
  readonly founderPctOfFullyDiluted: number;
  /**
   * dP / T, as spec section 4.6 defines it: the new pool's share of the
   * post-round company. Read it as the pool's footprint, not as the founders'
   * own percentage loss, which is smaller because the existing pool and the
   * granted options are diluted too.
   */
  readonly founderDilutionFromPoolPctPoints: number;
  /** That footprint valued at `postRoundPricePerShare`. */
  readonly founderDilutionCostRupees: number;
  readonly capTables: PoolShuffleCapTables;
}

/** Item 4. The delta is the number the founder is actually buying the tool for. */
export interface PoolCostToFounders {
  readonly roundId: string;
  /** Which convention this round is actually being offered on. */
  readonly asOffered: PoolCreationTiming;
  readonly preMoneyPool: PoolShuffleOutcome;
  readonly postMoneyPool: PoolShuffleOutcome;
  /** Spec measure: pre-money `dP/T` minus post-money `dP/T`. */
  readonly deltaPctPoints: number;
  readonly deltaRupees: number;
  /**
   * What the founders keep by moving the pool into the post-money: their
   * post-round percentage under `postMoney` minus the same under `preMoney`.
   *
   * This is a different and larger number than `deltaPctPoints`, because part
   * of a post-money pool is borne by the incoming investor rather than by the
   * founders. Both are reported; neither is a substitute for the other.
   */
  readonly founderOwnershipDeltaPctPoints: number;
  /** That percentage difference valued at the round's post-money valuation. */
  readonly founderOwnershipDeltaRupees: number;
}

/**
 * Item 5. Spec section 4.4, plus the exercised leg that v1 ignored.
 *
 * `openingAvailable` and `closingAvailable` are the only signed fields on this
 * shape. Section 4.4 defines exhaustion as the first year where `Available_t`
 * goes below zero, so the negative *is* the signal and clamping it would delete
 * the thing the exhaustion month is read off. Every other field is a count and
 * cannot be negative.
 */
export interface RollForwardYear {
  readonly year: number;
  readonly openingAvailable: number;
  /** TopUp_t, and the options it adds to the fully diluted count. */
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
  /** Exercises by employees still in service. Zero pre-liquidity by default. */
  readonly continuingEmployeeExercised: number;
  /** vestedExercised + continuingEmployeeExercised. Issued this year. */
  readonly exercisedShares: number;
  /**
   * Forfeited and lapsed options when recycling is off. They can never be
   * granted again, so they leave the fully diluted count rather than sitting in
   * it as potential shares that cannot happen.
   */
  readonly cancelledNotRecycled: number;
  readonly closingAvailable: number;
  /** FD_t at the end of year t: the opening count less anything cancelled. */
  readonly fullyDilutedShares: number;
  /**
   * FD after this year's top-up and before this year's cancellations. This is
   * the count that prices year t's grants and PPS_t, because a grant made in
   * March cannot be priced off a December share count that its own forfeitures
   * helped set. Identical to `fullyDilutedShares` whenever recycling is on.
   */
  readonly openingFullyDilutedShares: number;
  /** V_t. */
  readonly valuation: number;
  /** PPS_t = V_t / openingFullyDilutedShares. */
  readonly pricePerShare: number;
  /** D_t. Null under Basis A, which has no denominator. */
  readonly denominator: number | null;
  readonly closingGrantedOutstanding: number;
  readonly closingVestedOutstanding: number;
  readonly closingIssuedShares: number;
  /** Issued shares at face value. What exercises actually put into share capital. */
  readonly closingPaidUpCapitalRupees: number;
  readonly hires: number;
  readonly closingHeadcount: number;
  /** Eligible_t. The base the refresh grant was computed on. */
  readonly refreshEligibleHeadcount: number;
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

/**
 * The total line. Not a `CapTableRow`, because "total" is not a holder and
 * putting it in `rows` would let it be summed with the rows it totals.
 */
export interface CapTableTotal {
  readonly shares: number;
  readonly pctOfFullyDiluted: number;
}

export interface CapTable {
  readonly label: string;
  readonly rows: readonly CapTableRow[];
  /** Always equals the row sums. A test asserts it on every table the engine emits. */
  readonly total: CapTableTotal;
  readonly fullyDilutedShares: number;
}

/** Item 6. */
export interface CapTableSet {
  readonly before: CapTable;
  readonly after: CapTable;
  readonly afterModelledRound: CapTable | null;
}

/**
 * The three states of a round, spec section 4.6.
 *
 * The field names describe states, not order, because the order is what the two
 * conventions disagree about. Under `preMoney` the pool is cut first, so
 * `afterRound` is the last state; under `postMoney` the money lands first, so
 * `afterPoolCreated` is. `final` points at whichever it is, so nothing has to
 * infer it.
 */
export interface PoolShuffleCapTables {
  /** Pre-round. Identical under both conventions. */
  readonly before: CapTable;
  /** The pool at its post-round size. Under `preMoney` the money is not in yet. */
  readonly afterPoolCreated: CapTable;
  /** The investor's money in. Under `postMoney` the new pool is not cut yet. */
  readonly afterRound: CapTable;
  /** Whichever of the two above happened last. Both events done. */
  readonly final: CapTable;
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
  /**
   * The net charge for the period, and the only signed field here. A year in
   * which a lot of unvested options are forfeited credits P&L, because the
   * expense already taken on options that will now never vest has to come back.
   */
  readonly expenseRupees: number;
  /** Straight-line charge on the options still expected to vest. Never negative. */
  readonly amortisationChargeRupees: number;
  /**
   * Expense reversed this year on options forfeited before they vested. Never
   * positive. Vested-but-lapsed options are absent from this figure on purpose:
   * they vested, so their expense stands and is not reversed through P&L.
   */
  readonly forfeitureReversalRupees: number;
  readonly cumulativeExpenseRupees: number;
  readonly basis: AccountingBasis;
}

export interface EsopExpenseSchedule {
  readonly basis: AccountingBasis;
  readonly years: readonly EsopExpenseYear[];
  readonly totalExpenseRupees: number;
  /**
   * Options granted before year 0 whose grant-date fair value was **not**
   * supplied on their opening cohort. Their value depends on a price per share
   * from before the plan starts, which the engine does not hold, so they are
   * excluded from the schedule rather than valued at a price they were not
   * granted at. Reported so the omission is a number and not a silence.
   */
  readonly excludedOpeningOptions: number;
  /**
   * Options granted before year 0 whose grant-date fair value *was* supplied,
   * via `OpeningGrantCohortInput.grantDateValuePerOption`, and are therefore
   * amortised in `years` above like any other cohort. Kept apart from
   * `excludedOpeningOptions` rather than merged into one count: a founder who
   * supplies a genuinely zero grant-date value needs the tool to say
   * "included, at zero", not "unknown", and those two report as the same
   * number the moment the total alone is asked.
   */
  readonly includedOpeningOptions: number;
}

/**
 * `pass` nothing to correct. `warn` something to act on or check that a founder
 * will not otherwise expect. `blocked` the scheme cannot lawfully proceed in
 * this state.
 */
export type ComplianceStatus = 'pass' | 'warn' | 'blocked';

/** The exact string PROJECT.md requires on every compliance row. */
export const COMPLIANCE_DISCLAIMER = 'General information, not legal advice.' as const;
export type ComplianceDisclaimer = typeof COMPLIANCE_DISCLAIMER;

/** Every rule ENGINE_SPEC.md section 5 states. A closed set, so none can be dropped. */
export const COMPLIANCE_CHECK_IDS = [
  'schemeApproval',
  'separateResolution',
  'vestingFloor',
  'eligibility',
  'authorisedCapital',
  'allotmentFilings',
  'taxDeferral',
  'instrument',
] as const;
export type ComplianceCheckId = (typeof COMPLIANCE_CHECK_IDS)[number];

/**
 * Item 9. `disclaimer` is a literal type, not a free string, so a compliance
 * row without the required wording will not compile.
 *
 * `finding` and `action` are separate fields rather than one paragraph, because
 * what is true of this company and what the founder should do about it are
 * different sentences and a report has to be able to lay them out apart.
 */
export interface ComplianceCheck {
  readonly id: ComplianceCheckId;
  readonly title: string;
  readonly status: ComplianceStatus;
  /** One line: what is true of this company. */
  readonly finding: string;
  /** One line: what to do about it. */
  readonly action: string;
  /** e.g. "Section 62(1)(b), Companies Act 2013, with Rule 12". */
  readonly statutoryReference: string;
  readonly disclaimer: ComplianceDisclaimer;
}

/**
 * Spec section 5 and PROJECT.md D4. Three states, never two.
 *
 * `dpiitOnly` is the one that matters: DPIIT recognition carries the Rule 12
 * eligibility exemption and does *not* carry the perquisite tax deferral, which
 * additionally needs an Inter-Ministerial Board certificate. Roughly 4,000 of
 * about 1.97 lakh DPIIT-recognised startups hold one. Collapsing this into a
 * boolean is the error PROJECT.md prohibits.
 */
export type TaxDeferralStatus = 'notEligible' | 'dpiitOnly' | 'dpiitAndImb';

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

/**
 * One of section 2's three value bases, either priced or refused with a reason.
 *
 * The refusal is real and is carried as data rather than thrown: set the strike
 * at the last round price and the realisable spread is zero, which is exactly
 * the case the spec calls out when it says fair value is "the only honest basis
 * when the strike is set at the last round price". A UI has to be able to show
 * notional and fair value and say why realisable is missing.
 */
export type ValueBasisOutcome =
  | { readonly ok: true; readonly optionsPerHire: number; readonly denominator: number }
  | { readonly ok: false; readonly reason: EsopErrorCode; readonly message: string };

/**
 * Spec section 2, per band and per year: what one hire's grant buys.
 *
 * A union on the grant basis, because section 2 is a Basis B question. Under
 * Basis A a grant is a percentage of FD_t and there is no denominator to pick,
 * so reporting three identical value bases there would invent a choice the
 * founder does not have — M15's "inert under Basis A", made structural.
 */
export type GrantValueBreakdown =
  | {
      readonly basisKind: 'percentOfEquity';
      readonly band: Band;
      readonly year: number;
      /** pct_b * FD_t / 100. One number; section 2's value bases do not apply. */
      readonly optionsPerHire: number;
      readonly grantPctOfFullyDiluted: number;
    }
  | {
      readonly basisKind: 'rupeeValue';
      readonly band: Band;
      readonly year: number;
      /** G_b * (1+i)^t. The promise, in rupees, made in year t. */
      readonly grantValueRupees: number;
      /** X_t, the exercise price these options would carry. */
      readonly exercisePrice: number;
      /** All three of section 2, each priced or refused. */
      readonly optionsPerHireByValueBasis: Readonly<Record<ValueBasis, ValueBasisOutcome>>;
    };

/** Spec section 4.5 requires the iteration count to come back out. */
export interface SolverDiagnostics {
  readonly iterations: number;
  readonly converged: boolean;
  readonly tolerancePctPoints: number;
  readonly maxIterations: number;
}

/**
 * Spec section 8, plus two operational warnings the spec's own guardrail list
 * does not name but the engine's behaviour requires: a non-converged solver
 * and a mix that does not sum to 100.
 *
 * A closed array, not a bare union, mirroring `ESOP_ERROR_CODES` in errors.ts
 * and `COMPLIANCE_CHECK_IDS` above: the type is derived from the array, so a
 * warning id cannot exist in the type and nowhere at runtime, or vanish from
 * the type while a string literal referencing it survives in the source.
 * `cliffBelowStatutoryMinimum` was a member here from [004] to [012]: section
 * 5's twelve-month floor is now enforced by `requireLawfulVestingSchedule`
 * throwing an `EsopErrorCode` of the same name — a different union — before an
 * engine call exists that could warn about it instead. Warning about a state
 * the engine already refuses to compute would be dead code with no path to it,
 * which is exactly what an enumerable union is here to catch.
 */
export const ENGINE_WARNING_IDS = [
  /** Strike at FMV plus the notional basis understates what the employee receives. */
  'notionalValueOverstatesReceipt',
  /** Authorised capital is short of issued shares plus the pool. */
  'authorisedCapitalShortfall',
  /** The section 4.5 fixed point did not converge inside 25 iterations. */
  'solverDidNotConverge',
  /** `H_t,b` from a seniority mix that does not sum to 100 loses hires silently. */
  'seniorityMixDoesNotSumTo100',
] as const;
export type EngineWarningId = (typeof ENGINE_WARNING_IDS)[number];

export interface EngineWarning {
  readonly id: EngineWarningId;
  readonly message: string;
}

/**
 * Which pool a roll forward was run against.
 *
 * `recommended` is the plan run at the pool section 4.5 solves for. `current` is
 * the same plan run at the pool the founder holds today, and nothing else about
 * the two runs differs.
 */
export type PoolSeriesLabel = 'recommended' | 'current';

/**
 * One plan, run against one pool, with everything that falls out of that run.
 *
 * **The engine returns two of these and never merges them.** They answer
 * different questions — "how big should the pool be" and "how long does what I
 * hold last" — and their year rows disagree by construction: a plan run at the
 * recommended pool closes every year with options left, and the same plan run
 * at an empty pool is overdrawn from month zero. Reporting a figure from one
 * beside a table from the other is the single most misleading thing this tool
 * can do, so there is no top-level `rollForward` or `exhaustion` on the result
 * for a caller to reach for without naming which series they mean.
 */
export interface PoolPlanSeries {
  readonly label: PoolSeriesLabel;
  /** One line a UI can print above the table, so the two are never confused. */
  readonly description: string;
  /** Available_(-1): the options this run started year 0 with. */
  readonly openingPoolOptions: number;
  /**
   * The opening pool as a share of FD_0 for this run.
   *
   * A measured fact about the company under `current` and a consequence of the
   * recommendation under `recommended`. Not a substitute for `sizing`: the
   * PROJECT.md prohibition on a naked pool percentage is about a percentage the
   * *model* produced, which is what `PoolSizing` welds to its two controls.
   */
  readonly openingPoolPctOfFullyDiluted: number;
  /**
   * The section 4.5 answer, on the `recommended` series only. Null on `current`,
   * because the pool a founder already holds is a fact and not a recommendation,
   * and giving it a `PoolSizing` would imply a grant basis produced it.
   */
  readonly sizing: PoolSizing | null;
  /** Item 5. */
  readonly years: readonly RollForwardYear[];
  /** Item 2. Read this off the `current` series; that is the question the spec asks. */
  readonly exhaustion: PoolExhaustion;
  /** Item 7. */
  readonly authorisedCapital: AuthorisedCapitalHeadroom;
  /** FD_0 for this run, including its opening pool. */
  readonly fullyDilutedSharesAtYear0: number;
  readonly closingAvailable: number;
  readonly closingIssuedShares: number;
  readonly closingGrantedOutstanding: number;
  readonly closingFullyDilutedShares: number;
  /** sum_t (N_t + R_t). */
  readonly totalGrossConsumptionOptions: number;
  /** sum_t Returned_t. Zero when recycling is off. */
  readonly totalReturnedToPool: number;
  readonly totalExercisedShares: number;
  readonly totalCancelledNotRecycled: number;
}

/** One modelled funding round, with both pool conventions priced. Spec section 4.6. */
export interface ModelledRound {
  readonly roundId: string;
  readonly label: string;
  readonly year: number;
  /** The round as the term sheet actually offers it, per `round.poolCreation`. */
  readonly asOffered: PoolShuffleOutcome;
  /** Item 3. */
  readonly topUp: TopUpRequirement;
  /** Item 4. Both conventions and the delta between them. */
  readonly cost: PoolCostToFounders;
}

/**
 * Everything ENGINE_SPEC.md section 7 asks for, from one call.
 *
 * Item 1 is `recommendedPool`. Items 2, 5 and 7 live on the two series, because
 * they are properties of a run and not of the company. Items 3 and 4 are on
 * `rounds`, with the next round lifted out for convenience. Items 6 and 8 to 11
 * are their own fields.
 */
export interface EsopResult {
  /** Item 1. The selected basis, and the same figure under the other one. */
  readonly recommendedPool: RecommendedPool;
  /** The plan at the pool section 4.5 solves for. */
  readonly recommended: PoolPlanSeries;
  /** The same plan at the pool the founder holds today. */
  readonly current: PoolPlanSeries;
  /** Every round the founder modelled, in order. Nothing is silently truncated. */
  readonly rounds: readonly ModelledRound[];
  /** Item 3. `rounds[0].topUp`, or null when no round was modelled. */
  readonly topUpAtNextRound: TopUpRequirement | null;
  /** Item 4. `rounds[0].cost`, or null when no round was modelled. */
  readonly poolCostToFounders: PoolCostToFounders | null;
  /** Item 6. */
  readonly capTables: CapTableSet;
  /** Item 8. */
  readonly esopExpense: EsopExpenseSchedule;
  /** Item 9. */
  readonly complianceChecks: readonly ComplianceCheck[];
  /** Item 10. Both tracks, always. */
  readonly benchmarkComparison: BenchmarkComparison;
  /**
   * Item 11. Null only when the seniority mix is entirely zero, which is a plan
   * that hires nobody and therefore has no median employee to value.
   */
  readonly medianEmployeeValue: MedianEmployeeValue | null;
  /** Section 2, per band and per year, on the recommended run. */
  readonly grantValueBreakdown: readonly GrantValueBreakdown[];
  /** Section 4.5 requires the iteration count to come back out. */
  readonly solver: SolverDiagnostics;
  readonly warnings: readonly EngineWarning[];
  /** The date the answer was struck as at. Echoed so a report can print it. */
  readonly asOfDate: string;
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
