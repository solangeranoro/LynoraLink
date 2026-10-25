"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Handshake, MessageCircle } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { ActiveMakersSkeleton } from "@/components/skeletons";

interface Maker {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  skills: string[];
  isOnline: boolean;
  openToCoBuild: boolean;
}
type Association = { id: string; requesterId: string; addresseeId: string; status: "PENDING" | "ACCEPTED" | "REJECTED" };
type MakerProject = { lookingFor: string[] };

const roleSkillHints: Record<string, string[]> = {
  CO_BUILDER: ["co-builder", "builder", "founder", "startup"],
  DESIGNER: ["design", "figma", "ux", "ui", "visual"],
  MARKETER: ["marketing", "growth", "seo", "content", "community"],
  DEVELOPER: ["developer", "engineer", "programming", "javascript", "typescript", "react", "python", "backend", "frontend"],
  PRODUCT: ["product", "product manager", "roadmap", "strategy"],
};

function matchedRoles(maker: Maker, roles: string[]) {
  const makerSkills = [...maker.skills, maker.headline ?? ""].map((skill) => skill.toLowerCase());
  return roles.filter((role) => (roleSkillHints[role] ?? [role.toLowerCase()]).some((hint) => makerSkills.some((skill) => skill.includes(hint))));
}

async function fetchMakers(): Promise<Maker[]> {
  const res = await fetch("/api/makers");
  if (!res.ok) throw new Error("Failed to load makers");
  const data = await res.json();
  return data.makers;
}

export function ActiveMakers() {
  const { t } = useTranslation();
  const { showToast } = useActionToast();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  const { data, isLoading, isError } = useQuery({ queryKey: ["makers"], queryFn: fetchMakers, refetchInterval: 30_000 });
  const { data: myProjects = [] } = useQuery({
    queryKey: ["projects", "maker-match", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/projects?mine=1");
      if (!response.ok) throw new Error("projects_load_failed");
      return (await response.json()).projects as MakerProject[];
    },
  });
  const { data: associationData } = useQuery({
    queryKey: ["associations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/associations");
      if (!response.ok) throw new Error("associations_load_failed");
      return response.json() as Promise<{ associations: Association[] }>;
    },
  });
  const associationMutation = useMutation({
    mutationFn: async ({ makerId, association }: { makerId: string; association?: Association }) => {
      const response = association?.status === "PENDING" && association.addresseeId === userId
        ? await fetch(`/api/associations/${association.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACCEPTED" }) })
        : await fetch("/api/associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresseeId: makerId }) });
      if (!response.ok) throw new Error("association_failed");
      return response.json();
    },
    onSuccess: (_result, { association }) => {
      if (!(association?.status === "PENDING" && association.addresseeId === userId)) {
        showToast(t("makers.associationSent"));
      }
      return queryClient.invalidateQueries({ queryKey: ["associations", userId] });
    },
  });
  const messageMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (!response.ok) throw new Error("conversation_create_failed");
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: ({ id }) => router.push(`/messages?conversationId=${id}`),
  });

  if (isLoading) return <ActiveMakersSkeleton />;

  const makers = (data ?? []).filter((maker) => maker.id !== userId);
  const rolesNeeded = Array.from(new Set(myProjects.flatMap((project) => project.lookingFor)));
  const associations = associationData?.associations ?? [];
  const suggestions = makers.filter((maker) => !associations.some((association) => (
    association.status === "ACCEPTED"
    && ((association.requesterId === userId && association.addresseeId === maker.id)
      || (association.requesterId === maker.id && association.addresseeId === userId))
  )));
  const rankedMakers = [...suggestions]
    .sort((first, second) => matchedRoles(second, rolesNeeded).length - matchedRoles(first, rolesNeeded).length)
    .slice(0, 4);

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-midnight-border pb-3.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300/90">{t("makers.title")}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Makers match</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {suggestions.length}
        </span>
      </div>

      {isError || rankedMakers.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("makers.empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {rankedMakers.map((maker) => {
            const matchingRoles = matchedRoles(maker, rolesNeeded);
            const association = associations.find((item) => (
              (item.requesterId === userId && item.addresseeId === maker.id) ||
              (item.requesterId === maker.id && item.addresseeId === userId)
            ));
            const isIncoming = association?.status === "PENDING" && association.addresseeId === userId;
            const associationLabel = association?.status === "ACCEPTED"
              ? t("makers.associated")
              : isIncoming
                ? t("makers.acceptAssociation")
                : association?.status === "PENDING"
                  ? t("makers.associationSent")
                  : t("makers.associate");
            return (
              <li key={maker.id} className="rounded-xl border border-midnight-border/70 bg-midnight-deep/45 p-2.5">
                <div className="flex items-center gap-2.5">
                  <Link
                    href={`/makers/${encodeURIComponent(maker.handle ?? maker.id)}`}
                    aria-label={t("feed.viewProfile", { name: maker.name ?? maker.handle ?? "Maker" })}
                    className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  >
                    <Avatar src={maker.image} name={maker.name} online={maker.isOnline} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/makers/${encodeURIComponent(maker.handle ?? maker.id)}`}
                        className="truncate text-sm font-semibold text-ink transition hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                      >
                        {maker.name ?? maker.handle}
                      </Link>
                      {maker.openToCoBuild && <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">Open</span>}
                    </div>
                    <p className={`truncate text-[11px] ${maker.openToCoBuild ? "text-emerald-300" : "text-ink-muted"}`}>
                      {maker.openToCoBuild ? t("makers.brainstormAvailability") : maker.headline ?? `@${maker.handle}`}
                    </p>
                    {matchingRoles.length > 0 && (
                      <p className="mt-1 truncate text-[10px] font-medium text-gold-soft">
                        {t("makers.complementaryMatch")}: {matchingRoles.map((role) => t(`projects.roles.${role}`)).join(", ")}
                      </p>
                    )}
                    {maker.skills.length > 0 && (
                      <p className="mt-1 truncate text-[10px] text-ink-muted">{maker.skills.slice(0, 3).join(" · ")}</p>
                    )}
                  </div>
                  {userId && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {association?.status !== "ACCEPTED" && (
                        <button
                          type="button"
                          title={associationLabel}
                          aria-label={`${associationLabel}: ${maker.name ?? maker.handle ?? "Maker"}`}
                          onClick={() => associationMutation.mutate({ makerId: maker.id, association })}
                          disabled={associationMutation.isPending || (association?.status === "PENDING" && !isIncoming)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-border/70 bg-midnight-card/50 text-ink-muted transition hover:border-gold/40 hover:text-gold-soft disabled:cursor-default disabled:opacity-60"
                        >
                          <Handshake size={15} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        title={t("makers.startConversation")}
                        aria-label={`${t("makers.startConversation")}: ${maker.name ?? maker.handle ?? "Maker"}`}
                        onClick={() => messageMutation.mutate(maker.id)}
                        disabled={messageMutation.isPending}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-border/70 bg-midnight-card/50 text-ink-muted transition hover:border-gold/40 hover:text-gold-soft disabled:opacity-60"
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/makers" className="btn-ghost mt-3 w-full !min-h-9 !rounded-lg !py-2 text-xs">
        {t("makers.viewAll")}
      </Link>
      {(associationMutation.isError || messageMutation.isError) && <p role="alert" className="mt-3 text-xs text-rose-300">{t("makers.actionError")}</p>}
    </div>
  );
}

export default ActiveMakers;
