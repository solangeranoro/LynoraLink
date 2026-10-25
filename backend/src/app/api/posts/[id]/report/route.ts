import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportPostSchema } from "@/lib/validators";
import { canViewPost } from "@/lib/project-access";

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewPost(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (post.authorId === session.user.id) return NextResponse.json({ error: "CANNOT_REPORT_OWN_POST" }, { status: 403 });

  const parsed = reportPostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });

  try {
    const report = await prisma.postReport.create({
      data: { ...parsed.data, postId: post.id, reporterId: session.user.id },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "ALREADY_REPORTED" }, { status: 409 });
    }
    console.error("Report post error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}