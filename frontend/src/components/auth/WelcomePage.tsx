"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Camera, Check, Compass, FolderPlus, Image, Link2, Loader2, LogOut, Save, Sparkles, UserRound, Wrench, X } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { useLogoutTransition } from "@/components/auth/LogoutTransition";
import { getUploadErrorCode, getUploadErrorDetails, uploadAvatarImage } from "@/lib/cloudinary";
import { useTranslation } from "@/lib/i18n";
import { getNetworkErrorMessage } from "@/lib/error-messages";

type WelcomeProfile = {
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  age: number | null;
  city: string | null;
  phoneNumber: string | null;
  openToCoBuild: boolean;
  githubUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
};

function WelcomePageSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-9 py-2" aria-busy="true" aria-label={label}>
      <section className="grid gap-8 border-b border-midnight-border pb-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <div className="space-y-5">
          <div className="skeleton h-3 w-44" />
          <div className="skeleton h-12 w-3/4 max-w-xl sm:h-14" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full max-w-2xl" />
            <div className="skeleton h-4 w-4/5 max-w-xl" />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="skeleton h-11 w-44 rounded-lg" />
            <div className="skeleton h-11 w-40 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-4 border-t border-midnight-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-4 lg:col-span-2">
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-3 w-28" />
        </div>
      </section>
      <section className="grid gap-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.7fr)] lg:gap-12">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="skeleton h-3 w-36" />
            <div className="skeleton h-7 w-56" />
          </div>
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="grid gap-x-8 sm:grid-cols-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex min-h-[5.5rem] items-center gap-3 border-t border-midnight-border py-3">
                <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-28" />
                  <div className="skeleton h-3 w-full max-w-48" />
                </div>
              </div>
            ))}
          </div>
          <div className="skeleton h-10 w-40 rounded-lg" />
        </div>
        <aside className="space-y-5 border-t border-midnight-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="space-y-3">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
          <div className="space-y-4 border-t border-midnight-border pt-5">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        </aside>
      </section>
    </div>
  );
}

