import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("response" in admin) return admin.response;
  const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 422 });
  }
  const applications = await prisma.testerApplication.findMany({
    where: { status: status as "PENDING" | "APPROVED" | "REJECTED" },
    include: {
      owner: { select: { id: true, name: true, email: true, handle: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const scenarios = applications.length
    ? await prisma.$queryRaw<{ id: string; testInstructions: string }[]>`
      SELECT "id", "testInstructions"
      FROM "TesterApplication"
      WHERE "id" = ANY(${applications.map(({ id }) => id)}::text[])
    `
    : [];
  const scenarioById = new Map(scenarios.map(({ id, testInstructions }) => [id, testInstructions]));
  return NextResponse.json({
    applications: applications.map((application) => ({
      ...application,
      testInstructions: scenarioById.get(application.id) ?? "",
    })),
  });
}
