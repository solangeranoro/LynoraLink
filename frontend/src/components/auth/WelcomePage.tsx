"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Camera, Check, Compass, FolderPlus, Image, Link2, LogOut, Save, Sparkles, UserRound, Wrench, X } from "@/components/FontAwesomeIcons";
import { Avatar } from "@/components/Avatar";
import { HeroImageSlider } from "@/components/HeroImageSlider";
import { useLogoutTransition } from "@/components/auth/LogoutTransition";
import { uploadAvatarImage } from "@/lib/cloudinary";
import { useTranslation } from "@/lib/i18n";

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
  const editorDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = editorDialog.current;
    if (editingProfile && dialog && !dialog.open) dialog.showModal();
  }, [editingProfile]);

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

  async function changeProfileImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !profileDraft) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setAvatarError(t("welcome.profileEditor.invalidImage"));
      return;
    }

    try {
      const image = await uploadAvatarImage(file);
      setProfileDraft((current) => current ? { ...current, image } : current);
      setAvatarError("");
    } catch (error) {
      const failure = error instanceof Error ? error.message : "";
      const uploadDetail = failure.match(/^cloudinary_upload_failed:\s*(.+)$/)?.[1];
      setAvatarError(failure === "cloudinary_not_configured"
        ? t("welcome.profileEditor.configurationError")
        : failure === "cloudinary_temporarily_unavailable" || failure === "cloudinary_unreachable"
          ? t("welcome.profileEditor.serviceError")
        : failure.startsWith("upload_server_error") || failure === "upload_session_unavailable" || failure === "avatar_upload_failed"
          ? t("welcome.profileEditor.serverError")
        : failure === "invalid_avatar_file"
          ? t("welcome.profileEditor.invalidImage")
          : uploadDetail?.slice(0, 180) || t("welcome.profileEditor.uploadError"));
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
    return <div className="skeleton mx-auto h-72 w-full max-w-md" aria-busy="true" />;
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
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]" aria-busy="true" aria-label={t("welcome.loadingProfile")}>
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    );
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
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <section className="relative isolate overflow-hidden bg-[#081827] text-white">
        <HeroImageSlider variant="welcome" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#061321]/70" />
        <div className="mx-auto flex min-h-[31rem] max-w-7xl flex-col justify-between px-5 pb-6 pt-10 sm:min-h-[34rem] sm:px-8 sm:pb-8 lg:px-12">
          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
            <div className="max-w-3xl">
              <p className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#69dfcf] sm:text-xs">
                <span className="h-px w-8 bg-[#69dfcf]" />{t("welcome.eyebrow")}
              </p>
              <h1 className="font-display text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl">{title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                {profile.headline?.trim() || t("welcome.subtitle")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {completion < 100 ? (
                  <button type="button" onClick={openProfileEditor} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#22b8a0] px-5 text-sm font-semibold text-[#071827] transition hover:bg-[#43c8d0]">
                    {t("welcome.profileAction")}<ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <Link href="/profile" onClick={clearRegistrationMarker} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#22b8a0] px-5 text-sm font-semibold text-[#071827] transition hover:bg-[#43c8d0]">
                    {t("welcome.viewProfileAction")}<ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
                <Link href="/dashboard" onClick={clearRegistrationMarker} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/40 px-5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">
                  {t("welcome.dashboardAction")}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-5 text-white lg:justify-self-end">
              <Avatar src={profile.image} name={displayName} size={64} />
              <div
                className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-1 sm:h-32 sm:w-32"
                style={{ background: `conic-gradient(from -90deg, #43c8d0 ${completion}%, rgb(255 255 255 / 0.24) ${completion}% 100%)` }}
                role="img"
                aria-label={`${completion}% ${t("welcome.completeLabel")}`}
              >
                <span className="grid h-full w-full place-items-center rounded-full bg-[#061321]/90 text-center">
                  <span><span className="block font-display text-3xl font-semibold">{completion}%</span><span className="mt-1 block text-[11px] text-white/70">{t("welcome.completeLabel")}</span></span>
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="mt-1 truncate text-xs text-white/70">{profile.handle ? `@${profile.handle}` : session.user.email}</p>
                <p className="mt-3 text-xs text-[#69dfcf]">{t("welcome.stepsCount", { done: completedSteps, total: checklist.length })}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/25 pt-4 text-xs text-white/75 sm:text-sm">
            <p>{session.user.email}</p>
            <p>{t("welcome.profileProgress")}</p>
          </div>
        </div>
      </section>

      <section className="bg-[#edf5f6] text-[#14273a]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.75fr)] lg:gap-12">
        <section aria-labelledby="welcome-progress-title" className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#087d82]">{t("welcome.nextActionEyebrow")}</p>
              <h2 id="welcome-progress-title" className="mt-2 font-display text-2xl font-semibold text-[#14273a] sm:text-3xl">{t("welcome.profileProgress")}</h2>
            </div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#c4d6df]" role="progressbar" aria-label={t("welcome.profileProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
            <div className="h-full rounded-full bg-[#087d82] transition-[width] duration-500" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-1 flex justify-end">
            <span className="text-xs font-semibold text-[#087d82]">{completion}% {t("welcome.completeLabel")}</span>
          </div>

          <ol className="mt-5 grid gap-x-8 sm:grid-cols-2">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key} className="border-t border-[#c4d6df]">
                  <button type="button" onClick={openProfileEditor} className="group flex min-h-[5.5rem] w-full items-center gap-3 py-3 text-left">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.done ? "bg-[#dcf2ed] text-[#087d82]" : "bg-white text-[#367586]"}`}>
                      {item.done ? <Check size={17} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#14273a]">{t(`welcome.checklist.${item.key}.title`)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#526779]">{t(`welcome.checklist.${item.key}.description`)}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${item.done ? "text-[#087d82]" : "text-[#367586] group-hover:text-[#065d62]"}`}>
                      {item.done ? t("welcome.doneLabel") : t("welcome.completeAction")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={openProfileEditor} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#087d82] px-4 text-sm font-semibold text-[#087d82] transition hover:bg-[#e2f3f1]">
            {t("welcome.editProfileAction")}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        <aside className="border-t border-[#c4d6df] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="border-l-2 border-[#087d82] pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#087d82]">{t("welcome.nextStepsTitle")}</p>
            {recommendedStep ? (
              <>
                <h3 className="mt-2 text-base font-semibold text-[#14273a]">{t(`welcome.checklist.${recommendedStep.key}.title`)}</h3>
                <p className="mt-1 text-sm leading-5 text-[#526779]">{t(`welcome.checklist.${recommendedStep.key}.description`)}</p>
                <button type="button" onClick={openProfileEditor} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#087d82] transition hover:text-[#065d62]">
                  {t("welcome.profileAction")}<ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-2 text-base font-semibold text-[#14273a]">{t("welcome.profileCompleteTitle")}</h3>
                <p className="mt-1 text-sm leading-5 text-[#526779]">{t("welcome.profileCompleteDescription")}</p>
              </>
            )}
          </div>

          <div className="mt-7 border-t border-[#c4d6df] pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#526779]">{t("welcome.nextStepsTitle")}</p>
            <Link href="/discover" onClick={clearRegistrationMarker} className="group flex items-start gap-3 border-b border-[#c4d6df] py-4">
              <Compass size={18} className="mt-0.5 shrink-0 text-[#087d82]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#14273a]">{t("welcome.discoverAction")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[#526779]">{t("welcome.discoverNextStep")}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-[#526779] transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link href="/projects/new" onClick={clearRegistrationMarker} className="group flex items-start gap-3 border-b border-[#c4d6df] py-4">
              <FolderPlus size={18} className="mt-0.5 shrink-0 text-[#087d82]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#14273a]">{t("welcome.createProjectAction")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[#526779]">{t("welcome.createProjectDescription")}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-[#526779] transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
          <button type="button" onClick={() => { clearRegistrationMarker(); void logout(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#286579] transition hover:text-[#087d82]">
            <LogOut size={16} aria-hidden="true" />{t("welcome.logoutAction")}
          </button>
        </aside>
          </div>
        </div>
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
                <input type="file" accept="image/*" onChange={changeProfileImage} className="sr-only" id="welcome-profile-photo" />
                <label htmlFor="welcome-profile-photo" className="btn-ghost mt-2 inline-flex cursor-pointer !rounded-lg !px-3 !py-2 text-xs">
                  <Camera size={15} aria-hidden="true" />{t("welcome.profileEditor.choosePhoto")}
                </label>
                {avatarError && <p role="alert" className="mt-2 text-xs text-rose-300">{avatarError}</p>}
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
      {logoutOverlay}
    </div>
  );
}