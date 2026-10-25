"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Github,
  Globe2,
  Handshake,
  MapPin,
  Pencil,
  Plus,
  Users,
} from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { BadgeCollection, type AwardedBadge } from "@/components/GamificationBadges";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTranslation } from "@/lib/i18n";

type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  handle: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  openToCoBuild: boolean;
  isOnline: boolean;
  badges: AwardedBadge[];
  githubUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
  isVerified: boolean;
  _count: { projects: number; posts: number; collaborations: number };
};

type ProfileProject = {
  id: string;
  title: string;
  tagline: string;
  status: "IDEA" | "DEVELOPMENT" | "LAUNCHED";
  githubUrl: string | null;
  liveUrl: string | null;
  techStack: string[];
  _count: { collaborators: number; posts: number };
};
type MakerAssociation = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  requester: AssociationPerson;
  addressee: AssociationPerson;
};
type AssociationPerson = { id: string; name: string | null; handle: string | null; image: string | null };

export default function ProfilePage() {
  const { t, locale } = useTranslation();
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const isFrench = locale === "fr";
  const userId = session?.user?.id;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("profile_load_failed");
      const result = await response.json();
      return result.profile as UserProfile;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/projects?projects=1");
      if (!response.ok) throw new Error("projects_load_failed");
      const result = await response.json();
      return (result.projects as (ProfileProject & { collaborators?: { status: string }[] })[])
        .filter((project) => project.collaborators?.some((member) => member.status === "APPROVED"))
        .map(({ id, title, tagline, status, githubUrl, liveUrl, techStack, _count }) => ({ id, title, tagline, status, githubUrl, liveUrl, techStack, _count }));
    },
  });

  const postsQuery = useQuery({
    queryKey: ["posts", "author", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`/api/posts?authorId=${encodeURIComponent(userId ?? "")}&take=5`);
      if (!response.ok) throw new Error("posts_load_failed");
      const result = await response.json();
      return result.posts as FeedPost[];
    },
  });

  const associationsQuery = useQuery({
    queryKey: ["associations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/associations");
      if (!response.ok) throw new Error("associations_load_failed");
      return (await response.json()) as { associations: MakerAssociation[] };
    },
  });
  const reviewAssociation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ACCEPTED" | "REJECTED" }) => {
      const response = await fetch(`/api/associations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("association_review_failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["associations", userId] }),
  });

  const profile = profileQuery.data;
  const incomingAssociations = (associationsQuery.data?.associations ?? []).filter((association) => (
    association.addresseeId === profile?.id && association.status === "PENDING"
  ));
  const associatedPeople = Array.from(new Map(
    (associationsQuery.data?.associations ?? [])
      .filter((association) => association.status === "ACCEPTED")
      .map((association) => {
        const person = association.requesterId === profile?.id ? association.addressee : association.requester;
        return [person.id, person] as const;
      }),
  ).values());
  const loading = sessionStatus === "loading" || profileQuery.isLoading;

  if (loading) {
    return (
      <div className="space-y-6" aria-label={isFrench ? "Chargement du profil" : "Loading profile"}>
        <div className="skeleton h-44" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="skeleton h-96" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  if (!profile || profileQuery.isError) {
    return (
      <section className="card p-8 text-center">
        <h1 className="section-title">{isFrench ? "Profil indisponible" : "Profile unavailable"}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isFrench ? "Impossible de charger ce profil pour le moment." : "This profile couldn't be loaded right now."}
        </p>
      </section>
    );
  }

  const stats = [
    { label: isFrench ? "Projets" : "Projects", value: profile._count.projects, icon: Globe2 },
    { label: isFrench ? "Publications" : "Posts", value: profile._count.posts, icon: FileText },
    { label: isFrench ? "Collaborations" : "Collaborations", value: profile._count.collaborations, icon: Handshake },
  ];

  const profileLinks = [
    { label: "Website", href: profile.websiteUrl, icon: ExternalLink },
    { label: "GitHub", href: profile.githubUrl, icon: Github },
    { label: "X / Twitter", href: profile.twitterUrl, icon: ExternalLink },
  ].filter((link): link is { label: string; href: string; icon: typeof ExternalLink } => Boolean(link.href));

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
          <Link href="/settings" title={isFrench ? "Modifier la photo et le profil" : "Edit profile and avatar"} aria-label={isFrench ? "Modifier le profil" : "Edit profile"} className="-mt-14 shrink-0 rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
            <Avatar src={profile.image} name={profile.name} size={104} className="rounded-full bg-midnight-card ring-4 ring-midnight-card" />
          </Link>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{profile.name ?? "Maker"}</h1>
              {profile.isVerified && <VerifiedBadge label={isFrench ? "Profil vérifié" : "Verified profile"} />}
            </div>
            {profile.headline && <p className="mt-1.5 text-sm font-medium text-gold-soft sm:text-base">{profile.headline}</p>}
            {profile.handle && <p className="mt-1 text-xs text-ink-muted">@{profile.handle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 ${profile.isOnline ? "text-emerald-300" : "text-ink-muted"}`}><span className={`h-1.5 w-1.5 rounded-full ${profile.isOnline ? "bg-emerald-400" : "bg-ink-muted/50"}`} />{profile.isOnline ? (isFrench ? "En ligne" : "Online") : (isFrench ? "Hors ligne" : "Offline")}</span>
              {profile.openToCoBuild && <span className="inline-flex items-center gap-1.5 font-medium text-gold-soft"><Handshake size={13} aria-hidden="true" />{t("makers.brainstormAvailability")}</span>}
              {(profile.location || profile.city) && <span className="inline-flex items-center gap-1.5 text-ink-muted"><MapPin size={13} aria-hidden="true" />{profile.location ?? profile.city}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:mb-1">
            <Link href={`/makers/${encodeURIComponent(profile.handle ?? profile.id)}`} className="btn-ghost !rounded-lg">
              <ExternalLink size={15} aria-hidden="true" />{isFrench ? "Aperçu public" : "Public preview"}
            </Link>
            <Link href="/settings" className="btn-gold !rounded-lg">
              <Pencil size={15} aria-hidden="true" />{isFrench ? "Modifier le profil" : "Edit profile"}
            </Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="profile-badges-title" className="card space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-badges-title" className="section-title text-base">{t("gamification.profileBadges")}</h2>
          <span className="text-xs text-ink-muted">{profile.badges.length}</span>
        </div>
        <BadgeCollection badges={profile.badges} emptyLabel={t("gamification.emptyBadges")} />
      </section>

      <section aria-label={isFrench ? "Statistiques du profil" : "Profile statistics"} className="card grid grid-cols-3 divide-x divide-midnight-border px-1 py-3 sm:px-5 sm:py-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center justify-center gap-2 px-1.5 sm:gap-3 sm:px-4">
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold-soft sm:grid">
              <Icon size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 text-center sm:text-left">
              <p className="truncate text-base font-semibold tabular-nums text-ink sm:text-lg">{value}</p>
              <p className="truncate text-[10px] text-ink-muted sm:text-xs">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <aside aria-label={isFrench ? "Informations du profil" : "Profile information"} className={`order-2 min-w-0 space-y-4 lg:order-2 ${profile.isVerified ? "lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain" : ""}`}>
          {!profile.isVerified && (
            <section className="card border-gold/30 bg-gradient-to-br from-gold/10 to-midnight-card/80 p-5">
              <div className="flex items-center gap-2 text-gold-soft">
                <BadgeCheck size={17} aria-hidden="true" />
                <h2 className="text-sm font-semibold">{isFrench ? "Faites vérifier votre profil" : "Get your profile verified"}</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                {isFrench
                  ? "Confirmez votre adresse e-mail pour afficher le badge de vérification sur votre profil et vos publications."
                  : "Confirm your email address to display the verification badge on your profile and posts."}
              </p>
            </section>
          )}

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title text-base">{isFrench ? "Personnes associées" : "Associated people"}</h2>
              <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs tabular-nums text-gold-soft">{associatedPeople.length}</span>
            </div>
            {associationsQuery.isLoading ? (
              <div className="space-y-3 py-2" aria-label={isFrench ? "Chargement des personnes associées" : "Loading associated people"}>
                <div className="skeleton h-10" />
                <div className="skeleton h-10" />
              </div>
            ) : associationsQuery.isError ? (
              <p role="alert" className="text-sm text-rose-300">
                {isFrench ? "Impossible de charger les personnes associées." : "Couldn't load associated people."}
              </p>
            ) : associatedPeople.length > 0 ? (
              <ul className="divide-y divide-midnight-border">
                {associatedPeople.map((person) => (
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
                      <ExternalLink size={14} aria-hidden="true" className="shrink-0 text-ink-muted transition group-hover:text-gold-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-ink-muted">
                {isFrench ? "Vos personnes associées apparaîtront ici." : "Your associated people will appear here."}
              </p>
            )}
          </section>

          {incomingAssociations.length > 0 && (
            <section id="association-requests" className="card space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{t("notifications.associationRequests")}</h2>
                <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs tabular-nums text-gold-soft">{incomingAssociations.length}</span>
              </div>
              <ul className="divide-y divide-midnight-border">
                {incomingAssociations.map((association) => (
                  <li key={association.id} className="space-y-3 py-3 last:pb-0">
                    <div className="flex items-center gap-3">
                      <Avatar src={association.requester.image} name={association.requester.name} size={36} />
                      <p className="min-w-0 text-sm leading-5 text-ink">{t("notifications.associationRequest", { actor: association.requester.name ?? (association.requester.handle ? `@${association.requester.handle}` : t("notifications.someone")) })}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={reviewAssociation.isPending} onClick={() => reviewAssociation.mutate({ id: association.id, status: "REJECTED" })} className="btn-ghost !min-h-9 flex-1 !rounded-lg !px-3 !py-2 text-xs">{t("notifications.decline")}</button>
                      <button type="button" disabled={reviewAssociation.isPending} onClick={() => reviewAssociation.mutate({ id: association.id, status: "ACCEPTED" })} className="btn-gold !min-h-9 flex-1 !rounded-lg !px-3 !py-2 text-xs">{t("notifications.accept")}</button>
                    </div>
                  </li>
                ))}
              </ul>
              {reviewAssociation.isError && <p role="alert" className="text-xs text-rose-300">{t("makers.actionError")}</p>}
            </section>
          )}

          <section className="card p-5">
            <h2 className="section-title text-base">{isFrench ? "À propos" : "About"}</h2>
            {profile.bio ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{profile.bio}</p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {isFrench ? "Ajoutez une présentation pour aider les makers à vous connaître." : "Add a bio to help other makers get to know you."}
              </p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title text-base">{isFrench ? "Compétences" : "Skills"}</h2>
            {profile.skills.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => <li key={skill}><Link href={`/discover?tag=${encodeURIComponent(skill)}`} className="badge transition hover:border-gold/40 hover:text-gold-soft">{skill}</Link></li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">{isFrench ? "Aucune compétence ajoutée." : "No skills added yet."}</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title text-base">{isFrench ? "Liens" : "Links"}</h2>
            {profileLinks.length ? (
              <ul className="mt-2 divide-y divide-midnight-border">
                {profileLinks.map(({ label, href, icon: Icon }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-3 text-sm text-ink-muted transition hover:text-gold-soft">
                      <Icon size={16} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{href.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">{isFrench ? "Aucun lien ajouté." : "No links added yet."}</p>
            )}
          </section>
        </aside>

        <div className="order-1 min-w-0 space-y-8 lg:order-1">
          <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title text-base">{isFrench ? "Projets à la une" : "Featured projects"}</h2>
              <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Projets que vous construisez." : "Projects you're building."}</p>
            </div>
            <Link href="/projects/new" aria-label={isFrench ? "Créer un projet" : "Create a project"} title={isFrench ? "Créer un projet" : "Create a project"} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
              <Plus size={17} aria-hidden="true" />
              {isFrench ? "Nouveau projet" : "New project"}
            </Link>
          </div>
          {projectsQuery.isLoading ? (
            <div className="space-y-3 p-5"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
          ) : projectsQuery.data?.length ? (
            <ul className="grid gap-3 xl:grid-cols-2">
              {projectsQuery.data.map((project) => (
                <li key={project.id} className="min-w-0">
                  <div className="flex h-full overflow-hidden rounded-xl border border-midnight-border bg-midnight-card/60 transition hover:border-gold/35 hover:bg-midnight-card">
                    <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 flex-col p-4 transition sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-sm font-semibold text-ink">{project.title}</h3>
                        <span className="badge-gold shrink-0 text-[10px]">{t(`projects.status.${project.status}`)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-ink-muted">{project.tagline}</p>
                      {project.techStack.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5">{project.techStack.slice(0, 3).map((technology) => <li key={technology} className="rounded-full border border-midnight-border px-2 py-0.5 text-[10px] text-ink-muted">{technology}</li>)}</ul>}
                      <div className="mt-auto flex items-center gap-4 border-t border-midnight-border/70 pt-3 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden="true" />{project._count.collaborators} {isFrench ? "collaborateurs" : "collaborators"}</span>
                        <span>{project._count.posts} {isFrench ? "publications" : "updates"}</span>
                      </div>
                    </Link>
                    {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" aria-label={t("feed.openProjectOnGithub")} title={t("feed.openProjectOnGithub")} className="grid shrink-0 place-items-center border-l border-midnight-border px-3 text-ink-muted transition hover:bg-midnight-deep/35 hover:text-gold-soft"><Github size={17} aria-hidden="true" /></a>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-6 text-sm text-ink-muted">
              {isFrench ? "Aucun projet pour le moment." : "No projects yet."}
            </div>
          )}
          </section>

          <section className="space-y-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title text-base">{isFrench ? "Activité récente" : "Recent activity"}</h2>
            <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Vos dernières publications dans la communauté." : "Your latest posts in the community."}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <FileText size={14} aria-hidden="true" />{profile._count.posts}
          </span>
        </header>
        {postsQuery.isLoading ? (
          <div className="space-y-4"><div className="skeleton h-36" /><div className="skeleton h-36" /></div>
        ) : postsQuery.data?.length ? (
          <div className="space-y-4">{postsQuery.data.map((post) => <PostCard key={post.id} post={post} variant="compact" showJoinAction={false} />)}</div>
        ) : (
          <div className="card p-6 text-sm text-ink-muted">
            {isFrench ? "Aucune publication pour le moment." : "No posts yet."}
          </div>
        )}
          </section>
        </div>
      </div>
    </div>
  );
}