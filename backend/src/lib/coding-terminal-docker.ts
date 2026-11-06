import { existsSync } from "node:fs";
import path from "node:path";

export function getCodingTerminalDockerCommand(): string {
  const configuredCommand = process.env.LYNORACODING_DOCKER_COMMAND;
  if (configuredCommand) return configuredCommand;

  if (process.platform === "win32") {
    const dockerDesktopCommand = path.join(
      process.env.ProgramFiles || "C:\\Program Files",
      "Docker",
      "Docker",
      "resources",
      "bin",
      "docker.exe",
    );
    if (existsSync(dockerDesktopCommand)) return dockerDesktopCommand;
  }

  return "docker";
}

export function getCodingTerminalDockerPath(): string | undefined {
  const dockerCommand = getCodingTerminalDockerCommand();
  if (!path.isAbsolute(dockerCommand)) return process.env.PATH;

  return [
    path.dirname(dockerCommand),
    process.env.PATH,
  ].filter(Boolean).join(path.delimiter);
}

export function isCodingTerminalDockerUnavailable(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.message} ${"code" in error ? String(error.code) : ""}`
    : String(error);
  return /cannot connect to the docker daemon|error during connect|failed to connect|is the docker daemon running|docker_engine|dockerdesktoplinuxengine|enoent|write eof|read eof/i.test(message);
}
