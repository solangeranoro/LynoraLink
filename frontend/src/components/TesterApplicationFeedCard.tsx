"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FlaskConical, Star } from "lucide-react";
import { TesterPlatformIcon, type TesterPlatform } from "@/components/TesterPlatformIcon";
import { useTranslation } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";

export type ApprovedTesterApplication = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  platform: TesterPlatform;
  downloadUrl: string;
  websiteUrl: string | null;
  technologies: string | null;
  ownerName: string;
  ownerCity: string;
  ownerCountry: string;
  shares: number;
  ownerId: string;
  createdAt: string;
  reviewedAt: string | null;
  averageRating: number | null;
  reviewCount: number;
};

export function TesterApplicationFeedCard({ application }: { application: ApprovedTesterApplication }) {
  const { t, locale } = useTranslation();
  const approvedAt = application.reviewedAt ?? application.createdAt;

  return (
    <article className="flex h-full min-h-[410px] flex-col overflow-hidden rounded-2xl border border-emerald-300/20 bg-midnight-card shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition hover:border-emerald-300/40">
      <Link
        href={`/tester-applications/${application.id}`}
        aria-label={`${t("testerApplications.list.details")} · ${application.name}`}
        className="group relative block aspect-[16/9] shrink-0 overflow-hidden bg-midnight-deep"
      >
        {application.screenshotUrls[0] ? (
          <Image
            src={application.screenshotUrls[0]}
            alt={t("testerApplications.detail.screenshotAlt", { number: 1, name: application.name })}
            fill
            sizes="(max-width: 640px) 84vw, 320px"
            unoptimized
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-7xl font-bold text-emerald-200/70">
            {application.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="tester-application-approved-badge inline-flex min-w-0 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
            <FlaskConical size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{t("feed.approvedApplication")}</span>
          </span>
          <time dateTime={approvedAt} className="shrink-0 text-[10px] text-ink-muted">
            {timeAgo(approvedAt, locale)}
          </time>
        </div>
        <div className="flex items-center gap-3">
          {application.logoUrl ? (
            <Image
              src={application.logoUrl}
              alt={t("testerApplications.list.logoAlt", { name: application.name })}
              width={42}
              height={42}
              unoptimized
              className="h-[42px] w-[42px] shrink-0 rounded-xl border border-midnight-border bg-white object-contain p-1.5"
            />
          ) : (
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 font-display text-lg font-bold text-emerald-200">
              {application.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-semibold text-ink">{application.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <TesterPlatformIcon platform={application.platform} className="shrink-0 text-emerald-200" />
              <span className="truncate">{t(`testerApplications.list.platform.${application.platform}`)}</span>
            </p>
          </div>
          <ArrowUpRight size={16} className="shrink-0 text-emerald-200" aria-hidden="true" />
        </div>

        <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-ink-muted">{application.description}</p>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[11px] text-ink-muted">
          <span className="truncate">{t("testerApplications.list.by", { name: application.ownerName })}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Star size={12} className={application.reviewCount ? "text-amber-300" : "text-ink-muted"} fill={application.reviewCount ? "currentColor" : "none"} aria-hidden="true" />
            {application.reviewCount
              ? `${application.averageRating?.toFixed(1)} · ${application.reviewCount}`
              : t("testerApplications.list.noReviews")}
          </span>
        </div>
        {application.websiteUrl && (
          <a
            href={application.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-1 text-xs font-medium text-emerald-200 hover:text-emerald-100"
          >
            {t("feed.applicationWebsite")}
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-midnight-border/70 pt-3">
          <a
            href={application.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold min-h-9 justify-center !px-2 !py-2 text-xs"
          >
            {t("feed.applicationTestAction")}
          </a>
          <Link
            href={`/tester-applications/${application.id}`}
            className="btn-outline min-h-9 justify-center !px-2 !py-2 text-xs"
          >
            {t("feed.applicationDetailsAction")}
          </Link>
        </div>
      </div>
    </article>
  );
}
