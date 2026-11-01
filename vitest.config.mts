import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: mode === "db" ? { RUN_DB_TESTS: "1" } : {},
  },
}));
