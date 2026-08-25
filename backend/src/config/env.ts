import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(backendRoot, ".env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

function readPort(): number {
  const raw = process.env["PORT"];
  if (raw === undefined || raw === "") {
    return 4000;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${raw}`);
  }

  return port;
}

export const env = {
  port: readPort(),
  jwtSecret: readJwtSecret(),
};

function readJwtSecret(): string {
  const raw = process.env["JWT_SECRET"];
  if (raw === undefined || raw.trim() === "") {
    throw new Error("JWT_SECRET is required");
  }
  return raw;
}
