"use client";

import { useEffect, useMemo, useState } from "react";
import CoBuilding from "@/co-building/CoBuilding";
import { useTranslation } from "@/lib/i18n";

type Props = {
  projectId: string;
  isOwner: boolean;
  title: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  githubUrl: string | null;
  className?: string;
};

type SessionData = {
  ticket: string;
  websocketUrl: string;
  user: { id: string; name: string; image: string | null };
};

export function ProjectCoBuilding({ projectId, isOwner, title, tagline, description, logoUrl, githubUrl, className }: Props) {
  const { locale } = useTranslation();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const isFrench = locale === "fr";

  useEffect(() => {
    setClientId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const controller = new AbortController();
    setSession(null);
    setError(false);

    void fetch(`/api/projects/${projectId}/co-building/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("co_building_session_unavailable");
        return await response.json() as SessionData;
      })
      .then(setSession)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(true);
      });

    return () => controller.abort();
  }, [clientId, projectId, attempt]);

  const initialFiles = useMemo(() => ({
    "README.md": [
      `# ${title}`,
      "",
      tagline,
      "",
      "## À propos / About",
      description.slice(0, 2_000),
    ].join("\n"),
    "decisions.md": `# ${isFrench ? "Notes et décisions" : "Notes and decisions"}\n\n`,
  }), [description, isFrench, tagline, title]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
        <p role="alert" className="text-sm text-rose-200">
          {isFrench
            ? "Impossible de rejoindre l’espace de co-building. Vérifiez la connexion puis réessayez."
            : "Could not join the co-building workspace. Check your connection and try again."}
        </p>
        <button type="button" onClick={() => setAttempt((current) => current + 1)} className="btn-ghost mt-3 !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
          {isFrench ? "Réessayer" : "Try again"}
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex h-full min-h-[320px] w-full flex-col gap-3 rounded-xl border border-midnight-border bg-midnight-deep p-3 sm:p-4"
        aria-label={isFrench ? "Connexion à l’espace collaboratif" : "Connecting to the collaborative workspace"}
        aria-busy="true"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-40 max-w-[45vw]" />
            <div className="skeleton h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-24 rounded-lg" />
            <div className="skeleton h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(150px,220px)_minmax(0,1fr)]">
          <div className="hidden min-h-0 flex-col gap-3 rounded-xl border border-midnight-border bg-midnight/40 p-3 lg:flex">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-7 w-full rounded-md" />
              <div className="skeleton h-7 w-4/5 rounded-md" />
              <div className="skeleton h-7 w-11/12 rounded-md" />
            </div>
          </div>
          <div className="flex min-h-[260px] min-w-0 flex-col overflow-hidden rounded-xl border border-midnight-border bg-midnight/40">
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
    );
  }

  return (
    <CoBuilding
      key={projectId}
      projectId={projectId}
      isOwner={isOwner}
      isFrench={isFrench}
      roomId={projectId}
      user={session.user}
      projectLogoUrl={logoUrl}
      ticket={session.ticket}
      wsUrl={session.websocketUrl}
      title={isFrench ? `Espace projet · ${title}` : `Project workspace · ${title}`}
      initialFiles={initialFiles}
      initialTasks={[]}
      githubUrl={githubUrl ?? undefined}
      className={className}
    />
  );
}
