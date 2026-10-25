"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Compass,
  Loader2,
  Plus,
  Search,
  Settings2,
  UserPlus,
  UsersRound,
  X,
} from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";

interface TeamProject {
  id: string;
  creatorId: string;
  title: string;
  teamName: string | null;
  logoUrl: string | null;
  tagline: string;
  lookingFor: string[];
  creator: { id: string; name: string | null; handle: string | null };
  collaborators: { userId: string; role: string; status: "PENDING" | "APPROVED" | "REJECTED"; user?: { id: string; name: string | null; image: string | null } }[];
  _count: { collaborators: number; teamPosts: number };
}

function displayName(team: Pick<TeamProject, "teamName" | "title">) {
  return team.teamName?.trim() || team.title;
}

function approvedCollaborators(team: TeamProject) {
  return team.collaborators.filter((item) => item.status === "APPROVED" && item.userId !== team.creatorId);
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function TeamMark({ team, size = 44 }: { team: Pick<TeamProject, "logoUrl" | "teamName" | "title">; size?: number }) {
  const name = displayName(team);
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-midnight-border bg-midnight-card text-gold-soft"
      style={{ height: size, width: size }}
    >
      {team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-sm font-semibold">{initialsFor(name) || <UsersRound size={18} aria-hidden="true" />}</span>
      )}
    </div>
  );
}

