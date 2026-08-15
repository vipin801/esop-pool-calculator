/**
 * Shared cap table assertion. Not a test file: vitest only collects `*.test.ts`.
 *
 * A cap table that does not add up is worse than no cap table, so every table
 * the engine emits goes through this, in both round tests.
 */

import { expect } from 'vitest';

import type { CapTable } from '../types';

export function expectBalanced(table: CapTable): void {
  const shares = table.rows.reduce((sum, row) => sum + row.shares, 0);
  const pct = table.rows.reduce((sum, row) => sum + row.pctOfFullyDiluted, 0);

  expect(shares / table.total.shares, `${table.label}: rows do not sum to the total`).toBeCloseTo(
    1,
    12,
  );
  expect(pct, `${table.label}: percentages do not sum to 100`).toBeCloseTo(100, 9);
  expect(table.total.pctOfFullyDiluted).toBe(100);
  expect(table.total.shares).toBe(table.fullyDilutedShares);
}
