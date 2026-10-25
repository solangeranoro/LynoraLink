"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  MapPin,
  MoreHorizontal,
  ReviewIcon,
  ShieldCheck,
  Star,
  Store,
  User,
  UsersRound,
  Users,
  X,
} from "@/components/FontAwesomeIcons";
import { Logo } from "@/components/Logo";
import { AdminManagement } from "@/components/admin/AdminManagement";
type Section = "overview" | "users" | "projects" | "teams" | "posts" | "feedback" | "marketplace" | "communications" | "revenue" | "analytics";
type AdminNavCount = Section;
const adminNavSeenKey = (adminId: string) => `lynora-admin-nav-seen:${adminId}`;
const lastAdminIdKey = "lynora-admin-nav-last-admin";

function readAdminNavSeen(adminId: string): Partial<Record<Section, string>> {
  try {
    const stored = window.localStorage.getItem(adminNavSeenKey(adminId));
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed as Partial<Record<Section, string>> : {};
  } catch {
    return {};
  }
}

function saveLastAdminId(adminId: string) {
  try {
    window.localStorage.setItem(lastAdminIdKey, adminId);
  } catch {
    return;
  }
}

function markAdminNavSeen(adminId: string, section: Section) {
  try {
    const seen = readAdminNavSeen(adminId);
    seen[section] = new Date().toISOString();
    window.localStorage.setItem(adminNavSeenKey(adminId), JSON.stringify(seen));
    window.localStorage.setItem(lastAdminIdKey, adminId);
  } catch {
    return;
  }
}

const navItems: { id: Section; label: string; icon: typeof Users; countKey?: AdminNavCount; attention?: boolean }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, countKey: "overview" },
  { id: "users", label: "Utilisateurs", icon: User, countKey: "users" },
  { id: "projects", label: "Projets", icon: FolderKanban, countKey: "projects" },
  { id: "teams", label: "Équipes", icon: UsersRound, countKey: "teams" },
  { id: "posts", label: "Publications", icon: FileText, countKey: "posts", attention: true },
  { id: "feedback", label: "Avis & sondages", icon: ReviewIcon, countKey: "feedback", attention: true },
  { id: "marketplace", label: "Marketplace", icon: Store, countKey: "marketplace", attention: true },
  { id: "communications", label: "E-mails", icon: Mail, countKey: "communications" },
  { id: "revenue", label: "Monétisation", icon: CircleDollarSign, countKey: "revenue" },
  { id: "analytics", label: "Analytics", icon: BarChart3, countKey: "analytics" },
];

const overviewHeading = {
  title: "Vue d'ensemble",
  description: "Suivez les indicateurs clés et l'activité de LynoraLink en un coup d'œil.",
};

const stats = [
  { label: "Utilisateurs actifs", icon: Users },
  { label: "Projets créés", icon: BriefcaseBusiness },
  { label: "Publications", icon: FileText },
  { label: "Ventes marketplace ce mois", icon: CircleDollarSign },
];

type AdminData = {
  admin: { id: string; role: string };
  stats: { users: number; activeUsers: number; projects: number; posts: number; reportedPosts: number; pendingMarketplaceItems: number; activeBoosts: number; marketplaceSales: number; marketplaceRevenue: number };
  navCounts: Record<Section, number>;
  recentUsers: { id: string; name: string | null; email: string; handle: string | null; city: string | null; location: string | null; createdAt: string; isOnline: boolean }[];
  geoDistribution: { location: string; users: number }[];
  projectStatusCounts: Record<string, number>;
  postTypeCounts: Record<string, number>;
  recentProjects: { id: string; title: string; tagline: string; teamName: string | null; status: string; updatedAt: string; creator: { name: string | null; handle: string | null }; _count: { collaborators: number; posts: number; tasks: number } }[];
  recentTeams: { id: string; title: string; teamName: string | null; status: string; updatedAt: string; _count: { collaborators: number; teamPosts: number } }[];
  reportedPostItems: { id: string; content: string; type: string; createdAt: string; author: { name: string | null; handle: string | null }; _count: { reports: number } }[];
  monthlyUserGrowth: { label: string; users: number }[];
  monthlyTeamGrowth: { label: string; teams: number }[];
  weeklyPostActivity: { label: string; posts: number }[];
  topInteractivePosts: { id: string; content: string; type: string; createdAt: string; author: { name: string | null; handle: string | null }; _count: { likes: number; comments: number }; interactions: number }[];
  teamCount: number;
};

type AdminManagedUser = {
  id: string;
  name: string | null;
  email: string;
  handle: string | null;
  city: string | null;
  location: string | null;
  isOnline: boolean;
  accountStatus: "ACTIVE" | "SUSPENDED" | "BANNED";
  suspendedUntil: string | null;
  createdAt: string;
};

type AdminUserAction =
  | { action: "BAN"; userId: string }
  | { action: "SUSPEND"; userId: string; days: number }
  | { action: "RELEASE"; userId: string };

type AdminUserPage = {
  users: AdminManagedUser[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

function AdminPagination({ page, pages, total, onPageChange, label }: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  const pageCount = Math.max(1, pages);
  return <nav aria-label={`Pagination ${label}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border pt-4 text-xs text-ink-muted">
    <span>{total.toLocaleString("fr-FR")} {label} · page {page} / {pageCount}</span>
    <div className="flex gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="btn-ghost !rounded-xl !px-3 !py-2 disabled:opacity-40">Précédent</button>
      <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="btn-gold !rounded-xl !px-3 !py-2 disabled:opacity-40">Suivant</button>
    </div>
  </nav>;
}

function AdminUserListSkeleton() {
  return <section className="space-y-6" aria-busy="true" aria-label="Chargement des utilisateurs">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2"><div className="skeleton h-7 w-40" /><div className="skeleton h-3.5 w-64 max-w-full" /></div>
      <div className="skeleton h-10 w-full rounded-lg sm:w-64" />
    </div>
    <div className="divide-y divide-midnight-border border-y border-midnight-border">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3"><div className="skeleton h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 space-y-2"><div className="skeleton h-3.5 w-40 max-w-full" /><div className="skeleton h-3 w-56 max-w-full" /></div></div>
        <div className="flex items-center gap-3"><div className="skeleton h-5 w-16 rounded-full" />{index % 2 === 0 && <div className="skeleton h-5 w-20 rounded-full" />}<div className="skeleton h-9 w-16 rounded-md" /></div>
      </div>)}
    </div>
  </section>;
}

function AdminUsersSection({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<AdminManagedUser | null>(null);
  const [suspensionDays, setSuspensionDays] = useState(7);
  const [successMessage, setSuccessMessage] = useState("");
  const [page, setPage] = useState(1);
  const search = query.trim();
  const usersQuery = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("USERS_LOAD_FAILED");
      return response.json() as Promise<AdminUserPage>;
    },
  });
  const updateUser = useMutation({
    mutationFn: async (payload: AdminUserAction) => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("USER_UPDATE_FAILED");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
      setSelectedUser(null);
      setSuccessMessage("Le compte a été mis à jour.");
    },
  });
  const users = usersQuery.data?.users ?? [];

  if (usersQuery.isLoading) return <AdminUserListSkeleton />;

  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Utilisateurs</h2>
        <p className="mt-1 text-sm text-ink-muted">Consultez les comptes et gérez leur accès.</p>
      </div>
      <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un membre" className="input w-full py-2 text-xs sm:w-64" />
    </div>
    {successMessage && <p role="status" className="text-sm text-emerald-300">{successMessage}</p>}
    {usersQuery.isLoading ? <AdminUserListSkeleton /> : usersQuery.isError ? <p role="alert" className="text-sm text-rose-300">Impossible de charger les utilisateurs.</p> : users.length ? (
      <div className="divide-y divide-midnight-border border-y border-midnight-border">
        {users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold-soft">{(user.name ?? user.email).split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-ink-muted">{user.handle ? `@${user.handle}` : user.email}{(user.city || user.location) ? ` · ${user.city ?? user.location}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.accountStatus !== "ACTIVE" && <span className="badge text-rose-300">{user.accountStatus === "BANNED" ? "Banni" : "Suspendu"}</span>}
            <button type="button" onClick={() => { setSelectedUser(user); updateUser.reset(); setSuccessMessage(""); }} className="btn-outline px-3 py-2 text-xs">Gérer</button>
          </div>
        </div>)}
      </div>
    ) : <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">Aucun utilisateur trouvé.</p>}
    {!usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.pagination && <AdminPagination {...usersQuery.data.pagination} onPageChange={setPage} label="utilisateurs" />}

    {selectedUser && <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateUser.isPending) setSelectedUser(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" onKeyDown={(event) => { if (event.key === "Escape" && !updateUser.isPending) setSelectedUser(null); }} className="w-full max-w-lg border border-midnight-border bg-midnight-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-user-dialog-title" className="font-display text-xl font-semibold text-ink">Gérer le compte</h2>
            <p className="mt-1 text-sm text-ink-muted">{selectedUser.name ?? "Utilisateur"}</p>
          </div>
          <button type="button" onClick={() => setSelectedUser(null)} disabled={updateUser.isPending} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"><X size={18} /></button>
        </div>
        <dl className="mt-5 grid gap-3 border-y border-midnight-border py-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-ink-muted">E-mail</dt><dd className="mt-1 break-all text-ink">{selectedUser.email}</dd></div>
          <div><dt className="text-xs text-ink-muted">Compte créé</dt><dd className="mt-1 text-ink">{new Date(selectedUser.createdAt).toLocaleDateString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-ink-muted">Activité</dt><dd className="mt-1 text-ink">{selectedUser.isOnline ? "En ligne" : "Hors ligne"}</dd></div>
          <div><dt className="text-xs text-ink-muted">État du compte</dt><dd className="mt-1 text-ink">{selectedUser.accountStatus === "ACTIVE" ? "Actif" : selectedUser.accountStatus === "BANNED" ? "Banni définitivement" : selectedUser.suspendedUntil ? `Suspendu jusqu’au ${new Date(selectedUser.suspendedUntil).toLocaleDateString("fr-FR")}` : "Suspendu"}</dd></div>
        </dl>
        <div className="mt-5 border-t border-midnight-border pt-5">
          <h3 className="text-sm font-semibold text-ink">Actions du compte</h3>
          {selectedUser.accountStatus === "ACTIVE" ? <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Durée
              <select value={suspensionDays} onChange={(event) => setSuspensionDays(Number(event.target.value))} className="rounded-md border border-midnight-border bg-midnight-deep px-2 py-2 text-ink">
                <option value={1}>24 heures</option>
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </label>
            <button type="button" disabled={updateUser.isPending} onClick={() => { if (window.confirm(`Suspendre ce compte pendant ${suspensionDays} jour${suspensionDays > 1 ? "s" : ""} ?`)) updateUser.mutate({ action: "SUSPEND", userId: selectedUser.id, days: suspensionDays }); }} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">Suspendre</button>
            <button type="button" disabled={updateUser.isPending} onClick={() => { if (window.confirm("Bannir définitivement ce compte ?")) updateUser.mutate({ action: "BAN", userId: selectedUser.id }); }} className="rounded-md border border-rose-400/40 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-50">Bannir</button>
          </div> : <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">La connexion est bloquée pour ce compte.</p>
            <button type="button" disabled={updateUser.isPending} onClick={() => updateUser.mutate({ action: "RELEASE", userId: selectedUser.id })} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">Libérer le compte</button>
          </div>}
        </div>
        {updateUser.isError && <p role="alert" className="mt-4 text-sm text-rose-300">La mise à jour a échoué. Réessayez.</p>}
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={() => setSelectedUser(null)} disabled={updateUser.isPending} className="btn-ghost px-4 py-2 text-sm">Fermer</button>
        </div>
      </section>
    </div>}
  </section>;
}

