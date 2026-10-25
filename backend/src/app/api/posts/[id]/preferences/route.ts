import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePostPreferenceSchema } from "@/lib/validators";
import { canViewPost } from "@/lib/project-access";

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  }
  const parsed = updatePostPreferenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  try {
    const { preference, enabled } = parsed.data;
    const saved = preference === "saved" ? enabled : undefined;
    const hidden = preference === "hidden" ? enabled : undefined;
    const result = await prisma.postPreference.upsert({
      where: { userId_postId: { userId: session.user.id, postId: params.id } },
      create: { userId: session.user.id, postId: params.id, saved: saved ?? false, hidden: hidden ?? false },
      update: preference === "saved" ? { saved: enabled } : { hidden: enabled },
      select: { saved: true, hidden: true },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Update post preference error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}