import { defineConfig } from "vitest/config";
import path from "path";

// Dedicated entry point validates the disposable DB target before any schema writes.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/auth/contact-change.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/integration/auth/contact-change-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
