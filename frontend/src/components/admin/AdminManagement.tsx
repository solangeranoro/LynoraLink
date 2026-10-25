"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, FolderKanban, PackagePlus, UsersRound } from "@/components/FontAwesomeIcons";
import { formatUsd } from "@/lib/utils";

type AdminSection = "marketplace" | "posts" | "projects" | "teams";
type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type AdminRow = {
  id: string;
  title?: string;
  teamName?: string | null;
  description?: string;
  teamDescription?: string | null;
  imageUrl?: string | null;
  content?: string;
  tagline?: string;
  coverUrl?: string | null;
  logoUrl?: string | null;
  type?: string;
  status?: string;
  moderationStatus: ReviewStatus;
  priceCents?: number;
  currency?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  isTeamVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
  seller?: { name: string | null; email: string; handle: string | null };
  author?: { name: string | null; handle: string | null };
  creator?: { name: string | null; handle: string | null };
  poll?: { id: string; type: string; question: string; _count: { votes: number } } | null;
  _count?: { orders?: number; reports?: number; likes?: number; comments?: number; collaborators?: number; posts?: number; teamPosts?: number; tasks?: number; teamProjects?: number };
};
type PageData = {
  items?: AdminRow[];
  posts?: AdminRow[];
  projects?: AdminRow[];
  teams?: AdminRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  statusCounts?: Partial<Record<ReviewStatus, number>>;
  reviewCounts?: Partial<Record<ReviewStatus, number>>;
};
type DetailMember = { id: string; role: string; status: string; user: { id: string; name: string | null; handle: string | null; email: string } };
type ProjectDetail = AdminRow & {
  tagline: string;
  description: string;
  teamDescription: string | null;
  techStack: string[];
  tasks: { id: string; title: string; status: string; assignee: { name: string | null; handle: string | null } | null }[];
  collaborators: DetailMember[];
  posts: { id: string; type: string; content: string; createdAt: string; _count: { likes: number; comments: number } }[];
};
type TeamDetail = Omit<ProjectDetail, "posts"> & { teamName: string; teamDescription: string | null; teamPosts: ProjectDetail["posts"] };
type DetailData = { project?: ProjectDetail; team?: TeamDetail; associatedProjects?: { id: string; title: string; status: string; moderationStatus: string }[] };

const titles: Record<AdminSection, string> = {
  marketplace: "Annonces marketplace",
  posts: "Publications",
  projects: "Projets",
  teams: "Équipes",
};
const statusLabels: Record<ReviewStatus, string> = { PENDING: "En attente", APPROVED: "Approuvé", REJECTED: "Refusé" };
const projectStageLabels: Record<string, string> = { IDEA: "Idée", DEVELOPMENT: "En développement", LAUNCHED: "Lancé" };

function responseRows(section: AdminSection, data: PageData) {
  if (section === "marketplace") return data.items ?? [];
  if (section === "posts") return data.posts ?? [];
  if (section === "projects") return data.projects ?? [];
  return data.teams ?? [];
}

function ownerLabel(row: AdminRow) {
  const owner = row.seller ?? row.author ?? row.creator;
  return owner?.handle ? `@${owner.handle}` : owner?.name ?? row.seller?.email ?? "Compte supprimé";
}

function rowTitle(section: AdminSection, row: AdminRow) {
  if (section === "posts") return row.content?.replace(/\s+/g, " ").trim().slice(0, 110) || "Publication sans texte";
  return row.teamName || row.title || "Sans titre";
}

function marketplaceTypeLabel(type?: string) {
  if (type === "MICRO_SAAS") return "Micro-SaaS";
  return type?.replaceAll("_", " ").toLocaleLowerCase("fr-FR") || "Annonce marketplace";
}

type FilterOption = { value: string; label: string };

