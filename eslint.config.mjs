import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Incentiv design system export. A vendored third-party artifact that
    // ships its own React components and HTML, not this app's source — it is
    // read for its tokens (see src/app/tokens/) and never built or shipped.
    // Linting it reports two errors in someone else's JSX.
    "incentiv-design-system/**",
  ]),
]);

export default eslintConfig;
