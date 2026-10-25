"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FolderKanban, MessageSquareText, Plus, Users } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

type ProjectStatus = "IDEA" | "DEVELOPMENT" | "LAUNCHED";

type WorkspaceProject = {
  id: string;
  title?: string;
  tagline?: string;
  status: ProjectStatus;
  _count: { collaborators: number; posts: number };
};

async function fetchProjects(): Promise<WorkspaceProject[]> {
  const response = await fetch("/api/projects?mine=1");
  if (!response.ok) throw new Error("projects_load_failed");
  const result = await response.json();
  return result.projects as WorkspaceProject[];
}

function useWorkspaceProjects() {
  return useQuery({
    queryKey: ["projects", "mine"],
    queryFn: fetchProjects,
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

  return (
    <section className="card overflow-hidden p-3.5">
      <header className="flex items-start justify-between gap-3 border-b border-midnight-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{isFrench ? "Vue d’ensemble" : "Overview"}</h2>
        </div>
        <Link href="/projects/new" title={t("nav.createProject")} aria-label={t("nav.createProject")} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-midnight-border bg-midnight-deep/50 text-ink-muted transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold-soft">
          <Plus size={16} aria-hidden="true" />
        </Link>
      </header>

      {isLoading ? (
        <div className="space-y-2.5 pt-3" aria-label={isFrench ? "Chargement de l’espace" : "Loading workspace"}>
          <div className="skeleton h-12" />
          <div className="skeleton h-16" />
        </div>
      ) : isError ? (
        <p className="pt-3 text-xs text-ink-muted">{isFrench ? "Impossible de charger les projets." : "Projects couldn't be loaded."}</p>
      ) : (
        <div className="space-y-3 pt-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: isFrench ? "Projets" : "Projects", value: projectList.length, icon: FolderKanban },
              { label: isFrench ? "Collab." : "Team", value: totals.collaborators, icon: Users },
              { label: isFrench ? "Posts" : "Posts", value: totals.posts, icon: MessageSquareText },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-midnight-border/70 bg-midnight-deep/45 p-2.5">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                  <Icon size={11} aria-hidden="true" />
                  <span>{label}</span>
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-midnight-border/70 bg-midnight-deep/45 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{isFrench ? "État" : "Status"}</p>
              <span className="text-[10px] text-ink-muted">{projectList.length}</span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-midnight-card" aria-hidden="true">
              {(["IDEA", "DEVELOPMENT", "LAUNCHED"] as ProjectStatus[]).map((status) => {
                const count = projectList.filter((project) => project.status === status).length;
                return count ? <span key={status} className={status === "IDEA" ? "bg-gold/70" : status === "DEVELOPMENT" ? "bg-sky-400" : "bg-emerald-400"} style={{ width: `${(count / Math.max(projectList.length, 1)) * 100}%` }} /> : null;
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function WorkspaceQuickActions() {
  const { t, locale } = useTranslation();
  const isFrench = locale === "fr";
  const { data: projects, isLoading, isError } = useWorkspaceProjects();
  const projectList = projects ?? [];
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
    <section className="card overflow-hidden p-3.5">
      <div className="space-y-3">
        <div className="rounded-xl border border-midnight-border/70 bg-midnight-deep/45 p-3">
          <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{isFrench ? "Passer à l’action" : "Take action"}</p>
          <div className="grid gap-2">
            <Link href="/discover" className="group flex items-center justify-between rounded-lg border border-midnight-border/70 bg-midnight-card/50 px-3 py-2.5 text-sm font-medium text-ink transition hover:border-gold/40 hover:bg-gold/5 hover:text-gold-soft">
              <span>{isFrench ? "Trouver des collaborateurs" : "Find collaborators"}</span>
              <ArrowUpRight size={14} className="text-ink-muted transition group-hover:text-gold-soft" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-midnight-border/70 bg-midnight-deep/45 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{isFrench ? "Projets récents" : "Recent projects"}</h3>
            <Link href="/projects" className="text-[10px] font-semibold text-gold-soft hover:text-gold-bright">{isFrench ? "Tous" : "All"}</Link>
          </div>
          {isLoading ? (
            <ul className="space-y-2.5" aria-label={isFrench ? "Chargement des projets récents" : "Loading recent projects"} aria-busy="true">
              {Array.from({ length: 2 }, (_, index) => (
                <li key={index} className="rounded-lg border border-midnight-border/70 bg-midnight-card/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-3 w-2/3" />
                      <div className="skeleton h-3 w-full" />
                    </div>
                    <div className="skeleton h-4 w-12 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <p role="alert" className="text-xs text-ink-muted">{isFrench ? "Impossible de charger les projets récents." : "Recent projects couldn't be loaded."}</p>
          ) : recentProjects.length > 0 ? (
            <ul className="space-y-2.5" aria-live="polite">
            {recentProjects.map((project) => {
              const statusClass = project.status === "LAUNCHED" ? "bg-emerald-400/15 text-emerald-300" : project.status === "DEVELOPMENT" ? "bg-sky-400/15 text-sky-300" : "bg-gold/15 text-gold-soft";
              return (
                <li key={project.id} className="rounded-lg border border-midnight-border/70 bg-midnight-card/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-ink">{project.title ?? project.id}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{project.tagline ?? (isFrench ? "Projet actif" : "Active project")}</p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusClass}`}>
                      {project.status === "LAUNCHED" ? (isFrench ? "Lancé" : "Launched") : project.status === "DEVELOPMENT" ? (isFrench ? "En cours" : "In progress") : (isFrench ? "Idée" : "Idea")}
                    </span>
                  </div>
                </li>
              );
            })}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">{isFrench ? "Aucun projet récent." : "No recent projects."}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default WorkspaceOverview;