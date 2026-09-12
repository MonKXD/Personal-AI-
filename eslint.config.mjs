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
    // Vendored Claude Design handoff — generated/third-party, not our source.
    "design/**",
    // Browser extension — MV3 plain JS with its own globals (chrome, self).
    "extension/**",
    // Zapier CLI app — its own package + zapier-platform conventions.
    "zapier/**",
  ]),
]);

export default eslintConfig;
