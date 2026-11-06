import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasVerifiedPremiumAccess } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { recordLynoAIActivity } from "@/lib/lynoai-quota";
import { createPostSchema, createProjectSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { applyAutomaticAccountRestriction, assessPostContent, notifyTeamModerationReview } from "@/lib/post-moderation";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_project"), payload: createProjectSchema }),
  z.object({ action: z.literal("publish_post"), payload: createPostSchema }),
]);
const conversationSchema = z.string().trim().min(1).max(100).optional();

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await hasVerifiedPremiumAccess(userId))) return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 });

  const rawBody = await request.json().catch(() => null);
  const locale = rawBody?.locale === "fr" ? "fr" : "en";
  const conversationId = conversationSchema.safeParse(rawBody?.conversationId);
  if (!conversationId.success) return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten() }, { status: 422 });
  const { action, payload } = parsed.data;
  let summary: string;
  let accountSuspended = false;

  try {
    if (action === "create_project") {
      const parentTeam = payload.parentTeamId
        ? await prisma.project.findUnique({
          where: { id: payload.parentTeamId },
          select: {
            id: true,
            creatorId: true,
            teamName: true,
            isPrivate: true,
            collaborators: {
              where: { status: "APPROVED" },
              select: { userId: true, role: true },
            },
          },
        })
        : null;
      if (payload.parentTeamId && (
        !parentTeam?.teamName?.trim()
        || (parentTeam.creatorId !== userId && !parentTeam.collaborators.some((member) => member.userId === userId))
      )) {
        return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
      }
      const baseSlug = slugify(payload.title);
      let slug = baseSlug;
      let suffix = 1;
      while (await prisma.project.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;
      const project = await prisma.project.create({
        data: {
          ...payload,
          teamName: payload.teamName ?? null,
          teamDescription: payload.teamDescription ?? null,
          isPrivate: parentTeam?.isPrivate ?? payload.isPrivate ?? false,
          logoUrl: payload.logoUrl || null,
          githubUrl: payload.githubUrl || null,
          liveUrl: payload.liveUrl || null,
          docsUrl: payload.docsUrl || null,
          pitchDeckUrl: payload.pitchDeckUrl || null,
          slug,
          creatorId: userId,
          moderationStatus: parentTeam && parentTeam.creatorId !== userId ? "PENDING" : "APPROVED",
          collaborators: {
            create: [
              { userId, role: "FOUNDER", status: "APPROVED" },
              ...(parentTeam?.collaborators
                .filter((member) => member.userId !== userId)
                .map((member) => ({ userId: member.userId, role: member.role, status: "APPROVED" as const })) ?? []),
            ],
          },
        },
      });
      summary = locale === "fr" ? `Projet « ${project.title} » créé.` : `Project "${project.title}" created.`;
    } else if (action === "publish_post") {
      const moderationAssessment = assessPostContent(payload.content, payload.tags);
      const scopedProjectId = payload.type === "TEAM" ? payload.teamId : payload.type === "PROJECT" ? payload.projectId : undefined;
      let moderationTeamId: string | undefined;
      let moderationTeamOwnerId: string | undefined;
      if (scopedProjectId) {
        const project = await prisma.project.findUnique({
          where: { id: scopedProjectId },
          select: {
            creatorId: true,
            parentTeamId: true,
            teamName: true,
            collaborators: { where: { userId, status: "APPROVED" }, select: { id: true }, take: 1 },
          },
        });
        if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
        if (project.creatorId !== userId && !project.collaborators.length) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        moderationTeamId = payload.type === "TEAM"
          ? scopedProjectId
          : payload.teamId ?? (project.teamName ? project.parentTeamId ?? project.creatorId : project.parentTeamId ?? undefined);
        if (moderationTeamId) {
          const team = moderationTeamId === scopedProjectId && project.teamName
            ? { creatorId: project.creatorId }
            : await prisma.project.findUnique({ where: { id: moderationTeamId }, select: { creatorId: true } });
          moderationTeamOwnerId = team?.creatorId;
        }
      }
      const post = await prisma.post.create({
        data: {
          type: payload.type,
          content: payload.content,
          codeSnippet: payload.codeSnippet || null,
          codeLang: payload.codeLang || null,
          imageUrl: payload.imageUrl || null,
          tags: payload.tags,
          moderationStatus: moderationAssessment?.status ?? "APPROVED",
          moderationCases: moderationAssessment ? {
            create: {
              category: moderationAssessment.category,
              confidence: moderationAssessment.confidence,
              reason: moderationAssessment.reason,
              subjectId: userId,
            },
          } : undefined,
          authorId: userId,
          projectId: payload.projectId || null,
          teamId: payload.teamId || null,
          poll: payload.pollQuestion && payload.pollOptions ? { create: { question: payload.pollQuestion, options: [...new Set(payload.pollOptions)] } } : undefined,
        },
      });
      if (moderationAssessment) {
        await notifyTeamModerationReview(moderationTeamOwnerId, userId, moderationTeamId);
      }
      accountSuspended = (await applyAutomaticAccountRestriction(userId, moderationAssessment)) !== null;
      summary = moderationAssessment
        ? locale === "fr"
          ? `Publication ${moderationAssessment.status === "REJECTED" ? "bloquée" : "mise en attente de vérification"} : ${moderationAssessment.reason}`
          : `Post ${moderationAssessment.status === "REJECTED" ? "blocked" : "held for review"}: ${moderationAssessment.reason}`
        : locale === "fr" ? `Post publié (${post.id}).` : `Post published (${post.id}).`;
    } else {
      return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 422 });
    }

    let activityTracked = true;
    try {
      await recordLynoAIActivity(
        userId,
        "lynoralink",
        action === "create_project" ? "project_created" : "post_published",
      );
    } catch (error) {
      activityTracked = false;
      console.error("Unable to record LynoraLink Copilot action analytics:", error);
    }

    let saved = null;
    try {
      saved = await prisma.aiSession.create({ data: { userId, input: `Action: ${action}`, output: summary, provider: "LynoraLink", action, conversationId: conversationId.data } });
    } catch (error) {
      console.error("Copilot action history error:", error);
    }
    return NextResponse.json({ session: saved, summary, historySaved: Boolean(saved), activityTracked, accountSuspended }, { status: 201 });
  } catch (error) {
    console.error("Copilot action error:", error);
    return NextResponse.json({ error: "ACTION_FAILED" }, { status: 500 });
  }
}