function AdminFilterSelect({ value, onChange, options, label }: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-filter-option="${selectedIndex}"]`)?.focus();
  }, [open, selectedIndex]);

  function moveFocus(direction: 1 | -1) {
    const focusedIndex = Number(document.activeElement instanceof HTMLElement ? document.activeElement.dataset.filterOption : selectedIndex);
    const currentIndex = Number.isInteger(focusedIndex) ? focusedIndex : selectedIndex;
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-filter-option="${nextIndex}"]`)?.focus();
  }

  return <div ref={rootRef} className="relative w-full sm:w-auto" onBlur={(event) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (open && event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (open && event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setOpen(true);
    }
  }}>
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((current) => !current)}
      className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-xl border bg-midnight-deep px-3 text-left text-xs transition sm:min-w-44 ${open ? "border-gold/50 ring-2 ring-gold/15" : "border-midnight-border hover:border-gold/30"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30`}
    >
      <span className="min-w-0 truncate text-ink">{options[selectedIndex]?.label}</span>
      <ChevronDown size={13} aria-hidden="true" className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180 text-gold-soft" : ""}`} />
    </button>
    {open && <div id={menuId} role="menu" aria-label={label} className="absolute left-0 top-[calc(100%+0.4rem)] z-40 max-h-64 w-full min-w-48 overflow-y-auto rounded-xl border border-midnight-border bg-midnight-card p-1.5 shadow-2xl shadow-black/30">
      {options.map((option, index) => {
        const selected = option.value === value;
        return <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={selected}
          data-filter-option={index}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
            triggerRef.current?.focus();
          }}
          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${selected ? "bg-gold/10 font-medium text-gold-soft" : "text-ink-muted hover:bg-white/5 hover:text-ink"}`}
        >
          <span>{option.label}</span>
          {selected && <Check size={12} aria-hidden="true" className="shrink-0" />}
        </button>;
      })}
    </div>}
  </div>;
}

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "LISTING_HAS_ORDERS") return "Cette annonce a des commandes ; archivez-la plutôt que de la supprimer.";
  if (code === "SELLER_VERIFICATION_REQUIRED") return "Le vendeur doit confirmer son compte avant l’approbation.";
  if (code === "P2025" || code.endsWith("NOT_FOUND")) return "Cet élément n’existe plus ou a déjà été supprimé.";
  return "L’action n’a pas abouti. Réessayez.";
}

export function AdminManagement({ section }: { section: AdminSection }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [stage, setStage] = useState("ALL");
  const [postType, setPostType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState("");
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const endpoint = `/api/admin/${section}`;

  const listQuery = useQuery({
    queryKey: ["admin-content", section, search, status, stage, postType, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search.trim()) params.set("q", search.trim());
      if (status !== "ALL") params.set(section === "projects" ? "reviewStatus" : "status", status);
      if (section === "projects" && stage !== "ALL") params.set("status", stage);
      if (section === "posts" && postType !== "ALL") params.set("type", postType);
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) throw new Error("CONTENT_LOAD_FAILED");
      return response.json() as Promise<PageData>;
    },
  });

  const detailQuery = useQuery({
    queryKey: ["admin-content-detail", section, detailId],
    enabled: Boolean(detailId) && (section === "projects" || section === "teams"),
    queryFn: async () => {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(detailId)}`);
      if (!response.ok) throw new Error("DETAIL_LOAD_FAILED");
      return response.json() as Promise<DetailData>;
    },
  });

  async function mutate(method: "PATCH" | "DELETE", body: Record<string, unknown>, targetId: string, message: string) {
    setBusyId(targetId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "ACTION_FAILED");
      setNotice(result.notificationSent === false ? `${message} Notification e-mail non envoyée.` : message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-content", section] }),
        queryClient.invalidateQueries({ queryKey: ["admin-content-detail", section] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyId("");
    }
  }

  function ids(rowId: string) {
    if (section === "marketplace") return { itemId: rowId };
    if (section === "posts") return { postId: rowId };
    if (section === "projects") return { projectId: rowId };
    return { teamId: rowId };
  }

  function changeReview(row: AdminRow, approved: boolean) {
    const action = approved ? "APPROVE" : "REJECT";
    void mutate("PATCH", { ...ids(row.id), action }, row.id, approved ? "Contenu approuvé." : "Contenu refusé et masqué.");
  }

  function removeRow(row: AdminRow) {
    const label = section === "teams" ? "dissoudre cette équipe" : "supprimer définitivement ce contenu";
    if (!window.confirm(`Confirmer : ${label} ?`)) return;
    const body = ids(row.id);
    void mutate("DELETE", body, row.id, section === "teams" ? "Équipe dissoute." : "Contenu supprimé.");
  }

  function featureRow(row: AdminRow) {
    const actionBody = { ...ids(row.id), action: "FEATURE", featured: !row.isFeatured };
    void mutate("PATCH", actionBody, row.id, row.isFeatured ? "Mise en avant retirée." : "Contenu mis en avant.");
  }

  const rows = listQuery.data ? responseRows(section, listQuery.data) : [];
  const pagination = listQuery.data?.pagination;
  const detail = section === "projects" ? detailQuery.data?.project : detailQuery.data?.team;
  const detailPosts = section === "teams" ? detailQuery.data?.team?.teamPosts : detailQuery.data?.project?.posts;
  const statusCounts = listQuery.data?.statusCounts ?? listQuery.data?.reviewCounts ?? {};

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h2 className="font-display text-2xl font-semibold text-ink">{titles[section]}</h2><p className="mt-1 text-sm text-ink-muted">Gestion des contenus et décisions de modération.</p></div>
      <div className="flex flex-wrap gap-2 text-xs">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((key) => <span key={key} className="rounded-full border border-midnight-border px-2.5 py-1 text-ink-muted">{statusLabels[key]} · {(statusCounts[key] ?? 0).toLocaleString("fr-FR")}</span>)}
      </div>
    </header>

    <div className="grid grid-cols-1 gap-2 border-y border-midnight-border py-3 sm:flex sm:flex-wrap sm:items-center">
      <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher..." className="input min-w-0 py-2 text-xs sm:min-w-48 sm:flex-1" />
      <AdminFilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} label="Filtrer par état de modération" options={[{ value: "ALL", label: "Tous les états" }, { value: "PENDING", label: "En attente" }, { value: "APPROVED", label: "Approuvés" }, { value: "REJECTED", label: "Refusés" }]} />
      {section === "projects" && <AdminFilterSelect value={stage} onChange={(value) => { setStage(value); setPage(1); }} label="Filtrer par étape du projet" options={[{ value: "ALL", label: "Toutes les étapes" }, { value: "IDEA", label: "Idée" }, { value: "DEVELOPMENT", label: "Développement" }, { value: "LAUNCHED", label: "Lancé" }]} />}
      {section === "posts" && <AdminFilterSelect value={postType} onChange={(value) => { setPostType(value); setPage(1); }} label="Filtrer par type de publication" options={[{ value: "ALL", label: "Tous les types" }, { value: "PERSONAL", label: "Personnel" }, { value: "TEAM", label: "Équipe" }, { value: "PROJECT", label: "Projet" }]} />}
    </div>

    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {listQuery.isLoading ? section === "marketplace" ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des annonces">
      {Array.from({ length: 6 }, (_, index) => <article key={index} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40">
        <div className="skeleton aspect-[16/9] rounded-none" />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="skeleton h-5 min-w-0 flex-1" /><div className="skeleton h-5 w-16 shrink-0" /></div>
          <div className="flex gap-1.5"><div className="skeleton h-5 w-20 rounded-full" /><div className="skeleton h-5 w-16 rounded-full" /></div>
          <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" /><div className="skeleton h-3 w-2/3" /></div>
          <div className="flex justify-between border-t border-midnight-border pt-3"><div className="skeleton h-3 w-24" /><div className="skeleton h-3 w-20" /></div>
          <div className="skeleton h-3 w-28" />
          <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3"><div className="skeleton h-8 w-20 rounded-lg" /><div className="skeleton h-8 w-16 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /></div>
        </div>
      </article>)}
    </div> : section === "posts" ? <div className="grid min-w-0 gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Chargement des publications">
      {Array.from({ length: 6 }, (_, index) => <article key={index} className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-card/40 p-4">
        <div className="flex items-center justify-between gap-3"><div className="space-y-2"><div className="skeleton h-4 w-32" /><div className="skeleton h-3 w-24" /></div><div className="skeleton h-5 w-20 rounded-full" /></div>
        <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-2/3" /></div>
        <div className="flex gap-2 border-t border-midnight-border pt-3"><div className="skeleton h-5 w-20 rounded-full" /><div className="skeleton h-5 w-24 rounded-full" /><div className="skeleton h-5 w-16 rounded-full" /></div>
        <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3"><div className="skeleton h-8 w-20 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /><div className="skeleton h-8 w-16 rounded-lg" /></div>
      </article>)}
    </div> : section === "projects" ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des projets">
      {Array.from({ length: 6 }, (_, index) => <article key={index} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40">
        <div className="skeleton aspect-[16/9] rounded-none" />
        <div className="space-y-3 p-4">
          <div className="space-y-2"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-3 w-4/5" /></div>
          <div className="flex gap-1.5"><div className="skeleton h-5 w-20 rounded-full" /><div className="skeleton h-5 w-24 rounded-full" /></div>
          <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" /><div className="skeleton h-3 w-2/3" /></div>
          <div className="grid grid-cols-2 gap-3 border-t border-midnight-border pt-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, metric) => <div key={metric} className="space-y-2"><div className="skeleton h-3 w-14" /><div className="skeleton h-4 w-10" /></div>)}</div>
          <div className="skeleton h-3 w-28" />
          <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3"><div className="skeleton h-8 w-20 rounded-lg" /><div className="skeleton h-8 w-16 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /></div>
        </div>
      </article>)}
    </div> : section === "teams" ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des équipes">
      {Array.from({ length: 6 }, (_, index) => <article key={index} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40">
        <div className="skeleton aspect-[16/9] rounded-none" />
        <div className="space-y-3 p-4">
          <div className="space-y-2"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-3 w-4/5" /></div>
          <div className="flex gap-1.5"><div className="skeleton h-5 w-20 rounded-full" /><div className="skeleton h-5 w-24 rounded-full" /></div>
          <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" /></div>
          <div className="flex justify-between border-t border-midnight-border pt-3"><div className="skeleton h-3 w-24" /><div className="skeleton h-3 w-20" /></div>
          <div className="skeleton h-3 w-28" />
          <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3"><div className="skeleton h-8 w-20 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /><div className="skeleton h-8 w-16 rounded-lg" /></div>
        </div>
      </article>)}
    </div> : <div className="divide-y divide-midnight-border border-y border-midnight-border" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton my-4 h-16" />)}</div> : listQuery.isError ? <p role="alert" className="py-8 text-sm text-rose-300">Impossible de charger les données admin.</p> : rows.length ? section === "marketplace" ? (
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => <article key={row.id} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40 transition duration-200 hover:border-gold/30 hover:shadow-card">
          <Link href={`/marketplace/${encodeURIComponent(row.id)}?admin=1`} aria-label={`Consulter l’annonce ${rowTitle(section, row)}`} className="group relative block aspect-[16/9] overflow-hidden border-b border-midnight-border bg-[linear-gradient(135deg,rgba(8,111,88,0.18),rgba(19,34,56,0.65))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
            {row.imageUrl ? (
                            <img src={row.imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
            ) : <div className="grid h-full place-items-center text-gold/70"><PackagePlus size={30} aria-hidden="true" /></div>}
            <span className="absolute bottom-3 left-3 rounded-md border border-white/15 bg-midnight-deep/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">{marketplaceTypeLabel(row.type)}</span>
            {row.isFeatured && <span className="absolute right-3 top-3 rounded-full border border-gold/40 bg-midnight-deep/90 px-2.5 py-1 text-[10px] font-semibold text-gold-soft">À la une</span>}
          </Link>
          <div className="space-y-3 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h3 className="line-clamp-2 min-w-0 break-words font-display text-base font-semibold leading-snug text-ink"><Link href={`/marketplace/${encodeURIComponent(row.id)}?admin=1`} className="transition hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">{rowTitle(section, row)}</Link></h3>
              {typeof row.priceCents === "number" && <p className="shrink-0 text-right text-sm font-semibold text-gold-soft">{formatUsd(row.priceCents / 100, "fr-FR")}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={row.moderationStatus === "APPROVED" ? "badge-gold" : row.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{statusLabels[row.moderationStatus]}</span>
              <span className={`badge ${row.isActive ? "border-emerald-400/30 text-emerald-300" : "text-ink-muted"}`}>{row.isActive ? "En ligne" : "Masquée"}</span>
            </div>
            {row.description && <p className="line-clamp-3 min-h-12 break-words text-xs leading-relaxed text-ink-muted">{row.description}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-3 text-xs text-ink-muted">
              <span className="min-w-0 truncate">{ownerLabel(row)}</span>
              <span className="shrink-0">{(row._count?.orders ?? 0).toLocaleString("fr-FR")} commandes</span>
            </div>
            <p className="text-[10px] text-ink-muted">Créée le {new Date(row.createdAt).toLocaleDateString("fr-FR")}</p>
            <Link href={`/marketplace/${encodeURIComponent(row.id)}?admin=1`} className="inline-flex items-center gap-1 text-xs font-medium text-gold-soft transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
              Voir l’annonce complète <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
            <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3">
              {row.moderationStatus !== "APPROVED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, true)} className="btn-gold min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Approuver</button>}
              {row.moderationStatus !== "REJECTED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, false)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Refuser</button>}
              <button type="button" disabled={busyId === row.id} onClick={() => featureRow(row)} className="btn-outline min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">{row.isFeatured ? "Retirer boost" : "Mettre en avant"}</button>
              <button type="button" disabled={busyId === row.id || (row._count?.orders ?? 0) > 0} onClick={() => removeRow(row)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] text-rose-300 disabled:opacity-40">Supprimer</button>
            </div>
          </div>
        </article>)}
      </div>
    ) : section === "posts" ? (
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {rows.map((row) => <article key={row.id} className="min-w-0 rounded-2xl border border-midnight-border bg-midnight-card/40 p-4 transition hover:border-gold/30">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{ownerLabel(row)}</p>
              <p className="mt-1 text-[11px] text-ink-muted">{row.type ?? "Publication"} · {new Date(row.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
            <span className={row.moderationStatus === "APPROVED" ? "badge-gold" : row.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{statusLabels[row.moderationStatus]}</span>
          </header>
          {(() => {
            const content = row.content?.trim() || "Publication avec média, sans texte.";
            const isLong = content.length > 280;
            const isExpanded = expandedPostIds.has(row.id);
            return <div className="mt-4">
              <p id={`admin-post-content-${row.id}`} className={`${isLong && !isExpanded ? "line-clamp-5" : ""} whitespace-pre-wrap break-words text-sm leading-relaxed text-ink`}>{content}</p>
              {isLong && <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={`admin-post-content-${row.id}`}
                onClick={() => setExpandedPostIds((current) => {
                  const next = new Set(current);
                  if (next.has(row.id)) next.delete(row.id);
                  else next.add(row.id);
                  return next;
                })}
                className="mt-2 text-xs font-medium text-gold-soft transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >{isExpanded ? "Voir moins" : "Voir plus"}</button>}
            </div>;
          })()}
          {row.poll && <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-soft">{row.poll.type === "STAR" ? "Vote étoile" : row.poll.type === "TEXT" ? "Réponse libre" : "Sondage"} · {(row.poll._count?.votes ?? 0).toLocaleString("fr-FR")} réponses</p>
            <p className="mt-1 text-xs font-medium text-ink">{row.poll.question}</p>
          </div>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-midnight-border pt-3 text-[11px] text-ink-muted">
            <span className={row._count?.reports ? "text-amber-200" : ""}>{(row._count?.reports ?? 0).toLocaleString("fr-FR")} signalements</span>
            <span>{((row._count?.likes ?? 0) + (row._count?.comments ?? 0)).toLocaleString("fr-FR")} interactions</span>
            {row.isFeatured && <span className="text-gold-soft">Mise en avant</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3">
            <button type="button" disabled={busyId === row.id} onClick={() => featureRow(row)} className="btn-outline min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">{row.isFeatured ? "Retirer la mise en avant" : "Mettre en avant"}</button>
            {row._count?.reports ? <button type="button" disabled={busyId === row.id} onClick={() => void mutate("PATCH", { postId: row.id, action: "RESOLVE_REPORTS" }, row.id, "Signalements traités.")} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Traiter les signalements</button> : null}
            {row.poll && <button type="button" disabled={busyId === row.id} onClick={() => { if (window.confirm("Retirer le sondage et ses votes ?")) void mutate("PATCH", { postId: row.id, action: "REMOVE_POLL" }, row.id, "Sondage retiré."); }} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Retirer le sondage</button>}
            <button type="button" disabled={busyId === row.id} onClick={() => void mutate("PATCH", { postId: row.id, action: row.moderationStatus === "REJECTED" ? "RESTORE" : "HIDE" }, row.id, row.moderationStatus === "REJECTED" ? "Publication restaurée." : "Publication masquée.")} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">{row.moderationStatus === "REJECTED" ? "Restaurer" : "Masquer"}</button>
            <button type="button" disabled={busyId === row.id} onClick={() => removeRow(row)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] text-rose-300 disabled:opacity-40">Supprimer</button>
          </div>
        </article>)}
      </div>
    ) : section === "projects" ? (
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => <article key={row.id} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40 transition duration-200 hover:border-gold/30 hover:shadow-card">
          <div className="relative aspect-[16/9] overflow-hidden border-b border-midnight-border bg-[linear-gradient(135deg,rgba(8,111,88,0.18),rgba(19,34,56,0.65))]">
            {(row.coverUrl || row.logoUrl) ? (
                            <img src={row.coverUrl || row.logoUrl || ""} alt="" className="h-full w-full object-cover" />
            ) : <div className="grid h-full place-items-center text-gold/70"><FolderKanban size={30} aria-hidden="true" /></div>}
            <span className="absolute bottom-3 left-3 rounded-md border border-white/15 bg-midnight-deep/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">{projectStageLabels[row.status ?? ""] ?? "Projet"}</span>
            {row.isFeatured && <span className="absolute right-3 top-3 rounded-full border border-gold/40 bg-midnight-deep/90 px-2.5 py-1 text-[10px] font-semibold text-gold-soft">À la une</span>}
          </div>
          <div className="space-y-3 p-4">
            <div className="min-w-0">
              <h3 className="line-clamp-2 break-words font-display text-base font-semibold leading-snug text-ink">{row.title || "Projet sans titre"}</h3>
              {row.tagline && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{row.tagline}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={row.moderationStatus === "APPROVED" ? "badge-gold" : row.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{statusLabels[row.moderationStatus]}</span>
              <span className="badge border-midnight-border text-ink-muted">{projectStageLabels[row.status ?? ""] ?? row.status ?? "Étape inconnue"}</span>
            </div>
            {row.description && <p className="line-clamp-3 min-h-12 break-words text-xs leading-relaxed text-ink-muted">{row.description}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-3 text-xs text-ink-muted">
              <span className="min-w-0 truncate">{ownerLabel(row)}</span>
              <span className="shrink-0">{(row._count?.collaborators ?? 0).toLocaleString("fr-FR")} membres</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-muted">
              <span>{(row._count?.posts ?? 0).toLocaleString("fr-FR")} publications</span>
              <span>{(row._count?.tasks ?? 0).toLocaleString("fr-FR")} jalons</span>
            </div>
            <p className="text-[10px] text-ink-muted">Mis à jour le {new Date(row.updatedAt ?? row.createdAt).toLocaleDateString("fr-FR")}</p>
            <div className="border-t border-midnight-border/70 pt-3">
              <AdminFilterSelect
                value={row.status ?? "IDEA"}
                onChange={(value) => void mutate("PATCH", { projectId: row.id, action: "SET_STATUS", status: value }, row.id, "Étape du projet mise à jour.")}
                label={`Étape de ${row.title ?? "ce projet"}`}
                options={[{ value: "IDEA", label: "Idée" }, { value: "DEVELOPMENT", label: "En développement" }, { value: "LAUNCHED", label: "Lancé" }]}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3">
              {row.moderationStatus !== "APPROVED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, true)} className="btn-gold min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Approuver</button>}
              {row.moderationStatus !== "REJECTED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, false)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Refuser</button>}
              <button type="button" disabled={busyId === row.id} onClick={() => featureRow(row)} className="btn-outline min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">{row.isFeatured ? "Retirer boost" : "Mettre en avant"}</button>
              <Link href={`/projects/${encodeURIComponent(row.id)}`} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px]">Détails</Link>
              <button type="button" disabled={busyId === row.id} onClick={() => removeRow(row)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] text-rose-300 disabled:opacity-40">Supprimer</button>
            </div>
          </div>
        </article>)}
      </div>
    ) : section === "teams" ? (
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => <article key={row.id} className="min-w-0 overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40 transition duration-200 hover:border-gold/30 hover:shadow-card">
          <div className="relative aspect-[16/9] overflow-hidden border-b border-midnight-border bg-[linear-gradient(135deg,rgba(8,111,88,0.18),rgba(19,34,56,0.65))]">
            {(row.coverUrl || row.logoUrl) ? (
                            <img src={row.coverUrl || row.logoUrl || ""} alt="" className="h-full w-full object-cover" />
            ) : <div className="grid h-full place-items-center text-gold/70"><UsersRound size={30} aria-hidden="true" /></div>}
            <span className="absolute bottom-3 left-3 rounded-md border border-white/15 bg-midnight-deep/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">Équipe</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="min-w-0">
              <h3 className="line-clamp-2 break-words font-display text-base font-semibold leading-snug text-ink">{row.teamName || row.title || "Équipe sans nom"}</h3>
              {row.tagline && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{row.tagline}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={row.moderationStatus === "APPROVED" ? "badge-gold" : row.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{statusLabels[row.moderationStatus]}</span>
              <span className="badge border-midnight-border text-ink-muted">{projectStageLabels[row.status ?? ""] ?? row.status ?? "Étape inconnue"}</span>
              {row.isTeamVerified && <span className="badge border-emerald-400/30 text-emerald-300">Vérifiée</span>}
            </div>
            {(row.teamDescription || row.description) && <p className="line-clamp-3 min-h-12 break-words text-xs leading-relaxed text-ink-muted">{row.teamDescription || row.description}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-3 text-xs text-ink-muted">
              <span className="min-w-0 truncate">{ownerLabel(row)}</span>
              <span className="shrink-0">{(row._count?.collaborators ?? 0).toLocaleString("fr-FR")} membres</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-muted">
              <span>{(row._count?.teamPosts ?? 0).toLocaleString("fr-FR")} publications</span>
              <span>{(row._count?.teamProjects ?? 0).toLocaleString("fr-FR")} projets liés</span>
            </div>
            <p className="text-[10px] text-ink-muted">Mis à jour le {new Date(row.updatedAt ?? row.createdAt).toLocaleDateString("fr-FR")}</p>
            <div className="flex flex-wrap gap-1.5 border-t border-midnight-border/70 pt-3">
              {row.moderationStatus !== "APPROVED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, true)} className="btn-gold min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Approuver</button>}
              {row.moderationStatus !== "REJECTED" && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, false)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">Refuser</button>}
              <button type="button" disabled={busyId === row.id} onClick={() => void mutate("PATCH", { teamId: row.id, action: "SET_VERIFICATION", verified: !row.isTeamVerified }, row.id, row.isTeamVerified ? "Vérification de l’équipe retirée." : "Équipe vérifiée.")} className="btn-outline min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] disabled:opacity-50">{row.isTeamVerified ? "Retirer vérification" : "Vérifier"}</button>
              <button type="button" onClick={() => setDetailId(row.id)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px]">Détails</button>
              <button type="button" disabled={busyId === row.id} onClick={() => removeRow(row)} className="btn-ghost min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[10px] text-rose-300 disabled:opacity-40">Dissoudre</button>
            </div>
          </div>
        </article>)}
      </div>
    ) : (
      <div className="overflow-x-auto border-y border-midnight-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-midnight-deep/50 text-[10px] uppercase text-ink-muted"><tr><th className="px-3 py-3 font-medium">Contenu</th><th className="px-3 py-3 font-medium">Créateur</th><th className="px-3 py-3 font-medium">État</th><th className="px-3 py-3 font-medium">Activité</th><th className="px-3 py-3 font-medium">Créé le</th><th className="px-3 py-3 font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-midnight-border/60">
            {rows.map((row) => <tr key={row.id} className="align-top">
              <td className="max-w-[26rem] px-3 py-4"><p className="line-clamp-2 font-medium text-ink">{rowTitle(section, row)}</p><p className="mt-1 text-xs text-ink-muted">{section === "posts" ? row.type : row.status}</p>{row.poll && <p className="mt-1 text-[11px] text-gold-soft">Sondage {row.poll.type === "STAR" ? "étoiles" : row.poll.type === "TEXT" ? "texte" : "à choix"} · {row.poll._count.votes} votes</p>}</td>
              <td className="px-3 py-4 text-xs text-ink-muted">{ownerLabel(row)}</td>
              <td className="px-3 py-4"><div className="flex flex-col items-start gap-1"><span className={row.moderationStatus === "APPROVED" ? "badge-gold" : row.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{statusLabels[row.moderationStatus]}</span>{row.isFeatured && <span className="text-[10px] text-gold-soft">Mis en avant</span>}</div></td>
              <td className="px-3 py-4 text-xs tabular-nums text-ink-muted">{(row._count?.reports ?? 0).toLocaleString("fr-FR")} signalements · {((row._count?.likes ?? 0) + (row._count?.comments ?? 0)).toLocaleString("fr-FR")} interactions</td>
              <td className="whitespace-nowrap px-3 py-4 text-xs text-ink-muted">{new Date(row.createdAt).toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-4"><div className="flex max-w-64 flex-wrap gap-1.5">
                {section !== "posts" && (row.moderationStatus === "PENDING" || row.moderationStatus === "REJECTED") && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, true)} className="btn-gold !rounded-xl !px-2.5 !py-1.5 text-[10px]">Approuver</button>}
                {section !== "posts" && (row.moderationStatus === "PENDING" || row.moderationStatus === "APPROVED") && <button type="button" disabled={busyId === row.id} onClick={() => changeReview(row, false)} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px]">Refuser</button>}
                {section === "posts" && <button type="button" disabled={busyId === row.id} onClick={() => featureRow(row)} className="btn-outline !rounded-xl !px-2.5 !py-1.5 text-[10px]">{row.isFeatured ? "Retirer boost" : "Mettre en avant"}</button>}
                {section === "posts" && row._count?.reports ? <button type="button" disabled={busyId === row.id} onClick={() => void mutate("PATCH", { postId: row.id, action: "RESOLVE_REPORTS" }, row.id, "Signalements traités.")} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px]">Traiter signalements</button> : null}
                {section === "posts" && row.poll && <button type="button" disabled={busyId === row.id} onClick={() => { if (window.confirm("Retirer le sondage et ses votes ?")) void mutate("PATCH", { postId: row.id, action: "REMOVE_POLL" }, row.id, "Sondage retiré."); }} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px]">Retirer sondage</button>}
                {section === "posts" && <button type="button" disabled={busyId === row.id} onClick={() => void mutate("PATCH", { postId: row.id, action: row.moderationStatus === "REJECTED" ? "RESTORE" : "HIDE" }, row.id, row.moderationStatus === "REJECTED" ? "Publication restaurée." : "Publication masquée.")} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px]">{row.moderationStatus === "REJECTED" ? "Restaurer" : "Masquer"}</button>}
                <button type="button" disabled={busyId === row.id} onClick={() => removeRow(row)} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px] text-rose-300 disabled:opacity-40">Supprimer</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    ) : <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">Aucun élément pour ces filtres.</p>}

    {pagination && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted"><span>{pagination.total.toLocaleString("fr-FR")} {section === "posts" ? "publications" : "éléments"} · page {pagination.page} / {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-ghost !rounded-xl !px-3 !py-2 disabled:opacity-40">Précédent</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="btn-gold !rounded-xl !px-3 !py-2 disabled:opacity-40">Suivant</button></div></div>}

    {detailId && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(""); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-midnight-border bg-midnight-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h3 id="admin-detail-title" className="font-display text-xl font-semibold text-ink">{detail?.teamName || detail?.title || "Détails"}</h3><p className="mt-1 text-xs text-ink-muted">{detail?.moderationStatus ? statusLabels[detail.moderationStatus] : "Chargement..."}</p></div><button type="button" onClick={() => setDetailId("")} className="btn-ghost !rounded-xl px-3 py-2 text-xs">Fermer</button></div>
        {detailQuery.isError && <p role="alert" className="mt-4 text-sm text-rose-300">Impossible de charger les détails.</p>}
        {detail && <div className="mt-5 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3"><div className="border-y border-midnight-border py-3"><p className="text-xs text-ink-muted">Créateur</p><p className="mt-1 text-sm text-ink">{ownerLabel(detail)}</p></div><div className="border-y border-midnight-border py-3"><p className="text-xs text-ink-muted">Membres</p><p className="mt-1 text-sm text-ink">{detail._count?.collaborators ?? 0}</p></div><div className="border-y border-midnight-border py-3"><p className="text-xs text-ink-muted">Publications</p><p className="mt-1 text-sm text-ink">{detail._count?.teamPosts ?? detail._count?.posts ?? 0}</p></div></div>
          {section === "teams" && <div><h4 className="mb-2 text-sm font-semibold text-ink">Membres et rôles</h4><div className="divide-y divide-midnight-border border-y border-midnight-border">{detail.collaborators.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm text-ink">{member.user.name ?? member.user.handle ?? member.user.email}</p><p className="text-xs text-ink-muted">{member.role} · {member.status}</p></div><div className="flex gap-2">{member.status !== "APPROVED" && <button type="button" disabled={busyId === detailId} onClick={() => void mutate("PATCH", { teamId: detailId, collaboratorId: member.id, action: "MEMBER", status: "APPROVED" }, detailId, "Membre approuvé.")} className="btn-gold !rounded-xl !px-2.5 !py-1.5 text-[10px]">Approuver</button>}<select aria-label={`Rôle de ${member.user.name ?? member.user.email}`} value={member.role} onChange={(event) => void mutate("PATCH", { teamId: detailId, collaboratorId: member.id, action: "MEMBER", status: member.status, role: event.target.value }, detailId, "Rôle mis à jour.")} className="input w-auto py-1 text-[10px]"><option value="FOUNDER">Fondateur</option><option value="CO_BUILDER">Co-builder</option><option value="DESIGNER">Designer</option><option value="MARKETER">Marketing</option><option value="DEVELOPER">Développeur</option><option value="PRODUCT">Produit</option></select><button type="button" disabled={busyId === detailId} onClick={() => void mutate("PATCH", { teamId: detailId, collaboratorId: member.id, action: "MEMBER", status: "REJECTED" }, detailId, "Membre retiré.")} className="btn-ghost !rounded-xl !px-2.5 !py-1.5 text-[10px] text-rose-300">Retirer</button></div></div>)}</div></div>}
          {section === "teams" && <div><h4 className="mb-2 text-sm font-semibold text-ink">Projets associés</h4><div className="divide-y divide-midnight-border border-y border-midnight-border">{(detailQuery.data?.associatedProjects ?? []).map((project) => <div key={project.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-ink">{project.title}</span><span className="text-xs text-ink-muted">{project.status} · {project.moderationStatus}</span></div>)}</div></div>}
          {section === "projects" && <div><h4 className="mb-2 text-sm font-semibold text-ink">Jalons</h4><div className="divide-y divide-midnight-border border-y border-midnight-border">{detail.tasks.length ? detail.tasks.map((task) => <div key={task.id} className="flex justify-between gap-3 py-3 text-sm"><span className="text-ink">{task.title}<span className="ml-2 text-xs text-ink-muted">{task.assignee?.handle ?? task.assignee?.name ?? "Non assigné"}</span></span><span className="text-xs text-ink-muted">{task.status}</span></div>) : <p className="py-4 text-xs text-ink-muted">Aucun jalon pour ce projet.</p>}</div></div>}
          <div><h4 className="mb-2 text-sm font-semibold text-ink">Publications récentes</h4><div className="divide-y divide-midnight-border border-y border-midnight-border">{detailPosts?.length ? detailPosts.map((post) => <article key={post.id} className="py-3"><p className="line-clamp-2 text-sm text-ink">{post.content}</p><p className="mt-1 text-xs text-ink-muted">{post.type} · {post._count.likes + post._count.comments} interactions</p></article>) : <p className="py-4 text-xs text-ink-muted">Aucune publication liée.</p>}</div></div>
        </div>}
      </section>
    </div>}
  </section>;
}