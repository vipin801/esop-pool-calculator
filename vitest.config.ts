import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Remove once the engine has its first test. Tracked in docs/esop/LOG.md.
    passWithNoTests: true,
  },
});
