import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { collaborationFormQuestionSchema } from "@/lib/validators";

type CollaborationFormQuestion = z.infer<typeof collaborationFormQuestionSchema>;

const applicationSchema = z.object({
  role: z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"]).optional().default("CO_BUILDER"),
  message: z.string().trim().max(1000).optional(),
  answers: z.array(z.string().trim().min(1).max(1000)).max(5).optional(),
  acceptedTeamRules: z.boolean().optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = applicationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_APPLICATION" }, { status: 422 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      creatorId: true,
      isPrivate: true,
      moderationStatus: true,
      teamName: true,
      parentTeamId: true,
      teamRules: true,
      collaborationQuestions: true,
      collaborationForm: true,
    },
  });
  if (!project || project.isPrivate || (project.parentTeamId && project.moderationStatus !== "APPROVED")) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const owningTeam = project.teamName
    ? project
    : project.parentTeamId
      ? await prisma.project.findUnique({
        where: { id: project.parentTeamId },
        select: { teamName: true, teamRules: true, collaborationQuestions: true, collaborationForm: true },
      })
      : null;
  const isTeam = Boolean(owningTeam?.teamName);
  const formOwner = isTeam ? owningTeam! : project;
  const parsedForm = formOwner.collaborationForm === null
    ? null
    : z.array(collaborationFormQuestionSchema).max(5).safeParse(formOwner.collaborationForm);
  if (parsedForm && !parsedForm.success) {
    return NextResponse.json({ error: "INVALID_APPLICATION_FORM" }, { status: 500 });
  }
  const collaborationQuestions: CollaborationFormQuestion[] = parsedForm?.success
    ? parsedForm.data
    : formOwner.collaborationQuestions.map((label) => ({ label, type: "LONG_TEXT", options: [] }));
  const teamRules = isTeam ? owningTeam!.teamRules : null;
  if (
    collaborationQuestions.length > 0
    && (!parsed.data.answers || parsed.data.answers.length !== collaborationQuestions.length)
  ) {
    return NextResponse.json({ error: "APPLICATION_ANSWERS_REQUIRED" }, { status: 422 });
  }
  const normalizedAnswers: string[] = [];
  for (const [index, question] of collaborationQuestions.entries()) {
    const answer = parsed.data.answers?.[index]?.trim() ?? "";
    if (!answer) return NextResponse.json({ error: "APPLICATION_ANSWERS_REQUIRED" }, { status: 422 });
    if (question.type === "SINGLE_CHOICE" && !question.options.includes(answer)) {
      return NextResponse.json({ error: "INVALID_APPLICATION_ANSWER" }, { status: 422 });
    }
    if (question.type === "MULTIPLE_CHOICE") {
      let selectedOptions: unknown;
      try {
        selectedOptions = JSON.parse(answer);
      } catch {
        return NextResponse.json({ error: "INVALID_APPLICATION_ANSWER" }, { status: 422 });
      }
      if (
        !Array.isArray(selectedOptions)
        || selectedOptions.length === 0
        || selectedOptions.some((option) => typeof option !== "string" || !question.options.includes(option))
        || new Set(selectedOptions).size !== selectedOptions.length
      ) {
        return NextResponse.json({ error: "INVALID_APPLICATION_ANSWER" }, { status: 422 });
      }
      normalizedAnswers.push(selectedOptions.join(", "));
      continue;
    }
    if (question.type === "YES_NO" && answer !== "YES" && answer !== "NO") {
      return NextResponse.json({ error: "INVALID_APPLICATION_ANSWER" }, { status: 422 });
    }
    if (question.type === "SHORT_TEXT" && answer.length > 250) {
      return NextResponse.json({ error: "INVALID_APPLICATION_ANSWER" }, { status: 422 });
    }
    normalizedAnswers.push(answer);
  }
  if (isTeam && teamRules?.trim() && parsed.data.acceptedTeamRules !== true) {
    return NextResponse.json({ error: "TEAM_RULES_ACCEPTANCE_REQUIRED" }, { status: 422 });
  }
  const answersMessage = collaborationQuestions.length > 0
    ? collaborationQuestions
      .map((question, index) => `${question.label}\n${normalizedAnswers[index]}`)
      .join("\n\n")
    : "";
  const acceptedRulesMessage = isTeam && teamRules?.trim()
    ? `Team rules accepted:\n${teamRules.trim()}`
    : "";
  const applicationMessage = [acceptedRulesMessage, answersMessage, parsed.data.message?.trim()].filter(Boolean).join("\n\n") || null;
  const existing = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (existing && existing.status !== "REJECTED") {
    return NextResponse.json({ error: "ALREADY_REQUESTED", collaborator: { status: existing.status } }, { status: 409 });
  }
  try {
    const collaborator = existing
      ? await prisma.projectCollaborator.update({
        where: { id: existing.id },
        data: {
          role: parsed.data.role,
          status: "PENDING",
          invitedById: null,
          message: applicationMessage,
          createdAt: new Date(),
        },
      })
      : await prisma.projectCollaborator.create({
        data: {
          projectId: params.id,
          userId: session.user.id,
          role: parsed.data.role,
          status: "PENDING",
          message: applicationMessage,
        },
      });
    await createNotification(project.creatorId, session.user.id, "PROJECT_REQUEST", params.id);
    return NextResponse.json({ collaborator }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "ALREADY_REQUESTED", collaborator: { status: "PENDING" } }, { status: 409 });
    }
    throw error;
  }
}