import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const config = [
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
];

export default config;
