/**
 * Where a company's fully diluted share count goes: issued shares, options
 * already granted, and the unallocated pool the founder can still grant from.
 *
 * The engine refuses a company whose pool and granted options together exceed
 * its fully diluted count (`negativeShareCount`, calculate.ts) — but only when
 * "Calculate pool" prices the plan, on the last screen, long after the founder
 * typed the numbers that cause it. These pure functions answer the same
 * question on the first screen, from the same arithmetic, so the screen can
 * show the breakdown while it is being entered and refuse to move on with a
 * count that cannot work. The engine keeps its own guard; this does not
 * replace it, it only moves the message to where the cause is.
 */
import type { EsopInputs } from '@/lib/esop';
import { formatShares } from './format';

type CompanyShares = Pick<EsopInputs['company'], 'fullyDilutedShares' | 'existingUnallocatedOptions' | 'grantedOutstandingOptions'>;

export interface ShareBreakdown {
  readonly fullyDiluted: number;
  readonly issued: number;
  readonly granted: number;
  readonly pool: number;
}

export function shareBreakdown(company: CompanyShares): ShareBreakdown {
  return {
    fullyDiluted: company.fullyDilutedShares,
    issued: company.fullyDilutedShares - company.existingUnallocatedOptions - company.grantedOutstandingOptions,
    granted: company.grantedOutstandingOptions,
    pool: company.existingUnallocatedOptions,
  };
}

/** The message for the engine's `negativeShareCount` case, or for a count of
 *  zero (which the engine also refuses, `nonPositiveFullyDilutedShares`), or null when the
 *  numbers fit. Before the founder enters a count it holds the form's seed,
 *  never zero, so a zero here was typed. */
export function shareCountError(company: CompanyShares): string | null {
  const { fullyDiluted, issued, granted, pool } = shareBreakdown(company);
  if (fullyDiluted <= 0) return 'Fully diluted shares must be above zero.';
  if (issued >= 0) return null;
  return `Pool and granted options total ${formatShares(pool + granted)}, more than your ${formatShares(fullyDiluted)} fully diluted shares. Raise the share count or lower either.`;
}

/** One line for the About-your-company block. Null while it would be wrong. */
export function shareBreakdownLine(company: CompanyShares): string | null {
  const { fullyDiluted, issued, granted, pool } = shareBreakdown(company);
  if (fullyDiluted <= 0 || issued < 0) return null;
  return `Of ${formatShares(fullyDiluted)} fully diluted shares: ${formatShares(issued)} issued · ${formatShares(granted)} granted · ${formatShares(pool)} unallocated, available to grant.`;
}

/**
 * The pool is stored in shares but very often typed as a percentage of the
 * fully diluted count. A percentage only means something against the count it
 * was typed against, so when that count changes — a founder entering their real
 * figure after the 10,000,000 the form is seeded with — the pool has to move
 * with it, or "10%" typed against the seed silently becomes 10,00,000 shares
 * against a company of 20,000. Called only while the pool is in percent mode;
 * in shares mode the founder said an absolute number and it stays one.
 */
export function rescalePoolForNewFd(poolShares: number, oldFullyDiluted: number, newFullyDiluted: number): number {
  // Zero on either side carries no percentage: rescaling to it would wipe the
  // pool, and rescaling from it has nothing to divide by.
  if (oldFullyDiluted <= 0 || newFullyDiluted <= 0) return poolShares;
  return Math.round((poolShares / oldFullyDiluted) * newFullyDiluted);
}

/**
 * The patch both company forms apply when fully diluted shares changes. The
 * pool's percentage is read against `lastPositiveFullyDiluted` — the last count
 * above zero — rather than the current one, so a count that briefly reads zero
 * does not lose it: 10% against 10,000,000, then 0, then 20,000 is 2,000.
 */
export function fullyDilutedSharesPatch(args: {
  readonly next: number;
  readonly poolShares: number;
  readonly lastPositiveFullyDiluted: number;
  readonly poolUnit: 'percent' | 'shares';
}): { readonly fullyDilutedShares: number; readonly existingUnallocatedOptions: number } {
  const { next, poolShares, lastPositiveFullyDiluted, poolUnit } = args;
  return {
    fullyDilutedShares: next,
    existingUnallocatedOptions:
      poolUnit === 'percent' ? rescalePoolForNewFd(poolShares, lastPositiveFullyDiluted, next) : poolShares,
  };
}
