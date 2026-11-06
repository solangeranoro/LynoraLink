import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { fetchPublicGitHubApi, parsePublicGitHubRepo } from "@/lib/github";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  const repository = parsePublicGitHubRepo(url);
  if (!repository) return NextResponse.json({ error: "INVALID_GITHUB_URL" }, { status: 422 });

  try {
    const response = await fetchPublicGitHubApi(`/repos/${repository.owner}/${repository.repo}`);
    if (response.status === 404) return NextResponse.json({ error: "REPOSITORY_NOT_FOUND" }, { status: 404 });
    if (response.status === 403 || response.status === 429) return NextResponse.json({ error: "GITHUB_RATE_LIMIT" }, { status: 503 });
    if (!response.ok) return NextResponse.json({ error: "GITHUB_UNAVAILABLE" }, { status: 502 });
    const result = await response.json() as {
      name: string;
      full_name: string;
      description: string | null;
      html_url: string;
      language: string | null;
      topics?: string[];
    };
    return NextResponse.json({
      repository: {
        name: result.name,
        fullName: result.full_name,
        description: result.description,
        url: result.html_url,
        language: result.language,
        topics: result.topics ?? [],
      },
    });
  } catch {
    return NextResponse.json({ error: "GITHUB_UNAVAILABLE" }, { status: 502 });
  }
}