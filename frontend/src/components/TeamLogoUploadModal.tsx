"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, UsersRound, X } from "@/components/FontAwesomeIcons";
import { getUploadErrorCode, getUploadErrorDetails, uploadTeamLogoImage } from "@/lib/cloudinary";
import { useTranslation } from "@/lib/i18n";

type TeamLogoUploadModalProps = {
  open: boolean;
  currentImage: string;
  teamId?: string;
  onClose: () => void;
  onUploaded: (image: string) => void;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"];

export default function TeamLogoUploadModal({
  open,
  currentImage,
  teamId,
  onClose,
  onUploaded,
}: TeamLogoUploadModalProps) {
  const { t, locale } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function closeModal() {
    if (uploading) return;
    setFile(null);
    setError("");
    onClose();
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type) || selected.size === 0 || selected.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setError(t("teams.avatarFileError"));
      return;
    }
    setFile(selected);
    setError("");
  }

  async function uploadSelectedImage() {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setProcessing(false);
    setError("");
    try {
      const image = await uploadTeamLogoImage(file, setProgress, teamId, () => setProcessing(true));
      onUploaded(image);
      setFile(null);
      onClose();
    } catch (error) {
      const code = getUploadErrorCode(error);
      const details = getUploadErrorDetails(error);
      setError(code === "cloudinary_not_configured"
        ? t("teams.logoUploadServiceUnavailable")
        : code === "cloudinary_temporarily_unavailable" || code === "cloudinary_unreachable"
          ? t("teams.logoUploadServiceError")
          : code === "cloudinary_upload_failed" && details
            ? t("teams.logoUploadErrorDetail", { details: details.slice(0, 180) })
          : code === "upload_session_unavailable" || code === "upload_server_error" || code === "team_logo_upload_failed" || code === "team_logo_update_unavailable" || code === "team_lookup_unavailable"
            ? t("teams.logoUploadServerError")
            : t("teams.logoUploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="team-logo-upload-title"
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-midnight-border bg-midnight-card p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-md"
    >
      <section className="overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-midnight-border bg-midnight-deep/35 px-5 py-5 sm:px-7">
          <div>
            <h2 id="team-logo-upload-title" className="text-xl font-semibold tracking-tight text-ink">{t("teams.logoModalTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("teams.logoModalHint")}</p>
          </div>
          <button type="button" onClick={closeModal} disabled={uploading} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:border-gold/30 hover:bg-midnight-card hover:text-ink disabled:opacity-50">
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-4 rounded-xl border border-midnight-border bg-midnight-deep/45 p-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-gold/30 bg-midnight-card text-gold-soft">
              {(preview || currentImage)
                ? <img src={preview || currentImage} alt={t("teams.avatarPreview")} className="h-full w-full object-cover" />
                : <UsersRound size={28} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t("teams.avatarLabel")}</p>
              <p className="mt-1 text-xs text-ink-muted">{t("teams.avatarHint")}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-ink">{t("teams.chooseLogo")}</p>
            <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(",")} onChange={selectImage} className="sr-only" aria-label={t("teams.chooseLogo")} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="group w-full rounded-xl border border-dashed border-midnight-border bg-midnight-deep/35 px-4 py-4 text-left transition hover:border-gold/50 hover:bg-midnight-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <Camera size={17} className="shrink-0 text-gold-soft" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-ink">{file?.name ?? t("teams.noLogoSelected")}</span>
                  {file && <span className="mt-1 block text-[10px] text-ink-muted">{(file.size / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} {locale === "fr" ? "Mo" : "MB"}</span>}
                </span>
                <span className="shrink-0 text-xs font-semibold text-gold-soft">{t(file ? "teams.chooseAnotherLogo" : "teams.browseLogoFiles")}</span>
              </span>
            </button>
          </div>

          {uploading && (
            <div className="rounded-xl border border-midnight-border bg-midnight-deep/50 p-4" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-ink">
                  {processing ? (locale === "fr" ? "Finalisation de l’image…" : "Finishing image…") : t("teams.logoUploading")}
                </span>
                {processing && <Loader2 size={14} className="animate-spin text-gold-soft" aria-hidden="true" />}
                <span className="tabular-nums text-gold-soft">{progress}%</span>
              </div>
              <div role="progressbar" aria-label={t("teams.logoUploading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-midnight-border/70">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-gold transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-midnight-border pt-4">
            <button type="button" onClick={closeModal} disabled={uploading} className="btn-ghost !rounded-lg">{t("common.cancel")}</button>
            <button type="button" onClick={() => void uploadSelectedImage()} disabled={!file || uploading} className="btn-gold min-w-36 !rounded-lg disabled:cursor-not-allowed disabled:opacity-50">
              {uploading ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" />{progress}%</> : t("teams.uploadLogo")}
            </button>
          </footer>
        </div>
      </section>
    </dialog>
  );
}
