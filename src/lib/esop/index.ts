/**
 * The ESOP pool engine's public surface. Frozen.
 *
 * **`calculateEsopPool` is the only function the front end may import.**
 * Everything else exported here is data or a type: the defaults a form seeds
 * itself from, the benchmark tracks it renders, the error type it catches, and
 * the shapes it types its state with. There is no second way in and no partial
 * entry point, because the two things this engine has to get right — the
 * recommendation and the runway — are two runs of the same plan, and a caller
 * that can reach `runRollForward` directly can print one beside the other.
 *
 * `__tests__/public-api.test.ts` asserts the export list below, name by name.
 * That is what makes "frozen" a check rather than a comment: adding to this file
 * fails the suite until the addition is deliberate, and removing from it fails
 * the same way.
 *
 * See README.md in this directory for the input contract.
 */

/* ------------------------------------------------------------------------- *
 * The entry point
 * ------------------------------------------------------------------------- */

export { calculateEsopPool } from './calculate';

/* ------------------------------------------------------------------------- *
 * Failure — a closed set of codes, so a UI can say something specific
 * ------------------------------------------------------------------------- */

export {
  ESOP_ERROR_CODES,
  EsopEngineError,
  isEsopEngineError,
  type EsopErrorCode,
  type EsopErrorDetail,
} from './errors';

/* ------------------------------------------------------------------------- *
 * Data a form needs: the defaults it seeds from, and the benchmarks it shows
 * ------------------------------------------------------------------------- */

export {
  DEFAULTS,
  DEFAULT_ATTRITION_BY_SECTOR_PCT,
  DEFAULT_GRANT_BASIS_BY_STAGE,
  DEFAULT_GRANT_PCT_BY_BAND,
  DEFAULT_GRANT_VALUE_BY_BAND,
  DEFAULT_SENIORITY_MIX_PCT,
  DEFAULT_STRIKE_POLICY_BY_STAGE,
  SOLVER,
  STATUTORY,
  baseAttritionPctForSector,
  type DefaultKey,
} from './defaults';

export { ADVISORY_TRACK, BENCHMARK_TRACKS, OBSERVED_TRACK } from './benchmarks';

/* ------------------------------------------------------------------------- *
 * Enumerations a form binds controls to
 * ------------------------------------------------------------------------- */

export {
  BANDS,
  BENCHMARK_STAGE_ORDER,
  COMPLIANCE_CHECK_IDS,
  COMPLIANCE_DISCLAIMER,
  ENGINE_WARNING_IDS,
  EXERCISE_WINDOW_DAYS_OPTIONS,
  EXPOSED_INSTRUMENTS,
  INSTRUMENTS,
  STAGES,
  VALUE_BASES,
} from './types';

/* ------------------------------------------------------------------------- *
 * Shapes
 * ------------------------------------------------------------------------- */

export type {
  /* Inputs */
  AttritionInputs,
  CompanyInputs,
  ComplianceInputs,
  EmployeeValueInputs,
  EsopInputs,
  ExerciseInputs,
  FairValueAssumptions,
  FundingRound,
  GrantBasis,
  GrantPolicyInputs,
  GrowthInputs,
  HiringPlan,
  OpeningGrantCohortInput,
  OpeningHeadcountInput,
  PoolTopUp,
  RefreshPolicy,
  SeniorityMix,
  StrikePolicy,
  VestingSchedule,
  /* Outputs */
  AuthorisedCapitalHeadroom,
  BenchmarkComparison,
  BenchmarkTrackComparison,
  CapTable,
  CapTableRow,
  CapTableSet,
  CapTableTotal,
  ComplianceCheck,
  EngineWarning,
  EsopExpenseSchedule,
  EsopExpenseYear,
  EsopResult,
  GrantValueBreakdown,
  MedianEmployeeValue,
  ModelledRound,
  PoolCostToFounders,
  PoolExhaustion,
  PoolPlanSeries,
  PoolShuffleCapTables,
  PoolShuffleOutcome,
  PoolSizing,
  PreRoundHoldings,
  RecommendedPool,
  RollForwardYear,
  SolverDiagnostics,
  TopUpRequirement,
  ValueBasisOutcome,
  /* Enumerations, as types */
  AccountingBasis,
  Band,
  BenchmarkBand,
  BenchmarkPosition,
  BenchmarkStage,
  BenchmarkTrack,
  BenchmarkTrackId,
  CompanyType,
  ComplianceCheckId,
  ComplianceStatus,
  DefaultEntry,
  EngineWarningId,
  ExerciseWindowDays,
  Geography,
  GrantBasisKind,
  Instrument,
  PoolCreationTiming,
  PoolSeriesLabel,
  Provenance,
  Sector,
  Stage,
  StrikePolicyKind,
  TaxDeferralStatus,
  ValueBasis,
  VestFrequency,
} from './types';
