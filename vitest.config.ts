import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The standard suite's budget. Measured across repeated full-suite runs rather
 * than from one warm sample: in isolation the slowest test (the 500-case roll
 * forward property) takes about 900 ms, but the full suite runs 19 files across
 * 12 workers and contention pushes that same test to between 3,700 and 8,800 ms.
 * A first cut at 10,000 ms went red on the second run. Fifteen seconds is a
 * little under twice the observed worst, which still turns a hung test into a
 * fifteen second wait instead of the thirty the coverage run needs.
 */
export const TEST_TIMEOUT_MS = 15_000;

/**
 * The coverage run's budget, and only the coverage run's.
 *
 * V8 instrumentation roughly halves throughput: the same slowest test takes
 * about 4,900 ms under it, against vitest's 5,000 ms default. That margin is
 * what AUDIT_P4 defect 6 tripped over the first time coverage was switched on,
 * and it is why the long budget exists at all — but applying it to every run
 * would hide a hang in day-to-day work, which is a worse trade than the one it
 * was fixing.
 */
export const COVERAGE_TEST_TIMEOUT_MS = 30_000;

/**
 * Which budget applies, from the command line that started the run.
 *
 * Vitest exposes the mode to a config *function* through Vite's `mode` and
 * `command`, neither of which knows about `--coverage`, so the flag is read
 * from argv directly. `--coverage.enabled` and friends count too, because that
 * is the form the audit used and the form CI is likely to.
 */
export function testTimeoutFor(argv: readonly string[]): number {
  const coverage = argv.some(
    (arg) => arg === '--coverage' || arg.startsWith('--coverage.') || arg.startsWith('--coverage='),
  );

  return coverage ? COVERAGE_TEST_TIMEOUT_MS : TEST_TIMEOUT_MS;
}

export default defineConfig({
  /**
   * The same `@/*` alias tsconfig.json gives the app. The engine's own tests
   * import relatively and never needed it; the route's code does not, so
   * without this a test that reaches any component or route-local module fails
   * to resolve `@/lib/esop` two or three imports deep.
   */
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: testTimeoutFor(process.argv),
    coverage: {
      provider: 'v8',
      /**
       * The engine is what is under test. `src/app` is create-next-app's shell
       * and holds no logic; including it would report a number about scaffolding.
       */
      include: ['src/lib/esop/**/*.ts'],
      exclude: ['src/lib/esop/__tests__/**'],
      reporter: ['text', 'json-summary'],
      /**
       * No `thresholds` key, deliberately. A threshold that fails the build is a
       * policy decision to take once and on purpose, not a side effect of
       * installing the tool, and it stays unset until P9 takes it. A test
       * asserts its absence so that "we decided not to" cannot decay into "we
       * forgot to".
       */
    },
  },
});
