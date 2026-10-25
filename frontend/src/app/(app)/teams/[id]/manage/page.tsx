"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  FileText,
  Inbox,
  Loader2,
  Search,
  Settings2,
  Trash2,
  UserRound,
  UserPlus,
  UsersRound,
  X,
} from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

const TEAM_ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;
type View = "requests" | "invitations" | "members" | "rejected" | "posts";
type CollaborationStatus = "PENDING" | "APPROVED" | "REJECTED";
type Collaborator = {
  id: string;
  userId: string;
  role: string;
  status: CollaborationStatus;
  invitedById: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null };
};
type Team = { id: string; creatorId: string; title: string; teamName: string | null; tagline: string; logoUrl: string | null };
type InviteCandidate = { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null };
type TeamPost = {
  id: string;
  content: string;
  tags: string[];
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  author: { name: string | null; handle: string | null; image: string | null };
};

export default function TeamManagementPage() {
  const { t, locale } = useTranslation();
  const params = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [postStatusFilter, setPostStatusFilter] = useState<TeamPost["moderationStatus"] | "ALL">("ALL");
  const [view, setView] = useState<View>("requests");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<typeof TEAM_ROLES[number]>("CO_BUILDER");
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSearched, setInviteSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${params.id}`),
      fetch(`/api/projects/${params.id}/collaborators`),
    ])
      .then(async ([teamResponse, collaboratorsResponse]) => {
        if (!teamResponse.ok || !collaboratorsResponse.ok) throw new Error("team_manage_load_failed");
        const [{ project }, { collaborators: teamCollaborators }] = await Promise.all([
          teamResponse.json(),
          collaboratorsResponse.json(),
        ]);
        if (cancelled) return;
        setTeam(project);
        setCollaborators(teamCollaborators);
      })
      .catch(() => {
        if (!cancelled) setError(t("teams.manageLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.id, t]);

  useEffect(() => {
    if (view !== "posts") return;
    let cancelled = false;
    setPostsLoading(true);
    fetch(`/api/projects/${params.id}/posts?status=${postStatusFilter}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("team_posts_load_failed");
        return response.json();
      })
      .then(({ posts: teamPosts }: { posts: TeamPost[] }) => {
        if (!cancelled) {
          setPosts(teamPosts);
          setPostsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("teams.managePostsLoadError"));
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.id, postStatusFilter, t, view]);

  async function refreshCollaborators() {
    const response = await fetch(`/api/projects/${params.id}/collaborators`);
    if (!response.ok) throw new Error("team_members_load_failed");
    const data = await response.json() as { collaborators: Collaborator[] };
    setCollaborators(data.collaborators);
  }

  async function updateCollaborator(collaborator: Collaborator, changes: { status?: "APPROVED" | "REJECTED"; role?: typeof TEAM_ROLES[number] }, successMessage: string) {
    setBusyId(collaborator.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators/${collaborator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error("team_member_update_failed");
      const { collaborator: updated } = await response.json() as { collaborator: Collaborator };
      setCollaborators((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(successMessage);
    } catch {
      setError(t("teams.manageActionError"));
    } finally {
      setBusyId("");
    }
  }

  async function removeMember(collaborator: Collaborator) {
    if (!window.confirm(t("teams.confirmRemoveMember", { name: collaborator.user.name ?? "" }))) return;
    setBusyId(collaborator.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators/${collaborator.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("team_member_remove_failed");
      setCollaborators((current) => current.filter((item) => item.id !== collaborator.id));
      setNotice(t("teams.memberRemoved"));
    } catch {
      setError(t("teams.manageActionError"));
    } finally {
      setBusyId("");
    }
  }

  async function searchMakers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = inviteQuery.trim();
    if (query.length < 2) {
      setInviteCandidates([]);
      setInviteSearched(false);
      setError(t("teams.inviteSearchHint"));
      return;
    }

    setInviteLoading(true);
    setInviteSearched(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/makers?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("maker_search_failed");
      const data = await response.json() as { makers: InviteCandidate[] };
      const activeMemberIds = new Set(collaborators.filter((item) => item.status !== "REJECTED").map((item) => item.userId));
      activeMemberIds.add(team?.creatorId ?? "");
      setInviteCandidates(data.makers.filter((maker) => !activeMemberIds.has(maker.id)));
    } catch {
      setError(t("teams.inviteSearchError"));
    } finally {
      setInviteLoading(false);
    }
  }

  async function sendInvitation(maker: InviteCandidate) {
    setBusyId(maker.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: maker.id, role: inviteRole }),
      });
      if (!response.ok) throw new Error("team_invite_failed");
      await refreshCollaborators();
      setInviteCandidates((current) => current.filter((candidate) => candidate.id !== maker.id));
      setNotice(t("teams.inviteSent", { name: maker.name ?? maker.handle ?? "" }));
    } catch {
      setError(t("teams.inviteError"));
    } finally {
      setBusyId("");
    }
  }

  async function cancelInvitation(collaborator: Collaborator) {
    const name = collaborator.user.name ?? collaborator.user.handle ?? "";
    if (!window.confirm(t("teams.confirmCancelInvitation", { name }))) return;
    setBusyId(collaborator.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators/${collaborator.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("team_invitation_cancel_failed");
      setCollaborators((current) => current.filter((item) => item.id !== collaborator.id));
      setNotice(t("teams.inviteCancelled", { name }));
    } catch {
      setError(t("teams.manageActionError"));
    } finally {
      setBusyId("");
    }
  }

  async function moderatePost(post: TeamPost, status: Exclude<TeamPost["moderationStatus"], "PENDING">) {
    setBusyId(post.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("team_post_moderation_failed");
      setPosts((current) => postStatusFilter === "ALL" || postStatusFilter === status
        ? current.map((item) => item.id === post.id ? { ...item, moderationStatus: status } : item)
        : current.filter((item) => item.id !== post.id));
      setNotice(t(status === "APPROVED" ? "teams.teamPostApproved" : "teams.teamPostRejected"));
    } catch {
      setError(t("teams.teamPostActionError"));
    } finally {
      setBusyId("");
    }
  }

  async function deletePost(post: TeamPost) {
    const name = post.author.name ?? post.author.handle ?? "";
    if (!window.confirm(t("teams.confirmDeleteTeamPost", { name }))) return;
    setBusyId(post.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}/posts/${post.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("team_post_delete_failed");
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setNotice(t("teams.teamPostDeleted"));
    } catch {
      setError(t("teams.teamPostActionError"));
    } finally {
      setBusyId("");
    }
  }

  const people = collaborators.filter((collaborator) => {
    if (view === "requests" && (collaborator.status !== "PENDING" || collaborator.invitedById)) return false;
    if (view === "members" && (collaborator.status !== "APPROVED" || collaborator.userId === team?.creatorId)) return false;
    if (view === "rejected" && collaborator.status !== "REJECTED") return false;
    if (roleFilter !== "ALL" && collaborator.role !== roleFilter) return false;
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return [collaborator.user.name, collaborator.user.handle, collaborator.user.headline, collaborator.role, collaborator.message]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const filteredPosts = posts.filter((post) => {
    const normalizedSearch = search.trim().toLowerCase();
    return !normalizedSearch || [post.content, post.author.name, post.author.handle, ...post.tags]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const counts = {
    requests: collaborators.filter((item) => item.status === "PENDING" && !item.invitedById).length,
    invitations: collaborators.filter((item) => item.status === "PENDING" && item.invitedById === team?.creatorId).length,
    members: collaborators.filter((item) => item.status === "APPROVED" && item.userId !== team?.creatorId).length,
    rejected: collaborators.filter((item) => item.status === "REJECTED").length,
    posts: posts.length,
  };
  const views: { id: View; label: string; icon: typeof Inbox; count: number | null }[] = [
    { id: "requests", label: t("teams.manageRequests"), icon: Inbox, count: counts.requests },
    { id: "invitations", label: t("teams.manageInvitations"), icon: UserPlus, count: counts.invitations },
    { id: "members", label: t("teams.manageMembers"), icon: UsersRound, count: counts.members },
    { id: "rejected", label: t("teams.manageDeclined"), icon: X, count: counts.rejected },
    { id: "posts", label: t("teams.managePosts"), icon: FileText, count: postsLoaded ? counts.posts : null },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/teams" className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("teams.title")}
        </Link>
        {team && (
          <Link href={`/teams/${params.id}/settings`} className="btn-ghost !rounded-lg">
            <Settings2 size={16} aria-hidden="true" />{t("teams.settingsAction")}
          </Link>
        )}
      </div>

      <header className="flex items-center gap-4 border-b border-midnight-border pb-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-midnight-border bg-midnight-card text-gold-soft">
          {team?.logoUrl ? <img src={team.logoUrl} alt="" className="h-full w-full object-cover" /> : <UsersRound size={22} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.manageEyebrow")}</p>
          <h1 className="section-title truncate">{team?.teamName?.trim() || team?.title || t("teams.manageTitle")}</h1>
          {team?.tagline && <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{team.tagline}</p>}
        </div>
      </header>

      {loading ? (
        <div className="card space-y-3 p-5" aria-busy="true">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-20 w-full" />
        </div>
      ) : error && !team ? (
        <p role="alert" className="card p-5 text-sm text-rose-300">{error}</p>
      ) : (
        <>
          <nav aria-label={t("teams.manageTitle")} className="flex gap-1 overflow-x-auto border-b border-midnight-border">
            {views.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setView(id); setSearch(""); setRoleFilter("ALL"); setError(""); setNotice(""); }}
                aria-pressed={view === id}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition ${view === id ? "border-gold text-gold-soft" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                <Icon size={16} aria-hidden="true" />{label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${view === id ? "bg-gold/15 text-gold-soft" : "bg-midnight-card text-ink-muted"}`}>{count ?? "..."}</span>
              </button>
            ))}
          </nav>

          {view !== "invitations" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder={view === "posts" ? t("teams.searchPosts") : t("teams.searchPeople")} />
              </label>
              {view === "posts" ? (
                <label className="sm:w-56">
                  <span className="sr-only">{t("teams.filterPostStatus")}</span>
                  <select value={postStatusFilter} onChange={(event) => setPostStatusFilter(event.target.value as TeamPost["moderationStatus"] | "ALL")} className="input">
                    <option value="ALL">{t("teams.allPostStatuses")}</option>
                    <option value="PENDING">{t("teams.postStatus.PENDING")}</option>
                    <option value="APPROVED">{t("teams.postStatus.APPROVED")}</option>
                    <option value="REJECTED">{t("teams.postStatus.REJECTED")}</option>
                  </select>
                </label>
              ) : (
                <label className="sm:w-56">
                  <span className="sr-only">{t("teams.filterRole")}</span>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="input">
                    <option value="ALL">{t("teams.allRoles")}</option>
                    <option value="FOUNDER">{t("projects.roles.FOUNDER")}</option>
                    {TEAM_ROLES.map((role) => <option key={role} value={role}>{t(`projects.roles.${role}`)}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {(error || notice) && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>{error || notice}</p>}

          {view === "invitations" ? (
            <div className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">{t("teams.inviteTitle")}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{t("teams.inviteDescription")}</p>
                </div>
                <form onSubmit={searchMakers} className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">{t("teams.inviteSearchLabel")}</span>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} className="input pl-9" placeholder={t("teams.inviteSearchPlaceholder")} />
                  </label>
                  <label className="sm:w-52">
                    <span className="sr-only">{t("teams.inviteRoleLabel")}</span>
                    <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof TEAM_ROLES[number])} className="input">
                      {TEAM_ROLES.map((role) => <option key={role} value={role}>{t(`projects.roles.${role}`)}</option>)}
                    </select>
                  </label>
                  <button type="submit" disabled={inviteLoading} className="btn-ghost !rounded-lg">
                    {inviteLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
                    {t("teams.inviteSearchAction")}
                  </button>
                </form>
                {inviteLoading ? (
                  <div className="skeleton h-16 w-full" aria-busy="true" />
                ) : inviteCandidates.length ? (
                  <div className="divide-y divide-midnight-border overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/40">
                    {inviteCandidates.map((maker) => (
                      <article key={maker.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-midnight-card text-gold-soft">
                          {maker.image ? <img src={maker.image} alt="" className="h-full w-full object-cover" /> : <UserRound size={17} aria-hidden="true" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{maker.name ?? maker.handle ?? t("teams.unknownMember")}</p>
                          {maker.handle && <p className="truncate text-xs text-ink-muted">@{maker.handle}</p>}
                          {maker.headline && <p className="mt-1 truncate text-xs text-ink-muted">{maker.headline}</p>}
                        </div>
                        <button type="button" disabled={busyId === maker.id} onClick={() => sendInvitation(maker)} className="btn-gold !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                          {busyId === maker.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
                          {t("teams.inviteAction")}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : inviteSearched ? (
                  <p className="py-3 text-sm text-ink-muted">{t("teams.inviteNoResults")}</p>
                ) : (
                  <p className="py-3 text-sm text-ink-muted">{t("teams.inviteSearchHint")}</p>
                )}
              </section>

              <section className="space-y-3 border-t border-midnight-border pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">{t("teams.pendingInvitations")}</h2>
                  <span className="text-xs tabular-nums text-ink-muted">{counts.invitations}</span>
                </div>
                {collaborators.filter((item) => item.status === "PENDING" && item.invitedById === team?.creatorId).length ? (
                  <div className="divide-y divide-midnight-border overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/40">
                    {collaborators.filter((item) => item.status === "PENDING" && item.invitedById === team?.creatorId).map((collaborator) => (
                      <article key={collaborator.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{collaborator.user.name ?? collaborator.user.handle ?? t("teams.unknownMember")}</p>
                          {collaborator.user.handle && <p className="text-xs text-ink-muted">@{collaborator.user.handle}</p>}
                          <p className="mt-1 text-xs text-ink-muted">{t(`projects.roles.${collaborator.role}`)} · {t("teams.invitationSentDate", { date: new Date(collaborator.createdAt).toLocaleDateString(locale) })}</p>
                        </div>
                        <button type="button" disabled={busyId === collaborator.id} onClick={() => cancelInvitation(collaborator)} title={t("teams.cancelInvitation")} aria-label={t("teams.cancelInvitation")} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs text-rose-300 hover:text-rose-200">
                          {busyId === collaborator.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                          {t("teams.cancelInvitation")}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-sm text-ink-muted">{t("teams.noPendingInvitations")}</p>
                )}
              </section>
            </div>
          ) : view === "posts" ? (
            postsLoading ? (
              <div className="card space-y-3 p-5" aria-busy="true"><div className="skeleton h-20 w-full" /><div className="skeleton h-20 w-full" /></div>
            ) : filteredPosts.length ? (
              <div className="divide-y divide-midnight-border overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/40">
                {filteredPosts.map((post) => (
                  <article key={post.id} className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-midnight-card text-xs font-semibold text-gold-soft">
                        {post.author.image ? <img src={post.author.image} alt="" className="h-full w-full object-cover" /> : <UserRound size={15} aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{post.author.name ?? post.author.handle ?? t("teams.unknownMember")}</p>
                        <time className="text-[11px] text-ink-muted" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString(locale)}</time>
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={`badge ${post.moderationStatus === "APPROVED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : post.moderationStatus === "REJECTED" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "badge-gold"}`}>
                        {t(`teams.postStatus.${post.moderationStatus}`)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {post.moderationStatus !== "APPROVED" && (
                          <button type="button" disabled={busyId === post.id} onClick={() => moderatePost(post, "APPROVED")} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                            {busyId === post.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                            {t("teams.approvePost")}
                          </button>
                        )}
                        {post.moderationStatus !== "REJECTED" && (
                          <button type="button" disabled={busyId === post.id} onClick={() => moderatePost(post, "REJECTED")} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs text-rose-300 hover:text-rose-200">
                            {busyId === post.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                            {t("teams.rejectPost")}
                          </button>
                        )}
                        <button type="button" disabled={busyId === post.id} onClick={() => deletePost(post)} title={t("teams.deletePost")} aria-label={t("teams.deletePost")} className="btn-ghost !min-h-9 !rounded-lg !p-2 text-rose-300 hover:text-rose-200">
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{post.content}</p>
                    {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{post.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="card flex flex-col items-center gap-2 p-10 text-center">
                <FileText size={23} className="text-ink-muted" aria-hidden="true" />
                <p className="text-sm text-ink-muted">{postsLoaded ? t("teams.noPostsMatch") : t("teams.managePostsLoadError")}</p>
              </div>
            )
          ) : people.length ? (
            <div className="divide-y divide-midnight-border overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/40">
              {people.map((collaborator) => (
                <article key={collaborator.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-midnight-card text-sm font-semibold text-gold-soft">
                    {collaborator.user.image
                      ? <img src={collaborator.user.image} alt="" className="h-full w-full object-cover" />
                      : <span>{(collaborator.user.name ?? "?").slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-sm font-semibold text-ink">{collaborator.user.name ?? collaborator.user.handle ?? t("teams.unknownMember")}</h2>
                      {collaborator.user.handle && <span className="text-xs text-ink-muted">@{collaborator.user.handle}</span>}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{collaborator.user.headline || t(`projects.roles.${collaborator.role}`)}</p>
                    {collaborator.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-muted">{collaborator.message}</p>}
                    {view === "rejected" && <p className="mt-1 text-[11px] text-ink-muted">{t("teams.membership.REJECTED")} · {new Date(collaborator.updatedAt ?? collaborator.createdAt).toLocaleDateString(locale)}</p>}
                  </div>

                  {view === "requests" ? (
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <button type="button" disabled={busyId === collaborator.id} onClick={() => updateCollaborator(collaborator, { status: "REJECTED" }, t("teams.requestDeclinedSuccess"))} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                        {busyId === collaborator.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{t("teams.declineRequest")}
                      </button>
                      <button type="button" disabled={busyId === collaborator.id} onClick={() => updateCollaborator(collaborator, { status: "APPROVED" }, t("teams.requestApprovedSuccess"))} className="btn-gold !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                        {busyId === collaborator.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{t("teams.approveRequest")}
                      </button>
                    </div>
                  ) : view === "members" && collaborator.role !== "FOUNDER" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <label>
                        <span className="sr-only">{t("teams.changeRole", { name: collaborator.user.name ?? "" })}</span>
                        <select
                          value={collaborator.role}
                          disabled={busyId === collaborator.id}
                          onChange={(event) => updateCollaborator(collaborator, { role: event.target.value as typeof TEAM_ROLES[number] }, t("teams.roleUpdated"))}
                          className="input !min-h-9 !w-auto !py-1.5 text-xs"
                        >
                          {TEAM_ROLES.map((role) => <option key={role} value={role}>{t(`projects.roles.${role}`)}</option>)}
                        </select>
                      </label>
                      <button type="button" disabled={busyId === collaborator.id} onClick={() => removeMember(collaborator)} title={t("teams.removeMember")} aria-label={t("teams.removeMember")} className="btn-ghost !min-h-9 !rounded-lg !p-2 text-rose-300 hover:text-rose-200">
                        {busyId === collaborator.id ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                      </button>
                    </div>
                  ) : (
                    <span className="badge shrink-0">{t(`projects.roles.${collaborator.role}`)}</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-2 p-10 text-center">
              {view === "requests" ? <Inbox size={23} className="text-ink-muted" aria-hidden="true" /> : <UsersRound size={23} className="text-ink-muted" aria-hidden="true" />}
              <p className="text-sm text-ink-muted">{search || roleFilter !== "ALL" ? t("teams.noPeopleMatch") : t(view === "requests" ? "teams.noRequests" : view === "members" ? "teams.noMembers" : "teams.noDeclined")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}