import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/project-access";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const post = await prisma.post.updateMany({ where: { id: params.id }, data: { shareCount: { increment: 1 } } });
  if (post.count === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { shareCount } = await prisma.post.findUniqueOrThrow({ where: { id: params.id }, select: { shareCount: true } });
  return NextResponse.json({ shareCount });
}