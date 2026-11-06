"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, Github, Users } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useTranslation } from "@/lib/i18n";

export type ProfileProjectPreview = {
  id: string;
  title: string;
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
  status: "IDEA" | "DEVELOPMENT" | "LAUNCHED";
  isFeatured: boolean;
  githubUrl: string | null;
  liveUrl: string | null;
  techStack: string[];
  creator: { id: string; name: string | null; image: string | null; handle: string | null };
  parentTeam: { id: string; title: string; teamName: string | null; logoUrl: string | null } | null;
  _count: { collaborators: number; posts: number };
};

export function ProfileProjectCard({ project, children }: { project: ProfileProjectPreview; children?: ReactNode }) {
  const { t, locale } = useTranslation();
  const isFrench = locale === "fr";
  const creatorName = project.creator.name || project.creator.handle || (isFrench ? "Créateur" : "Maker");
  const teamName = project.parentTeam?.teamName?.trim() || project.parentTeam?.title;
  const showTeamName = Boolean(teamName && teamName.toLowerCase() !== project.title.trim().toLowerCase());

  return (
    <article className="card overflow-hidden transition hover:border-gold/30">
      <div className={project.parentTeam ? "flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5" : "flex items-center gap-2.5 px-3.5 py-2.5"}>
        {project.parentTeam && teamName && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href={`/teams/${project.parentTeam.id}`} aria-label={teamName} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
              <Avatar src={project.parentTeam.logoUrl} name={teamName} size={32} />
            </Link>
            <div className="min-w-0">
              <Link href={`/teams/${project.parentTeam.id}`} className="block truncate text-xs font-semibold text-ink transition hover:text-gold-soft">{teamName}</Link>
              <p className="text-[9px] text-ink-muted">{isFrench ? "Équipe" : "Team"}</p>
            </div>
          </div>
        )}
        {project.parentTeam ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href={`/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`} aria-label={creatorName} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
              <Avatar src={project.creator.image} name={creatorName} size={32} />
            </Link>
            <div className="min-w-0">
              <Link href={`/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`} className="block truncate text-xs font-semibold text-ink transition hover:text-gold-soft">{creatorName}</Link>
              <p className="text-[9px] text-ink-muted">{isFrench ? "Créateur" : "Creator"}</p>
            </div>
          </div>
        ) : (
          <>
            <Link href={`/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`} aria-label={creatorName} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
              <Avatar src={project.creator.image} name={creatorName} size={36} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`} className="block truncate text-[13px] font-semibold text-ink transition hover:text-gold-soft">{creatorName}</Link>
              <p className="mt-0.5 text-[10px] text-ink-muted">{isFrench ? "Créateur du projet" : "Project creator"}</p>
            </div>
          </>
        )}
        {project.isFeatured && <span className="badge-gold shrink-0 text-[10px]">{isFrench ? "À la une" : "Featured"}</span>}
      </div>

      <Link href={`/projects/${project.id}`} aria-label={project.title} className="group relative block aspect-[16/6] overflow-hidden border-y border-midnight-border bg-[linear-gradient(135deg,rgba(8,111,88,0.18),rgba(19,34,56,0.75))]">
        {project.coverUrl ? (
          <Image src={project.coverUrl} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" unoptimized className="object-cover transition duration-500 group-hover:scale-[1.02]" />
        ) : (
          <>
            {project.logoUrl && <Image src={project.logoUrl} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" unoptimized className="scale-110 object-cover opacity-25 blur-xl" />}
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-gold/20 via-midnight-deep/75 to-cyan-950/90" />
          </>
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
        <span className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">{isFrench ? "Projet" : "Project"}</span>
          <span className={`rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${project.status === "LAUNCHED" ? "text-emerald-200" : project.status === "DEVELOPMENT" ? "text-sky-200" : "text-white/90"}`}>{t(`projects.status.${project.status}`)}</span>
        </span>
        <span className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-3.5">
          {project.logoUrl && (
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-black/30 shadow-lg">
              <Image src={project.logoUrl} alt="" fill sizes="56px" unoptimized className="object-cover" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg font-semibold tracking-tight text-white drop-shadow">{project.title}</span>
            {showTeamName && <span className="mt-0.5 block truncate text-[11px] font-medium text-white/75">{teamName}</span>}
          </span>
        </span>
      </Link>

      <div className="space-y-2.5 p-3">
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{project.tagline}</p>
        {project.techStack.length > 0 && <div className="flex flex-wrap gap-1.5">{project.techStack.slice(0, 4).map((technology) => <span key={technology} className="badge">{technology}</span>)}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden="true" />{project._count.collaborators} {t("projects.collaborators").toLowerCase()}</span>
          <span>{project._count.posts} posts</span>
          <span className="ml-auto flex items-center gap-3">
            {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" aria-label="GitHub" className="text-ink-muted transition hover:text-gold"><Github size={16} aria-hidden="true" /></a>}
            {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={isFrench ? "Projet en ligne" : "Live project"} className="text-ink-muted transition hover:text-gold"><ExternalLink size={16} aria-hidden="true" /></a>}
          </span>
        </div>
      </div>
      <div className="border-t border-midnight-border p-3 pt-2.5">
        <Link href={`/projects/${project.id}`} className="text-[11px] font-semibold text-gold-soft transition hover:text-gold-bright">
          {isFrench ? "Ouvrir le projet" : "Open project"} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {children}
    </article>
  );
}
