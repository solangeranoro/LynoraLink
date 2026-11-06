"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ArrowRight, ArrowUpRight, Plus } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

type ProjectStatus = "IDEA" | "DEVELOPMENT" | "LAUNCHED";

type WorkspaceProject = {
  id: string;
  title: string;
  tagline?: string;
  logoUrl: string | null;
  coverUrl: string | null;
  tags: string[];
  techStack: string[];
  createdAt: string;
  status: ProjectStatus;
  _count: { collaborators: number; posts: number };
  creator: { id: string; name: string | null; handle: string | null };
  teamName?: string | null;
  parentTeam?: { teamName: string | null; title: string } | null;
};

async function fetchProjects(url: string): Promise<WorkspaceProject[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("projects_load_failed");
  const result = await response.json() as { projects: WorkspaceProject[] };
  return result.projects;
}

async function fetchDiscoverableProjects(userId: string): Promise<WorkspaceProject[]> {
  const [makerProjects, teamProjects] = await Promise.all([
    fetchProjects("/api/projects?discover=1"),
    fetchProjects("/api/projects?teams=discover"),
  ]);
  return [...makerProjects, ...teamProjects]
    .filter((project) => project.creator.id !== userId)
    .filter((project, index, allProjects) => allProjects.findIndex((candidate) => candidate.id === project.id) === index)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

function useWorkspaceProjects() {
  return useQuery({
    queryKey: ["projects", "mine"],
    queryFn: () => fetchProjects("/api/projects?mine=1"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function WorkspaceOverview() {
  const { t, locale } = useTranslation();
  const isFrench = locale === "fr";
  const { data: projects, isLoading, isError } = useWorkspaceProjects();
  const projectList = projects ?? [];
  const totals = {
    collaborators: projectList.reduce((sum, project) => sum + project._count.collaborators, 0),
    posts: projectList.reduce((sum, project) => sum + project._count.posts, 0),
  };
  const statuses = [
    { status: "IDEA" as const, label: isFrench ? "Idée" : "Idea", color: "bg-gold/80" },
    { status: "DEVELOPMENT" as const, label: isFrench ? "En cours" : "In progress", color: "bg-sky-400" },
    { status: "LAUNCHED" as const, label: isFrench ? "Lancé" : "Launched", color: "bg-emerald-400" },
  ];

  return (
    <section className="card overflow-hidden rounded-2xl p-4 shadow-card">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{isFrench ? "Mes projets" : "My projects"}</h2>
        <Link href="/projects/new" title={t("nav.createProject")} aria-label={t("nav.createProject")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-midnight-border bg-midnight-deep/50 text-ink-muted transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold-soft">
          <Plus size={14} aria-hidden="true" />
        </Link>
      </header>

      {isLoading ? (
        <div className="space-y-3" aria-label={isFrench ? "Chargement des projets" : "Loading projects"}>
          <div className="grid grid-cols-3 gap-2"><div className="skeleton h-14" /><div className="skeleton h-14" /><div className="skeleton h-14" /></div>
          <div className="skeleton h-16" />
        </div>
      ) : isError ? (
        <p role="alert" className="text-xs text-rose-300">{isFrench ? "Impossible de charger les projets." : "Projects couldn't be loaded."}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: isFrench ? "Projets" : "Projects", value: projectList.length },
              { label: isFrench ? "Membres" : "Members", value: totals.collaborators },
              { label: isFrench ? "Publications" : "Posts", value: totals.posts },
            ].map(({ label, value }) => (
              <div key={label} className="min-w-0 rounded-xl border border-midnight-border/70 bg-midnight-deep/35 px-2.5 py-2">
                <p className="truncate text-[9px] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-midnight-border/70 bg-midnight-deep/35 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-ink-muted">{isFrench ? "Statut des projets" : "Project status"}</p>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-midnight-card" role="img" aria-label={isFrench ? "Répartition des projets par état" : "Projects by status"}>
              {(["IDEA", "DEVELOPMENT", "LAUNCHED"] as ProjectStatus[]).map((status) => {
                const count = projectList.filter((project) => project.status === status).length;
                return count ? <span key={status} className={status === "IDEA" ? "bg-gold/80" : status === "DEVELOPMENT" ? "bg-sky-400" : "bg-emerald-400"} style={{ width: `${(count / Math.max(projectList.length, 1)) * 100}%` }} /> : null;
              })}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {statuses.map(({ status, label, color }) => (
                <li key={status} className="flex min-w-0 items-center gap-1 text-[9px] text-ink-muted">
                  <span className={`size-1.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto font-medium tabular-nums text-ink">{projectList.filter((project) => project.status === status).length}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export function WorkspaceQuickActions() {
  const { t, locale } = useTranslation();
  const { data: session } = useSession();
  const isFrench = locale === "fr";
  const userId = session?.user?.id;
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects", "discoverable-samples", userId],
    queryFn: () => {
      if (!userId) throw new Error("session_required");
      return fetchDiscoverableProjects(userId);
    },
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const projectList = [...(projects ?? [])].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  const [recentProjectOffset, setRecentProjectOffset] = useState(0);
  const normalizedOffset = projectList.length ? recentProjectOffset % projectList.length : 0;
  const recentProjects = projectList.length ? [projectList[normalizedOffset]] : [];

  useEffect(() => {
    if (projectList.length <= 1) {
      setRecentProjectOffset(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRecentProjectOffset((offset) => ((offset % projectList.length) + 1) % projectList.length);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [projectList.length]);

  return (
    <section className="card overflow-hidden rounded-2xl shadow-card">
      <div className="p-4 pb-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{isFrench ? "À découvrir" : "Discover"}</h2>
          <Link href="/discover" className="text-[10px] font-medium text-gold-soft transition hover:text-gold-bright">
            {isFrench ? "Voir tout" : "View all"}
          </Link>
        </div>
        {isLoading ? (
          <div className="skeleton h-40 rounded-xl" aria-label={isFrench ? "Chargement des projets" : "Loading projects"} />
        ) : isError ? (
          <p role="alert" className="py-2 text-xs text-rose-300">{isFrench ? "Impossible de charger les projets." : "Projects couldn't be loaded."}</p>
        ) : recentProjects.length > 0 ? (
          <ul aria-live="polite">
            {recentProjects.map((project) => {
              const statusLabel = project.status === "LAUNCHED" ? (isFrench ? "Lancé" : "Launched") : project.status === "DEVELOPMENT" ? (isFrench ? "En développement" : "In development") : (isFrench ? "En réflexion" : "In planning");
              const projectTags = project.tags.length ? project.tags : project.techStack;
              const teamName = project.teamName?.trim() || project.parentTeam?.teamName?.trim() || project.parentTeam?.title;
              const authorName = project.creator.name || (project.creator.handle ? `@${project.creator.handle}` : null);
              return (
                <li key={project.id} className="animate-dashboard-slide">
                  <Link href={`/projects/${project.id}`} className="group relative block h-48 overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep transition hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
                    {project.coverUrl ? (
                      <Image src={project.coverUrl} alt="" fill sizes="320px" unoptimized className="object-cover transition duration-700 group-hover:scale-105" />
                    ) : (
                      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-gold/20 via-midnight-card to-emerald-500/10" />
                    )}
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
                    <span className="relative flex h-full flex-col p-3.5">
                      <span className="flex items-start justify-between gap-2">
                        {project.logoUrl ? (
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/30 bg-midnight-card/90 p-1 shadow-lg">
                            <Image src={project.logoUrl} alt="" width={36} height={36} unoptimized className="h-full w-full rounded object-contain" />
                          </span>
                        ) : null}
                        <span className="ml-auto rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[9px] font-medium text-white backdrop-blur-sm">
                          {statusLabel}
                        </span>
                      </span>
                      <span className="mt-auto pt-4">
                        <span className="block truncate text-sm font-semibold text-white">{project.title}</span>
                        {project.tagline && <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-white/75">{project.tagline}</span>}
                        {(teamName || authorName) && (
                          <span className="mt-1.5 block truncate text-[9px] text-white/65">
                            {teamName ? `${isFrench ? "Équipe" : "Team"} · ${teamName}` : `${isFrench ? "Par" : "By"} ${authorName}`}
                          </span>
                        )}
                        {projectTags.length > 0 && (
                          <span className="mt-2 flex flex-nowrap gap-1.5 overflow-hidden">
                            {projectTags.slice(0, 3).map((tag) => (
                              <span key={tag} className="max-w-20 shrink truncate rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[9px] text-white/85">{tag}</span>
                            ))}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-midnight-border px-3 py-5 text-center">
            <p className="text-xs text-ink-muted">{isFrench ? "Aucun projet public à découvrir pour le moment." : "No public projects to discover yet."}</p>
            <Link href="/discover" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-soft hover:text-gold-bright">
              {isFrench ? "Explorer les projets" : "Explore projects"} <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <Link href="/discover" className="group flex items-center justify-between border-t border-midnight-border px-4 py-3 text-xs font-medium text-ink-muted transition hover:bg-midnight-deep/40 hover:text-gold-soft">
        {isFrench ? "Découvrir des projets" : "Discover projects"}
        <ArrowUpRight size={13} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

export default WorkspaceOverview;