"use client";

import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Check, Clock3, ExternalLink, RefreshCw, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { AdminTesterApplicationsSkeleton } from "@/components/skeletons";

type AdminApplication = {
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
  createdAt: string;
  owner: { id: string; name: string | null; email: string; handle: string | null };
};

export function AdminTesterApplicationsSection() {
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-US";
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const reviewInFlight = useRef(false);
  const queryKey = ["admin-tester-applications"];
  const applicationsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch("/api/admin/tester-applications");
      if (response.status === 401) throw new Error(t("testerApplications.admin.loginRequired"));
      if (response.status === 403) throw new Error(t("testerApplications.admin.adminRequired"));
      if (!response.ok) throw new Error(t("testerApplications.admin.loadError"));
      return (await response.json() as { applications: AdminApplication[] }).applications;
    },
    refetchInterval: 30_000,
  });

  async function review(id: string, action: "APPROVE" | "REJECT") {
    if (reviewInFlight.current) return;
    reviewInFlight.current = true;
    await queryClient.cancelQueries({ queryKey });
    const previousApplications = queryClient.getQueryData<AdminApplication[]>(queryKey);
    if (!previousApplications) {
      reviewInFlight.current = false;
      return;
    }
    setBusyId(id);
    setActionError("");
    queryClient.setQueryData(queryKey, previousApplications.filter((application) => application.id !== id));
    try {
      const response = await fetch(`/api/admin/tester-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: reasons[id] ?? "" }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? t("testerApplications.admin.actionConflict") : t("testerApplications.admin.actionError"));
      const result = await response.json() as { emailSent: boolean };
      if (!result.emailSent) setActionError(t("testerApplications.admin.emailDeliveryFailed"));
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (error) {
      queryClient.setQueryData(queryKey, previousApplications);
      setActionError(error instanceof Error ? error.message : t("testerApplications.admin.genericError"));
    } finally {
      setBusyId("");
      reviewInFlight.current = false;
    }
  }

  const pendingCount = applicationsQuery.data?.length ?? 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("testerApplications.admin.title")}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{t("testerApplications.admin.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-100">
            <Clock3 size={14} />
            {applicationsQuery.isLoading
              ? <span className="skeleton inline-block h-3 w-24" aria-hidden="true" />
              : t("testerApplications.admin.pendingCount", { count: pendingCount })}
          </span>
          <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey })} disabled={applicationsQuery.isFetching} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">
            <RefreshCw size={14} className={applicationsQuery.isFetching ? "animate-spin" : ""} />
            {locale === "fr" ? "Actualiser" : "Refresh"}
          </button>
        </div>
      </header>

      {actionError && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{actionError}</p>}
      {applicationsQuery.isLoading ? <AdminTesterApplicationsSkeleton /> : applicationsQuery.isError ? (
        <div role="alert" className="card p-6 text-sm text-rose-200">{applicationsQuery.error instanceof Error ? applicationsQuery.error.message : t("testerApplications.admin.errorFallback")}</div>
      ) : applicationsQuery.data?.length ? (
        <div className="space-y-4">
          {applicationsQuery.data.map((application) => (
            <article key={application.id} className="card overflow-hidden border-midnight-border/80">
              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-start gap-4">
                  {application.logoUrl ? <Image src={application.logoUrl} alt={t("testerApplications.list.logoAlt", { name: application.name })} width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-2xl border border-midnight-border bg-white object-contain p-1.5" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 font-display text-2xl font-bold text-emerald-200">{application.name.slice(0, 1)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold text-ink">{application.name}</h3>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-medium text-emerald-100">{t(`testerApplications.list.platform.${application.platform}`)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{t("testerApplications.admin.receivedOn", { date: new Date(application.createdAt).toLocaleDateString(dateLocale), email: application.owner.email })}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{application.description}</p>
                  </div>
                  <a href={application.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0">{t("testerApplications.admin.testLink")} <ExternalLink size={14} /></a>
                </div>
                {application.problem && <div className="rounded-xl bg-midnight-card/80 p-4"><p className="text-xs font-semibold text-emerald-200">{t("testerApplications.admin.problem")}</p><p className="mt-1 text-sm text-ink-muted">{application.problem}</p></div>}
                <div className="rounded-xl bg-midnight-card/80 p-4"><p className="text-xs font-semibold text-emerald-200">{t("testerApplications.admin.testPath")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{application.testInstructions}</p></div>
                <div className="grid gap-4 border-t border-midnight-border/70 pt-5 sm:grid-cols-2">
                  <section><h3 className="text-sm font-semibold text-ink">{t("testerApplications.admin.owner")}</h3><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs"><dt className="text-ink-muted">{t("testerApplications.admin.name")}</dt><dd className="text-ink">{application.ownerName} · {application.ownerTitle}</dd><dt className="text-ink-muted">{t("testerApplications.admin.email")}</dt><dd className="break-all text-ink">{application.ownerEmail}</dd><dt className="text-ink-muted">{t("testerApplications.admin.phone")}</dt><dd className="text-ink">{application.ownerPhone || t("testerApplications.admin.notProvided")}</dd><dt className="text-ink-muted">{t("testerApplications.admin.cityCountry")}</dt><dd className="text-ink">{application.ownerCity}, {application.ownerCountry}</dd><dt className="text-ink-muted">{t("testerApplications.admin.address")}</dt><dd className="text-ink">{application.ownerAddress}</dd></dl></section>
                  <section><h3 className="text-sm font-semibold text-ink">{t("testerApplications.admin.productDetails")}</h3><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs"><dt className="text-ink-muted">{t("testerApplications.admin.created")}</dt><dd className="text-ink">{application.createdDate ? new Date(application.createdDate).toLocaleDateString(dateLocale) : t("testerApplications.admin.notSpecified")}</dd><dt className="text-ink-muted">{t("testerApplications.admin.technologies")}</dt><dd className="text-ink">{application.technologies || t("testerApplications.admin.notSpecified")}</dd><dt className="text-ink-muted">{t("testerApplications.admin.website")}</dt><dd className="break-all text-ink">{application.websiteUrl || t("testerApplications.admin.notProvided")}</dd></dl></section>
                </div>
                {application.screenshotUrls.length > 0 && <div className="flex gap-3 overflow-x-auto">{application.screenshotUrls.map((url, index) => <Image key={url} src={url} alt={t("testerApplications.admin.screenshotAlt", { number: index + 1, name: application.name })} width={320} height={180} unoptimized className="h-32 w-auto rounded-xl border border-midnight-border bg-white object-contain" />)}</div>}
                <div className="flex flex-col gap-3 border-t border-midnight-border/70 pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <label className="min-w-0 flex-1"><span className="mb-1.5 block text-xs text-ink-muted">{t("testerApplications.admin.rejectionReason")}</span><textarea value={reasons[application.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [application.id]: event.target.value }))} maxLength={1000} rows={2} className="input w-full" placeholder={t("testerApplications.admin.rejectionPlaceholder")} /></label>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={busyId !== ""} onClick={() => void review(application.id, "REJECT")} className="btn-ghost !border-rose-700 !bg-rose-700 !text-white hover:!border-rose-800 hover:!bg-rose-800 hover:!text-white !transition-none disabled:opacity-50"><X size={15} /> {t("testerApplications.admin.reject")}</button>
                    <button type="button" disabled={busyId !== ""} onClick={() => void review(application.id, "APPROVE")} className="btn-ghost !border-emerald-800 !bg-emerald-800 !text-white hover:!border-emerald-900 hover:!bg-emerald-900 hover:!text-white !transition-none disabled:opacity-50"><Check size={15} /> {t("testerApplications.admin.approve")}</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center px-6 py-16 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Check size={25} /></span><h2 className="mt-4 text-lg font-semibold text-ink">{t("testerApplications.admin.allClear")}</h2><p className="mt-2 text-sm text-ink-muted">{t("testerApplications.admin.empty")}</p></div>
      )}
    </section>
  );
}
