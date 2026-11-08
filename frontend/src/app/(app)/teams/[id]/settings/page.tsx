"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, Loader2, Save, UsersRound, X } from "@/components/FontAwesomeIcons";
import TeamLogoUploadModal from "@/components/TeamLogoUploadModal";
import { useTranslation } from "@/lib/i18n";
import { ClipboardList, ListChecks, Plus, Trash2 } from "lucide-react";
import type { CollaborationFormQuestion, CollaborationQuestionType } from "@/lib/collaboration-form";

const TEAM_ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;
type TeamSettings = {
  title: string;
  teamName: string;
  tagline: string;
  description: string;
  teamDescription: string;
  teamRules: string;
  isPrivate: boolean;
  logoUrl: string;
  githubUrl: string;
  liveUrl: string;
  docsUrl: string;
  pitchDeckUrl: string;
  techStack: string[];
  tags: string[];
  lookingFor: string[];
  collaborationQuestions: string[];
  collaborationFormQuestions: CollaborationFormQuestion[];
};

const emptySettings: TeamSettings = {
  title: "",
  teamName: "",
  tagline: "",
  description: "",
  teamDescription: "",
  teamRules: "",
  isPrivate: false,
  logoUrl: "",
  githubUrl: "",
  liveUrl: "",
  docsUrl: "",
  pitchDeckUrl: "",
  techStack: [],
  tags: [],
  lookingFor: [],
  collaborationQuestions: [],
  collaborationFormQuestions: [],
};
type TeamSettingsResponse = Omit<TeamSettings, "teamName" | "teamDescription" | "teamRules" | "logoUrl" | "docsUrl" | "pitchDeckUrl" | "collaborationQuestions" | "collaborationFormQuestions"> & {
  teamName: string | null;
  teamDescription: string | null;
  teamRules: string | null;
  logoUrl: string | null;
  docsUrl: string | null;
  pitchDeckUrl: string | null;
  collaborationQuestions: string[];
  collaborationForm: CollaborationFormQuestion[] | null;
};

