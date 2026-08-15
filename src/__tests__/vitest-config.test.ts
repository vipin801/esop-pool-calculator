/**
 * The test harness's own policy, asserted rather than assumed.
 *
 * Two decisions live in vitest.config.ts and both are the kind that decay
 * quietly. The long timeout belongs to the coverage run alone, because a
 * generous default hides a hanging test in day-to-day work — AUDIT_P4 defect 6
 * was fixed in [010] by raising it globally, which traded one problem for a
 * smaller one. And no coverage threshold is set, deliberately, until P9 decides
 * whether to have one.
 *
 * This file sits outside `src/lib/esop` on purpose: it is about the harness,
 * not the engine, and `purity.test.ts` scans the engine directory.
 */

import { describe, expect, it } from 'vitest';

import config, {
  COVERAGE_TEST_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  testTimeoutFor,
} from '../../vitest.config';

describe('the test timeout is scoped to the run that needs it', () => {
  it('gives the standard suite a tight budget', () => {
    // Under full-suite worker contention the slowest test runs 3,700-8,800 ms.
    // The bound is a little under twice that: still a fifteen second wait on a
    // hang, and not the thirty the coverage run needs. A first cut at 10,000
    // was measured from one warm sample and went red on the second full run.
    expect(TEST_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(TEST_TIMEOUT_MS).toBeGreaterThan(10_000);
    expect(testTimeoutFor(['node', 'vitest', 'run'])).toBe(TEST_TIMEOUT_MS);
  });

  it('gives the long budget to the coverage run and to nothing else', () => {
    expect(COVERAGE_TEST_TIMEOUT_MS).toBeGreaterThan(TEST_TIMEOUT_MS);

    for (const flag of ['--coverage', '--coverage.enabled', '--coverage.provider=v8']) {
      expect(testTimeoutFor(['node', 'vitest', 'run', flag]), flag).toBe(COVERAGE_TEST_TIMEOUT_MS);
    }

    for (const argv of [[], ['--reporter=verbose'], ['--watch'], ['src/lib/esop']]) {
      expect(testTimeoutFor(argv), argv.join(' ')).toBe(TEST_TIMEOUT_MS);
    }
  });

  it('wires the config to that decision rather than hardcoding one budget', () => {
    // Not a tautology: it fails whenever `testTimeout` is a literal that does
    // not track the flag the run was actually started with.
    expect(config.test?.testTimeout).toBe(testTimeoutFor(process.argv));
  });
});

describe('coverage policy', () => {
  it('reports on the engine and not on the app shell', () => {
    expect(config.test?.coverage).toBeDefined();
    const coverage = config.test?.coverage as {
      readonly include?: readonly string[];
      readonly exclude?: readonly string[];
    };

    expect(coverage.include).toEqual(['src/lib/esop/**/*.ts']);
    expect(coverage.exclude).toEqual(['src/lib/esop/__tests__/**']);
  });

  it('sets no threshold, which stays a P9 decision rather than a forgotten one', () => {
    const coverage = config.test?.coverage as { readonly thresholds?: unknown };

    expect(coverage.thresholds).toBeUndefined();
  });
});
