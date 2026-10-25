"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, FileText, Github, Globe2, Handshake, Loader2, MapPin, MessageCircle, UserPlus, UsersRound, X } from "@/components/FontAwesomeIcons";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { BadgeCollection, type AwardedBadge } from "@/components/GamificationBadges";
import { PostCard, type FeedPost } from "@/components/PostCard";
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
  projects: { id: string; title: string; tagline: string; status: string; githubUrl: string | null; liveUrl: string | null; logoUrl: string | null; techStack: string[]; _count: { collaborators: number; posts: number } }[];
  _count: { posts: number; collaborations: number };
  association: { id: string; requesterId: string; addresseeId: string; status: AssociationStatus } | null;
};
type SuggestedMaker = { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null; skills: string[]; isOnline: boolean; openToCoBuild: boolean };
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
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
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
    queryFn: async () => {
      const response = await fetch(`/api/posts?authorId=${encodeURIComponent(profileQuery.data?.id ?? "")}&take=5`);
      if (!response.ok) throw new Error("posts_load_failed");
      const result = await response.json();
      return result.posts as FeedPost[];
    },
  });
  const suggestionsQuery = useQuery({
    queryKey: ["maker-suggestions", params.handle],
    enabled: Boolean(profileQuery.data),
    queryFn: async () => {
      const response = await fetch("/api/makers?all=1");
      if (!response.ok) throw new Error("maker_suggestions_load_failed");
      return (await response.json()).makers as SuggestedMaker[];
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
    mutationFn: async ({ maker, status }: { maker: MakerProfile; status?: "ACCEPTED" | "REJECTED" }) => {
      const incoming = maker.association?.status === "PENDING" && maker.association.addresseeId === session?.user?.id;
      const response = incoming
        ? await fetch(`/api/associations/${maker.association?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status ?? "ACCEPTED" }) })
        : await fetch("/api/associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresseeId: maker.id }) });
      if (!response.ok) throw new Error("association_failed");
      return response.json();
    },
    onSuccess: async (_result, variables) => {
      const acceptingIncoming = variables.maker.association?.status === "PENDING" && variables.maker.association.addresseeId === session?.user?.id;
      const messageKey = variables.status === "REJECTED" ? "makers.associationDeclined" : acceptingIncoming ? "makers.associated" : "makers.associationSent";
      if (!acceptingIncoming && variables.status !== "REJECTED") showToast(t(messageKey));
      else setNotice(t(messageKey));
      await queryClient.invalidateQueries({ queryKey: ["maker-profile", params.handle] });
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
  const associationLabel = association?.status === "ACCEPTED" ? t("makers.associated") : incoming ? t("makers.acceptAssociation") : association?.status === "PENDING" ? t("makers.associationSent") : t("makers.associate");
  const suggestedMakers = (suggestionsQuery.data ?? [])
    .filter((suggestion) => suggestion.id !== maker.id && suggestion.id !== session?.user?.id)
    .map((suggestion) => ({
      maker: suggestion,
      sharedSkills: suggestion.skills.filter((skill) => maker.skills.some((makerSkill) => makerSkill.toLocaleLowerCase() === skill.toLocaleLowerCase())),
    }))
    .filter(({ maker: suggestion, sharedSkills }) => skillFilter ? sharedSkills.some((skill) => skill.toLocaleLowerCase() === skillFilter.toLocaleLowerCase()) : sharedSkills.length > 0 || suggestion.openToCoBuild)
    .sort((first, second) => second.sharedSkills.length - first.sharedSkills.length || Number(second.maker.openToCoBuild) - Number(first.maker.openToCoBuild))
    .slice(0, 3);

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
            <Link href="/settings" aria-label={t("makers.editProfile")} className="-mt-14 shrink-0 rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><Avatar src={maker.image} name={maker.name} online={maker.isOnline} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></Link>
          ) : maker.image ? (
            <a href={maker.image} target="_blank" rel="noreferrer" aria-label={t("makers.viewAvatar", { name: maker.name ?? maker.handle ?? "Maker" })} className="-mt-14 shrink-0 rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"><Avatar src={maker.image} name={maker.name} online={maker.isOnline} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></a>
          ) : <div className="-mt-14 shrink-0 rounded-full p-1.5"><Avatar src={maker.image} name={maker.name} online={maker.isOnline} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" /></div>}
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
            {association?.status === "ACCEPTED" ? null : association?.status === "PENDING" && !incoming ? (
              <span className="badge self-center">{associationLabel}</span>
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
        <BadgeCollection badges={maker.badges} emptyLabel={t("gamification.emptyBadges")} />
      </section>

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
            <header>
              <h2 className="section-title text-base">{t("makers.projects")}</h2>
              <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Une sélection de projets créés ou développés en équipe." : "A selection of projects built solo or with a team."}</p>
            </header>
            {maker.projects.length > 0 ? (
              <ul className="grid gap-3 xl:grid-cols-2">
                {maker.projects.map((project) => <li key={project.id} className="min-w-0">
                  <article className="flex h-full flex-col overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/60 transition hover:border-gold/35 hover:bg-midnight-card">
                    <div className="flex items-center justify-between gap-3 border-b border-midnight-border/70 px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gold-soft"><Globe2 size={13} aria-hidden="true" />{isFrench ? "Projet" : "Project"}</span>
                      <span className="badge-gold text-[10px]">{t(`projects.status.${project.status}`)}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-ink hover:text-gold-soft">{project.title}<ArrowUpRight size={13} className="ml-1 inline" aria-hidden="true" /></Link>
                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-ink-muted">{project.tagline}</p>
                      {project.techStack.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5">{project.techStack.slice(0, 3).map((technology) => <li key={technology} className="rounded-full border border-midnight-border px-2 py-0.5 text-[10px] text-ink-muted">{technology}</li>)}</ul>}
                      <div className="mt-auto flex items-center gap-3 border-t border-midnight-border/70 pt-3 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1"><UsersRound size={12} aria-hidden="true" />{project._count.collaborators}</span>
                        {project._count.posts > 0 && <span className="inline-flex items-center gap-1"><FileText size={12} aria-hidden="true" />{project._count.posts}</span>}
                        <span className="ml-auto flex gap-2">
                          {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={isFrench ? `Visiter ${project.title}` : `Visit ${project.title}`} className="hover:text-gold-soft"><Globe2 size={14} aria-hidden="true" /></a>}
                          {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" aria-label={t("feed.openProjectOnGithub")} className="hover:text-gold-soft"><Github size={14} aria-hidden="true" /></a>}
                        </span>
                      </div>
                    </div>
                  </article>
                </li>)}
              </ul>
            ) : (
              <div className="card p-6 text-sm text-ink-muted">{isFrench ? "Aucun projet pour le moment." : "No projects yet."}</div>
            )}
          </section>
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
        <aside aria-label={isFrench ? "Informations du profil" : "Profile information"} className="space-y-4">
          <section className="card p-5">
            <h2 className="section-title text-base">{t("makers.about")}</h2>
            {maker.bio ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{maker.bio}</p> : <p className="mt-3 text-sm leading-6 text-ink-muted">{t("makers.noBio")}</p>}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("auth.skills")}</h2>
            <div className="flex flex-wrap gap-1.5">{maker.skills.length ? maker.skills.map((skill) => <button key={skill} type="button" aria-pressed={skillFilter === skill} onClick={() => setSkillFilter((current) => current === skill ? null : skill)} className={`badge transition hover:border-gold/40 hover:text-gold-soft ${skillFilter === skill ? "!border-gold/50 !bg-gold/10 !text-gold-soft" : ""}`}>{skill}</button>) : <span className="text-xs text-ink-muted">{t("makers.noSkills")}</span>}</div>
          </section>
          {(maker.githubUrl || maker.websiteUrl || maker.twitterUrl) && <section className="card p-5">
            <h2 className="section-title text-base">{isFrench ? "Liens" : "Links"}</h2>
            <ul className="mt-2 divide-y divide-midnight-border">
              {maker.websiteUrl && <li><a href={maker.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><Globe2 size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{t("makers.website")}</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {maker.githubUrl && <li><a href={maker.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><Github size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">GitHub</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {maker.twitterUrl && <li><a href={maker.twitterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted hover:text-gold-soft"><span className="min-w-0 flex-1 truncate">X / Twitter</span><ArrowUpRight size={13} aria-hidden="true" /></a></li>}
            </ul>
          </section>}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">{t("makers.suggestionsTitle")}</h2>
              {skillFilter && <button type="button" onClick={() => setSkillFilter(null)} className="text-[10px] text-gold-soft hover:text-gold-bright">{skillFilter} ×</button>}
            </div>
            {suggestionsQuery.isLoading ? (
              <div className="space-y-3" aria-busy="true"><div className="skeleton h-14 rounded-lg" /><div className="skeleton h-14 rounded-lg" /></div>
            ) : suggestedMakers.length ? (
              <ul className="divide-y divide-midnight-border">
                {suggestedMakers.map(({ maker: suggestion, sharedSkills }) => (
                  <li key={suggestion.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/makers/${encodeURIComponent(suggestion.handle ?? suggestion.id)}`} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
                      <Avatar src={suggestion.image} name={suggestion.name} size={34} online={suggestion.isOnline} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">{suggestion.name ?? suggestion.handle}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-ink-muted">{sharedSkills.length ? t("makers.sharedSkills", { count: sharedSkills.length }) : t("makers.openForCoBuilding")}</span>
                      </span>
                      <ArrowUpRight size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs leading-relaxed text-ink-muted">{t("makers.noSuggestions")}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}