"use client";

import { Compass, Flame, GraduationCap, Rocket, Star, Trophy } from "@/components/FontAwesomeIcons";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export type BadgeKey = "TOP_MAKER" | "EARLY_LAUNCHER" | "MENTOR" | "CO_BUILDER" | "COMMUNITY_STAR" | "EXPLORER";
export type AwardedBadge = { key: BadgeKey; name: string; icon: string; awardedAt: string };
export type MakerStanding = {
  rank: number | null;
  activityScore: number;
  totalRanked: number;
  activeWindowDays: number;
  minimumScore: number;
  activity: Record<"POST" | "COMMENT" | "PROJECT" | "TEAM" | "POLL" | "FEEDBACK" | "LIKE" | "LIVE_SESSION", number>;
  weights: Record<"POST" | "COMMENT" | "PROJECT" | "TEAM" | "POLL" | "FEEDBACK" | "LIKE" | "LIVE_SESSION", number>;
};

const badgeIcons = {
  TOP_MAKER: Trophy,
  EARLY_LAUNCHER: Rocket,
  MENTOR: GraduationCap,
  CO_BUILDER: Flame,
  COMMUNITY_STAR: Star,
  EXPLORER: Compass,
} as const;

function badgeTitle(key: BadgeKey, t: (key: string) => string) {
  return t(`gamification.badges.${key}.title`);
}

function isRecent(awardedAt: string) {
  const timestamp = new Date(awardedAt).getTime();
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

export function BadgeIconList({ badges, size = 14 }: { badges: AwardedBadge[]; size?: number }) {
  const { t } = useTranslation();
  if (!badges.length) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-label={t("gamification.badgesLabel")}>
      {badges.map((badge) => {
        const Icon = badgeIcons[badge.key];
        const title = badgeTitle(badge.key, t);
        return (
          <span key={badge.key} title={title} aria-label={title} className={`inline-grid shrink-0 place-items-center text-gold-soft ${isRecent(badge.awardedAt) ? "animate-badge-pulse" : ""}`}>
            <Icon size={size} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}

export function BadgeCollection({ badges, emptyLabel, compact = false }: { badges: AwardedBadge[]; emptyLabel: string; compact?: boolean }) {
  const { t, locale } = useTranslation();
  if (!badges.length) return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  return (
    <ul className={compact ? "grid gap-x-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {badges.map((badge) => {
        const Icon = badgeIcons[badge.key];
        const isNew = isRecent(badge.awardedAt);
        return (
          <li key={badge.key} className={compact ? "flex min-w-0 items-start gap-3 border-b border-midnight-border/70 py-3 last:border-0" : "flex min-w-0 items-start gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3.5"}>
            <span className={compact ? `grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/10 text-gold-soft ${isNew ? "animate-badge-pulse" : ""}` : `grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold-soft ${isNew ? "animate-badge-pulse" : ""}`}>
              <Icon size={compact ? 17 : 19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{badgeTitle(badge.key, t)}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t(`gamification.badges.${badge.key}.description`)}</span>
              {isNew && <span className="mt-2 inline-block text-[10px] font-semibold uppercase text-gold-soft">{t("gamification.newBadge")}</span>}
              <time className="mt-2 block text-[10px] text-ink-muted" dateTime={badge.awardedAt}>{new Date(badge.awardedAt).toLocaleDateString(locale)}</time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MakerRankingCard({ standing, embedded = false }: { standing: MakerStanding; embedded?: boolean }) {
  const { t } = useTranslation();
  const progress = Math.min(100, Math.round((standing.activityScore / standing.minimumScore) * 100));

  return (
    <section aria-labelledby="maker-ranking-title" className={embedded ? "min-w-0" : "card relative overflow-hidden border-gold/25 bg-gradient-to-br from-gold/10 via-midnight-card/80 to-midnight-card/50 p-5 sm:p-6"}>
      {!embedded && <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />}
      <div className={`relative flex flex-wrap items-center gap-3 ${embedded ? "" : "gap-4"}`}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold-soft">
          <Trophy size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="maker-ranking-title" className="text-sm font-semibold text-ink">{t("gamification.profileRanking")}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t("gamification.activeWindow")}</p>
        </div>
        {standing.rank !== null && (
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-gold-soft">
            {t("gamification.rankOf", { rank: standing.rank, total: standing.totalRanked })}
          </span>
        )}
      </div>
      {embedded ? (
        <div className="relative mt-4 min-w-0 space-y-4 border-t border-midnight-border/70 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-ink">{standing.activityScore}</p>
              <p className="text-xs text-ink-muted">{t("gamification.activityScore")}</p>
            </div>
            {standing.rank === null && (
              <p className="max-w-[60%] text-right text-[11px] leading-relaxed text-ink-muted">
                {t("gamification.pointsToQualify")}: <span className="font-semibold tabular-nums text-ink">{Math.max(0, standing.minimumScore - standing.activityScore)}</span>
              </p>
            )}
          </div>
          {standing.rank === null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-midnight-border/70">
              <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="grid min-w-0 grid-cols-3 divide-x divide-midnight-border/70 border-y border-midnight-border/70 py-2">
            {[
              { label: t("gamification.rankingBuild"), count: standing.activity.PROJECT + standing.activity.TEAM },
              { label: t("gamification.rankingPublish"), count: standing.activity.POST },
              { label: t("gamification.rankingCommunity"), count: standing.activity.COMMENT + standing.activity.FEEDBACK + standing.activity.POLL + standing.activity.LIKE + standing.activity.LIVE_SESSION },
            ].map(({ label, count }) => (
              <div key={label} className="min-w-0 px-2 first:pl-0 last:pr-0">
                <p className="text-sm font-semibold tabular-nums text-ink">{count}</p>
                <p className="break-words text-[10px] leading-tight text-ink-muted">{label}</p>
              </div>
            ))}
          </div>
          <Link href="/top-makers" className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-gold-soft transition hover:text-gold-bright">
            <span className="truncate">{t("gamification.viewLeaderboard")}</span><span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <div className="relative mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-midnight-border/70 pt-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-ink">{standing.activityScore}</p>
            <p className="text-xs text-ink-muted">{t("gamification.activityScore")}</p>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:max-w-md">
            {[
              { label: t("gamification.rankingBuild"), count: standing.activity.PROJECT + standing.activity.TEAM },
              { label: t("gamification.rankingPublish"), count: standing.activity.POST },
              { label: t("gamification.rankingCommunity"), count: standing.activity.COMMENT + standing.activity.FEEDBACK + standing.activity.POLL + standing.activity.LIKE + standing.activity.LIVE_SESSION },
            ].map(({ label, count }) => (
              <div key={label} className="rounded-lg border border-midnight-border/70 bg-midnight-deep/40 px-2.5 py-2">
                <p className="text-sm font-semibold tabular-nums text-ink">{count}</p>
                <p className="truncate text-[10px] text-ink-muted">{label}</p>
              </div>
            ))}
          </div>
          {standing.rank === null && (
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <div className="mb-1.5 flex justify-between gap-3 text-[11px] text-ink-muted">
                <span>{t("gamification.pointsToQualify")}</span>
                <span className="tabular-nums">{Math.max(0, standing.minimumScore - standing.activityScore)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-midnight-border/70">
                <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <Link href="/top-makers" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-soft transition hover:text-gold-bright">
            {t("gamification.viewLeaderboard")} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
