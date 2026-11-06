"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Github, Globe2, Loader2, Plus, Settings2, Share2, UsersRound, X } from "@/components/FontAwesomeIcons";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { useActionToast } from "@/components/ActionToast";
import { Feed } from "@/components/Feed";
import { Code2 } from "lucide-react";
import { ApplicationRoleSelect } from "@/components/ApplicationRoleSelect";
import type { CollaborationFormQuestion } from "@/lib/collaboration-form";

const TEAM_ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;
type Member = {
  id: string;
  role: string;
  user: { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null };
};
type TeamDetails = {
  id: string;
  parentTeamId: string | null;
  parentTeam: { collaborationQuestions: string[] } | null;
  title: string;
  teamName: string | null;
  isTeamVerified: boolean;
  slug: string;
  tagline: string;
  description: string;
  teamDescription: string | null;
  teamRules: string | null;
  collaborationForm: CollaborationFormQuestion[] | null;
  isPrivate: boolean;
  logoUrl: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  docsUrl: string | null;
  pitchDeckUrl: string | null;
  techStack: string[];
  tags: string[];
  lookingFor: string[];
  collaborationQuestions: string[];
  createdAt: string;
  isOwner: boolean;
  creator: Member["user"];
  collaborators: Member[];
  currentMembership: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; role: string; invitedById: string | null } | null;
  postCount: number;
};
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TeamTask = { id: string; title: string; status: TaskStatus; assignee: { name: string | null; handle: string | null } | null };
const taskStages: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

