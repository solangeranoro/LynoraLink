import { execFile } from "node:child_process";
import { connect } from "node:net";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCodingTerminalDockerCommand, getCodingTerminalDockerPath } from "@/lib/coding-terminal-docker";
import { getTerminalContainerName } from "@/lib/coding-terminal-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { sessionId } = await params;
  const containerName = getTerminalContainerName(sessionId, userId);
  if (!containerName) {
    return NextResponse.json({ error: "Terminal session not found or stopped." }, { status: 404 });
  }

  try {
    const { stdout } = await execFileAsync(
      getCodingTerminalDockerCommand(),
      ["port", containerName],
      {
        timeout: 5_000,
        windowsHide: true,
        env: { ...process.env, PATH: getCodingTerminalDockerPath() },
      },
    );
    const mappedPorts = stdout.split(/\r?\n/).flatMap((line) => {
      const match = /^(\d+)\/tcp\s+->\s+127\.0\.0\.1:(\d+)$/.exec(line.trim());
      if (!match) return [];
      return [{ containerPort: Number(match[1]), hostPort: Number(match[2]) }];
    });
    const ports = (await Promise.all(mappedPorts.map(async (port) =>
      await isPortListening(port.hostPort) ? port : null,
    ))).filter((port): port is NonNullable<typeof port> => port !== null);
    return NextResponse.json({ ports });
  } catch (error) {
    console.error("Unable to inspect forwarded LynoraCoding terminal ports:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to inspect forwarded ports." },
      { status: 502 },
    );
  }
}
