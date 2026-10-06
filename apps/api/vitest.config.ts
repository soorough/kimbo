import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // All test files share one Postgres database, truncated before each test.
    fileParallelism: false,
  },
});
