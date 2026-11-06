"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { AdminModerationSkeleton } from "@/components/skeletons";

type ModerationCase = {
  id: string;
  category: string;
  status: "OPEN" | "CONFIRMED" | "DISMISSED";
  confidence: number;
  reason: string;
  createdAt: string;
  subject: {
    id: string;
    name: string | null;
    handle: string | null;
    email: string;
    accountStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
    suspendedUntil: string | null;
  };
  post: {
    id: string;
    type: string;
    content: string;
    tags: string[];
    createdAt: string;
    moderationStatus: string;
    team: { id: string; teamName: string | null; title: string } | null;
    project: {
      id: string;
      teamName: string | null;
      title: string;
      parentTeam: { id: string; teamName: string | null; title: string } | null;
    } | null;
  };
};

type ModerationResponse = {
  cases: ModerationCase[];
  counts: { OPEN: number; CONFIRMED: number; DISMISSED: number };
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

type ReviewAction = "DISMISS" | "CONFIRM" | "SUSPEND" | "BAN";

export function AdminModerationSection() {
  const queryClient = useQueryClient();
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const [status, setStatus] = useState<"OPEN" | "CONFIRMED" | "DISMISSED">("OPEN");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ModerationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/moderation?status=${status}&page=${page}`);
      if (!response.ok) throw new Error("MODERATION_LOAD_FAILED");
      setData(await response.json() as ModerationResponse);
    } catch {
      setError(isFrench ? "Impossible de charger les dossiers de modération." : "Couldn't load moderation cases.");
    } finally {
      setLoading(false);
    }
  }, [isFrench, page, status]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  async function reviewCase(moderationCase: ModerationCase, action: ReviewAction) {
    if (action === "BAN" && !window.confirm(isFrench ? "Bannir définitivement ce compte ?" : "Permanently ban this account?")) return;
    if (action === "SUSPEND" && !window.confirm(isFrench ? "Suspendre ce compte pendant 7 jours ?" : "Suspend this account for 7 days?")) return;

    setBusyCaseId(moderationCase.id);
    setError("");
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          caseId: moderationCase.id,
          ...(action === "SUSPEND" ? { days: 7 } : {}),
        }),
      });
      if (!response.ok) throw new Error("MODERATION_REVIEW_FAILED");
      await Promise.all([
        loadCases(),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
    } catch {
      setError(isFrench ? "Cette action n’a pas pu être enregistrée. Actualisez et réessayez." : "This action couldn't be saved. Refresh and try again.");
    } finally {
      setBusyCaseId(null);
    }
  }

  const tabs = [
    { value: "OPEN" as const, label: isFrench ? "À examiner" : "Needs review" },
    { value: "CONFIRMED" as const, label: isFrench ? "Confirmés" : "Confirmed" },
    { value: "DISMISSED" as const, label: isFrench ? "Écartés" : "Dismissed" },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{isFrench ? "Modération automatique" : "Automated moderation"}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            {isFrench
              ? "Examinez les publications retenues pour vente directe, contenu sexuel, harcèlement, provocation ou hors-sujet. Les décisions de sanction sont enregistrées dans l’audit."
              : "Review posts flagged for direct sales, sexual content, harassment, provocation, or off-topic content. Sanction decisions are recorded in the audit log."}
          </p>
        </div>
        <button type="button" onClick={() => void loadCases()} disabled={loading} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">
          {isFrench ? "Actualiser" : "Refresh"}
        </button>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          { status: "OPEN" as const, label: isFrench ? "En attente" : "Open", color: "text-amber-300" },
          { status: "CONFIRMED" as const, label: isFrench ? "Confirmés" : "Confirmed", color: "text-rose-300" },
          { status: "DISMISSED" as const, label: isFrench ? "Écartés" : "Dismissed", color: "text-emerald-300" },
        ].map(({ status: caseStatus, label, color }) => (
          <div key={caseStatus} className="card p-4">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>
              {data ? data.counts[caseStatus].toLocaleString(isFrench ? "fr-FR" : "en-US") : <span className="skeleton inline-block h-7 w-12 align-middle" />}
            </dd>
          </div>
        ))}
      </dl>

      <nav className="flex gap-2 overflow-x-auto border-b border-midnight-border" aria-label={isFrench ? "Filtrer les dossiers" : "Filter cases"}>
        {tabs.map((tab) => (
          <button key={tab.value} type="button" onClick={() => { setStatus(tab.value); setPage(1); }} aria-pressed={status === tab.value} className={`shrink-0 border-b-2 px-3 py-2 text-sm ${status === tab.value ? "border-gold text-gold-soft" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {tab.label}{data ? ` · ${data.counts[tab.value]}` : ""}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {loading ? (
        <div role="status"><AdminModerationSkeleton showActions={status === "OPEN"} /></div>
      ) : data?.cases.length ? (
        <div className="space-y-4">
          {data.cases.map((moderationCase) => {
            const team = moderationCase.post.team ?? moderationCase.post.project?.parentTeam ?? null;
            const project = moderationCase.post.project;
            return (
              <article key={moderationCase.id} className="card space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{moderationCase.category.replaceAll("_", " ")}</h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {moderationCase.subject.handle ? `@${moderationCase.subject.handle}` : moderationCase.subject.name ?? moderationCase.subject.email}
                      {" · "}{moderationCase.confidence}%{" · "}{new Date(moderationCase.createdAt).toLocaleString(isFrench ? "fr-FR" : "en-US")}
                    </p>
                    {(team || project) && <p className="mt-1 text-xs text-gold-soft">{isFrench ? "Équipe/projet :" : "Team/project:"} {team?.teamName ?? team?.title ?? project?.teamName ?? project?.title}</p>}
                  </div>
                  <span className={`badge ${moderationCase.subject.accountStatus !== "ACTIVE" ? "text-rose-300" : ""}`}>
                    {moderationCase.subject.accountStatus === "ACTIVE"
                      ? (isFrench ? "Compte actif" : "Account active")
                      : moderationCase.subject.accountStatus === "BANNED"
                        ? (isFrench ? "Banni" : "Banned")
                        : (isFrench ? "Suspendu" : "Suspended")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words rounded-xl border border-midnight-border bg-midnight-deep/40 p-4 text-sm leading-6 text-ink">{moderationCase.post.content}</p>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-xs leading-5 text-ink-muted">{moderationCase.reason}</p>
                  <p className="text-[11px] text-ink-muted">{moderationCase.post.type}{moderationCase.post.tags.length ? ` · ${moderationCase.post.tags.join(", ")}` : ""}</p>
                </div>
                {moderationCase.status === "OPEN" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" disabled={busyCaseId === moderationCase.id} onClick={() => void reviewCase(moderationCase, "DISMISS")} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">
                      {busyCaseId === moderationCase.id ? (isFrench ? "Enregistrement…" : "Saving…") : (isFrench ? "Écarter et publier" : "Dismiss and publish")}
                    </button>
                    <button type="button" disabled={busyCaseId === moderationCase.id} onClick={() => void reviewCase(moderationCase, "CONFIRM")} className="btn-ghost px-3 py-2 text-xs disabled:opacity-50">
                      {busyCaseId === moderationCase.id ? (isFrench ? "Enregistrement…" : "Saving…") : (isFrench ? "Confirmer et masquer" : "Confirm and hide")}
                    </button>
                    <button type="button" disabled={busyCaseId === moderationCase.id} onClick={() => void reviewCase(moderationCase, "SUSPEND")} className="btn-ghost px-3 py-2 text-xs text-amber-300 disabled:opacity-50">
                      {busyCaseId === moderationCase.id ? (isFrench ? "Enregistrement…" : "Saving…") : (isFrench ? "Suspendre 7 jours" : "Suspend 7 days")}
                    </button>
                    <button type="button" disabled={busyCaseId === moderationCase.id} onClick={() => void reviewCase(moderationCase, "BAN")} className="btn-ghost px-3 py-2 text-xs text-rose-300 disabled:opacity-50">
                      {busyCaseId === moderationCase.id ? (isFrench ? "Enregistrement…" : "Saving…") : (isFrench ? "Bannir" : "Ban")}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">
          {isFrench ? "Aucun dossier dans cette catégorie." : "No cases in this category."}
        </p>
      )}

      {data && data.pagination.pages > 1 && (
        <nav className="flex items-center justify-between text-sm text-ink-muted" aria-label={isFrench ? "Pagination des dossiers" : "Case pagination"}>
          <span>{isFrench ? `Page ${page} sur ${data.pagination.pages}` : `Page ${page} of ${data.pagination.pages}`}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="btn-outline px-3 py-2 text-xs disabled:opacity-40">{isFrench ? "Précédent" : "Previous"}</button>
            <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((current) => current + 1)} className="btn-outline px-3 py-2 text-xs disabled:opacity-40">{isFrench ? "Suivant" : "Next"}</button>
          </div>
        </nav>
      )}
    </section>
  );
}
