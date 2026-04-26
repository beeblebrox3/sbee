import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    execArgv: ["--expose-gc"],
    sequence: {
      concurrent: true,
    },
    coverage: {
      provider: "istanbul",
      reporter: ["lcov"],
    },
  },
});
