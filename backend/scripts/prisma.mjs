import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
if (args[0] === "--production") {
  process.env.NODE_ENV = "production";
  args.shift();
}

await import("./load-root-env.mjs");

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
