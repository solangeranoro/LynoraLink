export function parsePublicGitHubRepo(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    const [owner, rawRepo] = parts;
    const repo = rawRepo.replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function fetchPublicGitHubApi(path: string) {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "LynoraLink",
    },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 },
  });
}