function CollaboratorAvatars({ team, label }: { team: TeamProject; label: string }) {
  const collaborators = approvedCollaborators(team).filter((item) => item.user).slice(0, 3);
  const count = approvedCollaborators(team).length;
  return (
    <span className="inline-flex min-w-0 items-center gap-2" aria-label={`${count} ${label}`}>
      <span className="flex shrink-0 -space-x-2" aria-hidden="true">
        {collaborators.map((item) => (
          <Avatar key={item.userId} src={item.user?.image} name={item.user?.name} size={24} className="rounded-full ring-2 ring-midnight-card" />
        ))}
      </span>
      <span className="truncate">{count} {label}</span>
    </span>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="card flex flex-col gap-0.5 px-4 py-3">
      <span className="font-display text-2xl font-semibold text-ink tabular-nums">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="skeleton flex flex-col gap-4 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-midnight-card/60" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-midnight-card/60" />
          <div className="h-2.5 w-1/3 rounded bg-midnight-card/60" />
        </div>
      </div>
      <div className="h-2.5 w-full rounded bg-midnight-card/60" />
      <div className="h-2.5 w-4/5 rounded bg-midnight-card/60" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof UsersRound;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-midnight-border bg-midnight-card text-gold-soft">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mx-auto max-w-xs text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function TeamsPage() {
  const { t } = useTranslation();
  const { showToast } = useActionToast();
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const { data: teams, isLoading, isError, error: teamsError } = useQuery({
    queryKey: ["teams", "mine"],
    queryFn: async () => {
      const response = await fetch("/api/projects?teams=1");
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : response.status === 403 ? "FORBIDDEN" : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "TEAMS_LOAD_FAILED");
      }
      const data = (await response.json()) as { projects: TeamProject[] };
      return data.projects;
    },
  });

  const { data: discoverableTeams, isLoading: discoverLoading, isError: discoverError, error: discoverTeamsError } = useQuery({
    queryKey: ["teams", "discover"],
    queryFn: async () => {
      const response = await fetch("/api/projects?teams=discover");
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : response.status === 403 ? "FORBIDDEN" : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "TEAMS_LOAD_FAILED");
      }
      const data = (await response.json()) as { projects: TeamProject[] };
      return data.projects;
    },
  });

  function loadErrorMessage(error: unknown) {
    if (error instanceof TypeError) return t("auth.errors.networkUnavailable");
    if (error instanceof Error && error.message === "UNAUTHORIZED") return t("auth.errors.sessionExpired");
    if (error instanceof Error && error.message === "FORBIDDEN") return t("auth.errors.accessDenied");
    return t("auth.errors.serviceUnavailable");
  }

  const joinMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await fetch(`/api/projects/${teamId}/collaborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CO_BUILDER" }),
      });
      if (!response.ok) throw new Error("team_join_failed");
      const data = (await response.json()) as {
        collaborator: { userId: string; role: string; status: "PENDING" | "APPROVED" | "REJECTED" };
      };
      return { teamId, collaborator: data.collaborator };
    },
    onSuccess: async ({ teamId, collaborator }) => {
      queryClient.setQueryData<TeamProject[]>(["teams", "discover"], (current) =>
        current?.map((team) => (team.id === teamId ? { ...team, collaborators: [...team.collaborators, collaborator] } : team)),
      );
      if (collaborator.status === "PENDING") showToast(t("teams.requestSubmitted"));
      await queryClient.invalidateQueries({ queryKey: ["teams", "mine"] });
    },
  });

  const currentUserId = session?.user?.id;

  const yourTeams = (teams ?? []).filter(
    (team) =>
      team.creatorId === currentUserId ||
      team.collaborators.some((item) => item.userId === currentUserId && item.status === "APPROVED"),
  );

  const discoverableAll = (discoverableTeams ?? []).filter(
    (team) =>
      team.creatorId !== currentUserId &&
      !team.collaborators.some((item) => item.userId === currentUserId && item.status === "APPROVED"),
  );

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    discoverableAll.forEach((team) => team.lookingFor.forEach((role) => roles.add(role)));
    return Array.from(roles).sort();
  }, [discoverableAll]);

  const matchesQuery = (team: TeamProject) => {
    if (!query.trim()) return true;
    const haystack = `${displayName(team)} ${team.tagline}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  };

  const discoverable = discoverableAll.filter(
    (team) =>
      matchesQuery(team) &&
      (!roleFilter || team.lookingFor.includes(roleFilter)),
  );

  const stats = {
    teams: yourTeams.length,
    openRoles: yourTeams.reduce((sum, team) => sum + team.lookingFor.length, 0),
    collaborators: yourTeams.reduce((sum, team) => sum + approvedCollaborators(team).length, 0),
  };

  const hasActiveFilters = query.trim().length > 0 || Boolean(roleFilter);
  const clearFilters = () => {
    setQuery("");
    setRoleFilter(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">{t("teams.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("teams.subtitle")}</p>
        </div>
        <Link href="/teams/new" className="btn-gold">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("teams.createAction")}
        </Link>
      </header>

      {!isLoading && !isError && yourTeams.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile value={stats.teams} label={t("teams.stats.teams")} />
          <StatTile value={stats.openRoles} label={t("teams.stats.openRoles")} />
          <StatTile value={stats.collaborators} label={t("teams.stats.collaborators")} />
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 border-b border-midnight-border pb-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t("teams.yourTeams")}</h2>
          </div>
          {yourTeams.length ? <span className="text-xs tabular-nums text-ink-muted">{yourTeams.length}</span> : null}
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : isError ? (
          <p role="alert" className="text-sm text-rose-300">
            {loadErrorMessage(teamsError)}
          </p>
        ) : !yourTeams.length ? (
          <EmptyState
            icon={UsersRound}
            title={t("teams.empty")}
            description={t("teams.emptyDescription")}
            action={
              <Link href="/teams/new" className="btn-gold">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("teams.createAction")}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {yourTeams.map((team) => {
              const membership = team.collaborators.find((item) => item.userId === session?.user?.id);
              const isOwner = team.creatorId === session?.user?.id;
              return (
                <article key={team.id} className="card space-y-4 p-4 transition hover:border-gold/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamMark team={team} />
                      <div className="min-w-0">
                        <Link
                          href={`/teams/${team.id}`}
                          className="inline-flex items-center gap-1 font-display text-lg font-semibold text-ink hover:text-gold-soft"
                        >
                          {displayName(team)}
                          <ArrowUpRight size={14} aria-hidden="true" />
                          <span className="sr-only">{t("teams.viewDetails")}</span>
                        </Link>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{team.tagline}</p>
                      </div>
                    </div>
                  </div>

                  {membership && !isOwner && (
                    <span className="inline-flex rounded-full border border-midnight-border px-2.5 py-1 text-xs text-ink-muted">
                      {t(`teams.membership.${membership.status}`)}
                    </span>
                  )}

                  {team.lookingFor.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {team.lookingFor.map((role) => (
                        <span key={role} className="badge">
                          {t(`projects.roles.${role}`)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-midnight-border/70 pt-3 text-xs text-ink-muted sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <CollaboratorAvatars team={team} label={t("projects.collaborators").toLowerCase()} />
                      <span className="shrink-0">{team._count.teamPosts} posts</span>
                    </div>
                    {isOwner && (
                      <div className="flex items-center justify-end gap-1 sm:ml-auto">
                        <Link
                          href={`/teams/${team.id}/manage`}
                          className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft"
                        >
                          <UsersRound size={14} aria-hidden="true" />
                          {t("teams.manageAction")}
                        </Link>
                        <Link
                          href={`/teams/${team.id}/settings`}
                          title={t("teams.settingsAction")}
                          aria-label={t("teams.settingsAction")}
                          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card hover:text-gold-soft"
                        >
                          <Settings2 size={14} aria-hidden="true" />
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-midnight-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t("teams.discoverTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("teams.discoverSubtitle")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <span className="sr-only">{t("teams.searchLabel")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("teams.searchPlaceholder")}
              className="input !py-2 !pl-9 !pr-3"
            />
          </label>

        </div>

        {availableRoles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {availableRoles.map((role) => {
              const active = roleFilter === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(active ? null : role)}
                  className={active ? "badge-gold" : "badge transition hover:border-gold/40"}
                >
                  {t(`projects.roles.${role}`)}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition hover:text-gold-soft"
              >
                <X size={12} aria-hidden="true" />
                {t("teams.filters.clear")}
              </button>
            )}
          </div>
        )}

        {discoverLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : discoverError ? (
          <p role="alert" className="text-sm text-rose-300">
            {loadErrorMessage(discoverTeamsError)}
          </p>
        ) : discoverableAll.length === 0 ? (
          <EmptyState icon={Compass} title={t("teams.discoverEmpty")} description={t("teams.discoverEmptyDescription")} />
        ) : discoverable.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t("teams.noResults")}
            description={t("teams.noResultsDescription")}
            action={
              <button type="button" onClick={clearFilters} className="btn-ghost">
                {t("teams.filters.clear")}
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {discoverable.map((team) => {
              const membership = team.collaborators.find((item) => item.userId === session?.user?.id);
              const isJoining = joinMutation.isPending && joinMutation.variables === team.id;
              return (
                <article key={team.id} className="card space-y-4 p-4 transition hover:border-gold/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamMark team={team} />
                      <div className="min-w-0">
                        <Link
                          href={`/teams/${team.id}`}
                          className="inline-flex items-center gap-1 font-display text-lg font-semibold text-ink hover:text-gold-soft"
                        >
                          {displayName(team)}
                          <ArrowUpRight size={14} aria-hidden="true" />
                          <span className="sr-only">{t("teams.viewDetails")}</span>
                        </Link>
                        <p className="mt-1 truncate text-xs text-ink-muted">
                          {t("teams.createdBy", {
                            name: team.creator.handle ? `@${team.creator.handle}` : team.creator.name ?? t("teams.unknownMember"),
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-sm text-ink-muted">{team.tagline}</p>

                  {team.lookingFor.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {team.lookingFor.map((role) => (
                        <span key={role} className={role === roleFilter ? "badge-gold" : "badge"}>
                          {t(`projects.roles.${role}`)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-midnight-border/70 pt-3 text-xs text-ink-muted sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <CollaboratorAvatars team={team} label={t("projects.collaborators").toLowerCase()} />
                      <span className="shrink-0">{team._count.teamPosts} posts</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
                      <Link href={`/teams/${team.id}`} className="inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-midnight-border px-2 text-xs font-medium text-gold-soft hover:border-gold/30 hover:text-gold-bright sm:min-h-0 sm:rounded-none sm:border-0 sm:px-0">
                        {t("teams.viewDetails")}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        disabled={Boolean(membership) || joinMutation.isPending || sessionStatus !== "authenticated"}
                        onClick={() => joinMutation.mutate(team.id)}
                        className={`${membership ? "btn-ghost" : "btn-gold"} !min-h-9 !justify-center !gap-1.5 !rounded-lg !px-2 !py-2 text-xs sm:!px-3`}
                      >
                        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="whitespace-nowrap">{isJoining ? t("teams.joining") : membership ? t(`teams.membership.${membership.status}`) : t("teams.joinAction")}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {joinMutation.isError && (
          <p role="alert" className="text-sm text-rose-300">
            {t("teams.joinError")}
          </p>
        )}
      </section>
    </div>
  );
}