export function WelcomePage() {
  const { t } = useTranslation();
  const { data: session, status, update: updateSession } = useSession();
  const { logout, overlay: logoutOverlay } = useLogoutTransition();
  const router = useRouter();
  const [isRegistrationComplete, setIsRegistrationComplete] = useState(false);
  const [profile, setProfile] = useState<WelcomeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<WelcomeProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarStage, setAvatarStage] = useState<"preparing" | "uploading" | "processing">("preparing");
  const [avatarSuccessMessage, setAvatarSuccessMessage] = useState("");
  const editorDialog = useRef<HTMLDialogElement>(null);
  const avatarDialog = useRef<HTMLDialogElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = editorDialog.current;
    if (editingProfile && dialog && !dialog.open) dialog.showModal();
  }, [editingProfile]);

  useEffect(() => {
    const dialog = avatarDialog.current;
    if (!dialog) return;
    if (avatarModalOpen && !dialog.open) dialog.showModal();
    if (!avatarModalOpen && dialog.open) dialog.close();
  }, [avatarModalOpen]);

  useEffect(() => {
    if (!avatarModalOpen || !avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile, avatarModalOpen]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("lynora.registrationComplete") === "1") {
        setIsRegistrationComplete(true);
        return;
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
    router.replace("/register");
  }, [router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();

    setProfileLoading(true);
    setProfileError(false);
    fetch("/api/profile", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile_load_failed");
        const result = await response.json();
        setProfile(result.profile as WelcomeProfile);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setProfileError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileLoading(false);
      });

    return () => controller.abort();
  }, [status, reloadKey]);

  function clearRegistrationMarker() {
    try {
      window.sessionStorage.removeItem("lynora.registrationComplete");
    } catch {
      // Navigation can continue without session storage.
    }
  }

  function openProfileEditor() {
    if (!profile) return;
    setProfileDraft({ ...profile, skills: [...profile.skills] });
    setProfileMessage("");
    setAvatarError("");
    setEditingProfile(true);
  }

  function closeProfileEditor() {
    setEditingProfile(false);
    setProfileDraft(null);
    setProfileMessage("");
  }

  function openAvatarModal() {
    setAvatarFile(null);
    setAvatarError("");
    setAvatarProgress(0);
    setAvatarSuccessMessage("");
    setAvatarModalOpen(true);
  }

  function closeAvatarModal() {
    if (avatarUploading) return;
    setAvatarModalOpen(false);
    setAvatarFile(null);
    setAvatarError("");
  }

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setAvatarFile(null);
      setAvatarError(t("welcome.profileEditor.invalidImage"));
      return;
    }
    setAvatarFile(file);
    setAvatarError("");
  }

  async function uploadSelectedAvatar() {
    if (!avatarFile || !profile) return;
    setAvatarUploading(true);
    setAvatarProgress(0);
    setAvatarStage("preparing");
    setAvatarError("");
    try {
      const image = await uploadAvatarImage(
        avatarFile,
        (progress) => {
          setAvatarProgress(progress);
          setAvatarStage("uploading");
        },
        () => setAvatarStage("processing"),
      );
      const updatedProfile = { ...profile, image };
      setProfile(updatedProfile);
      setProfileDraft((current) => current ? { ...current, image } : current);
      setAvatarFile(null);
      setAvatarModalOpen(false);
      setProfileMessage(t("welcome.profileEditor.avatarUpdated"));
      setAvatarSuccessMessage(t("welcome.profileEditor.avatarUpdated"));
      try {
        await updateSession();
      } catch (error) {
        console.error("Profile avatar was saved, but the session refresh failed:", error);
        setProfileMessage(t("welcome.profileEditor.avatarUpdatedRefresh"));
      }
    } catch (error) {
      if (getNetworkErrorMessage(error)) {
        setAvatarError(t("auth.errors.networkUnavailable"));
      } else {
        const code = getUploadErrorCode(error);
        const details = getUploadErrorDetails(error);
        setAvatarError(code === "cloudinary_not_configured"
          ? t("welcome.profileEditor.configurationError")
          : code === "cloudinary_temporarily_unavailable"
            ? t("welcome.profileEditor.serviceError")
          : code === "profile_update_unavailable"
            ? t("welcome.profileEditor.avatarSaveError")
          : code === "upload_session_unavailable" || code === "upload_server_error" || code === "avatar_upload_failed"
            ? t("welcome.profileEditor.serverError")
          : code === "cloudinary_unreachable"
            ? t("auth.errors.networkUnavailable")
          : code === "cloudinary_upload_failed" && details
            ? t("welcome.profileEditor.avatarUploadErrorDetail", { details })
            : code === "invalid_avatar_file"
              ? t("welcome.profileEditor.invalidImage")
              : t("welcome.profileEditor.uploadError"));
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDraft) return;
    setSavingProfile(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileDraft,
          name: profileDraft.name?.trim() ?? "",
          image: profileDraft.image ?? "",
          handle: profileDraft.handle ?? "",
          headline: profileDraft.headline ?? "",
          age: profileDraft.age ?? "",
          bio: profileDraft.bio ?? "",
          city: profileDraft.city ?? "",
          phoneNumber: profileDraft.phoneNumber ?? "",
          skills: profileDraft.skills,
          openToCoBuild: profileDraft.openToCoBuild,
          githubUrl: profileDraft.githubUrl ?? "",
          twitterUrl: profileDraft.twitterUrl ?? "",
          websiteUrl: profileDraft.websiteUrl ?? "",
          location: profileDraft.location ?? "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileMessage(result.error === "handle_taken"
          ? t("welcome.profileEditor.handleTaken")
          : t("welcome.profileEditor.saveError"));
        return;
      }

      setProfile(result.profile as WelcomeProfile);
      closeProfileEditor();
      void updateSession().catch(() => undefined);
    } catch {
      setProfileMessage(t("welcome.profileEditor.saveError"));
    } finally {
      setSavingProfile(false);
    }
  }

  if (!isRegistrationComplete || status === "loading") {
    return <WelcomePageSkeleton label={t("welcome.loadingProfile")} />;
  }

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const title = firstName ? t("welcome.titleNamed", { name: firstName }) : t("welcome.title");

  if (status !== "authenticated" || !session?.user) {
    return (
      <section className="mx-auto w-full max-w-md py-12 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <Check size={26} aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">{t("welcome.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("welcome.signInPrompt")}</p>
        <Link href="/login" className="btn-gold mt-6 w-full">{t("welcome.signInAction")}<ArrowRight size={16} aria-hidden="true" /></Link>
        {logoutOverlay}
      </section>
    );
  }

  if (profileLoading) {
    return <WelcomePageSkeleton label={t("welcome.loadingProfile")} />;
  }

  if (profileError || !profile) {
    return (
      <section className="card mx-auto max-w-xl p-7 text-center sm:p-10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
          <UserRound size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">{t("welcome.profileLoadErrorTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("welcome.profileLoadError")}</p>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-gold mt-6">
          {t("welcome.retryAction")}<ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  const displayName = profile.name?.trim() || session.user.name?.trim() || t("welcome.maker");
  const checklist = [
    { key: "photo", done: Boolean(profile.image), icon: Image },
    { key: "identity", done: Boolean(profile.handle && profile.headline), icon: UserRound },
    { key: "bio", done: Boolean(profile.bio?.trim()), icon: Sparkles },
    { key: "skills", done: profile.skills.length > 0, icon: Wrench },
    { key: "links", done: Boolean(profile.githubUrl || profile.twitterUrl || profile.websiteUrl), icon: Link2 },
  ];
  const completedSteps = checklist.filter((item) => item.done).length;
  const completion = Math.round((completedSteps / checklist.length) * 100);
  const recommendedStep = checklist.find((item) => !item.done);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-9 py-2">
      {avatarSuccessMessage && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{avatarSuccessMessage}</p>}
      <section className="relative grid gap-8 overflow-hidden border-b border-midnight-border pb-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-gold/5 blur-3xl" />
        <div className="max-w-3xl">
          <p className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-soft sm:text-xs">
            <span className="h-px w-8 bg-gold" />{t("welcome.eyebrow")}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
            {profile.headline?.trim() || t("welcome.subtitle")}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {completion < 100 ? (
              <button type="button" onClick={openProfileEditor} className="btn-gold min-h-11">
                {t("welcome.profileAction")}<ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <Link href="/profile" onClick={clearRegistrationMarker} className="btn-gold min-h-11">
                {t("welcome.viewProfileAction")}<ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <Link href="/dashboard" onClick={clearRegistrationMarker} className="btn-outline min-h-11">
              {t("welcome.dashboardAction")}
            </Link>
          </div>
        </div>

        <aside className="flex items-center gap-4 border-t border-midnight-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div className="relative shrink-0">
            <Avatar src={profile.image} name={displayName} size={64} />
            <button
              type="button"
              onClick={openAvatarModal}
              aria-label={t("welcome.profileEditor.changePhoto")}
              title={t("welcome.profileEditor.changePhoto")}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-midnight bg-gold text-midnight-deep shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
            >
              <Camera size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="mt-1 truncate text-xs text-ink-muted">{profile.handle ? `@${profile.handle}` : session.user.email}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-midnight-border" role="progressbar" aria-label={t("welcome.profileProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
              <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-xs text-gold-soft">{t("welcome.stepsCount", { done: completedSteps, total: checklist.length })} · {completion}%</p>
          </div>
        </aside>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-midnight-border pt-4 text-xs text-ink-muted sm:text-sm lg:col-span-2">
          <p>{session.user.email}</p>
          <p>{t("welcome.profileProgress")}</p>
        </div>
      </section>

      <section className="grid gap-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.7fr)] lg:gap-12">
        <section aria-labelledby="welcome-progress-title" className="min-w-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("welcome.nextActionEyebrow")}</p>
            <h2 id="welcome-progress-title" className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{t("welcome.profileProgress")}</h2>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-midnight-border" role="progressbar" aria-label={t("welcome.profileProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-1 flex justify-end">
            <span className="text-xs font-semibold text-gold-soft">{completion}% {t("welcome.completeLabel")}</span>
          </div>

          <ol className="mt-4 grid gap-x-8 sm:grid-cols-2">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key} className="border-t border-midnight-border">
                  <button type="button" onClick={openProfileEditor} className="group flex min-h-[5.5rem] w-full items-center gap-3 py-3 text-left">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.done ? "bg-gold/10 text-gold-soft" : "bg-midnight-card text-ink-muted"}`}>
                      {item.done ? <Check size={17} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{t(`welcome.checklist.${item.key}.title`)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{t(`welcome.checklist.${item.key}.description`)}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${item.done ? "text-gold-soft" : "text-ink-muted group-hover:text-gold-soft"}`}>
                      {item.done ? t("welcome.doneLabel") : t("welcome.completeAction")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={openProfileEditor} className="btn-outline mt-5 min-h-10">
            {t("welcome.editProfileAction")}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        <aside className="space-y-6 border-t border-midnight-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="border-l-2 border-gold pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{t("welcome.nextStepsTitle")}</p>
            {recommendedStep ? (
              <>
                <h3 className="mt-2 text-base font-semibold text-ink">{t(`welcome.checklist.${recommendedStep.key}.title`)}</h3>
                <p className="mt-1 text-sm leading-5 text-ink-muted">{t(`welcome.checklist.${recommendedStep.key}.description`)}</p>
                <button type="button" onClick={openProfileEditor} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-soft transition hover:text-gold">
                  {t("welcome.profileAction")}<ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-2 text-base font-semibold text-ink">{t("welcome.profileCompleteTitle")}</h3>
                <p className="mt-1 text-sm leading-5 text-ink-muted">{t("welcome.profileCompleteDescription")}</p>
              </>
            )}
          </div>

          <div className="border-t border-midnight-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{t("welcome.nextStepsTitle")}</p>
            <Link href="/discover" onClick={clearRegistrationMarker} className="group flex items-start gap-3 border-b border-midnight-border py-4">
              <Compass size={18} className="mt-0.5 shrink-0 text-gold-soft" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t("welcome.discoverAction")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t("welcome.discoverNextStep")}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-ink-muted transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link href="/projects/new" onClick={clearRegistrationMarker} className="group flex items-start gap-3 border-b border-midnight-border py-4">
              <FolderPlus size={18} className="mt-0.5 shrink-0 text-gold-soft" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t("welcome.createProjectAction")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t("welcome.createProjectDescription")}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-ink-muted transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
          <button type="button" onClick={() => { clearRegistrationMarker(); void logout(); }} className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-gold-soft">
            <LogOut size={16} aria-hidden="true" />{t("welcome.logoutAction")}
          </button>
        </aside>
      </section>

      {editingProfile && profileDraft && (
        <dialog
          ref={editorDialog}
          aria-labelledby="welcome-profile-editor-title"
          onClose={closeProfileEditor}
          onCancel={(event) => { event.preventDefault(); closeProfileEditor(); }}
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-midnight-border bg-midnight-card p-0 text-ink shadow-2xl backdrop:bg-black/70"
        >
          <form onSubmit={saveProfile} className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="welcome-profile-editor-title" className="font-display text-xl font-semibold text-ink">{t("welcome.profileEditor.title")}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t("welcome.profileEditor.description")}</p>
              </div>
              <button type="button" onClick={closeProfileEditor} className="btn-ghost !rounded-lg !p-2.5" title={t("welcome.profileEditor.cancel")}>
                <X size={17} aria-hidden="true" /><span className="sr-only">{t("welcome.profileEditor.cancel")}</span>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-b border-midnight-border pb-5">
              <Avatar src={profileDraft.image} name={profileDraft.name ?? t("welcome.maker")} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t("welcome.profileEditor.photo")}</p>
                <button type="button" onClick={openAvatarModal} className="btn-ghost mt-2 !rounded-lg !px-3 !py-2 text-xs">
                  <Camera size={15} aria-hidden="true" />{t("welcome.profileEditor.choosePhoto")}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="welcome-profile-name" className="label">{t("welcome.profileEditor.name")}</label>
                <input id="welcome-profile-name" required minLength={2} maxLength={80} value={profileDraft.name ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} className="input" />
              </div>
              <div>
                <label htmlFor="welcome-profile-handle" className="label">{t("auth.handle")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink-muted">@</span>
                  <input id="welcome-profile-handle" minLength={profileDraft.handle ? 3 : undefined} maxLength={30} value={profileDraft.handle ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, handle: event.target.value.replace(/^@/, "") })} className="input pl-8" />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{t("welcome.profileEditor.handleHint")}</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="welcome-profile-headline" className="label">{t("auth.headline")}</label>
                <input id="welcome-profile-headline" maxLength={120} value={profileDraft.headline ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, headline: event.target.value })} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="welcome-profile-bio" className="label">{t("auth.bio")}</label>
                <textarea id="welcome-profile-bio" rows={4} maxLength={600} value={profileDraft.bio ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} className="input resize-y" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="welcome-profile-skills" className="label">{t("auth.skills")}</label>
                <input id="welcome-profile-skills" value={profileDraft.skills.join(", ")} onChange={(event) => setProfileDraft({ ...profileDraft, skills: event.target.value.split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, 20) })} className="input" placeholder="Next.js, Figma, Product" />
                <p className="mt-1 text-xs text-ink-muted">{t("welcome.profileEditor.skillsHint")}</p>
              </div>
              <div>
                <label htmlFor="welcome-profile-website" className="label">{t("welcome.profileEditor.website")}</label>
                <input id="welcome-profile-website" type="url" value={profileDraft.websiteUrl ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, websiteUrl: event.target.value })} className="input" placeholder="https://" />
              </div>
              <div>
                <label htmlFor="welcome-profile-github" className="label">{t("auth.github")}</label>
                <input id="welcome-profile-github" type="url" value={profileDraft.githubUrl ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, githubUrl: event.target.value })} className="input" placeholder="https://github.com/" />
              </div>
              <div>
                <label htmlFor="welcome-profile-twitter" className="label">{t("auth.twitter")}</label>
                <input id="welcome-profile-twitter" type="url" value={profileDraft.twitterUrl ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, twitterUrl: event.target.value })} className="input" placeholder="https://x.com/" />
              </div>
            </div>

            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border bg-midnight-card py-4">
              {profileMessage && <p role="alert" className="text-sm text-rose-300">{profileMessage}</p>}
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={closeProfileEditor} className="btn-ghost">{t("welcome.profileEditor.cancel")}</button>
                <button type="submit" disabled={savingProfile} className="btn-gold">
                  <Save size={16} aria-hidden="true" />{savingProfile ? t("welcome.profileEditor.saving") : t("welcome.profileEditor.save")}
                </button>
              </div>
            </div>
          </form>
        </dialog>
      )}
      <dialog
        ref={avatarDialog}
        aria-labelledby="welcome-avatar-upload-title"
        onCancel={(event) => {
          event.preventDefault();
          closeAvatarModal();
        }}
        onClose={() => setAvatarModalOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeAvatarModal();
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-midnight-border bg-midnight-card p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-md"
      >
        <section>
          <header className="flex items-start justify-between gap-4 border-b border-midnight-border bg-midnight-deep/35 px-5 py-5 sm:px-7">
            <div>
              <h2 id="welcome-avatar-upload-title" className="text-xl font-semibold tracking-tight text-ink">{t("welcome.profileEditor.avatarModalTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("welcome.profileEditor.avatarModalHint")}</p>
            </div>
            <button type="button" onClick={closeAvatarModal} disabled={avatarUploading} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:border-gold/30 hover:bg-midnight-card hover:text-ink disabled:opacity-50">
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-5 p-5 sm:p-7">
            <div className="flex items-center gap-4 rounded-xl border border-midnight-border bg-midnight-deep/35 p-4">
              <Avatar src={avatarPreview ?? profile?.image} name={profile?.name} size={76} />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">{profile?.name ?? t("welcome.maker")}</p>
                <p className="mt-1 text-sm text-ink-muted">{avatarFile?.name ?? t("welcome.profileEditor.avatarPreviewHint")}</p>
              </div>
            </div>

            <input
              ref={avatarInput}
              type="file"
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              onChange={selectAvatar}
              className="sr-only"
              aria-label={t("welcome.profileEditor.choosePhoto")}
            />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={avatarUploading}
              className="group w-full rounded-xl border border-dashed border-midnight-border bg-midnight-deep/35 px-4 py-4 text-left transition hover:border-gold/50 hover:bg-midnight-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <Camera size={18} className="shrink-0 text-gold-soft" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{avatarFile?.name ?? t("welcome.profileEditor.choosePhoto")}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{t("welcome.profileEditor.avatarFileHint")}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-gold-soft">{avatarFile ? t("welcome.profileEditor.chooseAnotherPhoto") : t("welcome.profileEditor.browsePhotos")}</span>
              </span>
            </button>

            {avatarUploading && (
              <div className="rounded-xl border border-midnight-border bg-midnight-deep/50 p-4" aria-live="polite">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-ink">
                    {t(`welcome.profileEditor.avatar${avatarStage[0].toUpperCase()}${avatarStage.slice(1)}`)}
                  </span>
                  {avatarStage !== "uploading" && <Loader2 size={14} className="animate-spin text-gold-soft" aria-hidden="true" />}
                  <span className="tabular-nums text-gold-soft">{avatarProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("welcome.profileEditor.avatarUploading")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={avatarProgress}
                  className="h-2 overflow-hidden rounded-full bg-midnight-border/70"
                >
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-gold transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${avatarProgress}%` }} />
                </div>
              </div>
            )}

            {avatarError && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{avatarError}</p>}

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-midnight-border pt-4">
              <button type="button" onClick={closeAvatarModal} disabled={avatarUploading} className="btn-ghost !rounded-lg">
                {t("welcome.profileEditor.cancel")}
              </button>
              <button type="button" onClick={() => void uploadSelectedAvatar()} disabled={!avatarFile || avatarUploading} className="btn-gold min-w-36 !rounded-lg disabled:cursor-not-allowed disabled:opacity-50">
                {avatarUploading ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" />{avatarProgress}%</> : <><Camera size={15} aria-hidden="true" />{t("welcome.profileEditor.uploadAvatar")}</>}
              </button>
            </footer>
          </div>
        </section>
      </dialog>
      {logoutOverlay}
    </div>
  );
}