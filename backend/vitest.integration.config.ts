import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(backendRoot, ".env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

if (process.env["JWT_SECRET"] === undefined || process.env["JWT_SECRET"] === "") {
  process.env["JWT_SECRET"] = "test-jwt-secret";
}

if (process.env["BUSINESS_TIMEZONE"] === undefined || process.env["BUSINESS_TIMEZONE"] === "") {
  process.env["BUSINESS_TIMEZONE"] = "Asia/Kolkata";
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
