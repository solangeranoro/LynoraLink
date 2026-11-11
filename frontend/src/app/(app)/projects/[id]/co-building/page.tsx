"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Code2, FolderTree, Layers3 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ProjectCoBuilding } from "@/co-building/ProjectCoBuilding";
import { useTranslation } from "@/lib/i18n";

type ProjectWorkspace = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  logoUrl: string | null;
  techStack: string[];
  githubUrl: string | null;
};

type ProjectResponse = {
  project: ProjectWorkspace;
  canContribute: boolean;
  isOwner: boolean;
};

export default function ProjectCoBuildingPage() {
  const { locale } = useTranslation();
  const params = useParams<{ id: string }>();
  const isFrench = locale === "fr";
  const projectQuery = useQuery({
    queryKey: ["project-hub", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error("project_load_failed");
      return await response.json() as ProjectResponse;
    },
  });

  if (projectQuery.isLoading) {
    return (
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]" aria-label={isFrench ? "Chargement de l’espace de co-building" : "Loading co-building workspace"} aria-busy="true">
        <aside className="hidden flex-col gap-5 rounded-xl border border-midnight-border bg-midnight-deep p-4 lg:flex">
          <div className="flex h-12 items-center border-b border-midnight-border pb-3">
            <div className="skeleton h-8 w-36" />
          </div>
          <div className="skeleton h-4 w-24" />
          <div className="rounded-xl border border-midnight-border bg-midnight/40 p-3">
            <div className="skeleton h-5 w-4/5" />
            <div className="skeleton mt-3 h-3 w-full" />
            <div className="skeleton mt-2 h-3 w-3/5" />
          </div>
          <div className="space-y-2 border-t border-midnight-border pt-4">
            <div className="skeleton h-8 w-full rounded-lg" />
            <div className="skeleton h-8 w-4/5 rounded-lg" />
          </div>
          <div className="mt-2 border-t border-midnight-border pt-4">
            <div className="skeleton h-3 w-24" />
            <div className="mt-3 flex gap-2">
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border pb-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-6 w-40" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="flex gap-2">
              <div className="skeleton h-8 w-24 rounded-lg" />
              <div className="skeleton h-8 w-20 rounded-lg" />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="hidden flex-col gap-3 rounded-xl border border-midnight-border bg-midnight/40 p-3 lg:flex">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-3 w-4/5" />
              <div className="skeleton h-3 w-3/5" />
              <div className="mt-3 space-y-2">
                <div className="skeleton h-7 w-full rounded-md" />
                <div className="skeleton h-7 w-4/5 rounded-md" />
                <div className="skeleton h-7 w-11/12 rounded-md" />
              </div>
            </div>
            <div className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-midnight-border bg-midnight/40">
              <div className="flex h-10 items-center gap-2 border-b border-midnight-border px-3">
                <div className="skeleton h-5 w-28 rounded-md" />
                <div className="skeleton h-5 w-24 rounded-md" />
              </div>
              <div className="flex-1 space-y-3 p-4">
                <div className="skeleton h-3 w-2/5" />
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3 w-3/5" />
                <div className="skeleton h-3 w-11/12" />
                <div className="skeleton mt-5 h-3 w-1/2" />
                <div className="skeleton h-3 w-4/5" />
              </div>
              <div className="skeleton h-6 w-full rounded-none" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/projects" className="btn-ghost w-fit">
          <ArrowLeft size={16} aria-hidden="true" />{isFrench ? "Projets" : "Projects"}
        </Link>
        <p role="alert" className="card p-5 text-sm text-rose-300">
          {isFrench ? "Impossible de charger ce projet." : "Could not load this project."}
        </p>
      </div>
    );
  }

  const { project, canContribute, isOwner } = projectQuery.data;
  if (!canContribute) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={`/projects/${project.id}`} className="btn-ghost w-fit">
          <ArrowLeft size={16} aria-hidden="true" />{isFrench ? "Retour au projet" : "Back to project"}
        </Link>
        <p role="alert" className="card p-5 text-sm text-ink-muted">
          {isFrench
            ? "L’espace de co-building est réservé aux membres du projet."
            : "The co-building workspace is available to project members."}
        </p>
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-midnight-deep text-ink lg:flex-row" aria-label={isFrench ? "Espace de co-building" : "Co-building workspace"}>
      <aside className="hidden h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-midnight-border bg-midnight-deep/80 backdrop-blur-md lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-midnight-border bg-midnight-deep/95 px-5">
          <Link href={`/projects/${project.id}`} className="inline-flex items-center">
            <Logo size={34} withWordmark priority />
          </Link>
        </div>

        <div className="sidebar-scrollbar-hidden flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted transition hover:text-ink">
            <ArrowLeft size={15} aria-hidden="true" />
            {isFrench ? "Retour au projet" : "Back to project"}
          </Link>

          <div className="rounded-2xl border border-midnight-border bg-midnight-card/45 p-3">
            <h1 className="break-words font-display text-base font-semibold text-ink">{project.title}</h1>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{project.tagline}</p>
          </div>

          <nav className="space-y-1" aria-label={isFrench ? "Navigation de l’espace projet" : "Project workspace navigation"}>
            <Link href={`/projects/${project.id}`} className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs text-ink-muted transition hover:bg-midnight-deep hover:text-ink">
              <Layers3 size={15} aria-hidden="true" />
              {isFrench ? "Vue du projet" : "Project overview"}
            </Link>
            <span aria-current="page" className="flex min-h-9 items-center gap-2 rounded-lg border border-gold/20 bg-gold/10 px-3 text-xs font-semibold text-gold-soft">
              <Code2 size={15} aria-hidden="true" />
              {isFrench ? "Co-building" : "Co-building"}
            </span>
            <div className="mt-3 border-t border-midnight-border pt-3">
              <p className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                <FolderTree size={13} aria-hidden="true" />
                {isFrench ? "Technologies" : "Technologies"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 px-3">
                {project.techStack.length
                  ? project.techStack.map((technology) => <span key={technology} className="badge">{technology}</span>)
                  : <span className="text-[11px] text-ink-muted">{isFrench ? "Non précisées" : "Not specified"}</span>}
              </div>
            </div>
          </nav>
        </div>
      </aside>

      <div className="flex h-12 shrink-0 items-center border-b border-midnight-border bg-midnight-deep/95 px-3 lg:hidden">
        <Link href={`/projects/${project.id}`} className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" />
          {isFrench ? "Retour au projet" : "Back to project"}
        </Link>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ProjectCoBuilding
          projectId={project.id}
          isOwner={isOwner}
          title={project.title}
          tagline={project.tagline}
          description={project.description}
          logoUrl={project.logoUrl}
          githubUrl={project.githubUrl}
          className="!h-full !min-h-0 !pb-0"
        />
      </div>
    </section>
  );
}
