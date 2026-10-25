import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
const envPath = path.join(workspaceRoot, envFile);

if (existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    throw result.error;
  }
}
