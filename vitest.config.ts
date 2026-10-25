import { defineConfig } from "vitest/config"

export default defineConfig({
  // Oxc does not resolve TypeScript package exports; tsc still checks the project configs.
  tsconfig: "./node_modules/@wirecat/cli-base/config/tsconfig.base.json",
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "kit/test/**/*.test.ts"],
    maxWorkers: 4,
    setupFiles: ["@wirecat/cli-base/testing/setup", "src/testing/sandbox.ts"],
    globalSetup: ["src/testing/argv-log.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**", "src/bin/**"],
      reporter: ["text-summary", "json-summary"],
      thresholds: { lines: 90, statements: 90, functions: 80, branches: 70 },
    },
  },
})
