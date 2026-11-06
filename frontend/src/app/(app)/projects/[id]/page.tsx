"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Github, Globe2, Plus, Settings2, Trash2, UsersRound, X } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { Feed } from "@/components/Feed";
import { BadgeIconList, type AwardedBadge } from "@/components/GamificationBadges";
import { ProjectReviews } from "@/components/ProjectReviews";
import { useTranslation } from "@/lib/i18n";
import { ProjectDetailSkeleton } from "@/components/skeletons";
import { Check, Code2, LoaderCircle, UserPlus } from "lucide-react";
import { ApplicationRoleSelect } from "@/components/ApplicationRoleSelect";

type ProjectStatus = "IDEA" | "DEVELOPMENT" | "LAUNCHED";
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type ProjectHub = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  teamName: string | null;
  isPrivate: boolean;
  status: ProjectStatus;
  logoUrl: string | null;
  coverUrl: string | null;
  parentTeam: { id: string; title: string; teamName: string | null; logoUrl: string | null } | null;
  githubUrl: string | null;
  liveUrl: string | null;
  docsUrl: string | null;
  pitchDeckUrl: string | null;
  techStack: string[];
  tags: string[];
  lookingFor: string[];
  collaborationQuestions: string[];
  creator: { id: string; name: string | null; handle: string | null; image: string | null; badges: AwardedBadge[] };
  collaborators: { userId: string; role: string; user: { id: string; name: string | null; handle: string | null; image: string | null; badges: AwardedBadge[] } }[];
  currentMembership: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; role: string; invitedById: string | null } | null;
  _count: { collaborators: number; posts: number; tasks: number; feedback: number };
};
type ProjectTask = { id: string; title: string; status: TaskStatus; position: number };
type FeedbackItem = {
  id: string;
  kind: "IDEA" | "QUESTION" | "BUG";
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; handle: string | null; image: string | null };
};
type FeedbackResponse = {
  feedback: FeedbackItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type GitHubCommit = { sha: string; url: string; message: string; author: string; createdAt: string };

const taskStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const projectStatuses: ProjectStatus[] = ["IDEA", "DEVELOPMENT", "LAUNCHED"];
const collaborationRoles = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;

export default function ProjectHubPage() {
  const { t, locale } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<FeedbackItem["kind"]>("IDEA");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [invitationError, setInvitationError] = useState("");
  const [invitationNotice, setInvitationNotice] = useState("");
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [applicationAnswers, setApplicationAnswers] = useState<string[]>([]);
  const [applicationStep, setApplicationStep] = useState(0);
  const [applicationRole, setApplicationRole] = useState<(typeof collaborationRoles)[number]>("CO_BUILDER");
  const [applicationError, setApplicationError] = useState("");
  const [applicationNotice, setApplicationNotice] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project-hub", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error("project_load_failed");
      return response.json() as Promise<{ project: ProjectHub; canContribute: boolean; isOwner: boolean }>;
    },
  });
  useEffect(() => {
    if (!projectQuery.data || window.location.hash !== "#feedback") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectQuery.data]);

  const commitsQuery = useQuery({
    queryKey: ["project-commits", params.id],
    enabled: Boolean(projectQuery.data?.project.githubUrl),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectQuery.data?.project.id}/commits`);
      if (!response.ok) throw new Error("commits_load_failed");
      return (await response.json()).commits as GitHubCommit[];
    },
    refetchInterval: 60_000,
  });
  const tasksQuery = useQuery({
    queryKey: ["project-tasks", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}/tasks`);
      if (!response.ok) throw new Error("tasks_load_failed");
      return await response.json() as { tasks: ProjectTask[] };
    },
    retry: false,
  });
  const feedbackQuery = useQuery({
    queryKey: ["project-feedback", params.id, feedbackPage],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}/feedback?page=${feedbackPage}`);
      if (!response.ok) throw new Error("feedback_load_failed");
      return await response.json() as FeedbackResponse;
    },
  });
  const createTask = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${params.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle.trim() }),
      });
      if (!response.ok) throw new Error("task_create_failed");
      return response.json();
    },
    onSuccess: async () => {
      setTaskTitle("");
      await queryClient.invalidateQueries({ queryKey: ["project-tasks", params.id] });
    },
  });
  const updateTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("task_update_failed");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", params.id] }),
  });
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/projects/${params.id}/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("task_delete_failed");
      return taskId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", params.id] }),
  });
  const createFeedback = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${params.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: feedbackKind, content: feedbackText.trim() }),
      });
      if (!response.ok) throw new Error("feedback_create_failed");
      return response.json();
    },
    onSuccess: async () => {
      setFeedbackText("");
      setFeedbackPage(1);
      await queryClient.invalidateQueries({ queryKey: ["project-feedback", params.id] });
    },
  });
  const invitationResponse = useMutation({
    mutationFn: async (status: "APPROVED" | "REJECTED") => {
      const membership = projectQuery.data?.project.currentMembership;
      if (!membership || membership.status !== "PENDING" || !membership.invitedById) {
        throw new Error("invitation_not_found");
      }
      const response = await fetch(`/api/projects/${params.id}/collaborators/${membership.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("invitation_response_failed");
      return status;
    },
    onSuccess: async (status) => {
      setInvitationError("");
      if (status === "APPROVED") {
        await queryClient.invalidateQueries({ queryKey: ["navigation-counts"] });
        router.push(`/projects/${params.id}/co-building`);
        return;
      }
      setInvitationNotice(locale === "fr" ? "Invitation refusée." : "Invitation declined.");
      await queryClient.invalidateQueries({ queryKey: ["project-hub", params.id] });
    },
    onError: () => {
      setInvitationError(locale === "fr"
        ? "La réponse à l’invitation a échoué. Réessayez."
        : "Could not respond to the invitation. Please try again.");
    },
  });
  const collaborationRequest = useMutation({
    mutationFn: async (payload: { role: string; answers?: string[]; message?: string }) => {
      const response = await fetch(`/api/projects/${params.id}/collaborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("collaboration_request_failed");
      return response.json();
    },
    onSuccess: async () => {
      setApplicationError("");
      setApplicationNotice(t("projects.collaborationApplicationSuccess"));
      setApplicationOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["project-hub", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["navigation-counts"] });
    },
    onError: () => setApplicationError(t("projects.collaborationApplicationError")),
  });

  if (projectQuery.isLoading) {
    return <ProjectDetailSkeleton />;
  }
  if (projectQuery.isError || !projectQuery.data) {
    return <div className="space-y-4"><Link href="/projects" className="btn-ghost w-fit"><ArrowLeft size={16} aria-hidden="true" />{t("projects.title")}</Link><p role="alert" className="card p-5 text-sm text-rose-300">{t("projects.hubLoadError")}</p></div>;
  }

  const { project, canContribute, isOwner } = projectQuery.data;
  const collaborationQuestions = project.collaborationQuestions ?? [];
  const applicationStepCount = 1 + Math.max(collaborationQuestions.length, 1);
  const isPersonalProject = !project.teamName && !project.parentTeam;
  const projectCollaborationRoles = collaborationRoles.filter((role) => project.lookingFor.includes(role));
  const availableCollaborationRoles = projectCollaborationRoles.length ? projectCollaborationRoles : [...collaborationRoles];
  const selectedCollaborationRole = availableCollaborationRoles.includes(applicationRole)
    ? applicationRole
    : availableCollaborationRoles[0];
  const canRequestCollaboration = isPersonalProject
    && !project.isPrivate
    && !isOwner
    && (!project.currentMembership || project.currentMembership.status === "REJECTED");
  const tasks = tasksQuery.data?.tasks ?? [];
  const activeStage = projectStatuses.indexOf(project.status);
  const identityName = project.parentTeam?.teamName?.trim()
    || project.parentTeam?.title
    || project.creator.name
    || project.creator.handle
    || t("teams.unknownMember");
  const identityImage = project.parentTeam ? project.parentTeam.logoUrl : project.creator.image;
  const identityHref = project.parentTeam
    ? `/teams/${project.parentTeam.id}`
    : `/makers/${encodeURIComponent(project.creator.handle ?? project.creator.id)}`;

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedbackText.trim().length >= 5) createFeedback.mutate();
  }

  function submitCollaborationRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const applicationQuestionCount = Math.max(collaborationQuestions.length, 1);
    const stepCount = applicationQuestionCount + 1;
    if (applicationStep === 0) {
      setApplicationStep(1);
      return;
    }
    const currentAnswer = applicationAnswers[applicationStep - 1]?.trim() ?? "";
    if (!currentAnswer) {
      setApplicationError(t("projects.collaborationApplicationError"));
      return;
    }
    setApplicationError("");
    if (applicationStep < stepCount - 1) {
      setApplicationStep((current) => current + 1);
      return;
    }
    if (collaborationQuestions.length > 0) {
      collaborationRequest.mutate({ role: selectedCollaborationRole, answers: applicationAnswers });
      return;
    }
    collaborationRequest.mutate({ role: selectedCollaborationRole, message: currentAnswer });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <Link href="/discover" className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />{t("nav.discover")}
      </Link>

      <header className="relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl border border-midnight-border bg-gradient-to-br from-gold/15 via-midnight-card to-cyan-950/60 sm:min-h-[350px]">
        {project.coverUrl ? (
          <Image src={project.coverUrl} alt="" fill priority sizes="(max-width: 1280px) 100vw, 1152px" unoptimized className="object-cover" />
        ) : project.logoUrl ? (
          <Image src={project.logoUrl} alt="" fill priority sizes="(max-width: 1280px) 100vw, 1152px" unoptimized className="scale-110 object-cover opacity-25 blur-2xl" />
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 -z-0 bg-gradient-to-t from-black/95 via-black/45 to-black/15" />
        <div className="relative z-10 flex flex-col gap-5 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">{t("projects.hubEyebrow")}</span>
            <span className={`rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ${project.status === "LAUNCHED" ? "text-emerald-200" : project.status === "DEVELOPMENT" ? "text-sky-200" : "text-white/90"}`}>
              {t(`projects.status.${project.status}`)}
            </span>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 items-end gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/25 bg-black/35 text-gold-soft shadow-xl sm:h-20 sm:w-20">
                {project.logoUrl ? <Image src={project.logoUrl} alt="" width={80} height={80} unoptimized className="h-full w-full object-cover" /> : <UsersRound size={26} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-4xl">{project.title}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">{project.tagline}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canRequestCollaboration && (
                <button
                  type="button"
                  className="btn-gold shrink-0 !rounded-lg"
                  onClick={() => {
                    setApplicationAnswers(collaborationQuestions.length ? collaborationQuestions.map(() => "") : [""]);
                    setApplicationStep(0);
                    setApplicationError("");
                    setApplicationOpen(true);
                  }}
                >
                  <UserPlus size={15} aria-hidden="true" />{t("projects.applyToCollaborate")}
                </button>
              )}
              {canContribute && <Link href={`/projects/${project.id}/co-building`} className="btn-gold shrink-0 !rounded-lg"><Code2 size={15} aria-hidden="true" />{locale === "fr" ? "Espace de co-building" : "Co-building workspace"}</Link>}
              {isOwner && <Link href={`/projects/${project.id}/settings`} className="btn-ghost shrink-0 !rounded-lg"><Settings2 size={15} aria-hidden="true" />{t("projects.settingsAction")}</Link>}
              <a href="#reviews" className="btn-gold shrink-0 !rounded-lg">{t("projects.giveReview")}</a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/15 pt-4 text-xs text-white/75">
            <Link href={identityHref} className="inline-flex items-center gap-2 font-medium text-white transition hover:text-gold-soft">
              <Avatar src={identityImage} name={identityName} size={28} />
              {identityName}
            </Link>
            <span aria-hidden="true">·</span>
            <span>{t("projects.createdBy", { name: project.creator.handle ? `@${project.creator.handle}` : project.creator.name ?? t("teams.unknownMember") })}</span>
            <BadgeIconList badges={project.creator.badges} size={13} />
          </div>
        </div>
      </header>

      {project.currentMembership?.status === "PENDING" && project.currentMembership.invitedById && (
        <section className="card flex flex-col gap-4 border-gold/30 bg-gold/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-labelledby="project-invitation-title">
          <div className="min-w-0">
            <h2 id="project-invitation-title" className="text-sm font-semibold text-ink">
              {locale === "fr" ? "Vous êtes invité·e à collaborer sur ce projet" : "You’ve been invited to collaborate on this project"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {locale === "fr"
                ? "Acceptez pour rejoindre directement l’espace de co-building."
                : "Accept to join the co-building workspace right away."}
            </p>
            {invitationError && <p role="alert" className="mt-2 text-xs text-rose-300">{invitationError}</p>}
            {invitationNotice && <p role="status" className="mt-2 text-xs text-ink-muted">{invitationNotice}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-gold !rounded-lg !px-3 !py-2 text-xs" disabled={invitationResponse.isPending} onClick={() => invitationResponse.mutate("APPROVED")}>
              {invitationResponse.isPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              {locale === "fr" ? "Accepter et rejoindre" : "Accept and join"}
            </button>
            <button type="button" className="btn-ghost !rounded-lg !px-3 !py-2 text-xs" disabled={invitationResponse.isPending} onClick={() => invitationResponse.mutate("REJECTED")}>
              {locale === "fr" ? "Refuser" : "Decline"}
            </button>
          </div>
        </section>
      )}
      {isPersonalProject && project.currentMembership?.status === "PENDING" && !project.currentMembership.invitedById && (
        <section className="card border-gold/30 bg-gold/5 p-4 text-sm text-ink-muted" role="status">
          {t("projects.collaborationApplicationPending")}
        </section>
      )}
      {applicationNotice && <p className="text-sm text-emerald-300" role="status">{applicationNotice}</p>}

      {applicationOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !collaborationRequest.isPending) setApplicationOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="collaboration-application-title" className="card max-h-[min(90vh,760px)] w-full max-w-xl space-y-5 overflow-y-auto p-5 sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{t("projects.applicationStepProgress", { current: applicationStep + 1, total: applicationStepCount })}</p>
                <h2 id="collaboration-application-title" className="mt-1 text-lg font-semibold text-ink">{t("projects.collaborationApplicationTitle")}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t("projects.collaborationApplicationHint")}</p>
              </div>
              <button type="button" className="btn-ghost !min-h-9 !rounded-lg !p-2" disabled={collaborationRequest.isPending} onClick={() => setApplicationOpen(false)} aria-label={t("common.close")}>
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            <div className="h-1 overflow-hidden rounded-full bg-midnight-deep" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all" style={{ width: `${((applicationStep + 1) / applicationStepCount) * 100}%` }} />
            </div>
            <form onSubmit={submitCollaborationRequest} noValidate className="space-y-5">
              {applicationStep === 0 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("projects.applicationStepRole")}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink">{t("projects.collaborationApplicationRole")}</h3>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{t("projects.collaborationApplicationHint")}</p>
                  </div>
                  <ApplicationRoleSelect
                    id="project-application-role"
                    label={t("projects.collaborationApplicationRole")}
                    value={selectedCollaborationRole}
                    onChange={(role) => setApplicationRole(role as (typeof collaborationRoles)[number])}
                    options={availableCollaborationRoles.map((role) => ({ value: role, label: t(`projects.roles.${role}`) }))}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft">
                      {t("projects.applicationStepQuestion", { count: applicationStep })}
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-6 text-ink">
                      {collaborationQuestions[applicationStep - 1] ?? t("projects.collaborationMotivationQuestion")}
                    </h3>
                  </div>
                  <label className="block">
                    <textarea
                      value={applicationAnswers[applicationStep - 1] ?? ""}
                      onChange={(event) => setApplicationAnswers((current) => current.map((answer, answerIndex) => answerIndex === applicationStep - 1 ? event.target.value : answer))}
                      maxLength={1000}
                      minLength={1}
                      rows={5}
                      required
                      autoFocus
                      className="input min-h-32 resize-y rounded-xl border-midnight-border bg-midnight-deep/60 leading-6 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                      aria-label={t("projects.collaborationAnswerLabel", { count: applicationStep })}
                      placeholder={t("projects.collaborationAnswerPlaceholder")}
                    />
                  </label>
                </div>
              )}
              {applicationError && <p role="alert" className="text-sm text-rose-300">{applicationError}</p>}
              <div className="flex items-center justify-between gap-2 border-t border-midnight-border pt-4">
                {applicationStep > 0 ? (
                  <button type="button" className="btn-ghost !rounded-lg" disabled={collaborationRequest.isPending} onClick={() => { setApplicationStep((current) => current - 1); setApplicationError(""); }}>
                    <ChevronLeft size={14} aria-hidden="true" />{t("projects.applicationPrevious")}
                  </button>
                ) : <span />}
                <button type="submit" className="btn-gold !rounded-lg" disabled={collaborationRequest.isPending}>
                  {collaborationRequest.isPending && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                  {applicationStep === applicationStepCount - 1
                    ? (collaborationRequest.isPending ? t("projects.collaborationApplicationSubmitting") : t("projects.collaborationApplicationSubmit"))
                    : <>{t("projects.applicationNext")}<ChevronRight size={14} aria-hidden="true" /></>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-6">

      <section aria-label={t("projects.progressTitle")} className="card space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">{t("projects.progressTitle")}</h2>
          <span className="badge-gold">{t(`projects.status.${project.status}`)}</span>
        </div>
        <ol className="grid grid-cols-3 border-y border-midnight-border">
          {projectStatuses.map((status, index) => (
            <li key={status} className={`flex min-w-0 items-center gap-2 py-3 text-xs ${index <= activeStage ? "text-gold-soft" : "text-ink-muted"} ${index > 0 ? "border-l border-midnight-border pl-3 sm:pl-5" : "pr-3"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${index <= activeStage ? "border-gold/50 bg-gold/10" : "border-midnight-border"}`}>{index + 1}</span>
              <span className="truncate">{t(`projects.status.${status}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="project-board-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="project-board-title" className="text-base font-semibold text-ink">{t("projects.kanbanTitle")}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t("projects.kanbanHint")}</p>
          </div>
          <span className="text-xs tabular-nums text-ink-muted">{tasks.length} {t("projects.tasks")}</span>
        </div>
        {canContribute && (
          <form onSubmit={(event) => { event.preventDefault(); if (taskTitle.trim()) createTask.mutate(); }} className="flex gap-2">
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={120} minLength={2} required className="input min-w-0" placeholder={t("projects.taskPlaceholder")} aria-label={t("projects.taskPlaceholder")} />
            <button type="submit" disabled={createTask.isPending} className="btn-gold shrink-0 !rounded-lg" aria-label={t("projects.addTask")}>
              <Plus size={16} aria-hidden="true" /><span className="hidden sm:inline">{t("projects.addTask")}</span>
            </button>
          </form>
        )}
        {(tasksQuery.isError || createTask.isError || updateTask.isError || deleteTask.isError) && <p role="alert" className="text-xs text-rose-300">{t("projects.taskError")}</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {taskStatuses.map((status) => {
            const columnTasks = tasks.filter((task) => task.status === status);
            return (
              <section key={status} className="min-w-0 border-t-2 border-midnight-border pt-3" aria-label={t(`projects.taskStatus.${status}`)}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase text-ink-muted">{t(`projects.taskStatus.${status}`)}</h3>
                  <span className="text-xs tabular-nums text-ink-muted">{columnTasks.length}</span>
                </div>
                <ul className="space-y-2">
                  {columnTasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-midnight-border bg-midnight-card/45 p-3">
                      <p className="break-words text-sm text-ink">{task.title}</p>
                      {canContribute && (
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-midnight-border pt-2">
                          <label>
                            <span className="sr-only">{t("projects.taskStatusLabel")}</span>
                            <select value={task.status} onChange={(event) => updateTask.mutate({ taskId: task.id, status: event.target.value as TaskStatus })} className="border-0 bg-transparent py-1 text-xs text-ink-muted outline-none focus:ring-0">
                              {taskStatuses.map((option) => <option key={option} value={option}>{t(`projects.taskStatus.${option}`)}</option>)}
                            </select>
                          </label>
                          <button type="button" onClick={() => deleteTask.mutate(task.id)} title={t("projects.deleteTask")} aria-label={t("projects.deleteTask")} className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition hover:bg-midnight-deep hover:text-rose-300">
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {!columnTasks.length && <p className="py-4 text-xs text-ink-muted">{t("projects.noTasks")}</p>}
              </section>
            );
          })}
        </div>
      </section>

          <section className="card p-4 sm:p-5">
            <ProjectReviews projectId={project.id} />
          </section>

          <section id="feedback" className="card space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-semibold text-ink">{t("projects.feedbackTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("projects.feedbackHint")} {project._count.feedback > 0 && <span>· {t("projects.feedbackCount", { count: project._count.feedback })}</span>}</p>
            </div>
            <form onSubmit={submitFeedback} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="sm:w-48">
                  <span className="sr-only">{t("projects.feedbackKind")}</span>
                  <select value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value as FeedbackItem["kind"])} className="input">
                    {(["IDEA", "QUESTION", "BUG"] as const).map((kind) => <option key={kind} value={kind}>{t(`projects.feedbackKinds.${kind}`)}</option>)}
                  </select>
                </label>
                <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} required minLength={5} maxLength={2000} rows={3} className="input min-w-0 flex-1 resize-y" placeholder={t("projects.feedbackPlaceholder")} />
              </div>
              {createFeedback.isError && <p role="alert" className="text-xs text-rose-300">{t("projects.feedbackError")}</p>}
              <button type="submit" disabled={createFeedback.isPending || feedbackText.trim().length < 5} className="btn-gold !rounded-lg">{t("projects.sendFeedback")}</button>
            </form>
            {feedbackQuery.isLoading ? <div className="skeleton h-24" aria-busy="true" /> : feedbackQuery.isError ? (
              <p role="alert" className="text-sm text-rose-300">{t("projects.feedbackError")}</p>
            ) : feedbackQuery.data?.feedback.length ? (
              <ul className="divide-y divide-midnight-border border-y border-midnight-border">
                {feedbackQuery.data.feedback.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-gold-soft">{t(`projects.feedbackKinds.${item.kind}`)}</p>
                      <time className="text-[11px] text-ink-muted" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{item.content}</p>
                    <p className="mt-2 text-xs text-ink-muted">{item.author.name ?? (item.author.handle ? `@${item.author.handle}` : t("teams.unknownMember"))}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">{t("projects.noFeedback")}</p>}
            {feedbackQuery.data && feedbackQuery.data.pagination.totalPages > 1 && (
              <nav className="flex items-center justify-between gap-3 border-t border-midnight-border pt-3" aria-label={t("projects.feedbackPagination")}>
                <button type="button" onClick={() => setFeedbackPage((page) => Math.max(1, page - 1))} disabled={feedbackPage <= 1 || feedbackQuery.isFetching} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />{t("projects.previousPage")}
                </button>
                <span aria-live="polite" className="text-xs tabular-nums text-ink-muted">{t("projects.paginationPage", { page: feedbackQuery.data.pagination.page, pages: feedbackQuery.data.pagination.totalPages })}</span>
                <button type="button" onClick={() => setFeedbackPage((page) => Math.min(feedbackQuery.data?.pagination.totalPages ?? page, page + 1))} disabled={feedbackPage >= feedbackQuery.data.pagination.totalPages || feedbackQuery.isFetching} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                  {t("projects.nextPage")}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>

          <section className="card p-4 sm:p-5">
            <Feed projectId={project.id} projectLabel={project.title} defaultPostType="PROJECT" canCompose={canContribute} />
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="card p-4 sm:p-5" aria-label={locale === "fr" ? "Présentation du projet" : "Project overview"}>
            <h2 className="text-sm font-semibold text-ink">{t("projects.aboutProject")}</h2>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">{project.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-midnight-border pt-3">
              {[
                { label: t("projects.collaborators"), value: project._count.collaborators },
                { label: t("projects.tasks"), value: project._count.tasks },
                { label: locale === "fr" ? "Publications" : "Posts", value: project._count.posts },
                { label: locale === "fr" ? "Retours" : "Feedback", value: project._count.feedback },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-midnight-deep/50 px-3 py-2">
                  <dd className="font-display text-lg font-semibold text-ink">{stat.value}</dd>
                  <dt className="text-[10px] text-ink-muted">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("projects.resources")}</h2>
            <ul className="space-y-2">
              {project.githubUrl && <li><a href={project.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-ink-muted hover:text-gold-soft"><Github size={16} aria-hidden="true" />GitHub<ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {project.liveUrl && <li><a href={project.liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-ink-muted hover:text-gold-soft"><Globe2 size={16} aria-hidden="true" />{t("projects.liveSite")}<ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {project.docsUrl && <li><a href={project.docsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-ink-muted hover:text-gold-soft"><FileText size={16} aria-hidden="true" />{t("projects.documentation")}<ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {project.pitchDeckUrl && <li><a href={project.pitchDeckUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-ink-muted hover:text-gold-soft"><FileText size={16} aria-hidden="true" />{t("projects.pitchDeck")}<ArrowUpRight size={13} aria-hidden="true" /></a></li>}
              {!project.githubUrl && !project.liveUrl && !project.docsUrl && !project.pitchDeckUrl && <li className="text-xs text-ink-muted">{t("projects.noResources")}</li>}
            </ul>
            {project.techStack.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{project.techStack.map((item) => <span key={item} className="badge">{item}</span>)}</div>}
            {project.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{project.tags.map((item) => <span key={item} className="badge">#{item}</span>)}</div>}
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">{t("projects.collaborators")}</h2>
              <span className="text-xs tabular-nums text-ink-muted">{project._count.collaborators}</span>
            </div>
            <ul className="mt-2 divide-y divide-midnight-border/70">
              {project.collaborators.map((member) => (
                <li key={member.userId} className="flex items-center gap-2 py-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-midnight-card text-xs text-gold-soft">
                    {member.user.image ? <img src={member.user.image} alt="" className="h-full w-full object-cover" /> : (member.user.name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{member.user.name ?? member.user.handle ?? t("teams.unknownMember")}</span>
                  <BadgeIconList badges={member.user.badges} size={12} />
                  <span className="text-[10px] text-ink-muted">{t(`projects.roles.${member.role}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-ink">{t("projects.projectActivity")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t("projects.projectActivityHint")}</p>
            {project.githubUrl && (
              <div className="mt-3">
                {commitsQuery.isLoading ? <div className="skeleton h-12" aria-busy="true" /> : commitsQuery.data?.length ? (
                  <ol className="space-y-3 border-l border-midnight-border pl-3">
                    {commitsQuery.data.map((commit) => (
                      <li key={commit.sha} className="relative min-w-0">
                        <span className="absolute -left-[1.05rem] top-1.5 h-2 w-2 rounded-full border border-gold/60 bg-midnight-card" aria-hidden="true" />
                        <a href={commit.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-xs font-medium text-ink hover:text-gold-soft">{commit.message}<ArrowUpRight size={12} className="ml-1 inline" aria-hidden="true" /></a>
                        <p className="mt-1 text-[10px] text-ink-muted">{commit.author} · {new Date(commit.createdAt).toLocaleString(locale)}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-xs text-ink-muted">{t(commitsQuery.isError ? "projects.commitUnavailable" : "projects.noCommits")}</p>}
              </div>
            )}
            <Link href="/huddles" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gold-soft hover:text-gold-bright"><FileText size={14} aria-hidden="true" />{t("huddles.title")}<ArrowUpRight size={13} aria-hidden="true" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}