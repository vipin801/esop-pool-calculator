/**
 * ESOP pool engine — typed errors and input guards.
 *
 * This is a money engine. It never returns NaN, Infinity, or a number that is
 * arithmetically valid and economically absurd. Where an input makes the maths
 * undefined — a zero share count, a strike sitting exactly at the money under
 * the realisable basis — it throws an `EsopEngineError` carrying a code the
 * caller can switch on, not a bare `Error` carrying a sentence.
 *
 * Every code in `ESOP_ERROR_CODES` is reachable. A test asserts it, so a code
 * cannot rot into a comment.
 */

export const ESOP_ERROR_CODES = [
  /** V_t at or below zero. Price per share is undefined. */
  'nonPositiveValuation',
  /** FD_t at or below zero. Price per share is undefined and Basis A has nothing to apply. */
  'nonPositiveFullyDilutedShares',
  /** (1 + g/100) at or below zero. A company cannot be worth nothing and still have a price. */
  'nonPositiveGrowthFactor',
  /** Year index must be a whole number at or above zero. */
  'invalidYearIndex',
  /** PPS_t at or below zero. Every denominator in section 2 is built on it. */
  'nonPositivePricePerShare',
  /** PPS_t - X_t at or below the guard fraction of PPS_t. Dividing here is dividing by nothing. */
  'degenerateRealisableSpread',
  /** theta outside (0, 1]. It is the value ratio of an option to a share. */
  'thetaOutOfRange',
  /** Basis B needs a denominator from section 2. Basis A has none to give. */
  'missingDenominator',
  /** D_t at or below zero. */
  'nonPositiveDenominator',
  /** A negative headcount is not a hiring plan. */
  'negativeHeadcount',
  /** A rupee or percentage amount that cannot stand: a negative grant, a face value of zero. */
  'invalidMoneyAmount',
  /** A refresh rate or refresh size outside the range a percentage can take. */
  'invalidRefreshPolicy',
] as const;

export type EsopErrorCode = (typeof ESOP_ERROR_CODES)[number];

/** Whatever the caller needs to show the founder which input was wrong. */
export type EsopErrorDetail = Readonly<Record<string, number | string | boolean>>;

/**
 * The only error type the engine throws.
 *
 * `code` is a closed union so a UI can render a specific message per failure,
 * and so a test can assert on the failure rather than on prose.
 */
export class EsopEngineError extends Error {
  readonly code: EsopErrorCode;
  readonly detail: EsopErrorDetail;

  constructor(code: EsopErrorCode, message: string, detail: EsopErrorDetail = {}) {
    super(message);
    this.name = 'EsopEngineError';
    this.code = code;
    this.detail = detail;
  }
}

export function isEsopEngineError(error: unknown): error is EsopEngineError {
  return error instanceof EsopEngineError;
}

/* ------------------------------------------------------------------------- *
 * Guards
 * ------------------------------------------------------------------------- */

/** Throws unless `value` is a finite number strictly above zero. */
export function requirePositive(
  value: number,
  code: EsopErrorCode,
  message: string,
  detail: EsopErrorDetail = {},
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new EsopEngineError(code, message, { ...detail, value });
  }
}

/** Throws unless `value` is a finite number at or above zero. */
export function requireNonNegative(
  value: number,
  code: EsopErrorCode,
  message: string,
  detail: EsopErrorDetail = {},
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new EsopEngineError(code, message, { ...detail, value });
  }
}

/** Throws unless `value` is a finite number. Zero and negatives are allowed. */
export function requireFinite(
  value: number,
  code: EsopErrorCode,
  message: string,
  detail: EsopErrorDetail = {},
): void {
  if (!Number.isFinite(value)) {
    throw new EsopEngineError(code, message, { ...detail, value });
  }
}

/**
 * Year indices are zero-based whole numbers. Year 0 is the first plan year and
 * is priced at today's post-money valuation.
 */
export function requireYearIndex(year: number): void {
  if (!Number.isInteger(year) || year < 0) {
    throw new EsopEngineError(
      'invalidYearIndex',
      'Year index must be a whole number at or above zero. Year 0 is the first plan year.',
      { year },
    );
  }
}
