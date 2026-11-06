"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, BellRing, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useActionToast } from "@/components/ActionToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TesterPlatformSelect } from "@/components/TesterPlatformSelect";
import { ApplicationOwnerContactFields } from "@/components/ApplicationOwnerContactFields";
import { ApplicationRoleSelect } from "@/components/ApplicationRoleSelect";
import en from "@/../messages/en.json";
import fr from "@/../messages/fr.json";

type ManageApplication = {
  id: string;
  name: string;
  description: string;
  problem: string | null;
  testInstructions: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  platform: string;
  createdDate: string | null;
  websiteUrl: string | null;
  downloadUrl: string;
  technologies: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerTitle: string;
  ownerCity: string;
  ownerCountry: string;
  ownerPhone: string | null;
  ownerAddress: string;
  bugReportNotificationsEnabled: boolean;
};
type ScreenshotDraft = { url: string; file?: File; previewUrl?: string };
type MediaUploadResponse = { image?: string; error?: string };
type ManagedPoll = {
  id: string;
  title: string | null;
  options: string[];
  voteCounts: Record<string, number>;
  totalVotes: number;
};
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 20 * 1024 * 1024;
const maxScreenshots = 6;
const maxPollOptions = 6;
const ownerRoleOptions = ["FOUNDER", "CO_BUILDER", "PRODUCT", "DEVELOPER", "DESIGNER", "MARKETER"] as const;

async function uploadApplicationImage(file: File, purpose: "logo" | "screenshot", errorMessage: string) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);
  const response = await fetch("/api/tester-applications/media", { method: "POST", body: formData });
  const result = await response.json().catch(() => null) as MediaUploadResponse | null;
  if (!response.ok || !result?.image) throw new Error(errorMessage);
  return result.image;
}

function ManagementLoadingSkeleton() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 xl:px-8" aria-busy="true">
      <div className="skeleton h-5 w-44" aria-hidden="true" />

      <header className="card space-y-3 border-gold/20 bg-gradient-to-br from-gold/[0.08] via-midnight-card/80 to-emerald-300/[0.04] p-6 sm:p-8" aria-hidden="true">
        <div className="skeleton h-3 w-48" />
        <div className="skeleton h-8 w-64 max-w-full" />
        <div className="skeleton h-4 w-full max-w-3xl" />
        <div className="skeleton h-4 w-36" />
      </header>

      <section className="card space-y-5 p-5 sm:p-6" aria-hidden="true">
        <div className="space-y-2">
          <div className="skeleton h-5 w-52" />
          <div className="skeleton h-3 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><div className="skeleton h-4 w-28" /><div className="skeleton h-12 w-full" /></div>
          <div className="space-y-2"><div className="skeleton h-4 w-24" /><div className="skeleton h-12 w-full" /></div>
          <div className="space-y-2 sm:col-span-2"><div className="skeleton h-4 w-36" /><div className="skeleton h-24 w-full" /></div>
          <div className="space-y-2 sm:col-span-2"><div className="skeleton h-4 w-32" /><div className="skeleton h-20 w-full" /></div>
          <div className="space-y-2 sm:col-span-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-24 w-full" /></div>
          <div className="space-y-3">
            <div className="skeleton h-4 w-16" />
            <div className="flex items-center gap-4">
              <div className="skeleton h-20 w-20 shrink-0 rounded-2xl" />
              <div className="skeleton h-10 w-32" />
            </div>
          </div>
          <div className="space-y-2"><div className="skeleton h-4 w-28" /><div className="skeleton h-12 w-full" /></div>
          <div className="space-y-3 sm:col-span-2">
            <div className="flex justify-between gap-4"><div className="skeleton h-4 w-28" /><div className="skeleton h-3 w-32" /></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="skeleton aspect-video w-full rounded-xl" />)}
            </div>
            <div className="skeleton h-10 w-40" />
          </div>
          <div className="space-y-2"><div className="skeleton h-4 w-28" /><div className="skeleton h-12 w-full" /></div>
          <div className="space-y-2"><div className="skeleton h-4 w-28" /><div className="skeleton h-12 w-full" /></div>
          <div className="space-y-2 sm:col-span-2"><div className="skeleton h-4 w-32" /><div className="skeleton h-12 w-full" /></div>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6" aria-hidden="true">
        <div className="space-y-2">
          <div className="skeleton h-5 w-44" />
          <div className="skeleton h-3 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="space-y-2">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-12 w-full" />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2"><div className="skeleton h-4 w-32" /><div className="skeleton h-20 w-full" /></div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div className="skeleton h-3 w-64 max-w-full" />
        <div className="skeleton h-11 w-44" />
      </div>

      <section className="card space-y-5 p-5 sm:p-6" aria-hidden="true">
        <div className="space-y-2"><div className="skeleton h-5 w-48" /><div className="skeleton h-4 w-full max-w-2xl" /></div>
        <div className="space-y-3 rounded-2xl border border-midnight-border p-4">
          <div className="skeleton h-4 w-32" /><div className="skeleton h-11 w-full" />
          <div className="skeleton h-4 w-28" /><div className="skeleton h-11 w-full" /><div className="skeleton h-11 w-full" />
          <div className="skeleton h-10 w-40" />
        </div>
        <div className="skeleton h-28 w-full" />
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-hidden="true">
        <div className="flex items-start gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="space-y-2"><div className="skeleton h-5 w-48" /><div className="skeleton h-4 w-80 max-w-full" /></div>
        </div>
        <div className="skeleton h-6 w-40" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.04] p-5 sm:p-6" aria-hidden="true">
        <div className="space-y-2"><div className="skeleton h-5 w-40" /><div className="skeleton h-4 w-72 max-w-full" /></div>
        <div className="skeleton h-10 w-44" />
      </section>
    </main>
  );
}

