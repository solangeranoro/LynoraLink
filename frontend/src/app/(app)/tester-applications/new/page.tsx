"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";
import { TesterPlatformSelect } from "@/components/TesterPlatformSelect";
import { ApplicationOwnerContactFields } from "@/components/ApplicationOwnerContactFields";
import { ApplicationRoleSelect } from "@/components/ApplicationRoleSelect";
import { getNetworkErrorMessage } from "@/lib/error-messages";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  ImagePlus,
  Info,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  UserRound,
} from "lucide-react";

type UploadedImage = { image: string };
type StepField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const ownerRoleOptions = ["FOUNDER", "CO_BUILDER", "PRODUCT", "DEVELOPER", "DESIGNER", "MARKETER"] as const;

const steps = [
  { title: "stepProduct", description: "stepProductDescription", icon: Smartphone },
  { title: "stepBeta", description: "stepBetaDescription", icon: UploadCloud },
  { title: "stepOwner", description: "stepOwnerDescription", icon: UserRound },
  { title: "stepReview", description: "stepReviewDescription", icon: FileCheck2 },
];

const fieldClass = "input w-full";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";
const fileInputClass = "mt-3 block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700";
const maxImageBytes = 20 * 1024 * 1024;

async function fetchApplicationApi(input: RequestInfo | URL, init: RequestInit, connectionError: string) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (getNetworkErrorMessage(error)) throw new Error(connectionError);
    throw error;
  }
}

async function uploadImage(
  file: File,
  purpose: "logo" | "screenshot",
  errorMessage: string,
  connectionError: string,
) {
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  const response = await fetchApplicationApi("/api/tester-applications/media", { method: "POST", body }, connectionError);
  if (!response.ok) throw new Error(errorMessage);
  return (await response.json() as UploadedImage).image;
}

function isValidControl(element: StepField) {
  if (element instanceof HTMLInputElement && element.type === "checkbox") return element.checked;
  return element.checkValidity();
}

function focusControl(element: StepField) {
  const trigger = element.closest<HTMLElement>("[data-tester-platform-select]")?.querySelector<HTMLButtonElement>('[role="combobox"]');
  (trigger ?? element).focus();
}