function AdminSidebar({ activeSection, setActiveSection, data }: { activeSection: Section; setActiveSection: (section: Section) => void; data?: AdminData }) {
  const activeUsers = data?.stats.activeUsers ?? 0;
  const totalUsers = data?.stats.users ?? 0;
  const syncLabel = data ? "Synchronisé à l'instant" : "Synchronisation en attente";
  const countByKey = data?.navCounts;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden h-screen w-72 flex-col overflow-hidden border-r border-midnight-border bg-midnight-deep p-5 lg:flex">
      <div className="min-h-0 flex-1 overflow-y-auto pb-5">
        <div className="px-0"><Logo size={40} withWordmark /></div>
        <div className="mt-6 border-b border-midnight-border/70 pb-5"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-gold">Administration</p></div>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Administration">
          {navItems.map(({ id, label, icon: Icon, countKey, attention }) => {
            const count = countKey ? countByKey?.[countKey] : undefined;
            return (
              <button key={id} onClick={() => setActiveSection(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activeSection === id ? "bg-gold/10 text-gold-soft shadow-[inset_0_0_0_1px_rgba(8,111,88,0.3)]" : "text-ink-muted hover:bg-midnight-card/60 hover:text-ink"}`}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {typeof count === "number" && count > 0 && <span className={`ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-center text-[10px] font-bold leading-none tabular-nums text-white ${attention ? "bg-rose-400/15" : "bg-midnight-card"}`}>{count > 99 ? "99+" : count.toLocaleString("fr-FR")}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="shrink-0 border-t border-midnight-border/70 bg-midnight-deep pt-4">
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gold-soft"><Activity size={14} /> État de la plateforme</div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{syncLabel} · {activeUsers.toLocaleString("fr-FR")} utilisateurs actifs sur {totalUsers.toLocaleString("fr-FR")}.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-midnight-border"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${totalUsers ? Math.max(8, Math.round((activeUsers / totalUsers) * 100)) : 8}%` }} /></div>
        </div>
        <Link href="/dashboard" className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft"><ArrowLeft size={14} />Retour à LynoraLink</Link>
      </div>
    </aside>
  );
}

function LineChart() {
  return <div className="relative h-48 w-full overflow-hidden pt-2"><div className="absolute inset-x-0 top-4 space-y-9">{["", "", "", ""].map((_, index) => <div key={index} className="border-t border-midnight-border/60" />)}</div><svg viewBox="0 0 600 180" className="relative h-full w-full" preserveAspectRatio="none" aria-label="Croissance des utilisateurs"><defs><linearGradient id="admin-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#12A98C" stopOpacity=".26" /><stop offset="1" stopColor="#12A98C" stopOpacity="0" /></linearGradient></defs><path d="M0 154 C45 145 56 132 95 137 S145 111 180 119 S226 82 265 98 S305 75 345 83 S392 57 430 68 S478 31 510 45 S560 18 600 22 V180 H0Z" fill="url(#admin-area)" /><path d="M0 154 C45 145 56 132 95 137 S145 111 180 119 S226 82 265 98 S305 75 345 83 S392 57 430 68 S478 31 510 45 S560 18 600 22" fill="none" stroke="#22B8D4" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-ink-muted"><span>Avr</span><span>Mai</span><span>Juin</span><span>Juil</span><span>Août</span><span>Sept</span></div></div>;
}

function BarChart() {
  return <div className="flex h-48 items-end justify-around gap-3 border-b border-midnight-border/70 px-2 pb-6 pt-5">{[{ label: "Idée", value: 42, color: "bg-gold/50" }, { label: "Build", value: 68, color: "bg-gold" }, { label: "Lancé", value: 34, color: "bg-emerald-400" }].map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className={`w-full max-w-14 rounded-t-md ${item.color} transition-all`} style={{ height: `${item.value}%` }} /><span className="text-[11px] text-ink-muted">{item.label}</span></div>)}</div>;
}

function AdminSectionView({ section, query, setQuery, action }: { section: Exclude<Section, "overview">; query: string; setQuery: (value: string) => void; action: (message: string) => void }) {
  if (section === "marketplace") return <AdminManagement section="marketplace" />;
  if (section === "communications") return <AdminEmailSection notify={action} />;
  const title = navItems.find((item) => item.id === section)?.label;
  const sectionIntro: Record<Exclude<Section, "overview">, string> = {
    users: "Contrôlez les accès, les plans et la santé de la communauté.",
    projects: "Suivez le pipeline des projets et les validations en attente.",
    teams: "Supervisez les équipes actives et les demandes de collaboration.",
    posts: "Modérez les publications signalées et protégez la qualité du feed.",
    feedback: "Consultez les notes, les réponses aux sondages et les retours déposés par la communauté.",
    marketplace: "Les annonces restent masquées tant qu'un administrateur ne les a pas approuvées.",
    communications: "Les envois sont réservés aux administrateurs et limités à 20 par jour.",
    revenue: "Pilotez les abonnements, les boosts et les ventes marketplace.",
    analytics: "Comparez la croissance, l'engagement et l'activité par région.",
  };
  const filteredUsers: { name: string; handle: string; location: string; plan: string; status: string; initials: string }[] = [];

  if (section === "users") return <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold text-ink">Utilisateurs</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro[section]}</p></div><button onClick={() => action("Export utilisateurs en préparation")} className="btn-gold"><ArrowUpRight size={15} />Exporter la liste</button></div><div className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-ink-muted">Actifs aujourd&apos;hui</p><p className="mt-2 text-2xl font-semibold text-ink">18,429</p><span className="text-xs text-emerald-300">+12.8%</span></div><div className="card p-4"><p className="text-xs text-ink-muted">Premium</p><p className="mt-2 text-2xl font-semibold text-ink">4,218</p><span className="text-xs text-gold-soft">22.9% du total</span></div><div className="card p-4"><p className="text-xs text-ink-muted">À modérer</p><p className="mt-2 text-2xl font-semibold text-ink">24</p><span className="text-xs text-rose-300">Nécessite une action</span></div></div><div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-midnight-border/70 p-5"><h3 className="text-sm font-semibold text-ink">Répertoire des membres</h3><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un membre" className="input w-56 py-2 text-xs" /></div><div className="divide-y divide-midnight-border/60">{filteredUsers.map((user) => <div key={user.handle} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold-soft">{user.initials}</span><div><p className="text-sm font-medium text-ink">{user.name}</p><p className="text-xs text-ink-muted">{user.handle} · {user.location}</p></div></div><div className="flex items-center gap-4"><span className="badge-gold">{user.plan}</span><button onClick={() => action(`Actions de modération ouvertes pour ${user.name}`)} className="btn-ghost px-3 py-2 text-xs">Gérer</button></div></div>)}</div></div></section>;

  if (section === "projects") return <section className="space-y-6"><div><h2 className="font-display text-2xl font-semibold text-ink">Projets</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro[section]}</p></div><div className="grid gap-4 xl:grid-cols-3">{([["À approuver", "12", ["Atlas Notes", "GreenCart"]], ["En développement", "68", ["LynoraLink", "Shipfast"]], ["Lancé", "34", ["Kairo Studio", "FolioKit"]]] as [string, string, string[]][]).map(([label, count, items], index) => <div key={label} className="rounded-xl border border-midnight-border bg-midnight-card/60 p-4"><div className="flex items-center justify-between border-b border-midnight-border/70 pb-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-amber-300" : index === 1 ? "bg-gold" : "bg-emerald-300"}`} /><h3 className="text-sm font-semibold text-ink">{label}</h3></div><span className="text-xs text-ink-muted">{count}</span></div><div className="mt-3 space-y-2">{items.map((item) => <button key={item} onClick={() => action(`${item} sélectionné`)} className="flex w-full items-center justify-between rounded-lg border border-midnight-border/70 bg-midnight-deep/50 px-3 py-3 text-left text-sm text-ink transition hover:border-gold/40"><span>{item}</span><ArrowUpRight size={14} className="text-ink-muted" /></button>)}</div><button onClick={() => action(`${label} ouvert`)} className="mt-4 text-xs font-semibold text-gold-soft">Voir les projets →</button></div>)}</div></section>;

  if (section === "teams") return <section className="space-y-6"><div className="flex items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold text-ink">Équipes</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro[section]}</p></div><span className="badge-gold">128 équipes actives</span></div><div className="card overflow-hidden"><div className="grid grid-cols-[1.4fr_1fr_1fr_auto] border-b border-midnight-border bg-midnight-deep/50 px-5 py-3 text-[10px] uppercase tracking-wider text-ink-muted"><span>Équipe</span><span>Membres</span><span>Activité</span><span /></div>{[["Northstar Collective", "8 membres", "Très active"], ["Studio Élan", "4 membres", "Active"], ["Build & Bloom", "6 membres", "À relancer"], ["Makers United", "12 membres", "Très active"]].map(([name, members, activity]) => <div key={name} className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center border-b border-midnight-border/60 px-5 py-4 text-sm last:border-0"><span className="font-medium text-ink">{name}</span><span className="text-xs text-ink-muted">{members}</span><span className={`text-xs ${activity === "À relancer" ? "text-amber-300" : "text-emerald-300"}`}>{activity}</span><button onClick={() => action(`Équipe ${name} ouverte`)} className="rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-gold-soft"><ArrowUpRight size={16} /></button></div>)}</div><div className="rounded-xl border border-gold/20 bg-gold/5 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-gold-soft"><ShieldCheck size={17} /> 9 demandes de collaboration en attente</div><p className="mt-2 text-xs text-ink-muted">Les responsables attendent une validation pour rejoindre leurs équipes.</p></div></section>;

  if (section === "posts") return <section className="space-y-6"><div className="flex items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold text-ink">Publications</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro[section]}</p></div><div className="flex gap-2"><span className="badge">Tous · 27,610</span><span className="badge-gold">Signalés · 18</span></div></div><div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><div className="card divide-y divide-midnight-border/60">{[["Sophie Martin", "La première version de notre onboarding est enfin live.", "3 signalements"], ["@buildwithamara", "Recherche un co-builder côté design pour notre MVP.", "1 signalement"], ["Lucas Bernard", "Retour d'expérience après 30 jours de build in public.", "À vérifier"]].map(([author, excerpt, report]) => <article key={author} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-ink">{author}</p><p className="mt-2 text-sm leading-relaxed text-ink-muted">{excerpt}</p></div><span className="badge">{report}</span></div><div className="mt-4 flex gap-2"><button onClick={() => action("Publication approuvée")} className="btn-outline px-3 py-2 text-xs">Approuver</button><button onClick={() => action("Publication masquée")} className="btn-ghost px-3 py-2 text-xs">Masquer</button></div></article>)}</div><div className="card p-5"><h3 className="text-sm font-semibold text-ink">Répartition des posts</h3><div className="mx-auto mt-6 grid h-36 w-36 place-items-center rounded-full" style={{ background: "conic-gradient(#12A98C 0 46%, #6ee7b7 46% 72%, #64748b 72% 100%)" }}><div className="grid h-24 w-24 place-items-center rounded-full bg-midnight-card text-center"><strong className="font-display text-xl text-ink">27.6k</strong><span className="text-[10px] text-ink-muted">publications</span></div></div><div className="mt-6 space-y-3 text-xs">{[["Personnel", "46%", "bg-gold"], ["Équipe", "26%", "bg-emerald-300"], ["Projet", "28%", "bg-slate-400"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between"><span className="flex items-center gap-2 text-ink-muted"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span><strong className="text-ink">{value}</strong></div>)}</div></div></div></section>;

  if (section === "revenue") return <section className="space-y-6"><div><h2 className="font-display text-2xl font-semibold text-ink">Monétisation</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro[section]}</p></div><div className="grid gap-4 sm:grid-cols-3"><div className="card border-gold/30 p-5"><p className="text-xs text-ink-muted">Revenus mensuels</p><p className="mt-2 font-display text-3xl text-ink">$42,680</p><p className="mt-2 text-xs text-emerald-300">+23.5% vs mois dernier</p></div><div className="card p-5"><p className="text-xs text-ink-muted">Abonnés Premium</p><p className="mt-2 font-display text-3xl text-ink">4,218</p><p className="mt-2 text-xs text-gold-soft">22.9% de conversion</p></div><div className="card p-5"><p className="text-xs text-ink-muted">Boosts actifs</p><p className="mt-2 font-display text-3xl text-ink">186</p><p className="mt-2 text-xs text-ink-muted">$7,350 générés</p></div></div><div className="card p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-ink">Revenus par source</h3><p className="mt-1 text-xs text-ink-muted">Performance du mois en cours</p></div><button onClick={() => action("Rapport financier téléchargé")} className="btn-ghost px-3 py-2 text-xs">Télécharger le rapport</button></div><div className="mt-6 space-y-5">{[["Abonnements", "$24,240", 82], ["Marketplace", "$11,090", 48], ["Boosts", "$7,350", 32], ["Live Huddles", "$2,180", 18]].map(([label, value, width]) => <div key={label}><div className="flex justify-between text-sm"><span className="text-ink-muted">{label}</span><strong className="text-ink">{value}</strong></div><div className="mt-2 h-3 rounded-full bg-midnight-border"><div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: `${width}%` }} /></div></div>)}</div></div></section>;

  return <section className="space-y-6"><div><h2 className="font-display text-2xl font-semibold text-ink">Analytics</h2><p className="mt-1 text-sm text-ink-muted">{sectionIntro.analytics}</p></div><div className="grid gap-4 sm:grid-cols-3"><div className="card p-5"><Activity size={18} className="text-gold" /><p className="mt-4 text-xs text-ink-muted">Rétention à 30 jours</p><p className="mt-1 text-2xl font-semibold text-ink">68.4%</p></div><div className="card p-5"><Globe2 size={18} className="text-gold" /><p className="mt-4 text-xs text-ink-muted">Régions actives</p><p className="mt-1 text-2xl font-semibold text-ink">42</p></div><div className="card p-5"><BarChart3 size={18} className="text-gold" /><p className="mt-4 text-xs text-ink-muted">Engagement moyen</p><p className="mt-1 text-2xl font-semibold text-ink">7.8%</p></div></div><div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="card p-5"><h3 className="text-sm font-semibold text-ink">Croissance comparative</h3><p className="mt-1 text-xs text-ink-muted">Utilisateurs vs projets créés</p><LineChart /></div><div className="card p-5"><h3 className="text-sm font-semibold text-ink">Heatmap d&apos;activité</h3><div className="mt-5 grid grid-cols-7 gap-1.5">{Array.from({ length: 49 }, (_, index) => <span key={index} className={`aspect-square rounded-sm ${[3, 8, 13, 17, 26, 32, 39, 43].includes(index) ? "bg-gold" : [2, 11, 18, 21, 29, 35, 47].includes(index) ? "bg-gold/50" : "bg-midnight-border/70"}`} />)}</div><div className="mt-5 flex items-center justify-between text-[10px] text-ink-muted"><span>Faible</span><span>Activité forte</span></div></div></div></section>;
}

type AdminListing = {
  id: string;
  title: string;
  description: string;
  type: string;
  priceCents: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  seller: { id: string; name: string | null; email: string; handle: string | null };
};

function AdminMarketplaceSkeleton() {
  return <section className="space-y-5" aria-busy="true" aria-label="Chargement des annonces">
    <header className="space-y-2"><div className="skeleton h-7 w-56 max-w-full" /><div className="skeleton h-3.5 w-80 max-w-full" /></header>
    <div className="divide-y divide-midnight-border border-y border-midnight-border">
      {Array.from({ length: 4 }).map((_, index) => <article key={index} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><div className="skeleton h-4 w-48 max-w-full" /><div className="skeleton h-5 w-20 rounded-full" /></div><div className="skeleton h-3 w-64 max-w-full" /><div className="skeleton h-3.5 w-full" /><div className="skeleton h-3.5 w-3/4" /></div>
        <div className="flex shrink-0 items-center gap-2"><div className="skeleton h-4 w-16" /><div className="skeleton h-9 w-20 rounded-md" /><div className="skeleton h-9 w-16 rounded-md" /></div>
      </article>)}
    </div>
  </section>;
}

function AdminMarketplaceSection({ notify }: { notify: (message: string) => void }) {
  const [error, setError] = useState("");
  const listings = useQuery({
    queryKey: ["admin-marketplace-items"],
    queryFn: async () => {
      const response = await fetch("/api/admin/marketplace");
      if (!response.ok) throw new Error("LISTINGS_LOAD_FAILED");
      return response.json() as Promise<{ items: AdminListing[] }>;
    },
  });

  async function reviewListing(itemId: string, approved: boolean) {
    setError("");
    const response = await fetch("/api/admin/marketplace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, approved }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(approved ? "Impossible d’approuver cette annonce." : "Impossible de refuser cette annonce.");
      return;
    }
    notify(approved ? `Annonce « ${body.item.title} » approuvée et publiée.` : `Annonce « ${body.item.title} » refusée et masquée.`);
    void listings.refetch();
  }

  if (listings.isLoading) return <AdminMarketplaceSkeleton />;

  return <section className="space-y-5">
    <div><h2 className="font-display text-2xl font-semibold text-ink">Annonces marketplace</h2><p className="mt-1 text-sm text-ink-muted">Les nouvelles annonces sont masquées jusqu’à leur approbation.</p></div>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {listings.isLoading ? <AdminMarketplaceSkeleton /> : listings.isError ? <p role="alert" className="text-sm text-rose-300">Impossible de charger les annonces.</p> : listings.data?.items.length ? <div className="divide-y divide-midnight-border border-y border-midnight-border">{listings.data.items.map((item) => <article key={item.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-ink">{item.title}</h3><span className={item.isActive ? "badge-gold" : "badge"}>{item.isActive ? "Publiée" : "En attente / masquée"}</span></div>
        <p className="mt-1 text-xs text-ink-muted">{item.type.replace("_", " ")} · {item.seller.handle ? `@${item.seller.handle}` : item.seller.name ?? item.seller.email} · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</p>
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{item.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-2 text-sm font-medium text-gold-soft">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: item.currency.toUpperCase() }).format(item.priceCents / 100)}</span>
        <button type="button" disabled={item.isActive} onClick={() => void reviewListing(item.id, true)} className="btn-outline !rounded-md !px-3 !py-2 text-xs disabled:opacity-40">Approuver</button>
        <button type="button" disabled={!item.isActive} onClick={() => void reviewListing(item.id, false)} className="btn-ghost !rounded-md !px-3 !py-2 text-xs disabled:opacity-40">Refuser</button>
      </div>
    </article>)}</div> : <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">Aucune annonce à examiner.</p>}
  </section>;
}

function AdminEmailSection({ notify }: { notify: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "EMAIL_SEND_FAILED");
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      notify(body.previewOnly ? "Aperçu journalisé localement; aucun e-mail n’a été envoyé." : `E-mail envoyé à ${to}.`);
      setTo("");
      setSubject("");
      setMessage("");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "EMAIL_SEND_FAILED";
      setError(code === "EMAIL_DAILY_LIMIT" ? "Limite quotidienne de 20 e-mails atteinte." : "L’e-mail n’a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  }

  return <section className="max-w-3xl space-y-5">
    <div><h2 className="font-display text-2xl font-semibold text-ink">E-mail de notification</h2><p className="mt-1 text-sm text-ink-muted">Envoi réservé aux administrateurs. Limite : 20 e-mails par jour.</p></div>
    <form onSubmit={submitEmail} className="space-y-4 border-y border-midnight-border py-5">
      <label className="block"><span className="label">Destinataire</span><input required type="email" maxLength={254} value={to} onChange={(event) => setTo(event.target.value)} className="input" placeholder="membre@example.com" /></label>
      <label className="block"><span className="label">Objet</span><input required minLength={3} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} className="input" /></label>
      <label className="block"><span className="label">Message</span><textarea required minLength={3} maxLength={5000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} className="input resize-y" /></label>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={sending} className="btn-gold disabled:opacity-60">{sending ? "Envoi…" : "Envoyer l’e-mail"}</button>
    </form>
    <p className="text-xs text-ink-muted">En local, configurez RESEND_API_KEY dans l’environnement de l’API pour envoyer réellement les e-mails; sans cette clé, seul un aperçu est journalisé.</p>
  </section>;
}

type AdminFeedbackData = {
  summary: {
    reviews: number;
    averageRating: number;
    ratingCounts: Record<string, number>;
    polls: Record<string, number>;
    pollVotes: number;
    starVotes: number;
    projectFeedback: number;
  };
  reviews: {
    id: string;
    targetId: string;
    rating: number;
    label: string;
    comment: string | null;
    createdAt: string;
    user: { id: string; name: string | null; handle: string | null };
    project: { id: string; title: string; teamName: string | null } | null;
  }[];
  polls: {
    id: string;
    type: "OPTIONS" | "STAR" | "TEXT";
    question: string;
    options: string[];
    createdAt: string;
    post: { id: string; content: string; author: { id: string; name: string | null; handle: string | null } };
    votes: {
      id: string;
      optionIndex: number | null;
      answer: string | null;
      createdAt: string;
      user: { id: string; name: string | null; handle: string | null };
    }[];
    optionResults: { optionIndex: number; votes: number }[];
    _count: { votes: number };
  }[];
  projectFeedback: {
    id: string;
    kind: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string | null; handle: string | null };
    project: { id: string; title: string; teamName: string | null };
  }[];
  pagination: {
    reviews: AdminUserPage["pagination"];
    polls: AdminUserPage["pagination"];
    projectFeedback: AdminUserPage["pagination"];
  };
};

function AdminFeedbackView() {
  const [activeView, setActiveView] = useState<"all" | "reviews" | "polls" | "stars" | "project-feedback">("all");
  const [search, setSearch] = useState("");
  const [reviewsPage, setReviewsPage] = useState(1);
  const [pollsPage, setPollsPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback", deferredSearch, activeView, reviewsPage, pollsPage, feedbackPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        reviewsPage: String(reviewsPage),
        pollsPage: String(pollsPage),
        feedbackPage: String(feedbackPage),
        pollsView: activeView === "stars" ? "stars" : activeView === "polls" ? "polls" : "all",
      });
      if (deferredSearch) params.set("q", deferredSearch);
      const response = await fetch(`/api/admin/feedback?${params}`);
      if (!response.ok) throw new Error("FEEDBACK_LOAD_FAILED");
      return response.json() as Promise<AdminFeedbackData>;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const data = feedbackQuery.data;
  const visiblePolls = data?.polls ?? [];
  const views = [
    { id: "all" as const, label: "Vue d’ensemble", count: data ? data.summary.reviews + (data.summary.polls.OPTIONS ?? 0) + (data.summary.polls.TEXT ?? 0) + (data.summary.polls.STAR ?? 0) + data.summary.projectFeedback : 0 },
    { id: "reviews" as const, label: "Avis", count: data?.summary.reviews ?? 0 },
    { id: "polls" as const, label: "Sondages", count: (data?.summary.polls.OPTIONS ?? 0) + (data?.summary.polls.TEXT ?? 0) },
    { id: "stars" as const, label: "Votes étoile", count: data?.summary.polls.STAR ?? 0 },
    { id: "project-feedback" as const, label: "Retours projet", count: data?.summary.projectFeedback ?? 0 },
  ];
  const summaryCards = data ? [
    { label: "Avis projet", value: data.summary.reviews, detail: `Note moyenne ${data.summary.averageRating.toFixed(1)} / 5`, icon: Star },
    { label: "Votes aux sondages", value: data.summary.pollVotes, detail: `${data.summary.polls.OPTIONS ?? 0} sondages à choix`, icon: BarChart3 },
    { label: "Votes étoile", value: data.summary.starVotes, detail: `${data.summary.polls.STAR ?? 0} sondages de notation`, icon: Star },
    { label: "Retours projet", value: data.summary.projectFeedback, detail: "Idées, questions et bugs", icon: ReviewIcon },
  ] : [];

  if (feedbackQuery.isLoading) return <section className="space-y-5" aria-busy="true" aria-label="Chargement des avis et sondages"><div className="skeleton h-8 w-56" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-24" />)}</div><div className="skeleton h-64" /></section>;
  if (feedbackQuery.isError && !data) return <section className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
    <p role="alert" className="text-sm text-rose-300">Impossible de charger les avis et sondages depuis le serveur.</p>
    <button type="button" onClick={() => void feedbackQuery.refetch()} className="btn-ghost px-3 py-2 text-xs">Réessayer</button>
  </section>;
  if (!data) return null;

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Avis, votes & sondages</h2>
        <p className="mt-1 text-xs text-ink-muted">Avis et retours de la communauté, avec indicateurs globaux.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="admin-feedback-search">Rechercher dans les retours</label>
        <input id="admin-feedback-search" maxLength={100} value={search} onChange={(event) => { setSearch(event.target.value); setReviewsPage(1); setPollsPage(1); setFeedbackPage(1); }} placeholder="Rechercher un projet, un membre..." className="input min-w-0 py-2 text-xs sm:w-64" />
        <button type="button" onClick={() => void feedbackQuery.refetch()} disabled={feedbackQuery.isFetching} className="btn-ghost min-h-10 px-3 py-2 text-xs disabled:opacity-60">
          <LoaderCircle size={14} className={feedbackQuery.isFetching ? "animate-spin" : ""} aria-hidden="true" />
          {feedbackQuery.isFetching ? "Actualisation…" : "Actualiser"}
        </button>
      </div>
    </header>

    <nav aria-label="Filtrer les retours" className="flex gap-2 overflow-x-auto border-b border-midnight-border/70">
      {views.map((view) => <button key={view.id} type="button" onClick={() => { setActiveView(view.id); if (view.id === "reviews") setReviewsPage(1); if (view.id === "polls" || view.id === "stars") setPollsPage(1); if (view.id === "project-feedback") setFeedbackPage(1); }} aria-pressed={activeView === view.id} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-2.5 py-2 text-xs font-medium transition ${activeView === view.id ? "border-gold text-gold-soft" : "border-transparent text-ink-muted hover:text-ink"}`}>
        {view.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${activeView === view.id ? "bg-gold/10 text-gold-soft" : "bg-midnight-card text-ink-muted"}`}>{view.count.toLocaleString("fr-FR")}</span>
      </button>)}
    </nav>
    {feedbackQuery.isFetching && <p role="status" className="text-xs text-ink-muted">Synchronisation des données avec le serveur…</p>}
    {feedbackQuery.isError && <p role="alert" className="text-xs text-rose-300">L’actualisation a échoué. Les dernières données chargées restent affichées.</p>}

    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map(({ label, value, detail, icon: Icon }) => <article key={label} className="card p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-[11px] text-ink-muted">{label}</p><Icon size={14} className="text-gold-soft" aria-hidden="true" /></div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5"><p className="font-display text-xl font-semibold text-ink">{value.toLocaleString("fr-FR")}</p><p className="text-[10px] text-ink-muted">{detail}</p></div>
      </article>)}
    </div>

    {(activeView === "all" || activeView === "reviews") && <section className="card overflow-hidden">
      <header className="border-b border-midnight-border/70 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Star size={15} className="text-gold-soft" /> Notes et avis sur les projets</h3>
      </header>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-5 gap-2 rounded-xl border border-midnight-border bg-midnight-deep/30 p-2 sm:gap-3 sm:px-3">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = data.summary.ratingCounts[String(rating)] ?? 0;
            const percent = data.summary.reviews ? Math.round((count / data.summary.reviews) * 100) : 0;
            return <div key={rating}>
              <div className="flex items-center justify-between gap-1 text-[10px]"><span className="inline-flex items-center gap-1 text-ink-muted"><Star size={10} className="text-gold" />{rating}</span><span className="text-ink-muted">{count}</span></div>
              <div className="mt-1 h-1 rounded-full bg-midnight-border"><div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} /></div>
            </div>;
          })}
        </div>
        {data.reviews.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.reviews.map((review) => <article key={review.id} className="flex min-w-0 gap-3 rounded-xl border border-midnight-border bg-midnight-card/40 p-3 transition hover:border-gold/25">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-gold-soft">
              <Star size={12} aria-hidden="true" />
              <span className="mt-0.5 text-[10px] font-semibold tabular-nums">{review.rating}/5</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="truncate text-xs font-semibold text-ink">{review.user.name ?? (review.user.handle ? `@${review.user.handle}` : "Membre")}</p>
                <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[9px] text-gold-soft">{review.label}</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-ink-muted">{review.project?.title ?? "Projet indisponible"} · {new Date(review.createdAt).toLocaleDateString("fr-FR")}</p>
              {review.comment && (review.comment.length > 180 ? <details className="mt-1">
                <summary className="cursor-pointer list-none text-xs leading-relaxed text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                  <span className="line-clamp-2">{review.comment}</span><span className="mt-1 inline-block text-[10px] font-medium text-gold-soft">Lire l’avis</span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-muted">{review.comment}</p>
              </details> : <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-muted">{review.comment}</p>)}
            </div>
          </article>)}
        </div> : <p className="py-3 text-sm text-ink-muted">{deferredSearch ? "Aucun avis ne correspond à cette recherche." : "Aucun avis enregistré."}</p>}
      </div>
      {data.pagination.reviews.total > 0 && <div className="px-3 pb-3"><AdminPagination {...data.pagination.reviews} onPageChange={setReviewsPage} label="avis" /></div>}
    </section>}

    {(activeView === "all" || activeView === "polls" || activeView === "stars") && <section className="space-y-2">
      <header><h3 className="text-sm font-semibold text-ink">Sondages et votes</h3></header>
      {visiblePolls.length ? <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">{visiblePolls.map((poll) => <article key={poll.id} className="card min-w-0 p-3 transition hover:border-gold/25">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="badge-gold">{poll.type === "STAR" ? "Vote étoile" : poll.type === "TEXT" ? "Réponse libre" : "Sondage"}</span>
          <span className="text-xs text-ink-muted">{poll._count.votes} réponse{poll._count.votes > 1 ? "s" : ""}</span>
        </div>
        <h4 className="mt-2 text-xs font-semibold text-ink">{poll.question}</h4>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-ink-muted">{poll.post.content}</p>
        <p className="mt-0.5 text-[10px] text-ink-muted">{poll.post.author.name ?? (poll.post.author.handle ? `@${poll.post.author.handle}` : "Membre")} · {new Date(poll.createdAt).toLocaleDateString("fr-FR")}</p>
        {poll.type === "TEXT" ? <ul className="mt-2 space-y-1 border-t border-midnight-border pt-2">
          {poll.votes.filter((vote) => vote.answer?.trim()).slice(0, 3).map((vote) => <li key={vote.id} className="rounded-md bg-midnight-deep/50 px-2 py-1.5">
            <p className="line-clamp-2 whitespace-pre-wrap text-[10px] text-ink">{vote.answer}</p>
            <p className="mt-0.5 text-[9px] text-ink-muted">{vote.user.name ?? (vote.user.handle ? `@${vote.user.handle}` : "Membre")}</p>
          </li>)}
          {!poll.votes.some((vote) => vote.answer?.trim()) && <li className="text-xs text-ink-muted">Aucune réponse libre récente.</li>}
          {poll._count.votes > 3 && <li className="text-[9px] text-ink-muted">{poll._count.votes.toLocaleString("fr-FR")} réponses au total · 3 récentes affichées</li>}
        </ul> : <>
          <ul className="mt-2 space-y-1 border-t border-midnight-border pt-2">
          {poll.options.map((option, index) => {
            const count = poll.optionResults.find((result) => result.optionIndex === index)?.votes ?? 0;
            const percent = poll._count.votes ? Math.round((count / poll._count.votes) * 100) : 0;
            return <li key={`${poll.id}-${index}`}>
              <div className="flex justify-between gap-3 text-[10px]"><span className="min-w-0 truncate text-ink-muted">{poll.type === "STAR" ? `${index + 1} ★` : option}</span><span className="shrink-0 text-ink">{count} · {percent}%</span></div>
              <div className="mt-0.5 h-1 rounded-full bg-midnight-border"><div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} /></div>
            </li>;
          })}
          </ul>
          <ul className="mt-2 space-y-1 border-t border-midnight-border pt-2">
          {poll.votes.filter((vote) => vote.optionIndex !== null).slice(0, 3).map((vote) => {
            const selectedOption = vote.optionIndex === null ? null : poll.options[vote.optionIndex];
            const answer = poll.type === "STAR"
              ? vote.optionIndex === null ? "Note non renseignée" : `${vote.optionIndex + 1} / 5 étoiles`
              : selectedOption ?? "Choix indisponible";
            return <li key={vote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-midnight-deep/50 px-2 py-1">
              <span className="text-[10px] text-ink-muted">{vote.user.name ?? (vote.user.handle ? `@${vote.user.handle}` : "Membre")}</span>
              <span className="text-[10px] font-medium text-ink">{answer}</span>
            </li>;
          })}
          {!poll.votes.some((vote) => vote.optionIndex !== null) && <li className="text-xs text-ink-muted">Aucun vote récent à afficher.</li>}
          {poll._count.votes > 3 && <li className="text-[9px] text-ink-muted">{poll._count.votes.toLocaleString("fr-FR")} votes au total · 3 récents affichés</li>}
          </ul>
        </>}
      </article>)}</div> : <p className="card p-5 text-sm text-ink-muted">{deferredSearch ? "Aucun résultat pour cette recherche." : "Aucun sondage ou vote enregistré dans cette catégorie."}</p>}
      {data.pagination.polls.total > 0 && <AdminPagination {...data.pagination.polls} onPageChange={setPollsPage} label="sondages" />}
    </section>}

    {(activeView === "all" || activeView === "project-feedback") && <section className="card overflow-hidden">
      <header className="border-b border-midnight-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Retours sur les projets</h3>
      </header>
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.projectFeedback.length ? data.projectFeedback.map((feedback) => <article key={feedback.id} className="min-w-0 rounded-xl border border-midnight-border bg-midnight-card/40 p-3 transition hover:border-gold/25">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">{feedback.project.teamName ?? feedback.project.title}</p>
            <span className="badge">{feedback.kind}</span>
          </div>
          {feedback.content.length > 180 ? <details className="mt-1">
            <summary className="cursor-pointer list-none text-xs leading-relaxed text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
              <span className="line-clamp-2">{feedback.content}</span><span className="mt-1 inline-block text-[10px] font-medium text-gold-soft">Lire le retour</span>
            </summary>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-muted">{feedback.content}</p>
          </details> : <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-muted">{feedback.content}</p>}
          <p className="mt-1 text-[10px] text-ink-muted">{feedback.author.name ?? (feedback.author.handle ? `@${feedback.author.handle}` : "Membre")} · {new Date(feedback.createdAt).toLocaleDateString("fr-FR")}</p>
        </article>) : <p className="py-3 text-sm text-ink-muted sm:col-span-2 xl:col-span-3">{deferredSearch ? "Aucun résultat pour cette recherche." : "Aucun retour projet enregistré."}</p>}
      </div>
      {data.pagination.projectFeedback.total > 0 && <div className="px-3 pb-3"><AdminPagination {...data.pagination.projectFeedback} onPageChange={setFeedbackPage} label="retours" /></div>}
    </section>}
  </section>;
}

function smoothChartPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const next = points[index + 1];
    const previous = points[index - 1] ?? point;
    const following = points[index + 2] ?? next;
    const controlOne = { x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6 };
    const controlTwo = { x: next.x - (following.x - point.x) / 6, y: next.y - (following.y - point.y) / 6 };
    const segment = `C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
    return index === 0 ? `M ${point.x} ${point.y} ${segment}` : `${path} ${segment}`;
  }, "");
}

function LiveGrowthChart({ data, comparison }: { data: AdminData["monthlyUserGrowth"]; comparison?: AdminData["monthlyTeamGrowth"] }) {
  const [animated, setAnimated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxValue = Math.max(1, ...data.map((item) => item.users), ...(comparison ?? []).map((item) => item.teams));
  const scaleMax = Math.ceil(maxValue / 4) * 4 || 1;
  const chartBounds = { left: 56, right: 620, top: 20, bottom: 174 };
  const chartPoints = (values: number[]) => values.map((value, index) => ({
    x: data.length < 2 ? (chartBounds.left + chartBounds.right) / 2 : chartBounds.left + (index / (data.length - 1)) * (chartBounds.right - chartBounds.left),
    y: chartBounds.bottom - (value / scaleMax) * (chartBounds.bottom - chartBounds.top),
  }));
  const userPoints = chartPoints(data.map((item) => item.users));
  const teamPoints = comparison ? chartPoints(comparison.map((item) => item.teams)) : [];
  const userPath = smoothChartPath(userPoints);
  const teamPath = smoothChartPath(teamPoints);
  const userArea = userPath ? `${userPath} L ${userPoints[userPoints.length - 1].x} ${chartBounds.bottom} L ${userPoints[0].x} ${chartBounds.bottom} Z` : "";
  const selectedIndex = activeIndex ?? Math.max(0, data.length - 1);
  const selectedPoint = userPoints[selectedIndex];

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReducedMotion);
    setAnimated(false);
    if (prefersReducedMotion) {
      setAnimated(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setAnimated(true));
    return () => window.cancelAnimationFrame(frame);
  }, [data, comparison]);

  return <div className="relative mt-4 h-64 w-full">
    {data.length ? <>
      <div className="pointer-events-none absolute right-1 top-0 z-10 rounded-xl border border-midnight-border bg-midnight-card/95 px-3 py-2 text-[10px] shadow-lg backdrop-blur">
        <p className="font-medium capitalize text-ink">{data[selectedIndex]?.label}</p>
        <p className="mt-1 text-gold-soft">{data[selectedIndex]?.users.toLocaleString("fr-FR")} nouveaux utilisateurs</p>
        {comparison && <p className="mt-0.5 text-sky-300">{comparison[selectedIndex]?.teams.toLocaleString("fr-FR") ?? 0} nouvelles équipes</p>}
      </div>
      <svg
        viewBox="0 0 640 220"
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label="Évolution mensuelle des inscriptions et des équipes"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (!bounds.width || data.length < 2) return;
          const chartX = ((event.clientX - bounds.left) / bounds.width) * 640;
          const index = Math.round(((chartX - chartBounds.left) / (chartBounds.right - chartBounds.left)) * (data.length - 1));
          setActiveIndex(Math.min(data.length - 1, Math.max(0, index)));
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="admin-growth-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#12A98C" stopOpacity=".28" /><stop offset="1" stopColor="#12A98C" stopOpacity=".015" /></linearGradient>
          <linearGradient id="admin-growth-line" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#E4C477" /><stop offset="1" stopColor="#12A98C" /></linearGradient>
          <filter id="admin-growth-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 1, 2, 3, 4].map((step) => {
          const y = chartBounds.bottom - (step / 4) * (chartBounds.bottom - chartBounds.top);
          const value = Math.round((step / 4) * scaleMax);
          return <g key={step}>
            <line x1={chartBounds.left} x2={chartBounds.right} y1={y} y2={y} stroke="rgba(148,163,184,.15)" strokeDasharray={step === 0 ? undefined : "3 5"} vectorEffect="non-scaling-stroke" />
            <text x="44" y={y + 3} textAnchor="end" fill="rgba(148,163,184,.75)" fontSize="9">{value.toLocaleString("fr-FR")}</text>
          </g>;
        })}
        {data.map((item, index) => <text key={item.label} x={userPoints[index].x} y="203" textAnchor="middle" fill="rgba(148,163,184,.8)" fontSize="10" className="capitalize">{item.label}</text>)}
        <path d={userArea} fill="url(#admin-growth-area)" style={{ opacity: animated ? 1 : 0, transition: reducedMotion ? "none" : "opacity 700ms ease-out" }} />
        {selectedPoint && <line x1={selectedPoint.x} x2={selectedPoint.x} y1={chartBounds.top} y2={chartBounds.bottom} stroke="rgba(212,175,55,.25)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
        <path d={userPath} fill="none" stroke="url(#admin-growth-line)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" strokeDasharray="1" strokeDashoffset={animated ? 0 : 1} style={{ transition: reducedMotion ? "none" : "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }} />
        {comparison && <path d={teamPath} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" strokeDasharray="1" strokeDashoffset={animated ? 0 : 1} style={{ transition: reducedMotion ? "none" : "stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)" }} />}
        {userPoints.map((point, index) => <g key={`user-${index}`} style={{ opacity: animated ? 1 : 0, transition: reducedMotion ? "none" : `opacity 350ms ease-out ${index * 90}ms` }}>
          <circle cx={point.x} cy={point.y} r={index === selectedIndex ? "9" : "6"} fill="#22B8D4" opacity=".16" />
          <circle cx={point.x} cy={point.y} r={index === selectedIndex ? "4.5" : "3.5"} fill="#F6D889" stroke="#171717" strokeWidth="1.5" filter={index === selectedIndex ? "url(#admin-growth-glow)" : undefined} />
          <title>{`${data[index].label}: ${data[index].users} inscriptions`}</title>
        </g>)}
        {comparison && teamPoints.map((point, index) => <g key={`team-${index}`} style={{ opacity: animated ? 1 : 0, transition: reducedMotion ? "none" : `opacity 350ms ease-out ${index * 90}ms` }}>
          <circle cx={point.x} cy={point.y} r={index === selectedIndex ? "4" : "2.5"} fill="#7DD3FC" stroke="#171717" strokeWidth="1.5" />
          <title>{`${comparison[index]?.label}: ${comparison[index]?.teams ?? 0} équipes`}</title>
        </g>)}
      </svg>
    </> : <div className="grid h-full place-items-center text-xs text-ink-muted">Aucune inscription sur cette période.</div>}
  </div>;
}

function LiveProjectStatusChart({ counts }: { counts: AdminData["projectStatusCounts"] }) {
  const items = [
    { key: "IDEA", label: "Idée", color: "bg-gold/50" },
    { key: "DEVELOPMENT", label: "En développement", color: "bg-gold" },
    { key: "LAUNCHED", label: "Lancé", color: "bg-emerald-400" },
  ].map((item) => ({ ...item, value: counts[item.key] ?? 0 }));
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return <div className="flex h-48 items-end justify-around gap-3 border-b border-midnight-border/70 px-2 pb-6 pt-5">
    {items.map((item) => <div key={item.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
      <div className={`w-full max-w-14 rounded-t-md ${item.color}`} style={{ height: `${item.value ? Math.max(4, (item.value / maxValue) * 100) : 0}%` }} />
      <span className="text-center text-[10px] text-ink-muted">{item.label}</span>
    </div>)}
  </div>;
}

function AdminOverview({ data, query, setQuery, openUsers }: { data: AdminData; query: string; setQuery: (value: string) => void; openUsers: () => void }) {
  const [usersPage, setUsersPage] = useState(1);
  const search = query.trim();
  const recentUsersQuery = useQuery({
    queryKey: ["admin-users", "overview", usersPage, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(usersPage), pageSize: "5" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("USERS_LOAD_FAILED");
      return response.json() as Promise<AdminUserPage>;
    },
  });
  const statValues = [
    data.stats.activeUsers.toLocaleString("fr-FR"),
    data.stats.projects.toLocaleString("fr-FR"),
    data.stats.posts.toLocaleString("fr-FR"),
    (data.stats.marketplaceRevenue / 100).toLocaleString("fr-FR", { style: "currency", currency: "USD" }),
  ];
  const maxLocationCount = Math.max(1, ...data.geoDistribution.map((item) => item.users));
  const projectTotal = Object.values(data.projectStatusCounts).reduce((total, count) => total + count, 0);
  const launchRate = projectTotal ? Math.round(((data.projectStatusCounts.LAUNCHED ?? 0) / projectTotal) * 100) : 0;

  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, icon: Icon }, index) => <div key={label} className="card p-5">
        <div className="flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold"><Icon size={18} aria-hidden="true" /></span><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{index === 3 ? "Ce mois" : "Total actuel"}</span></div>
        <p className="mt-5 text-xs text-ink-muted">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{statValues[index]}</p>
      </div>)}
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-ink">Croissance de la communauté</h2><p className="mt-1 text-xs text-ink-muted">Nouvelles inscriptions sur les six derniers mois</p></div><span className="badge">6 mois</span></div><LiveGrowthChart data={data.monthlyUserGrowth} /></section>
      <section className="card p-5"><h2 className="text-sm font-semibold text-ink">Projets par statut</h2><p className="mt-1 text-xs text-ink-muted">{projectTotal.toLocaleString("fr-FR")} projets au total</p><LiveProjectStatusChart counts={data.projectStatusCounts} /><div className="mt-4 flex justify-between text-xs"><span className="text-ink-muted">Projets lancés</span><strong className="text-emerald-300">{launchRate}%</strong></div></section>
    </div>

    <section className="card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border/70 p-5"><div><h2 className="text-sm font-semibold text-ink">Utilisateurs récents</h2><p className="mt-1 text-xs text-ink-muted">Dernières inscriptions enregistrées</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={query} onChange={(event) => { setQuery(event.target.value); setUsersPage(1); }} placeholder="Rechercher..." className="input min-w-0 flex-1 py-2 text-xs sm:w-44 sm:flex-none" /><button onClick={() => { setQuery(""); setUsersPage(1); }} className="btn-ghost px-3 py-2 text-xs">Réinitialiser</button></div></div>
      {recentUsersQuery.isLoading ? <div className="divide-y divide-midnight-border/60 px-5" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><div className="skeleton h-9 w-9 rounded-full" /><div className="space-y-2"><div className="skeleton h-3 w-32" /><div className="skeleton h-3 w-24" /></div></div><div className="skeleton h-5 w-16 rounded-full" /></div>)}</div>
        : recentUsersQuery.isError ? <p role="alert" className="border-t border-midnight-border px-5 py-8 text-center text-sm text-rose-300">Impossible de charger les utilisateurs.</p>
          : recentUsersQuery.data?.users.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-midnight-deep/50 text-[10px] uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3 font-medium">Membre</th><th className="px-5 py-3 font-medium">Localisation</th><th className="px-5 py-3 font-medium">Statut</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-midnight-border/60">{recentUsersQuery.data.users.map((user) => {
        const name = user.name ?? user.email;
        const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
        return <tr key={user.id} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold-soft">{initials}</span><div><p className="font-medium text-ink">{name}</p><p className="text-xs text-ink-muted">{user.handle ? `@${user.handle}` : user.email}</p></div></div></td><td className="px-5 py-4 text-xs text-ink-muted">{user.city ?? user.location ?? "Non renseignée"}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs ${user.isOnline ? "text-emerald-300" : "text-ink-muted"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{user.isOnline ? "En ligne" : "Hors ligne"}</span></td><td className="px-5 py-4 text-right"><button onClick={openUsers} className="text-xs font-medium text-gold-soft hover:text-gold-bright">Gérer</button></td></tr>;
      })}</tbody></table></div> : <p className="border-t border-midnight-border px-5 py-8 text-center text-sm text-ink-muted">{search ? "Aucun utilisateur ne correspond à la recherche." : "Aucun utilisateur récent."}</p>}
      {!recentUsersQuery.isLoading && !recentUsersQuery.isError && recentUsersQuery.data?.pagination && <div className="px-5 pb-5"><AdminPagination {...recentUsersQuery.data.pagination} onPageChange={setUsersPage} label="utilisateurs" /></div>}
    </section>

    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card p-5"><div className="flex items-center gap-2"><Globe2 size={17} className="text-gold" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Activité géographique</h2></div><div className="mt-5 space-y-4">{data.geoDistribution.length ? data.geoDistribution.slice(0, 5).map((region) => <div key={region.location}><div className="flex justify-between text-xs"><span className="text-ink-muted">{region.location}</span><strong className="text-ink">{region.users.toLocaleString("fr-FR")}</strong></div><div className="mt-2 h-2 rounded-full bg-midnight-border"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(4, (region.users / maxLocationCount) * 100)}%` }} /></div></div>) : <p className="text-sm text-ink-muted">Aucune localisation renseignée.</p>}</div></div>
      <div className="card p-5"><h2 className="text-sm font-semibold text-ink">Activité de la plateforme</h2><p className="mt-1 text-xs text-ink-muted">Données enregistrées en base</p><dl className="mt-5 divide-y divide-midnight-border">{[["Ventes marketplace", data.stats.marketplaceSales], ["Boosts actifs", data.stats.activeBoosts], ["Publications signalées", data.stats.reportedPosts]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-3"><dt className="text-xs text-ink-muted">{label}</dt><dd className="text-sm font-semibold tabular-nums text-ink">{Number(value).toLocaleString("fr-FR")}</dd></div>)}</dl></div>
    </section>
  </>;
}

function AdminLiveSectionView(props: { section: Exclude<Section, "overview" | "users" | "marketplace" | "communications">; data: AdminData }) {
  if (props.section === "projects" || props.section === "teams" || props.section === "posts") {
    return <AdminManagement section={props.section} />;
  }
  return <AdminLiveDashboardView {...props} />;
}

const geoCountryCatalog: { code: string; name: string; aliases: string[]; continent: string; lat: number; lon: number }[] = [
  { code: "MG", name: "Madagascar", aliases: ["madagascar"], continent: "Afrique", lat: -19, lon: 47 },
  { code: "FR", name: "France", aliases: ["france"], continent: "Europe", lat: 46, lon: 2 },
  { code: "US", name: "États-Unis", aliases: ["etats-unis", "united states", "usa", "us"], continent: "Amériques", lat: 39, lon: -98 },
  { code: "CA", name: "Canada", aliases: ["canada"], continent: "Amériques", lat: 57, lon: -106 },
  { code: "GB", name: "Royaume-Uni", aliases: ["royaume-uni", "united kingdom", "uk", "great britain"], continent: "Europe", lat: 55, lon: -3 },
  { code: "DE", name: "Allemagne", aliases: ["allemagne", "germany"], continent: "Europe", lat: 51, lon: 10 },
  { code: "ES", name: "Espagne", aliases: ["espagne", "spain"], continent: "Europe", lat: 40, lon: -4 },
  { code: "PT", name: "Portugal", aliases: ["portugal"], continent: "Europe", lat: 39, lon: -8 },
  { code: "IT", name: "Italie", aliases: ["italie", "italy"], continent: "Europe", lat: 42, lon: 12 },
  { code: "BE", name: "Belgique", aliases: ["belgique", "belgium"], continent: "Europe", lat: 51, lon: 4 },
  { code: "CH", name: "Suisse", aliases: ["suisse", "switzerland"], continent: "Europe", lat: 47, lon: 8 },
  { code: "NL", name: "Pays-Bas", aliases: ["pays-bas", "netherlands"], continent: "Europe", lat: 52, lon: 5 },
  { code: "MA", name: "Maroc", aliases: ["maroc", "morocco"], continent: "Afrique", lat: 32, lon: -6 },
  { code: "SN", name: "Sénégal", aliases: ["senegal", "sénégal"], continent: "Afrique", lat: 14, lon: -14 },
  { code: "CI", name: "Côte d’Ivoire", aliases: ["cote d'ivoire", "cote divoire", "ivory coast"], continent: "Afrique", lat: 7, lon: -5 },
  { code: "NG", name: "Nigeria", aliases: ["nigeria"], continent: "Afrique", lat: 9, lon: 8 },
  { code: "KE", name: "Kenya", aliases: ["kenya"], continent: "Afrique", lat: 0, lon: 38 },
  { code: "ZA", name: "Afrique du Sud", aliases: ["afrique du sud", "south africa"], continent: "Afrique", lat: -29, lon: 24 },
  { code: "MU", name: "Maurice", aliases: ["maurice", "mauritius"], continent: "Afrique", lat: -20, lon: 58 },
  { code: "IN", name: "Inde", aliases: ["inde", "india"], continent: "Asie", lat: 22, lon: 79 },
  { code: "JP", name: "Japon", aliases: ["japon", "japan"], continent: "Asie", lat: 36, lon: 138 },
  { code: "SG", name: "Singapour", aliases: ["singapour", "singapore"], continent: "Asie", lat: 1, lon: 104 },
  { code: "ID", name: "Indonésie", aliases: ["indonesie", "indonesia"], continent: "Asie", lat: -2, lon: 118 },
  { code: "PH", name: "Philippines", aliases: ["philippines"], continent: "Asie", lat: 13, lon: 122 },
  { code: "AU", name: "Australie", aliases: ["australie", "australia"], continent: "Océanie", lat: -25, lon: 133 },
  { code: "BR", name: "Brésil", aliases: ["bresil", "brazil"], continent: "Amériques", lat: -10, lon: -52 },
  { code: "MX", name: "Mexique", aliases: ["mexique", "mexico"], continent: "Amériques", lat: 23, lon: -102 },
];

const geoCityCountryAliases: Record<string, string> = {
  antananarivo: "MG",
  tana: "MG",
  toamasina: "MG",
  tamatave: "MG",
  mahajanga: "MG",
  antsirabe: "MG",
  fianarantsoa: "MG",
  paris: "FR",
  lyon: "FR",
  marseille: "FR",
  londres: "GB",
  london: "GB",
  berlin: "DE",
  madrid: "ES",
  rome: "IT",
  "new york": "US",
  "los angeles": "US",
  toronto: "CA",
  montreal: "CA",
  nairobi: "KE",
  dakar: "SN",
  casablanca: "MA",
  tokyo: "JP",
  mumbai: "IN",
  sydney: "AU",
};

function normalizeGeoLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[’]/g, "'");
}

