import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    /**
     * The 500-case property runs take about 3 seconds clean and about 6 under
     * V8 coverage instrumentation, against vitest's 5 second default. AUDIT_P4
     * defect 6: the suite went red the first time coverage was switched on, for
     * a reason that had nothing to do with the engine. Raised far enough that a
     * slower machine cannot flip it, and not so far that a genuine hang would
     * sit unnoticed — the engine has no unbounded loop by construction, so a
     * test that runs for thirty seconds is a bug rather than a slow day.
     */
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      /**
       * The engine is what is under test. `src/app` is create-next-app's shell
       * and holds no logic; including it would report a number about scaffolding.
       */
      include: ['src/lib/esop/**/*.ts'],
      exclude: ['src/lib/esop/__tests__/**'],
      reporter: ['text', 'json-summary'],
    },
  },
});
