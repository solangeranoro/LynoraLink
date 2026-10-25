import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root, true);

function usesLocalDemoDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  const database = new URL(databaseUrl);
  return ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) && database.port === "5433";
}

async function startLocalDatabase() {
  if (process.platform !== "win32" || !usesLocalDemoDatabase()) return;

  console.log("Starting the local LynoraLink PostgreSQL database...");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(root, "backend/scripts/local-postgres.ps1"), "start"],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  if (exitCode !== 0) throw new Error(`Local PostgreSQL startup failed with exit code ${exitCode}.`);
}

try {
  await startLocalDatabase();
} catch (error) {
  console.error("Could not start the local LynoraLink database.", error);
  process.exit(1);
}

const nextCli = resolve(root, "node_modules/next/dist/bin/next");
const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
const services = [
  { name: "web", cwd: resolve(root, "frontend"), args: ["dev", "-p", "3000"] },
  { name: "api", cwd: resolve(root, "backend"), args: ["dev", "-p", "4000"] },
  { name: "collaboration", cwd: root, executable: process.execPath, args: [tsxCli, "backend/scripts/coding-collaboration.ts"] },
].filter(({ name }) => !process.argv[2] || process.argv[2] === name);

let stopping = false;
const children = services.map(({ name, cwd, args, executable }) => {
  const child = spawn(executable ?? process.execPath, executable ? args : [nextCli, ...args], {
    cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  for (const [streamName, output] of [["stdout", process.stdout], ["stderr", process.stderr]]) {
    const lines = createInterface({ input: child[streamName] });
    lines.on("line", (line) => output.write(`[${name}] ${line}\n`));
  }

  child.on("error", (error) => {
    console.error(`[${name}]`, error);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!stopping) shutdown(code ?? 1);
  });
  return child;
});

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());