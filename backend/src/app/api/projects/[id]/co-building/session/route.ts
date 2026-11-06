import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canContributeToProject } from "@/lib/project-access";
import { createCoBuildingTicket } from "@/lib/co-building";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsedBody = z.object({ clientId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "INVALID_CLIENT" }, { status: 400 });

  const { id: projectId } = await props.params;
  if (!(await canContributeToProject(projectId, userId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const websocketUrl = process.env.CO_BUILDING_WS_URL
    ?? (process.env.NODE_ENV === "development" ? "ws://localhost:4001/co-building" : null);
  if (!websocketUrl) {
    return NextResponse.json({ error: "CO_BUILDING_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const parsedUrl = new URL(websocketUrl);
    if (
      (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") ||
      (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "wss:")
    ) {
      return NextResponse.json({ error: "CO_BUILDING_NOT_CONFIGURED" }, { status: 503 });
    }

    const userName = session.user.name?.trim().slice(0, 80) || "Membre";
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    const userImage = profile?.image ?? null;
    const ticket = createCoBuildingTicket({ projectId, userId, clientId: parsedBody.data.clientId, userName, userImage });
    return NextResponse.json({
      ticket,
      websocketUrl: parsedUrl.toString(),
      user: { id: parsedBody.data.clientId, name: userName, image: userImage },
    });
  } catch (error) {
    console.error("Unable to create a co-building session:", error);
    return NextResponse.json({ error: "CO_BUILDING_UNAVAILABLE" }, { status: 500 });
  }
}
