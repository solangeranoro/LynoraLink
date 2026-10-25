import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPostSchema } from "@/lib/validators";
import { recordInteraction } from "@/lib/gamification";
import { canViewProject } from "@/lib/project-access";
import { isPlatformAdmin } from "@/lib/premium";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";
import { getAttachmentMimeType, safeAttachmentFileName } from "@/lib/attachment-files";
import { CloudinaryStorageError, deleteCloudinaryAsset, uploadCloudinaryAsset, type CloudinaryAsset } from "@/lib/cloudinary-storage";

export const dynamic = "force-dynamic";
const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const teamId = searchParams.get("teamId");
  const authorId = searchParams.get("authorId");
  const pageParam = searchParams.get("page");
  const isPaginated = pageParam !== null;
  const requestedPage = isPaginated ? Number(pageParam) : 1;
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return NextResponse.json({ error: "INVALID_PAGE" }, { status: 422 });
  const take = isPaginated ? 10 : Math.min(Number(searchParams.get("take") ?? 20), 50);
  const session = await auth();
  if (projectId && !(await canViewProject(projectId, session?.user?.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (teamId && !(await canViewProject(teamId, session?.user?.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const teamProjectIds = teamId
    ? (await prisma.project.findMany({ where: { parentTeamId: teamId }, select: { id: true } })).map(({ id }) => id)
    : [];
  const privateProjectIds = projectId || teamId
    ? []
    : (await prisma.project.findMany({ where: { isPrivate: true }, select: { id: true } })).map(({ id }) => id);
  const where = {
    moderationStatus: "APPROVED" as const,
    ...(projectId ? { OR: [{ projectId }, { teamId: projectId }] } : {}),
    ...(teamId ? { OR: [{ teamId }, { projectId: teamId }, { projectId: { in: teamProjectIds } }] } : {}),
    ...(!projectId && privateProjectIds.length ? {
      AND: [
        { NOT: { projectId: { in: privateProjectIds } } },
        { NOT: { teamId: { in: privateProjectIds } } },
      ],
    } : {}),
    ...(authorId ? { authorId } : {}),
  };
  const total = isPaginated ? await prisma.post.count({ where }) : null;
  const pageCount = total === null ? null : Math.ceil(total / take);
  const page = pageCount === null ? requestedPage : Math.min(requestedPage, Math.max(1, pageCount));
  const posts = await prisma.post.findMany({
    where,
    include: {
      author: {
        select: {
          id: true, email: true, name: true, image: true, handle: true, headline: true, skills: true, isVerified: true, emailVerified: true,
          marketplaceVerification: { select: { email: true, emailVerifiedAt: true, status: true, currentPeriodEnd: true } },
          userBadges: { select: { awardedAt: true, badge: { select: { key: true, name: true, icon: true } } } },
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          githubUrl: true,
          logoUrl: true,
          coverUrl: true,
          teamName: true,
          status: true,
          creator: { select: { id: true, name: true, handle: true, image: true } },
          parentTeam: { select: { id: true, title: true, teamName: true, logoUrl: true } },
          collaborators: {
            where: { userId: session?.user?.id ?? "" },
            select: { status: true },
          },
        },
      },
      team: {
        select: {
          id: true,
          title: true,
          slug: true,
          githubUrl: true,
          logoUrl: true,
          teamName: true,
          status: true,
          collaborators: {
            where: { userId: session?.user?.id ?? "" },
            select: { status: true },
          },
        },
      },
      _count: { select: { likes: true, comments: true } },
      attachments: { select: { id: true, name: true, mimeType: true, size: true } },
      poll: { select: { id: true, type: true, question: true, options: true, postId: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    ...(isPaginated ? { skip: (page - 1) * take } : {}),
    take,
  });
  const postIds = posts.map(({ id }) => id);
  const [likeGroups, myLikes] = await Promise.all([
    postIds.length
      ? prisma.like.groupBy({
        by: ["postId", "reaction"],
        where: { postId: { in: postIds } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
    session?.user?.id && postIds.length
      ? prisma.like.findMany({
        where: { postId: { in: postIds }, userId: session.user.id },
        select: { postId: true, reaction: true },
      })
      : Promise.resolve([]),
  ]);
  const reactionCountsByPostId = new Map<string, Record<string, number>>();
  for (const group of likeGroups) {
    const reactionCounts = reactionCountsByPostId.get(group.postId) ?? {};
    reactionCounts[group.reaction] = group._count._all;
    reactionCountsByPostId.set(group.postId, reactionCounts);
  }
  const reactionByPostId = new Map(myLikes.map(({ postId, reaction }) => [postId, reaction]));
  const polls = posts.flatMap((post) => post.poll ? [{ ...post.poll, authorId: post.authorId }] : []);
  const pollIds = polls.map(({ id }) => id);
  const myPollVotes = session?.user?.id && pollIds.length
    ? await prisma.pollVote.findMany({
      where: { pollId: { in: pollIds }, userId: session.user.id },
      select: { pollId: true, optionIndex: true, answer: true },
    })
    : [];
  const myPollVoteById = new Map(myPollVotes.map((vote) => [vote.pollId, vote]));
  const visiblePolls = polls.filter((poll) => poll.type === "STAR" || poll.authorId === session?.user?.id || myPollVoteById.has(poll.id));
  const visiblePollIds = visiblePolls.map(({ id }) => id);
  const textPollIds = visiblePolls.filter((poll) => poll.type === "TEXT").map(({ id }) => id);
  const [voteGroups, textAnswerGroups] = await Promise.all([
    visiblePollIds.length
      ? prisma.pollVote.groupBy({
        by: ["pollId", "optionIndex"],
        where: { pollId: { in: visiblePollIds } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
    textPollIds.length
      ? prisma.pollVote.groupBy({
        by: ["pollId", "answer"],
        where: { pollId: { in: textPollIds }, answer: { not: null } },
        _count: { _all: true },
      })
      : Promise.resolve([]),
  ]);
  const votesByPollId = new Map<string, number>();
  const votesByPollOption = new Map<string, number>();
  for (const group of voteGroups) {
    votesByPollId.set(group.pollId, (votesByPollId.get(group.pollId) ?? 0) + group._count._all);
    if (group.optionIndex !== null) {
      votesByPollOption.set(`${group.pollId}:${group.optionIndex}`, group._count._all);
    }
  }
  const textAnswersByPollId = new Map<string, Map<string, number>>();
  for (const group of textAnswerGroups) {
    const answer = group.answer?.trim();
    if (!answer) continue;
    const answers = textAnswersByPollId.get(group.pollId) ?? new Map<string, number>();
    answers.set(answer, (answers.get(answer) ?? 0) + group._count._all);
    textAnswersByPollId.set(group.pollId, answers);
  }
  const preferences = session?.user?.id && posts.length
    ? await prisma.postPreference.findMany({
      where: { userId: session.user.id, postId: { in: posts.map(({ id }) => id) } },
      select: { postId: true, saved: true, hidden: true },
    })
    : [];
  const preferenceByPostId = new Map(preferences.map((preference) => [preference.postId, preference]));
  return NextResponse.json({
    posts: posts.map((post) => {
      const reactionCounts = reactionCountsByPostId.get(post.id) ?? {};
      const reactionByMe = reactionByPostId.get(post.id) ?? null;
      const { project, team, poll, ...postData } = post;
      const { moderationStatus, reviewedBy, reviewDate, ...publicPostData } = postData;
      const { userBadges, email, emailVerified, marketplaceVerification, ...author } = postData.author;
      const contextProject = postData.type === "TEAM" ? team ?? project : project;
      const myPollVote = poll ? myPollVoteById.get(poll.id) : null;
      const pollResultsVisible = Boolean(poll && (poll.type === "STAR" || post.authorId === session?.user?.id || myPollVote));
      const reactionCount = Object.values(reactionCounts).reduce((total, count) => total + count, 0);
      return {
        ...publicPostData,
        _count: { ...postData._count, likes: reactionCount },
        author: {
          ...author,
          isVerified: isPlatformAdmin(email) ||
            (author.isVerified && Boolean(emailVerified)) ||
            Boolean(emailVerified && email.toLowerCase() === marketplaceVerification?.email.toLowerCase() && marketplaceVerification?.emailVerifiedAt && hasActiveMarketplaceVerification(marketplaceVerification)),
          badges: userBadges.map(({ badge, awardedAt }) => ({ key: badge.key, name: badge.name, icon: badge.icon, awardedAt })),
        },
        project: contextProject ? {
          id: contextProject.id,
          title: contextProject.title,
          slug: contextProject.slug,
          githubUrl: contextProject.githubUrl,
          logoUrl: contextProject.logoUrl,
          teamName: contextProject.teamName,
          status: contextProject.status,
          collaborationStatus: contextProject.collaborators[0]?.status ?? null,
          ...(project ? {
            coverUrl: project.coverUrl,
            creator: project.creator,
            parentTeam: project.parentTeam,
          } : {}),
        } : null,
        team: team ? {
          id: team.id,
          title: team.title,
          slug: team.slug,
          logoUrl: team.logoUrl,
          teamName: team.teamName,
        } : null,
        likedByMe: reactionByMe !== null,
        savedByMe: preferenceByPostId.get(post.id)?.saved ?? false,
        hiddenByMe: preferenceByPostId.get(post.id)?.hidden ?? false,
        reactionByMe,
        reactionCounts,
        poll: poll ? {
          id: poll.id,
          type: poll.type,
          question: poll.question,
          options: poll.options,
          totalVotes: pollResultsVisible ? votesByPollId.get(poll.id) ?? 0 : 0,
          voteCounts: poll.options.map((_, index) => pollResultsVisible ? votesByPollOption.get(`${poll.id}:${index}`) ?? 0 : 0),
          myVote: myPollVote?.optionIndex ?? null,
          resultsVisible: pollResultsVisible,
          textAnswers: pollResultsVisible && poll.type === "TEXT"
            ? [...(textAnswersByPollId.get(poll.id) ?? new Map<string, number>())].map(([answer, votes]) => ({ answer, votes }))
            : [],
          myAnswer: myPollVote?.answer ?? null,
        } : null,
      };
    }),
    ...(total === null ? {} : { pagination: { page, pageSize: take, total, totalPages: Math.max(1, pageCount ?? 1) } }),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const uploadedAssets: CloudinaryAsset[] = [];
  let attachmentsPersisted = false;
  try {
    let body: unknown;
    let files: File[] = [];
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawTags = formData.get("tags");
      const pollQuestion = formData.get("pollQuestion");
      const pollType = formData.get("pollType");
      const rawPollOptions = formData.get("pollOptions");
      let tags: unknown = [];
      let pollOptions: unknown;
      if (typeof rawTags === "string") {
        try {
          tags = JSON.parse(rawTags);
        } catch {
          return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
        }
      }
      if (typeof rawPollOptions === "string" && rawPollOptions) {
        try {
          pollOptions = JSON.parse(rawPollOptions);
        } catch {
          return NextResponse.json({ error: "VALIDATION" }, { status: 422 });
        }
      }
      body = {
        content: formData.get("content"),
        type: formData.get("type") || "PERSONAL",
        codeSnippet: formData.get("codeSnippet") || undefined,
        codeLang: formData.get("codeLang") || undefined,
        imageUrl: formData.get("imageUrl") || undefined,
        projectId: formData.get("projectId") || undefined,
        teamId: formData.get("teamId") || undefined,
        pollQuestion: typeof pollQuestion === "string" && pollQuestion.trim() ? pollQuestion : undefined,
        pollType: typeof pollType === "string" && pollType ? pollType : undefined,
        pollOptions,
        tags,
      };
      const rawFiles = formData.getAll("attachments");
      if (rawFiles.some((file) => !isUploadedFile(file))) {
        return NextResponse.json({ error: "INVALID_ATTACHMENT" }, { status: 422 });
      }
      files = rawFiles.filter(isUploadedFile);
      const totalSize = files.reduce((total, file) => total + file.size, 0);
      if (files.length > MAX_ATTACHMENT_COUNT || totalSize > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: "ATTACHMENT_LIMIT" }, { status: 413 });
      }
      if (files.some((file) => !getAttachmentMimeType(file))) {
        return NextResponse.json({ error: "UNSUPPORTED_ATTACHMENT" }, { status: 415 });
      }
    } else {
      body = await req.json();
    }

    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const data = parsed.data;
    const scopedProjectId = data.type === "TEAM" ? data.teamId : data.type === "PROJECT" ? data.projectId : undefined;
    if (scopedProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: scopedProjectId },
        select: {
          creatorId: true,
          parentTeamId: true,
          collaborators: { where: { userId: session.user.id, status: "APPROVED" }, select: { id: true }, take: 1 },
        },
      });
      if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      if (data.type === "PROJECT" && data.teamId) {
        if (project.parentTeamId !== data.teamId) return NextResponse.json({ error: "TEAM_PROJECT_MISMATCH" }, { status: 422 });
        const teamMembership = await prisma.projectCollaborator.findUnique({
          where: { projectId_userId: { projectId: data.teamId, userId: session.user.id } },
          select: { status: true },
        });
        if (teamMembership?.status !== "APPROVED") {
          return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }
      } else if (project.creatorId !== session.user.id && project.collaborators.length === 0) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }
    const attachments = [];
    for (const file of files) {
      const asset = await uploadCloudinaryAsset(
        Buffer.from(await file.arrayBuffer()),
        "lynoralink/attachments/posts",
        file.name,
        getAttachmentMimeType(file)!,
      );
      uploadedAssets.push(asset);
      attachments.push({
        name: safeAttachmentFileName(file.name),
        mimeType: getAttachmentMimeType(file)!,
        size: file.size,
        cloudinaryPublicId: asset.publicId,
        cloudinaryResourceType: asset.resourceType,
        cloudinaryFormat: asset.format,
      });
    }
    const post = await prisma.post.create({
      data: {
        type: data.type,
        content: data.content,
        codeSnippet: data.codeSnippet || null,
        codeLang: data.codeLang || null,
        imageUrl: data.imageUrl || null,
        tags: data.tags,
        authorId: session.user.id,
        projectId: data.projectId || null,
        teamId: data.teamId || null,
        attachments: attachments.length ? { create: attachments } : undefined,
        poll: data.pollQuestion
          ? {
            create: {
              type: data.pollType ?? "OPTIONS",
              question: data.pollQuestion,
              options: data.pollType === "STAR" ? ["1", "2", "3", "4", "5"] : data.pollType === "TEXT" ? [] : [...new Set(data.pollOptions ?? [])],
            },
          }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, image: true, handle: true, headline: true } },
        project: {
          select: {
            id: true, title: true, slug: true, githubUrl: true, status: true, logoUrl: true, coverUrl: true, teamName: true,
            creator: { select: { id: true, name: true, handle: true, image: true } },
            parentTeam: { select: { id: true, title: true, teamName: true, logoUrl: true } },
          },
        },
        team: { select: { id: true, title: true, slug: true, githubUrl: true, status: true, logoUrl: true, teamName: true } },
        poll: { select: { id: true } },
      },
    });
    attachmentsPersisted = true;
    await recordInteraction(session.user.id, "POST", post.id);
    if (post.poll) await recordInteraction(session.user.id, "POLL", post.poll.id, `${session.user.id}:POLL_CREATE:${post.poll.id}`);
    if (data.type === "TEAM") await recordInteraction(session.user.id, "TEAM", post.id);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    if (!attachmentsPersisted) {
      const cleanup = await Promise.allSettled(uploadedAssets.map(deleteCloudinaryAsset));
      if (cleanup.some((result) => result.status === "rejected")) {
        console.error("Failed to clean up one or more Cloudinary post attachments.");
      }
    }
    if (error instanceof CloudinaryStorageError) {
      const status = error.code === "not_configured" ? 503 : 502;
      return NextResponse.json({ error: error.code === "not_configured" ? "cloudinary_not_configured" : "cloudinary_upload_failed" }, { status });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}