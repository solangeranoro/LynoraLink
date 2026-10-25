"use client";

import Link from "next/link";
import Image from "next/image";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Github, ExternalLink, UsersRound, Megaphone, LoaderCircle, ChevronLeft, ChevronRight } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useTranslation } from "@/lib/i18n";
import { ProjectsListSkeleton } from "@/components/skeletons";
import { openPaddleCheckout } from "@/lib/paddle-checkout";

interface Project {
  id: string;
  title: string;
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
  status: "IDEA" | "DEVELOPMENT" | "LAUNCHED";
  isFeatured: boolean;
  githubUrl: string | null;
  liveUrl: string | null;
  tags: string[];
  techStack: string[];
  activeBoost: boolean;
  creator: { id: string; name: string | null; image: string | null; handle: string | null };
  parentTeam: { id: string; title: string; teamName: string | null; logoUrl: string | null } | null;
  _count: { collaborators: number; posts: number };
}

interface ProjectsResponse {
  projects: Project[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

export default function ProjectsPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const [boostingId, setBoostingId] = useState("");
  const [boostError, setBoostError] = useState("");
  const [boostMessageIsError, setBoostMessageIsError] = useState(true);
  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "success") {
      setBoostError(locale === "fr" ? "Paiement confirmé. Votre boost est actif pendant 7 jours." : "Payment confirmed. Your boost is active for 7 days.");
      setBoostMessageIsError(false);
    } else if (checkout === "failed") {
      setBoostError(locale === "fr" ? "Le paiement n’a pas pu être confirmé. Réessayez." : "Payment could not be confirmed. Try again.");
      setBoostMessageIsError(true);
    } else if (checkout === "cancelled") {
      setBoostError(locale === "fr" ? "Paiement annulé." : "Checkout cancelled.");
      setBoostMessageIsError(false);
    } else if (checkout === "pending") {
      setBoostError(locale === "fr" ? "Le paiement est en cours de confirmation. Le boost sera activé dès réception." : "Payment is being confirmed. The boost will activate once received.");
      setBoostMessageIsError(false);
    }
  }, [locale]);
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["projects", "mine", page],
    queryFn: async () => {
      const res = await fetch(`/api/projects?mine=1&page=${page}`);
      if (!res.ok) throw new Error("projects_load_failed");
      const json = await res.json();
      return json as ProjectsResponse;
    },
    placeholderData: keepPreviousData,
  });
  const projects = data?.projects ?? [];

  async function boostProject(projectId: string) {
    setBoostingId(projectId);
    setBoostError("");
    setBoostMessageIsError(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "boost", projectId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "checkout_failed");
      await openPaddleCheckout(result.transactionId, result.customerEmail, result.successUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setBoostError(code === "BILLING_NOT_CONFIGURED"
        ? (locale === "fr" ? "Paddle n’est pas configuré pour les paiements." : "Paddle payments are not configured.")
        : (locale === "fr" ? "Impossible de lancer le paiement du boost." : "Couldn't start boost checkout."));
      setBoostingId("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="section-title">{t("projects.title")}</h1>
        <Link href="/projects/new" className="btn-gold">
          <Plus className="h-4 w-4" />
          {t("projects.newProject")}
        </Link>
      </header>
      {boostError && <p role={boostMessageIsError ? "alert" : "status"} className={`border-l-2 px-3 py-2 text-xs ${boostMessageIsError ? "border-rose-400 text-rose-300" : "border-emerald-400 text-emerald-300"}`}>{boostError}</p>}

      {isLoading ? (
        <ProjectsListSkeleton />
      ) : isError ? (
        <p role="alert" className="card p-5 text-sm text-rose-300">
          {locale === "fr" ? "Impossible de charger les projets. Réessayez." : "Couldn't load projects. Please try again."}
        </p>
      ) : !projects.length ? (
        <div className="card p-10 text-center text-sm text-ink-muted">{t("projects.empty")}</div>
      ) : (
        <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy={isFetching}>
          {projects.map((project) => {
            const identityName = project.parentTeam?.teamName?.trim()
              || project.parentTeam?.title
              || project.creator.name
              || project.creator.handle
              || (locale === "fr" ? "Créateur" : "Maker");
            const identityImage = project.parentTeam ? project.parentTeam.logoUrl : project.creator.image;
            const identityHref = project.parentTeam
              ? `/teams/${project.parentTeam.id}`
              : `/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`;
            const teamName = project.parentTeam?.teamName?.trim() || project.parentTeam?.title;
            const showTeamName = Boolean(teamName && teamName.toLowerCase() !== project.title.trim().toLowerCase());

            return (
              <article key={project.id} className="card overflow-hidden transition hover:border-gold/30">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4">
                  <Link href={identityHref} aria-label={identityName} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
                    <Avatar src={identityImage} name={identityName} size={36} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={identityHref} className="block truncate text-[13px] font-semibold text-ink transition hover:text-gold-soft">{identityName}</Link>
                    <p className="mt-0.5 text-[10px] text-ink-muted">{locale === "fr" ? (project.parentTeam ? "Équipe du projet" : "Créateur du projet") : (project.parentTeam ? "Project team" : "Project creator")}</p>
                  </div>
                  {project.isFeatured && <span className="badge-gold shrink-0 text-[10px]">{locale === "fr" ? "À la une" : "Featured"}</span>}
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
                    <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
                      {locale === "fr" ? "Projet" : "Project"}
                    </span>
                    <span className={`rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${project.status === "LAUNCHED" ? "text-emerald-200" : project.status === "DEVELOPMENT" ? "text-sky-200" : "text-white/90"}`}>
                      {t(`projects.status.${project.status}`)}
                    </span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-3.5 sm:p-4">
                    {project.logoUrl && (
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-black/30 shadow-lg">
                        <Image src={project.logoUrl} alt="" fill sizes="56px" unoptimized className="object-cover" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-semibold tracking-tight text-white drop-shadow sm:text-xl">{project.title}</span>
                      {showTeamName && <span className="mt-0.5 block truncate text-[11px] font-medium text-white/75">{teamName}</span>}
                    </span>
                  </span>
                </Link>

                <div className="space-y-2.5 p-3">
                  <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{project.tagline}</p>
                  {project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.techStack.slice(0, 4).map((tech) => <span key={tech} className="badge">{tech}</span>)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] text-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" aria-hidden="true" />{project._count.collaborators} {t("projects.collaborators").toLowerCase()}</span>
                    <span>{project._count.posts} posts</span>
                    <span className="ml-auto flex items-center gap-3">
                      {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" aria-label="GitHub" className="text-ink-muted transition hover:text-gold"><Github className="h-4 w-4" /></a>}
                      {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={locale === "fr" ? "Projet en ligne" : "Live project"} className="text-ink-muted transition hover:text-gold"><ExternalLink className="h-4 w-4" /></a>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-2.5">
                    <Link href={`/projects/${project.id}`} className="text-[11px] font-semibold text-gold-soft transition hover:text-gold-bright">
                      {locale === "fr" ? "Ouvrir le projet" : "Open project"} <span aria-hidden="true">→</span>
                    </Link>
                    <button type="button" onClick={() => boostProject(project.id)} disabled={project.activeBoost || boostingId !== ""} className="btn-gold !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px]">
                      {boostingId === project.id ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Megaphone className="h-3 w-3" aria-hidden="true" />}
                      {project.activeBoost ? (locale === "fr" ? "En avant" : "Boost active") : (locale === "fr" ? "Mettre en avant · 5 $ / 7 jours" : "Boost · $5 / 7 days")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {data && data.pagination.pageCount > 1 && (
          <nav aria-label={t("projects.paginationLabel")} className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border pt-4">
            <p className="text-xs text-ink-muted">
              {t("projects.paginationSummary", {
                start: String((data.pagination.page - 1) * data.pagination.pageSize + 1),
                end: String(Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)),
                total: String(data.pagination.total),
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.pagination.page <= 1 || isFetching}
                className="btn-ghost !min-h-9 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />{t("projects.previousPage")}
              </button>
              <span className="min-w-16 text-center text-xs tabular-nums text-ink-muted">
                {t("projects.paginationPage", { page: String(data.pagination.page), pages: String(data.pagination.pageCount) })}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={data.pagination.page >= data.pagination.pageCount || isFetching}
                className="btn-ghost !min-h-9 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("projects.nextPage")}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
        </>
      )}
    </div>
  );
}
