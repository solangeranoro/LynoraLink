"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, FileText, Github, Globe2, Handshake, Loader2, MapPin, MessageCircle, Plus, UserPlus, UsersRound, X } from "@/components/FontAwesomeIcons";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { BadgeCollection, MakerRankingCard, type AwardedBadge, type MakerStanding } from "@/components/GamificationBadges";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { ProfileProjectCard, type ProfileProjectPreview } from "@/components/ProfileProjectCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTranslation } from "@/lib/i18n";

type AssociationStatus = "PENDING" | "ACCEPTED" | "REJECTED";
type MakerProfile = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;
  openToCoBuild: boolean;
  isOnline: boolean;
  isVerified: boolean;
  badges: AwardedBadge[];
  standing: MakerStanding;
  associatedMakers: { id: string; name: string | null; image: string | null; handle: string | null }[];
  projects: ProfileProjectPreview[];
  _count: { posts: number; collaborations: number };
  association: { id: string; requesterId: string; addresseeId: string; status: AssociationStatus } | null;
};
type InviteProject = { id: string; title: string };

export default function MakerProfilePage() {
  const { t, locale } = useTranslation();
  const { showToast } = useActionToast();
  const isFrench = locale === "fr";
  const { data: session } = useSession();
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteRole, setInviteRole] = useState("CO_BUILDER");
  const [notice, setNotice] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllAssociatedMakers, setShowAllAssociatedMakers] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["maker-profile", params.handle],
    queryFn: async () => {
      const response = await fetch(`/api/makers/${encodeURIComponent(params.handle)}`);
      if (!response.ok) throw new Error("maker_load_failed");
      return (await response.json()).maker as MakerProfile;
    },
  });
  const postsQuery = useQuery({
    queryKey: ["posts", "author", profileQuery.data?.id],
    enabled: Boolean(profileQuery.data?.id),
    refetchInterval: 3_000,
    queryFn: async () => {
      const response = await fetch(`/api/posts?authorId=${encodeURIComponent(profileQuery.data?.id ?? "")}&take=5`);
      if (!response.ok) throw new Error("posts_load_failed");
      const result = await response.json();
      return result.posts as FeedPost[];
    },
  });
  const inviteProjectsQuery = useQuery({
    queryKey: ["projects", "invite", session?.user?.id],
    enabled: Boolean(session?.user?.id && profileQuery.data && profileQuery.data.id !== session.user.id),
    queryFn: async () => {
      const response = await fetch("/api/projects?mine=1");
      if (!response.ok) throw new Error("invite_projects_load_failed");
      return (await response.json()).projects as InviteProject[];
    },
  });
  const associationMutation = useMutation({
    mutationFn: async ({ maker, status, cancel }: { maker: MakerProfile; status?: "ACCEPTED" | "REJECTED"; cancel?: boolean }) => {
      const incoming = maker.association?.status === "PENDING" && maker.association.addresseeId === session?.user?.id;
      const response = cancel && maker.association
        ? await fetch(`/api/associations/${maker.association.id}`, { method: "DELETE" })
        : incoming
          ? await fetch(`/api/associations/${maker.association?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status ?? "ACCEPTED" }) })
          : await fetch("/api/associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresseeId: maker.id }) });
      if (!response.ok) throw new Error("association_failed");
      return { result: await response.json(), cancelled: Boolean(cancel), incoming };
    },
    onSuccess: async ({ cancelled, incoming }, variables) => {
      const messageKey = cancelled ? "makers.associationCancelled" : variables.status === "REJECTED" ? "makers.associationDeclined" : incoming ? "makers.associated" : "makers.associationSent";
      if ((!incoming && variables.status !== "REJECTED") || cancelled) showToast(t(messageKey));
      else setNotice(t(messageKey));
      await queryClient.invalidateQueries({ queryKey: ["maker-profile", params.handle] });
      await queryClient.invalidateQueries({ queryKey: ["associations", session?.user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["navigation-counts", session?.user?.id] });
    },
  });
  const messageMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId }) });
      if (!response.ok) throw new Error("conversation_create_failed");
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: ({ id }) => router.push(`/messages?conversationId=${id}`),
  });
  const inviteMutation = useMutation({
    mutationFn: async ({ projectId, role }: { projectId: string; role: string }) => {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profileQuery.data?.id, role }),
      });
      if (!response.ok) throw new Error("project_invitation_failed");
      return response.json();
    },
    onSuccess: async () => {
      setInviteOpen(false);
      setNotice(t("makers.projectInviteSent"));
      await queryClient.invalidateQueries({ queryKey: ["notifications", session?.user?.id] });
    },
  });

  if (profileQuery.isLoading) return <div className="space-y-5" aria-busy="true"><div className="skeleton h-40 rounded-xl" /><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]"><div className="skeleton h-64 rounded-xl" /><div className="skeleton h-64 rounded-xl" /></div><div className="skeleton h-36 rounded-xl" /></div>;
  if (profileQuery.isError || !profileQuery.data) return <p role="alert" className="card p-5 text-sm text-rose-300">{t("makers.profileUnavailable")}</p>;

  const maker = profileQuery.data;
  const isSelf = maker.id === session?.user?.id;
  const association = maker.association;
  const incoming = association?.status === "PENDING" && association.addresseeId === session?.user?.id;
  const outgoing = association?.status === "PENDING" && association.requesterId === session?.user?.id;
  const associationLabel = association?.status === "ACCEPTED" ? t("makers.associated") : incoming ? t("makers.acceptAssociation") : association?.status === "PENDING" ? t("makers.associationSent") : t("makers.associate");
  return (
    <div className="space-y-6 pb-8">
      <header className="card relative overflow-hidden">
        <div aria-hidden="true" className="relative h-32 overflow-hidden bg-gradient-to-br from-[#1d3455] via-[#18304a] to-[#12423f]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(212,175,55,0.22),transparent_38%)]" />
          <div className="absolute -right-8 -top-28 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-2 -top-20 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        </div>
        <div className="relative flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:px-7">
          {isSelf ? (
            <Link href="/settings" aria-label={t("makers.editProfile")} className="-mt-14 shrink-0 rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><Avatar src={maker.image} name={maker.name} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></Link>
          ) : maker.image ? (
            <a href={maker.image} target="_blank" rel="noreferrer" aria-label={t("makers.viewAvatar", { name: maker.name ?? maker.handle ?? "Maker" })} className="-mt-14 shrink-0 rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><Avatar src={maker.image} name={maker.name} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></a>
          ) : <div className="-mt-14 shrink-0 rounded-full p-1.5"><Avatar src={maker.image} name={maker.name} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></div>}
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{maker.name ?? maker.handle}</h1>{maker.isVerified && <VerifiedBadge label={t("feed.verifiedMaker")} />}</div>
            {maker.headline && <p className="mt-1.5 text-sm font-medium text-gold-soft sm:text-base">{maker.headline}</p>}
            {maker.handle && <p className="mt-1 text-xs text-ink-muted">@{maker.handle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 ${maker.isOnline ? "text-emerald-300" : "text-ink-muted"}`}><span className={`h-1.5 w-1.5 rounded-full ${maker.isOnline ? "bg-emerald-400" : "bg-ink-muted/50"}`} />{maker.isOnline ? t("makers.online") : t("makers.offline")}</span>
              {maker.openToCoBuild && <span className="inline-flex items-center gap-1.5 font-medium text-gold-soft"><Handshake size={13} aria-hidden="true" />{t("makers.brainstormAvailability")}</span>}
              {maker.location && <span className="inline-flex items-center gap-1.5 text-ink-muted"><MapPin size={13} aria-hidden="true" />{maker.location}</span>}
            </div>
          </div>
          {!isSelf && session?.user && (
            <div className="flex max-w-full flex-wrap gap-2 sm:justify-end">
            {association?.status === "ACCEPTED" ? null : outgoing ? (
              <button type="button" disabled={associationMutation.isPending} onClick={() => associationMutation.mutate({ maker, cancel: true })} className="btn-ghost !rounded-xl">
                <X size={15} aria-hidden="true" />{t("makers.cancelAssociation")}
              </button>
            ) : (
              <button type="button" disabled={associationMutation.isPending} onClick={() => associationMutation.mutate({ maker, status: "ACCEPTED" })} className="btn-gold !rounded-xl">
                {incoming ? <Check size={15} aria-hidden="true" /> : <Handshake size={15} aria-hidden="true" />}{associationLabel}
              </button>
            )}
            {incoming && <button type="button" onClick={() => associationMutation.mutate({ maker, status: "REJECTED" })} disabled={associationMutation.isPending} className="btn-ghost !rounded-xl"><X size={15} aria-hidden="true" />{t("notifications.decline")}</button>}
            <button type="button" onClick={() => messageMutation.mutate(maker.id)} disabled={messageMutation.isPending} className="btn-ghost !rounded-xl">
              {messageMutation.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <MessageCircle size={15} aria-hidden="true" />}{t("makers.startConversation")}
            </button>
            {(inviteProjectsQuery.data?.length ?? 0) > 0 && (
              <button type="button" onClick={() => setInviteOpen((open) => !open)} aria-expanded={inviteOpen} className="btn-ghost !rounded-xl">
                <UserPlus size={15} aria-hidden="true" />{t("makers.inviteToProject")}
              </button>
            )}
            </div>
          )}
        </div>
      </header>

      <section aria-labelledby="maker-badges-title" className="card space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="maker-badges-title" className="section-title text-base">{t("gamification.profileBadges")}</h2>
          <span className="text-xs text-ink-muted">{maker.badges.length}</span>
        </div>
        <BadgeCollection badges={maker.badges} emptyLabel={t("gamification.emptyPublicBadges")} />
      </section>
      <MakerRankingCard standing={maker.standing} />

      <section aria-label={isFrench ? "Statistiques du profil" : "Profile statistics"} className="card grid grid-cols-3 divide-x divide-midnight-border px-1 py-3 sm:px-5 sm:py-4">
        {[
          { label: t("makers.projects"), value: maker.projects.length, icon: Globe2 },
          { label: isFrench ? "Publications" : "Updates", value: maker._count.posts, icon: FileText },
          { label: isFrench ? "Collaborations" : "Collaborations", value: maker._count.collaborations, icon: UsersRound },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center justify-center gap-2 px-1.5 sm:gap-3 sm:px-4">
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold-soft sm:grid"><Icon size={17} aria-hidden="true" /></span>
            <div className="min-w-0 text-center sm:text-left"><p className="truncate text-base font-semibold tabular-nums text-ink sm:text-lg">{value}</p><p className="truncate text-[10px] text-ink-muted sm:text-xs">{label}</p></div>
          </div>
        ))}
      </section>

      {(associationMutation.isError || messageMutation.isError || inviteMutation.isError) && <p role="alert" className="text-sm text-rose-300">{t("makers.actionError")}</p>}
      {notice && <p role="status" aria-live="polite" className="inline-flex rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-soft">{notice}</p>}
      {inviteOpen && <form onSubmit={(event) => { event.preventDefault(); if (inviteProjectId) inviteMutation.mutate({ projectId: inviteProjectId, role: inviteRole }); }} className="flex flex-col gap-3 rounded-xl border border-midnight-border bg-midnight-card/60 p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1"><span className="label">{t("makers.inviteProjectLabel")}</span><select value={inviteProjectId} onChange={(event) => setInviteProjectId(event.target.value)} required className="input mt-1"><option value="">{t("makers.chooseProject")}</option>{inviteProjectsQuery.data?.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
        <label className="sm:w-48"><span className="label">{t("makers.inviteRoleLabel")}</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="input mt-1">{["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"].map((role) => <option key={role} value={role}>{t(`projects.roles.${role}`)}</option>)}</select></label>
        <button type="submit" disabled={inviteMutation.isPending || !inviteProjectId} className="btn-gold !rounded-xl">{inviteMutation.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}{t("makers.sendProjectInvite")}</button>
      </form>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <section className="space-y-4">
            <header className="flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title text-base">{isFrench ? "Activité récente" : "Recent activity"}</h2>
                <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Les dernières publications dans la communauté." : "Latest posts in the community."}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted"><FileText size={14} aria-hidden="true" />{maker._count.posts}</span>
            </header>
            {postsQuery.isLoading ? (
              <div className="space-y-4"><div className="skeleton h-36" /><div className="skeleton h-36" /></div>
            ) : postsQuery.data?.length ? (
              <div className="space-y-4">{postsQuery.data.map((post) => <PostCard key={post.id} post={post} variant="compact" showJoinAction={false} />)}</div>
            ) : (
              <div className="card p-6 text-sm text-ink-muted">{isFrench ? "Aucune publication pour le moment." : "No posts yet."}</div>
            )}
          </section>
        </div>
        <aside aria-label={isFrench ? "Informations du profil" : "Profile information"} className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title text-base">{isFrench ? "Projets à la une" : "Featured projects"}</h2>
              <div className="flex shrink-0 items-center gap-3">
                {maker.projects.length > 1 && (
                  <button type="button" onClick={() => setShowAllProjects((showAll) => !showAll)} aria-expanded={showAllProjects} className="text-xs font-medium text-gold-soft transition hover:text-gold-bright">
                    {showAllProjects ? (isFrench ? "Voir moins" : "See less") : t("makers.viewAll")}
                  </button>
                )}
                {isSelf && <Link href="/projects/new" aria-label={isFrench ? "Créer un projet" : "Create a project"} title={isFrench ? "Créer un projet" : "Create a project"} className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:border-gold/40 hover:text-gold-soft"><Plus size={16} aria-hidden="true" /></Link>}
              </div>
            </div>
            {maker.projects.length ? (
              <ul className="space-y-3">
                {maker.projects.slice(0, showAllProjects ? maker.projects.length : 1).map((project) => (
                  <li key={project.id} className="min-w-0"><ProfileProjectCard project={project} /></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{isFrench ? "Aucun projet pour le moment." : "No projects yet."}</p>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title text-base">{t("makers.publicAssociatedPeople")}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {maker.associatedMakers.length > 3 && (
                  <button type="button" onClick={() => setShowAllAssociatedMakers((showAll) => !showAll)} aria-expanded={showAllAssociatedMakers} className="text-xs font-medium text-gold-soft transition hover:text-gold-bright">
                    {showAllAssociatedMakers ? (isFrench ? "Voir moins" : "See less") : t("makers.viewAll")}
                  </button>
                )}
                <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs tabular-nums text-gold-soft">{maker.associatedMakers.length}</span>
              </div>
            </div>
            {maker.associatedMakers.length ? (
              <ul className="divide-y divide-midnight-border">
                {maker.associatedMakers.slice(0, showAllAssociatedMakers ? maker.associatedMakers.length : 3).map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/makers/${encodeURIComponent(person.handle ?? person.id)}`}
                      aria-label={isFrench ? `Voir le profil de ${person.name ?? person.handle ?? "Maker"}` : `View ${person.name ?? person.handle ?? "Maker"}'s profile`}
                      className="group flex min-w-0 items-center gap-3 rounded-lg py-3 transition hover:bg-midnight-deep/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                      <Avatar src={person.image} name={person.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink group-hover:text-gold-soft">{person.name ?? person.handle ?? "Maker"}</span>
                        {person.handle && <span className="block truncate text-xs text-ink-muted">@{person.handle}</span>}
                      </span>
                      <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-ink-muted transition group-hover:text-gold-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-ink-muted">{t("makers.noPublicAssociatedPeople")}</p>
            )}
          </section>
          <section className="card p-5">
            <h2 className="section-title text-base">{t("makers.about")}</h2>
            {maker.bio ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{maker.bio}</p> : <p className="mt-3 text-sm leading-6 text-ink-muted">{t("makers.noBio")}</p>}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("auth.skills")}</h2>
            {maker.skills.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {maker.skills.map((skill) => <li key={skill}><Link href={`/discover?tag=${encodeURIComponent(skill)}`} className="badge transition hover:border-gold/40 hover:text-gold-soft">{skill}</Link></li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-ink-muted">{t("makers.noSkills")}</p>}
          </section>
          {(maker.githubUrl || maker.websiteUrl || maker.twitterUrl) && <section className="card p-5">
            <h2 className="section-title text-base">{isFrench ? "Liens" : "Links"}</h2>
            <ul className="mt-2 divide-y divide-midnight-border">
              {maker.websiteUrl && <li><a href={maker.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><Globe2 size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{t("makers.website")}</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {maker.githubUrl && <li><a href={maker.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><Github size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">GitHub</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {maker.twitterUrl && <li><a href={maker.twitterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><span className="min-w-0 flex-1 truncate">X / Twitter</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
            </ul>
          </section>}
        </aside>
      </div>
    </div>
  );
}