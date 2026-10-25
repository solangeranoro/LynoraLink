import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeamSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { recordInteraction } from "@/lib/gamification";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const baseSlug = slugify(data.teamName) || "team";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const team = await prisma.project.create({
    data: {
      title: data.teamName,
      teamName: data.teamName,
      slug,
      tagline: data.tagline,
      description: data.teamDescription,
      teamDescription: data.teamDescription,
      teamRules: data.teamRules || null,
      isPrivate: data.isPrivate ?? false,
      logoUrl: data.logoUrl || null,
      status: "IDEA",
      lookingFor: data.lookingFor,
      creatorId: session.user.id,
      collaborators: { create: { userId: session.user.id, role: "FOUNDER", status: "APPROVED" } },
    },
  });

  await recordInteraction(session.user.id, "TEAM", team.id);
  return NextResponse.json({ team }, { status: 201 });
}
