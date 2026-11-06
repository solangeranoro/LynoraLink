import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(workspaceRoot, process.env.NODE_ENV !== "production");
