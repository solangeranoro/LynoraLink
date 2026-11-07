import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const production = args[0] === "--production";
if (production) {
  process.env.NODE_ENV = "production";
  args.shift();

  const productionEnv = config({
    path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.production"),
  });
  if (productionEnv.error && productionEnv.error.code !== "ENOENT") {
    throw productionEnv.error;
  }
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error("Production Prisma commands require DATABASE_URL and DIRECT_URL.");
  }
} else {
  await import("./load-root-env.mjs");
}

const prismaCli = createRequire(import.meta.url).resolve("prisma");
const result = spawnSync(
  process.execPath,
  [prismaCli, ...args, "--schema", "prisma/schema.prisma"],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
