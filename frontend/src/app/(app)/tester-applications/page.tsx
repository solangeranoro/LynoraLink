"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Filter, FlaskConical, Plus, Search, Star } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TesterPlatformIcon, testerPlatformOptions } from "@/components/TesterPlatformIcon";

const TESTER_APPLICATIONS_PAGE_SIZE = 9;

type TesterApplication = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  downloadUrl: string;
  platform: "IOS" | "ANDROID" | "WEB" | "DESKTOP";
  ownerName: string;
  ownerTitle: string;
  ownerCity: string;
  ownerCountry: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  shares: number;
  ownerId: string;
  createdAt: string;
  averageRating: number | null;
  reviewCount: number;
}

export default function TesterApplicationsPage() {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("ALL");
  const [page, setPage] = useState(1);
  const applicationsQuery = useQuery({
    queryKey: ["tester-applications"],
    queryFn: async () => {
      const response = await fetch("/api/tester-applications?mine=1");
      if (!response.ok) throw new Error(t("testerApplications.list.loadingError"));
      return response.json() as Promise<{ applications: TesterApplication[] }>;
    },
  });
  const applications = useMemo(() => (applicationsQuery.data?.applications ?? []).filter((application) => {
    const matchesSearch = `${application.name} ${application.description} ${application.ownerName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (platform === "ALL" || application.platform === platform);
  }), [applicationsQuery.data?.applications, platform, search]);
  const pageCount = Math.max(1, Math.ceil(applications.length / TESTER_APPLICATIONS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleApplications = useMemo(
    () => applications.slice((currentPage - 1) * TESTER_APPLICATIONS_PAGE_SIZE, currentPage * TESTER_APPLICATIONS_PAGE_SIZE),
    [applications, currentPage],
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 xl:px-8">
      <header className="card flex flex-wrap items-end justify-between gap-6 p-6 sm:p-9">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <FlaskConical size={14} /> {t("testerApplications.list.badge")}
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("testerApplications.list.title")}</h1>
            <p className="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
              {t("testerApplications.list.description")}
            </p>
          </div>
          <Link href="/tester-applications/new" className="btn-gold shrink-0">
            <Plus size={17} /> {t("testerApplications.list.submit")}
          </Link>
      </header>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{t("testerApplications.list.sectionTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("testerApplications.list.sectionDescription")}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="relative min-w-48 flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("testerApplications.list.search")} className="input w-full pl-9" />
            </label>
            <Select value={platform} onValueChange={(value) => { setPlatform(value); setPage(1); }}>
              <SelectTrigger aria-label={t("testerApplications.list.filterPlatform")} className="h-11 w-full min-w-48 rounded-xl border-midnight-border bg-midnight-card/60 px-3 text-sm text-ink shadow-sm transition hover:border-emerald-300/30 focus-visible:border-emerald-300/50 focus-visible:ring-2 focus-visible:ring-emerald-300/15 sm:w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl border-midnight-border bg-midnight-card p-1.5 shadow-2xl">
                <SelectItem value="ALL" className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink focus:bg-midnight-deep focus:text-ink">
                  <Filter size={15} className="text-emerald-200" aria-hidden="true" />
                  <span>{t("testerApplications.list.allPlatforms")}</span>
                </SelectItem>
                {testerPlatformOptions.map(({ value }) => (
                  <SelectItem key={value} value={value} className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink focus:bg-midnight-deep focus:text-ink">
                    <TesterPlatformIcon platform={value} className="text-emerald-200" />
                    <span>{t(`testerApplications.list.platform.${value}`)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {applicationsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {[1, 2, 3].map((item) => <div key={item} className="card h-56 animate-pulse bg-midnight-card/60" />)}
          </div>
        ) : applicationsQuery.isError ? (
          <p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{t("testerApplications.list.loadingError")}</p>
        ) : applications.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><FlaskConical size={25} /></span>
            <h3 className="mt-4 text-lg font-semibold text-ink">{search || platform !== "ALL" ? t("testerApplications.list.noResults") : t("testerApplications.list.emptyTitle")}</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
              {search || platform !== "ALL" ? t("testerApplications.list.emptyFiltered") : t("testerApplications.list.emptyDescription")}
            </p>
            {!search && platform === "ALL" && <Link href="/tester-applications/new" className="btn-gold mt-5"><Plus size={16} /> {t("testerApplications.list.propose")}</Link>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleApplications.map((application) => (
              <article key={application.id} className="card group flex min-h-80 flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-emerald-300/30">
                <Link href={`/tester-applications/${application.id}`} aria-label={`${t("testerApplications.list.details")} · ${application.name}`} className="relative block aspect-[16/9] overflow-hidden rounded-xl border-b border-midnight-border bg-midnight-card/80">
                  {application.screenshotUrls[0] ? (
                    <Image src={application.screenshotUrls[0]} alt={t("testerApplications.detail.screenshotAlt", { number: 1, name: application.name })} fill sizes="(max-width: 768px) 100vw, 33vw" unoptimized className="object-cover transition duration-500 group-hover:scale-[1.02]" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center font-display text-6xl font-bold text-emerald-200">{application.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                  {application.logoUrl ? (
                    <Image src={application.logoUrl} alt={t("testerApplications.list.logoAlt", { name: application.name })} width={52} height={52} unoptimized className="h-[52px] w-[52px] shrink-0 rounded-xl border border-midnight-border bg-white object-contain p-1.5" />
                  ) : (
                    <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 font-display text-xl font-bold text-emerald-200">{application.name.slice(0, 1).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">{application.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${application.status === "APPROVED" ? "bg-emerald-300/10 text-emerald-200" : application.status === "PENDING" ? "bg-amber-300/10 text-amber-200" : "bg-rose-300/10 text-rose-200"}`}>
                        {application.status === "APPROVED" ? t("testerApplications.list.approved") : application.status === "PENDING" ? t("testerApplications.list.pending") : t("testerApplications.list.rejected")}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-muted">
                      <TesterPlatformIcon platform={application.platform} className="text-emerald-200" />
                      <span>{t(`testerApplications.list.platform.${application.platform}`)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{application.ownerCity}, {application.ownerCountry}</span>
                    </p>
                  </div>
                  <ArrowUpRight size={17} className="shrink-0 text-ink-muted transition group-hover:text-emerald-800" />
                </div>
                  <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-ink-muted">{application.description}</p>
                {application.status === "REJECTED" && application.rejectionReason && <p className="mt-3 line-clamp-2 text-xs text-rose-200">{t("testerApplications.list.rejectionReason", { reason: application.rejectionReason })}</p>}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border/70 pt-4 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1.5" aria-label={application.reviewCount ? `${application.averageRating?.toFixed(1)} · ${t(application.reviewCount === 1 ? "testerApplications.list.reviewCountOne" : "testerApplications.list.reviewCount", { count: application.reviewCount })}` : t("testerApplications.list.noReviews")}>
                    <Star size={14} className={application.reviewCount ? "text-amber-300" : "text-ink-muted"} fill={application.reviewCount ? "currentColor" : "none"} aria-hidden="true" />
                    {application.reviewCount ? (
                      <>
                        <span className="font-semibold text-amber-100">{application.averageRating?.toFixed(1)}</span>
                        <span>{t(application.reviewCount === 1 ? "testerApplications.list.reviewCountOne" : "testerApplications.list.reviewCount", { count: application.reviewCount })}</span>
                      </>
                    ) : (
                      <span>{t("testerApplications.list.noReviews")}</span>
                    )}
                  </span>
                  <span>{t("testerApplications.list.by", { name: application.ownerName })}</span>
                  <div className="flex w-full gap-2">
                    {application.status === "APPROVED" && (
                      <a href={application.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-gold !min-h-8 flex-1 !px-3 !py-1.5 text-xs">{t("testerApplications.list.test")}</a>
                    )}
                    <Link href={`/tester-applications/${application.id}`} className="btn-ghost !min-h-8 flex-1 !px-3 !py-1.5 text-xs">{t("testerApplications.list.details")}</Link>
                  </div>
                </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!applicationsQuery.isLoading && !applicationsQuery.isError && applications.length > TESTER_APPLICATIONS_PAGE_SIZE && (
          <nav aria-label={locale === "fr" ? "Pagination des applications testeur" : "Tester applications pagination"} className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border pt-4">
            <p className="text-xs text-ink-muted">
              {locale === "fr"
                ? `Page ${currentPage} sur ${pageCount} · ${applications.length} applications`
                : `Page ${currentPage} of ${pageCount} applications`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="btn-ghost !rounded-xl !px-3 !py-2 text-xs disabled:opacity-40">
                {locale === "fr" ? "Précédent" : "Previous"}
              </button>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="btn-gold !rounded-xl !px-3 !py-2 text-xs disabled:opacity-40">
                {locale === "fr" ? "Suivant" : "Next"}
              </button>
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}
