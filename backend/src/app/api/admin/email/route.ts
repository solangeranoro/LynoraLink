import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const emailSchema = z.object({
  to: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(5000),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  const { to, subject, message } = parsed.data;

  const sentRecently = await prisma.auditLog.count({
    where: { adminId: access.admin.id, action: "ADMIN_EMAIL_SENT", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (sentRecently >= 20) return NextResponse.json({ error: "EMAIL_DAILY_LIMIT" }, { status: 429 });

  const result = await sendEmail({ to, subject, text: message, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(message)}</div>` });
  if (!result.ok) return NextResponse.json({ error: "EMAIL_SEND_FAILED" }, { status: 502 });

  await prisma.auditLog.create({ data: { adminId: access.admin.id, action: "ADMIN_EMAIL_SENT" } });
  return NextResponse.json({ sent: !result.dev, previewOnly: Boolean(result.dev) }, { status: 201 });
}