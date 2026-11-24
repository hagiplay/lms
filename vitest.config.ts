import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms_test", NODE_ENV: "test" },
          globalSetup: ["tests/support/global-setup.ts"],
        },
      },
    ],
  },
});