type GeoMapMarker = { key: string; name: string; users: number; lat: number; lon: number };
type GeoMapCenter = { lat: number; lon: number };
const GEO_TILE_SIZE = 256;
const GEO_MIN_ZOOM = 2;
const GEO_MAX_ZOOM = 8;

function geoToWorldPixel({ lat, lon }: GeoMapCenter, zoom: number) {
  const scale = GEO_TILE_SIZE * (2 ** zoom);
  const safeLatitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLatitude = Math.sin((safeLatitude * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

function worldPixelToGeo({ x, y }: { x: number; y: number }, zoom: number): GeoMapCenter {
  const scale = GEO_TILE_SIZE * (2 ** zoom);
  const normalizedY = Math.PI * (1 - (2 * y) / scale);
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(normalizedY)),
    lon: (x / scale) * 360 - 180,
  };
}

function GeoTileMap({ markers, selectedKey, onSelect }: { markers: GeoMapMarker[]; selectedKey: string | undefined; onSelect: (marker: GeoMapMarker) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [center, setCenter] = useState<GeoMapCenter>({ lat: 0, lon: 0 });
  const [zoom, setZoom] = useState(GEO_MIN_ZOOM);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setMapSize({
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => Math.max(GEO_MIN_ZOOM, Math.min(GEO_MAX_ZOOM, current + (event.deltaY < 0 ? 1 : -1))));
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!markers.length) return;
    const minLon = Math.min(...markers.map((marker) => marker.lon));
    const maxLon = Math.max(...markers.map((marker) => marker.lon));
    const minLat = Math.min(...markers.map((marker) => marker.lat));
    const maxLat = Math.max(...markers.map((marker) => marker.lat));
    setCenter({ lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 });
    const span = Math.max(maxLon - minLon, maxLat - minLat);
    setZoom(span > 100 ? 2 : span > 45 ? 3 : span > 18 ? 4 : span > 6 ? 5 : 4);
  }, [markers]);

  const worldSize = GEO_TILE_SIZE * (2 ** zoom);
  const centerPixel = geoToWorldPixel(center, zoom);
  const tiles = useMemo(() => {
    if (!mapSize.width || !mapSize.height) return [];
    const startX = Math.floor((centerPixel.x - mapSize.width / 2) / GEO_TILE_SIZE);
    const endX = Math.floor((centerPixel.x + mapSize.width / 2) / GEO_TILE_SIZE);
    const startY = Math.floor((centerPixel.y - mapSize.height / 2) / GEO_TILE_SIZE);
    const endY = Math.floor((centerPixel.y + mapSize.height / 2) / GEO_TILE_SIZE);
    const count = 2 ** zoom;
    const result: { key: string; x: number; y: number; left: number; top: number }[] = [];
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      if (tileY < 0 || tileY >= count) continue;
      for (let tileX = startX; tileX <= endX; tileX += 1) {
        const wrappedX = ((tileX % count) + count) % count;
        result.push({
          key: `${zoom}:${tileX}:${tileY}`,
          x: wrappedX,
          y: tileY,
          left: tileX * GEO_TILE_SIZE - (centerPixel.x - mapSize.width / 2),
          top: tileY * GEO_TILE_SIZE - (centerPixel.y - mapSize.height / 2),
        });
      }
    }
    return result;
  }, [centerPixel.x, centerPixel.y, mapSize.height, mapSize.width, zoom]);

  function zoomBy(delta: number) {
    setZoom((current) => Math.max(GEO_MIN_ZOOM, Math.min(GEO_MAX_ZOOM, current + delta)));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("button, a")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setCenter((current) => {
      const pixel = geoToWorldPixel(current, zoom);
      return worldPixelToGeo({ x: pixel.x - deltaX, y: pixel.y - deltaY }, zoom);
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function fitMarkers() {
    if (!markers.length) {
      setCenter({ lat: 0, lon: 0 });
      setZoom(GEO_MIN_ZOOM);
      return;
    }
    const minLon = Math.min(...markers.map((marker) => marker.lon));
    const maxLon = Math.max(...markers.map((marker) => marker.lon));
    const minLat = Math.min(...markers.map((marker) => marker.lat));
    const maxLat = Math.max(...markers.map((marker) => marker.lat));
    setCenter({ lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 });
    const span = Math.max(maxLon - minLon, maxLat - minLat);
    setZoom(span > 100 ? 2 : span > 45 ? 3 : span > 18 ? 4 : span > 6 ? 5 : 4);
  }

  return <div
    ref={mapRef}
    role="region"
    aria-label="Carte interactive de la communauté"
    className={`relative aspect-[2/1] min-h-60 touch-none select-none overflow-hidden rounded-xl border border-midnight-border/80 bg-[#dce4df] ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
  >
    {tiles.map((tile) => <img
      key={tile.key}
      src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none"
      style={{ width: GEO_TILE_SIZE, height: GEO_TILE_SIZE, left: tile.left, top: tile.top }}
    />)}
    {markers.map((marker) => {
      const pixel = geoToWorldPixel(marker, zoom);
      let offsetX = pixel.x - centerPixel.x;
      if (offsetX > worldSize / 2) offsetX -= worldSize;
      if (offsetX < -worldSize / 2) offsetX += worldSize;
      const left = mapSize.width / 2 + offsetX;
      const top = mapSize.height / 2 + pixel.y - centerPixel.y;
      if (left < -24 || left > mapSize.width + 24 || top < -30 || top > mapSize.height + 30) return null;
      const active = marker.key === selectedKey;
      const diameter = Math.max(26, Math.min(44, 24 + Math.sqrt(marker.users) * 3));
      return <button
        key={marker.key}
        type="button"
        title={`${marker.name}: ${marker.users.toLocaleString("fr-FR")} profils`}
        aria-label={`${marker.name}, ${marker.users} profils`}
        aria-pressed={active}
        onClick={(event) => { event.stopPropagation(); onSelect(marker); }}
        className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        style={{ left, top }}
      >
        <span className={`relative grid place-items-center rounded-full border-2 border-white/90 font-semibold text-white shadow-lg transition-transform hover:scale-110 ${active ? "bg-gold" : "bg-sky-600"}`} style={{ width: diameter, height: diameter, boxShadow: "0 2px 12px rgba(15,23,42,.4)" }}>
          <span className="text-[10px] tabular-nums">{marker.users}</span>
          <MapPin size={14} className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-white drop-shadow" aria-hidden="true" />
        </span>
      </button>;
    })}
    <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 shadow-lg backdrop-blur">
      <button type="button" onClick={(event) => { event.stopPropagation(); zoomBy(1); }} aria-label="Zoom avant" disabled={zoom >= GEO_MAX_ZOOM} className="grid h-9 w-9 place-items-center text-lg font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40">+</button>
      <span className="mx-1 border-t border-slate-200" />
      <button type="button" onClick={(event) => { event.stopPropagation(); zoomBy(-1); }} aria-label="Zoom arrière" disabled={zoom <= GEO_MIN_ZOOM} className="grid h-9 w-9 place-items-center text-lg font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40">−</button>
      <span className="mx-1 border-t border-slate-200" />
      <button type="button" onClick={(event) => { event.stopPropagation(); fitMarkers(); }} aria-label="Recentrer la carte" className="grid h-9 w-9 place-items-center text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100">⤢</button>
    </div>
    <div className="absolute bottom-2 left-2 z-20 rounded bg-white/90 px-2 py-1 text-[9px] text-slate-600 shadow-sm">Déplacez la carte · zoom {zoom}</div>
    <div className="absolute bottom-1.5 right-2 z-20 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-slate-600 shadow-sm">
      © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline decoration-slate-400 underline-offset-2">OpenStreetMap</a> contributors
    </div>
  </div>;
}

function AdminGeoInsights({ distribution }: { distribution: AdminData["geoDistribution"] }) {
  const [selectedGeoKey, setSelectedGeoKey] = useState("");
  const locations = useMemo(() => {
    const countries = new Map<string, { key: string; name: string; continent: string; users: number; lat?: number; lon?: number; examples: string[] }>();
    for (const item of distribution) {
      const parts = item.location.split(",").map((part) => part.trim()).filter(Boolean);
      const countryLabel = parts.length > 1 ? parts[parts.length - 1] : item.location.trim();
      const normalizedLabel = normalizeGeoLabel(countryLabel);
      const country = geoCountryCatalog.find((entry) => entry.aliases.includes(normalizedLabel))
        ?? geoCountryCatalog.find((entry) => entry.code === geoCityCountryAliases[normalizedLabel]);
      const key = country?.code ?? (parts.length > 1 ? `other:${normalizeGeoLabel(countryLabel)}` : "other:unspecified");
      const name = country?.name ?? (parts.length > 1 ? countryLabel : "Localisation à préciser");
      const existing = countries.get(key);
      if (existing) {
        existing.users += item.users;
        if (existing.examples.length < 3) existing.examples.push(item.location);
      } else {
        countries.set(key, { key, name, continent: country?.continent ?? "À préciser", users: item.users, lat: country?.lat, lon: country?.lon, examples: [item.location] });
      }
    }
    return [...countries.values()].sort((first, second) => second.users - first.users);
  }, [distribution]);
  const total = locations.reduce((sum, item) => sum + item.users, 0);
  const mapped = useMemo(
    () => locations.filter((item): item is typeof item & { lat: number; lon: number } => item.lat !== undefined && item.lon !== undefined),
    [locations],
  );
  const maxUsers = Math.max(1, ...locations.map((item) => item.users));
  const activeLocation = locations.find((item) => item.key === selectedGeoKey) ?? locations[0];
  const continentCounts = locations.reduce<Record<string, number>>((counts, item) => {
    if (item.continent !== "À préciser") counts[item.continent] = (counts[item.continent] ?? 0) + item.users;
    return counts;
  }, {});
  return <section className="card min-w-0 overflow-hidden" aria-labelledby="admin-analytics-geography">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-midnight-border/70 p-4 sm:p-5">
      <div><h2 id="admin-analytics-geography" className="text-sm font-semibold text-ink">Répartition géographique</h2><p className="mt-1 text-xs text-ink-muted">Localisations regroupées par pays à partir des profils</p></div>
      <span className="rounded-full border border-midnight-border bg-midnight-deep/60 px-2.5 py-1 text-[10px] text-ink-muted">{total.toLocaleString("fr-FR")} profils agrégés</span>
    </header>
    <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,.65fr)]">
      <div className="p-4 sm:p-5">
        <GeoTileMap markers={mapped} selectedKey={activeLocation?.key} onSelect={(marker) => setSelectedGeoKey(marker.key)} />
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(continentCounts).sort((first, second) => second[1] - first[1]).map(([continent, users]) => <span key={continent} className="inline-flex items-center gap-2 rounded-full border border-midnight-border bg-midnight-deep/50 px-2.5 py-1.5 text-[10px] text-ink-muted"><span className="h-1.5 w-1.5 rounded-full bg-gold" />{continent}<strong className="tabular-nums text-ink">{users.toLocaleString("fr-FR")}</strong></span>)}
        </div>
      </div>
      <div className="border-t border-midnight-border/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
        {activeLocation && <div className="mb-4 rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-gold-soft">Localisation sélectionnée</p>
          <p className="mt-2 text-lg font-semibold text-ink">{activeLocation.name}</p>
          <p className="mt-1 text-xs text-ink-muted">{activeLocation.users.toLocaleString("fr-FR")} profils · {total ? Math.round((activeLocation.users / total) * 100) : 0}% des profils agrégés</p>
          {activeLocation.examples.length > 0 && activeLocation.examples[0] !== activeLocation.name && <p className="mt-2 truncate text-[10px] text-ink-muted">{activeLocation.examples.join(" · ")}</p>}
        </div>}
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-ink">Principales localisations</h3><span className="text-[10px] text-ink-muted">{locations.length} groupes</span></div>
        <ol className="mt-3 space-y-3">
          {locations.slice(0, 6).map((item, index) => <li key={item.key}>
            <button type="button" onClick={() => setSelectedGeoKey(item.key)} aria-pressed={activeLocation?.key === item.key} className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
              <span className="flex items-center justify-between gap-3 text-[11px]"><span className="flex min-w-0 items-center gap-2 text-ink-muted group-hover:text-ink"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-semibold ${activeLocation?.key === item.key ? "bg-gold/20 text-gold-soft" : "bg-midnight-card text-ink-muted"}`}>{String(index + 1).padStart(2, "0")}</span><span className="truncate">{item.name}</span></span><strong className="shrink-0 tabular-nums text-ink">{item.users.toLocaleString("fr-FR")}</strong></span>
              <span className="ml-7 mt-2 block h-1 overflow-hidden rounded-full bg-midnight-border"><span className="block h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-[width] duration-700" style={{ width: `${Math.max(3, (item.users / maxUsers) * 100)}%` }} /></span>
            </button>
          </li>)}
          {!locations.length && <li className="py-4 text-xs text-ink-muted">Aucune localisation renseignée.</li>}
        </ol>
      </div>
    </div>
  </section>;
}

