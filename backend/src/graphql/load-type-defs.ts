import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadTypeDefs(): string {
  const backendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  const schemaDir = path.join(backendRoot, "src/graphql/schema");

  return readdirSync(schemaDir)
    .filter((file) => file.endsWith(".graphql"))
    .sort()
    .map((file) => readFileSync(path.join(schemaDir, file), "utf8"))
    .join("\n");
}