export default function TeamSettingsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<TeamSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logoModalOpen, setLogoModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${params.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("team_load_failed");
        return response.json();
      })
      .then(({ project, isOwner }: { project: TeamSettingsResponse; isOwner: boolean }) => {
        if (!cancelled && !isOwner) {
          setError(t("teams.settingsOwnerOnly"));
          return;
        }

        if (!cancelled) setSettings({
          ...project,
          teamName: project.teamName ?? project.title,
          teamDescription: project.teamDescription ?? project.description,
          teamRules: project.teamRules ?? "",
          isPrivate: project.isPrivate ?? false,
          logoUrl: project.logoUrl ?? "",
          githubUrl: project.githubUrl ?? "",
          liveUrl: project.liveUrl ?? "",
          docsUrl: project.docsUrl ?? "",
          pitchDeckUrl: project.pitchDeckUrl ?? "",
          collaborationQuestions: project.collaborationQuestions ?? [],
          collaborationFormQuestions: project.collaborationForm
            ?? (project.collaborationQuestions?.length
              ? project.collaborationQuestions.map((label) => ({ label, type: "LONG_TEXT" as const, options: [] }))
              : [
                { label: t("teams.defaultJoinQuestion1"), type: "LONG_TEXT" as const, options: [] },
                { label: t("teams.defaultJoinQuestion2"), type: "LONG_TEXT" as const, options: [] },
                { label: t("teams.defaultJoinQuestion3"), type: "SHORT_TEXT" as const, options: [] },
              ]),
        });
      })
      .catch(() => {
        if (!cancelled) setError(t("teams.settingsLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.id, t]);

  function updateField<Key extends keyof TeamSettings>(key: Key, value: TeamSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: string) {
    updateField("lookingFor", settings.lookingFor.includes(role)
      ? settings.lookingFor.filter((item) => item !== role)
      : [...settings.lookingFor, role]);
  }

  function updateApplicationQuestion(index: number, patch: Partial<CollaborationFormQuestion>) {
    updateField("collaborationFormQuestions", settings.collaborationFormQuestions.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...patch } : question));
  }

  function addApplicationQuestion() {
    updateField("collaborationFormQuestions", [
      ...settings.collaborationFormQuestions,
      { label: "", type: "LONG_TEXT", options: [] },
    ]);
  }

  function changeApplicationQuestionType(index: number, type: CollaborationQuestionType) {
    updateApplicationQuestion(index, {
      type,
      options: type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
        ? settings.collaborationFormQuestions[index].options.length >= 2
          ? settings.collaborationFormQuestions[index].options
          : [t("teams.defaultOption1"), t("teams.defaultOption2")]
        : [],
    });
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidChoiceQuestion = settings.collaborationFormQuestions.some((question) =>
      (question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE")
      && (question.options.length < 2 || question.options.length > 10 || new Set(question.options).size !== question.options.length));
    if (invalidChoiceQuestion) {
      setError(t("teams.choiceOptionsValidation"));
      setNotice("");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          collaborationFormQuestions: settings.collaborationFormQuestions,
          collaborationQuestions: settings.collaborationFormQuestions.map((question) => question.label),
          techStack: settings.techStack.join(",").split(",").map((item) => item.trim()).filter(Boolean),
          tags: settings.tags.join(",").split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("team_save_failed");
      setNotice(t("teams.settingsSaved"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["teams"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      router.refresh();
    } catch {
      setError(t("teams.settingsSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam() {
    const confirmation = window.prompt(t("teams.deleteTeamPrompt", { name: settings.teamName }));
    if (confirmation?.trim() !== settings.teamName.trim()) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("team_delete_failed");
      router.push("/teams");
      router.refresh();
    } catch {
      setError(t("teams.deleteTeamError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Link href={`/teams/${params.id}`} className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("teams.title")}
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-midnight-border bg-gradient-to-br from-gold/10 via-midnight-card to-midnight-deep p-5 shadow-card sm:p-7">
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-gold/5 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-soft">
            <UsersRound size={21} aria-hidden="true" />
          </div>
          <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.settingsEyebrow")}</p>
        <h1 className="section-title">{t("teams.settingsTitle")}</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">{t("teams.settingsSubtitle")}</p>
        {!loading && settings.teamName && <p className="mt-3 inline-flex rounded-full border border-midnight-border bg-midnight-deep/70 px-3 py-1 text-xs font-medium text-ink">{settings.teamName}</p>}
          </div>
        </div>
      </header>

      <nav aria-label={t("teams.adminTools")} className="flex flex-wrap gap-2 rounded-xl border border-midnight-border bg-midnight-card/60 p-2">
        <Link href={`/teams/${params.id}/manage`} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs">
          <UsersRound size={15} aria-hidden="true" />{t("teams.manageMembersPosts")}
        </Link>
        <Link href={`/teams/${params.id}/settings`} aria-current="page" className="btn-gold !rounded-lg !px-3 !py-2 text-xs">
          <Check size={15} aria-hidden="true" />{t("teams.settingsAction")}
        </Link>
        <Link href={`/projects/${params.id}#project-board-title`} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs">
          <UsersRound size={15} aria-hidden="true" />{t("teams.boardManagement")}
        </Link>
      </nav>

      {loading ? (
        <div className="card space-y-4 p-6" aria-busy="true">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ) : error && !settings.title ? (
        <div className="card p-6">
          <p role="alert" className="text-sm text-rose-300">{error}</p>
          <Link href="/teams" className="btn-ghost mt-4">{t("common.back")}</Link>
        </div>
      ) : (
        <form onSubmit={saveSettings} className="card overflow-hidden rounded-2xl">
          <div className="flex items-start gap-3 border-b border-midnight-border bg-gradient-to-r from-gold/10 to-transparent px-5 py-5 sm:px-7">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/10 text-gold-soft"><UsersRound size={17} aria-hidden="true" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("teams.settingsIdentity")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("teams.identityHint")}</p>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <section className="flex flex-col gap-4 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border border-midnight-border bg-midnight-card text-gold-soft">
                {settings.logoUrl
                  ? <img src={settings.logoUrl} alt={t("teams.avatarPreview")} className="h-full w-full object-cover" />
                  : <UsersRound size={32} aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t("teams.avatarLabel")}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t("teams.avatarHint")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setLogoModalOpen(true)} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                    <Camera size={15} aria-hidden="true" />{t(settings.logoUrl ? "teams.changeAvatar" : "teams.addAvatar")}
                  </button>
                  {settings.logoUrl && (
                    <button type="button" onClick={() => updateField("logoUrl", "")} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs">
                      <X size={15} aria-hidden="true" />{t("teams.removeAvatar")}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t("teams.basicsTitle")}</h2>
                <p className="mt-1 text-xs text-ink-muted">{t("teams.basicsHint")}</p>
              </div>
              <div>
                <label htmlFor="team-name" className="label">{t("teams.name")}</label>
                <input id="team-name" required minLength={3} maxLength={100} value={settings.teamName} onChange={(event) => updateField("teamName", event.target.value)} className="input" />
              </div>
              <div>
                <label htmlFor="team-mission" className="label">{t("teams.mission")}</label>
                <input id="team-mission" required minLength={5} maxLength={160} value={settings.tagline} onChange={(event) => updateField("tagline", event.target.value)} className="input" />
              </div>
              <div>
                <label htmlFor="team-description" className="label">{t("teams.aboutTitle")}</label>
                <textarea id="team-description" required minLength={20} maxLength={5000} rows={5} value={settings.teamDescription} onChange={(event) => updateField("teamDescription", event.target.value)} className="input resize-y" />
                <p className="mt-1 text-right text-xs text-ink-muted">{settings.teamDescription.length}/5000</p>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t("teams.privacyTitle")}</h2>
                <p className="mt-1 text-xs text-ink-muted">{t("teams.privacyDescription")}</p>
              </div>
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">{t("teams.privacyTitle")}</legend>
                <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 ${!settings.isPrivate ? "border-gold/50 bg-gold/10" : "border-midnight-border hover:border-gold/40"}`}>
                  <input type="radio" name="team-privacy" checked={!settings.isPrivate} onChange={() => updateField("isPrivate", false)} className="mt-1 accent-gold" />
                  <span><span className="block text-sm font-medium text-ink">{t("teams.privacyPublic")}</span><span className="mt-1 block text-xs text-ink-muted">{t("teams.privacyPublicHint")}</span></span>
                </label>
                <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 ${settings.isPrivate ? "border-gold/50 bg-gold/10" : "border-midnight-border hover:border-gold/40"}`}>
                  <input type="radio" name="team-privacy" checked={settings.isPrivate} onChange={() => updateField("isPrivate", true)} className="mt-1 accent-gold" />
                  <span><span className="block text-sm font-medium text-ink">{t("teams.privacyPrivate")}</span><span className="mt-1 block text-xs text-ink-muted">{t("teams.privacyPrivateHint")}</span></span>
                </label>
              </fieldset>
              <div>
                <label htmlFor="team-rules" className="label">{t("teams.teamRulesLabel")}</label>
                <textarea id="team-rules" rows={5} maxLength={5000} value={settings.teamRules} onChange={(event) => updateField("teamRules", event.target.value)} className="input resize-y" />
                <p className="mt-1 text-xs text-ink-muted">{t("teams.teamRulesHint")}</p>
                <p className="mt-1 text-right text-xs text-ink-muted">{settings.teamRules.length}/5000</p>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/10 text-gold-soft"><ClipboardList size={17} aria-hidden="true" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{t("teams.joinQuestionsTitle")}</h2>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-ink-muted">{t("teams.joinQuestionsHint")}</p>
                  </div>
                </div>
                <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-midnight-border bg-midnight-card px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                  <ListChecks size={13} aria-hidden="true" />
                  {t("teams.questionCount", { count: settings.collaborationFormQuestions.length })}
                </span>
              </div>
              <div className="space-y-3">
                {settings.collaborationFormQuestions.map((question, index) => {
                  const hasOptions = question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE";
                  return (
                    <article key={index} className="rounded-xl border border-midnight-border bg-midnight-card/70 p-3.5 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/10 tabular-nums">{index + 1}</span>
                          {t("teams.joinQuestionLabel", { count: index + 1 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateField("collaborationFormQuestions", settings.collaborationFormQuestions.filter((_, currentIndex) => currentIndex !== index))}
                          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={t("teams.removeJoinQuestion", { count: index + 1 })}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                        <label className="block">
                          <span className="label">{t("teams.questionPromptLabel")}</span>
                          <input
                            value={question.label}
                            onChange={(event) => updateApplicationQuestion(index, { label: event.target.value })}
                            maxLength={200}
                            required
                            className="input"
                            placeholder={t("teams.joinQuestionPlaceholder")}
                          />
                        </label>
                        <label className="block">
                          <span className="label">{t("teams.answerTypeLabel")}</span>
                          <select
                            value={question.type}
                            onChange={(event) => changeApplicationQuestionType(index, event.target.value as CollaborationQuestionType)}
                            className="input"
                          >
                            {(["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "YES_NO"] as const).map((type) => (
                              <option key={type} value={type}>{t(`teams.answerTypes.${type}`)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {hasOptions && (
                        <label className="mt-3 block">
                          <span className="label">{t("teams.answerOptionsLabel")}</span>
                          <textarea
                            value={question.options.join("\n")}
                            onChange={(event) => updateApplicationQuestion(index, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })}
                            maxLength={1000}
                            rows={3}
                            required
                            className="input resize-y"
                            placeholder={`${t("teams.defaultOption1")}\n${t("teams.defaultOption2")}`}
                          />
                          <span className="mt-1 block text-[11px] text-ink-muted">{t("teams.answerOptionsHint")}</span>
                        </label>
                      )}
                      <div className="mt-3 rounded-lg border border-dashed border-midnight-border bg-midnight-deep/50 p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{t("teams.applicantPreview")}</p>
                        <p className="text-xs font-medium text-ink">{question.label || t("teams.joinQuestionPlaceholder")}</p>
                        {question.type === "SHORT_TEXT" && <div className="mt-2 h-9 rounded-lg border border-midnight-border bg-midnight-card" />}
                        {question.type === "LONG_TEXT" && <div className="mt-2 h-16 rounded-lg border border-midnight-border bg-midnight-card" />}
                        {question.type === "YES_NO" && <div className="mt-2 flex gap-2"><span className="rounded-lg border border-midnight-border px-3 py-1.5 text-[11px] text-ink-muted">{t("teams.answerYes")}</span><span className="rounded-lg border border-midnight-border px-3 py-1.5 text-[11px] text-ink-muted">{t("teams.answerNo")}</span></div>}
                        {hasOptions && <div className="mt-2 flex flex-wrap gap-2">{question.options.map((option, optionIndex) => <span key={`${option}-${optionIndex}`} className="inline-flex items-center gap-2 rounded-lg border border-midnight-border px-3 py-1.5 text-[11px] text-ink-muted"><span className={`h-3 w-3 border border-ink-muted/60 ${question.type === "SINGLE_CHOICE" ? "rounded-full" : "rounded-sm"}`} aria-hidden="true" />{option || t("teams.defaultOption1")}</span>)}</div>}
                      </div>
                    </article>
                  );
                })}
              </div>
              {settings.collaborationFormQuestions.length < 5 && (
                <button
                  type="button"
                  onClick={addApplicationQuestion}
                  className="btn-ghost !min-h-10 !rounded-lg !px-3 !py-2 text-xs"
                >
                  <Plus size={14} aria-hidden="true" />{t("teams.addJoinQuestion")}
                </button>
              )}
              <p className="text-[11px] leading-5 text-ink-muted">{t("teams.formPrivacyHint")}</p>
            </section>

            <section className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t("teams.settingsDiscovery")}</h2>
                <p className="mt-1 text-xs text-ink-muted">{t("teams.settingsDiscoveryHint")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="team-github" className="label">GitHub</label>
                  <input id="team-github" type="url" value={settings.githubUrl} onChange={(event) => updateField("githubUrl", event.target.value)} className="input" placeholder="https://github.com/..." />
                </div>
                <div>
                  <label htmlFor="team-live-url" className="label">{t("teams.liveUrl")}</label>
                  <input id="team-live-url" type="url" value={settings.liveUrl} onChange={(event) => updateField("liveUrl", event.target.value)} className="input" placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="team-docs-url" className="label">{t("projects.documentation")}</label>
                  <input id="team-docs-url" type="url" value={settings.docsUrl} onChange={(event) => updateField("docsUrl", event.target.value)} className="input" placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="team-pitch-deck-url" className="label">{t("projects.pitchDeck")}</label>
                  <input id="team-pitch-deck-url" type="url" value={settings.pitchDeckUrl} onChange={(event) => updateField("pitchDeckUrl", event.target.value)} className="input" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label htmlFor="team-tech-stack" className="label">{t("teams.techStack")}</label>
                <input id="team-tech-stack" value={settings.techStack.join(", ")} onChange={(event) => updateField("techStack", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="input" placeholder="Next.js, Prisma, Figma" />
                <p className="mt-1 text-xs text-ink-muted">{t("teams.commaSeparatedHint")}</p>
              </div>
              <div>
                <label htmlFor="team-tags" className="label">{t("teams.tags")}</label>
                <input id="team-tags" value={settings.tags.join(", ")} onChange={(event) => updateField("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="input" placeholder="saas, education, climate" />
                <p className="mt-1 text-xs text-ink-muted">{t("teams.commaSeparatedHint")}</p>
              </div>
              <fieldset>
                <legend className="label">{t("teams.roles")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEAM_ROLES.map((role) => {
                    const selected = settings.lookingFor.includes(role);
                    return (
                      <label key={role} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition ${selected ? "border-gold/50 bg-gold/10 text-ink" : "border-midnight-border text-ink-muted hover:border-gold/40"}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleRole(role)} className="h-4 w-4 accent-gold" />
                        <span className="flex-1">{t(`projects.roles.${role}`)}</span>
                        {selected && <Check size={15} className="text-gold-soft" aria-hidden="true" />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            {(error || notice) && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>{error || notice}</p>}

            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-midnight-border bg-midnight-card/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-md">
              <Link href="/teams" className="btn-ghost">{t("common.cancel")}</Link>
              <button type="submit" disabled={saving} className="btn-gold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {saving ? t("teams.settingsSaving") : t("teams.settingsSave")}
              </button>
            </div>
          </div>
        </form>
      )}

      {!loading && !error && settings.title && (
        <section className="space-y-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-5" aria-labelledby="delete-team-title">
          <div>
            <h2 id="delete-team-title" className="text-sm font-semibold text-rose-300">{t("teams.deleteTeamTitle")}</h2>
            <p className="mt-1 max-w-xl text-xs text-ink-muted">{t("teams.deleteTeamDescription")}</p>
          </div>
          <button type="button" disabled={deleting} onClick={deleteTeam} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs text-rose-300 hover:text-rose-200">
            {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {deleting ? t("teams.deletingTeam") : t("teams.deleteTeamAction")}
          </button>
        </section>
      )}
      <TeamLogoUploadModal
        open={logoModalOpen}
        currentImage={settings.logoUrl}
        teamId={params.id}
        onClose={() => setLogoModalOpen(false)}
        onUploaded={(image) => {
          updateField("logoUrl", image);
          setNotice(t("teams.logoSaved"));
          void queryClient.invalidateQueries({ queryKey: ["team", params.id] });
          void queryClient.invalidateQueries({ queryKey: ["teams"] });
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
    </div>
  );
}