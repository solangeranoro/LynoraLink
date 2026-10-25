"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Github, ImagePlus, Loader2 } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useSession } from "next-auth/react";
import { getUploadErrorCode, getUploadErrorDetails, uploadProjectImage } from "@/lib/cloudinary";
import { useTranslation } from "@/lib/i18n";

const ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;

export type CreatedProject = {
  id: string;
  title: string;
  teamName: string | null;
  logoUrl: string | null;
  coverUrl?: string | null;
};

export function ProjectCreateForm({ onCreated, onCancel }: { onCreated: (project: CreatedProject) => void; onCancel?: () => void }) {
  const { t, locale } = useTranslation();
  const isFrench = locale === "fr";
  const { data: session } = useSession();
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    tagline: "",
    description: "",
    status: "IDEA" as "IDEA" | "DEVELOPMENT" | "LAUNCHED",
    logoUrl: "",
    coverUrl: "",
    githubUrl: "",
    liveUrl: "",
    docsUrl: "",
    pitchDeckUrl: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState<"logo" | "cover" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState("");
  const [techStack, setTechStack] = useState("");
  const [tags, setTags] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubImportMessage, setGithubImportMessage] = useState("");

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const preview = URL.createObjectURL(logoFile);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [logoFile]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }
    const preview = URL.createObjectURL(coverFile);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [coverFile]);

  async function selectProjectImage(event: ChangeEvent<HTMLInputElement>, purpose: "logo" | "cover") {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setMediaError(t("projects.projectImageFileError"));
      return;
    }

    setMediaError("");
    setUploadingImage(purpose);
    setUploadProgress(0);
    if (purpose === "logo") setLogoFile(file);
    else setCoverFile(file);
    try {
      const image = await uploadProjectImage(file, setUploadProgress, purpose);
      setForm((current) => ({ ...current, [purpose === "logo" ? "logoUrl" : "coverUrl"]: image }));
      if (purpose === "logo") setLogoFile(null);
      else setCoverFile(null);
    } catch (error) {
      const code = getUploadErrorCode(error);
      const details = getUploadErrorDetails(error);
      setMediaError(code === "cloudinary_not_configured"
        ? t("projects.projectImageServiceUnavailable")
        : code === "cloudinary_temporarily_unavailable" || code === "cloudinary_unreachable"
          ? t("projects.projectImageServiceError")
          : code === "cloudinary_upload_failed" && details
            ? t("projects.projectImageUploadErrorDetail", { details: details.slice(0, 180) })
          : code === "upload_session_unavailable" || code === "upload_server_error" || code === "project_image_upload_failed"
            ? t("projects.projectImageServerError")
            : t("projects.projectImageUploadError"));
      if (purpose === "logo") setLogoFile(null);
      else setCoverFile(null);
    } finally {
      setUploadingImage(null);
    }
  }

  async function importGitHubRepository() {
    setGithubImporting(true);
    setGithubImportMessage("");
    try {
      const response = await fetch(`/api/github/repository?url=${encodeURIComponent(form.githubUrl)}`);
      const result = await response.json() as {
        error?: string;
        repository?: { name: string; fullName: string; description: string | null; url: string; language: string | null; topics: string[] };
      };
      if (!response.ok || !result.repository) throw new Error(result.error ?? "github_import_failed");
      const repository = result.repository;
      const description = repository.description?.trim() || t("projects.githubDefaultDescription", { name: repository.fullName });
      const tagline = description.length >= 5 ? description.slice(0, 160) : t("projects.githubDefaultTagline", { name: repository.name });
      setForm((current) => ({
        ...current,
        title: current.title.trim() || (repository.name.length >= 3 ? repository.name : `${repository.name} project`),
        tagline: current.tagline.trim() || tagline,
        description: current.description.trim() || description,
        githubUrl: repository.url,
      }));
      setTechStack((current) => Array.from(new Set([...current.split(","), repository.language ?? ""].map((item) => item.trim()).filter(Boolean))).join(", "));
      setTags((current) => Array.from(new Set([...current.split(","), ...repository.topics].map((tag) => tag.trim()).filter(Boolean))).join(", "));
      setGithubImportMessage(t("projects.githubImported", { name: repository.fullName }));
    } catch (importError) {
      const code = importError instanceof Error ? importError.message : "";
      setGithubImportMessage(t(code === "INVALID_GITHUB_URL" ? "projects.githubInvalidUrl" : code === "REPOSITORY_NOT_FOUND" ? "projects.githubNotFound" : code === "GITHUB_RATE_LIMIT" ? "projects.githubRateLimit" : "projects.githubImportError"));
    } finally {
      setGithubImporting(false);
    }
  }

  function toggleRole(role: string) {
    setLookingFor((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          techStack: techStack.split(",").map((item) => item.trim()).filter(Boolean),
          tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
          lookingFor,
        }),
      });
      const result = await response.json() as { error?: string; project?: CreatedProject };
      if (!response.ok || !result.project) {
        setError(
          result.error === "PROJECT_LIMIT_REACHED"
            ? "PROJECT_LIMIT_REACHED"
            : result.error === "UNAUTHORIZED"
              ? "UNAUTHORIZED"
              : result.error === "FORBIDDEN"
                ? "FORBIDDEN"
                : result.error === "VALIDATION"
                  ? "VALIDATION"
                  : response.status >= 500
                    ? "SERVICE_UNAVAILABLE"
                    : "PROJECT_CREATE_FAILED",
        );
        return;
      }
      onCreated(result.project);
    } catch (error) {
      setError(error instanceof TypeError ? "NETWORK_UNAVAILABLE" : "SERVICE_UNAVAILABLE");
    } finally {
      setLoading(false);
    }
  }

  const creatorName = session?.user?.name ?? session?.user?.handle ?? (isFrench ? "Votre profil" : "Your profile");

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <section className="overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep/25" aria-label={t("projects.projectPreview")}>
        <div className="flex items-center gap-3 border-b border-midnight-border px-3.5 py-3">
          <Avatar src={session?.user?.image} name={creatorName} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{creatorName}</p>
            <p className="text-[10px] text-ink-muted">{t("projects.projectCreator")}</p>
          </div>
        </div>
        <div className="relative flex aspect-[16/7] items-end gap-3 overflow-hidden bg-gradient-to-br from-gold/20 via-midnight-deep to-cyan-950/80 p-4">
          {(coverPreview || form.coverUrl) && <img src={coverPreview || form.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
          {(logoPreview || form.logoUrl) && (
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-black/30">
              <img src={logoPreview || form.logoUrl} alt="" className="h-full w-full object-cover" />
            </span>
          )}
          <span className="relative min-w-0">
            <span className="block truncate font-display text-lg font-semibold text-white drop-shadow">{form.title || t("projects.projectTitlePreview")}</span>
            <span className="mt-0.5 block truncate text-xs text-white/75">{t(`projects.status.${form.status}`)}</span>
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label={t("projects.projectMedia")}>
        <div className="rounded-xl border border-midnight-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">{t("projects.projectLogo")}</p>
              <p className="mt-1 text-[10px] text-ink-muted">{t("projects.projectLogoHint")}</p>
            </div>
            <input ref={logoInput} type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => void selectProjectImage(event, "logo")} className="sr-only" aria-label={t("projects.projectLogo")} />
            <button type="button" onClick={() => logoInput.current?.click()} disabled={uploadingImage !== null} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[11px] disabled:opacity-50">
              <Camera size={13} aria-hidden="true" />{form.logoUrl ? t("projects.replaceProjectImage") : t("projects.addProjectLogo")}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-midnight-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">{t("projects.projectCover")}</p>
              <p className="mt-1 text-[10px] text-ink-muted">{t("projects.projectCoverHint")}</p>
            </div>
            <input ref={coverInput} type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => void selectProjectImage(event, "cover")} className="sr-only" aria-label={t("projects.projectCover")} />
            <button type="button" onClick={() => coverInput.current?.click()} disabled={uploadingImage !== null} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[11px] disabled:opacity-50">
              <ImagePlus size={13} aria-hidden="true" />{form.coverUrl ? t("projects.replaceProjectImage") : t("projects.addProjectCover")}
            </button>
          </div>
        </div>
      </section>
      {uploadingImage && (
        <div className="rounded-lg border border-midnight-border bg-midnight-deep/40 p-3" aria-live="polite">
          <div className="mb-2 flex justify-between text-xs"><span>{t("projects.projectImageUploading")}</span><span>{uploadProgress}%</span></div>
          <div role="progressbar" aria-label={t("projects.projectImageUploading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} className="h-1.5 overflow-hidden rounded-full bg-midnight-border">
            <div className="h-full bg-gold transition-[width]" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
      {mediaError && <p role="alert" className="text-xs text-rose-300">{mediaError}</p>}

      <div>
        <label htmlFor="project-title" className="label">{t("projects.projectTitle")}</label>
        <input id="project-title" required minLength={3} maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="input" placeholder="Orbit Analytics" />
      </div>
      <div>
        <label htmlFor="project-tagline" className="label">Tagline</label>
        <input id="project-tagline" required value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} className="input" placeholder="Privacy-first analytics for indie hackers" />
      </div>
      <div>
        <label htmlFor="project-description" className="label">Description</label>
        <textarea id="project-description" required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input resize-none" />
      </div>
      <div>
        <label htmlFor="project-status" className="label">{t("projects.status.IDEA")} / {t("projects.status.DEVELOPMENT")} / {t("projects.status.LAUNCHED")}</label>
        <select id="project-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })} className="input">
          <option value="IDEA">{t("projects.status.IDEA")}</option>
          <option value="DEVELOPMENT">{t("projects.status.DEVELOPMENT")}</option>
          <option value="LAUNCHED">{t("projects.status.LAUNCHED")}</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="project-github" className="label">GitHub URL</label>
          <div className="flex gap-2">
            <input id="project-github" type="url" value={form.githubUrl} onChange={(event) => setForm({ ...form, githubUrl: event.target.value })} className="input min-w-0 flex-1" placeholder="https://github.com/owner/repository" />
            <button type="button" onClick={importGitHubRepository} disabled={githubImporting || !form.githubUrl.trim()} className="btn-ghost shrink-0 !rounded-lg" title={t("projects.importGitHub")}>
              {githubImporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Github className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{githubImporting ? t("projects.githubImporting") : t("projects.importGitHub")}</span>
            </button>
          </div>
          {githubImportMessage && <p role="status" className="mt-1 text-xs text-gold-soft">{githubImportMessage}</p>}
        </div>
        <div>
          <label htmlFor="project-live" className="label">Live URL</label>
          <input id="project-live" type="url" value={form.liveUrl} onChange={(event) => setForm({ ...form, liveUrl: event.target.value })} className="input" placeholder="https://..." />
        </div>
        <div>
          <label htmlFor="project-docs" className="label">{t("projects.documentation")}</label>
          <input id="project-docs" type="url" value={form.docsUrl} onChange={(event) => setForm({ ...form, docsUrl: event.target.value })} className="input" placeholder="https://..." />
        </div>
        <div>
          <label htmlFor="project-pitch" className="label">{t("projects.pitchDeck")}</label>
          <input id="project-pitch" type="url" value={form.pitchDeckUrl} onChange={(event) => setForm({ ...form, pitchDeckUrl: event.target.value })} className="input" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label htmlFor="project-stack" className="label">Tech stack (séparé par des virgules)</label>
        <input id="project-stack" value={techStack} onChange={(event) => setTechStack(event.target.value)} className="input" placeholder="Next.js, Prisma, Tailwind" />
      </div>
      <div>
        <label htmlFor="project-tags" className="label">Tags (séparés par des virgules)</label>
        <input id="project-tags" value={tags} onChange={(event) => setTags(event.target.value)} className="input" placeholder="saas, analytics, privacy" />
      </div>
      <div>
        <span className="label">{t("projects.lookingFor")}</span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <button key={role} type="button" onClick={() => toggleRole(role)} className={lookingFor.includes(role) ? "badge-gold" : "badge"}>{t(`projects.roles.${role}`)}</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{t(error === "NETWORK_UNAVAILABLE"
        ? "auth.errors.networkUnavailable"
        : error === "SERVICE_UNAVAILABLE"
          ? "auth.errors.serviceUnavailable"
          : error === "UNAUTHORIZED"
            ? "auth.errors.sessionExpired"
            : error === "FORBIDDEN"
              ? "auth.errors.accessDenied"
              : error === "VALIDATION"
                ? "projects.validationError"
                : "auth.errors.serviceUnavailable")}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <button type="button" onClick={onCancel} disabled={loading} className="btn-ghost">{t("common.cancel")}</button>}
        <button type="submit" disabled={loading || uploadingImage !== null} className="btn-gold w-full sm:w-auto">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("common.submit")}
        </button>
      </div>
    </form>
  );
}