function selectedAnswerOptions(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((option) => typeof option === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export default function TeamDetailPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useActionToast();
  const { data: session } = useSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [joinRole, setJoinRole] = useState<typeof TEAM_ROLES[number]>("CO_BUILDER");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [applicationAnswers, setApplicationAnswers] = useState<string[]>([]);
  const [joinStep, setJoinStep] = useState(0);
  const [acceptedTeamRules, setAcceptedTeamRules] = useState(false);
  const [joinFormOpen, setJoinFormOpen] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [notice, setNotice] = useState("");

  const { data: team, isLoading, isError } = useQuery({
    queryKey: ["team", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${params.id}`);
      if (!response.ok) throw new Error("team_detail_load_failed");
      const data = await response.json() as { team: TeamDetails };
      return data.team;
    },
  });
  const openRoles = team?.lookingFor.length
    ? TEAM_ROLES.filter((role) => team.lookingFor.includes(role))
    : TEAM_ROLES;
  const teamCollaborationQuestions = team?.collaborationForm
    ?? (team?.collaborationQuestions ?? []).map((label) => ({ label, type: "LONG_TEXT" as const, options: [] }));
  const applicationQuestions = teamCollaborationQuestions.length
    ? teamCollaborationQuestions
    : [{ label: t("teams.defaultJoinQuestion"), type: "LONG_TEXT" as const, options: [] }];
  const hasJoinRules = Boolean(team?.teamRules?.trim());
  const rulesStep = hasJoinRules ? 1 : -1;
  const questionStepStart = 1 + Number(hasJoinRules);
  const messageStep = questionStepStart + applicationQuestions.length;
  const joinStepCount = messageStep + 1;
  const selectedJoinRole = openRoles.includes(joinRole) ? joinRole : openRoles[0] ?? "CO_BUILDER";
  const canApply = Boolean(team && !team.isOwner && !team.isPrivate && (!team.currentMembership || team.currentMembership.status === "REJECTED"));
  const joinMutation = useMutation({
    mutationFn: async (): Promise<NonNullable<TeamDetails["currentMembership"]>> => {
      const response = await fetch(`/api/projects/${params.id}/collaborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedJoinRole,
          message: [
            ...(!teamCollaborationQuestions.length ? [`${applicationQuestions[0].label}\n${applicationAnswers[0]?.trim() ?? ""}`] : []),
            applicationMessage.trim(),
          ].filter(Boolean).join("\n\n"),
          ...(teamCollaborationQuestions.length ? { answers: applicationAnswers } : {}),
          acceptedTeamRules,
        }),
      });
      if (!response.ok) throw new Error("team_join_failed");
      const data = await response.json() as { collaborator: NonNullable<TeamDetails["currentMembership"]> };
      return data.collaborator;
    },
    onSuccess: async (membership) => {
      setJoinError("");
      setApplicationMessage("");
      setApplicationAnswers([]);
      setAcceptedTeamRules(false);
      setJoinFormOpen(false);
      showToast(t("teams.requestSubmitted"));
      queryClient.setQueryData<TeamDetails>(["team", params.id], (current) => current
        ? { ...current, currentMembership: membership }
        : current);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: () => setJoinError(t("teams.joinError")),
  });
  const tasksQuery = useQuery({
    queryKey: ["project-tasks", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}/tasks`);
      if (!response.ok) throw new Error("team_tasks_load_failed");
      return (await response.json()).tasks as TeamTask[];
    },
  });
  const invitationResponse = useMutation({
    mutationFn: async (status: "APPROVED" | "REJECTED") => {
      if (!team?.currentMembership?.id) throw new Error("invitation_not_found");
      const response = await fetch(`/api/projects/${params.id}/collaborators/${team.currentMembership.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("invitation_response_failed");
      return status;
    },
    onSuccess: async (status) => {
      setNotice(t(status === "APPROVED" ? "teams.invitationAccepted" : "teams.invitationDeclined"));
      await queryClient.invalidateQueries({ queryKey: ["team", params.id] });
      if (status === "APPROVED") router.push(`/projects/${params.id}/co-building`);
    },
  });
  const membershipAction = useMutation({
    mutationFn: async (): Promise<"PENDING" | "APPROVED"> => {
      const currentMembership = team?.currentMembership;
      if (!currentMembership || (currentMembership.status !== "PENDING" && currentMembership.status !== "APPROVED")) {
        throw new Error("membership_action_unavailable");
      }
      const response = await fetch(`/api/projects/${params.id}/collaborators/${currentMembership.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("membership_action_failed");
      return currentMembership.status;
    },
    onSuccess: async (status) => {
      setJoinError("");
      setNotice(t(status === "PENDING" ? "teams.joinRequestCancelled" : "teams.teamLeft"));
      queryClient.setQueryData<TeamDetails>(["team", params.id], (current) => current
        ? {
          ...current,
          currentMembership: null,
          collaborators: current.collaborators.filter((member) => member.user.id !== session?.user?.id),
        }
        : current);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: () => setJoinError(t("teams.membershipActionError")),
  });

  function submitJoinRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joinStep === 0) {
      setJoinStep(1);
      return;
    }
    if (joinStep === rulesStep) {
      if (!acceptedTeamRules) {
        setJoinError(t("teams.acceptRulesRequired"));
        return;
      }
      setJoinError("");
      setJoinStep((current) => current + 1);
      return;
    }
    if (joinStep < messageStep) {
      const questionIndex = joinStep - questionStepStart;
      const question = applicationQuestions[questionIndex];
      const answer = applicationAnswers[questionIndex]?.trim() ?? "";
      const missingAnswer = !answer
        || (question.type === "MULTIPLE_CHOICE" && selectedAnswerOptions(answer).length === 0);
      if (missingAnswer) {
        setJoinError(t("teams.joinError"));
        return;
      }
      setJoinError("");
      setJoinStep((current) => current + 1);
      return;
    }
    joinMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6" aria-busy="true">
        <div className="skeleton h-8 w-28" />
        <div className="skeleton h-40 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3" aria-label={t("teams.teamMembers")}><div className="skeleton h-8 w-40" /><div className="skeleton h-14 rounded-lg" /><div className="skeleton h-14 rounded-lg" /><div className="skeleton h-14 rounded-lg" /></div>
          <div className="space-y-3" aria-label={t("teams.recentPosts")}><div className="skeleton h-8 w-40" /><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/teams" className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" />{t("teams.title")}
        </Link>
        <p role="alert" className="card p-5 text-sm text-rose-300">{t("teams.detailLoadError")}</p>
      </div>
    );
  }

  const membership = team.currentMembership;
  const members = [
    { id: "creator", role: "FOUNDER", user: team.creator },
    ...team.collaborators.filter((member) => member.user.id !== team.creator.id),
  ];
  const overviewStats = [
    { label: t("teams.teamMembers"), value: members.length.toLocaleString(locale), icon: UsersRound },
    { label: t("teams.recentPosts"), value: team.postCount.toLocaleString(locale), icon: Activity },
    { label: t("teams.createdAt"), value: new Date(team.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short" }), icon: CalendarDays },
  ];
  const teamName = team.teamName?.trim() || team.title;
  const teamTagline = team.tagline;
  const teamDescription = team.teamDescription?.trim() || team.description;
  const tasks = tasksQuery.data ?? [];

  async function shareHub() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: teamName, text: teamTagline, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setNotice(t("teams.hubShared"));
    } catch {
      setNotice(t("teams.hubShareError"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Link href="/teams" className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-ink-muted transition hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />{t("teams.title")}
      </Link>

      <header className="mobile-edge-card rounded-xl border border-midnight-border bg-midnight-card/55 p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-gold/25 bg-midnight-deep text-gold-soft sm:h-[4.5rem] sm:w-[4.5rem]">
            {team.logoUrl ? <Image src={team.logoUrl} alt="" width={72} height={72} priority unoptimized className="h-full w-full object-cover" /> : <UsersRound size={27} aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase text-gold-soft">{t("teams.manageEyebrow")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">{teamName}</h1>
              {team.isTeamVerified && <span className="badge-gold">{locale === "fr" ? "Équipe vérifiée" : "Verified team"}</span>}
              {team.isPrivate && <span className="badge">{t("teams.privacyPrivate")}</span>}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-ink-muted">{team.tagline}</p>
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {t("teams.createdBy", { name: team.creator.handle ? `@${team.creator.handle}` : team.creator.name ?? t("teams.unknownMember") })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:self-start">
            {(team.isOwner || membership?.status === "APPROVED") && (
              <Link href={`/teams/${team.id}/projects/new`} className="btn-gold !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                <Plus size={14} aria-hidden="true" />{locale === "fr" ? "Créer un projet" : "Create project"}
              </Link>
            )}
            {team.isOwner ? (
              <Link href={`/teams/${team.id}/settings`} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                <Settings2 size={14} aria-hidden="true" />{t("teams.settingsAction")}
              </Link>
            ) : !membership && (
              <Link href="#recruitment" className="btn-gold !min-h-9 !rounded-lg !px-3 !py-2 text-xs">{t("teams.buildWithUs")}</Link>
            )}
            <button type="button" onClick={shareHub} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs" aria-label={t("teams.shareHub")} title={t("teams.shareHub")}>
              <Share2 size={14} aria-hidden="true" /><span>{t("teams.shareHub")}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-midnight-border/70 pt-3">
          {overviewStats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="inline-flex items-center gap-2">
              <Icon size={14} className="shrink-0 text-gold-soft" aria-hidden="true" />
              <span className="text-xs font-semibold tabular-nums text-ink">{value}</span>
              <span className="text-xs text-ink-muted">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {joinError && <p role="alert" className="text-sm text-rose-300">{joinError}</p>}
      {invitationResponse.isError && <p role="alert" className="text-sm text-rose-300">{t("teams.invitationError")}</p>}
      {notice && <p role="status" aria-live="polite" className="inline-flex rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-soft">{notice}</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          {(team.isOwner || membership?.status === "APPROVED") && (
            <Link href={`/projects/${team.id}/co-building`} className="card flex items-center gap-4 p-4 transition hover:border-gold/40 sm:p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                <Code2 size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">
                  {locale === "fr" ? "Collaboration en direct" : "Live collaboration"}
                </p>
                <span className="mt-1 block text-lg font-semibold text-ink">
                  {locale === "fr" ? "Espace de co-building" : "Co-building workspace"}
                </span>
                <span className="mt-1 block text-sm leading-6 text-ink-muted">
                  {locale === "fr"
                    ? "Explorez l’arborescence du projet, importez des fichiers ou un dossier source, puis codez et échangez en temps réel."
                    : "Browse the project tree, import source files or a folder, then code and collaborate in real time."}
                </span>
              </span>
              <ArrowUpRight size={17} className="shrink-0 text-ink-muted" aria-hidden="true" />
            </Link>
          )}
          <section id="activity" className="border-t border-midnight-border pt-6">
            <Feed teamId={team.id} projectLabel={teamName} teamLogoUrl={team.logoUrl} defaultPostType="TEAM" canCompose={team.isOwner || membership?.status === "APPROVED"} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section id="about" className="card space-y-3 p-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("teams.aboutTitle")}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-muted">{teamDescription}</p>
            </div>
            {(team.githubUrl || team.liveUrl || team.docsUrl || team.pitchDeckUrl) && (
              <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-midnight-border pt-3">
                {team.githubUrl && <li><a href={team.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-gold-soft"><Github size={14} aria-hidden="true" />GitHub<ArrowUpRight size={12} aria-hidden="true" /></a></li>}
                {team.liveUrl && <li><a href={team.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-gold-soft"><Globe2 size={14} aria-hidden="true" />{t("teams.liveUrl")}<ArrowUpRight size={12} aria-hidden="true" /></a></li>}
                {team.docsUrl && <li><a href={team.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-gold-soft"><FileText size={14} aria-hidden="true" />{t("teams.docsLink")}<ArrowUpRight size={12} aria-hidden="true" /></a></li>}
                {team.pitchDeckUrl && <li><a href={team.pitchDeckUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-gold-soft"><ArrowUpRight size={14} aria-hidden="true" />{t("teams.pitchDeck")}<ArrowUpRight size={12} aria-hidden="true" /></a></li>}
              </ul>
            )}
            {team.teamRules?.trim() && (
              <details className="border-t border-midnight-border pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-ink marker:text-gold-soft">{t("teams.teamRulesTitle")}</summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">{team.teamRules}</p>
              </details>
            )}
          </section>

          <section aria-labelledby="team-board-title" className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="team-board-title" className="text-sm font-semibold text-ink">{t("projects.kanbanTitle")}</h2>
                <p className="mt-1 text-xs text-ink-muted">{t("teams.boardPreview")}</p>
              </div>
              <Link href={`/projects/${team.id}#project-board-title`} aria-label={t("teams.openBoard")} title={t("teams.openBoard")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-midnight-border text-gold-soft transition hover:border-gold/40 hover:bg-gold/10">
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {tasksQuery.isLoading ? (
              <div className="space-y-2" aria-busy="true">{taskStages.map((status) => <div key={status} className="skeleton h-12 rounded-lg" />)}</div>
            ) : (
              <div className="space-y-3">
                {taskStages.map((status) => {
                  const columnTasks = tasks.filter((task) => task.status === status);
                  const markerClass = status === "DONE" ? "bg-emerald-400" : status === "IN_PROGRESS" ? "bg-amber-300" : "bg-sky-400";
                  return (
                    <section key={status} aria-label={t(`projects.taskStatus.${status}`)} className="min-w-0 border-t border-midnight-border pt-2.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase text-ink-muted"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${markerClass}`} aria-hidden="true" />{t(`projects.taskStatus.${status}`)}</h3>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{columnTasks.length}</span>
                      </div>
                      {columnTasks.length ? (
                        <ul className="space-y-1.5">
                          {columnTasks.slice(0, 2).map((task) => (
                            <li key={task.id} className="rounded-md border border-midnight-border/80 bg-midnight-deep/40 px-2.5 py-2">
                              <p className="break-words text-xs font-medium text-ink">{task.title}</p>
                              {task.assignee && <p className="mt-1 truncate text-[10px] text-ink-muted">{task.assignee.name ?? (task.assignee.handle ? `@${task.assignee.handle}` : "")}</p>}
                            </li>
                          ))}
                          {columnTasks.length > 2 && <li className="text-right text-[10px] text-ink-muted"><Link href={`/projects/${team.id}#project-board-title`} className="hover:text-gold-soft">{t("teams.openBoard")}</Link></li>}
                        </ul>
                      ) : <p className="text-[11px] text-ink-muted">{t("projects.noTasks")}</p>}
                    </section>
                  );
                })}
              </div>
            )}
            {tasksQuery.isError && <p role="alert" className="text-xs text-rose-300">{t("projects.taskError")}</p>}
          </section>

          <section id="recruitment" className="card space-y-4 border-gold/20 bg-gradient-to-br from-gold/10 via-midnight-card to-midnight-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-ink">
                  {t(canApply ? "teams.joinTeamTitle" : "teams.teamOpportunities", { name: teamName })}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {team.lookingFor.length > 0 ? t("teams.lookingForTeam") : t("teams.noRolesNeeded")}
                </p>
              </div>
              <span className={team.isOwner || (!membership && !team.isPrivate) ? "badge-gold" : "badge"}>
                {team.isOwner ? t("teams.teamOwner") : membership ? t(`teams.membership.${membership.status}`) : t("teams.applicationsOpen")}
              </span>
            </div>
            {team.lookingFor.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {team.lookingFor.map((role) => {
                  const requestableRole = openRoles.find((candidate) => candidate === role);
                  const label = t(`projects.roles.${role.toUpperCase()}`);
                  return canApply && requestableRole
                    ? <button key={role} type="button" aria-pressed={selectedJoinRole === requestableRole} onClick={() => setJoinRole(requestableRole)} className={`badge-gold cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${selectedJoinRole === requestableRole ? "ring-2 ring-gold/40" : "hover:bg-gold/15"}`}>{label}</button>
                    : <span key={role} className="badge-gold">{label}</span>;
                })}
              </div>
            ) : null}
            {canApply && (
              <div className="border-t border-midnight-border pt-3">
                <button
                  type="button"
                  disabled={!session?.user?.id}
                  onClick={() => {
                    setApplicationAnswers(applicationQuestions.map(() => ""));
                    setApplicationMessage("");
                    setJoinStep(0);
                    setAcceptedTeamRules(false);
                    setJoinError("");
                    setJoinFormOpen(true);
                  }}
                  className="btn-gold w-full !rounded-lg"
                >
                  {t(membership?.status === "REJECTED" ? "teams.resubmitRequest" : "teams.joinAction")}
                </button>
              </div>
            )}
            {!team.isOwner && membership?.status === "PENDING" && membership.invitedById && (
              <div className="space-y-2 border-t border-midnight-border pt-3">
                <p className="text-xs leading-relaxed text-ink-muted">{t("teams.invitationReceived")}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={invitationResponse.isPending} onClick={() => invitationResponse.mutate("APPROVED")} className="btn-gold min-w-0 flex-1 !rounded-xl !px-2.5 !py-2 text-xs">
                    {invitationResponse.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{t("teams.acceptInvitation")}
                  </button>
                  <button type="button" disabled={invitationResponse.isPending} onClick={() => invitationResponse.mutate("REJECTED")} className="btn-ghost !rounded-xl !px-2.5 !py-2 text-xs">
                    <X size={14} aria-hidden="true" />{t("teams.declineInvitation")}
                  </button>
                </div>
              </div>
            )}
            {!team.isOwner && membership && (membership.status === "APPROVED" || (membership.status === "PENDING" && !membership.invitedById)) && (
              <div className="space-y-2 border-t border-midnight-border pt-3">
                <p className="text-xs leading-relaxed text-ink-muted">{t(membership.status === "PENDING" ? "teams.joinRequestPending" : "teams.memberStatus")}</p>
                <button
                  type="button"
                  disabled={membershipAction.isPending}
                  onClick={() => {
                    const confirmation = membership.status === "PENDING" ? "teams.confirmCancelJoinRequest" : "teams.confirmLeaveTeam";
                    if (window.confirm(t(confirmation))) membershipAction.mutate();
                  }}
                  className="btn-ghost w-full !rounded-lg !text-xs text-rose-300 hover:text-rose-200"
                >
                  {membershipAction.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                  {membershipAction.isPending
                    ? t(membership.status === "PENDING" ? "teams.cancellingJoinRequest" : "teams.leavingTeam")
                    : t(membership.status === "PENDING" ? "teams.cancelJoinRequest" : "teams.leaveTeam")}
                </button>
              </div>
            )}
          </section>

          <section id="members">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-midnight-border pb-3">
              <h2 className="text-sm font-semibold text-ink">{t("teams.teamMembers")}</h2>
              <span className="grid h-7 min-w-7 place-items-center rounded-full border border-midnight-border bg-midnight-card px-2 text-xs font-semibold tabular-nums text-ink-muted">{members.length}</span>
            </div>
            <ul className="divide-y divide-midnight-border/70">
              {members.map((member) => (
                <li key={member.id} className="py-1">
                  <Link href={`/makers/${encodeURIComponent(member.user.handle ?? member.user.id)}`} aria-label={t("teams.viewMember", { name: member.user.name ?? member.user.handle ?? t("teams.unknownMember") })} className="group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 hover:bg-midnight-card/60">
                    <Avatar src={member.user.image} name={member.user.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{member.user.name ?? member.user.handle ?? t("teams.unknownMember")}</span>
                      <span className="block truncate text-xs text-ink-muted">{t(`projects.roles.${member.role.toUpperCase()}`)}{member.user.headline ? ` · ${member.user.headline}` : ""}</span>
                    </span>
                    <ArrowUpRight size={13} className="shrink-0 text-ink-muted transition-colors duration-200 group-hover:text-gold-soft" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="#activity" className="mt-2 flex items-center justify-between rounded-lg border-t border-midnight-border px-2 py-3 text-xs text-ink-muted transition hover:bg-midnight-card/60 hover:text-gold-soft">
              <span className="inline-flex items-center gap-2"><FileText size={14} aria-hidden="true" />{t("teams.viewTeamActivity")}</span>
              <span className="tabular-nums">{team.postCount}</span>
            </Link>
          </section>

          {(team.techStack.length > 0 || team.tags.length > 0) && (
            <section className="space-y-4 rounded-xl border border-midnight-border bg-midnight-card/40 p-4">
              {team.techStack.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{t("teams.techStack")}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">{team.techStack.map((item) => <span key={item} className="badge transition-colors duration-200 hover:border-gold/40 hover:text-ink">{item}</span>)}</div>
                </div>
              )}
              {team.tags.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{t("teams.tags")}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">{team.tags.map((tag) => <span key={tag} className="badge transition-colors duration-200 hover:border-gold/40 hover:text-ink">{tag}</span>)}</div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
      {joinFormOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !joinMutation.isPending) setJoinFormOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-join-form-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !joinMutation.isPending) setJoinFormOpen(false);
            }}
            className="card max-h-[min(90vh,760px)] w-full max-w-xl space-y-5 overflow-y-auto p-5 sm:p-6"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{t("teams.joinStepProgress", { current: joinStep + 1, total: joinStepCount })}</p>
                <h2 id="team-join-form-title" className="text-lg font-semibold text-ink">{t("teams.joinFormTitle")}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t("teams.joinFormHint")}</p>
              </div>
              <button type="button" className="btn-ghost !min-h-9 !rounded-lg !p-2" disabled={joinMutation.isPending} onClick={() => setJoinFormOpen(false)} aria-label={t("common.close")}>
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="h-1 overflow-hidden rounded-full bg-midnight-deep" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all" style={{ width: `${((joinStep + 1) / joinStepCount) * 100}%` }} />
            </div>
            <form onSubmit={submitJoinRequest} noValidate className="space-y-5">
              {joinStep === 0 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.joinStepRole")}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink">{t("teams.chooseRole")}</h3>
                  </div>
                  <ApplicationRoleSelect
                    id="team-application-role"
                    label={t("teams.chooseRole")}
                    value={selectedJoinRole}
                    onChange={(role) => setJoinRole(role as typeof TEAM_ROLES[number])}
                    options={openRoles.map((role) => ({ value: role, label: t(`projects.roles.${role}`) }))}
                  />
                </div>
              ) : joinStep === rulesStep ? (
                <section className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.joinStepRules")}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink">{t("teams.teamRulesTitle")}</h3>
                  </div>
                  <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-muted">{team.teamRules}</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-midnight-border bg-midnight-deep/50 p-4 text-sm leading-6 text-ink transition hover:border-gold/30">
                    <input
                      type="checkbox"
                      checked={acceptedTeamRules}
                      onChange={(event) => setAcceptedTeamRules(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-gold"
                    />
                    <span>{t("teams.acceptRules")}</span>
                  </label>
                </section>
              ) : joinStep < messageStep ? (
                <div className="space-y-3">
                  {(() => {
                    const questionIndex = joinStep - questionStepStart;
                    const question = applicationQuestions[questionIndex];
                    const answer = applicationAnswers[questionIndex] ?? "";
                    const setAnswer = (value: string) => setApplicationAnswers((current) => current.map((item, index) => index === questionIndex ? value : item));
                    const selectedOptions = question.type === "MULTIPLE_CHOICE" ? selectedAnswerOptions(answer) : [];
                    return (
                  <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">
                      {t("teams.joinStepQuestion", { count: questionIndex + 1 })}
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{question.label}</h3>
                  </div>
                  {question.type === "SHORT_TEXT" && (
                    <input
                      type="text"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      maxLength={250}
                      autoFocus
                      className="input rounded-xl border-midnight-border bg-midnight-deep/60 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                      aria-label={t("teams.joinAnswerLabel", { count: questionIndex + 1 })}
                      placeholder={t("teams.joinAnswerPlaceholder")}
                    />
                  )}
                  {question.type === "LONG_TEXT" && (
                    <textarea
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      maxLength={1000}
                      rows={5}
                      autoFocus
                      className="input min-h-32 resize-y rounded-xl border-midnight-border bg-midnight-deep/60 leading-6 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                      aria-label={t("teams.joinAnswerLabel", { count: questionIndex + 1 })}
                      placeholder={t("teams.joinAnswerPlaceholder")}
                    />
                  )}
                  {(question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") && (
                    <fieldset className="space-y-2">
                      <legend className="sr-only">{t("teams.joinAnswerLabel", { count: questionIndex + 1 })}</legend>
                      {question.options.map((option, optionIndex) => {
                        const checked = question.type === "SINGLE_CHOICE" ? answer === option : selectedOptions.includes(option);
                        return (
                          <label key={`${option}-${optionIndex}`} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${checked ? "border-gold/50 bg-gold/10 text-ink" : "border-midnight-border bg-midnight-deep/40 text-ink-muted hover:border-gold/30"}`}>
                            <input
                              type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                              name={`team-application-question-${questionIndex}`}
                              checked={checked}
                              onChange={() => {
                                if (question.type === "SINGLE_CHOICE") setAnswer(option);
                                else {
                                  const next = checked ? selectedOptions.filter((selected) => selected !== option) : [...selectedOptions, option];
                                  setAnswer(JSON.stringify(next));
                                }
                              }}
                              className="h-4 w-4 accent-gold"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                  {question.type === "YES_NO" && (
                    <fieldset className="grid gap-2 sm:grid-cols-2">
                      <legend className="sr-only">{t("teams.joinAnswerLabel", { count: questionIndex + 1 })}</legend>
                      {(["YES", "NO"] as const).map((value) => (
                        <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${answer === value ? "border-gold/50 bg-gold/10 text-ink" : "border-midnight-border bg-midnight-deep/40 text-ink-muted hover:border-gold/30"}`}>
                          <input type="radio" name={`team-application-yes-no-${questionIndex}`} checked={answer === value} onChange={() => setAnswer(value)} className="h-4 w-4 accent-gold" />
                          {t(value === "YES" ? "teams.answerYes" : "teams.answerNo")}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  </>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.joinStepMessage")}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink">{t("teams.applicationMessageLabel")}</h3>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{t("teams.applicationMessagePlaceholder")}</p>
                  </div>
                  <textarea
                    value={applicationMessage}
                    onChange={(event) => setApplicationMessage(event.target.value)}
                    maxLength={1000}
                    rows={5}
                    autoFocus
                    aria-label={t("teams.applicationMessageLabel")}
                    placeholder={t("teams.applicationMessagePlaceholder")}
                    className="input min-h-32 resize-y rounded-xl border-midnight-border bg-midnight-deep/60 leading-6 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              )}
              {joinError && <p role="alert" className="text-sm text-rose-300">{joinError}</p>}
              <div className="flex items-center justify-between gap-2 border-t border-midnight-border pt-4">
                {joinStep > 0 ? (
                  <button type="button" className="btn-ghost !rounded-lg" disabled={joinMutation.isPending} onClick={() => { setJoinStep((current) => current - 1); setJoinError(""); }}>
                    <ChevronLeft size={14} aria-hidden="true" />{t("teams.joinPrevious")}
                  </button>
                ) : <span />}
                <button type="submit" disabled={joinMutation.isPending} className="btn-gold !rounded-lg">
                  {joinMutation.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  {joinStep === joinStepCount - 1
                    ? (joinMutation.isPending ? t("teams.joining") : t("teams.sendJoinRequest"))
                    : <>{t("teams.joinNext")}<ChevronRight size={14} aria-hidden="true" /></>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}