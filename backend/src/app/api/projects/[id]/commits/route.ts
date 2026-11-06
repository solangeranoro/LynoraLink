import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { fetchPublicGitHubApi, parsePublicGitHubRepo } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { canViewProject } from "@/lib/project-access";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await canViewProject(params.id, session.user.id))) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { githubUrl: true } });
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const repository = project.githubUrl ? parsePublicGitHubRepo(project.githubUrl) : null;
  if (!repository) return NextResponse.json({ commits: [] });

  try {
    const response = await fetchPublicGitHubApi(`/repos/${repository.owner}/${repository.repo}/commits?per_page=5`);
    if (response.status === 404) return NextResponse.json({ commits: [] });
    if (response.status === 403 || response.status === 429) return NextResponse.json({ error: "GITHUB_RATE_LIMIT" }, { status: 503 });
    if (!response.ok) return NextResponse.json({ error: "GITHUB_UNAVAILABLE" }, { status: 502 });
    const commits = await response.json() as {
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } | null };
      author: { login: string } | null;
    }[];
    return NextResponse.json({
      commits: commits.map((commit) => ({
        sha: commit.sha,
        url: commit.html_url,
        message: commit.commit.message.split("\n")[0],
        author: commit.commit.author?.name ?? commit.author?.login ?? "GitHub",
        createdAt: commit.commit.author?.date ?? new Date().toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "GITHUB_UNAVAILABLE" }, { status: 502 });
  }
}