export default function NewTesterApplicationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [ownerRole, setOwnerRole] = useState<(typeof ownerRoleOptions)[number]>("FOUNDER");
  const [logo, setLogo] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  const logoPreview = useMemo(() => logo ? URL.createObjectURL(logo) : null, [logo]);
  const screenshotPreviews = useMemo(
    () => screenshotFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [screenshotFiles],
  );
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    screenshotPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [logoPreview, screenshotPreviews]);

  function getFormValue(name: string) {
    return previewValues[name] ?? "";
  }

  function validatePanel(index: number) {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    const fields = Array.from(panel?.querySelectorAll<StepField>("input, textarea, select") ?? []);
    const invalid = fields.find((field) => !isValidControl(field));
    if (invalid) {
      invalid.reportValidity();
      focusControl(invalid);
      return false;
    }
    if (panel?.querySelector<HTMLInputElement>('[name="ownerCountry"]')?.value === "") {
      panel.querySelector<HTMLButtonElement>("[data-application-owner-country] button")?.focus();
      return false;
    }
    return true;
  }

  function goToNextStep() {
    if (!validatePanel(step)) return;
    const form = formRef.current;
    if (form) {
      const entries = Array.from(new FormData(form).entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string");
      setPreviewValues(Object.fromEntries(entries));
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToPreviousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const controls = Array.from(form.querySelectorAll<StepField>("input, textarea, select"));
    const invalid = controls.find((field) => !isValidControl(field));
    if (invalid) {
      const targetStep = Number(invalid.closest<HTMLElement>("[data-step]")?.dataset.step ?? 0);
      setStep(targetStep);
      window.requestAnimationFrame(() => {
        invalid.reportValidity();
        focusControl(invalid);
      });
      return;
    }
    if (!form.querySelector<HTMLInputElement>('[name="ownerCountry"]')?.value) {
      setStep(2);
      window.requestAnimationFrame(() => form.querySelector<HTMLButtonElement>("[data-application-owner-country] button")?.focus());
      return;
    }

    setSubmitting(true);
    setError("");
    const values = new FormData(form);
    try {
      const connectionError = t("testerApplications.form.connectionError");
      const logoUrl = logo
        ? await uploadImage(logo, "logo", t("testerApplications.form.uploadError"), connectionError)
        : null;
      const screenshotUrls = await Promise.all(screenshotFiles.map((file) => uploadImage(
        file,
        "screenshot",
        t("testerApplications.form.uploadError"),
        connectionError,
      )));
      const response = await fetchApplicationApi("/api/tester-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          description: values.get("description"),
          problem: values.get("problem"),
          testInstructions: values.get("testInstructions"),
          logoUrl,
          screenshotUrls,
          platform: values.get("platform"),
          createdDate: values.get("createdDate") || null,
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
      }, connectionError);
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        const message = result?.error === "ADMIN_NOTIFICATION_UNAVAILABLE"
          ? t("testerApplications.form.notificationError")
          : result?.error === "UNAUTHORIZED"
            ? t("testerApplications.form.sessionExpired")
            : result?.error === "INVALID_APPLICATION" || result?.error === "INVALID_MEDIA_URL"
              ? t("testerApplications.form.validationError")
              : response.status >= 500
                ? t("testerApplications.form.serverError")
                : t("testerApplications.form.submitError");
        throw new Error(message);
      }
      router.push("/tester-applications?submitted=1");
    } catch (submitError) {
      setError(getNetworkErrorMessage(submitError)
        ?? (submitError instanceof Error ? submitError.message : t("testerApplications.form.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6 xl:px-8">
      <Link href="/tester-applications" className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={16} /> {t("testerApplications.form.back")}</Link>
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-200">{t("testerApplications.form.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("testerApplications.form.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">{t("testerApplications.form.intro")}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4" aria-label={t("testerApplications.form.stepsLabel")}>
        {steps.map(({ title, description, icon: Icon }, index) => {
          const completed = index < step;
          const current = index === step;
          return (
            <button key={title} type="button" disabled={index > step || submitting} onClick={() => setStep(index)} aria-current={current ? "step" : undefined} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition sm:block sm:p-4 ${current ? "border-emerald-300/40 bg-emerald-300/10" : completed ? "border-emerald-300/20 bg-midnight-card/80 hover:border-emerald-300/40" : "border-midnight-border bg-midnight-card/80"} disabled:cursor-default`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${current || completed ? "bg-emerald-100 text-emerald-800" : "bg-midnight-deep text-ink-muted"}`}>
                {completed ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </span>
              <span className="min-w-0 sm:mt-3 sm:block">
                <span className={`block text-sm font-semibold ${current ? "text-emerald-200" : "text-ink"}`}>{String(index + 1).padStart(2, "0")} · {t(`testerApplications.form.${title}`)}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{t(`testerApplications.form.${description}`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <form ref={formRef} onSubmit={submitApplication} noValidate className="card overflow-hidden">
        <section data-step="0" hidden={step !== 0} className="space-y-6 p-5 sm:p-8">
          <div className="border-b border-midnight-border/70 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.stepCount", { current: 1, total: steps.length })}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{t("testerApplications.form.productTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{t("testerApplications.form.productDescription")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.name")} <span className="text-rose-300">*</span></span><input name="name" required minLength={2} maxLength={100} className={fieldClass} placeholder={t("testerApplications.form.namePlaceholder")} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.description")} <span className="text-rose-300">*</span></span><textarea name="description" required minLength={20} maxLength={5000} rows={4} className={fieldClass} placeholder={t("testerApplications.form.descriptionPlaceholder")} /><span className="mt-1.5 block text-xs text-ink-muted">{t("testerApplications.form.descriptionHint")}</span></label>
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.problem")}</span><textarea name="problem" maxLength={2000} rows={3} className={fieldClass} placeholder={t("testerApplications.form.problemPlaceholder")} /></label>
            <TesterPlatformSelect
              id="tester-application-platform"
              name="platform"
              label={t("testerApplications.form.platform")}
              required
            />
            <label><span className={labelClass}>{t("testerApplications.form.createdDate")}</span><input name="createdDate" type="date" className={fieldClass} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.technologies")}</span><input name="technologies" maxLength={1000} className={fieldClass} placeholder={t("testerApplications.form.technologiesPlaceholder")} /><span className="mt-1.5 block text-xs text-ink-muted">{t("testerApplications.form.technologiesHint")}</span></label>
          </div>
        </section>

        <section data-step="1" hidden={step !== 1} className="space-y-6 p-5 sm:p-8">
          <div className="border-b border-midnight-border/70 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.stepCount", { current: 2, total: steps.length })}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{t("testerApplications.form.betaTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{t("testerApplications.form.betaDescription")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label><span className={labelClass}>{t("testerApplications.form.downloadUrl")} <span className="text-rose-300">*</span></span><input name="downloadUrl" type="url" required className={fieldClass} placeholder={t("testerApplications.form.downloadUrlPlaceholder")} /><span className="mt-1.5 block text-xs text-ink-muted">{t("testerApplications.form.downloadUrlHint")}</span></label>
            <label><span className={labelClass}>{t("testerApplications.form.websiteUrl")}</span><input name="websiteUrl" type="url" className={fieldClass} placeholder={t("testerApplications.form.websiteUrlPlaceholder")} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.testInstructions")} <span className="text-rose-300">*</span></span><textarea name="testInstructions" required minLength={20} maxLength={3000} rows={5} className={fieldClass} placeholder={t("testerApplications.form.testInstructionsPlaceholder")} /><span className="mt-1.5 block text-xs text-ink-muted">{t("testerApplications.form.testInstructionsHint")}</span></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-midnight-border bg-midnight-card/80 p-4">
              <label htmlFor="application-logo" className="flex items-center gap-2 text-sm font-medium text-ink"><ImagePlus size={17} className="text-emerald-200" /> {t("testerApplications.form.logo")}</label>
              <input id="application-logo" type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" className={fileInputClass} onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > maxImageBytes) {
                  setError(t("testerApplications.form.logoSizeError"));
                  event.target.value = "";
                  return;
                }
                setError("");
                setLogo(file);
              }} />
              {logoPreview && <Image src={logoPreview} alt={t("testerApplications.form.logoPreview")} width={60} height={60} unoptimized className="mt-3 h-14 w-14 rounded-xl border border-midnight-border object-contain bg-white p-1" />}
              <p className="mt-2 text-xs text-ink-muted">{t("testerApplications.form.imageFormats")}</p>
            </div>
            <div className="rounded-2xl border border-dashed border-midnight-border bg-midnight-card/80 p-4">
              <label htmlFor="application-screenshots" className="flex items-center gap-2 text-sm font-medium text-ink"><UploadCloud size={17} className="text-emerald-200" /> {t("testerApplications.form.screenshots")}</label>
              <input id="application-screenshots" type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple className={fileInputClass} onChange={(event) => {
                const input = event.currentTarget;
                const files = Array.from(input.files ?? []);
                input.value = "";
                if (!files.length) return;
                if (screenshotFiles.length + files.length > 6) {
                  setError(t("testerApplications.form.screenshotsCountError"));
                  return;
                }
                if (files.some((file) => file.size > maxImageBytes)) {
                  setError(t("testerApplications.form.screenshotSizeError"));
                  return;
                }
                setError("");
                setScreenshotFiles((current) => [...current, ...files]);
              }} />
              <p className="mt-2 text-xs text-ink-muted">{t("testerApplications.form.screenshotsHint")}</p>
            </div>
          </div>
          {screenshotPreviews.length > 0 && <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{screenshotPreviews.map(({ file, url }) => <div key={`${file.name}-${file.lastModified}`} className="min-w-0"><Image src={url} alt={file.name} width={240} height={160} unoptimized className="aspect-[3/2] w-full rounded-lg border border-midnight-border object-cover" /><p className="mt-1 truncate text-[10px] text-ink-muted">{file.name}</p></div>)}</div>}
        </section>

        <section data-step="2" hidden={step !== 2} className="space-y-6 p-5 sm:p-8">
          <div className="border-b border-midnight-border/70 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.stepCount", { current: 3, total: steps.length })}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{t("testerApplications.form.ownerTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{t("testerApplications.form.ownerDescription")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label><span className={labelClass}>{t("testerApplications.form.ownerName")} <span className="text-rose-300">*</span></span><input name="ownerName" required minLength={2} maxLength={120} className={fieldClass} autoComplete="name" defaultValue={session?.user?.name ?? ""} /></label>
            <label><span className={labelClass}>{t("testerApplications.form.ownerEmail")} <span className="text-rose-300">*</span></span><input name="ownerEmail" type="email" required maxLength={254} className={fieldClass} autoComplete="email" defaultValue={session?.user?.email ?? ""} /></label>
            <div>
              <ApplicationRoleSelect
                id="tester-application-owner-role"
                label={`${t("testerApplications.form.ownerRole")} *`}
                value={ownerRole}
                onChange={(value) => {
                  const selectedRole = ownerRoleOptions.find((role) => role === value);
                  if (selectedRole) setOwnerRole(selectedRole);
                }}
                options={ownerRoleOptions.map((role) => ({ value: role, label: t(`projects.roles.${role}`) }))}
              />
              <input type="hidden" name="ownerTitle" value={t(`projects.roles.${ownerRole}`)} />
            </div>
            <ApplicationOwnerContactFields
              idPrefix="application-submission"
              countryLabel={t("testerApplications.form.country")}
              phoneLabel={t("testerApplications.form.ownerPhone")}
            />
            <label><span className={labelClass}>{t("testerApplications.form.city")} <span className="text-rose-300">*</span></span><input name="ownerCity" required minLength={2} maxLength={100} className={fieldClass} autoComplete="address-level2" /></label>
            <label className="sm:col-span-2"><span className={labelClass}>{t("testerApplications.form.address")} <span className="text-rose-300">*</span></span><textarea name="ownerAddress" required minLength={5} maxLength={500} rows={2} className={fieldClass} autoComplete="street-address" placeholder={t("testerApplications.form.addressPlaceholder")} /></label>
          </div>
          <div className="flex gap-3 rounded-xl border border-sky-300/20 bg-sky-300/5 p-4 text-sm leading-6 text-ink"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-200" /><p>{t("testerApplications.form.privacyNotice")}</p></div>
        </section>

        <section data-step="3" hidden={step !== 3} className="space-y-6 p-5 sm:p-8">
          <div className="border-b border-midnight-border/70 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.stepCount", { current: 4, total: steps.length })}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{t("testerApplications.form.reviewTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{t("testerApplications.form.reviewDescription")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="card p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.presentation")}</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{getFormValue("name") || t("testerApplications.form.productNameFallback")}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{getFormValue("description") || t("testerApplications.form.descriptionFallback")}</p>
              <p className="mt-3 text-xs text-ink-muted">{getFormValue("platform") ? t(`testerApplications.form.${getFormValue("platform").toLowerCase()}`) : t("testerApplications.form.platformFallback")}{getFormValue("technologies") ? ` · ${getFormValue("technologies")}` : ""}</p>
            </article>
            <article className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.betaAccess")}</p>
              <p className="mt-2 break-all text-sm text-ink">{getFormValue("downloadUrl") || t("testerApplications.form.downloadFallback")}</p>
              {getFormValue("websiteUrl") && <p className="mt-1 break-all text-xs text-ink-muted">{getFormValue("websiteUrl")}</p>}
              <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-ink-muted">{getFormValue("testInstructions") || t("testerApplications.form.scenarioFallback")}</p>
            </article>
            <article className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.form.owner")}</p>
              <p className="mt-2 text-sm text-ink">{getFormValue("ownerName") || t("testerApplications.form.ownerNameFallback")}</p>
              <p className="mt-1 text-xs text-ink-muted">{getFormValue("ownerTitle")}{getFormValue("ownerCity") ? ` · ${getFormValue("ownerCity")}, ${getFormValue("ownerCountry")}` : ""}</p>
              <p className="mt-2 break-all text-xs text-ink-muted">{getFormValue("ownerEmail") || t("testerApplications.form.emailFallback")}</p>
              <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.form.privateAddress")}</p>
            </article>
            <label className="flex items-start gap-3 rounded-xl border border-midnight-border p-4 sm:col-span-2">
              <input name="confirmDetails" type="checkbox" required className="mt-1 h-4 w-4 accent-emerald-500" />
              <span className="text-sm leading-6 text-ink-muted">{t("testerApplications.form.confirmation")}</span>
            </label>
          </div>
          <div className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100/90"><Info size={18} className="mt-0.5 shrink-0 text-amber-200" /><p>{t("testerApplications.form.approvalNotice")}</p></div>
        </section>

        {error && <p role="alert" className="mx-5 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 sm:mx-8">{error}</p>}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border/70 bg-midnight-card/80 px-5 py-4 sm:px-8">
          <button type="button" onClick={goToPreviousStep} disabled={step === 0 || submitting} className="btn-ghost disabled:invisible"><ArrowLeft size={16} /> {t("testerApplications.form.previous")}</button>
          <span className="hidden text-xs text-ink-muted sm:block">{t("testerApplications.form.stepCount", { current: step + 1, total: steps.length })}</span>
          {step < steps.length - 1 ? (
            <button type="button" onClick={goToNextStep} disabled={submitting} className="btn-gold">{t("testerApplications.form.continue")} <ChevronRight size={16} /></button>
          ) : (
            <button type="submit" disabled={submitting} className="btn-gold min-w-52 justify-center disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <><LoaderCircle size={16} className="animate-spin" /> {t("testerApplications.form.sending")}</> : <><Check size={16} /> {t("testerApplications.form.sendForReview")}</>}
            </button>
          )}
        </footer>
      </form>
      <p className="flex items-center justify-center gap-2 pb-4 text-center text-xs text-ink-muted"><ShieldCheck size={14} /> {t("testerApplications.form.privacyFooter")}</p>
    </main>
  );
}