export default function TesterApplicationManagementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { showToast } = useActionToast();
  const formRef = useRef<HTMLFormElement>(null);
  const initializedMedia = useRef(false);
  const objectUrls = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [ownerRole, setOwnerRole] = useState<(typeof ownerRoleOptions)[number] | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotDraft[]>([]);
  const [pollTitle, setPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [savingPoll, setSavingPoll] = useState(false);
  const [pollError, setPollError] = useState("");
  const [pollSuccess, setPollSuccess] = useState("");
  const [pollToDelete, setPollToDelete] = useState<ManagedPoll | null>(null);
  const [deletingPoll, setDeletingPoll] = useState(false);

  const managementQuery = useQuery({
    queryKey: ["tester-application-management", id],
    queryFn: async () => {
      const response = await fetch(`/api/tester-applications/${id}/manage`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404
        ? t("testerApplications.detail.inaccessible")
        : t("testerApplications.detail.manageLoadError"));
      return (await response.json() as { application: ManageApplication }).application;
    },
  });

  const pollsQuery = useQuery({
    queryKey: ["tester-application-management-polls", id],
    enabled: Boolean(managementQuery.data),
    queryFn: async () => {
      const response = await fetch(`/api/tester-applications/${id}/manage/polls`, { cache: "no-store" });
      if (!response.ok) throw new Error(t("testerApplications.detail.pollLoadError"));
      return (await response.json() as { polls: ManagedPoll[] }).polls;
    },
  });

  useEffect(() => {
    const application = managementQuery.data;
    if (!application || initializedMedia.current) return;
    initializedMedia.current = true;
    setLogoUrl(application.logoUrl ?? "");
    setScreenshots(application.screenshotUrls.map((url) => ({ url })));
  }, [managementQuery.data]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function createPreview(file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    return url;
  }

  function releasePreview(url: string | undefined) {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxImageBytes) {
      setError(t("testerApplications.form.uploadError"));
      return;
    }
    releasePreview(logoPreviewUrl);
    setLogoFile(file);
    setLogoPreviewUrl(createPreview(file));
    setError("");
  }

  function selectScreenshots(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (screenshots.length + files.length > maxScreenshots) {
      setError(t("testerApplications.detail.screenshotLimit", { count: maxScreenshots }));
      return;
    }
    if (files.some((file) => !allowedImageTypes.has(file.type) || file.size === 0 || file.size > maxImageBytes)) {
      setError(t("testerApplications.form.uploadError"));
      return;
    }
    const addedScreenshots = files.map((file) => ({ url: "", file, previewUrl: createPreview(file) }));
    setScreenshots((current) => [
      ...current,
      ...addedScreenshots,
    ]);
    setError("");
  }

  function removeScreenshot(index: number) {
    setScreenshots((current) => {
      const screenshot = current[index];
      releasePreview(screenshot?.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form || !managementQuery.data) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const values = new FormData(form);
    try {
      const uploadedLogoUrl = logoFile
        ? await uploadApplicationImage(logoFile, "logo", t("testerApplications.form.uploadError"))
        : logoUrl;
      const screenshotUrls = await Promise.all(screenshots.map((screenshot) => screenshot.file
        ? uploadApplicationImage(screenshot.file, "screenshot", t("testerApplications.form.uploadError"))
        : Promise.resolve(screenshot.url)));
      const response = await fetch(`/api/tester-applications/${id}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          description: values.get("description"),
          problem: values.get("problem"),
          testInstructions: values.get("testInstructions"),
          logoUrl: uploadedLogoUrl,
          screenshotUrls,
          platform: values.get("platform"),
          createdDate: values.get("createdDate"),
          websiteUrl: values.get("websiteUrl"),
          downloadUrl: values.get("downloadUrl"),
          technologies: values.get("technologies"),
          ownerName: values.get("ownerName"),
          ownerEmail: values.get("ownerEmail"),
          ownerTitle: values.get("ownerTitle"),
          ownerCity: values.get("ownerCity"),
          ownerCountry: values.get("ownerCountry"),
          ownerPhone: values.get("ownerPhone"),
          ownerAddress: values.get("ownerAddress"),
        }),
      });
      if (!response.ok) throw new Error(t("testerApplications.detail.manageSaveError"));
      releasePreview(logoPreviewUrl);
      screenshots.forEach((screenshot) => releasePreview(screenshot.previewUrl));
      setLogoUrl(uploadedLogoUrl);
      setLogoFile(null);
      setLogoPreviewUrl("");
      setScreenshots(screenshotUrls.map((url) => ({ url })));
      const savedMessage = t("testerApplications.detail.manageSaved");
      setSuccess(savedMessage);
      showToast(savedMessage);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tester-application", id] }),
        queryClient.invalidateQueries({ queryKey: ["tester-application-management", id] }),
        queryClient.invalidateQueries({ queryKey: ["tester-applications"] }),
      ]);
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : t("testerApplications.detail.manageSaveError");
      setError(errorMessage);
      showToast(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function updateBugReportNotifications(enabled: boolean) {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch(`/api/tester-applications/${id}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bugReportNotificationsEnabled: enabled }),
      });
      if (!response.ok) throw new Error(t("testerApplications.detail.manageSaveError"));
      await queryClient.invalidateQueries({ queryKey: ["tester-application-management", id] });
      setSuccess(t("testerApplications.detail.manageSaved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("testerApplications.detail.manageSaveError"));
    } finally {
      setSaving(false);
    }
  }

  function resetPollForm() {
    setPollTitle("");
    setPollOptions(["", ""]);
    setEditingPollId(null);
  }

  function editPoll(poll: ManagedPoll) {
    setPollTitle(poll.title ?? "");
    setPollOptions(poll.options);
    setEditingPollId(poll.id);
    setPollError("");
    setPollSuccess("");
  }

  async function savePoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      setPollError(t("testerApplications.detail.pollNeedsOptions"));
      return;
    }
    if (new Set(options).size !== options.length) {
      setPollError(t("testerApplications.detail.duplicatePollOptions"));
      return;
    }

    setSavingPoll(true);
    setPollError("");
    setPollSuccess("");
    try {
      const response = await fetch(`/api/tester-applications/${id}/manage/polls${editingPollId ? `/${editingPollId}` : ""}`, {
        method: editingPollId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pollTitle, options }),
      });
      if (!response.ok) throw new Error(t("testerApplications.detail.pollSaveError"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tester-application-management-polls", id] }),
        queryClient.invalidateQueries({ queryKey: ["tester-application-interactions", id] }),
      ]);
      resetPollForm();
      setPollSuccess(t("testerApplications.detail.pollSaved"));
    } catch (saveError) {
      setPollError(saveError instanceof Error ? saveError.message : t("testerApplications.detail.pollSaveError"));
    } finally {
      setSavingPoll(false);
    }
  }

  async function deletePoll() {
    if (!pollToDelete) return;
    setDeletingPoll(true);
    setPollError("");
    try {
      const response = await fetch(`/api/tester-applications/${id}/manage/polls/${pollToDelete.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(t("testerApplications.detail.pollDeleteError"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tester-application-management-polls", id] }),
        queryClient.invalidateQueries({ queryKey: ["tester-application-interactions", id] }),
      ]);
      if (editingPollId === pollToDelete.id) resetPollForm();
      setPollToDelete(null);
      setPollSuccess(t("testerApplications.detail.pollDeleted"));
    } catch (deleteError) {
      setPollError(deleteError instanceof Error ? deleteError.message : t("testerApplications.detail.pollDeleteError"));
      setPollToDelete(null);
    } finally {
      setDeletingPoll(false);
    }
  }

  async function deleteApplication() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/tester-applications/${id}/manage`, { method: "DELETE" });
      if (!response.ok) throw new Error(t("testerApplications.detail.deleteError"));
      await queryClient.invalidateQueries({ queryKey: ["tester-applications"] });
      setDeleteDialogOpen(false);
      router.push("/tester-applications");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("testerApplications.detail.deleteError"));
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (managementQuery.isLoading) {
    return <ManagementLoadingSkeleton />;
  }

  if (managementQuery.isError || !managementQuery.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
        <Link href={`/tester-applications/${id}`} className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={16} />{t("testerApplications.detail.backToApplication")}</Link>
        <div role="alert" className="card p-6 text-sm text-rose-200">{managementQuery.error instanceof Error ? managementQuery.error.message : t("testerApplications.detail.manageLoadError")}</div>
      </main>
    );
  }

  const application = managementQuery.data;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 xl:px-8">
      <Link href={`/tester-applications/${id}`} className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={16} />{t("testerApplications.detail.backToApplication")}</Link>
      <header className="card border-gold/20 bg-gradient-to-br from-gold/[0.08] via-midnight-card/80 to-emerald-300/[0.04] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-soft">{t("testerApplications.detail.ownerTools")}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{t("testerApplications.detail.manageSpace")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{t("testerApplications.detail.manageDescription")}</p>
        <p className="mt-4 text-sm font-medium text-ink">{application.name}</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{success}</p>}

      <form ref={formRef} onSubmit={saveApplication} className="space-y-5">
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-ink">{t("testerApplications.detail.productInformation")}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.detail.productInformationHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.name")}</span><input name="name" required minLength={2} maxLength={100} defaultValue={application.name} className="input w-full" /></label>
            <TesterPlatformSelect
              id="tester-application-platform"
              name="platform"
              label={t("testerApplications.form.platform")}
              defaultValue={application.platform}
            />
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.description")}</span><textarea name="description" required minLength={20} maxLength={5000} rows={4} defaultValue={application.description} className="input w-full" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.problem")}</span><textarea name="problem" maxLength={2000} rows={3} defaultValue={application.problem ?? ""} className="input w-full" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.testInstructions")}</span><textarea name="testInstructions" required minLength={20} maxLength={3000} rows={4} defaultValue={application.testInstructions} className="input w-full" /></label>
            <div className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.logo")}</span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-midnight-border bg-midnight-deep">
                  {logoPreviewUrl || logoUrl
                    ? <Image src={logoPreviewUrl || logoUrl} alt={t("testerApplications.form.logo")} fill unoptimized sizes="80px" className="object-contain p-2" />
                    : <ImagePlus size={24} className="text-ink-muted" aria-hidden="true" />}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input id="application-logo-upload" type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={selectLogo} disabled={saving} className="sr-only" />
                  <label htmlFor="application-logo-upload" className="btn-ghost cursor-pointer">{logoUrl || logoFile ? t("testerApplications.detail.replaceLogo") : t("testerApplications.detail.uploadLogo")}</label>
                  {(logoUrl || logoFile) && <button type="button" disabled={saving} onClick={() => { releasePreview(logoPreviewUrl); setLogoPreviewUrl(""); setLogoFile(null); setLogoUrl(""); }} className="btn-ghost text-rose-200"><X size={15} />{t("testerApplications.detail.removeLogo")}</button>}
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-muted">{t("testerApplications.detail.imageUploadHint")}</p>
            </div>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.createdDate")}</span><input name="createdDate" type="date" defaultValue={application.createdDate?.slice(0, 10) ?? ""} className="input w-full" /></label>
            <div className="block sm:col-span-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{t("testerApplications.form.screenshots")} <span className="text-ink-muted">({screenshots.length}/{maxScreenshots})</span></span>
                <span className="text-xs text-ink-muted">{t("testerApplications.detail.imageUploadHint")}</span>
              </div>
              {screenshots.length > 0 && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((screenshot, index) => (
                    <figure key={`${screenshot.url || screenshot.file?.name}-${index}`} className="relative aspect-video overflow-hidden rounded-xl border border-midnight-border bg-midnight-deep">
                      <Image src={screenshot.previewUrl || screenshot.url} alt={t("testerApplications.detail.screenshotAlt", { number: index + 1, name: application.name })} fill unoptimized sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" />
                      <button type="button" disabled={saving} onClick={() => removeScreenshot(index)} aria-label={t("testerApplications.detail.removeScreenshot", { number: index + 1 })} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-midnight-border bg-midnight-card/90 text-rose-200 shadow transition hover:bg-midnight-card"><X size={15} /></button>
                    </figure>
                  ))}
                </div>
              )}
              <input id="application-screenshots-upload" type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple disabled={saving || screenshots.length >= maxScreenshots} onChange={selectScreenshots} className="sr-only" />
              <label htmlFor="application-screenshots-upload" className={`btn-ghost ${screenshots.length >= maxScreenshots ? "pointer-events-none opacity-50" : "cursor-pointer"}`}><ImagePlus size={15} />{t("testerApplications.detail.addScreenshots")}</label>
              <p className="mt-2 text-xs text-ink-muted">{t("testerApplications.detail.screenshotUrlsHint", { count: maxScreenshots - screenshots.length })}</p>
            </div>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.websiteUrl")}</span><input name="websiteUrl" type="url" defaultValue={application.websiteUrl ?? ""} className="input w-full" placeholder="https://" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.downloadUrl")}</span><input name="downloadUrl" type="url" required defaultValue={application.downloadUrl} className="input w-full" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.technologies")}</span><input name="technologies" maxLength={1000} defaultValue={application.technologies ?? ""} className="input w-full" /></label>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-ink">{t("testerApplications.detail.ownerInformation")}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.detail.ownerInformationHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.ownerName")}</span><input name="ownerName" required minLength={2} maxLength={120} defaultValue={application.ownerName} className="input w-full" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.ownerEmail")}</span><input name="ownerEmail" type="email" required defaultValue={application.ownerEmail} className="input w-full" /></label>
            <div>
              <ApplicationRoleSelect
                id="tester-application-management-owner-role"
                label={t("testerApplications.form.ownerRole")}
                value={ownerRole ?? ownerRoleOptions.find((role) => (
                  application.ownerTitle === en.projects.roles[role]
                  || application.ownerTitle === fr.projects.roles[role]
                )) ?? "FOUNDER"}
                onChange={(value) => {
                  const selectedRole = ownerRoleOptions.find((role) => role === value);
                  if (selectedRole) setOwnerRole(selectedRole);
                }}
                options={ownerRoleOptions.map((role) => ({ value: role, label: t(`projects.roles.${role}`) }))}
              />
              <input type="hidden" name="ownerTitle" value={ownerRole ? t(`projects.roles.${ownerRole}`) : application.ownerTitle} />
            </div>
            <ApplicationOwnerContactFields
              idPrefix="application-management"
              countryLabel={t("testerApplications.form.country")}
              phoneLabel={t("testerApplications.form.ownerPhone")}
              defaultCountry={application.ownerCountry}
              defaultPhone={application.ownerPhone}
            />
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.city")}</span><input name="ownerCity" required minLength={2} maxLength={100} defaultValue={application.ownerCity} className="input w-full" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.form.address")}</span><textarea name="ownerAddress" required minLength={5} maxLength={500} rows={2} defaultValue={application.ownerAddress} className="input w-full" /></label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">{t("testerApplications.detail.ownerDataPrivacy")}</p>
          <button type="submit" disabled={saving} className="btn-gold disabled:opacity-60"><Save size={15} />{saving ? t("testerApplications.detail.savingChanges") : t("testerApplications.detail.saveChanges")}</button>
        </div>
      </form>

      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-ink">{t("testerApplications.detail.pollManagement")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("testerApplications.detail.pollManagementDescription")}</p>
        </div>

        {pollError && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{pollError}</p>}
        {pollSuccess && <p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{pollSuccess}</p>}

        <form onSubmit={savePoll} className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-deep/30 p-4 sm:p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t("testerApplications.detail.question")}</span>
            <input value={pollTitle} onChange={(event) => setPollTitle(event.target.value)} required minLength={5} maxLength={200} className="input w-full" placeholder={t("testerApplications.detail.pollQuestionPlaceholder")} />
          </label>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">{t("testerApplications.detail.pollOptions")}</span>
            {pollOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(event) => setPollOptions((current) => current.map((value, optionIndex) => optionIndex === index ? event.target.value : value))}
                  required={index < 2}
                  maxLength={80}
                  className="input w-full"
                  placeholder={t("testerApplications.detail.option", { number: index + 1 })}
                />
                {pollOptions.length > 2 && (
                  <button type="button" onClick={() => setPollOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))} aria-label={t("testerApplications.detail.removePollOption", { number: index + 1 })} className="btn-ghost shrink-0 text-rose-200">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < maxPollOptions && (
              <button type="button" onClick={() => setPollOptions((current) => [...current, ""])} className="btn-ghost">
                <Plus size={15} />{t("testerApplications.detail.addPollOption")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={savingPoll} className="btn-gold disabled:opacity-60">
              <Save size={15} />{savingPoll ? t("testerApplications.detail.savingPoll") : editingPollId ? t("testerApplications.detail.updatePoll") : t("testerApplications.detail.createPollAction")}
            </button>
            {editingPollId && <button type="button" disabled={savingPoll} onClick={resetPollForm} className="btn-ghost">{t("common.cancel")}</button>}
          </div>
        </form>

        {pollsQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-24 w-full" /><div className="skeleton h-24 w-full" />
          </div>
        ) : pollsQuery.isError ? (
          <p role="alert" className="text-sm text-rose-200">{pollsQuery.error instanceof Error ? pollsQuery.error.message : t("testerApplications.detail.pollLoadError")}</p>
        ) : pollsQuery.data?.length ? (
          <div className="space-y-3">
            {pollsQuery.data.map((poll) => (
              <article key={poll.id} className="rounded-2xl border border-midnight-border bg-midnight-card/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-ink">{poll.title}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.detail.votes", { count: poll.totalVotes })}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => editPoll(poll)} className="btn-ghost"><Pencil size={14} />{t("testerApplications.detail.editPoll")}</button>
                    <button type="button" onClick={() => setPollToDelete(poll)} className="btn-ghost text-rose-200"><Trash2 size={14} />{t("testerApplications.detail.deletePoll")}</button>
                  </div>
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {poll.options.map((option) => (
                    <li key={option} className="flex items-center justify-between gap-3 rounded-lg bg-midnight-deep/50 px-3 py-2 text-sm text-ink-muted">
                      <span className="min-w-0 truncate">{option}</span>
                      <span className="shrink-0 tabular-nums">{poll.voteCounts[option] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-midnight-border px-4 py-6 text-center text-sm text-ink-muted">{t("testerApplications.detail.noManagedPolls")}</p>
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><BellRing size={18} aria-hidden="true" /></span>
          <div><h2 className="font-semibold text-ink">{t("testerApplications.detail.bugNotificationTitle")}</h2><p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("testerApplications.detail.bugNotificationDescription")}</p></div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
          <span>{application.bugReportNotificationsEnabled ? t("testerApplications.detail.notificationsEnabled") : t("testerApplications.detail.notificationsDisabled")}</span>
          <input type="checkbox" checked={application.bugReportNotificationsEnabled} disabled={saving} onChange={(event) => void updateBugReportNotifications(event.target.checked)} className="h-5 w-5 accent-emerald-400" />
        </label>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-400/25 bg-rose-400/[0.04] p-5 sm:p-6">
        <div><h2 className="font-semibold text-rose-200">{t("testerApplications.detail.deleteApplicationTitle")}</h2><p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("testerApplications.detail.deleteApplicationDescription")}</p></div>
        <button type="button" onClick={() => setDeleteDialogOpen(true)} className="btn-ghost border-rose-400/30 text-rose-200 hover:bg-rose-400/10"><Trash2 size={15} />{t("testerApplications.detail.deleteApplication")}</button>
      </section>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-midnight-border bg-midnight-card text-ink">
          <DialogTitle className="text-lg font-semibold">{t("testerApplications.detail.confirmDeleteTitle")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-ink-muted">{t("testerApplications.detail.confirmDeleteDescription", { name: application.name })}</DialogDescription>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={deleting} onClick={() => setDeleteDialogOpen(false)} className="btn-ghost">{t("common.cancel")}</button>
            <button type="button" disabled={deleting} onClick={() => void deleteApplication()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"><Trash2 size={15} />{deleting ? t("testerApplications.detail.deleting") : t("testerApplications.detail.confirmDeleteAction")}</button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pollToDelete !== null} onOpenChange={(open) => { if (!open && !deletingPoll) setPollToDelete(null); }}>
        <DialogContent className="border-midnight-border bg-midnight-card text-ink">
          <DialogTitle className="text-lg font-semibold">{t("testerApplications.detail.confirmDeletePollTitle")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-ink-muted">{t("testerApplications.detail.confirmDeletePollDescription", { question: pollToDelete?.title ?? "" })}</DialogDescription>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={deletingPoll} onClick={() => setPollToDelete(null)} className="btn-ghost">{t("common.cancel")}</button>
            <button type="button" disabled={deletingPoll} onClick={() => void deletePoll()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60">
              <Trash2 size={15} />{deletingPoll ? t("testerApplications.detail.deleting") : t("testerApplications.detail.deletePoll")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
