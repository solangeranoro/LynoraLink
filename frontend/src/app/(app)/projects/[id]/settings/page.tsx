"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Loader2, Save, Trash2, X } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";
import { getUploadErrorCode, getUploadErrorDetails, uploadProjectImage } from "@/lib/cloudinary";

const PROJECT_ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;
type ProjectRole = typeof PROJECT_ROLES[number];
type ProjectStatus = "IDEA" | "DEVELOPMENT" | "LAUNCHED";

type ProjectSettings = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  isPrivate: boolean;
  logoUrl: string;
  coverUrl: string;
  githubUrl: string;
  liveUrl: string;
  docsUrl: string;
  pitchDeckUrl: string;
  techStack: string[];
  tags: string[];
  lookingFor: ProjectRole[];
};

const splitList = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export default function ProjectSettingsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [techStack, setTechStack] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${params.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("project_settings_load_failed");
        return await response.json() as { project: Partial<ProjectSettings>; isOwner: boolean };
      })
      .then(({ project, isOwner }) => {
        if (cancelled) return;
        if (!isOwner) {
          setError(t("projects.settingsOwnerOnly"));
          return;
        }
        const loaded: ProjectSettings = {
          id: params.id,
          title: project.title ?? "",
          tagline: project.tagline ?? "",
          description: project.description ?? "",
          status: project.status ?? "IDEA",
          isPrivate: project.isPrivate ?? false,
          logoUrl: project.logoUrl ?? "",
          coverUrl: project.coverUrl ?? "",
          githubUrl: project.githubUrl ?? "",
          liveUrl: project.liveUrl ?? "",
          docsUrl: project.docsUrl ?? "",
          pitchDeckUrl: project.pitchDeckUrl ?? "",
          techStack: project.techStack ?? [],
          tags: project.tags ?? [],
          lookingFor: project.lookingFor ?? [],
        };
        setSettings(loaded);
        setTechStack(loaded.techStack.join(", "));
        setTags(loaded.tags.join(", "));
      })
      .catch(() => {
        if (!cancelled) setError(t("projects.settingsLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.id, t]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  function updateField<Key extends keyof ProjectSettings>(key: Key, value: ProjectSettings[Key]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
    setError("");
    setNotice("");
  }

  function toggleRole(role: ProjectRole) {
    if (!settings) return;
    updateField("lookingFor", settings.lookingFor.includes(role)
      ? settings.lookingFor.filter((item) => item !== role)
      : [...settings.lookingFor, role]);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, purpose: "logo" | "cover") {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !settings) return;
    if (!file.type.startsWith("image/") || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setError(t("projects.projectImageFileError"));
      return;
    }
    setUploading(purpose);
    setError("");
    try {
      const imageUrl = await uploadProjectImage(file, undefined, purpose);
      updateField(purpose === "logo" ? "logoUrl" : "coverUrl", imageUrl);
      if (purpose === "logo") setLogoFile(file);
      else setCoverFile(file);
    } catch (error) {
      const code = getUploadErrorCode(error);
      const details = getUploadErrorDetails(error);
      setError(code === "cloudinary_not_configured"
        ? t("projects.projectImageServiceUnavailable")
        : code === "cloudinary_temporarily_unavailable" || code === "cloudinary_unreachable"
          ? t("projects.projectImageServiceError")
          : code === "cloudinary_upload_failed" && details
            ? t("projects.projectImageUploadErrorDetail", { details: details.slice(0, 180) })
          : code === "upload_session_unavailable" || code === "upload_server_error" || code === "project_image_upload_failed"
            ? t("projects.projectImageServerError")
            : t("projects.projectImageUploadError"));
    } finally {
      setUploading(null);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          techStack: splitList(techStack),
          tags: splitList(tags),
        }),
      });
      if (!response.ok) throw new Error("project_settings_save_failed");
      setNotice(t("projects.settingsSaved"));
      setLogoFile(null);
      setCoverFile(null);
      await queryClient.invalidateQueries({ queryKey: ["project-hub", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch {
      setError(t("projects.settingsSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!settings) return;
    const confirmation = window.prompt(t("projects.deleteProjectPrompt", { name: settings.title }));
    if (confirmation?.trim() !== settings.title.trim()) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("project_delete_failed");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.replace("/projects");
    } catch {
      setError(t("projects.deleteProjectError"));
    } finally {
      setDeleting(false);
    }
  }

  const imageControl = (purpose: "logo" | "cover") => {
    const isLogo = purpose === "logo";
    const imageUrl = isLogo ? settings?.logoUrl : settings?.coverUrl;
    const input = isLogo ? logoInput : coverInput;
    const preview = isLogo ? logoPreview : coverPreview;
    const title = t(isLogo ? "projects.projectLogo" : "projects.projectCover");
    return (
      <div className="rounded-xl border border-midnight-border p-4">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs text-ink-muted">{t(isLogo ? "projects.projectLogoHint" : "projects.projectCoverHint")}</p>
        <div className={`relative mt-3 overflow-hidden rounded-lg border border-midnight-border bg-midnight-deep ${isLogo ? "h-28 w-28" : "aspect-[16/6] w-full"}`}>
          {(preview || imageUrl) ? <img src={preview || imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-ink-muted">{t("projects.noImageSelected")}</div>}
        </div>
        <input ref={input} type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event, purpose)} className="sr-only" aria-label={title} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={uploading !== null} onClick={() => input.current?.click()} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs disabled:opacity-50">
            {uploading === purpose ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
            {t(imageUrl ? "projects.replaceProjectImage" : "projects.addProjectImage")}
          </button>
          {imageUrl && <button type="button" disabled={uploading !== null} onClick={() => { updateField(isLogo ? "logoUrl" : "coverUrl", ""); if (isLogo) setLogoFile(null); else setCoverFile(null); }} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs text-rose-300"><X size={14} aria-hidden="true" />{t("projects.removeProjectImage")}</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Link href={`/projects/${params.id}`} className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />{t("projects.backToProject")}
      </Link>
      <header className="border-b border-midnight-border pb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("projects.settingsEyebrow")}</p>
        <h1 className="section-title">{t("projects.settingsTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t("projects.settingsSubtitle")}</p>
        {settings && <p className="mt-2 text-sm font-medium text-gold-soft">{settings.title}</p>}
      </header>

      {loading ? (
        <div className="card space-y-4 p-6" aria-busy="true">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      ) : !settings ? (
        <div className="card p-6">
          <p role="alert" className="text-sm text-rose-300">{error || t("projects.settingsLoadError")}</p>
          <Link href="/projects" className="btn-ghost mt-4">{t("common.back")}</Link>
        </div>
      ) : (
        <>
          <form onSubmit={saveSettings} className="card overflow-hidden">
            <div className="border-b border-midnight-border bg-midnight-card/45 px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("projects.settingsIdentity")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("projects.settingsIdentityHint")}</p>
            </div>
            <div className="space-y-7 p-5 sm:p-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-ink">{t("projects.projectMedia")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">{imageControl("logo")}{imageControl("cover")}</div>
              </section>

              <section className="space-y-4 border-t border-midnight-border pt-6">
                <h2 className="text-sm font-semibold text-ink">{t("projects.settingsBasics")}</h2>
                <div>
                  <label htmlFor="project-settings-title" className="label">{t("projects.projectTitle")}</label>
                  <input id="project-settings-title" required minLength={3} maxLength={100} value={settings.title} onChange={(event) => updateField("title", event.target.value)} className="input" />
                </div>
                <div>
                  <label htmlFor="project-settings-tagline" className="label">{t("projects.tagline")}</label>
                  <input id="project-settings-tagline" required minLength={5} maxLength={160} value={settings.tagline} onChange={(event) => updateField("tagline", event.target.value)} className="input" />
                </div>
                <div>
                  <label htmlFor="project-settings-description" className="label">{t("projects.aboutProject")}</label>
                  <textarea id="project-settings-description" required minLength={20} maxLength={5000} rows={6} value={settings.description} onChange={(event) => updateField("description", event.target.value)} className="input resize-y" />
                  <p className="mt-1 text-right text-xs text-ink-muted">{settings.description.length}/5000</p>
                </div>
                <div>
                  <label htmlFor="project-settings-status" className="label">{t("projects.statusLabel")}</label>
                  <select id="project-settings-status" value={settings.status} onChange={(event) => updateField("status", event.target.value as ProjectStatus)} className="input">
                    {(["IDEA", "DEVELOPMENT", "LAUNCHED"] as const).map((status) => <option key={status} value={status}>{t(`projects.status.${status}`)}</option>)}
                  </select>
                </div>
              </section>

              <section className="space-y-4 border-t border-midnight-border pt-6">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{t("projects.projectPrivacy")}</h2>
                  <p className="mt-1 text-xs text-ink-muted">{t("projects.projectPrivacyHint")}</p>
                </div>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">{t("projects.projectPrivacy")}</legend>
                  <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 ${!settings.isPrivate ? "border-gold/50 bg-gold/10" : "border-midnight-border hover:border-gold/40"}`}>
                    <input type="radio" name="project-privacy" checked={!settings.isPrivate} onChange={() => updateField("isPrivate", false)} className="mt-1 accent-gold" />
                    <span><span className="block text-sm font-medium text-ink">{t("projects.publicProject")}</span><span className="mt-1 block text-xs text-ink-muted">{t("projects.publicProjectHint")}</span></span>
                  </label>
                  <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 ${settings.isPrivate ? "border-gold/50 bg-gold/10" : "border-midnight-border hover:border-gold/40"}`}>
                    <input type="radio" name="project-privacy" checked={settings.isPrivate} onChange={() => updateField("isPrivate", true)} className="mt-1 accent-gold" />
                    <span><span className="block text-sm font-medium text-ink">{t("projects.privateProject")}</span><span className="mt-1 block text-xs text-ink-muted">{t("projects.privateProjectHint")}</span></span>
                  </label>
                </fieldset>
              </section>

              <section className="space-y-4 border-t border-midnight-border pt-6">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{t("projects.settingsLinks")}</h2>
                  <p className="mt-1 text-xs text-ink-muted">{t("projects.settingsLinksHint")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ["githubUrl", "GitHub URL"],
                    ["liveUrl", t("projects.liveSite")],
                    ["docsUrl", t("projects.documentation")],
                    ["pitchDeckUrl", t("projects.pitchDeck")],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label htmlFor={`project-settings-${key}`} className="label">{label}</label>
                      <input id={`project-settings-${key}`} type="url" value={settings[key]} onChange={(event) => updateField(key, event.target.value)} className="input" placeholder="https://" />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="project-settings-stack" className="label">{t("projects.techStackLabel")}</label>
                  <input id="project-settings-stack" value={techStack} onChange={(event) => setTechStack(event.target.value)} className="input" placeholder="Next.js, Prisma, Tailwind" />
                  <p className="mt-1 text-xs text-ink-muted">{t("projects.commaSeparatedHint")}</p>
                </div>
                <div>
                  <label htmlFor="project-settings-tags" className="label">{t("projects.tagsLabel")}</label>
                  <input id="project-settings-tags" value={tags} onChange={(event) => setTags(event.target.value)} className="input" placeholder="saas, analytics, privacy" />
                </div>
              </section>

              <fieldset className="space-y-3 border-t border-midnight-border pt-6">
                <legend className="text-sm font-semibold text-ink">{t("projects.lookingFor")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROJECT_ROLES.map((role) => {
                    const selected = settings.lookingFor.includes(role);
                    return (
                      <label key={role} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition ${selected ? "border-gold/50 bg-gold/10 text-ink" : "border-midnight-border text-ink-muted hover:border-gold/40"}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleRole(role)} className="h-4 w-4 accent-gold" />
                        <span>{t(`projects.roles.${role}`)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {(error || notice) && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>{error || notice}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border pt-5">
                <Link href={`/projects/${params.id}`} className="btn-ghost">{t("common.cancel")}</Link>
                <button type="submit" disabled={saving || uploading !== null} className="btn-gold">
                  {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                  {saving ? t("projects.settingsSaving") : t("projects.settingsSave")}
                </button>
              </div>
            </div>
          </form>

          <section className="space-y-3 border-t border-rose-500/30 pt-6" aria-labelledby="delete-project-title">
            <div>
              <h2 id="delete-project-title" className="text-sm font-semibold text-rose-300">{t("projects.deleteProjectTitle")}</h2>
              <p className="mt-1 max-w-2xl text-xs text-ink-muted">{t("projects.deleteProjectDescription")}</p>
            </div>
            <button type="button" disabled={deleting} onClick={() => void deleteProject()} className="btn-ghost !min-h-9 !rounded-lg !px-3 !py-2 text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
              {deleting ? t("projects.deletingProject") : t("projects.deleteProjectAction")}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
