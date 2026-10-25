"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  Camera,
  Check,
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Save,
  Sparkles,
  ShieldCheck,
  Sun,
  Type,
  Trash2,
  UserRound,
  UserRoundPen,
  X,
} from "@/components/FontAwesomeIcons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Avatar } from "@/components/Avatar";
import { uploadAvatarImage } from "@/lib/cloudinary";
import {
  type AppearancePreferences,
  applyAppearancePreferences,
  defaultAppearance,
  readAppearancePreferences,
  saveAppearancePreferences,
} from "@/lib/appearance";
import { useTranslation } from "@/lib/i18n";

type SettingsSection = "account" | "preferences" | "notifications";
type NotificationPreferences = {
  projectUpdates: boolean;
  messages: boolean;
  productNews: boolean;
};

type AccountProfile = {
  name: string;
  email: string;
  image: string | null;
  handle: string | null;
  age: number | null;
  city: string | null;
  phoneNumber: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  openToCoBuild: boolean;
  githubUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
};

const defaultNotifications: NotificationPreferences = {
  projectUpdates: true,
  messages: true,
  productNews: false,
};

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const { data: session, update: updateSession } = useSession();
  const [section, setSection] = useState<SettingsSection>("account");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [deletionCodeSent, setDeletionCodeSent] = useState(false);
  const [deletionCode, setDeletionCode] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionFeedback, setDeletionFeedback] = useState("");
  const [deletionFeedbackError, setDeletionFeedbackError] = useState(false);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [appearance, setAppearance] = useState<AppearancePreferences>(defaultAppearance);
  const [saved, setSaved] = useState(false);
  const isFrench = locale === "fr";
  const avatarInput = useRef<HTMLInputElement>(null);
  const avatarDialog = useRef<HTMLDialogElement>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarProcessing, setAvatarProcessing] = useState(false);

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
    const storedAppearance = readAppearancePreferences();
    setAppearance(storedAppearance);
    applyAppearancePreferences(storedAppearance);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    fetch("/api/account/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("account_settings_load_failed");
        return response.json() as Promise<{ notifications: NotificationPreferences }>;
      })
      .then(({ notifications: savedNotifications }) => {
        if (!cancelled) setNotifications(savedNotifications);
      })
      .catch(() => {
        if (!cancelled) setNotificationError(isFrench ? "Impossible de charger les préférences du compte." : "Couldn't load account preferences.");
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id, isFrench]);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("profile_load_failed");
        return response.json();
      })
      .then(({ profile: savedProfile }: { profile: AccountProfile }) => {
        if (!cancelled) setProfile(savedProfile);
      })
      .catch(() => {
        if (!cancelled) setProfileMessage(isFrench ? "Impossible de charger votre profil." : "Couldn't load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id, isFrench]);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const allowedTypes = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setAvatarError(t("settings.avatarFileError"));
      return;
    }
    setAvatarFile(file);
    setAvatarError("");
  }

  function closeAvatarModal() {
    if (avatarUploading) return;
    setAvatarModalOpen(false);
    setAvatarFile(null);
    setAvatarError("");
  }

  async function uploadSelectedAvatar() {
    if (!avatarFile || !profile) return;
    setAvatarUploading(true);
    setAvatarProgress(0);
    setAvatarProcessing(false);
    setAvatarError("");
    try {
      const image = await uploadAvatarImage(avatarFile, setAvatarProgress, () => setAvatarProcessing(true));
      setProfile((current) => current ? { ...current, image } : current);
      setAvatarFile(null);
      setAvatarModalOpen(false);
      setProfileMessage(t("settings.avatarUpdated"));
      try {
        await updateSession();
      } catch (error) {
        console.error("Profile avatar was saved, but the session refresh failed:", error);
        setProfileMessage(t("settings.avatarUpdatedRefresh"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const separator = message.indexOf(":");
      const code = separator >= 0 ? message.slice(0, separator) : message;
      const details = separator >= 0 ? message.slice(separator + 1).trim() : "";
      setAvatarError(code === "cloudinary_not_configured"
        ? t("settings.avatarServiceUnavailable")
        : code === "cloudinary_temporarily_unavailable"
          ? t("settings.avatarUploadServiceError")
        : code === "profile_update_unavailable"
          ? t("settings.avatarSaveError")
        : code === "upload_session_unavailable" || code === "upload_server_error" || code === "avatar_upload_failed"
          ? t("settings.avatarUploadServerError")
        : code === "cloudinary_unreachable"
          ? t("auth.errors.networkUnavailable")
          : code === "cloudinary_upload_failed" && details
            ? t("settings.avatarUploadErrorDetail", { details })
          : t("settings.avatarUploadError"));
    } finally {
      setAvatarUploading(false);
    }
  }

  function formatAvatarFileSize(bytes: number) {
    const megabytes = bytes / (1024 * 1024);
    return `${megabytes.toLocaleString(locale, { maximumFractionDigits: 1 })} ${isFrench ? "Mo" : "MB"}`;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          image: profile.image ?? "",
          handle: profile.handle ?? "",
          age: profile.age ?? "",
          city: profile.city ?? "",
          phoneNumber: profile.phoneNumber ?? "",
          headline: profile.headline ?? "",
          bio: profile.bio ?? "",
          githubUrl: profile.githubUrl ?? "",
          twitterUrl: profile.twitterUrl ?? "",
          websiteUrl: profile.websiteUrl ?? "",
          location: profile.location ?? "",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setProfileMessage(result.error === "handle_taken"
          ? (isFrench ? "Ce nom d’utilisateur est déjà pris." : "That username is already taken.")
          : (isFrench ? "Vérifiez les champs du profil et réessayez." : "Check your profile details and try again."));
        return;
      }

      setProfile(result.profile);
      await updateSession();
      setProfileMessage(isFrench ? "Profil enregistré." : "Profile saved.");
    } catch (error) {
      setProfileMessage(error instanceof TypeError
        ? t("auth.errors.networkUnavailable")
        : t("auth.errors.serviceUnavailable"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestAccountDeletionCode() {
    setDeletionBusy(true);
    setDeletionFeedback("");
    setDeletionFeedbackError(false);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "send" }),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error === "rate_limited"
          ? (isFrench ? `Patientez ${result.retryAfter} secondes avant de redemander un code.` : `Wait ${result.retryAfter} seconds before requesting another code.`)
          : isFrench ? "Impossible d’envoyer le code de confirmation." : "Couldn't send the confirmation code.";
        throw new Error(message);
      }
      setDeletionCodeSent(true);
      setDeletionFeedback(isFrench ? "Code envoyé à l’adresse email de votre compte." : "A code was sent to your account email.");
    } catch (error) {
      setDeletionFeedback(error instanceof TypeError
        ? t("auth.errors.networkUnavailable")
        : error instanceof Error ? error.message : t("auth.errors.serviceUnavailable"));
      setDeletionFeedbackError(true);
    } finally {
      setDeletionBusy(false);
    }
  }

  async function confirmAccountDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeletionBusy(true);
    setDeletionFeedback("");
    setDeletionFeedbackError(false);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify", code: deletionCode }),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error === "invalid_code"
          ? (isFrench ? "Code invalide ou expiré. Vérifiez votre email et réessayez." : "The code is invalid or expired. Check your email and try again.")
          : result.error === "billing_unavailable" || result.error === "subscription_cancel_failed"
            ? (isFrench ? "L’abonnement n’a pas pu être annulé. Contactez l’assistance avant de supprimer le compte." : "The subscription couldn't be canceled. Contact support before deleting your account.")
            : (isFrench ? "La suppression a échoué. Réessayez." : "Account deletion failed. Try again.");
        throw new Error(message);
      }
      await signOut({ callbackUrl: "/login?accountDeleted=1" });
    } catch (error) {
      setDeletionFeedback(error instanceof TypeError
        ? t("auth.errors.networkUnavailable")
        : error instanceof Error ? error.message : t("auth.errors.serviceUnavailable"));
      setDeletionFeedbackError(true);
    } finally {
      setDeletionBusy(false);
    }
  }

  function updateAppearance(changes: Partial<AppearancePreferences>) {
    const next = { ...appearance, ...changes };
    setAppearance(next);
    saveAppearancePreferences(next);
  }

  async function updateNotification(key: keyof NotificationPreferences) {
    const previous = notifications;
    const next = { ...previous, [key]: !previous[key] };
    setNotifications(next);
    setNotificationsSaving(true);
    setSaved(false);
    setNotificationError("");

    try {
      const response = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error("account_settings_save_failed");
      setNotifications(result.notifications as NotificationPreferences);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setNotifications(previous);
      setNotificationError(t("auth.errors.networkUnavailable"));
    } finally {
      setNotificationsSaving(false);
    }
  }

  const sections: { id: SettingsSection; label: string; description: string; icon: typeof UserRound }[] = [
    { id: "account", label: isFrench ? "Compte" : "Account", description: isFrench ? "Profil et sécurité" : "Profile and security", icon: UserRound },
    { id: "preferences", label: isFrench ? "Préférences" : "Preferences", description: isFrench ? "Langue et apparence" : "Language and appearance", icon: Globe2 },
    { id: "notifications", label: isFrench ? "Notifications" : "Notifications", description: isFrench ? "Alertes du compte" : "Account alerts", icon: Bell },
  ];
  const activeSection = sections.find(({ id }) => id === section) ?? sections[0];
  const notificationGroups = [
    {
      title: isFrench ? "Projets et messages" : "Projects and messages",
      description: isFrench ? "Restez au courant de votre activité avec les makers." : "Stay up to date with activity from other makers.",
      icon: MessageCircle,
      items: [
        { id: "projectUpdates", title: isFrench ? "Activité des projets" : "Project activity", description: isFrench ? "Invitations et actualités de vos projets." : "Invitations and updates from your projects.", icon: BellRing },
        { id: "messages", title: isFrench ? "Nouveaux messages" : "New messages", description: isFrench ? "Lorsqu’un maker vous envoie un message." : "When another maker sends you a message.", icon: Mail },
      ],
    },
    {
      title: isFrench ? "Actualités de la plateforme" : "Platform updates",
      description: isFrench ? "Les informations importantes de LynoraLink." : "Important news from LynoraLink.",
      icon: Sparkles,
      items: [
        { id: "productNews", title: isFrench ? "Nouveautés LynoraLink" : "LynoraLink news", description: isFrench ? "Nouvelles fonctionnalités et annonces." : "New features and product announcements.", icon: Sparkles },
      ],
    },
  ] as const;
  const enabledNotificationCount = Object.values(notifications).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="relative isolate overflow-hidden rounded-2xl border border-midnight-border bg-gradient-to-br from-midnight-card via-midnight-card/90 to-[#102d38]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:p-7 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-px w-2/3 bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("nav.settings")}</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
            {isFrench ? "Compte, préférences et sécurité." : "Account, preferences, and security."}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-midnight-border/80 pt-5 sm:mt-7 sm:pt-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="rounded-full p-0.5 ring-1 ring-gold/30">
              <Avatar src={session?.user?.image} name={session?.user?.name} size={44} />
            </div>
            <div className="min-w-0">
              <p className="max-w-56 truncate text-sm font-semibold text-ink">{session?.user?.name ?? "Maker"}</p>
              <p className="max-w-56 truncate text-xs text-ink-muted">{session?.user?.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-midnight-border bg-midnight-deep/40 px-3 py-2 text-xs font-medium text-ink-muted">
            <ShieldCheck size={14} className="text-emerald-300" aria-hidden="true" />
            {isFrench ? "Compte sécurisé" : "Account protected"}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-5 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-7">
        <nav aria-label={isFrench ? "Sections des paramètres" : "Settings sections"} className="min-w-0 md:sticky md:top-24 md:self-start">
          <p className="mb-3 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted md:block">
            {isFrench ? "Votre compte" : "Your account"}
          </p>
          <div className="flex gap-2 overflow-x-auto rounded-xl border border-midnight-border bg-midnight-card/45 p-2 md:block md:space-y-1.5 md:overflow-visible md:p-2">
          {sections.map(({ id, label, description, icon: Icon }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={`flex min-w-max items-center gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 md:w-full ${
                section === id
                  ? "border-gold/20 bg-gradient-to-r from-gold/[0.12] to-emerald-400/[0.06] text-gold-soft shadow-sm md:shadow-[inset_2px_0_0_#086f58]"
                  : "border-transparent text-ink-muted hover:border-midnight-border/80 hover:bg-midnight-deep/40 hover:text-ink"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${section === id ? "bg-gold/10 text-gold" : "bg-midnight-deep/60 text-ink-muted"}`}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 hidden text-[11px] font-normal leading-relaxed text-ink-muted md:block">{description}</span>
              </span>
              <span className="ml-auto hidden text-[10px] tabular-nums text-ink-muted md:block">0{index + 1}</span>
            </button>
          ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-midnight-border bg-midnight-card/45 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gradient-to-br from-gold/15 to-emerald-400/[0.06] text-gold-soft">
                <activeSection.icon size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-soft/80">{isFrench ? "Paramètres" : "Settings"}</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">{activeSection.label}</h2>
                <p className="mt-1 text-xs text-ink-muted">{activeSection.description}</p>
              </div>
            </div>
            <span className="hidden shrink-0 pt-1 text-xs tabular-nums text-ink-muted sm:block">0{sections.findIndex(({ id }) => id === section) + 1} / 0{sections.length}</span>
          </div>
          {section === "account" && (
            <>
              <form onSubmit={saveProfile} className="mobile-edge-card overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/55 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-midnight-border bg-gradient-to-r from-midnight-card/90 to-midnight-deep/45 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gold/10 p-2 text-gold-soft"><UserRoundPen size={18} /></div>
                    <div>
                      <h2 className="text-sm font-semibold text-ink">{isFrench ? "Profil maker" : "Maker profile"}</h2>
                      <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Ces informations sont visibles par les autres makers." : "This information is visible to other makers."}</p>
                    </div>
                  </div>
                  {profileMessage && <p role="status" className="text-xs text-ink-muted">{profileMessage}</p>}
                </div>

                {loadingProfile || !profile ? (
                  <div className="space-y-4 p-5 sm:p-6" aria-live="polite">
                    <div className="skeleton h-16 w-full" />
                    <div className="skeleton h-11 w-full" />
                    <div className="skeleton h-24 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-4 border-b border-midnight-border bg-midnight-deep/20 p-5 sm:px-6">
                      <Avatar src={profile.image} name={profile.name} size={72} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{isFrench ? "Photo de profil" : "Profile photo"}</p>
                        <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Image carrée, redimensionnée automatiquement." : "Square image, resized automatically."}</p>
                      </div>
                      <button type="button" onClick={() => { setAvatarFile(null); setAvatarError(""); setAvatarModalOpen(true); }} title={t("settings.changeAvatar")} className="btn-ghost !rounded-lg !p-2.5">
                        <Camera size={17} aria-hidden="true" /><span className="sr-only">{isFrench ? "Changer l’avatar" : "Change avatar"}</span>
                      </button>
                    </div>

                    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                      <div>
                        <label htmlFor="account-name" className="label">{isFrench ? "Nom affiché" : "Display name"}</label>
                        <input id="account-name" required minLength={2} maxLength={80} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="input" />
                      </div>
                      <div>
                        <label htmlFor="account-email" className="label">{isFrench ? "Adresse email" : "Email address"}</label>
                        <input id="account-email" value={profile.email} readOnly className="input opacity-70" />
                      </div>
                      <div>
                        <label htmlFor="account-handle" className="label">{isFrench ? "Nom d’utilisateur" : "Username"}</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink-muted">@</span>
                          <input id="account-handle" minLength={profile.handle ? 3 : undefined} maxLength={30} value={profile.handle ?? ""} onChange={(event) => setProfile({ ...profile, handle: event.target.value.replace(/^@/, "") })} className="input pl-8" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="account-age" className="label">{isFrench ? "Âge" : "Age"}</label>
                        <input id="account-age" type="number" min={13} max={120} value={profile.age ?? ""} onChange={(event) => setProfile({ ...profile, age: event.target.value ? Number(event.target.value) : null })} className="input" />
                      </div>
                      <div>
                        <label htmlFor="account-city" className="label">{isFrench ? "Ville" : "City"}</label>
                        <input id="account-city" maxLength={100} value={profile.city ?? ""} onChange={(event) => setProfile({ ...profile, city: event.target.value })} className="input" />
                      </div>
                      <div>
                        <label htmlFor="account-phone" className="label">{isFrench ? "Téléphone" : "Phone"}</label>
                        <input id="account-phone" type="tel" maxLength={30} value={profile.phoneNumber ?? ""} onChange={(event) => setProfile({ ...profile, phoneNumber: event.target.value })} className="input" />
                      </div>
                      <div>
                        <label htmlFor="account-headline" className="label">{isFrench ? "Accroche" : "Headline"}</label>
                        <input id="account-headline" maxLength={120} value={profile.headline ?? ""} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} className="input" placeholder={isFrench ? "Ex. Développeuse full-stack" : "e.g. Full-stack developer"} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="account-bio" className="label">{isFrench ? "Présentation" : "Bio"}</label>
                        <textarea id="account-bio" rows={4} maxLength={600} value={profile.bio ?? ""} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} className="input resize-y" />
                        <p className="mt-1 text-right text-xs text-ink-muted">{profile.bio?.length ?? 0}/600</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="account-skills" className="label">{isFrench ? "Compétences" : "Skills"}</label>
                        <input id="account-skills" value={profile.skills.join(", ")} onChange={(event) => setProfile({ ...profile, skills: event.target.value.split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, 20) })} className="input" placeholder="Next.js, Figma, Product" />
                        <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Séparez les compétences par des virgules." : "Separate skills with commas."}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-midnight-border px-4 py-3.5 transition hover:border-emerald-400/40">
                          <input type="checkbox" checked={profile.openToCoBuild} onChange={(event) => setProfile({ ...profile, openToCoBuild: event.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                          <span>
                            <span className="block text-sm font-medium text-ink">{isFrench ? "Ouvert·e au co-building" : "Open to co-building"}</span>
                            <span className="mt-1 block text-xs text-ink-muted">{isFrench ? "Les makers verront que vous êtes disponible pour collaborer et brainstormer." : "Makers can see you're available to collaborate and brainstorm."}</span>
                          </span>
                        </label>
                      </div>
                      <div>
                        <label htmlFor="account-location" className="label">{isFrench ? "Localisation" : "Location"}</label>
                        <input id="account-location" maxLength={100} value={profile.location ?? ""} onChange={(event) => setProfile({ ...profile, location: event.target.value })} className="input" placeholder={isFrench ? "Ville, pays" : "City, country"} />
                      </div>
                      <div>
                        <label htmlFor="account-website" className="label">{isFrench ? "Site web" : "Website"}</label>
                        <input id="account-website" type="url" value={profile.websiteUrl ?? ""} onChange={(event) => setProfile({ ...profile, websiteUrl: event.target.value })} className="input" placeholder="https://" />
                      </div>
                      <div>
                        <label htmlFor="account-github" className="label">GitHub</label>
                        <input id="account-github" type="url" value={profile.githubUrl ?? ""} onChange={(event) => setProfile({ ...profile, githubUrl: event.target.value })} className="input" placeholder="https://github.com/" />
                      </div>
                      <div>
                        <label htmlFor="account-twitter" className="label">X / Twitter</label>
                        <input id="account-twitter" type="url" value={profile.twitterUrl ?? ""} onChange={(event) => setProfile({ ...profile, twitterUrl: event.target.value })} className="input" placeholder="https://x.com/" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border px-5 py-4 sm:px-6">
                      <p role="status" className="text-xs text-ink-muted">{profileMessage}</p>
                      <button type="submit" disabled={savingProfile} className="btn-gold !rounded-lg">
                        <Save size={16} aria-hidden="true" />
                        {savingProfile ? (isFrench ? "Enregistrement…" : "Saving…") : (isFrench ? "Enregistrer le profil" : "Save profile")}
                      </button>
                    </div>
                  </>
                )}
              </form>

              <section className="mobile-edge-card rounded-2xl border border-midnight-border bg-midnight-card/50 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gold/10 p-2 text-gold-soft"><LockKeyhole size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-ink">{isFrench ? "Sécurité du compte" : "Account security"}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {isFrench ? "Besoin de changer votre mot de passe ?" : "Need to change your password?"}
                    </p>
                  </div>
                  <Link href="/forgot-password" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gold-soft hover:text-gold-bright">
                    {isFrench ? "Réinitialiser" : "Reset"}<ArrowUpRight size={15} />
                  </Link>
                </div>
              </section>

              <section className="mobile-edge-card rounded-2xl border border-emerald-300/15 bg-gradient-to-r from-emerald-300/[0.06] to-midnight-card/55 p-5 shadow-sm sm:p-6" aria-labelledby="two-factor-title">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><ShieldCheck size={18} aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="two-factor-title" className="text-sm font-semibold text-ink">{t("settings.twoFactor.title")}</h2>
                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{t("settings.twoFactor.required")}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t("settings.twoFactor.description")}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.055] to-midnight-card/55 p-5 sm:p-6" aria-labelledby="account-deletion-title">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-rose-500/10 p-2 text-rose-300"><Trash2 size={18} aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 id="account-deletion-title" className="text-sm font-semibold text-rose-200">{isFrench ? "Zone dangereuse" : "Danger zone"}</h2>
                    <p className="mt-2 text-sm font-medium text-ink">{isFrench ? "Supprimer définitivement votre compte" : "Permanently delete your account"}</p>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
                      {isFrench
                        ? "Cette action supprimera votre profil, vos projets créés, vos publications, vos messages et les commandes associées. Cette suppression est irréversible."
                        : "This removes your profile, created projects, posts, messages, and related orders. This cannot be undone."}
                    </p>
                  </div>
                </div>

                {!deletionCodeSent ? (
                  <button type="button" onClick={() => void requestAccountDeletionCode()} disabled={deletionBusy} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-400/40 px-3.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-60">
                    <Trash2 size={15} aria-hidden="true" />
                    {deletionBusy ? (isFrench ? "Envoi du code…" : "Sending code…") : (isFrench ? "Demander un code de confirmation" : "Request confirmation code")}
                  </button>
                ) : (
                  <form onSubmit={confirmAccountDeletion} className="mt-5 space-y-4 border-t border-rose-500/20 pt-4">
                    <p className="text-xs text-ink-muted">
                      {isFrench ? `Un code a été envoyé à ${session?.user?.email ?? "votre adresse email"}.` : `A code was sent to ${session?.user?.email ?? "your account email"}.`}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="account-deletion-code" className="label">{isFrench ? "Code reçu par email" : "Email confirmation code"}</label>
                        <input id="account-deletion-code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={deletionCode} onChange={(event) => setDeletionCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="input text-center font-mono tracking-[0.3em]" placeholder="000000" />
                      </div>
                      <div>
                        <label htmlFor="account-deletion-confirm" className="label">{isFrench ? "Saisissez SUPPRIMER pour confirmer" : "Type DELETE to confirm"}</label>
                        <input id="account-deletion-confirm" required value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} className="input" autoComplete="off" />
                      </div>
                    </div>
                    {deletionFeedback && <p role={deletionFeedbackError ? "alert" : "status"} className={`text-sm ${deletionFeedbackError ? "text-rose-300" : "text-emerald-300"}`}>{deletionFeedback}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={deletionBusy || deletionCode.length !== 6 || deletionConfirmation !== (isFrench ? "SUPPRIMER" : "DELETE")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-3.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                        {deletionBusy ? (isFrench ? "Suppression…" : "Deleting…") : (isFrench ? "Supprimer définitivement" : "Delete account permanently")}
                      </button>
                      <button type="button" onClick={() => { setDeletionCodeSent(false); setDeletionCode(""); setDeletionConfirmation(""); setDeletionFeedback(""); }} disabled={deletionBusy} className="btn-ghost !min-h-10 !rounded-lg">
                        {isFrench ? "Annuler" : "Cancel"}
                      </button>
                      <button type="button" onClick={() => void requestAccountDeletionCode()} disabled={deletionBusy} className="min-h-10 px-2 text-sm font-medium text-ink-muted transition hover:text-ink disabled:opacity-50">
                        {isFrench ? "Renvoyer le code" : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}
                {!deletionCodeSent && deletionFeedback && <p role={deletionFeedbackError ? "alert" : "status"} className={`mt-3 text-sm ${deletionFeedbackError ? "text-rose-300" : "text-emerald-300"}`}>{deletionFeedback}</p>}
              </section>
            </>
          )}

          {section === "preferences" && (
            <section className="mobile-edge-card divide-y divide-midnight-border overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/50 shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-lg bg-gold/10 p-2 text-gold-soft"><Globe2 size={18} /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{isFrench ? "Langue de l’application" : "App language"}</h2>
                    <p className="mt-1 text-xs text-ink-muted">{isFrench ? "Choisissez la langue de l’interface." : "Choose the language used across the app."}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-midnight-border/70 bg-midnight-deep/25 p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{t("language.label")}</p>
                    <p className="mt-1 text-xs text-ink-muted">{locale === "fr" ? "Français" : "English"}</p>
                  </div>
                  <LanguageSwitcher />
                </div>
              </div>
              <div className="flex items-start gap-3 p-5 sm:p-6">
                <Check size={17} className="mt-0.5 text-emerald-300" aria-hidden="true" />
                <p className="text-sm text-ink-muted">
                  {isFrench
                    ? "Votre langue est enregistrée sur votre compte et synchronisée à votre connexion."
                    : "Your language is saved to your account and synced when you sign in."}
                </p>
              </div>
              <div className="space-y-4 bg-midnight-deep/[0.12] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gold/10 p-2 text-gold-soft"><Sun size={18} /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{isFrench ? "Apparence" : "Appearance"}</h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      {isFrench ? "Choisissez le thème de l’application." : "Choose the app color theme."}
                    </p>
                  </div>
                </div>
                <div role="group" aria-label={isFrench ? "Thème" : "Theme"} className="grid grid-cols-3 gap-2">
                  {([
                    { id: "light", label: isFrench ? "Clair" : "Light", icon: Sun },
                    { id: "system", label: isFrench ? "Système" : "System", icon: Monitor },
                    { id: "dark", label: isFrench ? "Sombre" : "Dark", icon: Moon },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={appearance.theme === id}
                      onClick={() => updateAppearance({ theme: id })}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium transition sm:text-sm ${appearance.theme === id ? "border-gold/50 bg-gold/10 text-gold-soft" : "border-midnight-border text-ink-muted hover:text-ink"}`}
                    >
                      <Icon size={16} aria-hidden="true" />{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 bg-midnight-deep/[0.12] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gold/10 p-2 text-gold-soft"><Type size={18} /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{isFrench ? "Taille du texte" : "Text size"}</h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      {isFrench ? "Ajustez la taille du texte dans l’application." : "Adjust text size across the app."}
                    </p>
                  </div>
                </div>
                <div role="group" aria-label={isFrench ? "Taille du texte" : "Text size"} className="grid grid-cols-3 gap-2">
                  {([
                    { id: "small", label: isFrench ? "Petite" : "Small", sample: "A" },
                    { id: "normal", label: isFrench ? "Standard" : "Standard", sample: "A" },
                    { id: "large", label: isFrench ? "Grande" : "Large", sample: "A" },
                  ] as const).map(({ id, label, sample }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={appearance.fontSize === id}
                      onClick={() => updateAppearance({ fontSize: id })}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium transition sm:text-sm ${appearance.fontSize === id ? "border-gold/50 bg-gold/10 text-gold-soft" : "border-midnight-border text-ink-muted hover:text-ink"}`}
                    >
                      <span aria-hidden="true" className={id === "small" ? "text-xs" : id === "large" ? "text-lg" : "text-sm"}>{sample}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === "notifications" && (
            <section className="mobile-edge-card overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/55 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-5 border-b border-midnight-border bg-gradient-to-r from-midnight-card/90 to-midnight-deep/45 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gold/10 p-2.5 text-gold-soft"><BellRing size={19} aria-hidden="true" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-ink">{isFrench ? "Notifications" : "Notifications"}</h2>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
                      {isFrench ? "Choisissez les mises à jour qui comptent pour vous." : "Choose the updates that matter to you."}
                    </p>
                  </div>
                </div>
                <div className="min-w-36 sm:w-44">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-ink">{isFrench ? "Activées" : "Enabled"}</span>
                    <span className="tabular-nums text-ink-muted">{notificationsLoading ? "— / 3" : `${enabledNotificationCount} / 3`}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={isFrench ? "Notifications activées" : "Notifications enabled"}
                    aria-valuemin={0}
                    aria-valuemax={3}
                    aria-valuenow={notificationsLoading ? undefined : enabledNotificationCount}
                    aria-busy={notificationsLoading}
                    className="h-1.5 overflow-hidden rounded-full bg-midnight-border"
                  >
                    <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${(enabledNotificationCount / 3) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-7 p-5 sm:p-6">
                {notificationGroups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <section key={group.title} aria-label={group.title}>
                      <div className="mb-3 flex items-start gap-2.5">
                        <GroupIcon size={16} className="mt-0.5 shrink-0 text-gold-soft" aria-hidden="true" />
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">{group.title}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{group.description}</p>
                        </div>
                      </div>
                      <div className="divide-y divide-midnight-border">
                        {group.items.map(({ id, title, description, icon: Icon }) => (
                          <div key={id} className="flex items-center gap-3.5 p-4 sm:gap-4 sm:px-5">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-midnight-deep/60 text-ink-muted">
                              <Icon size={17} aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink">{title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2.5">
                              <span className={`hidden text-xs sm:inline ${notifications[id] ? "text-emerald-300" : "text-ink-muted"}`}>
                                {notifications[id] ? (isFrench ? "Activée" : "On") : (isFrench ? "Désactivée" : "Off")}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={notifications[id]}
                                aria-label={title}
                                disabled={notificationsLoading || notificationsSaving}
                                onClick={() => void updateNotification(id)}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-card disabled:cursor-wait disabled:opacity-60 ${notifications[id] ? "bg-gold" : "bg-midnight-border"}`}
                              >
                                <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifications[id] ? "translate-x-5" : "translate-x-0"}`} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div aria-live="polite" className="flex min-h-12 items-center gap-2 border-t border-midnight-border bg-midnight-deep/30 px-5 text-xs text-ink-muted sm:px-6">
                <Check size={14} className={notificationError ? "text-rose-300" : saved ? "text-emerald-300" : "text-ink-muted"} aria-hidden="true" />
                {notificationError || (notificationsLoading
                  ? (isFrench ? "Chargement des préférences du compte…" : "Loading account preferences…")
                  : notificationsSaving
                    ? (isFrench ? "Enregistrement…" : "Saving…")
                    : saved
                      ? (isFrench ? "Préférences enregistrées sur votre compte" : "Preferences saved to your account")
                      : (isFrench ? "Enregistrement automatique sur votre compte" : "Automatically saved to your account"))}
              </div>
            </section>
          )}
        </div>
      </div>

      <dialog
        ref={avatarDialog}
        aria-labelledby="avatar-upload-title"
        onCancel={(event) => {
          event.preventDefault();
          closeAvatarModal();
        }}
        onClose={() => setAvatarModalOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeAvatarModal();
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-midnight-border bg-midnight-card/90 p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-md"
      >
        <section className="overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-midnight-border bg-midnight-deep/35 px-5 py-5 sm:px-7">
            <div>
              <h2 id="avatar-upload-title" className="text-xl font-semibold tracking-tight text-ink">{t("settings.avatarModalTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("settings.avatarModalHint")}</p>
            </div>
            <button type="button" onClick={closeAvatarModal} disabled={avatarUploading} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:border-gold/30 hover:bg-midnight-card hover:text-ink disabled:opacity-50">
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-5 p-5 sm:p-7">
            <section aria-label={t("settings.makerIdentity")} className="relative overflow-hidden rounded-xl border border-midnight-border/70 bg-gradient-to-br from-midnight-deep/45 via-midnight-card/55 to-[#102d38]/45 p-4 shadow-inner backdrop-blur-sm sm:p-5">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(8,111,88,0.16),transparent_48%)]" />
              <div className="relative flex items-center gap-4">
                <Avatar src={avatarPreview ?? profile?.image} name={profile?.name} size={76} className="rounded-full bg-midnight-deep ring-2 ring-gold/35 shadow-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{profile?.name ?? t("common.maker")}</p>
                  {profile?.handle && <p className="mt-0.5 truncate text-xs text-emerald-200/80">@{profile.handle}</p>}
                  {profile?.headline && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{profile.headline}</p>}
                  {profile?.openToCoBuild && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                      {t("makers.brainstormAvailability")}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold text-ink">{t("settings.chooseAvatar")}</p>
                <span className="text-[10px] text-ink-muted">{t("settings.avatarFileTypes")}</span>
              </div>
              <input ref={avatarInput} type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={selectAvatar} className="sr-only" aria-label={t("settings.chooseAvatar")} />
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={avatarUploading}
                className="group w-full rounded-xl border border-dashed border-midnight-border bg-midnight-deep/35 px-4 py-4 text-left transition hover:border-gold/50 hover:bg-midnight-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <Camera size={17} className="shrink-0 text-gold-soft transition group-hover:text-gold" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink">{avatarFile ? avatarFile.name : t("settings.noAvatarSelected")}</span>
                    {avatarFile && <span className="mt-1 block text-[10px] text-ink-muted">{formatAvatarFileSize(avatarFile.size)}</span>}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-gold-soft">{avatarFile ? t("settings.chooseAnotherAvatar") : t("settings.browseAvatarFiles")}</span>
                </span>
              </button>
            </div>

            {avatarUploading && (
              <div className="rounded-xl border border-midnight-border bg-midnight-deep/50 p-4" aria-live="polite">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-ink">
                    {avatarProcessing ? (isFrench ? "Finalisation de l’image…" : "Finishing image…") : t("settings.avatarUploading")}
                  </span>
                  {avatarProcessing && <Loader2 size={14} className="animate-spin text-gold-soft" aria-hidden="true" />}
                  <span className="tabular-nums text-gold-soft">{avatarProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("settings.avatarUploading")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={avatarProgress}
                  className="h-2 overflow-hidden rounded-full bg-midnight-border/70"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-gold transition-[width] duration-200 ease-out motion-reduce:transition-none"
                    style={{ width: `${avatarProgress}%` }}
                  />
                </div>
              </div>
            )}

            {avatarError && <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{avatarError}</p>}
            <p className="text-xs text-ink-muted">{t("settings.avatarAppliedHint")}</p>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-midnight-border pt-4">
              {profile?.image && (
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => {
                    setProfile((current) => current ? { ...current, image: null } : current);
                    setAvatarFile(null);
                    setAvatarModalOpen(false);
                    setProfileMessage(t("settings.avatarReadyToSave"));
                  }}
                  className="btn-ghost mr-auto !rounded-lg text-rose-200 hover:text-rose-100"
                >
                  <X size={15} aria-hidden="true" />{t("settings.removeAvatar")}
                </button>
              )}
              <button type="button" onClick={closeAvatarModal} disabled={avatarUploading} className="btn-ghost !rounded-lg">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={() => void uploadSelectedAvatar()} disabled={!avatarFile || avatarUploading} className="btn-gold min-w-36 !rounded-lg disabled:cursor-not-allowed disabled:opacity-50">
                {avatarUploading ? `${avatarProgress}%` : t("settings.uploadAvatar")}
              </button>
            </footer>
          </div>
        </section>
      </dialog>
    </div>
  );
}