function AdminAnalyticsView({ data }: { data: AdminData }) {
  const activeShare = data.stats.users
    ? Math.round((data.stats.activeUsers / data.stats.users) * 100)
    : 0;
  const maxDailyPosts = Math.max(1, ...data.weeklyPostActivity.map((item) => item.posts));
  const maxPostTypeCount = Math.max(1, ...Object.values(data.postTypeCounts));
  const postTypes = [
    { key: "PERSONAL", label: "Personnel", color: "bg-gold" },
    { key: "TEAM", label: "Équipe", color: "bg-sky-400" },
    { key: "PROJECT", label: "Projet", color: "bg-violet-400" },
  ];

  const metrics = [
    { label: "Utilisateurs", value: data.stats.users, detail: "Comptes inscrits", icon: Users, tint: "text-gold-soft", bg: "bg-gold/10" },
    { label: "Actifs aujourd’hui", value: data.stats.activeUsers, detail: `${activeShare}% de la communauté`, icon: Activity, tint: "text-emerald-300", bg: "bg-emerald-300/10" },
    { label: "Projets", value: data.stats.projects, detail: "Espaces de collaboration", icon: FolderKanban, tint: "text-sky-300", bg: "bg-sky-300/10" },
    { label: "Publications", value: data.stats.posts, detail: "Contenus de la plateforme", icon: FileText, tint: "text-violet-300", bg: "bg-violet-300/10" },
  ];

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-soft">Pilotage de la plateforme</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">Suivez la croissance, les contenus et l’engagement de la communauté à partir des données réelles de LynoraLink.</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
        Données actualisées en continu
      </span>
    </header>

    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map(({ label, value, detail, icon: Icon, tint, bg }) => (
        <div key={label} className="card group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gold/30 sm:p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/5 blur-2xl transition group-hover:bg-gold/10" />
          <dt className="relative flex items-center gap-3 text-xs font-medium text-ink-muted">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg} ${tint}`}><Icon size={17} aria-hidden="true" /></span>
            {label}
          </dt>
          <dd className="relative mt-4 font-display text-3xl font-semibold tabular-nums tracking-tight text-ink">{value.toLocaleString("fr-FR")}</dd>
          <p className="relative mt-1 text-[11px] text-ink-muted">{detail}</p>
        </div>
      ))}
    </dl>

    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <section className="card min-w-0 p-4 sm:p-5" aria-labelledby="admin-analytics-growth">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="admin-analytics-growth" className="text-sm font-semibold text-ink">Trajectoire de croissance</h2><p className="mt-1 text-xs text-ink-muted">Nouvelles inscriptions et équipes créées, six derniers mois</p></div>
          <span className="badge">6 mois</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-ink-muted"><span className="inline-flex items-center gap-2"><i className="h-0.5 w-4 bg-gold" />Nouveaux utilisateurs</span><span className="inline-flex items-center gap-2"><i className="h-0.5 w-4 bg-sky-400" />Nouvelles équipes</span></div>
        <LiveGrowthChart data={data.monthlyUserGrowth} comparison={data.monthlyTeamGrowth} />
      </section>

      <section className="card min-w-0 p-4 sm:p-5" aria-labelledby="admin-analytics-projects">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="admin-analytics-projects" className="text-sm font-semibold text-ink">Projets par statut</h2><p className="mt-1 text-xs text-ink-muted">Répartition des projets enregistrés</p></div>
          <span className="font-display text-xl font-semibold tabular-nums text-ink">{data.stats.projects.toLocaleString("fr-FR")}</span>
        </div>
        <LiveProjectStatusChart counts={data.projectStatusCounts} />
      </section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card min-w-0 p-4 sm:p-5" aria-labelledby="admin-analytics-posts">
        <div><h2 id="admin-analytics-posts" className="text-sm font-semibold text-ink">Activité éditoriale</h2><p className="mt-1 text-xs text-ink-muted">Publications approuvées au cours des sept derniers jours</p></div>
        {data.weeklyPostActivity.length ? <div className="mt-5 flex h-48 items-end justify-around gap-2 border-b border-midnight-border/70 px-1 pb-2 sm:gap-3 sm:px-2">
          {data.weeklyPostActivity.map((item) => <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-[10px] tabular-nums text-ink-muted">{item.posts.toLocaleString("fr-FR")}</span>
            <div className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-gold/60 to-gold transition-[height] duration-300" style={{ height: `${Math.max(3, (item.posts / maxDailyPosts) * 100)}%` }} aria-label={`${item.label}: ${item.posts} publications`} />
            <span className="truncate text-[10px] capitalize text-ink-muted">{item.label}</span>
          </div>)}
        </div> : <p className="mt-5 grid h-48 place-items-center text-sm text-ink-muted">Aucune activité récente.</p>}
        <p className="mt-3 text-xs text-ink-muted">Total cette semaine <strong className="ml-1 tabular-nums text-ink">{data.weeklyPostActivity.reduce((total, item) => total + item.posts, 0).toLocaleString("fr-FR")}</strong></p>
      </section>

      <section className="card min-w-0 p-4 sm:p-5" aria-labelledby="admin-analytics-distribution">
        <div><h2 id="admin-analytics-distribution" className="text-sm font-semibold text-ink">Répartition des publications</h2><p className="mt-1 text-xs text-ink-muted">Types de contenus publiés sur la plateforme</p></div>
        <ul className="mt-6 space-y-5">
          {postTypes.map(({ key, label, color }) => {
            const count = data.postTypeCounts[key] ?? 0;
            const percent = data.stats.posts ? Math.round((count / data.stats.posts) * 100) : 0;
            return <li key={key}>
              <div className="flex items-center justify-between gap-3 text-xs"><span className="text-ink-muted">{label}</span><span className="font-semibold tabular-nums text-ink">{count.toLocaleString("fr-FR")} <span className="ml-1 font-normal text-ink-muted">{percent}%</span></span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-midnight-border"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (count / maxPostTypeCount) * 100)}%` }} /></div>
            </li>;
          })}
        </ul>
      </section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card min-w-0 overflow-hidden" aria-labelledby="admin-analytics-engagement">
        <header className="border-b border-midnight-border/70 p-4 sm:p-5"><h2 id="admin-analytics-engagement" className="text-sm font-semibold text-ink">Publications les plus interactives</h2><p className="mt-1 text-xs text-ink-muted">Réactions et commentaires combinés</p></header>
        {data.topInteractivePosts.length ? <ol className="divide-y divide-midnight-border/60">
          {data.topInteractivePosts.slice(0, 5).map((post, index) => <li key={post.id} className="flex items-start gap-3 p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold/10 text-[11px] font-semibold tabular-nums text-gold-soft">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1"><p className="line-clamp-2 break-words text-sm leading-relaxed text-ink">{post.content || "Publication avec média"}</p><p className="mt-1 truncate text-[11px] text-ink-muted">{post.author.handle ? `@${post.author.handle}` : post.author.name ?? "Auteur inconnu"} · {post.type}</p></div>
            <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-gold-soft">{post.interactions.toLocaleString("fr-FR")}</span>
          </li>)}
        </ol> : <p className="p-5 text-sm text-ink-muted">Aucune publication disponible pour le moment.</p>}
      </section>

    </div>
    <AdminGeoInsights distribution={data.geoDistribution} />
  </section>;
}

