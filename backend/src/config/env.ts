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
  businessTimezone: readBusinessTimezone(),
  frontendOrigin: readFrontendOrigin(),
};

function readJwtSecret(): string {
  const raw = process.env["JWT_SECRET"];
  if (raw === undefined || raw.trim() === "") {
    throw new Error("JWT_SECRET is required");
  }
  return raw;
}

function readBusinessTimezone(): string {
  const raw = process.env["BUSINESS_TIMEZONE"];
  const timezone = raw === undefined || raw.trim() === "" ? "Asia/Kolkata" : raw;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid BUSINESS_TIMEZONE: ${timezone}`);
  }
  return timezone;
}

function readFrontendOrigin(): string {
  const raw = process.env["FRONTEND_ORIGIN"];
  if (raw === undefined || raw.trim() === "") {
    return "http://localhost:5173";
  }
  return raw;
}
