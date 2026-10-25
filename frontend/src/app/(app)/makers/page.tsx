"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, Check, Handshake, MessageCircle, X } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { useTranslation } from "@/lib/i18n";
import { MakersDirectorySkeleton } from "@/components/skeletons";

const PAGE_SIZE = 9;

type Maker = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  skills: string[];
  isOnline: boolean;
  openToCoBuild: boolean;
};
type AssociationPerson = Pick<Maker, "id" | "name" | "image" | "handle" | "headline" | "skills" | "openToCoBuild">;
type Association = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  requester: AssociationPerson;
  addressee: AssociationPerson;
};

export default function MakersDirectoryPage() {
  const { t } = useTranslation();
  const { showToast } = useActionToast();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = session?.user?.id;
  const [associatedPage, setAssociatedPage] = useState(0);
  const [incomingPage, setIncomingPage] = useState(0);
  const [outgoingPage, setOutgoingPage] = useState(0);
  const [suggestionsPage, setSuggestionsPage] = useState(0);

  const makersQuery = useQuery({
    queryKey: ["makers", "directory", suggestionsPage],
    queryFn: async () => {
      const response = await fetch(`/api/makers?all=1&take=${PAGE_SIZE}&skip=${suggestionsPage * PAGE_SIZE}`);
      if (!response.ok) throw new Error("makers_load_failed");
      return await response.json() as { makers: Maker[]; hasMore: boolean };
    },
  });
  const associationsQuery = useQuery({
    queryKey: ["associations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/associations");
      if (!response.ok) throw new Error("associations_load_failed");
      return await response.json() as { associations: Association[] };
    },
  });
  const associationMutation = useMutation({
    mutationFn: async ({ maker, association, status }: { maker: Maker | AssociationPerson; association?: Association; status?: "ACCEPTED" | "REJECTED" }) => {
      const incoming = association?.status === "PENDING" && association.addresseeId === userId;
      const response = incoming
        ? await fetch(`/api/associations/${association.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: status ?? "ACCEPTED" }),
          })
        : await fetch("/api/associations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addresseeId: maker.id }),
          });
      if (!response.ok) throw new Error("association_failed");
      return { incoming, status: status ?? "PENDING" };
    },
    onSuccess: async ({ incoming, status }) => {
      if (!incoming && status === "PENDING") showToast(t("makers.associationSent"));
      await queryClient.invalidateQueries({ queryKey: ["associations", userId] });
      await queryClient.invalidateQueries({ queryKey: ["navigation-counts", userId] });
    },
  });
  const disassociateMutation = useMutation({
    mutationFn: async (associationId: string) => {
      const response = await fetch(`/api/associations/${associationId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("association_remove_failed");
    },
    onSuccess: async () => {
      showToast(t("makers.disassociated"));
      await queryClient.invalidateQueries({ queryKey: ["associations", userId] });
      await queryClient.invalidateQueries({ queryKey: ["navigation-counts", userId] });
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
      return await response.json() as { id: string };
    },
    onSuccess: ({ id }) => router.push(`/messages?conversationId=${id}`),
  });

  const associations = associationsQuery.data?.associations ?? [];
  const associatedPeople = Array.from(new Map(
    associations
      .filter((association) => association.status === "ACCEPTED")
      .map((association) => {
        const person = association.requesterId === userId ? association.addressee : association.requester;
        return [person.id, person] as const;
      }),
  ).values());
  const incomingRequests = associations.filter((association) => (
    association.status === "PENDING" && association.addresseeId === userId
  ));
  const outgoingRequests = associations.filter((association) => (
    association.status === "PENDING" && association.requesterId === userId
  ));
  const suggestions = (makersQuery.data?.makers ?? []).filter((maker) => (
    maker.id !== userId && !associations.some((association) => (
      (association.requesterId === userId && association.addresseeId === maker.id)
      || (association.requesterId === maker.id && association.addresseeId === userId)
    ))
  ));
  const associatedPageCount = Math.ceil(associatedPeople.length / PAGE_SIZE);
  const incomingPageCount = Math.ceil(incomingRequests.length / PAGE_SIZE);
  const outgoingPageCount = Math.ceil(outgoingRequests.length / PAGE_SIZE);
  const visibleAssociatedPeople = associatedPeople.slice(associatedPage * PAGE_SIZE, (associatedPage + 1) * PAGE_SIZE);
  const visibleIncomingRequests = incomingRequests.slice(incomingPage * PAGE_SIZE, (incomingPage + 1) * PAGE_SIZE);
  const visibleOutgoingRequests = outgoingRequests.slice(outgoingPage * PAGE_SIZE, (outgoingPage + 1) * PAGE_SIZE);

  function renderPagination(
    label: string,
    page: number,
    pageCount: number,
    setPage: (update: (current: number) => number) => void,
    hasMore = page < pageCount - 1,
  ) {
    if (pageCount <= 1 && page === 0 && !hasMore) return null;
    return (
      <nav aria-label={label} className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="btn-ghost !min-h-9 !rounded-lg !py-2 text-xs disabled:opacity-40">
          <ArrowLeft size={14} aria-hidden="true" />{t("common.previous")}
        </button>
        <span aria-live="polite" className="text-xs text-ink-muted">{t("common.page")} {page + 1}{pageCount > 0 ? ` / ${pageCount}` : ""}</span>
        <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!hasMore} className="btn-ghost !min-h-9 !rounded-lg !py-2 text-xs disabled:opacity-40">
          {t("common.next")}<ArrowRight size={14} aria-hidden="true" />
        </button>
      </nav>
    );
  }

  function renderPerson(maker: Maker | AssociationPerson, associated: boolean) {
    const association = associations.find((item) => (
      (item.requesterId === userId && item.addresseeId === maker.id)
      || (item.requesterId === maker.id && item.addresseeId === userId)
    ));
    const incoming = association?.status === "PENDING" && association.addresseeId === userId;
    const label = association?.status === "ACCEPTED"
      ? t("makers.associated")
      : incoming
        ? t("makers.acceptAssociation")
        : association?.status === "PENDING"
          ? t("makers.associationSent")
          : t("makers.associate");
    const profileHref = `/makers/${encodeURIComponent(maker.handle ?? maker.id)}`;

    return (
      <article key={maker.id} className="group flex min-w-0 flex-col gap-4 rounded-xl border border-midnight-border bg-midnight-card/70 p-4 transition-colors hover:border-gold/30 hover:bg-midnight-card">
        <Link href={profileHref} aria-label={t("feed.viewProfile", { name: maker.name ?? maker.handle ?? "Maker" })} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
          <Avatar src={maker.image} name={maker.name} size={42} online={"isOnline" in maker ? maker.isOnline : undefined} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink group-hover:text-gold-soft">{maker.name ?? maker.handle ?? "Maker"}</span>
            {maker.handle && <span className="block truncate text-xs text-ink-muted">@{maker.handle}</span>}
          </span>
        </Link>
        <div className="min-h-14 min-w-0 flex-1">
          {maker.headline && <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{maker.headline}</p>}
          {maker.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {maker.skills.slice(0, 2).map((skill) => (
                <span key={skill} className="max-w-full truncate rounded-md border border-midnight-border bg-midnight/40 px-2 py-1 text-[10px] text-gold-soft">{skill}</span>
              ))}
            </div>
          )}
          {maker.openToCoBuild && <span className="mt-2 inline-flex rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">{t("makers.openForCoBuilding")}</span>}
        </div>
        <div className="flex items-center gap-2 border-t border-midnight-border/70 pt-3">
          {associated && association?.status === "ACCEPTED" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("makers.confirmDisassociate", { name: maker.name ?? maker.handle ?? "Maker" }))) {
                  disassociateMutation.mutate(association.id);
                }
              }}
              disabled={disassociateMutation.isPending}
              className="btn min-w-0 flex-1 !min-h-9 !rounded-lg !border !border-rose-400/30 !bg-rose-400/10 !px-2 !py-2 !text-xs !text-rose-300 hover:!border-rose-400/50 hover:!bg-rose-400/20"
            >
              <X size={14} aria-hidden="true" />{t("makers.disassociate")}
            </button>
          )}
          {!associated && (
            incoming ? (
              <>
                <button type="button" onClick={() => associationMutation.mutate({ maker, association, status: "ACCEPTED" })} disabled={associationMutation.isPending} className="btn min-w-0 flex-1 !min-h-9 !rounded-lg !border !border-emerald-400/30 !bg-emerald-400/10 !px-2 !py-2 !text-xs !text-emerald-300 hover:!border-emerald-400/50 hover:!bg-emerald-400/20">
                  <Check size={14} aria-hidden="true" />{t("notifications.accept")}
                </button>
                <button type="button" onClick={() => associationMutation.mutate({ maker, association, status: "REJECTED" })} disabled={associationMutation.isPending} className="btn min-w-0 flex-1 !min-h-9 !rounded-lg !border !border-rose-400/30 !bg-rose-400/10 !px-2 !py-2 !text-xs !text-rose-300 hover:!border-rose-400/50 hover:!bg-rose-400/20">
                  <X size={14} aria-hidden="true" />{t("notifications.decline")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => associationMutation.mutate({ maker, association })}
                disabled={associationMutation.isPending || association?.status === "PENDING"}
                className="btn min-w-0 flex-1 !min-h-9 !rounded-lg !border !border-teal-400/30 !bg-teal-400/10 !px-2 !py-2 !text-xs !text-teal-300 hover:!border-teal-400/50 hover:!bg-teal-400/20"
              >
                <Handshake size={14} aria-hidden="true" />{label}
              </button>
            )
          )}
          <button type="button" onClick={() => messageMutation.mutate(maker.id)} disabled={messageMutation.isPending} aria-label={`${t("makers.startConversation")}: ${maker.name ?? maker.handle ?? "Maker"}`} className="btn min-w-0 flex-1 !min-h-9 !whitespace-nowrap !rounded-lg !border !border-sky-400/30 !bg-sky-400/10 !px-2 !py-2 !text-xs !text-sky-300 hover:!border-sky-400/50 hover:!bg-sky-400/20">
            <MessageCircle size={14} aria-hidden="true" />
            <span>{t("makers.startConversation")}</span>
          </button>
        </div>
      </article>
    );
  }

  if (makersQuery.isLoading || associationsQuery.isLoading) {
    return <MakersDirectorySkeleton />;
  }

  if (makersQuery.isError || associationsQuery.isError) {
    return <section role="alert" className="card mx-auto max-w-3xl p-6 text-sm text-rose-300">{t("makers.directoryLoadError")}</section>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/dashboard" className="mb-3 inline-flex min-h-9 items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={15} aria-hidden="true" />{t("nav.dashboard")}</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{t("makers.directoryTitle")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("makers.directoryDescription")}</p>
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="associated-makers-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="associated-makers-title" className="section-title text-lg">{t("makers.associatedPeople")}</h2>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gold/25 bg-gold/10 px-2 text-xs font-semibold tabular-nums text-gold-soft">{associatedPeople.length}</span>
        </div>
        {associatedPeople.length ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">{visibleAssociatedPeople.map((maker) => renderPerson(maker, true))}</div>
            {renderPagination(t("makers.associatedPeople"), associatedPage, associatedPageCount, setAssociatedPage)}
          </>
        ) : (
          <div className="card p-5 text-sm text-ink-muted">{t("makers.noAssociatedPeople")}</div>
        )}
      </section>

      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <section className="space-y-5" aria-labelledby="pending-requests-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pending-requests-title" className="section-title text-lg">{t("makers.pendingRequestsTitle")}</h2>
          </div>
          {incomingRequests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">{t("makers.incomingRequestsTitle")}</h3>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2 text-xs font-semibold tabular-nums text-amber-300">{incomingRequests.length}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {visibleIncomingRequests.map((association) => renderPerson(association.requester, false))}
              </div>
              {renderPagination(t("makers.incomingRequestsTitle"), incomingPage, incomingPageCount, setIncomingPage)}
            </div>
          )}
          {outgoingRequests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">{t("makers.outgoingRequestsTitle")}</h3>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/10 px-2 text-xs font-semibold tabular-nums text-teal-300">{outgoingRequests.length}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {visibleOutgoingRequests.map((association) => renderPerson(association.addressee, false))}
              </div>
              {renderPagination(t("makers.outgoingRequestsTitle"), outgoingPage, outgoingPageCount, setOutgoingPage)}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="suggested-makers-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="suggested-makers-title" className="section-title text-lg">{t("makers.suggestionsTitle")}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t("makers.directorySuggestionsDescription")}</p>
          </div>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-midnight-border bg-midnight-card px-2 text-xs font-semibold tabular-nums text-ink-muted">{suggestions.length}</span>
        </div>
        {suggestions.length ? (
          <div className="grid gap-3 lg:grid-cols-3">{suggestions.map((maker) => renderPerson(maker, false))}</div>
        ) : (
          !makersQuery.data?.hasMore && <div className="card p-5 text-sm text-ink-muted">{t("makers.empty")}</div>
        )}
        {renderPagination(t("makers.suggestionsTitle"), suggestionsPage, 0, setSuggestionsPage, Boolean(makersQuery.data?.hasMore))}
      </section>

      {(associationMutation.isError || disassociateMutation.isError || messageMutation.isError) && <p role="alert" className="text-sm text-rose-300">{t("makers.actionError")}</p>}
    </div>
  );
}