function AdminLiveDashboardView({ section, data }: { section: Exclude<Section, "overview" | "users" | "marketplace" | "communications">; data: AdminData }) {
  if (section === "analytics") return <AdminAnalyticsView data={data} />;
  if (section === "projects") {
    const stages = [{ key: "IDEA", label: "Idée" }, { key: "DEVELOPMENT", label: "En développement" }, { key: "LAUNCHED", label: "Lancé" }];
    return <section className="space-y-6"><header><h2 className="font-display text-2xl font-semibold text-ink">Projets</h2><p className="mt-1 text-sm text-ink-muted">Projets réels et répartition par statut.</p></header><div className="grid gap-3 sm:grid-cols-3">{stages.map(({ key, label }) => <div key={key} className="card p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-2 font-display text-2xl font-semibold text-ink">{(data.projectStatusCounts[key] ?? 0).toLocaleString("fr-FR")}</p></div>)}</div><section className="border-y border-midnight-border"><h3 className="border-b border-midnight-border py-3 text-sm font-semibold text-ink">Projets récemment modifiés</h3>{data.recentProjects.length ? data.recentProjects.map((project) => <article key={project.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border/60 py-4 last:border-0"><div className="min-w-0"><h4 className="truncate text-sm font-medium text-ink">{project.teamName ?? project.title}</h4><p className="mt-1 line-clamp-1 text-xs text-ink-muted">{project.tagline}</p><p className="mt-1 text-[11px] text-ink-muted">{project.creator.handle ? `@${project.creator.handle}` : project.creator.name ?? "Créateur inconnu"} · {project._count.collaborators} collaborateurs</p></div><span className="badge">{project.status}</span></article>) : <p className="py-8 text-sm text-ink-muted">Aucun projet enregistré.</p>}</section></section>;
  }

  if (section === "teams") return <section className="space-y-6"><header><h2 className="font-display text-2xl font-semibold text-ink">Équipes</h2><p className="mt-1 text-sm text-ink-muted">Équipes associées aux projets enregistrés.</p></header><div className="flex items-end gap-3 border-b border-midnight-border pb-5"><span className="font-display text-4xl font-semibold text-ink">{data.teamCount.toLocaleString("fr-FR")}</span><span className="pb-1 text-sm text-ink-muted">équipes</span></div><section className="divide-y divide-midnight-border border-y border-midnight-border">{data.recentTeams.length ? data.recentTeams.map((team) => <article key={team.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="text-sm font-medium text-ink">{team.teamName ?? team.title}</h3><p className="mt-1 text-xs text-ink-muted">{team._count.collaborators} collaborateurs · {team._count.teamPosts} publications</p></div><span className="badge">{team.status}</span></article>) : <p className="py-8 text-sm text-ink-muted">Aucune équipe enregistrée.</p>}</section></section>;

  if (section === "posts") {
    const postTypes = [{ key: "PERSONAL", label: "Personnel" }, { key: "TEAM", label: "Équipe" }, { key: "PROJECT", label: "Projet" }];
    return <section className="space-y-6"><header><h2 className="font-display text-2xl font-semibold text-ink">Publications</h2><p className="mt-1 text-sm text-ink-muted">Publications signalées et répartition réelle du feed.</p></header><div className="grid gap-3 sm:grid-cols-3">{postTypes.map(({ key, label }) => <div key={key} className="border-y border-midnight-border py-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-2 font-display text-2xl font-semibold text-ink">{(data.postTypeCounts[key] ?? 0).toLocaleString("fr-FR")}</p></div>)}</div><section className="divide-y divide-midnight-border border-y border-midnight-border">{data.reportedPostItems.length ? data.reportedPostItems.map((post) => <article key={post.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">{post.author.handle ? `@${post.author.handle}` : post.author.name ?? "Auteur inconnu"}</p><span className="badge-gold">{post._count.reports} signalement{post._count.reports > 1 ? "s" : ""}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">{post.content}</p><p className="mt-2 text-[11px] text-ink-muted">{post.type} · {new Date(post.createdAt).toLocaleDateString("fr-FR")}</p></article>) : <p className="py-8 text-sm text-ink-muted">Aucune publication signalée.</p>}</section></section>;
  }

  if (section === "revenue") return <section className="space-y-6"><header><h2 className="font-display text-2xl font-semibold text-ink">Monétisation</h2><p className="mt-1 text-sm text-ink-muted">Montants et volumes issus des transactions enregistrées.</p></header><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[{ label: "Ventes marketplace", value: data.stats.marketplaceSales }, { label: "Commissions marketplace ce mois", value: (data.stats.marketplaceRevenue / 100).toLocaleString("fr-FR", { style: "currency", currency: "USD" }) }, { label: "Boosts actifs", value: data.stats.activeBoosts }].map(({ label, value }) => <div key={label} className="border-y border-midnight-border py-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-2 font-display text-2xl font-semibold text-ink">{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</p></div>)}</div></section>;

  return null;
}

function AdminWorkspaceSkeleton() {
  return (
    <div className="-my-6 min-h-[calc(100vh-4rem)] w-full bg-midnight-deep">
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="fixed inset-y-0 left-0 z-50 hidden h-screen w-72 flex-col border-r border-midnight-border bg-midnight-deep p-5 lg:flex" aria-hidden="true">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Logo size={40} withWordmark />
            <div className="mt-6 border-b border-midnight-border/70 pb-5"><div className="skeleton h-3 w-28" /></div>
            <nav className="mt-6 flex flex-col gap-2">
              {navItems.map(({ id }) => <div key={id} className="flex h-10 items-center gap-3 rounded-xl px-3"><div className="skeleton h-4 w-4 rounded-sm" /><div className="skeleton h-3 w-28" /></div>)}
            </nav>
          </div>
          <div className="shrink-0 border-t border-midnight-border/70 pt-4">
            <div className="rounded-xl border border-midnight-border p-4">
              <div className="skeleton h-3 w-32" />
              <div className="mt-3 skeleton h-3 w-full" />
              <div className="mt-2 skeleton h-3 w-4/5" />
              <div className="mt-4 skeleton h-1.5 w-full rounded-full" />
            </div>
            <div className="mt-3 skeleton h-10 w-full rounded-lg" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:ml-72 xl:px-8" aria-busy="true" aria-label="Chargement de l’espace administrateur">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-8 w-56 max-w-full" />
              <div className="skeleton h-3.5 w-80 max-w-full" />
            </div>
            <div className="skeleton h-10 w-28 rounded-lg" />
          </header>

          <div className="mb-7 flex gap-3 overflow-hidden border-b border-midnight-border/70 pb-3 lg:hidden" aria-hidden="true">
            {navItems.slice(0, 5).map(({ id }, index) => <div key={id} className={`skeleton h-3 shrink-0 ${index === 0 ? "w-24" : "w-20"}`} />)}
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
            {stats.map(({ label }, index) => (
              <div key={label} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-3 w-16" />
                </div>
                <div className="mt-5 skeleton h-3 w-28" />
                <div className={`mt-2 skeleton h-7 ${index === 3 ? "w-32" : "w-24"}`} />
                <div className="mt-3 skeleton h-1 w-full rounded-full" />
              </div>
            ))}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]" aria-hidden="true">
            <section className="card p-5">
              <div className="skeleton h-4 w-48" />
              <div className="mt-2 skeleton h-3 w-64 max-w-full" />
              <div className="relative mt-5 h-48 border-b border-midnight-border/70">
                <div className="absolute inset-0 flex flex-col justify-between py-2"><span className="border-t border-midnight-border/60" /><span className="border-t border-midnight-border/60" /><span className="border-t border-midnight-border/60" /><span className="border-t border-midnight-border/60" /></div>
                <div className="absolute inset-x-0 bottom-0 flex h-4/5 items-end justify-around gap-3 px-4">
                  {[35, 54, 42, 72, 58, 88, 76, 100].map((height, index) => <div key={index} className="skeleton w-full max-w-8 rounded-t-sm" style={{ height: `${height}%` }} />)}
                </div>
              </div>
            </section>
            <section className="card p-5">
              <div className="skeleton h-4 w-36" />
              <div className="mt-2 skeleton h-3 w-48 max-w-full" />
              <div className="mt-5 flex h-48 items-end justify-around gap-3 border-b border-midnight-border/70 px-2 pb-6">
                {[42, 68, 34].map((height, index) => <div key={index} className="skeleton w-full max-w-14 rounded-t-sm" style={{ height: `${height}%` }} />)}
              </div>
              <div className="mt-4 flex justify-between"><div className="skeleton h-3 w-28" /><div className="skeleton h-3 w-12" /></div>
            </section>
          </div>

          <section className="card mt-6 overflow-hidden" aria-hidden="true">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border/70 p-5">
              <div><div className="skeleton h-4 w-40" /><div className="mt-2 skeleton h-3 w-52 max-w-full" /></div>
              <div className="flex gap-2"><div className="skeleton h-9 w-40 rounded-lg" /><div className="skeleton h-9 w-24 rounded-lg" /></div>
            </div>
            <div className="space-y-0 divide-y divide-midnight-border/60 px-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[minmax(12rem,1.5fr)_minmax(6rem,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)] items-center gap-4 py-4">
                  <div className="flex items-center gap-3"><div className="skeleton h-9 w-9 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3 w-32 max-w-full" /><div className="skeleton h-3 w-24 max-w-full" /></div></div>
                  <div className="skeleton h-3 w-24 max-w-full" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                  <div className="skeleton h-3 w-14" />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2" aria-hidden="true">
            <section className="card p-5"><div className="skeleton h-4 w-40" /><div className="mt-5 skeleton h-44 w-full rounded-xl" /></section>
            <section className="card space-y-5 p-5"><div className="skeleton h-4 w-36" />{[1, 2, 3].map((item) => <div key={item}><div className="flex justify-between"><div className="skeleton h-3 w-28" /><div className="skeleton h-3 w-16" /></div><div className="mt-2 skeleton h-2 w-full rounded-full" /></div>)}</section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const initializedAdminId = useRef<string | null>(null);
  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    const match = navItems.find((item) => item.id === requestedSection);
    if (match) setActiveSection(match.id);
  }, []);
  const adminQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      let adminId: string | null = null;
      try {
        adminId = window.localStorage.getItem(lastAdminIdKey);
      } catch {
        adminId = null;
      }
      const seenAt = adminId ? readAdminNavSeen(adminId) : {};
      const params = new URLSearchParams();
      if (Object.keys(seenAt).length) params.set("seenAt", JSON.stringify(seenAt));
      const search = params.toString();
      const response = await fetch(`/api/admin${search ? `?${search}` : ""}`);
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      if (response.status === 403) throw new Error("FORBIDDEN");
      if (!response.ok) throw new Error("ADMIN_LOAD_FAILED");
      const data = await response.json() as AdminData;
      saveLastAdminId(data.admin.id);
      return data;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  function openSection(section: Section) {
    setActiveSection(section);
    const adminId = adminQuery.data?.admin.id;
    if (!adminId) return;
    markAdminNavSeen(adminId, section);
    queryClient.setQueryData<AdminData>(["admin-dashboard"], (current) => current
      ? { ...current, navCounts: { ...current.navCounts, [section]: 0 } }
      : current);
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }
  useEffect(() => {
    const adminId = adminQuery.data?.admin.id;
    if (!adminId || initializedAdminId.current === adminId) return;
    initializedAdminId.current = adminId;
    markAdminNavSeen(adminId, "overview");
    queryClient.setQueryData<AdminData>(["admin-dashboard"], (current) => current
      ? { ...current, navCounts: { ...current.navCounts, overview: 0 } }
      : current);
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }, [adminQuery.data?.admin.id, queryClient]);
  useEffect(() => {
    if (adminQuery.error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(adminQuery.error.message)) {
      router.replace(adminQuery.error.message === "UNAUTHORIZED" ? "/login?callbackUrl=/admin" : "/dashboard");
    }
  }, [adminQuery.error, router]);
  const filteredUsers = useMemo(() => (adminQuery.data?.recentUsers ?? [])
    .filter((user) => `${user.name ?? ""} ${user.email} ${user.handle ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .map((user) => {
      const name = user.name ?? user.email;
      return {
        id: user.id,
        name,
        handle: user.handle ? `@${user.handle}` : user.email,
        location: user.city ?? user.location ?? "Non renseignée",
        status: user.isOnline ? "Actif" : "Hors ligne",
        initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      };
    }), [adminQuery.data?.recentUsers, query]);

  const action = (message: string) => {
    setNotice(message);
    void fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: message }) });
    window.setTimeout(() => setNotice(null), 2600);
  };

  if (adminQuery.isLoading) return <AdminWorkspaceSkeleton />;

  return   <div className="-my-6 min-h-[calc(100vh-4rem)] w-full bg-midnight-deep"><div className="flex min-h-[calc(100vh-4rem)]">
    <AdminSidebar activeSection={activeSection} setActiveSection={openSection} data={adminQuery.data} />
    <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:ml-72 xl:px-8">
      {activeSection === "overview" && (
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{overviewHeading.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{overviewHeading.description}</p>
          </div>
          <button onClick={() => action("Export en préparation")} className="btn-ghost">
            <ArrowUpRight size={15} />Exporter
          </button>
        </header>
      )}
      <div className="mb-7 flex gap-2 overflow-x-auto border-b border-midnight-border/70 lg:hidden">{navItems.map(({ id, label, countKey, attention }) => {
        const count = countKey ? adminQuery.data?.navCounts[countKey] : undefined;
        return <button key={id} onClick={() => openSection(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-xs ${activeSection === id ? "border-gold text-gold-soft" : "border-transparent text-ink-muted"}`}>
          {label}
          {typeof count === "number" && count > 0 && <span className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-center text-[10px] font-bold leading-none tabular-nums text-white ${attention ? "bg-rose-400/15" : "bg-midnight-card"}`}>{count > 99 ? "99+" : count.toLocaleString("fr-FR")}</span>}
        </button>;
      })}</div>
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-soft" role="status">{notice}<button onClick={() => setNotice(null)} aria-label="Fermer"><X size={15} /></button></div>}
      {adminQuery.isError && <div className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200" role="alert">{adminQuery.error instanceof Error && adminQuery.error.message === "FORBIDDEN" ? "Accès administrateur requis pour consulter cet espace." : "Impossible de charger les données administrateur."}</div>}
      {adminQuery.isLoading && <div className="mb-5 rounded-xl border border-midnight-border bg-midnight-card/60 px-4 py-3 text-sm text-ink-muted" role="status">Chargement des données de la plateforme…</div>}
      {!adminQuery.isError && activeSection === "users" && <AdminUsersSection query={query} setQuery={setQuery} />}
      {!adminQuery.isError && activeSection === "marketplace" && <AdminSectionView section="marketplace" query={query} setQuery={setQuery} action={action} />}
      {!adminQuery.isError && activeSection === "communications" && <AdminSectionView section="communications" query={query} setQuery={setQuery} action={action} />}
      {!adminQuery.isError && activeSection === "feedback" && <AdminFeedbackView />}
      {!adminQuery.isError && adminQuery.data && activeSection === "projects" && <AdminLiveSectionView section="projects" data={adminQuery.data} />}
      {!adminQuery.isError && adminQuery.data && activeSection === "teams" && <AdminLiveSectionView section="teams" data={adminQuery.data} />}
      {!adminQuery.isError && adminQuery.data && activeSection === "posts" && <AdminLiveSectionView section="posts" data={adminQuery.data} />}
      {!adminQuery.isError && adminQuery.data && activeSection === "revenue" && <AdminLiveSectionView section="revenue" data={adminQuery.data} />}
      {!adminQuery.isError && adminQuery.data && activeSection === "analytics" && <AdminLiveSectionView section="analytics" data={adminQuery.data} />}
      {!adminQuery.isError && adminQuery.data && activeSection === "overview" && <AdminOverview data={adminQuery.data} query={query} setQuery={setQuery} openUsers={() => setActiveSection("users")} />}
      {false && !adminQuery.isError && activeSection === "overview" && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        { ...stats[0], value: (adminQuery.data?.stats.activeUsers ?? 0).toLocaleString("fr-FR") },
        { ...stats[1], value: (adminQuery.data?.stats.projects ?? 0).toLocaleString("fr-FR") },
        { ...stats[2], value: (adminQuery.data?.stats.posts ?? 0).toLocaleString("fr-FR") },
        { ...stats[3], value: `${((adminQuery.data?.stats.marketplaceRevenue ?? 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "USD" })}` },
      ].map(({ label, value, icon: Icon }) => <div key={label} className="card p-5"><div className="flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold"><Icon size={18} /></span><span className="text-xs font-semibold text-emerald-300">Données live</span></div><p className="mt-5 text-xs text-ink-muted">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p><div className="mt-3 h-1 rounded-full bg-midnight-border"><div className="h-full w-3/4 rounded-full bg-gradient-to-r from-gold to-gold-bright" /></div></div>)}</section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]"><section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-ink">Croissance de la communauté</h2><p className="mt-1 text-xs text-ink-muted">Nouveaux utilisateurs sur les six derniers mois</p></div><select className="rounded-lg border border-midnight-border bg-midnight-deep px-2 py-1.5 text-xs text-ink-muted" aria-label="Période"><option>6 derniers mois</option><option>30 derniers jours</option></select></div><LineChart /></section><section className="card p-5"><h2 className="text-sm font-semibold text-ink">Projets par statut</h2><p className="mt-1 text-xs text-ink-muted">3,842 projets au total</p><BarChart /><div className="mt-4 flex justify-between text-xs"><span className="text-ink-muted">Taux de lancement</span><strong className="text-emerald-300">34.2%</strong></div></section></div>
      <section className="card mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border/70 p-5"><div><h2 className="text-sm font-semibold text-ink">Utilisateurs récents</h2><p className="mt-1 text-xs text-ink-muted">Les dernières inscriptions sur la plateforme</p></div><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher..." className="input w-44 py-2 text-xs" /><button onClick={() => setQuery("")} className="btn-ghost px-3 py-2 text-xs">Réinitialiser</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-midnight-deep/50 text-[10px] uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3 font-medium">Membre</th><th className="px-5 py-3 font-medium">Localisation</th><th className="px-5 py-3 font-medium">Statut</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-midnight-border/60">{filteredUsers.map((user) => <tr key={user.handle} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold-soft">{user.initials}</span><div><p className="font-medium text-ink">{user.name}</p><p className="text-xs text-ink-muted">{user.handle}</p></div></div></td><td className="px-5 py-4 text-xs text-ink-muted">{user.location}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs ${user.status === "Actif" ? "text-emerald-300" : "text-amber-300"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{user.status}</span></td><td className="px-5 py-4 text-right"><button onClick={() => action(`Profil de ${user.name} ouvert`)} className="rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-ink" aria-label={`Actions pour ${user.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div></section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="card p-5"><div className="flex items-center gap-2"><Globe2 size={17} className="text-gold" /><h2 className="text-sm font-semibold text-ink">Activité géographique</h2></div><div className="relative mt-5 flex h-44 items-center justify-center overflow-hidden rounded-xl border border-midnight-border bg-midnight/60"><div className="absolute h-32 w-64 rounded-[50%] border border-gold/20" /><div className="absolute h-20 w-40 rounded-[50%] border border-gold/15" /><div className="absolute h-2 w-2 rounded-full bg-gold shadow-[0_0_18px_6px_rgba(8,111,88,.45)]" style={{ left: "54%", top: "42%" }} /><div className="absolute h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_4px_rgba(110,231,183,.35)]" style={{ left: "39%", top: "55%" }} /><p className="absolute bottom-3 left-3 text-[10px] text-ink-muted">Europe · 41% de l&apos;activité</p></div></div><div className="card p-5"><h2 className="text-sm font-semibold text-ink">Sources de revenus</h2><div className="mt-5 space-y-4">{[["Abonnements", "$24,240", "57%", "w-[57%]"], ["Marketplace", "$11,090", "26%", "w-[26%]"], ["Boosts", "$7,350", "17%", "w-[17%]"]].map(([label, value, percent, width]) => <div key={label}><div className="flex justify-between text-xs"><span className="text-ink-muted">{label}</span><span className="font-semibold text-ink">{value} <span className="ml-2 font-normal text-gold-soft">{percent}</span></span></div><div className="mt-2 h-2 rounded-full bg-midnight-border"><div className={`h-full rounded-full bg-gold ${width}`} /></div></div>)}</div></div></section>
      <section className="card mt-6 p-5"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Globe2 size={17} className="text-gold" /><h2 className="text-sm font-semibold text-ink">Répartition géographique des utilisateurs</h2></div><p className="mt-1 text-xs text-ink-muted">Top des localisations renseignées dans les profils</p></div><span className="badge-gold">Données live</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{(adminQuery.data?.geoDistribution ?? []).length ? adminQuery.data?.geoDistribution.map((region) => <div key={region.location}><div className="flex justify-between text-xs"><span className="text-ink-muted">{region.location}</span><strong className="text-ink">{region.users}</strong></div><div className="mt-2 h-2 rounded-full bg-midnight-border"><div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: `${Math.max(8, Math.round((region.users / Math.max(...(adminQuery.data?.geoDistribution ?? [{ users: 1 }]).map((item) => item.users))) * 100))}%` }} /></div></div>) : <p className="text-sm text-ink-muted">Aucune localisation renseignée pour le moment.</p>}</div></section>
    </>}
    </main></div></div>;
}
