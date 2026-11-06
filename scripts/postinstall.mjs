import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

if (process.env.VERCEL === "1") {
  console.log("Skipping backend Prisma Client generation on Vercel.");
} else {
  const prismaCli = createRequire(import.meta.url).resolve("prisma");
  const result = spawnSync(
    process.execPath,
    [prismaCli, "generate", "--schema", "backend/prisma/schema.prisma"],
    { stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}
