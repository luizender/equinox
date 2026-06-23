import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pin the React version so eslint-plugin-react doesn't call the ESLint 10
  // flat-config-incompatible context.getFilename() during auto-detection.
  { settings: { react: { version: "19" } } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test-coverage report — not source to lint.
    "coverage/**",
  ]),
]);

export default eslintConfig;
